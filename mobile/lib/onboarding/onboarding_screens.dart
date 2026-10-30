import 'package:flutter/material.dart';

import '../localization/language_picker.dart';
import '../localization/languages.dart';
import '../localization/locale_controller.dart';
import '../dashboard/dashboard_screens.dart';
import '../admin/admin_console.dart';
import 'onboarding_models.dart';
import 'onboarding_api_repository.dart';
import 'onboarding_repository.dart';
import 'onboarding_session.dart';

const _forest = Color(0xFF263A30);
const _green = Color(0xFF4C8B69);
const _saffron = Color(0xFFF3A66B);
const _ivory = Color(0xFFF6F3EC);

typedef _Text = String Function(String key);

void _open(BuildContext context, Widget page) {
  Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => page));
}

class WelcomeScreen extends StatelessWidget {
  const WelcomeScreen({required this.locale, required this.session, super.key});

  final LocaleController locale;
  final OnboardingSession session;

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: locale,
    builder: (context, _) {
      final t = locale.text;
      return Scaffold(
        body: SafeArea(
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 520),
              child: ListView(
                padding: const EdgeInsets.all(24),
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      TextButton.icon(
                        onPressed: () => _open(context, ProfileSettingsScreen(locale: locale, session: session)),
                        icon: const Icon(Icons.person_outline),
                        label: Text(t('action.profileSettings')),
                      ),
                      LanguagePickerButton(controller: locale, onLanguageChanged: session.syncLanguagePreference),
                    ],
                  ),
                  const SizedBox(height: 40),
                  const Icon(Icons.eco_outlined, size: 64, color: _green),
                  const SizedBox(height: 8),
                  Text(t('brand.name'), textAlign: TextAlign.center,
                    style: const TextStyle(fontSize: 32, fontWeight: FontWeight.w700, color: _forest)),
                  Text(t('brand.slogan'), textAlign: TextAlign.center,
                    style: const TextStyle(fontSize: 16, color: _forest)),
                  const SizedBox(height: 36),
                  Text(t('welcome.eyebrow'), textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.titleMedium),
                  Text(t('welcome.message'), textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.bodyLarge?.copyWith(height: 1.5)),
                  const SizedBox(height: 28),
                  _PathCard(
                    icon: Icons.family_restroom,
                    title: t('welcome.parentPath'),
                    subtitle: t('welcome.parentPathHint'),
                    onTap: () => _open(context, ParentEntryScreen(locale: locale, session: session)),
                  ),
                  const SizedBox(height: 12),
                  _PathCard(
                    icon: Icons.school_outlined,
                    title: t('welcome.studentPath'),
                    subtitle: t('welcome.studentPathHint'),
                    onTap: () => _open(context, StudentEntryScreen(locale: locale, session: session)),
                  ),
                ],
              ),
            ),
          ),
        ),
      );
    },
  );
}

class _PathCard extends StatelessWidget {
  const _PathCard({required this.icon, required this.title, required this.subtitle, required this.onTap});

  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Card(
    color: Colors.white,
    child: InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Row(children: [
          Icon(icon, color: _green, size: 34),
          const SizedBox(width: 16),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(title, style: const TextStyle(fontWeight: FontWeight.w700, color: _forest)),
            const SizedBox(height: 4),
            Text(subtitle, softWrap: true),
          ])),
          const Icon(Icons.chevron_right, color: _forest),
        ]),
      ),
    ),
  ));
}

class OnboardingScaffold extends StatelessWidget {
  const OnboardingScaffold({
    required this.locale,
    required this.session,
    required this.titleKey,
    required this.bodyBuilder,
    this.showBack = true,
    super.key,
  });

  final LocaleController locale;
  final OnboardingSession session;
  final String titleKey;
  final WidgetBuilder bodyBuilder;
  final bool showBack;

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: locale,
    builder: (context, _) => Scaffold(
      appBar: AppBar(
        backgroundColor: _ivory,
        foregroundColor: _forest,
        automaticallyImplyLeading: showBack,
        title: Text(locale.text(titleKey), maxLines: 2, overflow: TextOverflow.ellipsis),
        actions: [
          IconButton(
            tooltip: locale.text('action.profileSettings'),
            onPressed: () => _open(context, ProfileSettingsScreen(locale: locale, session: session)),
            icon: const Icon(Icons.person_outline),
          ),
          Padding(
            padding: const EdgeInsetsDirectional.only(end: 8),
            child: Center(child: LanguagePickerButton(
              controller: locale,
              compact: true,
              onLanguageChanged: session.syncLanguagePreference,
            )),
          ),
        ],
      ),
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 560),
            child: Builder(builder: bodyBuilder),
          ),
        ),
      ),
    ),
  );
}

class StudentEntryScreen extends StatelessWidget {
  const StudentEntryScreen({required this.locale, required this.session, super.key});

  final LocaleController locale;
  final OnboardingSession session;

  @override
  Widget build(BuildContext context) => OnboardingScaffold(
    locale: widget.locale,
    session: widget.session,
    titleKey: 'welcome.studentPath',
    bodyBuilder: (context) {
      final t = locale.text;
      return Padding(
        padding: const EdgeInsets.all(24),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          const Icon(Icons.family_restroom, size: 56, color: _green),
          const SizedBox(height: 20),
          Text(t('studentPath.title'), textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 12),
          Text(t('studentPath.body'), textAlign: TextAlign.center),
          const SizedBox(height: 28),
          FilledButton.icon(
            onPressed: () => _open(context, ParentEntryScreen(locale: locale, session: session)),
            icon: const Icon(Icons.arrow_forward),
            label: Text(t('studentPath.parentAction')),
          ),
        ]),
      );
    },
  );
}

class ParentEntryScreen extends StatelessWidget {
  const ParentEntryScreen({required this.locale, required this.session, super.key});

  final LocaleController locale;
  final OnboardingSession session;

  @override
  Widget build(BuildContext context) => OnboardingScaffold(
    locale: widget.locale,
    session: widget.session,
    titleKey: 'parentEntry.title',
    bodyBuilder: (context) {
      final t = locale.text;
      return Padding(
        padding: const EdgeInsets.all(24),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text(t('parentEntry.body'), style: Theme.of(context).textTheme.bodyLarge),
          const SizedBox(height: 24),
          FilledButton.icon(
            onPressed: () => _open(context, ParentRegistrationScreen(locale: locale, session: session)),
            icon: const Icon(Icons.person_add_alt_1),
            label: Text(t('action.register')),
          ),
          const SizedBox(height: 12),
          OutlinedButton.icon(
            onPressed: () => _open(context, ParentSignInScreen(locale: locale, session: session)),
            icon: const Icon(Icons.login),
            label: Text(t('action.signIn')),
          ),
        ]),
      );
    },
  );
}

class ParentRegistrationScreen extends StatefulWidget {
  const ParentRegistrationScreen({required this.locale, required this.session, super.key});

  final LocaleController locale;
  final OnboardingSession session;

  @override
  State<ParentRegistrationScreen> createState() => _ParentRegistrationScreenState();
}

class _ParentRegistrationScreenState extends State<ParentRegistrationScreen> {
  final _form = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _contact = TextEditingController();

  @override
  void dispose() {
    _name.dispose();
    _contact.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => OnboardingScaffold(
    locale: widget.locale,
    session: widget.session,
    titleKey: 'registration.title',
    bodyBuilder: (context) {
      final t = widget.locale.text;
      return SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Form(
          key: _form,
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            _InfoNotice(text: t('registration.subtitle')),
            const SizedBox(height: 20),
            TextFormField(
              controller: _name,
              textCapitalization: TextCapitalization.words,
              autofillHints: const [AutofillHints.name],
              decoration: _decoration(t('registration.name')),
              validator: (value) => value == null || value.trim().isEmpty ? t('validation.required') : null,
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _contact,
              autofillHints: const [AutofillHints.email, AutofillHints.telephoneNumber],
              decoration: _decoration(t('registration.contact'), hint: t('registration.contactHint')),
              validator: (value) => _contactError(value, t),
            ),
            const SizedBox(height: 24),
            FilledButton(
              onPressed: () {
                if (!(_form.currentState?.validate() ?? false)) return;
                widget.session.saveGuardianDraft(name: _name.text, contact: _contact.text);
                _open(context, FamilyProfilesScreen(locale: widget.locale, session: widget.session));
              },
              child: Text(t('action.createFamily')),
            ),
          ]),
        ),
      );
    },
  );
}

class FamilyProfilesScreen extends StatelessWidget {
  const FamilyProfilesScreen({required this.locale, required this.session, super.key});

  final LocaleController locale;
  final OnboardingSession session;

  @override
  Widget build(BuildContext context) => OnboardingScaffold(
    locale: locale,
    session: session,
    titleKey: 'family.title',
    bodyBuilder: (context) => AnimatedBuilder(
      animation: session,
      builder: (context, _) {
        final t = locale.text;
        final students = session.students;
        return ListView(
          padding: const EdgeInsets.all(20),
          children: [
            _InfoNotice(text: session.account == null ? t('family.draftNotice') : t('family.signedInNotice')),
            if (session.familyLoadFailed) ...[
              const SizedBox(height: 10),
              _ErrorNotice(text: t('family.loadFailed')),
              TextButton(onPressed: () => session.refreshServerStudents(), child: Text(t('action.retry'))),
            ],
            const SizedBox(height: 16),
            if (students.isEmpty)
              _EmptyCard(title: t('family.emptyTitle'), body: t('family.emptyBody')),
            for (final student in students) ...[
              _StudentDraftCard(
                student: student,
                locale: locale,
                onEdit: () => _open(context, StudentProfileFormScreen(
                  locale: locale, session: session, existing: student)),
                onRemove: () => _confirmRemove(context, student, t),
              ),
              const SizedBox(height: 10),
            ],
            OutlinedButton.icon(
              onPressed: () => _open(context, StudentProfileFormScreen(locale: locale, session: session)),
              icon: const Icon(Icons.add),
              label: Text(t('action.addStudent')),
            ),
            const SizedBox(height: 12),
            OutlinedButton.icon(
              onPressed: () => _open(context, ConsentStatusScreen(locale: locale, session: session)),
              icon: const Icon(Icons.verified_user_outlined),
              label: Text(t('action.reviewConsent')),
            ),
            const SizedBox(height: 20),
            if (session.account == null)
              FilledButton(
                onPressed: () => _open(context, CompleteRegistrationScreen(locale: locale, session: session)),
                child: Text(t('action.createAccount')),
              ),
          ],
        );
      },
    ),
  );

  Future<void> _confirmRemove(BuildContext context, StudentProfileDraft student, _Text t) async {
    final remove = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        content: Text(t(student.persisted ? 'family.archiveConfirm' : 'family.removeConfirm')),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: Text(t('action.cancel'))),
          TextButton(onPressed: () => Navigator.pop(context, true), child: Text(t(student.persisted ? 'action.archive' : 'action.remove'))),
        ],
      ),
    );
    if (remove == true) {
      try { await session.removeStudent(student); }
      catch (error) {
        if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(_serviceMessage(error, t, fallbackKey: 'family.operationFailed'))),
        );
      }
    }
  }
}

class StudentProfileFormScreen extends StatefulWidget {
  const StudentProfileFormScreen({required this.locale, required this.session, this.existing, super.key});

  final LocaleController locale;
  final OnboardingSession session;
  final StudentProfileDraft? existing;

  @override
  State<StudentProfileFormScreen> createState() => _StudentProfileFormScreenState();
}

class _StudentProfileFormScreenState extends State<StudentProfileFormScreen> {
  final _form = GlobalKey<FormState>();
  late final TextEditingController _name;
  late StudentAgeGroup? _ageGroup;
  late String _preferredLanguage;
  String? _error;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _name = TextEditingController(text: widget.existing?.preferredName ?? '');
    _ageGroup = widget.existing?.ageGroup;
    _preferredLanguage = widget.existing?.preferredLanguage ?? widget.locale.locale.languageCode;
  }

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => OnboardingScaffold(
    locale: widget.locale,
    session: widget.session,
    titleKey: widget.existing == null ? 'studentForm.titleAdd' : 'studentForm.titleEdit',
    bodyBuilder: (context) {
      final t = widget.locale.text;
      final languages = appLanguages.where((language) => language.available).toList();
      return SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Form(
          key: _form,
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            _InfoNotice(text: widget.session.account == null
                ? t('studentForm.draftNotice')
                : widget.existing?.persisted == true
                    ? t('studentForm.accountNotice')
                    : t('studentForm.pendingConsentNotice')),
            const SizedBox(height: 20),
            TextFormField(
              controller: _name,
              textCapitalization: TextCapitalization.words,
              decoration: _decoration(t('studentForm.name')),
              validator: (value) => value == null || value.trim().isEmpty ? t('validation.studentName') : null,
            ),
            const SizedBox(height: 16),
            DropdownButtonFormField<StudentAgeGroup>(
              value: _ageGroup,
              decoration: _decoration(t('family.ageGroup')),
              items: [
                DropdownMenuItem(value: StudentAgeGroup.child, child: Text(t('age.child'))),
                DropdownMenuItem(value: StudentAgeGroup.youth, child: Text(t('age.youth'))),
              ],
              onChanged: (value) => setState(() => _ageGroup = value),
              validator: (value) => value == null ? t('validation.selectAgeGroup') : null,
            ),
            const SizedBox(height: 8),
            Text(t('studentForm.ageGroupHelp'), style: Theme.of(context).textTheme.bodySmall),
            const SizedBox(height: 16),
            DropdownButtonFormField<String>(
              value: languages.any((item) => item.locale.languageCode == _preferredLanguage)
                  ? _preferredLanguage : 'en',
              decoration: _decoration(t('family.preferredLanguage')),
              items: languages.map((item) => DropdownMenuItem(
                value: item.locale.languageCode,
                child: Text('${item.nativeName} · ${item.englishName}', softWrap: true),
              )).toList(),
              onChanged: (value) => setState(() => _preferredLanguage = value ?? 'en'),
            ),
            const SizedBox(height: 24),
            if (_error != null) ...[const SizedBox(height: 12), _ErrorNotice(text: _error!)],
            FilledButton(
              onPressed: _busy ? null : _save,
              child: _busy
                  ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2))
                  : Text(widget.session.account == null ? t('action.saveDraft') : t('action.saveProfile')),
            ),
          ]),
        ),
      );
    },
  );

  Future<void> _save() async {
    final t = widget.locale.text;
    if (!(_form.currentState?.validate() ?? false) || _ageGroup == null) return;
    final persisted = widget.existing?.persisted ?? false;
    final draft = StudentProfileDraft(
      localId: widget.existing?.localId ?? DateTime.now().microsecondsSinceEpoch.toString(),
      relationshipId: widget.existing?.relationshipId,
      preferredName: _name.text.trim(),
      ageGroup: _ageGroup!,
      preferredLanguage: _preferredLanguage,
      relationshipStatus: persisted
          ? widget.existing!.relationshipStatus
          : widget.session.account == null ? GuardianRelationshipStatus.draftOnly : GuardianRelationshipStatus.pendingConsent,
      consentStatus: widget.existing?.consentStatus ?? (widget.session.account == null
          ? GuardianConsentStatus.policyNotConfigured : GuardianConsentStatus.notRecorded),
      persisted: persisted,
      profileStatus: widget.existing?.profileStatus ?? (widget.session.account == null ? 'draft' : 'pending_consent'),
    );
    setState(() { _busy = true; _error = null; });
    try {
      await widget.session.saveStudentProfile(draft);
      if (mounted) Navigator.of(context).pop();
    } catch (error) {
      if (mounted) setState(() => _error = _serviceMessage(error, t, fallbackKey: 'family.operationFailed'));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }
}

class ConsentStatusScreen extends StatefulWidget {
  const ConsentStatusScreen({required this.locale, required this.session, super.key});

  final LocaleController locale;
  final OnboardingSession session;

  @override
  State<ConsentStatusScreen> createState() => _ConsentStatusScreenState();
}

class _ConsentStatusScreenState extends State<ConsentStatusScreen> {
  final Set<String> _reviewed = {};
  final Set<String> _busy = {};
  String? _error;

  @override
  void initState() {
    super.initState();
    widget.locale.addListener(_onLanguageChanged);
  }

  void _onLanguageChanged() {
    if (widget.session.account != null) {
      widget.session.loadConsentPolicy(widget.locale.locale.languageCode);
    }
  }

  @override
  void dispose() {
    widget.locale.removeListener(_onLanguageChanged);
    super.dispose();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (widget.session.account != null && widget.session.consentPolicy == null && !widget.session.policyLoadFailed) {
      widget.session.loadConsentPolicy(widget.locale.locale.languageCode);
    }
  }

  @override
  Widget build(BuildContext context) => OnboardingScaffold(
    locale: widget.locale,
    session: widget.session,
    titleKey: 'consent.title',
    bodyBuilder: (context) {
      final t = widget.locale.text;
      final session = widget.session;
      return AnimatedBuilder(
        animation: session,
        builder: (context, _) {
          final policy = session.consentPolicy;
          return ListView(
        padding: const EdgeInsets.all(24),
        children: [
          Text(t('consent.intro'), style: Theme.of(context).textTheme.bodyLarge),
          const SizedBox(height: 20),
          if (session.account == null)
            _StatusCard(title: t('consent.signInRequired'), body: t('consent.signInRequiredBody'), icon: Icons.lock_outline, color: _saffron),
          if (_error != null) _ErrorNotice(text: _error!),
          if (policy == null) ...[
            if (session.account != null && !session.policyLoadFailed) const Center(child: CircularProgressIndicator()),
            if (session.account != null && session.policyLoadFailed) _StatusCard(
              title: t('consent.notConfiguredTitle'),
              body: t('consent.notConfiguredBody'),
              icon: Icons.info_outline,
              color: _saffron,
            ),
            if (session.account != null && session.policyLoadFailed)
              TextButton(onPressed: () => session.loadConsentPolicy(widget.locale.locale.languageCode), child: Text(t('action.retry'))),
          ] else ...[
            _StatusCard(title: policy.title, body: policy.body, icon: Icons.policy_outlined, color: _green),
            const SizedBox(height: 12),
            Text(t('consent.policyVersion', {'version': policy.version})),
          ],
          const SizedBox(height: 20),
          Text(t('consent.statusLabel'), style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          for (final student in session.serverStudents)
            Card(color: Colors.white, child: Padding(padding: const EdgeInsets.all(12), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              ListTile(contentPadding: EdgeInsets.zero, leading: const Icon(Icons.person_outline, color: _green), title: Text(student.preferredName), subtitle: Text(_consentStatusText(t, student.consentStatus))),
              if (policy != null && student.consentStatus != GuardianConsentStatus.recorded && student.relationshipId != null) ...[
                CheckboxListTile(value: _reviewed.contains(student.relationshipId), onChanged: _busy.contains(student.relationshipId) ? null : (value) => setState(() { value == true ? _reviewed.add(student.relationshipId!) : _reviewed.remove(student.relationshipId!); }), title: Text(t('consent.explicitReview')), controlAffinity: ListTileControlAffinity.leading, contentPadding: EdgeInsets.zero),
                FilledButton(onPressed: !_reviewed.contains(student.relationshipId) || _busy.contains(student.relationshipId) ? null : () => _record(student, policy), child: Text(t('consent.grantAction'))),
              ],
              if (student.consentStatus == GuardianConsentStatus.recorded && student.relationshipId != null)
                TextButton(onPressed: _busy.contains(student.relationshipId) ? null : () => _revoke(student), child: Text(t('consent.revokeAction'))),
            ]))),
          if (session.serverStudents.isEmpty)
            _EmptyCard(title: t('family.emptyTitle'), body: t('consent.noStudent')),
        ],
          );
        },
      );
    },
  );

  Future<void> _record(StudentProfileDraft student, ConsentPolicyDocument policy) async {
    final id = student.relationshipId;
    if (id == null) return;
    setState(() { _busy.add(id); _error = null; });
    try { await widget.session.grantConsent(id, policy); _reviewed.remove(id); }
    catch (error) { if (mounted) setState(() => _error = _serviceMessage(error, widget.locale.text, fallbackKey: 'family.consentOperationFailed')); }
    finally { if (mounted) setState(() => _busy.remove(id)); }
  }

  Future<void> _revoke(StudentProfileDraft student) async {
    final id = student.relationshipId;
    if (id == null) return;
    final t = widget.locale.text;
    final confirmed = await showDialog<bool>(context: context, builder: (context) => AlertDialog(
      title: Text(t('consent.revokeConfirmTitle')), content: Text(t('consent.revokeConfirmBody')),
      actions: [TextButton(onPressed: () => Navigator.pop(context, false), child: Text(t('action.cancel'))), FilledButton(onPressed: () => Navigator.pop(context, true), child: Text(t('consent.revokeAction')))],
    ));
    if (confirmed != true) return;
    setState(() { _busy.add(id); _error = null; });
    try { await widget.session.revokeConsent(id); }
    catch (error) { if (mounted) setState(() => _error = _serviceMessage(error, t, fallbackKey: 'family.consentOperationFailed')); }
    finally { if (mounted) setState(() => _busy.remove(id)); }
  }
}

class CompleteRegistrationScreen extends StatefulWidget {
  const CompleteRegistrationScreen({required this.locale, required this.session, super.key});

  final LocaleController locale;
  final OnboardingSession session;

  @override
  State<CompleteRegistrationScreen> createState() => _CompleteRegistrationScreenState();
}

class _CompleteRegistrationScreenState extends State<CompleteRegistrationScreen> {
  final _form = GlobalKey<FormState>();
  final _password = TextEditingController();
  final _confirm = TextEditingController();
  String? _error;
  bool _busy = false;

  @override
  void dispose() {
    _password.dispose();
    _confirm.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => OnboardingScaffold(
    locale: widget.locale,
    session: widget.session,
    titleKey: 'credentials.title',
    bodyBuilder: (context) {
      final t = widget.locale.text;
      return SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Form(
          key: _form,
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Text(t('credentials.body')),
            const SizedBox(height: 20),
            TextFormField(
              controller: _password,
              obscureText: true,
              autofillHints: const [AutofillHints.newPassword],
              decoration: _decoration(t('registration.password')),
            validator: (value) => (value ?? '').length < 10 ? t('validation.password') : null,
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _confirm,
              obscureText: true,
              decoration: _decoration(t('registration.confirmPassword')),
              validator: (value) => value != _password.text ? t('validation.passwordMatch') : null,
            ),
            if (_error != null) ...[
              const SizedBox(height: 16),
              _ErrorNotice(text: _error!),
            ],
            const SizedBox(height: 24),
            FilledButton(
              onPressed: _busy ? null : _submit,
              child: _busy
                  ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2))
                  : Text(t('action.createAccount')),
            ),
          ]),
        ),
      );
    },
  );

  Future<void> _submit() async {
    final t = widget.locale.text;
    if (!(_form.currentState?.validate() ?? false)) return;
    if (widget.session.guardian == null) {
      setState(() => _error = t('registration.missingDraft'));
      return;
    }
    setState(() { _busy = true; _error = null; });
    try {
      final guardian = widget.session.guardian!;
      final result = await widget.session.repository.registerGuardian(GuardianRegistrationRequest(
        name: guardian.name,
        contact: guardian.contact,
        password: _password.text,
        preferredLanguage: widget.locale.locale.languageCode,
        students: const [],
      ));
      if (mounted && result.verificationPending) {
        _password.clear();
        _confirm.clear();
        _open(context, ContactVerificationScreen(locale: widget.locale, session: widget.session, contact: guardian.contact));
      } else if (mounted) {
        setState(() => _error = t('registration.unexpectedResponse'));
      }
    } catch (error) {
      if (mounted) setState(() => _error = _serviceMessage(error, t, fallbackKey: 'auth.serviceUnavailable'));
    } finally {
      _password.clear();
      _confirm.clear();
      if (mounted) setState(() => _busy = false);
    }
  }
}

class ParentSignInScreen extends StatefulWidget {
  const ParentSignInScreen({required this.locale, required this.session, super.key});

  final LocaleController locale;
  final OnboardingSession session;

  @override
  State<ParentSignInScreen> createState() => _ParentSignInScreenState();
}

class _ParentSignInScreenState extends State<ParentSignInScreen> {
  final _form = GlobalKey<FormState>();
  final _identifier = TextEditingController();
  final _password = TextEditingController();
  String? _error;
  bool _busy = false;

  @override
  void dispose() { _identifier.dispose(); _password.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) => OnboardingScaffold(
    locale: widget.locale,
    session: widget.session,
    titleKey: 'auth.signInTitle',
    bodyBuilder: (context) {
      final t = widget.locale.text;
      return SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Form(key: _form, child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          TextFormField(
            controller: _identifier,
            autofillHints: const [AutofillHints.username],
            decoration: _decoration(t('auth.identifier')),
            validator: (value) => _contactError(value, t),
          ),
          const SizedBox(height: 16),
          TextFormField(
            controller: _password,
            obscureText: true,
            autofillHints: const [AutofillHints.password],
            decoration: _decoration(t('auth.password')),
            validator: (value) => value == null || value.isEmpty ? t('validation.required') : null,
          ),
          Align(
            alignment: AlignmentDirectional.centerStart,
            child: TextButton(
              onPressed: () => _open(context, AccountRecoveryScreen(locale: widget.locale, session: widget.session)),
              child: Text(t('auth.recoveryLink')),
            ),
          ),
          if (_error != null) _ErrorNotice(text: _error!),
          const SizedBox(height: 16),
          FilledButton(
            onPressed: _busy ? null : _signIn,
            child: _busy ? const CircularProgressIndicator() : Text(t('action.signIn')),
          ),
        ])),
      );
    },
  );

  Future<void> _signIn() async {
    final t = widget.locale.text;
    if (!(_form.currentState?.validate() ?? false)) return;
    setState(() { _busy = true; _error = null; });
    try {
      await widget.session.signIn(SignInRequest(
        identifier: _identifier.text.trim(), password: _password.text,
      ));
      if (mounted) {
        Navigator.of(context).pushAndRemoveUntil(
          MaterialPageRoute<void>(builder: (_) => DashboardScreen(
            locale: widget.locale,
            session: widget.session,
            familyBuilder: (_) => FamilyProfilesScreen(locale: widget.locale, session: widget.session),
            settingsBuilder: (_) => ProfileSettingsScreen(locale: widget.locale, session: widget.session),
            adminBuilder: (_) => AdminConsoleScreen(locale: widget.locale, session: widget.session),
          )),
          (_) => false,
        );
      }
    } catch (error) {
      if (mounted) setState(() => _error = _serviceMessage(error, t, fallbackKey: 'auth.serviceUnavailable'));
    } finally {
      _password.clear();
      if (mounted) setState(() => _busy = false);
    }
  }
}

class AccountRecoveryScreen extends StatefulWidget {
  const AccountRecoveryScreen({required this.locale, required this.session, super.key});

  final LocaleController locale;
  final OnboardingSession session;

  @override
  State<AccountRecoveryScreen> createState() => _AccountRecoveryScreenState();
}

class _AccountRecoveryScreenState extends State<AccountRecoveryScreen> {
  final _form = GlobalKey<FormState>();
  final _contact = TextEditingController();
  final _code = TextEditingController();
  final _newPassword = TextEditingController();
  final _confirmPassword = TextEditingController();
  String? _message;
  bool _busy = false;
  bool _requested = false;
  bool _completed = false;

  @override
  void dispose() {
    _contact.dispose();
    _code.dispose();
    _newPassword.dispose();
    _confirmPassword.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => OnboardingScaffold(
    locale: widget.locale,
    session: widget.session,
    titleKey: 'auth.recoveryTitle',
    bodyBuilder: (context) {
      final t = widget.locale.text;
      return SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Form(key: _form, child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text(t('auth.recoveryBody')),
          const SizedBox(height: 20),
          if (!_requested) TextFormField(
            controller: _contact,
            decoration: _decoration(t('registration.contact')),
            validator: (value) => _contactError(value, t),
          ),
          if (_requested && !_completed) ...[
            Text(t('auth.recoveryInstructions')),
            const SizedBox(height: 16),
            TextFormField(
              controller: _code,
              keyboardType: TextInputType.number,
              maxLength: 6,
              decoration: _decoration(t('auth.code')),
              validator: (value) => value == null || !RegExp(r'^\d{6}$').hasMatch(value.trim()) ? t('validation.code') : null,
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _newPassword,
              obscureText: true,
              decoration: _decoration(t('registration.password')),
              validator: (value) => (value ?? '').length < 10 ? t('validation.password') : null,
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _confirmPassword,
              obscureText: true,
              decoration: _decoration(t('registration.confirmPassword')),
              validator: (value) => value != _newPassword.text ? t('validation.passwordMatch') : null,
            ),
          ],
          if (_completed) _InfoNotice(text: t('auth.recoveryComplete')),
          if (_message != null) ...[
            const SizedBox(height: 16),
            _ErrorNotice(text: _message!),
          ],
          const SizedBox(height: 24),
          FilledButton(
            onPressed: _busy || _completed ? null : _requested ? _completeRecovery : _recover,
            child: _busy
                ? const CircularProgressIndicator()
                : Text(_requested ? t('action.completeRecovery') : t('action.recover')),
          ),
        ])),
      );
    },
  );

  Future<void> _recover() async {
    final t = widget.locale.text;
    if (!(_form.currentState?.validate() ?? false)) return;
    setState(() { _busy = true; _message = null; });
    try {
      await widget.session.repository.requestAccountRecovery(_contact.text.trim());
      if (mounted) setState(() { _requested = true; _message = null; });
    } catch (error) {
      if (mounted) setState(() => _message = _serviceMessage(error, t, fallbackKey: 'auth.recoveryUnavailable'));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _completeRecovery() async {
    final t = widget.locale.text;
    if (!(_form.currentState?.validate() ?? false)) return;
    setState(() { _busy = true; _message = null; });
    try {
      await widget.session.repository.completeAccountRecovery(
        contact: _contact.text.trim(), code: _code.text.trim(), newPassword: _newPassword.text,
      );
      if (mounted) setState(() => _completed = true);
    } catch (error) {
      if (mounted) setState(() => _message = _serviceMessage(error, t, fallbackKey: 'auth.recoveryUnavailable'));
    } finally {
      _newPassword.clear();
      _confirmPassword.clear();
      if (mounted) setState(() => _busy = false);
    }
  }
}

class ContactVerificationScreen extends StatefulWidget {
  const ContactVerificationScreen({required this.locale, required this.session, required this.contact, super.key});

  final LocaleController locale;
  final OnboardingSession session;
  final String contact;

  @override
  State<ContactVerificationScreen> createState() => _ContactVerificationScreenState();
}

class _ContactVerificationScreenState extends State<ContactVerificationScreen> {
  final _form = GlobalKey<FormState>();
  final _code = TextEditingController();
  String? _error;
  bool _busy = false;
  bool _verified = false;

  @override
  void dispose() { _code.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) => OnboardingScaffold(
    locale: widget.locale,
    session: widget.session,
    titleKey: 'auth.verificationTitle',
    bodyBuilder: (context) {
      final t = widget.locale.text;
      return SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Form(key: _form, child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text(t('registration.verificationPending')),
          const SizedBox(height: 8),
          Text(widget.contact, textAlign: TextAlign.start),
          if (!_verified) ...[
            const SizedBox(height: 20),
            TextFormField(
              controller: _code,
              keyboardType: TextInputType.number,
              maxLength: 6,
              decoration: _decoration(t('auth.code')),
              validator: (value) => value == null || !RegExp(r'^\d{6}$').hasMatch(value.trim()) ? t('validation.code') : null,
            ),
          ],
          if (_error != null) ...[const SizedBox(height: 12), _ErrorNotice(text: _error!)],
          if (_verified) ...[const SizedBox(height: 12), _InfoNotice(text: t('auth.verificationComplete'))],
          const SizedBox(height: 20),
          if (!_verified)
            FilledButton(
              onPressed: _busy ? null : _verify,
              child: _busy ? const CircularProgressIndicator() : Text(t('auth.completeVerification')),
            )
          else
            FilledButton(
              onPressed: () => _open(context, ParentSignInScreen(locale: widget.locale, session: widget.session)),
              child: Text(t('action.signIn')),
            ),
        ])),
      );
    },
  );

  Future<void> _verify() async {
    final t = widget.locale.text;
    if (!(_form.currentState?.validate() ?? false)) return;
    setState(() { _busy = true; _error = null; });
    try {
      await widget.session.repository.completeVerification(contact: widget.contact, code: _code.text.trim());
      if (mounted) setState(() => _verified = true);
    } catch (error) {
      if (mounted) setState(() => _error = _serviceMessage(error, t, fallbackKey: 'auth.verificationUnavailable'));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }
}

class ProfileSettingsScreen extends StatelessWidget {
  const ProfileSettingsScreen({required this.locale, required this.session, super.key});

  final LocaleController locale;
  final OnboardingSession session;

  @override
  Widget build(BuildContext context) => OnboardingScaffold(
    locale: locale,
    session: session,
    titleKey: 'profile.title',
    bodyBuilder: (context) {
      final t = locale.text;
      return ListView(padding: const EdgeInsets.all(24), children: [
        _InfoNotice(text: session.account == null ? t('profile.signedOut') : t('profile.signedIn')),
        const SizedBox(height: 16),
        Card(color: Colors.white, child: ListTile(
          leading: const Icon(Icons.language, color: _green),
          title: Text(t('profile.language')),
          subtitle: Text(languageFor(locale.locale)?.nativeName ?? t('language.englishName')),
          trailing: const Icon(Icons.chevron_right),
          onTap: () => showLanguagePicker(context, locale, onLanguageChanged: session.syncLanguagePreference),
        )),
        const SizedBox(height: 16),
        Text(t(session.account == null ? 'profile.accountNotConnected' : 'profile.accountConnected')),
        if (session.account != null) ...[
          const SizedBox(height: 20),
          FilledButton.tonalIcon(
            onPressed: () async {
              try {
                await session.signOut();
                if (context.mounted) {
                  Navigator.of(context).pushAndRemoveUntil(
                    MaterialPageRoute<void>(builder: (_) => WelcomeScreen(locale: locale, session: session)),
                    (_) => false,
                  );
                }
              } catch (_) {
                if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text(t('auth.signOutFailed'))),
                );
              }
            },
            icon: const Icon(Icons.logout),
            label: Text(t('action.signOut')),
          ),
        ],
      ]);
    },
  );
}

class _StudentDraftCard extends StatelessWidget {
  const _StudentDraftCard({required this.student, required this.locale, required this.onEdit, required this.onRemove});

  final StudentProfileDraft student;
  final LocaleController locale;
  final VoidCallback onEdit;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    final t = locale.text;
    return Card(
      color: Colors.white,
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            const Icon(Icons.person_outline, color: _green),
            const SizedBox(width: 8),
            Expanded(child: Text(student.preferredName, style: const TextStyle(fontWeight: FontWeight.w700))),
            PopupMenuButton<String>(
              tooltip: t('family.manage'),
              onSelected: (value) => value == 'edit' ? onEdit() : onRemove(),
              itemBuilder: (_) => [
                PopupMenuItem(value: 'edit', child: Text(t('action.edit'))),
                PopupMenuItem(value: 'remove', child: Text(t(student.persisted ? 'action.archive' : 'action.remove'))),
              ],
            ),
          ]),
          Text('${t('family.ageGroup')}: ${t(student.ageGroup == StudentAgeGroup.child ? 'age.child' : 'age.youth')}'),
          Text('${t('family.preferredLanguage')}: ${_languageName(student.preferredLanguage)}'),
          const SizedBox(height: 8),
          Text(t(student.persisted ? 'family.serverProfile' : 'family.studentDraft'), style: Theme.of(context).textTheme.labelMedium?.copyWith(color: _saffron)),
          Text('${t('family.relationshipStatus')}: ${t(_relationshipStatusKey(student.relationshipStatus))}'),
          Text('${t('family.consentStatus')}: ${_consentStatusText(t, student.consentStatus)}'),
        ]),
      ),
    );
  }

  String _languageName(String code) {
    for (final language in appLanguages) {
      if (language.locale.languageCode == code) return '${language.nativeName} · ${language.englishName}';
    }
    return locale.text('language.englishName');
  }
}

class _InfoNotice extends StatelessWidget {
  const _InfoNotice({required this.text});
  final String text;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(14),
    decoration: BoxDecoration(color: _saffron.withValues(alpha: 0.18), borderRadius: BorderRadius.circular(12)),
    child: Text(text, style: const TextStyle(color: _forest)),
  );
}

class _ErrorNotice extends StatelessWidget {
  const _ErrorNotice({required this.text});
  final String text;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(14),
    decoration: BoxDecoration(color: Colors.red.withValues(alpha: 0.08), borderRadius: BorderRadius.circular(12)),
    child: Text(text, style: const TextStyle(color: Color(0xFF8A2E2E))),
  );
}

class _EmptyCard extends StatelessWidget {
  const _EmptyCard({required this.title, required this.body});
  final String title;
  final String body;

  @override
  Widget build(BuildContext context) => Card(
    color: Colors.white,
    child: Padding(padding: const EdgeInsets.all(20), child: Column(children: [
      const Icon(Icons.groups_2_outlined, color: _green, size: 38),
      const SizedBox(height: 8),
      Text(title, style: Theme.of(context).textTheme.titleMedium, textAlign: TextAlign.center),
      const SizedBox(height: 8),
      Text(body, textAlign: TextAlign.center),
    ])),
  );
}

class _StatusCard extends StatelessWidget {
  const _StatusCard({required this.title, required this.body, required this.icon, required this.color});
  final String title;
  final String body;
  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) => Card(
    color: Colors.white,
    child: Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [Icon(icon, color: color), const SizedBox(width: 8), Expanded(child: Text(title, style: const TextStyle(fontWeight: FontWeight.w700)))]),
      const SizedBox(height: 10),
      Text(body),
    ])),
  );
}

InputDecoration _decoration(String label, {String? hint}) => InputDecoration(
  labelText: label,
  hintText: hint,
  border: const OutlineInputBorder(),
  filled: true,
  fillColor: Colors.white,
);

String? _contactError(String? value, _Text t) {
  final contact = value?.trim() ?? '';
  if (contact.isEmpty) return t('validation.contact');
  final isEmail = RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(contact);
  final digits = contact.replaceAll(RegExp(r'\D'), '');
  if (!isEmail && digits.length < 7) return t('validation.email');
  return null;
}

String _consentStatusText(_Text t, GuardianConsentStatus status) => switch (status) {
  GuardianConsentStatus.policyNotConfigured => t('family.consentPolicyMissing'),
  GuardianConsentStatus.notRecorded => t('family.consentNotRecorded'),
  GuardianConsentStatus.pendingVerification => t('consent.statusPending'),
  GuardianConsentStatus.recorded => t('consent.statusRecorded'),
  GuardianConsentStatus.revoked => t('consent.statusRevoked'),
};

String _relationshipStatusKey(GuardianRelationshipStatus status) => switch (status) {
  GuardianRelationshipStatus.draftOnly => 'family.relationshipDraft',
  GuardianRelationshipStatus.pendingConsent => 'family.relationshipPending',
  GuardianRelationshipStatus.active => 'family.relationshipActive',
  GuardianRelationshipStatus.revoked => 'family.relationshipRevoked',
  GuardianRelationshipStatus.archived => 'family.relationshipArchived',
};

String _serviceMessage(Object error, _Text t, {required String fallbackKey}) {
  if (error is OnboardingIntegrationUnavailable) return t('auth.configurationRequired');
  if (error is OnboardingServiceException) {
    final key = switch (error.code) {
      'VERIFICATION_UNAVAILABLE' || 'RECOVERY_UNAVAILABLE' => 'auth.verificationUnavailable',
      'CONSENT_POLICY_UNAVAILABLE' => 'consent.notConfiguredBody',
      'AUTH_REQUIRED' || 'FORBIDDEN' || 'NOT_FOUND' => 'auth.invalidCredentials',
      'RATE_LIMITED' => 'auth.rateLimited',
      'API_CONFIGURATION_REQUIRED' => 'auth.configurationRequired',
      'CONTACT_INVALID' => 'validation.contact',
      'PASSWORD_INVALID' => 'validation.password',
      _ => fallbackKey,
    };
    return t(key);
  }
  return t(fallbackKey);
}
