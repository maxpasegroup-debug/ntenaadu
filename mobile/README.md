# NTE Naadu mobile app foundation

This is an isolated NTE Naadu Flutter app surface. It does not change the HappiNotes
Flutter app, identifiers, backend, or deployment configuration.

## Android release foundation

The Android project is under `android/`, with separate staging and production
application variants. API origins are supplied per controlled build through
`NTE_API_BASE_URL`; do not commit live config or signing material. See
`../NTE_ANDROID_RELEASE.md` for candidate package ID, SDK/permission policy, and
upload-key custody requirements. The application ID and live API origins still
need owner approval/provisioning before a build.

## Localization behavior

- English (`en`) is the initial default.
- English is complete for this onboarding slice. Hindi, Malayalam, and Tamil
  retain the foundation/welcome translations; missing onboarding keys fall back
  individually to English.
- The searchable picker lists India's 22 scheduled languages. Languages without
  a current resource pack are marked as coming soon and cannot be selected; their
  translations are not represented as complete.
- Locale changes are applied at the app root and saved locally, so an open screen
  is not replaced. The account repository synchronizes language after
  authentication when the account API is reachable.
- Interface translations are separate from learning-content languages. Content
  selection must use server-declared content language metadata and must not infer
  availability from the interface locale.

## Onboarding integration boundary

The welcome, parent registration/sign-in/recovery, family, student profile,
consent-status, and profile-language screens use `OnboardingApiRepository` through
the `OnboardingRepository` boundary. Configure an isolated NTE backend origin
with Flutter's `--dart-define=NTE_API_BASE_URL=https://<nte-non-production-host>`
for a non-release environment, or the approved HTTPS NTE origin for a release
configuration. HappiNotes hosts are rejected. No API origin is included by
default.

Registration and recovery are API contracts but remain unavailable until the
backend's approved verification and recovery providers are configured. Sign-in,
session storage/rotation, language sync, and authenticated family/profile and
consent-policy operations are wired to the dedicated backend. Guardian/student
form values before sign-in are in-memory drafts only; registration intentionally
does not submit child drafts. Authenticated profiles are saved only after an API
response. Consent appears only after fetching an exact-language published policy
and is recorded/revoked only after server confirmation. Passwords are cleared
after submission. No endpoint or client state simulates a successful account,
verification, recovery, or consent result.

## Dashboards

The parent dashboard reads linked student profiles from the authenticated family
API and offers family management, language/settings, and notification entry
points. It links to the published learning library and Events screen, and shows
unavailable states for progress, notifications, and activity where services are
not connected. Clubs and events use their NTE APIs. The student dashboard is a guardian-opened view of a linked profile inside
the same guardian session; there is no independent student authentication. It is
available only when that server profile is active and guardian consent is
recorded. Student view hides guardian settings and the guardian's account-wide
language control. Dashboard actions for learning, clubs, growth, and notifications
do not display fabricated records or claim those features are available.

Broad Child/Youth labels are UI groupings only. Exact age thresholds, consent
wording/versioning, identity verification, and providers need founder or
qualified-advisor decisions before activation.

## Learning library and media

The Learn tab calls authenticated NTE endpoints for published topics, catalogue
metadata, details, thumbnail grants, and playback grants. Catalogue filters use
published metadata only; available content languages are derived from published
language variants. Search, topic/programme/age/content-language filters, content
details, empty/error/retry states, and pagination are included. Recent and
continue-learning history is omitted because there is no progress or playback
history API.

Audio playback uses the declared `just_audio` dependency for signed NTE media
URLs, including seek/progress and elapsed/remaining display. The dependency has
not been fetched or verified in this phase. NTE media delivery is disabled, no
content or media assets are seeded, and the backend cannot issue playback or
thumbnail URLs. Paid entitlements remain locked. Video playback is not
implemented because this app has no configured video player/source. Offline
download and background playback are not claimed.

## Adding a language

1. Add a locale resource named `assets/l10n/<locale>.json` using the English keys.
2. Add the locale and its native/English names to `lib/localization/languages.dart`.
3. Mark it selectable only after a qualified reviewer signs off the resource.
4. Add the locale to `supportedLocales` in `lib/main.dart` so Flutter's built-in
   Material, Cupertino, and accessibility labels use the locale where supported.

High-impact consent, safeguarding, payment, and legal wording needs qualified
human review before publication. Machine translation alone is not approval.
Unknown or missing interface keys fall back to English; an unsupported locale is
not silently substituted as the user's saved preference.

## Formatting and scripts

`lib/localization/formatters.dart` centralizes locale-aware date, number, and INR
formatting. Flutter/platform font fallback is retained; no single-script custom
font is imposed. Layouts should use wrapping and flexible constraints for longer
translations. Locale preference persists locally and syncs to the signed-in NTE
account when the API is reachable.

## Clubs and community

The Clubs tab uses the authenticated NTE API for approved-club search and detail,
guardian-owned membership requests and approvals, application status, assigned
leader request decisions and announcements, and least-privilege staff review
and moderation. It displays no invented club, member, event, or family records.
Approximate locality is the most precise location shown. Event listings are
filtered to the selected approved club when opened from its details.

Student membership submission is available only for persisted, active profiles
with an active guardian relationship and server-recorded consent. The server
always creates a request awaiting guardian approval first; only after that does
it enter the assigned leader queue. Leader request cards show age band, not a
student name or contact. Announcements require accepted membership to read, or
an assigned leader role to publish.

Applications are persisted by the NTE service, but adult age/identity
verification is disabled. The UI identifies this blocker and the server refuses
approval unless a configured workflow confirms `verified`. Staff role controls
are not user-assignable and must be provisioned out of band under an approved
operational policy. No external adult-verification, notification, or messaging
service is claimed as active.

New Phase 5 UI strings are in `assets/l10n/en.json`. Hindi, Malayalam, and Tamil
continue using the existing per-key English fallback for these untranslated
club strings; no complete club-language pack is claimed.

## Events, registrations and attendance

The Events screen reads published upcoming/past events and family registrations
from the NTE API. A guardian can register an eligible active linked profile
after recorded consent; each request remains pending until the guardian makes a
separate approval decision. Approval confirms a place only when capacity is
available; otherwise the request is waitlisted. When a confirmed registration
is cancelled before the event starts, the oldest still-eligible guardian-
approved waitlist entry is promoted within the same transaction. A confirmed
place cannot be cancelled after a published event starts; pending or waitlisted
requests can still be withdrawn.

Only an assigned leader whose NTE account has verified adult status, or an
explicitly provisioned adult-verified `event_manager` staff account, can
create/edit/cancel events or view its confirmed roster and record/correct
attendance. Roster responses omit contact details and family identifiers.
Attendance changes are auditable. Event announcements are persisted
in an authorized event feed; there is no push, SMS, email, or in-app notification
delivery provider configured, so publishing an update does not claim that
families were notified.

Event-specific consent language and cancellation, waitlist, and attendance
correction policies require founder and qualified-advisor review. The workflow
uses the existing recorded guardian relationship consent as an additional
eligibility prerequisite; it does not claim legal consent by itself. The event
manager role is assigned out of band, with no self-service role assignment.

New Phase 6 UI strings are in `assets/l10n/en.json`. Hindi, Malayalam, and Tamil
use the existing English fallback for untranslated event copy. No complete
event translation pack is claimed.
