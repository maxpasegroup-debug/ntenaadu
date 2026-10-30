import 'package:flutter/material.dart';
import '../localization/locale_controller.dart';
import '../onboarding/onboarding_models.dart';
import '../learning/learning_repository.dart';
import '../learning/learning_screens.dart';
import 'programme_models.dart';
import 'programme_repository.dart';
import '../payments/payment_repository.dart';
import '../payments/payment_screens.dart';

const _forest = Color(0xFF263A30), _green = Color(0xFF4C8B69), _saffron = Color(0xFFF3A66B), _ivory = Color(0xFFF6F3EC);

class ProgrammeLandingTab extends StatefulWidget {
  const ProgrammeLandingTab({required this.locale, required this.repository, required this.learningRepository, required this.paymentRepository, required this.students, this.studentProfileId, this.studentView = false, this.onReportConcern, super.key});
  final LocaleController locale;
  final ProgrammeRepository repository;
  final LearningRepository learningRepository;
  final PaymentRepository paymentRepository;
  final List<StudentProfileDraft> students;
  final String? studentProfileId;
  final bool studentView;
  final VoidCallback? onReportConcern;
  @override State<ProgrammeLandingTab> createState() => _ProgrammeLandingTabState();
}

class _ProgrammeLandingTabState extends State<ProgrammeLandingTab> {
  late final TextEditingController _search;
  List<ProgrammeSummary> _items = const [];
  String? _profileId;
  bool _loading = true;
  bool _failed = false;
  @override void initState() { super.initState(); _profileId = widget.studentProfileId; _search = TextEditingController(); _load(); }
  @override void didUpdateWidget(covariant ProgrammeLandingTab oldWidget) { super.didUpdateWidget(oldWidget); if (oldWidget.studentProfileId != widget.studentProfileId || oldWidget.locale.locale != widget.locale.locale) { _profileId = widget.studentProfileId; _load(); } }
  @override void dispose() { _search.dispose(); super.dispose(); }
  Future<void> _load() async {
    setState(() { _loading = true; _failed = false; });
    try { final result = await widget.repository.list(query: _search.text, studentProfileId: _profileId); if (mounted) setState(() { _items = result; _loading = false; }); }
    catch (_) { if (mounted) setState(() { _failed = true; _loading = false; }); }
  }
  @override Widget build(BuildContext context) {
    final t = widget.locale.text;
    final eligible = widget.students.where((s) => s.persisted && s.profileStatus == 'active' && s.consentStatus == GuardianConsentStatus.recorded).toList(growable: false);
    return ListView(padding: const EdgeInsets.fromLTRB(18, 16, 18, 26), children: [
      Container(padding: const EdgeInsets.all(18), decoration: BoxDecoration(color: _green, borderRadius: BorderRadius.circular(20)), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(t('programme.growEyebrow'), style: const TextStyle(color: Colors.white70)), const SizedBox(height: 6),
        Text(t('programme.growTitle'), style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w700)), const SizedBox(height: 8),
        Text(t('programme.growIntro'), style: const TextStyle(color: Colors.white)),
      ])),
      const SizedBox(height: 14),
      _Notice(text: '${t('programme.dreamTitle')}\n${t('programme.dreamIntro')}'),
      if (!widget.studentView) Align(alignment: AlignmentDirectional.centerStart, child: TextButton.icon(onPressed: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => PaymentHistoryScreen(locale: widget.locale, repository: widget.paymentRepository))), icon: const Icon(Icons.receipt_long_outlined), label: Text(t('payment.historyTitle')))),
      if (!widget.studentView && eligible.isNotEmpty) ...[
        const SizedBox(height: 14), Text(t('programme.chooseLearner'), style: Theme.of(context).textTheme.titleSmall),
        DropdownButtonFormField<String>(value: _profileId, isExpanded: true, decoration: const InputDecoration(filled: true, fillColor: Colors.white),
          items: [DropdownMenuItem<String>(value: null, child: Text(t('programme.browseOnly'))), ...eligible.map((s) => DropdownMenuItem(value: s.localId, child: Text(s.preferredName)))],
          onChanged: (value) { setState(() => _profileId = value); _load(); }),
      ],
      if (!widget.studentView && eligible.isEmpty) ...[const SizedBox(height: 10), _Notice(text: t('programme.learnerNeeded'))],
      const SizedBox(height: 18), Text(t('programme.catalogueTitle'), style: Theme.of(context).textTheme.titleLarge),
      const SizedBox(height: 8), TextField(controller: _search, textInputAction: TextInputAction.search, onSubmitted: (_) => _load(), decoration: InputDecoration(hintText: t('programme.searchHint'), prefixIcon: const Icon(Icons.search), filled: true, fillColor: Colors.white, suffixIcon: IconButton(tooltip: t('learning.searchAction'), icon: const Icon(Icons.arrow_forward), onPressed: _load))),
      const SizedBox(height: 12),
      if (_loading) const Padding(padding: EdgeInsets.all(28), child: Center(child: CircularProgressIndicator()))
      else if (_failed) _Notice(text: t('programme.loadError'), action: TextButton.icon(onPressed: _load, icon: const Icon(Icons.refresh), label: Text(t('action.retry'))))
      else if (_items.isEmpty) _Notice(text: '${t('programme.dreamNotPublished')}\n${t('programme.empty')}')
      else ..._items.map((p) => Card(color: Colors.white, child: InkWell(borderRadius: BorderRadius.circular(12), onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => ProgrammeDetailScreen(locale: widget.locale, repository: widget.repository, learningRepository: widget.learningRepository, paymentRepository: widget.paymentRepository, programmeId: p.id, studentProfileId: _profileId, onReportConcern: widget.onReportConcern))), child: Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [Expanded(child: Text(p.title, style: const TextStyle(color: _forest, fontWeight: FontWeight.w700, fontSize: 17))), const Icon(Icons.chevron_right, color: _green)]),
        const SizedBox(height: 6), Text(p.description, maxLines: 3, overflow: TextOverflow.ellipsis), const SizedBox(height: 10),
        Wrap(spacing: 8, runSpacing: 6, children: [Chip(label: Text(t(p.access != 'paid' ? 'programme.freeAccess' : p.accessStatus == 'available' ? 'programme.paidAccess' : 'programme.paidPurchase'))), if (p.activityCount > 0) Chip(label: Text(t('programme.activityCount', {'count': p.activityCount}))), if (p.enrollmentStatus != null) Chip(label: Text(t(p.enrollmentStatus == 'completed' ? 'programme.programmeCompleteShort' : 'programme.enrolled')))]),
        Text(t('programme.languagesAvailable', {'languages': p.languages.map((code) => _languageName(code, t)).join(', ')}), style: Theme.of(context).textTheme.bodySmall),
      ]))))),
      if (_items.isNotEmpty && !_items.any((p) => p.id.toLowerCase() == 'dream_addiction' || p.title.toLowerCase().contains('dream addiction'))) ...[
        const SizedBox(height: 14), _Notice(text: t('programme.dreamNotPublished')),
      ],
    ]);
  }
}

class ProgrammeDetailScreen extends StatefulWidget {
  const ProgrammeDetailScreen({required this.locale, required this.repository, required this.learningRepository, required this.paymentRepository, required this.programmeId, this.studentProfileId, this.onReportConcern, super.key});
  final LocaleController locale; final ProgrammeRepository repository; final LearningRepository learningRepository; final PaymentRepository paymentRepository; final String programmeId; final String? studentProfileId; final VoidCallback? onReportConcern;
  @override State<ProgrammeDetailScreen> createState() => _ProgrammeDetailScreenState();
}
class _ProgrammeDetailScreenState extends State<ProgrammeDetailScreen> {
  ProgrammeDetails? _details; bool _loading = true, _failed = false, _busy = false;
  @override void initState() { super.initState(); _load(); }
  Future<void> _load() async { setState(() { _loading = true; _failed = false; }); try { final value = await widget.repository.details(widget.programmeId, studentProfileId: widget.studentProfileId); if (mounted) setState(() { _details = value; _loading = false; }); } catch (_) { if (mounted) setState(() { _failed = true; _loading = false; }); } }
  Future<void> _enroll() async {
    final t = widget.locale.text; final profileId = widget.studentProfileId; if (profileId == null) return;
    setState(() => _busy = true);
    try { await widget.repository.enroll(widget.programmeId, profileId); await _load(); }
    catch (_) { if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(t('programme.enrollError')))); }
    if (mounted) setState(() => _busy = false);
  }
  Future<void> _progress(ProgrammeActivity activity, String status) async {
    final t = widget.locale.text; final profileId = widget.studentProfileId; if (profileId == null) return;
    setState(() => _busy = true);
    try { await widget.repository.updateActivity(widget.programmeId, activity.id, profileId, status); await _load(); }
    catch (_) { if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(t('programme.progressError')))); }
    if (mounted) setState(() => _busy = false);
  }
  @override Widget build(BuildContext context) {
    final t = widget.locale.text;
    return Scaffold(backgroundColor: _ivory, appBar: AppBar(backgroundColor: _ivory, foregroundColor: _forest, title: Text(t('programme.detailTitle')), actions: [if (widget.onReportConcern != null) IconButton(tooltip: t('safeguarding.reportTitle'), onPressed: widget.onReportConcern, icon: const Icon(Icons.shield_outlined))]),
      body: _loading ? const Center(child: CircularProgressIndicator()) : _failed || _details == null
        ? Center(child: Column(mainAxisSize: MainAxisSize.min, children: [Text(t('programme.loadError')), TextButton(onPressed: _load, child: Text(t('action.retry')))]))
        : ListView(padding: const EdgeInsets.all(18), children: [
          Text(_details!.programme.title, style: Theme.of(context).textTheme.headlineSmall?.copyWith(color: _forest, fontWeight: FontWeight.w700)), const SizedBox(height: 8),
          Text(_details!.programme.description), const SizedBox(height: 12),
          Text(t('programme.languagesAvailable', {'languages': _details!.programme.languages.map((code) => _languageName(code, t)).join(', ')})),
          if (_details!.programme.ageBands.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 6), child: Text(t('programme.ageEligibility', {'ages': _details!.programme.ageBands.map((band) => t(band == 'child' ? 'age.child' : 'age.youth')).join(', ')}))),
          if (_details!.programme.durationMinutes != null) Padding(padding: const EdgeInsets.only(top: 6), child: Text(t('programme.duration', {'minutes': _details!.programme.durationMinutes}))),
          if (_details!.programme.objectives.isNotEmpty) ...[
            const SizedBox(height: 12), Text(t('programme.objectivesTitle'), style: Theme.of(context).textTheme.titleMedium),
            ..._details!.programme.objectives.map((objective) => Padding(padding: const EdgeInsets.only(top: 4), child: Text('• $objective'))),
          ],
          if (_details!.programme.access == 'paid' && _details!.programme.accessStatus != 'available' && widget.studentProfileId != null) ...[
            const SizedBox(height: 12), FilledButton.tonalIcon(onPressed: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => PurchaseReviewScreen(locale: widget.locale, repository: widget.paymentRepository, programmeId: widget.programmeId, studentProfileId: widget.studentProfileId!))), icon: const Icon(Icons.lock_open_outlined), label: Text(t('payment.reviewPurchase'))),
          ] else if (_details!.programme.access == 'paid' && widget.studentProfileId == null) ...[
            const SizedBox(height: 12), _Notice(text: t('programme.chooseLearnerToEnroll')),
          ] else if (widget.studentProfileId != null && _details!.enrollmentStatus == null) ...[
            const SizedBox(height: 14), FilledButton(onPressed: _busy ? null : _enroll, child: Text(_busy ? t('status.loading') : t('programme.enroll'))),
          ] else if (_details!.enrollmentStatus != null) ...[
            const SizedBox(height: 14), LinearProgressIndicator(value: _details!.activities.isEmpty ? 0 : _details!.activities.where((a) => a.status == 'completed').length / _details!.activities.length),
            const SizedBox(height: 5), Text(t(_details!.enrollmentStatus == 'completed' ? 'programme.programmeCompleteGuardian' : 'programme.enrolled')),
          ],
          const SizedBox(height: 20), Text(t('programme.activitiesTitle'), style: Theme.of(context).textTheme.titleLarge),
          ..._details!.modules.map((module) => Padding(padding: const EdgeInsets.only(top: 12), child: _Notice(text: '${module.title}\n${module.description}'))),
          if (_details!.programme.access == 'paid' && _details!.programme.accessStatus != 'available') Padding(padding: const EdgeInsets.only(top: 10), child: _Notice(text: t('programme.lockedUntilPayment')))
          else if (_details!.activities.isEmpty) Padding(padding: const EdgeInsets.only(top: 10), child: _Notice(text: t('programme.noActivities')))
          else ..._details!.activities.map((a) => Card(color: Colors.white, child: Padding(padding: const EdgeInsets.all(15), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(a.title, style: const TextStyle(fontWeight: FontWeight.w700)), const SizedBox(height: 5), Text(a.description),
            if (a.learningContentId != null) Padding(padding: const EdgeInsets.only(top: 6), child: OutlinedButton.icon(onPressed: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => LearningContentDetailScreen(contentId: a.learningContentId!, locale: widget.locale, repository: widget.learningRepository, studentProfileId: widget.studentProfileId))), icon: const Icon(Icons.play_circle_outline), label: Text(t(a.status == 'in_progress' ? 'programme.continueActivity' : 'programme.openActivity')))),
            if (_details!.enrollmentStatus == 'active') Wrap(spacing: 8, children: [
              TextButton(onPressed: _busy ? null : () => _progress(a, 'in_progress'), child: Text(t('programme.markInProgress'))),
              TextButton.icon(onPressed: _busy ? null : () => _progress(a, 'completed'), icon: const Icon(Icons.check_circle_outline), label: Text(t(a.status == 'completed' ? 'programme.activityComplete' : 'programme.markComplete'))),
            ]),
            if (a.status == 'completed') Text(t('programme.guardianRecorded'), style: const TextStyle(color: _green)),
          ])))),
          if (widget.studentProfileId == null) ...[const SizedBox(height: 12), _Notice(text: t('programme.chooseLearnerToEnroll'))],
          if (_details!.programme.id.toLowerCase() == 'dream_addiction' || _details!.programme.title.toLowerCase().contains('dream addiction')) ...[
            const SizedBox(height: 14), _Notice(text: t('programme.goalPrivacyUnavailable')),
          ],
        ]));
  }
}

class _Notice extends StatelessWidget {
  const _Notice({required this.text, this.action}); final String text; final Widget? action;
  @override Widget build(BuildContext context) => Card(color: Colors.white, child: Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(text, style: const TextStyle(color: _forest)), if (action != null) action!])));
}
String _languageName(String code, String Function(String) t) => switch (code) { 'hi' => t('programme.language.hi'), 'ml' => t('programme.language.ml'), 'ta' => t('programme.language.ta'), 'en' => t('programme.language.en'), _ => code };
