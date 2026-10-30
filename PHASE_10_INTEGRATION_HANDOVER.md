# NTE Naadu — Phase 10 Integration Handover

## Scope

This handover records source-level integration and release preparation for the isolated NTE Naadu mobile app and API. It adds no product feature and makes no claim of runtime verification, test completion, or production readiness. HappiNotes files, configuration, data, credentials, billing, media, app identities, and deployment were not used or changed.

## Integration map

- `mobile/` is the Flutter client. It receives its API origin through `NTE_API_BASE_URL`, rejects HappiNotes host patterns, and requires HTTPS in release mode.
- `backend/` is the NTE-only Express/Mongoose API. It requires `NTE_MONGODB_DATABASE=nte_naadu` and rejects an explicitly named HappiNotes host or database. The actual isolation of a hosted MongoDB cluster still requires operator confirmation.
- The Flutter API client stores NTE access and refresh tokens using secure storage, sends Bearer authorization, rotates refresh tokens on 401, and clears credentials when refresh fails.
- The inspected onboarding client routes and identity request fields align with the API route/controller contracts. Identity registration and recovery remain unavailable because their providers are intentionally disabled.
- API route protection is attached server-side. Family access is scoped to the authenticated parent; staff features use explicit roles. The source does not offer self-service staff-role assignment.
- Payment, media, contact verification, recovery, and adult-verification provider implementations are unavailable/disabled. A persisted announcement/feed is not push, SMS, or email delivery.

## Source-level correction

Added `NTE_PAYMENT_PROVIDER=disabled` to `backend/.env.example`, matching the provider variable required by `backend/src/config/env.ts`. No secrets or live integration values were added.

## Release readiness

| Area | Source-level state | Release status |
|---|---|---|
| Product boundary | NTE source/configuration is under this isolated project; no HappiNotes values are prescribed | Ready for authorized verification |
| Mobile API origin | Explicit `NTE_API_BASE_URL`; release requires HTTPS and non-HappiNotes origin | Requires environment-specific value and authorized verification |
| Database | Explicit NTE database name and URI checks; transaction workflows require transaction-capable MongoDB | Blocked pending dedicated cluster/credential confirmation and operator verification |
| JWT/session secret | Unique random secret required by configuration; template is placeholder only | Blocked pending secret provisioning and secure storage |
| Parent registration/recovery | Contracts exist; providers disabled and requests fail closed | Blocked pending provider selection, implementation, and operational configuration |
| Adult verification | Not configured; privileged club/event actions depend on it | Blocked pending approved verification method and policy |
| Consent | Requires published policy record; no approved policy is seeded/configured | Requires founder and qualified legal/safeguarding review, then controlled publication |
| Media | Provider disabled | Blocked pending NTE-specific storage/delivery adapter and content rights/configuration |
| Payments/refunds | Provider adapter unconfigured; entitlement workflow is fail-closed pending provider events | Blocked pending payment-provider adapter, webhook verification, finance policy, and credentials |
| Roles/admin | Explicit least-privilege role checks; no public self-assignment | Requires approved staff roster and secure provisioning procedure |
| Notifications | Feed/announcement records only; no delivery provider | Requires product decision and provider before delivery claims |
| Localization | English plus Hindi, Malayalam, Tamil resources; other Indian language entries are discoverable but unavailable and fall back to English | Ready for authorized verification; content translation remains separate and incomplete |
| Legal/policy copy | Configurable policy records/interfaces exist; authoritative content is not supplied | Requires qualified review before activation |
| Tests/build/runtime/deployment | Not run per instruction | Deferred; no readiness claim |

## Handover boundary

This is an integration inventory and release preparation record, not authorization to activate external services. Before any verification, testing, build, migration, release, or deployment activity, the founder must authorize that separate work. Resolve the decisions in `NTE_FOUNDER_DECISIONS.md` and configure an isolated NTE environment using `NTE_ENVIRONMENT_REFERENCE.md` first.
