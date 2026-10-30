# NTE Naadu Release Readiness

This document reflects source inspection only. No tests, builds, runtime checks, migrations, or deployment actions were performed. “Ready for authorized verification” means only that the source/configuration boundary can be reviewed under an explicitly authorized verification phase; it is not a pass result.

## Status summary

| Readiness area | Status | Evidence / remaining work |
|---|---|---|
| NTE/HappiNotes separation | Ready for authorized verification | NTE has its own `mobile/` and `backend/` projects and NTE-specific configuration names. Confirm deployment, credentials, storage, and data are also isolated operationally. |
| API origin configuration | Requires configuration | Supply an NTE-specific origin through `NTE_API_BASE_URL`; release origin must use HTTPS. Do not use the HappiNotes endpoint. |
| Database and transactions | Blocked | Configure a dedicated NTE database/cluster named `nte_naadu`; confirm deployment supports MongoDB transactions and cluster/credentials are not shared with HappiNotes. Code cannot prove hosted-cluster isolation. |
| Secrets | Blocked | Provision a unique random `NTE_JWT_SECRET` (32+ characters) in the chosen secrets manager. `.env.example` contains a placeholder and must never be deployed as a real secret. |
| CORS | Requires configuration | Set canonical production HTTPS `NTE_CORS_ORIGINS` values for the actual NTE web origins, if applicable. |
| Verification and recovery | Blocked | Select and approve providers, implement reviewed adapters, configure credentials, and verify delivery/abuse controls. Current routes fail closed. |
| Consent policy | Requires policy approval | Obtain qualified legal/safeguarding review for policy text, versions, languages, and withdrawal handling; publish the approved policy through a controlled process. |
| Adult verification and staff roles | Blocked | Approve verification method and staffing model. Provision staff roles through a secured operator process; no self-service assignment exists. |
| Learning media | Blocked | Configure an NTE-specific storage/signing adapter and approved media assets/rights. Media access currently fails closed. |
| Payments and paid programmes | Blocked; paid programmes disabled for MVP | Provider remains unconfigured. Programme purchase fields now have a schema representation, but authoring and publication reject paid programmes and public catalogue/enrolment expose free programmes only. Payment checkout code has a source correction but has not been compiled or verified. |
| Notifications | Requires product/provider decision | Existing notices are persisted feeds. No push, SMS, or email integration is configured. |
| Translation coverage | Partial | English is default; Hindi, Malayalam, and Tamil are selectable. Other catalogue languages are not translated UI and use English fallback. Learning content language availability must be authored per item. |
| Operational support and incident response | Requires founder decision | Define service ownership, safeguarding escalation coverage, incident process, support/refund responsibilities, backup/restore, monitoring, and retention schedules. |
| Verification, build, release, deployment | Deferred | Explicitly not performed in this phase. |

## Release gate

Do not characterize the product as production-ready while any blocked item remains. Only proceed to a separately authorized verification/release phase after the founder decisions and policy/provider blockers have been resolved and the target NTE environment has been provisioned. This document does not authorize those actions.
