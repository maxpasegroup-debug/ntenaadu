# NTE Naadu Phase 4 — Staging verification status

## Gate status: BLOCKED — staging not available

No API checks were run. The project has no NTE staging API origin or test credentials configured in this session; the backend directory contains only `.env.example`, and the environment exposes no Railway or NTE connection variables. The Phase 2 handover records that no Railway service or MongoDB deployment was provisioned and operator isolation evidence was not supplied. No local mock or production endpoint was substituted for staging.

Phase 4 authorizes staging verification, but does not establish that the environment exists or that its data, credentials, and providers are isolated. Do not run this matrix until the operator records the evidence listed in `NTE_STAGING_SETUP.md` and supplies a staging-only test access path.

## Verification matrix

All rows are **NOT RUN**. This records missing execution evidence, not a passing or failing product result.

| Area | Checks to execute in staging | Current status / prerequisite |
|---|---|---|
| Environment isolation | Confirm NTE-only project/service, transaction-capable database, separate credentials/storage, CORS, synthetic-only data, and no HappiNotes or production routes/resources | NOT RUN — operator evidence and staging origin unavailable |
| Registration and verification | Valid/invalid registration, provider delivery, replay/expiry/rate limits, duplicate account, and verification state transitions | NOT RUN — verification provider is disabled; approved sandbox/adapter required |
| Sign-in and sessions | Valid/invalid credentials, token expiry, renewal, replay, concurrent sessions, logout, account lock/rate limits | NOT RUN — staging test account unavailable |
| Recovery | Valid/unknown account, token delivery, expiry, replay, rate limits, password change and session revocation | NOT RUN — recovery provider is disabled; approved sandbox/adapter required |
| Family and profiles | Guardian-owned family CRUD, age-band/language validation, profile privacy, cross-family access attempts, unauthorized mutation | NOT RUN — staging test families unavailable |
| Consent | Published policy retrieval/version, explicit grant evidence, duplicate submission, revocation, post-revocation access and audit history | NOT RUN — no staging service/policy; approved policy and synthetic family required |
| Roles and safeguarding | Parent/student/staff/admin role denial, report submission, least-privilege viewing, escalation and audit access boundaries | NOT RUN — staging staff accounts and approved escalation policy unavailable |
| Clubs and events | Club create/approval/membership/leadership, moderation restrictions, event registration/capacity/cancellation, attendance, cross-family access | NOT RUN — staging service and role test accounts unavailable |
| Learning and programmes | Published/unpublished visibility, language availability/fallback, media authorization, free entitlement, paid access denial | NOT RUN — staging catalogue/media unavailable; media provider remains disabled |
| Payments/refunds | Sandbox-only order creation, webhook signature/replay/idempotency/out-of-order handling, entitlement grant/reversal, refund, ownership isolation | NOT RUN — payment provider is disabled and paid programmes are disabled for MVP |
| Failure and revocation paths | Database/provider failures, malformed inputs, expired sessions, revoked session use, network timeouts, safe errors and audit entries | NOT RUN — staging service unavailable |

## Required next evidence

1. Operator-provided staging identity, service origin, root directory and healthcheck evidence.
2. Redacted confirmation that MongoDB supports transactions and is an NTE-only staging deployment with a separate database user; confirm storage and egress isolation from HappiNotes/production.
3. Secret variable names/presence only, exact allowed CORS origins, and confirmation that all test data is synthetic. Do not provide secret values.
4. Approved synthetic test accounts for each required role and documented reset/cleanup procedure.
5. Provider sandbox and approved policy evidence before enabling verification, recovery, consent, adult-verification, media, or payment cases.

After those prerequisites are supplied, execute the agreed matrix against staging only, retain redacted request/response evidence and correlation IDs, record failures without personal data, and rerun failed checks after fixes. The gate remains blocked until required checks pass and the evidence is reviewed.
