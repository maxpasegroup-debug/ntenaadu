# NTE Naadu — Phase 1 Source Blocker Closure

## Completed in source

- Payment order creation now derives the provider order reference from the persisted order record rather than an undefined local identifier.
- Programme documents now define the purchase fields read by payment and programme DTO code.
- Paid programmes are explicitly deferred for MVP: authoring rejects paid programme creation and upgrades, publication rejects any paid programme, and public browse/detail/enrolment/progress queries are limited to published free programmes. The admin form shows a localized notice and does not offer paid programme selection.
- Corrected visible English localization strings to use the exact brand “NTE Naadu”.

## Founder/adviser decisions still open

These policy/operational questions cannot be approved by source changes alone:

- Consent wording, policy versioning, eligible guardian authority, and withdrawal consequences need founder and qualified legal/safeguarding review. No policy was invented or seeded; consent remains unavailable until an approved published policy is configured.
- Child/Youth age-band thresholds need founder and qualified advice. UI/API continue to store broad categories only; activities requiring precise age eligibility must not be activated until policy is approved.
- Safeguarding ownership, escalation hours, response expectations, urgent-risk procedure, referrals, and staff coverage need named accountable owners and qualified review before real reports are accepted as an operationally supported service.
- Retention/deletion schedules, account deletion, legal holds, and backup expiry need founder and qualified privacy/legal review. No deletion or retention job was added.
- Staff role grant/revocation process needs an approved secure operator procedure and review schedule. No self-service role assignment was added.
- Verification and recovery provider selection, implementation, and configuration remain open. Those provider interfaces remain disabled and registration/recovery continue to fail closed.

## Gate status

**Source-level blocker handling:** implementation changes above are present; the paid-programme feature is explicitly disabled.  
**Activation/release gate:** **BLOCKED** pending the approvals/configuration above and authorized staging verification. This handover is not a build, test, runtime, or release confirmation.

No tests, builds, package installation, migration, staging/Railway access, or deployment were performed.
