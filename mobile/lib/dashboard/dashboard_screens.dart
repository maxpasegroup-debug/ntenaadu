import 'package:flutter/material.dart';

import '../localization/language_picker.dart';
import '../localization/locale_controller.dart';
import '../learning/learning_screens.dart';
import '../clubs/club_screens.dart';
import '../events/event_screens.dart';
import '../programmes/programme_screens.dart';
import '../onboarding/onboarding_models.dart';
import '../onboarding/onboarding_session.dart';
import '../admin/admin_console.dart';

const _forest = Color(0xFF263A30);
const _green = Color(0xFF4C8B69);
const _saffron = Color(0xFFF3A66B);
const _ivory = Color(0xFFF6F3EC);

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({required this.locale, required this.session, required this.familyBuilder, required this.settingsBuilder, required this.adminBuilder, super.key});

  final LocaleController locale;
  final OnboardingSession session;
  final WidgetBuilder familyBuilder;
  final WidgetBuilder settingsBuilder;
  final WidgetBuilder adminBuilder;

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  int _tab = 0;
  bool _learningVisited = false;
  StudentProfileDraft? _studentView;

  StudentProfileDraft? get _selectedStudent {
    final id = _studentView?.localId;
    if (id == null) return null;
    for (final profile in widget.session.serverStudents) {
      if (profile.localId == id && profile.profileStatus == 'active' &&
          profile.relationshipStatus == GuardianRelationshipStatus.active &&
          profile.consentStatus == GuardianConsentStatus.recorded) return profile;
    }
    return null;
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: Listenable.merge([widget.session, widget.locale]),
    builder: (context, _) {
      final t = widget.locale.text;
      final isStudent = _selectedStudent != null;
      final titles = ['dashboard.home', 'dashboard.learn', 'dashboard.clubs', 'dashboard.grow'];
      return Scaffold(
        appBar: AppBar(
          backgroundColor: _ivory,
          foregroundColor: _forest,
          leading: isStudent
              ? IconButton(tooltip: t('dashboard.parentView'), onPressed: () => setState(() { _studentView = null; _tab = 0; }), icon: const Icon(Icons.arrow_back))
              : null,
          title: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(t('brand.name'), style: const TextStyle(fontWeight: FontWeight.w700)),
            Text(t('brand.slogan'), style: Theme.of(context).textTheme.labelSmall),
          ]),
          actions: [
            IconButton(tooltip: t('dashboard.notifications'), onPressed: () => _unavailable('dashboard.notificationsUnavailableTitle', 'dashboard.notificationsUnavailableBody'), icon: const Icon(Icons.notifications_none)),
            IconButton(tooltip: t('safeguarding.reportTitle'), onPressed: _reportConcern, icon: const Icon(Icons.shield_outlined)),
            if (!isStudent && widget.session.staffRoles.isNotEmpty) IconButton(tooltip: t('admin.title'), onPressed: _openAdmin, icon: const Icon(Icons.admin_panel_settings_outlined)),
            if (!isStudent) LanguagePickerButton(controller: widget.locale, compact: true, onLanguageChanged: widget.session.syncLanguagePreference),
            if (!isStudent) IconButton(tooltip: t('action.profileSettings'), onPressed: _openSettings, icon: const Icon(Icons.account_circle_outlined)),
          ],
        ),
        body: SafeArea(child: Center(child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 640),
          child: IndexedStack(index: _tab, children: [
            _tab == 0 ? _home() : const SizedBox.shrink(),
            _learningVisited
                ? LearningLibraryTab(locale: widget.locale, repository: widget.session.learningRepository, studentProfileId: _selectedStudent?.localId, onOpenProgrammes: () => setState(() => _tab = 3))
                : const SizedBox.shrink(),
            ClubLandingTab(locale: widget.locale, repository: widget.session.clubRepository,
              students: widget.session.serverStudents, studentProfileId: _selectedStudent?.localId,
              eventRepository: widget.session.eventRepository, onReportConcern: _reportConcern),
            ProgrammeLandingTab(locale: widget.locale, repository: widget.session.programmeRepository,
              learningRepository: widget.session.learningRepository, paymentRepository: widget.session.paymentRepository,
              students: widget.session.serverStudents,
              studentProfileId: _selectedStudent?.localId, studentView: isStudent, onReportConcern: _reportConcern),
          ]),
        ))),
        bottomNavigationBar: NavigationBar(
          selectedIndex: _tab,
          onDestinationSelected: (index) => setState(() { _tab = index; if (index == 1) _learningVisited = true; }),
          destinations: [
            NavigationDestination(icon: const Icon(Icons.home_outlined), selectedIcon: const Icon(Icons.home), label: t(titles[0])),
            NavigationDestination(icon: const Icon(Icons.menu_book_outlined), label: t(titles[1])),
            NavigationDestination(icon: const Icon(Icons.groups_outlined), label: t(titles[2])),
            NavigationDestination(icon: const Icon(Icons.spa_outlined), label: t(titles[3])),
          ],
        ),
      );
    },
  );

  Widget _home() {
    final t = widget.locale.text;
    final student = _selectedStudent;
    if (student != null) return _studentHome(student);
    return RefreshIndicator(
      onRefresh: widget.session.refreshServerStudents,
      child: ListView(padding: const EdgeInsets.fromLTRB(18, 14, 18, 24), children: [
        _WelcomeCard(name: widget.session.account?.name ?? '', subtitle: t('dashboard.parentWelcome'), brand: '${t('brand.name')} · ${t('brand.slogan')}'),
        const SizedBox(height: 16),
        Row(children: [Expanded(child: Text(t('dashboard.familyTitle'), style: Theme.of(context).textTheme.titleLarge)),
          TextButton.icon(onPressed: _manageFamily, icon: const Icon(Icons.manage_accounts_outlined), label: Text(t('dashboard.manageFamily')))]),
        if (widget.session.familyLoadFailed) ...[
          _MessageCard(icon: Icons.cloud_off_outlined, title: t('dashboard.familyLoadErrorTitle'), body: t('dashboard.familyLoadErrorBody'), color: _saffron),
          Align(alignment: AlignmentDirectional.centerStart, child: TextButton.icon(onPressed: widget.session.refreshServerStudents, icon: const Icon(Icons.refresh), label: Text(t('action.retry')))),
        ] else if (widget.session.serverStudents.isEmpty)
          _MessageCard(icon: Icons.people_outline, title: t('dashboard.noProfilesTitle'), body: t('dashboard.noProfilesBody'), color: _saffron)
        else
          for (final profile in widget.session.serverStudents) ...[
            _ProfileCard(profile: profile, locale: widget.locale, onOpen: () => _openStudent(profile)),
            const SizedBox(height: 10),
          ],
        const SizedBox(height: 12),
        _MessageCard(icon: Icons.auto_stories_outlined, title: t('dashboard.familyLearningTitle'), body: t('dashboard.learningUnavailable'), color: _green),
        const SizedBox(height: 10),
        _MessageCard(icon: Icons.spa_outlined, title: t('dashboard.dreamTitle'), body: t('programme.growIntro'), color: _saffron, onTap: () => setState(() => _tab = 3)),
        const SizedBox(height: 10),
        _MessageCard(icon: Icons.event_available_outlined, title: t('dashboard.eventsTitle'), body: t('events.openFromDashboard'), color: _saffron, onTap: _openEvents),
        const SizedBox(height: 10),
        _MessageCard(icon: Icons.fact_check_outlined, title: t('dashboard.requestsTitle'), body: t('dashboard.requestsUnavailable'), color: _green),
        const SizedBox(height: 10),
        _MessageCard(icon: Icons.insights_outlined, title: t('dashboard.activityTitle'), body: t('dashboard.activityUnavailable'), color: _saffron),
      ]),
    );
  }

  Widget _studentHome(StudentProfileDraft profile) {
    final t = widget.locale.text;
    return ListView(padding: const EdgeInsets.fromLTRB(18, 14, 18, 24), children: [
      _WelcomeCard(name: profile.preferredName, subtitle: t('dashboard.studentWelcome'), brand: '${t('brand.name')} · ${t('brand.slogan')}'),
      const SizedBox(height: 12),
      _MessageCard(icon: Icons.family_restroom, title: t('dashboard.guardianControlledTitle'), body: t('dashboard.guardianControlledBody'), color: _saffron),
      const SizedBox(height: 16),
      _MessageCard(icon: Icons.play_circle_outline, title: t('dashboard.continueLearningTitle'), body: t('dashboard.learningUnavailable'), color: _green),
      const SizedBox(height: 10),
      _MessageCard(icon: Icons.library_books_outlined, title: t('dashboard.programmesTitle'), body: t('dashboard.programmesUnavailable'), color: _saffron),
      const SizedBox(height: 10),
      _MessageCard(icon: Icons.flag_outlined, title: t('dashboard.goalsTitle'), body: t('dashboard.goalsUnavailable'), color: _green),
      const SizedBox(height: 10),
      _MessageCard(icon: Icons.spa_outlined, title: t('dashboard.dreamTitle'), body: t('programme.growIntro'), color: _saffron, onTap: () => setState(() => _tab = 3)),
      const SizedBox(height: 10),
      _MessageCard(icon: Icons.groups_outlined, title: t('dashboard.studentClubsTitle'), body: t('dashboard.clubsUnavailable'), color: _green),
      const SizedBox(height: 10),
      _MessageCard(icon: Icons.event_available_outlined, title: t('dashboard.eventsTitle'), body: t('events.openFromDashboard'), color: _saffron, onTap: _openEvents),
    ]);
  }

  void _openStudent(StudentProfileDraft profile) {
    final t = widget.locale.text;
    if (profile.profileStatus != 'active' || profile.consentStatus != GuardianConsentStatus.recorded) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(t('dashboard.consentBlocksStudentView'))));
      return;
    }
    setState(() { _studentView = profile; _tab = 0; });
  }

  void _manageFamily() => Navigator.of(context).push(MaterialPageRoute<void>(
    builder: widget.familyBuilder,
  ));

  void _openSettings() => Navigator.of(context).push(MaterialPageRoute<void>(
    builder: widget.settingsBuilder,
  ));

  void _openAdmin() => Navigator.of(context).push(MaterialPageRoute<void>(builder: widget.adminBuilder));

  void _reportConcern() => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => SafeguardingReportScreen(locale: widget.locale, repository: widget.session.adminRepository!)));

  void _openEvents() => Navigator.of(context).push(MaterialPageRoute<void>(
    builder: (_) => EventsScreen(locale: widget.locale, repository: widget.session.eventRepository,
      students: widget.session.serverStudents, studentProfileId: _selectedStudent?.localId,
      studentView: _selectedStudent != null, onReportConcern: _reportConcern),
  ));

  void _unavailable(String titleKey, String bodyKey) {
    final t = widget.locale.text;
    showDialog<void>(context: context, builder: (context) => AlertDialog(
      title: Text(t(titleKey)), content: Text(t(bodyKey)),
      actions: [TextButton(onPressed: () => Navigator.pop(context), child: Text(t('action.continue')))],
    ));
  }
}

class _WelcomeCard extends StatelessWidget {
  const _WelcomeCard({required this.name, required this.subtitle, required this.brand});
  final String name;
  final String subtitle;
  final String brand;

  @override
  Widget build(BuildContext context) => Container(
    decoration: BoxDecoration(color: _green, borderRadius: BorderRadius.circular(22)),
    padding: const EdgeInsets.all(20),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(subtitle, style: const TextStyle(color: Colors.white70)),
      const SizedBox(height: 6),
      Text(name, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Colors.white, fontSize: 23, fontWeight: FontWeight.w700)),
      const SizedBox(height: 8),
      Text(brand, style: TextStyle(color: Colors.white.withValues(alpha: .9))),
    ]),
  );
}

class _ProfileCard extends StatelessWidget {
  const _ProfileCard({required this.profile, required this.locale, required this.onOpen});
  final StudentProfileDraft profile;
  final LocaleController locale;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    final t = locale.text;
    final ready = profile.profileStatus == 'active' && profile.consentStatus == GuardianConsentStatus.recorded;
    return Card(color: Colors.white, child: Padding(padding: const EdgeInsets.all(14), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [const CircleAvatar(backgroundColor: _ivory, child: Icon(Icons.person_outline, color: _green)), const SizedBox(width: 12),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(profile.preferredName, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 17)),
          Text(t(profile.ageGroup == StudentAgeGroup.child ? 'age.child' : 'age.youth')),
        ])),
        Icon(ready ? Icons.verified_user_outlined : Icons.lock_outline, color: ready ? _green : _saffron),
      ]),
      const SizedBox(height: 8),
      Text('${t('family.consentStatus')}: ${_consentText(t, profile.consentStatus)}'),
      const SizedBox(height: 8),
      OutlinedButton.icon(onPressed: ready ? onOpen : null, icon: const Icon(Icons.open_in_new), label: Text(t(ready ? 'dashboard.openStudentView' : 'dashboard.awaitConsent'))),
    ])));
  }
}

class _MessageCard extends StatelessWidget {
  const _MessageCard({required this.icon, required this.title, required this.body, required this.color, this.onTap});
  final IconData icon;
  final String title;
  final String body;
  final Color color;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => Card(color: Colors.white, child: InkWell(onTap:onTap,borderRadius:BorderRadius.circular(12),child: Padding(padding: const EdgeInsets.all(16), child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
    Icon(icon, color: color, size: 26), const SizedBox(width: 12),
    Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(title, style: const TextStyle(fontWeight: FontWeight.w700, color: _forest)),
      const SizedBox(height: 5), Text(body, softWrap: true),
    ])),
  ]))));
}

class _FeaturePage extends StatelessWidget {
  const _FeaturePage({required this.title, required this.icon, required this.heading, required this.body, required this.action});
  final String title;
  final IconData icon;
  final String heading;
  final String body;
  final String action;

  @override
  Widget build(BuildContext context) => ListView(padding: const EdgeInsets.all(20), children: [
    const SizedBox(height: 24),
    Icon(icon, size: 54, color: _green),
    const SizedBox(height: 12),
    Text(title, textAlign: TextAlign.center, style: Theme.of(context).textTheme.headlineSmall),
    const SizedBox(height: 20),
    _MessageCard(icon: Icons.hourglass_empty, title: heading, body: body, color: _saffron),
    const SizedBox(height: 12),
    Center(child: Chip(avatar: const Icon(Icons.info_outline, size: 18), label: Text(action))),
  ]);
}

String _consentText(String Function(String) t, GuardianConsentStatus status) => switch (status) {
  GuardianConsentStatus.policyNotConfigured => t('family.consentPolicyMissing'),
  GuardianConsentStatus.notRecorded => t('family.consentNotRecorded'),
  GuardianConsentStatus.pendingVerification => t('consent.statusPending'),
  GuardianConsentStatus.recorded => t('consent.statusRecorded'),
  GuardianConsentStatus.revoked => t('consent.statusRevoked'),
};
