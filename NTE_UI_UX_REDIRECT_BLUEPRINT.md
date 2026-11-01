# NTE Naadu — UI/UX Redirect Blueprint

This is a source-based redesign direction. No screens were rendered or changed. Retain useful existing flows; redesign the information architecture around **membership and community participation**, not a conventional learning-only home.

## Keep and refine

| Existing screen/flow | Decision | Why / exact refinement |
|---|---|---|
| Welcome and language picker (`onboarding_screens.dart:24+`) | Retain structure; redesign first impression | Keep brief, accessible onboarding and searchable language selection. Add a strong movement value proposition and clear **Student / Mother / Father** paths. Do not add an SIA chat bubble until its role and content are defined. |
| Parent registration/sign-in/recovery forms | Retain form patterns after P0 correction | Keep explicit loading/error states and no-loss form behavior. Add verification steps only after provider activation. Fix undefined `widget.*` usage in `StudentEntryScreen` and `ParentEntryScreen`. |
| Family profile and consent screens | Retain guardian-owned profile management | Keep broad age bands and explicit status. Add second guardian only after authority policy. Make pending policy/provider states plain and actionable; never style an unrecorded state as granted. |
| Four-tab shell (`dashboard_screens.dart`) | Retain Home / Learn / Clubs / Grow concepts; reconsider labels after community scope | Keep simple bottom navigation, but make Clubs the real community destination and Grow the practical development loop. Hide disabled actions or present truthful unavailable reasons. |
| Learning catalogue and audio player | Retain catalogue filters/player for supported media | Keep content-language visibility and age filtering. State plainly when video/media is unavailable. Add action/practice after learning; do not make content completion the only success measure. |
| Club/event workflows | Retain approval, guardian and moderator decisions | Surface pending states, role, approval next step, event time/location privacy and cancellation. Add local community/home context around existing club lists rather than adding public child profiles. |
| Staff console | Retain useful role-gated sections as interim operations UI | Keep role-specific menu and no-access states. Treat it as an interim mobile admin console; a real browser admin is a separate product surface. Improve dense single-column case review and use clear task queues. |

## Redesign the member information architecture

### Public/unauthenticated

1. **Welcome:** “Nation Towards”; one-sentence purpose; language selection; “Join as Student / Mother / Father”; “Already a member? Sign in.”
2. **Member path:** common contact/account step, then the selected member experience. Explain guardian involvement before collecting child details.
3. **Family linkage:** invite/link another parent only under approved authority policy. Show relationship and consent status separately from identity verification.
4. **Membership application/status:** clear pending/approved/suspended/expired states. Do not promise a member ID until approval.

### Member bottom navigation (mobile)

- **Home:** next useful action, upcoming community/training, member status, family selector where authorized.
- **Community:** Mother/Father/Student community, local group discovery, safe introductions, approved activities, group leadership.
- **Learn:** content catalogue and supported audio/video; available content languages; resume and practice.
- **Grow:** Dream Addiction and other programmes, tasks, activity progress, webinars/live sessions when genuinely staffed.

Use a compact profile menu for membership card, family, language, payments, privacy/safety and support. Notifications appear only when a working feed/provider exists; do not route the bell to a generic unavailable dialog indefinitely.

### Three home experiences

| Student | Mother | Father |
|---|---|---|
| Guardian-approved profile; age-appropriate member status; continue learning; safe community activity; today/this week’s practice; private progress. | Mother community welcome; local group and training; next community contribution; learning/webinar; family and child controls where permitted. | Father community welcome; networking/training; next contribution; community event; practical leadership activity; family controls. |

These are proposed structures, not existing behavior. Do not create open student/adult chat. Use moderated group activity, adult-mediated contact and report controls.

## Membership card and profile

Create a polished digital card with NTE identity, member display name, member number, category, status and community affiliation. Shareable view must contain only fields the member chose and policy allows. For minors, default to no public share/photo, no family or location data, no scannable bearer credential and no live credential token. State on the card: **membership identity only; not identity verification**. Keep photo optional and private by default; store and serve from NTE-controlled media with access logging.

## SIA interaction pattern (future)

Start with short, dismissible, context-specific help: “Need help choosing a community?”; “Your next step is…”. Provide a persistent “Help” entry rather than an unsolicited chat overlay. First version should be scripted and human-reviewed. Label AI-generated content, offer a report/escalate action, collect the minimum data, and never let AI approve members, consent, safeguarding cases, payments or identity.

## Dream Addiction and ALTT screen sequence

1. Programme overview: outcomes, audience, actual languages, price/terms if enabled, facilitator and schedule only when confirmed.
2. “Learn”: audio/video/live content with resume state.
3. “Practise”: one concrete exercise with age-appropriate instructions and privacy warning.
4. “Participate”: group session or webinar with guardian approval for minors.
5. “Take action”: bounded real-world task; no precise location/public disclosure.
6. “Reflect”: optional private response/progress evidence and guardian/mentor feedback under policy.
7. “Continue”: next activity and visible, non-competitive progress.

Current programme detail should be retained as the content base but restructured around this loop; do not relabel generic completion as ALTT.

## Visual and accessibility direction

- Keep palette tokens already present: forest `#263A30`, green `#4C8B69`, saffron `#F3A66B`, ivory `#F6F3EC`, white.
- Use strong section hierarchy, readable line length, restrained cards and meaningful imagery from rights-cleared NTE assets. Avoid icon-only promotion of a national movement.
- Keep one primary action per step. Use minimum comfortable touch areas, visible focus, clear field labels, inline validation and explicit status text/icons (not color alone).
- Support large text, dynamic wrapping, RTL (especially Urdu), Indian-script glyph fallback, semantic labels, keyboard/switch access and reduced motion.
- Keep forms resumable through locale changes; avoid loading large images/video on initial home. Show image placeholders and content file sizes where useful.
- Verify at narrow Android widths, large text, Hindi/Malayalam/Tamil and RTL after source fixes. Source review cannot certify visual quality.

## Admin UX direction

For initial operations, create a desktop-first responsive web admin with role-specific queues: member applications, community approvals, scheduled events, content review, finance/refunds, safeguarding and audit. Keep sensitive safeguarding cases on a separate least-privilege surface, require access reason, avoid bulk export, and log reads/actions. Do not use the existing mobile admin console as the only staff operating environment for national scale.
