# NTE Naadu — Final Implementation Roadmap

Sequence is dependency-ordered. “Existing code affected” points to source inventory; implementation and staging checks require separate authorization. Do not promote to production until staging acceptance evidence is reviewed.

## P0 — Critical corrections and safety

| Objective | Existing code | Required work / dependencies | Acceptance criteria | Founder/provider/adviser? |
|---|---|---|---|---|
| Restore Flutter compile path | `mobile/lib/onboarding/onboarding_screens.dart:174–217` | Replace invalid `widget.*` references in the two `StatelessWidget` screens; inspect adjacent onboarding flow for similar errors. | Flutter analyzer/build has no compile errors; navigation from welcome into both paths opens correctly. | No founder decision; authorized static/build check. |
| Freeze launch identity/access scope | onboarding, `dashboard_screens.dart`, `onboarding_models.dart`, backend auth/family models | Decide Student login vs guardian-mediated view; Mother/Father representation; age bands; profile/card rules; multiple-parent authority. | Written permission matrix covers all three member types, both-parent link/revoke/dispute, account suspension and child access; API tests enforce it. | Founder decision + qualified child privacy/legal advice. |
| Approve child/consent/safeguarding policies | `family-controller.ts`, consent models/provider, safeguarding controller | Approve versioned localized consent, revocation effects, safeguarding urgency/escalation, response coverage, retention and account-deletion policy; publish policy safely. | No child profile activation without valid approved policy; consent evidence/revoke audit correct; named lead/backup and response playbook exist. | Founder + qualified legal/privacy/safeguarding advisers. |
| Provision identity and staff operations | `auth-controller.ts`, `services/providers.ts`, middleware and roles | Implement approved contact verification and recovery providers; secure staff provisioning/revocation and access review; configure unique NTE staging values. | Verification/recovery delivery and abuse tests pass; role assignment never public; revoked role/session denied. | Provider selection/credentials, founder staff roster and security review. |
| Staging isolation and static verification | `backend/src/config/env.ts`, `mobile/lib/network/api_config.dart`, staging docs | Confirm NTE-only Mongo user/cluster, transaction capability, secrets, CORS, API origin, backup/restore and synthetic test data. Execute authorized staging checks, not production. | Redacted evidence verifies isolation; transaction-backed consent works; cross-family and role-denial tests pass. | Operator evidence; staging access/test accounts. |
| Establish policy/content readiness | admin content controllers, consent provider, mobile locales | Add controlled policy publishing and review ownership; ensure high-impact translations receive human review; correct any brand misspelling found in active strings. | Approved policy/content appears in selected language or clearly states unavailable; no false “translated” claim. | Founder content owner and qualified translators/reviewers. |

## P1 — Core founder-vision membership product

| Objective | Existing code | Required work / dependencies | Acceptance criteria | Founder/provider/adviser? |
|---|---|---|---|---|
| Member lifecycle and identity | parent/student schemas, onboarding and dashboard | Add membership application/review, unique NTE member number, active/suspended/expired state and safe digital card. Define optional photo handling; card is not identity proof. | Approved member can view/revoke a private card; public share excludes child/family/contact/credential data; status changes are audited. | Membership criteria and verification policy. |
| Mother/Father experiences | onboarding/dashboard, membership/community models | Add distinct communities, home panels, roles and eligible activities; retain shared-family support. | Each approved path sees correct community content/actions; access is enforced server-side. | Founder category/eligibility and inclusivity decisions. |
| Family linking | `Family`/`GuardianRelationship` and family APIs | Add invitation/acceptance/revocation and dual-guardian permissions, disputes and audit. | Unaccepted invitation grants no access; accepted parent sees only explicitly authorized child data; revocation removes access. | Qualified advice and founder authority rules. |
| Local community operating model | club routes/screens/models | Introduce approved local groups, leader succession, moderated introductions, agenda/training cadence, group activity and discovery. Keep club feature where useful. | New member has a useful local next action; leaders/moderators can approve, announce, report and suspend under policy. | Operating model, local pilot boundaries and moderator capacity. |
| Useful dashboard and notification feed | dashboard placeholders; announcement/event routes | Replace unavailable placeholders with authorized next actions and actual data; add an in-app feed only after event sources are defined. | Empty/error/loading states are honest; no cross-family data leak; notification preference controls work. | MVP dashboard priorities; provider decision if push is required. |
| Browser admin baseline | mobile `admin_console.dart`; backend admin routes | Build isolated web admin against same API; secure browser auth/session, CSRF, role nav and server checks; include membership and governance queues. | Role-denial tests pass across browser/API; safeguarding data separated; audit reads/actions include reasons. | Web scope, domain/hosting and staff roster. |

## P2 — Community and growth

| Objective | Existing code | Required work / dependencies | Acceptance criteria | Founder/provider/adviser? |
|---|---|---|---|---|
| Ethical invitations/referrals | No current referral implementation | One-time expiring adult/member invite, generic campaign share, attribution and rate limits. No address-book sync by default. | Invited user chooses independently; referrer sees no private data; abuse/opt-out works. | Reward policy, if any, requires finance/legal review. |
| Structured community activities | no community task/campaign entities | Add opt-in practice, member contribution, group campaigns and private recognition; no popularity ranks for minors. | Each activity has age/role eligibility, completion evidence, moderator/report route and privacy defaults. | Activity policy and staffing. |
| Events/training cadence | event routes and screens | Add recurring training/webinar scheduling, waitlist rules, event-specific minor approval, leader roster, attendance correction/audit. | Capacity concurrency, cancellation, consent revocation and attendee scope pass staging cases. | Delivery format, attendance/cancellation policy. |
| Analytics and operations | admin overview counters and audit list | Add privacy-preserving acquisition/activation/retention metrics; support and incident processes. | No safeguarding content or child identifiers in analytics; retention and access controls documented. | Metrics owner and data-retention review. |

## P3 — Premium Dream Addiction

| Objective | Existing code | Required work / dependencies | Acceptance criteria | Founder/provider/adviser? |
|---|---|---|---|---|
| ALTT practical programme | programme activities/progress; audio player | Add practice, participation, real-world action, reflection and feedback with child-safe evidence; identify live sessions/trainers only when available. | Learners can progress through Learn → Practise → Participate → Act → Reflect; progress is truthful and privacy-scoped. | Founder curriculum/ALTT, trainer policy and qualified safeguarding review. |
| Reviewed content/media | learning content and disabled media adapter | Implement NTE-owned media storage/signing and video playback; confirm rights, moderation and actual language availability. | Only entitled, authorized users receive expiring grants; content-language claims match assets. | Media provider, asset rights and operations. |
| Recurring billing and entitlements | order/entitlement/refund schemas; disabled payment adapter | Implement provider subscription creation, renewals, failures, grace/cancel states, webhook idempotency, refunds/chargebacks, reconciliation and GST display. Use founder amounts ₹5,999 + GST and ₹2,199 + GST only after approved terms. | Sandbox tests prove lifecycle and entitlement transitions; no client-only entitlement; refund/cancel rules visible before purchase. | Provider, finance/tax/legal advice, approved offer/eligibility. |

## P4 — Advanced AI, analytics and expansion

| Objective | Existing code | Required work / dependencies | Acceptance criteria | Founder/provider/adviser? |
|---|---|---|---|---|
| SIA guidance | None found | Start with approved scripts; later bounded AI for guidance/learning with data-minimization, human-reviewed translations, age safeguards and escalation. | SIA never decides consent, identity, membership, payment or safeguarding; user can dismiss/report; child safety review passes. | Persona, provider, AI/privacy/security/legal review. |
| Mentoring and trainer operations | No trainer/mentor model | Add consented assignment, availability, case boundaries, session records and escalation; no open child messaging. | Role, age, guardian consent, contact logging and safeguarding limits are tested. | Approved mentor/trainer roster and policy. |
| National scale and language expansion | 4 locale files; other catalogue entries unavailable | Complete reviewed Indian language packs and content; instrument translation coverage and local operations readiness. | Locale coverage, RTL, accessibility and content availability are verified before claims; regional support exists. | Translation budget/reviewers and rollout regions. |

## Release rule

Keep paid access, provider-dependent identity and any feature requiring unstaffed safeguarding disabled. The latest known staging build/startup is not the Phase 4 test gate. Merge/deploy production only after P0 and relevant P1 checks pass in isolated staging with redacted evidence and explicit release approval.
