# NTE Naadu identity and learning API

> **Current status:** This README contains implementation notes from earlier
> phases. Statements below that describe missing content administration,
> payment/entitlement APIs, or other phase scope are historical and may predate
> later implementation. For the current source-level integration inventory,
> release blockers, environment variables, and founder decisions, see the
> project-root `PHASE_10_INTEGRATION_HANDOVER.md`,
> `NTE_RELEASE_READINESS.md`, `NTE_ENVIRONMENT_REFERENCE.md`, and
> `NTE_FOUNDER_DECISIONS.md`. Those documents do not claim runtime verification.

This is a separate TypeScript/Express/Mongoose service. It does not import or
modify the HappiNotes backend. It uses only `NTE_MONGODB_URI`, forces the
`NTE_MONGODB_DATABASE` database name, and refuses a database name containing
`happinotes` or a HappiNotes host name. Never copy HappiNotes credentials or
production records into this service.

## Activation boundaries

- No registration or recovery provider is implemented. Both are disabled by
  default; registration fails before writing an account, and recovery returns a
  provider-unavailable response without revealing whether an account exists.
- No reviewed consent policy is seeded. Student profiles can only be created
  under a verified guardian session and remain `pending_consent`; access to
  clubs/events/programmes is outside this phase. Consent can be granted only
  for an approved, published policy with an exact matching language, ID, and
  version, plus an explicit confirmation action. There are no policy admin
  routes in this phase.
- No learning topics or content are seeded. Learning records live in the
  NTE-specific `nte_learning_topics` and `nte_learning_content` collections;
  only records explicitly marked `published` are returned. Content publishing
  is not exposed through an admin API in this phase.
- Media delivery is disabled by default. `NTE_MEDIA_PROVIDER` must remain
  `disabled`; unknown provider configuration is refused. No HappiNotes media
  keys, buckets, or URLs are imported. Media routes never return an asset key
  and cannot produce playback or thumbnail URLs until a reviewed NTE delivery
  adapter is implemented.
- Paid-content entitlements are not implemented. Paid records may expose
  catalogue metadata and an `entitlement_unavailable` status; playback access
  always fails closed. No payment flags or client-side decisions grant access.
- A service owner must securely confirm that the MongoDB cluster/credentials are
  dedicated to NTE Naadu. The code enforces an NTE database name but cannot
  discover whether an opaque MongoDB Atlas cluster is shared with another app.
- MongoDB transactions are used for linked identity/profile/consent writes; the
  configured MongoDB deployment must support transactions (replica set or sharded
  cluster).
- Production requires NTE-specific JWT secret, MongoDB URI/database, HTTPS CORS
  origins, and an explicit deployment target. No deployment configuration is
  included or activated here.

## API contracts

Base path: `/api/v1`

| Method | Path | Access | Purpose |
|---|---|---|---|
| POST | `/auth/parents/registrations` | Public, rate limited | Parent registration contract; fails closed while verification provider is disabled |
| POST | `/auth/verification/complete` | Public, rate limited | Verification contract; disabled until provider configured |
| POST | `/auth/sessions` | Public, rate limited | Parent sign-in; returns short-lived access and rotating refresh tokens only for verified accounts |
| POST | `/auth/sessions/refresh` | Refresh token | Rotate session credentials |
| DELETE | `/auth/sessions/current` | Bearer access token | Revoke current refresh session |
| GET | `/auth/me` | Bearer access token | Current parent account and language preference |
| PATCH | `/auth/me/language` | Bearer access token | Persist the selected interface language to the parent account |
| POST | `/auth/recovery-requests` | Public, rate limited | Recovery contract; unavailable until approved provider exists |
| POST | `/auth/recovery-completions` | Public, rate limited | Recovery completion contract; unavailable until approved provider exists |
| GET | `/family/students` | Verified guardian | List only the authenticated guardian's family profiles |
| GET | `/family/audit` | Verified guardian | Read the last 100 non-sensitive family audit events |
| POST | `/family/students` | Verified guardian | Create a private student profile and pending-consent relationship |
| PATCH | `/family/students/:studentId` | Owning verified guardian | Update preferred name, broad age group, or preferred language |
| DELETE | `/family/students/:studentId` | Owning verified guardian | Archive profile without deleting consent/audit history |
| GET | `/family/consent-policy?language=` | Verified guardian | Return an approved, published policy in the exact requested language; unavailable when none exists |
| POST | `/family/relationships/:relationshipId/consent` | Owning verified guardian | Record explicit consent against the exact active policy/version |
| POST | `/family/relationships/:relationshipId/consent/revocations` | Owning verified guardian | Revoke consent and append an immutable event |
| GET | `/learning/topics?language=` | Verified guardian | List published topics with a label in the exact requested language |
| GET | `/learning/catalog` | Verified guardian | Search/filter published learning metadata; optional linked-profile access is checked for active consent |
| GET | `/learning/content/:contentId` | Verified guardian | Read published detail; validates linked-profile access when supplied |
| GET | `/learning/content/:contentId/media-access` | Verified guardian | Check access then request a media grant; currently unavailable without media delivery and paid entitlements |
| GET | `/learning/content/:contentId/thumbnail-access` | Verified guardian | Request a thumbnail grant; currently unavailable without media delivery |

Exact birth dates are not part of the profile contract. Child/Youth are broad
temporary age groups; exact thresholds require a separate approved policy.

## Clubs and community (Phase 5)

Club data is stored only in the NTE collections `nte_club_applications`,
`nte_clubs`, `nte_club_membership_requests`, and `nte_club_announcements`.
There are no seeded clubs or sample family/member records. Discovery returns
approved clubs only and exposes approximate locality, age bands, meeting format,
purpose, and leader names without contact details.

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/clubs` | Verified parent | Search approved clubs; optional locality, query, age band, or owned student filter |
| GET | `/clubs/:clubId` | Verified parent | Approved details and optional owned-profile membership status |
| POST/GET | `/clubs/applications`, `/clubs/applications/mine` | Verified parent | Apply and view only own applications |
| POST | `/clubs/applications/:applicationId/cancellation` | Applicant | Cancel before review is complete |
| GET | `/clubs/me/capabilities` | Verified parent | Return explicitly assigned club staff roles |
| GET/POST | `/clubs/staff/applications`, `/clubs/staff/applications/:applicationId/review` | `club_reviewer` | Review applications; approval requires adult verification status `verified` |
| GET/POST | `/clubs/staff/clubs`, `/clubs/staff/:clubId/moderation` | `club_moderator` | View and suspend/reinstate clubs with a reason |
| GET | `/clubs/staff/audit` | `club_moderator` | Read recent club audit entries |
| POST/GET | `/clubs/:clubId/membership-requests`, `/clubs/guardian/requests` | Owning verified guardian | Submit and review linked-student requests; active relationship plus recorded consent required |
| POST | `/clubs/membership-requests/:requestId/guardian-decision` | Owning guardian | Approve/reject; approval advances to leader review, never directly to membership |
| POST | `/clubs/membership-requests/:requestId/cancellation` | Requesting guardian | Cancel only while guardian or leader decision is pending |
| GET/POST | `/clubs/leader/clubs`, `/clubs/leader/requests`, `/clubs/leader/membership-requests/:requestId/decision` | Assigned leader | View assigned clubs and age-band-only requests; decide after guardian approval |
| GET/POST | `/clubs/:clubId/announcements`, `/clubs/leader/clubs/:clubId/announcements` | Accepted member/assigned leader | Read a scoped feed or publish as an assigned leader |
| DELETE | `/clubs/staff/announcements/:announcementId` | `club_moderator` | Remove a published announcement |

All protected operations use the authenticated parent session and scope family
data to its guardian. Leader request responses omit student names and contact
details. No student directory, messaging, or member list is implemented in this
club workflow. Event workflows are described separately below. Every review, membership decision, cancellation, announcement, and
moderation transition appends to NTE audit history.

Adult age/identity verification is deliberately disabled: the provider returns
`unavailable`, which permits an application to be saved as `awaiting_verification`
but prevents club approval. Contact verification is not adult verification.
Staff roles are stored as explicit least-privilege account roles, hidden from
public account DTOs, and have no self-service assignment endpoint; a service
owner must provision them through an approved secured operational process.
Qualified advice and a provider/policy are required before adult verification,
club approval, or moderation staffing can be activated.

Learning metadata holds per-language title/description, declared available
language codes, media type, optional editorial duration, topic/programme
association, age bands, objectives, publication state, and free/paid access
requirement. Storage asset keys are private fields. This phase adds no content
administration, progress or playback history, streaming provider, video player
service, or entitlement/payment service. The content owner must define editorial
publishing and language-review controls before records are published.

## Events, participation, and attendance (Phase 6)

Events are stored separately in `nte_events`, `nte_event_registrations`,
`nte_event_attendance`, and `nte_event_announcements`. No events, registrations,
attendance, or notices are seeded. Discovery exposes published events only,
approximate locality, approved age bands, capacity, and participation
instructions; it never exposes attendance publicly.

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/events?view=upcoming|past&clubId=&studentProfileId=` | Verified parent | Published events, optionally scoped to an approved club or owned, consented profile |
| GET | `/events/:eventId` | Verified parent | Event details and optional owned-profile registration state |
| POST | `/clubs/:clubId/events` | Adult-verified assigned club leader or adult-verified `event_manager` | Create a published event for an approved club |
| PATCH/POST | `/events/:eventId`, `/events/:eventId/cancellation` | Adult-verified assigned club leader or adult-verified `event_manager` | Edit future event or cancel with a reason |
| GET | `/events/leader/clubs`, `/events/leader/managed` | Verified parent | Only clubs/events the account can manage |
| POST | `/events/:eventId/registrations` | Owning guardian | Create pending-guardian request for eligible profile with recorded consent |
| GET | `/events/guardian/registrations` | Owning guardian | List registrations for own family, optionally filtered to a linked profile |
| POST | `/events/registrations/:registrationId/guardian-decision` | Owning guardian | Record explicit approve/reject; approval confirms or waitlists |
| POST | `/events/registrations/:registrationId/cancellation` | Owning guardian | Withdraw pending/waitlisted registrations anytime; cancel confirmed place before event start |
| GET | `/events/:eventId/roster` | Adult-verified assigned club leader or adult-verified `event_manager` | Read confirmed event roster only; no family contact data |
| PATCH | `/events/:eventId/attendance/:registrationId` | Adult-verified assigned club leader or adult-verified `event_manager` | Record or correct present/absent/excused status |
| GET/POST | `/events/:eventId/announcements` | Registered family or event organizer | Read scoped event updates or publish as an organizer |
| DELETE | `/events/staff/announcements/:announcementId` | Adult-verified `event_manager` | Remove event update |
| GET | `/events/audit` | Adult-verified `event_manager` | Read recent event workflow audit entries |

Each registration is unique per event/profile while active and begins as
`pending_guardian`; it does not reserve a place. Guardian approval requires the
current active relationship and consent record. A MongoDB transaction atomically
increments `confirmedCount` only when below capacity; otherwise the registration
is `waitlisted` with guardian approval kept distinct. When a confirmed place is
cancelled before the event starts, the oldest eligible guardian-approved waitlist
record is promoted within that transaction. A changed or revoked relationship
prevents promotion. Event capacity cannot be lowered below current confirmed
registrations. The configured MongoDB deployment must support transactions.

Attendance is a separate auditable record, writable after event start only for
confirmed registrations. Roster reads and corrections are scoped to a verified
leader's club with adult verification or an explicit adult-verified
`event_manager` role. Event edits stop once an event
starts; confirmed-place cancellation closes at start, while pending/waitlisted
requests can be withdrawn later. These are implementation
defaults pending a founder-approved participation/cancellation policy. Existing
guardian relationship consent is an eligibility gate; it is not represented as
qualified event-specific legal consent. No notification delivery provider is
configured: event announcements are persisted feeds, not push/email/SMS notices.

`event_manager` is an explicit least-privilege account role, hidden from public
account DTOs, with no self-service assignment route. Both the adult-verification
state and role must be provisioned through an approved secured process unless a
configured verification workflow establishes the state. Event-specific consent language, age-band definitions,
waitlist policy, attendance correction rules, cancellation terms, and any
required provider configuration need founder and qualified-advisor review before
activation.
