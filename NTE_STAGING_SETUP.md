# NTE Naadu — Staging Setup

## Status

This is a source-side setup handoff. No Railway project/service or MongoDB deployment was created or configured in this turn: no Railway connector was available and no authenticated Railway workspace was open. Do not treat the settings below as proof of an isolated environment. Operators must confirm the project, services, credentials, storage, and database before the staging gate can pass.

## Required isolated topology

- Create a new Railway project/environment named for NTE Naadu staging; do not attach it to a HappiNotes project/environment.
- Create one API service with root directory `nte_naadu/backend`. Configure build `npm run build`, start `npm start`, and healthcheck `/health` in the NTE service settings, or manage that existing service through Railway's current Infrastructure as Code workflow after it is linked to the NTE project. Do not use `railway.json`: Railway has deprecated Config as Code and new services cannot opt into it.
- Use a separate MongoDB deployment and separate credentials for NTE staging. It must support replica-set/sharded transactions and use database name `nte_naadu`. Do not share a HappiNotes cluster, database user, backup, or URI.
- Use NTE-owned staging storage and provider sandbox accounts only when an NTE adapter has been implemented and approved. Current verification, recovery, adult-verification, media, and payment providers are unavailable; keep their flags `disabled` and do not place provider credentials in Railway yet.
- Add a separate production project/environment later; never promote staging credentials or data into production.

## API service configuration

Set these values in the Railway service's private variable settings. Generate independent staging secrets directly into the approved secret manager; do not put values in this repository, a `.env` file, screenshots, or chat.

| Variable | Staging setting |
|---|---|
| `NODE_ENV` | `production` so HTTPS/CORS production validation is active in staging. |
| `NTE_PORT` | Leave unset; the service reads Railway's injected `PORT` and validates it. |
| `NTE_MONGODB_URI` | Secret NTE staging URI, with URI database path `nte_naadu` and a dedicated staging database user/deployment. |
| `NTE_MONGODB_DATABASE` | `nte_naadu` |
| `NTE_JWT_SECRET` | Secret unique random value for this staging environment, at least 32 characters and at least 12 distinct characters. Never reuse production or HappiNotes values. |
| `NTE_CORS_ORIGINS` | Leave empty for mobile-only staging; this denies browser cross-origin requests while allowing native requests without an `Origin` header. When a staging web client exists, set only its exact canonical HTTPS origin. Never use a HappiNotes origin. |
| `NTE_VERIFICATION_PROVIDER` | `disabled` until approved NTE adapter and sandbox are available. |
| `NTE_RECOVERY_PROVIDER` | `disabled` until approved NTE adapter and sandbox are available. |
| `NTE_MEDIA_PROVIDER` | `disabled` until approved NTE storage/delivery adapter is available. |
| `NTE_ADULT_VERIFICATION_PROVIDER` | `disabled` until the approved policy and adapter are available. |
| `NTE_PAYMENT_PROVIDER` | `disabled` until the payment adapter, sandbox account, and policy are implemented and reviewed. |

The API origin must be the staging Railway service's HTTPS origin and must be provided to Flutter through `NTE_API_BASE_URL` for staging builds. Do not use the production domain or a HappiNotes host. The CORS allowlist contains browser client origins, not the API's own origin.

## Gate evidence required from the operator

Before staging tests, record the following without exposing secret values:

1. Railway project/environment and API service name, root directory, generated HTTPS domain, and configured healthcheck path.
2. MongoDB provider/deployment name, region, transaction capability evidence, NTE-only database/user confirmation, and confirmation that it is not shared with HappiNotes or production.
3. Secret variable names and presence only, plus confirmation that each secret is unique to NTE staging. Never paste values into the audit record.
4. Exact allowed CORS origins (or an empty list for mobile-only staging) and confirmation that staging cannot reach production/HappiNotes service URLs, databases, or storage.
5. Confirmation that only synthetic accounts/data will be used and all payment/verification flows remain sandbox-only or disabled.

## Current blockers

- Railway project access/service owner authorization is not connected to this session.
- No MongoDB deployment/provider/region has been selected or provisioned for NTE staging.
- Provider adapters for verification, recovery, adult verification, media, and payments are not implemented; sandbox credentials cannot safely activate them.
- No web staging origin exists yet. The API CORS value must be finalized after the staging domain is known.
- Source configuration was not built or runtime-verified. The existing Phase 2 no-build/no-test restrictions still apply until separately updated.
