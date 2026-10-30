# NTE Naadu Environment Reference

Use this reference with `backend/.env.example`. All values must belong to NTE Naadu. Never copy HappiNotes credentials, database URIs, payment products, media storage, notification credentials, or app identities. The example file contains placeholders, not deployable secrets.

## Backend variables

| Variable | Required | Purpose / constraints |
|---|---|---|
| `NODE_ENV` | Yes operationally | Use `production` for production configuration; production checks are stricter. |
| `NTE_PORT` | No | Optional explicit HTTP listener port. Defaults to Railway's `PORT` when provided, then `3100` for local use. Must be a valid TCP port. |
| `NTE_MONGODB_URI` | Yes | NTE-only MongoDB URI. Use a dedicated NTE deployment/credentials. Source checks reject HappiNotes host/path fragments, but cannot establish whether an opaque hosted cluster is shared. |
| `NTE_MONGODB_DATABASE` | Yes | Must be exactly `nte_naadu`. |
| `NTE_JWT_SECRET` | Yes | Unique random NTE secret, at least 32 characters and 12 distinct characters. Store in a secrets manager; do not commit or reuse another product's value. |
| `NTE_CORS_ORIGINS` | No (browser access only) | Comma-separated canonical browser origins with no paths/query/fragments. Production origins must use HTTPS. An empty value denies browser cross-origin access; native clients without an `Origin` header continue to work. Add an exact NTE web origin when a web client is provisioned. |
| `NTE_VERIFICATION_PROVIDER` | No | Must remain `disabled` until a reviewed adapter is implemented; any other configured value is rejected by the current source. |
| `NTE_RECOVERY_PROVIDER` | No | Must remain `disabled` until a reviewed adapter is implemented; any other configured value is rejected. |
| `NTE_MEDIA_PROVIDER` | No | Must remain `disabled` until an NTE media adapter is implemented; any other configured value is rejected. |
| `NTE_ADULT_VERIFICATION_PROVIDER` | No | Must remain `disabled` until an approved provider and adapter are available; any other configured value is rejected. |
| `NTE_PAYMENT_PROVIDER` | No | Must remain `disabled`; the current payment adapter is unconfigured and `env.ts` rejects other values until implementation is reviewed. |

## Flutter configuration

| Setting | Purpose / constraints |
|---|---|
| `NTE_API_BASE_URL` | Compile-time `--dart-define` value for the NTE API origin. Supply an origin only, without credentials, path, query, or fragment. Release mode requires HTTPS; HappiNotes host patterns are rejected. Non-release remote hosts must be clearly marked dev/development/test/testing/staging/sandbox. |

## Data and deployment notes

- The backend forces `dbName: nte_naadu`; transaction-based identity, event, and payment state transitions require a MongoDB replica set or sharded cluster that supports transactions.
- Provision a separate deployment, database credentials, secrets, media bucket, payment account, notification credentials, and mobile application identity for NTE as their adapters are approved. No such live values are included here.
- Keep real `.env` files, signing keys, provider credentials, and production configuration outside source control. No backend `.gitignore` was found at this project boundary during source inspection; deployment/repository owners should confirm the applicable ignore and secret-scanning controls before creating local secret files.
- `NTE_CORS_ORIGINS` is for browser origins; mobile API access still requires a secure API origin and the correct server configuration.
