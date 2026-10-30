# NTE Naadu — Founder Decisions Before Release

These decisions affect activation or operational readiness. They were not inferred from mockups or implementation defaults. Policy, consent, safeguarding, and legal matters should be reviewed by qualified advisers.

## Product and policy decisions

1. **Guardian and child policy:** Confirm age bands and the permitted guardian relationship/authority model, including handling of multiple guardians, disputes, and profile deletion/archival.
2. **Consent:** Approve the exact guardian consent policy, versioning, language coverage, evidence to retain, revocation effects, and whether additional event/programme-specific consent is needed.
3. **Safeguarding operations:** Name the safeguarding lead and backup, escalation hours and response expectations, urgent-risk procedure, external referral process, access reviews, and record-retention schedule.
4. **Privacy and retention:** Approve retention/deletion schedules for accounts, student profiles, consent and revocation history, attendance, payments/refunds, audit events, and safeguarding cases; obtain qualified privacy/legal advice for applicable Indian requirements.
5. **Club and event rules:** Confirm adult verification requirements, club/event approval criteria, member access, event capacity/waitlist rules, cancellation/refund interactions, attendance correction rules, and acceptable announcement content.
6. **Dream Addiction and programme content:** Confirm final programme name/claims, age appropriateness, editorial ownership, language review, and publication authority. Define whether the name needs modification after review for clarity/sensitivity.
7. **Language launch scope:** Confirm English-first launch and the initial reviewed UI languages. Hindi, Malayalam, and Tamil have resource coverage; remaining Indian languages are discoverable but untranslated. Approve the translation review process for consent, safeguarding, payment, and legal text.
8. **Notifications:** Decide whether feed-only updates are sufficient for MVP or whether push/SMS/email delivery is required, and approve a provider and child-safe message policy if so.

## Provider and operational decisions

9. **Identity verification and recovery:** Select NTE-specific contact verification and recovery providers and approve abuse controls, delivery channel, and operational ownership.
10. **Adult verification:** Select an approved method/provider and data-minimization policy before enabling club approvals, event management, or adult-only staff actions.
11. **Media:** Select NTE-owned storage and delivery/signing approach, asset rights process, and access/logging requirements.
12. **Payments:** Select payment provider and approve pricing/tax display, refund policy, disputes/chargebacks, reconciliation, webhook operations, and entitlement revocation rules.
13. **Hosting and data location:** Select NTE-only hosting, MongoDB deployment/region, backup/restore and monitoring owners; confirm the cluster and credentials are not shared with HappiNotes.
14. **Staff provisioning:** Approve who may assign/revoke each least-privilege role, the secure provisioning procedure, periodic review, and emergency access controls.
15. **Launch support:** Assign product owner, technical operator, finance support, and safeguarding coverage; approve incident response and user support channels.

## Authorization boundary

After decisions are made, a separate explicit authorization is still needed for verification/testing, builds, migrations, provider activation, release packaging, or deployment. Phase 10 did not perform or authorize those actions.
