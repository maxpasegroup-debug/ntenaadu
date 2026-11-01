# NTE Naadu — Master Founder Product, UI/UX & Growth Audit

**Audit type:** source-level product and architecture review. No source implementation changes were made for this audit. No tests, builds, APKs, device rendering, database access, runtime checks, Railway access, production access, deployment, merge, or commit were performed in this audit.

## Executive summary

The current NTE project is a substantial **guardian-led learning and club/events application foundation**: Flutter mobile screens, an Express/Mongoose API, family-linked student profiles, explicit guardian consent records, learning catalogue/programme flows, moderated clubs, events and attendance, safeguarding case handling, a mobile staff console, and payment/entitlement contracts. Several of these are real API-backed source flows, not just screens.

Some inherited handovers are stale relative to the current repository. For example, `NTE_END_TO_END_SOURCE_AUDIT.md` records Android and payment blockers that are now represented in source as an Android scaffold and a corrected, still-disabled payment path. `NTE_STAGING_SETUP.md` and `NTE_PHASE_4_STAGING_VERIFICATION.md` predate the latest staging configuration/build startup; their remaining end-to-end verification gaps are still relevant. Prefer current source and dated environment evidence over those older status statements.

The source does **not yet implement the founder’s national membership-network model**. There are no distinct Mother and Father community experiences, member IDs/cards, local network operating model, invitations/referrals, community tasks, mentor/trainer workflows, governing council/advisory board structure, webinars, or SIA. Dream Addiction is represented by a general programme catalogue and activity-progress mechanic; it is not yet a practical life school with live participation and coaching. Paid programme access is intentionally disabled, media delivery is unavailable, and contact verification/recovery/adult verification are disabled.

There is one source-visible mobile build blocker: `StudentEntryScreen` and `ParentEntryScreen` extend `StatelessWidget` but use `widget.locale` and `widget.session` (`mobile/lib/onboarding/onboarding_screens.dart:174–217`). Those references are only available on a `State` object. This is a static source finding; no Flutter compiler was run.

The recent known staging state from the preceding authorized Railway work was: the NTE backend staging deployment on commit `8ac1758` reported successful build and API startup. That did **not** establish end-to-end behavior. This audit did not access Railway. The repo’s older staging/release notes say staging was unavailable and are now stale; update them after an approved staging verification. Production was not accessed.

## What exists in source

| Area | Source evidence | Assessment |
|---|---|---|
| Mobile shell and onboarding | `mobile/lib/main.dart`; `onboarding/onboarding_screens.dart`; `onboarding/onboarding_session.dart` | English-first Flutter shell, parent registration/sign-in/recovery screens, family profile forms, consent UI, profile settings. Registration/recovery remain blocked by disabled providers. The student entry path redirects to the guardian flow; there is no independent student account. Two entry screens contain the compile blocker above. |
| Family identity and consent | `backend/src/controllers/auth-controller.ts`; `family-controller.ts`; `models.ts` | Parent account, one guardian-owned family, multiple student records, child/youth age bands, preferred language, explicit consent policy ID/version/language, grant/revoke events and audit history. No second-parent association flow or child account/session exists. Consent cannot be activated normally until an approved policy is published. |
| Learning | `mobile/lib/learning/*`; `backend/src/controllers/learning-controller.ts`; `admin-content-controller.ts`; `models.ts` | Content/topic catalogue, language availability, age filters, entitlement checks and expiring media-grant contracts. Audio player UI exists. Video is explicitly unavailable in the mobile detail screen. The media provider is disabled, so playable delivery is not established. |
| Clubs and announcements | `mobile/lib/clubs/*`; `backend/src/controllers/club-controller.ts`; `models.ts` | Club application, staff review/moderation, guardian then leader membership decisions, announcements, leader list and audit routes are present. This is a **club workflow**, not a national/local member-network model. No invite/referral, tasks, introductions, structured networking or community campaigns. |
| Events and attendance | `mobile/lib/events/*`; `backend/src/controllers/event-controller.ts`; `models.ts` | Event list/detail, registration, guardian decision, capacity/waitlist, cancellation, roster, attendance, announcements and audit routes are present in source. They have not been exercised against staging. |
| Dream Addiction/programmes | `mobile/lib/programmes/*`; `backend/src/controllers/programme-controller.ts`; `admin-content-controller.ts`; `models.ts` | Programme catalogue, modules, activities, enrollment and guardian-recorded progress exist. No distinct training, webinar, mentor, reflection, action evidence, or ALTT loop workflow. No guarantee that a Dream Addiction programme or content is seeded/published. |
| Payments | `mobile/lib/payments/*`; `backend/src/controllers/payment-controller.ts`; `backend/src/services/payments/payment-provider.ts`; `models.ts` | Quote/order/refund/entitlement/webhook data contracts exist. Paid programmes are explicitly disabled (`paidProgrammesEnabled = false`); provider is unconfigured and checkout fails closed. Checkout code supports only one-time purchase; recurring subscription lifecycle is not implemented. |
| Admin and safeguarding | `mobile/lib/admin/*`; `backend/src/controllers/admin-controller.ts`, `safeguarding-controller.ts`; middleware | Role-gated mobile console for overview, parent-account status, club/event operations, content/programmes, finance, safeguarding and audit. Safeguarding report intake, restricted case details, status transitions, action reasons and audit records exist. No web admin app/login, organisation governance, staff provisioning UI, trainer/mentor management or response operation. |
| Localization | `mobile/lib/localization/*`; `mobile/assets/l10n/*.json` | English resource has 626 keys. Hindi, Malayalam and Tamil each have 9 keys, leaving 617/626 English fallback keys per pack. A 22-language searchable catalogue exists; only English, Hindi, Malayalam and Tamil are selectable as translated UI. Language preference is local for signed-out users and account-sync is attempted after sign-in. |
| Android/release | `mobile/android/*`; `mobile/pubspec.yaml`; `mobile/lib/network/api_config.dart` | Android platform scaffold is present. Candidate package `com.ntenaadu.app`, staging suffix `.staging`, app labels, Internet-only permission, cleartext disabled, API-origin compile define, and upload-key configuration gate exist. No live API origin or signing key should be assumed from source. |
| Web/domain | Project inventory | No NTE web client, browser admin login, web build configuration or `ntenaadu.com` domain configuration is present in this NTE repository. |

## Founder-vision fit

The architecture preserves some useful foundations for the vision—guardian-linked children, role-checked staff actions, clubs, events, content, programme activities and audit records—but its current organizing concept is **family account → child profile → catalogue/club/event**. The founder’s organizing concept is **Student, Mother and Father members → distinct communities → local networking and leadership → practical learning and action**. That mismatch affects identity, navigation, permissions, data models, admin operations and growth loops; it cannot be solved by copy or skin changes alone.

### Three experiences

- **Student:** a guardian-mediated profile view exists in `dashboard_screens.dart`; it is not a student login, membership profile, photograph, ID card or independent member dashboard. Parent authentication protects every API route.
- **Mother:** no Mother role, profile category or separate community exists.
- **Father:** no Father role, profile category or separate community exists.
- **Family:** the `Family` schema has one unique `guardianId`; no second-parent invite, acceptance, dispute or joint-parent permission flow exists.

### Membership and community

There is no member number, card, photograph upload, member status lifecycle, referral attribution, invitation flow or safe public share artifact. The club model has leaders and club memberships but no local-chapter network, structured introductions, member directory policy, tasks, training calendar, recognition or chapter-governance model. Do not market the current club listing as the intended NTE Naadu network.

### SIA and ALTT

No SIA implementation, AI provider, prompt/service contract, conversation UI or scripted onboarding guide was found. ALTT is not represented as an end-to-end loop. Programme activities can link to learning content and a guardian can record progress states; there is no practice submission, participation check, action record, reflection or next-step coaching.

### Dream Addiction and pricing

Dream Addiction is a name/entry point and could be represented by a programme record. The generic programme system supports language, age bands, activities and progress. The founder-provided ₹5,999 + GST standard monthly and ₹2,199 + GST special monthly prices are not proof of a configured subscription. Current checkout accepts only an approved one-time configuration, while paid programmes are disabled and the adapter is unconfigured. No recurring billing, renewals, failed-payment recovery, cancellations or subscription entitlements exist.

## Ten highest-priority gaps

1. Fix the two `StatelessWidget` `widget.*` references before any Flutter compile or APK gate.
2. Choose the identity model: student account vs guardian-mediated student mode; add Mother/Father as distinct member experiences.
3. Approve and implement multi-parent family linking and authority/dispute handling.
4. Approve legal/safeguarding policy, consent text and age/access rules; publish a reviewed policy before collecting real child data.
5. Implement and configure contact verification and account recovery providers; current routes intentionally fail closed.
6. Create a real membership lifecycle, member ID/card and privacy-safe photo handling; keep cards explicitly non-verification credentials.
7. Build the free community operating model: local groups, invitations, introductions, recurring practice, events, tasks, leadership and moderation.
8. Make Dream Addiction an activity-led learning programme with trainer/live support and ALTT practice/reflection; keep payment disabled until recurring billing and terms are ready.
9. Establish operational governance: staff provisioning/revocation, safeguarding staffing and escalation, retention, incident response, support and analytics.
10. Improve UI localization coverage and verify actual small-device, script rendering, accessibility and low-bandwidth behavior; add browser admin only after role/session design.

## UI/UX and visual-evidence limits

Source uses the approved green/saffron/ivory palette, Material 3, scrollable screens, 520–640 px content constraints, cards, forms, navigation and explicit loading/error/unavailable patterns. It has reusable API repositories and translation keys in many user-facing screens. The parent dashboard contains several honest “unavailable” summaries rather than real activity data. The student dashboard is a guardian-switched view. Notifications show an unavailable dialog. The club/events/programme pages are dense catalogue/workflow screens, not movement/community home pages. Learning thumbnails can be requested remotely; no in-repo photography/illustration library or NTE storyboard file was found. The previously supplied storyboard is a design reference, not evidence of rendered app fidelity.

No screen was rendered on a device or emulator. Therefore spacing, overflow, contrast, font fallback, script shaping, screen-reader order/labels, keyboard access, touch-target quality, large text, and low-end-device behavior are **unverified**. The audit is source-based, not a visual QA pass.

## Safety, privacy and operational review

### Positive source controls

- Family endpoints query the authenticated parent’s active family and check student ownership; only age bands, not exact birth dates, are modeled by default.
- Student profiles are not public and all API routes are parent-authenticated; no student directory or direct messaging route was found.
- Consent grant requires a published policy reference and explicit confirmation; grant/revocation write relationship status plus consent/audit events.
- Staff roles are not self-assigned through public routes; server middleware gates admin, finance, safeguarding, club-review and event operations.
- Safeguarding report description and reporter/subject identifiers are hidden by default and selected for staff case handling; reads/actions require reasons and create audit records.
- Password hashing, short-lived access tokens, hashed/rotated refresh tokens, server session checks and secure mobile token storage are represented in source.
- Payment, media, verification, recovery and adult-verification features fail closed when their adapters are absent.
- API/db guards reject explicit HappiNotes host/name fragments and require the database name `nte_naadu`; this does not prove hosted infrastructure isolation.

### Material risks and unverified controls

- No qualified review of consent/age/legal text, escalation policy, retention, deletion, or applicable Indian privacy obligations is in source. Qualified legal/privacy/safeguarding advice is required before real child data.
- There is one guardian per family in the schema. The proposed two-parent family model needs consent, visibility and conflict rules before implementation.
- Staff role provisioning is out of band. Secure approval, break-glass, periodic access review and emergency offboarding are not implemented as an operational workflow.
- Safeguarding access is role-based and broadly scoped to safeguarding staff; decide whether assignment scoping, conflict-of-interest handling and access alerts are needed.
- No account deletion/retention jobs or backup/restore evidence were found. Audit/safeguarding records need deliberate retention/legal-hold handling.
- A member card, once added, must not imply verified identity; keep child photos, exact location, contact details and credentials out of public links.
- Provider adapters, CORS, session rotation, authorization isolation and MongoDB transaction behavior have not been independently tested here.

## Growth recommendation

Use an ethical loop: campaign or trusted local invitation → clear member choice (Student/Mother/Father) → short, safe onboarding → first local welcome/training → a useful weekly practice or event → visible private progress/recognition → optional consent-based invitation. Measure completed onboarding, first activity, 4-week participation, event attendance, referral conversion and report/opt-out rates. Do not reward raw invite volume, expose child identity, manufacture member counts or create pressure notifications.

## Product share estimate

I do not assign a percentage. “Vision represented” mixes operational capability, user experience, governance, safety, content, AI, community quality and live service readiness; the repository has no objective weighting or acceptance baseline. A numeric percentage would be invented. The evidence supports a clear conclusion instead: **the technical foundation is meaningful, but the defining Mother/Father membership network, SIA, membership identity, community operating model and practical premium school are mostly absent.**

## Next action

Use `NTE_PRODUCT_GAP_ANALYSIS.md` and `NTE_FINAL_IMPLEMENTATION_ROADMAP.md` to approve the product boundaries and P0 corrections. Do not invite real families or children until the Flutter build blocker, verified identity/recovery, reviewed consent and safeguarding operations, dedicated tested staging, and staff coverage are resolved.
