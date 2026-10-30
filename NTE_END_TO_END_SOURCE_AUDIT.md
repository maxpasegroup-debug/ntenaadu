# NTE Naadu — End-to-End Source Audit

**Audit date:** 2026-10-30  
**Scope:** Static/source inspection of the isolated `nte_naadu` mobile and backend trees, localization/configuration, and available Phase 10 handover materials.  
**Verdict:** **NOT READY FOR END-TO-END CONFIRMATION, APK GENERATION, WEB LAUNCH, OR PRODUCTION RELEASE.**  
**Evidence boundary:** No tests, builds, APK generation, runtime/UI rendering, staging services, Railway configuration, production database, DNS, or deployment were accessed. This report records source-visible facts and defects; it does not claim any code passed verification.

## Executive summary

The NTE tree contains a Flutter mobile UI and an Express/Mongoose API with substantial identity, family, learning, club, event, programme, payment, admin, and safeguarding code. Source shows useful safeguards: parent-scoped family queries, consent/version records, protected staff routes, provider fail-closed behavior, secure token storage, and NTE-specific configuration checks.

The application cannot currently be confirmed as an end-to-end working product. Source inspection found a likely backend compilation blocker in payment order creation, an incomplete paid-programme data model, no Android platform project in the NTE Flutter tree, and no web application. Core launch flows are intentionally unavailable: parent registration/recovery providers and an approved consent policy are not configured. The student experience is a guardian-selected profile view, not an independently authenticated student account.

Resolve the source blockers and establish isolated NTE staging before running the verification plan below. Do not merge a staged branch until its checks and acceptance evidence are reviewed.

## Feature status

| Area | Status | Source-level finding |
|---|---|---|
| Parent registration | **Unavailable** | Registration fails closed while contact verification is disabled; no account is created. |
| Parent sign-in/session | **Implemented, unverified** | Password hash, short-lived access token, rotating hashed refresh token, revocation, and secure-storage client code exist. A usable account still depends on an approved provisioning/verification path. |
| Account recovery | **Unavailable** | Recovery endpoints exist but return unavailable while no recovery adapter is configured. |
| Guardian/student profiles | **Partial** | Guardian-scoped profile CRUD, age bands, language, relationships, and explicit consent records exist. New profiles remain pending until a published policy can be accepted. |
| Consent policy | **Unavailable for activation** | API requires an exact-language, published policy record. No approved policy seed or policy administration route is present. |
| Parent dashboard | **Partial** | Family profiles and entry points are present; progress/activity/notifications and some request summaries display unavailable states rather than live data. |
| Student dashboard | **Partial** | Guardian-opened view of a linked profile under the guardian's session. There is no separate student authentication or recovery. |
| Learning library | **Partial** | Published catalogue/detail routes and player UI exist. Media delivery is disabled, there are no seeded assets/content, and paid access cannot be activated. |
| Clubs | **Partial** | Approval, membership request, moderation, leadership, and announcement code exists. Adult verification is unavailable, so key approval/leadership operations cannot be activated. No push or direct messaging exists. |
| Events/attendance | **Partial** | Registration, guardian approval, capacity/waitlist, roster, attendance, and audit code exists. Event policy decisions and adult-verification activation remain unresolved; no notification delivery exists. |
| Dream Addiction/programmes | **Partial** | Programme catalogue and guardian-recorded enrolment/progress code exists. This is not a student-owned goals service; content and media availability are not established. |
| Payments/refunds/entitlements | **Unavailable for transactions** | Provider is unconfigured and fail-closed. Source also has an undefined `orderId` reference and the programme schema/admin path lacks purchase fields. |
| Safeguarding reports | **Partial** | Submit/status/queue/case/action/audit routes and a mobile reporting UI exist. Operational escalation coverage, qualified policy, retention, and incident process are not configured. |
| Admin console | **Partial** | Role-gated console exists inside the Flutter mobile app. There is no NTE web app or web admin login. Staff roles are provisioned out of band. |
| Localization | **Partial** | Central JSON resources, English fallback, searchable 22-language catalogue, and English/Hindi/Malayalam/Tamil locale selection exist. README describes later-phase Hindi/Malayalam/Tamil UI as partial; other languages are discoverable but not translated. |
| Android APK project | **Unavailable** | `nte_naadu/mobile` contains `lib/`, assets, `pubspec.yaml`, and README, but no `android/` platform scaffold or signing configuration. |
| Web app/domain | **Unavailable** | No NTE web client, web admin surface, or NTE domain/deployment configuration was found under `nte_naadu`. |

## Ranked source findings

### Blocker — payment handler references an undefined variable

In `backend/src/controllers/payment-controller.ts`, an order is assigned to `order`, but the checkout and audit calls use `orderId` without a declaration in that scope (lines 80–92). This is a source-visible unresolved identifier and is expected to prevent TypeScript compilation. No compiler was run, so this is not a reported build result.

### Blocker — paid programme configuration is incomplete

`backend/src/models.ts` defines purchase price/terms fields on `LearningContent`, but the `Programme` schema does not define them. `payment-controller.ts` reads those fields from `Programme`, and `admin-content-controller.ts` reports purchase configuration for programmes. Programme creation/update does not accept or persist price/terms. Paid-programme checkout cannot be fully configured from the current source even after a provider adapter is supplied.

### Blocker — no Android platform scaffold for APK generation

There is no `nte_naadu/mobile/android` directory or release signing configuration in the NTE mobile project. The repository `.gitignore` ignores `android/` and `ios/` directories generally and only has explicit allow-rules for the existing root `flutter_app` project. If Android scaffolding is created for NTE, it must also be made trackable under the NTE path. No Flutter build was attempted.

### Blocker — account creation, recovery, and consent cannot be activated

Verification and recovery adapters are hard-coded disabled and config rejects selecting a non-disabled provider until an adapter exists. Registration therefore fails closed. Profile creation requires an authenticated verified guardian, and consent requires a published policy record; no approved policy is supplied or managed through an admin route. These are safe defaults, but they block normal onboarding.

### Blocker — no web app or web admin login exists

The isolated project contains a Flutter app and API only. The admin console is a Flutter screen reached by staff-role capability. A browser app, web admin login, web session protections, and domain hosting configuration still need implementation and review.

### High — student view is guardian-mediated

The dashboard switches into a student-profile view inside the parent's authenticated session. The client hides some guardian actions, but this is a presentation mode, not an independently authenticated student identity. Reflect this in product claims and verify against approved student-access policy before launch.

### High — safeguarding and data lifecycle are not operationally specified

Safeguarding report APIs store restricted reports and record access/action reasons, but source does not establish staffed response coverage, response targets, urgent-risk procedures, external referrals, or retention/deletion timelines. No account deletion route or implemented retention job was found. Obtain qualified privacy/safeguarding advice before collecting real child or safeguarding data.

### Medium — user-facing brand spelling defect

The English localization resource uses “Ente Naadu” in visible account-service messages, including `auth.noAccountCreated`, `profile.accountNotConnected`, and `auth.configurationRequired`. The approved spelling is “NTE Naadu”.

### Medium — interface translations are incomplete

English is the default resource. Hindi, Malayalam, and Tamil are selectable, but the mobile README describes later-phase club/event strings as falling back to English; remaining listed Indian languages are unavailable as translated UI. Script shaping, line wrapping, screen-reader output, and low-end devices remain unverified.

## Security and privacy review

### Positive source controls

- Authenticated family operations scope queries to the guardian's active family; student profile IDs are checked against that family.
- Consent is an explicit server operation with policy ID/version/language and grant/revocation event history; profile state remains pending until consent is recorded.
- Staff roles are not self-assigned through public routes. Admin, safeguarding, finance, club, and event endpoints have server-side role checks.
- Safeguarding descriptions and reporter identifiers are hidden by default and selected for restricted staff case views. Reporter status responses omit reports where the reporter is also the reported student's guardian.
- Sessions use an NTE-specific issuer/audience, short access-token duration, hashed rotating refresh tokens, server-side session checks, and Flutter secure storage.
- Payment, media, contact verification, recovery, and adult verification fail closed without implementations/configuration; client state is not payment proof.
- API and database configuration reject explicit HappiNotes host/name patterns and require database name `nte_naadu`.

### Risks and confirmations required

- URI/name guards cannot prove that a hosted MongoDB cluster, credential, backup, storage bucket, or deployment is dedicated to NTE. Operator confirmation is required.
- Staff provisioning is out of band; define approval, revocation, and periodic access review.
- Safeguarding read access is role-based; decide whether assignment-scoped access, conflict checks, or emergency break-glass controls are required.
- Consent/audit records are append-only in normal model paths, but backup, retention, deletion, legal hold, and operator access controls are not operationally demonstrated.
- CORS and auth controls are visible in source; they have not been exercised against deployment proxies, origins, or browsers.
- No credentials or provider values were found in the NTE file inventory; `.env.example` contains placeholders. Keep live values out of the repository.

## UI and accessibility review

Source shows a mobile Flutter interface using the approved saffron/green/ivory palette, Material components, a 640-pixel dashboard content constraint, scrollable content, shared localization resources, and labels/tooltips in many navigation actions. The mobile README documents loading/error/empty states and English fallback.

This is not visual confirmation. There is no Android platform project to install, and no browser/admin web client exists. Actual spacing, text overflow, Malayalam/Hindi rendering, contrast, touch targets, screen-reader behavior, reduced motion, keyboard navigation, and small-device behavior remain **unverified**. Some admin flows are dense and written as compact single-file widgets; they need manual usability review.

## Environment and product separation

- NTE source is under `nte_naadu/mobile` and `nte_naadu/backend`, with NTE database naming and API-origin configuration.
- No live `.env`, signing key, or provider credential was found under the NTE project file inventory. The example secret is a placeholder.
- Dedicated database/cluster, transaction support, NTE-only secrets, API host, media bucket, payment account, notification credentials, and deployment target have not been verified.
- No NTE Railway settings were accessed. No NTE web deployment or `ntenaadu.com` DNS/hosting configuration was found.
- HappiNotes product files/configuration were not modified as part of this audit.

## Verification plan for the authorized staging phase

Use an isolated NTE staging branch, backend, database, storage, provider sandboxes, and test identities. Do not use HappiNotes production accounts/data or real payment transactions. Retain redacted evidence only.

1. **Resolve source blockers:** fix the undefined payment identifier; complete paid-programme schema/admin fields or keep paid programmes disabled; add NTE Android scaffold and ensure it is tracked; implement the approved web/admin scope before claiming web readiness; correct the brand typo.
2. **Configuration and isolation:** verify Railway staging service uses NTE-only variables, database/credentials and transaction-capable MongoDB; verify HTTPS API host, CORS allowlist, JWT secret presence, storage isolation, and absence of secrets in logs. Inspect names/presence without exposing values.
3. **Static checks:** run backend build/typecheck and lint; run Flutter format/analyze and unit tests; ensure NTE files are not accidentally ignored. These are future authorized checks, not performed in this audit.
4. **Identity/family:** test registration verification, duplicate contact, rate limits, sign-in, invalid password, token refresh/replay/revocation, recovery expiry/replay, multiple students, cross-family IDOR attempts, profile archive, language changes, consent exact-version behavior, withdrawal, and unavailable-policy behavior.
5. **Safeguarding/admin authorization:** test reporter confidentiality, guardian-subject status access, unauthorized role denial, least-privilege role combinations, audit reason capture, case assignment/status transitions, suspension/session invalidation, and escalation runbook with synthetic reports.
6. **Learning/programmes/payments:** verify published localized content, explicit missing-language behavior, media-unavailable handling, free access, paid quote/terms, sandbox checkout, signed webhook invalid/duplicate/out-of-order events, entitlement grant/reversal/refund, cross-account order access, partial-refund review, and reconciliation. Use provider sandboxes only.
7. **Clubs/events:** test approval/verification gates, guardian then leader decisions, cross-family access, age eligibility, consent revocation after approval, event capacity/waitlist promotion, cancellation, attendance authorization/corrections, announcement audience, and audit records.
8. **Mobile UI/APK:** after platform setup, inspect guardian flows and student view on small and mid-size Android devices; verify Hindi/Malayalam/Tamil text, accessibility, offline/network errors, session expiry, and low-bandwidth behavior. Build/install a staging APK only after prior checks.
9. **Web/admin/domain:** build web client against staging API; test login/logout/session expiry and server-side role enforcement; review responsive/accessibility behavior and admin routes. Use a staging subdomain first. Production domain/DNS follows explicit release sign-off.
10. **Merge gate:** merge the staged branch only after the agreed matrix is complete, blockers are closed or explicitly accepted, redacted evidence is reviewed, and exact source/target branches are confirmed. Do not merge before staging results are known.

## Audit limitations

The approved Phase 1 specification and original Phase 0 audit were not present as standalone files under the NTE project tree during this inspection; Phase 10 and mobile/backend README handovers were used as context. This report maps source to those recorded handovers and requirements in the conversation. A final acceptance audit should compare against the founder-approved documents if stored elsewhere.

No tests, builds, APK generation, Railway/staging access, deployment, DNS changes, or merges were performed.
