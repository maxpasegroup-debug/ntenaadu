import 'package:flutter/material.dart';
import '../localization/language_picker.dart';
import '../localization/locale_controller.dart';
import '../onboarding/onboarding_session.dart';
import '../clubs/club_screens.dart';
import '../events/event_screens.dart';
import '../admin/admin_repository.dart';

const _forest = Color(0xFF263A30), _green = Color(0xFF4C8B69), _saffron = Color(0xFFF3A66B), _ivory = Color(0xFFF6F3EC);

class AdminConsoleScreen extends StatefulWidget {
  const AdminConsoleScreen({required this.locale, required this.session, super.key});
  final LocaleController locale;
  final OnboardingSession session;
  @override State<AdminConsoleScreen> createState() => _AdminConsoleScreenState();
}

class _AdminConsoleScreenState extends State<AdminConsoleScreen> {
  int _index = 0;
  String t(String key) => widget.locale.text(key);
  AdminRepository? get repo => widget.session.adminRepository;
  Set<String> get roles => widget.session.staffRoles.toSet();
  List<_AdminSection> get sections => [
    _AdminSection('admin.overview', Icons.dashboard_outlined, _overview),
    if (roles.contains('platform_admin')) _AdminSection('admin.members', Icons.people_outline, _members),
    if (roles.contains('club_reviewer') || roles.contains('club_moderator')) _AdminSection('admin.clubs', Icons.groups_outlined, _clubs),
    if (roles.contains('event_manager')) _AdminSection('admin.events', Icons.event_outlined, _events),
    if (roles.contains('content_editor') || roles.contains('content_reviewer')) _AdminSection('admin.content', Icons.menu_book_outlined, _content),
    if (roles.contains('finance_support')) _AdminSection('admin.finance', Icons.receipt_long_outlined, _finance),
    if (roles.contains('safeguarding_lead') || roles.contains('safeguarding_backup')) _AdminSection('admin.safeguarding', Icons.shield_outlined, _safeguarding),
    if (roles.contains('platform_admin') || roles.contains('auditor')) _AdminSection('admin.audit', Icons.history, _audit),
  ];
  @override Widget build(BuildContext context) => AnimatedBuilder(animation: Listenable.merge([widget.session, widget.locale]), builder: (context, _) {
    final menu = sections;
    if (_index >= menu.length) _index = 0;
    final wide = MediaQuery.sizeOf(context).width >= 720;
    return Scaffold(backgroundColor: _ivory, appBar: AppBar(backgroundColor: _ivory, foregroundColor: _forest, title: Text(t('admin.title')), actions: [LanguagePickerButton(controller: widget.locale, compact: true, onLanguageChanged: widget.session.syncLanguagePreference), IconButton(tooltip: t('action.retry'), onPressed: widget.session.refreshStaffRoles, icon: const Icon(Icons.refresh))]),
      body: Row(children: [if (wide) NavigationRail(selectedIndex: _index, onDestinationSelected: (i) => setState(() => _index = i), labelType: NavigationRailLabelType.all, destinations: [for (final item in menu) NavigationRailDestination(icon: Icon(item.icon), label: Text(t(item.key)))]), Expanded(child: Center(child: ConstrainedBox(constraints: const BoxConstraints(maxWidth: 900), child: menu.isEmpty ? _state(t('admin.noAccess'), t('admin.noAccessBody')) : menu[_index].builder())))]),
      bottomNavigationBar: wide || menu.isEmpty ? null : NavigationBar(selectedIndex: _index >= 4 ? 4 : _index, onDestinationSelected: (i) { if (i < 4) { setState(() => _index = i); return; } showModalBottomSheet<void>(context: context, builder: (ctx) => SafeArea(child: ListView(shrinkWrap: true, children: [for (var n = 4; n < menu.length; n++) ListTile(leading: Icon(menu[n].icon), title: Text(t(menu[n].key)), onTap: () { Navigator.pop(ctx); setState(() => _index = n); })]))); }, destinations: [for (final item in menu.take(4)) NavigationDestination(icon: Icon(item.icon), label: t(item.key)), if (menu.length > 4) NavigationDestination(icon: const Icon(Icons.more_horiz), label: t('admin.more'))]));
  });
  Widget _overview() => _RemoteList(load: (_) async { final counts = await repo!.overview(); return counts.entries.map((e) => _RowData(t('admin.metric.${e.key}'), '${e.value}')).toList(); }, title: t('admin.overview'), text: t('admin.overviewHelp'), locale: widget.locale);
  Widget _members() => _MembersPage(locale: widget.locale, repo: repo!);
  Widget _safeguarding() => _SafeguardingQueue(locale: widget.locale, repo: repo!, accountId: widget.session.account?.id ?? '', canManage: roles.contains('safeguarding_lead'));
  Widget _audit() => _RemoteList(load: (filter) async { final p = filter.split('|'); return (await repo!.audit(eventType: p.isNotEmpty ? p[0] : '', actorId: p.length > 1 ? p[1] : '', from: p.length > 2 ? p[2] : '', to: p.length > 3 ? p[3] : '', offset: p.length > 4 ? int.tryParse(p[4]) ?? 0 : 0)).map((e) => _RowData('${e['eventType']}', '${e['occurredAt'] ?? ''}\n${e['requestId'] ?? ''}')).toList(); }, title: t('admin.audit'), text: t('admin.auditHelp'), locale: widget.locale, searchable: true);
  Widget _content() => _ContentPage(locale: widget.locale, repo: repo!, roleSet: roles);
  Widget _clubs() => ClubLandingTab(locale: widget.locale, repository: widget.session.clubRepository, students: widget.session.serverStudents, eventRepository: widget.session.eventRepository, onReportConcern: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => SafeguardingReportScreen(locale: widget.locale, repository: repo!))));
  Widget _events() => EventsScreen(locale: widget.locale, repository: widget.session.eventRepository, students: widget.session.serverStudents, onReportConcern: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => SafeguardingReportScreen(locale: widget.locale, repository: repo!))));
  Widget _finance() => _FinancePage(locale: widget.locale, repo: repo!);
  Widget _state(String title, String body) => Center(child: Padding(padding: const EdgeInsets.all(24), child: Card(color: Colors.white, child: Padding(padding: const EdgeInsets.all(20), child: Column(mainAxisSize: MainAxisSize.min, children: [Icon(Icons.lock_outline, color: _green, size: 34), const SizedBox(height: 12), Text(title, style: const TextStyle(fontWeight: FontWeight.bold, color: _forest)), const SizedBox(height: 8), Text(body, textAlign: TextAlign.center)])))));
}

class _AdminSection { const _AdminSection(this.key, this.icon, this.builder); final String key; final IconData icon; final Widget Function() builder; }
class _RowData { const _RowData(this.title, this.body); final String title, body; }

class _RemoteList extends StatefulWidget {
  const _RemoteList({required this.load, required this.title, required this.text, required this.locale, this.searchable = false});
  final Future<List<_RowData>> Function(String filter) load; final String title, text; final LocaleController locale; final bool searchable;
  @override State<_RemoteList> createState() => _RemoteListState();
}
class _RemoteListState extends State<_RemoteList> {
  List<_RowData> _rows = []; bool _loading = true, _failed = false; int _offset = 0; bool _hasMore = false; final _query = TextEditingController(), _actor = TextEditingController(), _from = TextEditingController(), _to = TextEditingController();
  @override void initState() { super.initState(); _load(); }
  Future<void> _load({bool more = false}) async { final nextOffset = more ? _offset : 0; setState(() { _loading = true; _failed = false; if (!more) _rows = []; }); try { final rows = await widget.load('${_query.text.trim()}|${_actor.text.trim()}|${_from.text.trim()}|${_to.text.trim()}|$nextOffset'); if (mounted) setState(() { _rows = [..._rows, ...rows]; _offset = nextOffset + rows.length; _hasMore = rows.length == 50; _loading = false; }); } catch (_) { if (mounted) setState(() { _loading = false; _failed = true; }); } }
  @override Widget build(BuildContext context) { final t = widget.locale.text; return RefreshIndicator(onRefresh: _load, child: ListView(padding: const EdgeInsets.all(16), children: [Text(widget.title, style: Theme.of(context).textTheme.headlineSmall?.copyWith(color: _forest, fontWeight: FontWeight.bold)), const SizedBox(height: 6), Text(widget.text), if (widget.searchable) ...[TextField(controller: _query, decoration: InputDecoration(labelText: t('admin.auditFilter'))), TextField(controller: _actor, decoration: InputDecoration(labelText: t('admin.auditActor'))), TextField(controller: _from, decoration: InputDecoration(labelText: t('admin.auditFrom'))), TextField(controller: _to, decoration: InputDecoration(labelText: t('admin.auditTo'))), Align(alignment: AlignmentDirectional.centerEnd, child: TextButton.icon(onPressed: _load, icon: const Icon(Icons.search), label: Text(t('action.search'))))], const SizedBox(height: 14), if (_loading && _rows.isEmpty) const Center(child: Padding(padding: EdgeInsets.all(28), child: CircularProgressIndicator())) else if (_failed) Card(color: Colors.white, child: ListTile(title: Text(t('admin.loadFailed')), subtitle: Text(t('admin.loadFailedBody')), trailing: IconButton(onPressed: _load, icon: const Icon(Icons.refresh)))) else if (_rows.isEmpty) Card(color: Colors.white, child: ListTile(title: Text(t('admin.empty')))) else ...[for (final row in _rows) Card(color: Colors.white, child: ListTile(title: Text(row.title, style: const TextStyle(fontWeight: FontWeight.w700, color: _forest)), subtitle: Text(row.body, softWrap: true))), if (_hasMore) Align(alignment: AlignmentDirectional.center, child: TextButton(onPressed: _loading ? null : () => _load(more: true), child: Text(t('admin.loadMore'))))]])); }
}

class _MembersPage extends StatefulWidget { const _MembersPage({required this.locale, required this.repo}); final LocaleController locale; final AdminRepository repo; @override State<_MembersPage> createState() => _MembersPageState(); }
class _MembersPageState extends State<_MembersPage> {
  final _query = TextEditingController(); List<Map<String,dynamic>> _members = []; bool _busy = true, _failed = false, _hasMore = false; int _offset = 0; String _statusFilter = 'all';
  String t(String k) => widget.locale.text(k);
  @override void initState() { super.initState(); _load(); }
  Future<void> _load({bool more = false}) async { final offset = more ? _offset : 0; setState(() { _busy = true; _failed = false; if (!more) _members = []; }); try { final rows = await widget.repo.members(query: _query.text.trim(), status: _statusFilter == 'all' ? '' : _statusFilter, offset: offset); if (mounted) setState(() { _members = [..._members, ...rows]; _offset = offset + rows.length; _hasMore = rows.length == 100; _busy = false; }); } catch (_) { if (mounted) setState(() { _failed = true; _busy = false; }); } }
  Future<void> _status(Map<String,dynamic> row) async { final reason = TextEditingController(); final next = row['accountStatus'] == 'active' ? 'suspended' : 'active'; final ok = await showDialog<bool>(context: context, builder: (ctx) => AlertDialog(title: Text(t('admin.memberStatusTitle')), content: TextField(controller: reason, minLines: 2, maxLines: 4, decoration: InputDecoration(labelText: t('admin.reason'))), actions: [TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text(t('action.cancel'))), FilledButton(onPressed: () => Navigator.pop(ctx, true), child: Text(t('action.save')))])); if (ok != true || reason.text.trim().length < 5) return; try { await widget.repo.setMemberStatus('${row['id']}', next, reason.text.trim()); await _load(); } catch (_) { if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(t('admin.actionFailed')))); } }
  @override Widget build(BuildContext context) => RefreshIndicator(onRefresh: _load, child: ListView(padding: const EdgeInsets.all(16), children: [Text(t('admin.members'), style: Theme.of(context).textTheme.headlineSmall?.copyWith(color: _forest, fontWeight: FontWeight.bold)), Text(t('admin.membersHelp')), const SizedBox(height: 12), TextField(controller: _query, onSubmitted: (_) => _load(), decoration: InputDecoration(labelText: t('admin.memberSearch'), suffixIcon: IconButton(onPressed: _load, icon: const Icon(Icons.search)))), DropdownButtonFormField<String>(value: _statusFilter, decoration: InputDecoration(labelText: t('admin.accountStatusFilter')), items: ['all','active','suspended'].map((s) => DropdownMenuItem(value: s, child: Text(t('admin.accountStatus.$s')))).toList(), onChanged: (v) { setState(() => _statusFilter = v ?? 'all'); _load(); }), if (_busy && _members.isEmpty) const Center(child: Padding(padding: EdgeInsets.all(25), child: CircularProgressIndicator())) else if (_failed) TextButton.icon(onPressed: _load, icon: const Icon(Icons.refresh), label: Text(t('admin.loadFailed'))) else if (_members.isEmpty) Text(t('admin.empty')) else ...[..._members.map((m) { final family = m['family'] is Map ? Map<String,dynamic>.from(m['family']) : <String,dynamic>{}; final students = family['students'] is List ? (family['students'] as List) : const []; return Card(color: Colors.white, child: ExpansionTile(title: Text('${m['name'] ?? ''}', style: const TextStyle(fontWeight: FontWeight.bold)), subtitle: Text('${m['contact'] ?? ''} · ${m['accountStatus'] ?? ''} · ${m['verificationStatus'] ?? ''}'), children: [for (final raw in students.whereType<Map>()) ListTile(dense: true, leading: const Icon(Icons.child_care, color: _green), title: Text('${raw['preferredName'] ?? ''} (${raw['ageGroup'] ?? ''})'), subtitle: Text('${raw['consentStatus'] ?? 'not_recorded'} · ${raw['profileStatus'] ?? ''}')), Align(alignment: AlignmentDirectional.centerEnd, child: TextButton(onPressed: () => _status(m), child: Text(t('admin.changeStatus'))))])); }), if (_hasMore) Align(alignment: AlignmentDirectional.center, child: TextButton(onPressed: _busy ? null : () => _load(more: true), child: Text(t('admin.loadMore'))))]]));
}

class _SafeguardingQueue extends StatefulWidget { const _SafeguardingQueue({required this.locale, required this.repo, required this.accountId, required this.canManage}); final LocaleController locale; final AdminRepository repo; final String accountId; final bool canManage; @override State<_SafeguardingQueue> createState() => _SafeguardingQueueState(); }
class _SafeguardingQueueState extends State<_SafeguardingQueue> {
  List<Map<String,dynamic>> _cases = []; bool _busy = true, _failed = false, _hasMore = false; int _offset = 0; String t(String k) => widget.locale.text(k);
  @override void initState() { super.initState(); WidgetsBinding.instance.addPostFrameCallback((_) { if (mounted) _load(); }); }
  Future<String?> _reasonDialog(String title) async { final controller = TextEditingController(); return showDialog<String>(context: context, builder: (ctx) => AlertDialog(title: Text(title), content: TextField(controller: controller, minLines: 2, maxLines: 4, decoration: InputDecoration(labelText: t('admin.reason'))), actions: [TextButton(onPressed: () => Navigator.pop(ctx), child: Text(t('action.cancel'))), FilledButton(onPressed: () => controller.text.trim().length < 5 ? null : Navigator.pop(ctx, controller.text.trim()), child: Text(t('action.continue')))])); }
  Future<void> _load({bool more = false}) async { final reason = await _reasonDialog(t('admin.queueAccessReason')); if (!mounted) return; if (reason == null) { if (_busy && _cases.isEmpty) setState(() => _busy = false); return; } final offset = more ? _offset : 0; setState(() { _busy = true; _failed = false; if (!more) _cases = []; }); try { final rows = await widget.repo.safeguardingQueue(reason, offset: offset); if (mounted) setState(() { _cases = [..._cases, ...rows]; _offset = offset + rows.length; _hasMore = rows.length == 50; _busy = false; }); } catch (_) { if (mounted) setState(() { _failed = true; _busy = false; }); } }
  Future<void> _open(String id) async { final reason = await _reasonDialog(t('admin.caseAccessReason')); if (reason == null) return; try { final item = await widget.repo.safeguardingCase(id, reason); if (!mounted) return; await showModalBottomSheet<void>(context: context, isScrollControlled: true, builder: (ctx) => _SafeguardingDetails(locale: widget.locale, repo: widget.repo, data: item, accountId: widget.accountId, canManage: widget.canManage, changed: _load)); } catch (_) { if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(t('admin.caseLoadFailed')))); } }
  @override Widget build(BuildContext context) => RefreshIndicator(onRefresh: _load, child: ListView(padding: const EdgeInsets.all(16), children: [Text(t('admin.safeguarding'), style: Theme.of(context).textTheme.headlineSmall?.copyWith(color: _forest, fontWeight: FontWeight.bold)), Text(t('admin.safeguardingHelp')), const SizedBox(height: 14), if (_busy && _cases.isEmpty) const Center(child: Padding(padding: EdgeInsets.all(26), child: CircularProgressIndicator())) else if (_failed) TextButton.icon(onPressed: _load, icon: const Icon(Icons.refresh), label: Text(t('admin.loadFailed'))) else if (_cases.isEmpty) Card(color: Colors.white, child: ListTile(title: Text(t('admin.noCases')))) else ...[..._cases.map((c) => Card(color: Colors.white, child: ListTile(leading: Icon(c['urgency'] == 'urgent' ? Icons.priority_high : Icons.shield_outlined, color: c['urgency'] == 'urgent' ? Colors.deepOrange : _green), title: Text('${c['category']} · ${c['status']}'), subtitle: Text('${c['urgency']} · ${c['createdAt']}'), trailing: const Icon(Icons.chevron_right), onTap: () => _open('${c['reportId']}'))), if (_hasMore) Align(alignment: AlignmentDirectional.center, child: TextButton(onPressed: _busy ? null : () => _load(more: true), child: Text(t('admin.loadMore'))))]]));
}

class _SafeguardingDetails extends StatefulWidget { const _SafeguardingDetails({required this.locale, required this.repo, required this.data, required this.accountId, required this.canManage, required this.changed}); final LocaleController locale; final AdminRepository repo; final Map<String,dynamic> data; final String accountId; final bool canManage; final VoidCallback changed; @override State<_SafeguardingDetails> createState() => _SafeguardingDetailsState(); }
class _SafeguardingDetailsState extends State<_SafeguardingDetails> {
  bool _working = false; String t(String k) => widget.locale.text(k);
  Future<void> _act(String action) async { final reason = TextEditingController(); final note = TextEditingController(); final yes = await showDialog<bool>(context: context, builder: (ctx) => AlertDialog(title: Text(t('admin.caseAction')), content: Column(mainAxisSize: MainAxisSize.min, children: [TextField(controller: reason, minLines: 2, maxLines: 4, decoration: InputDecoration(labelText: t('admin.reason'))), TextField(controller: note, minLines: 2, maxLines: 3, decoration: InputDecoration(labelText: t('admin.internalNote')))]), actions: [TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text(t('action.cancel'))), FilledButton(onPressed: () => Navigator.pop(ctx, true), child: Text(t('action.save'))])); if (yes != true || reason.text.trim().length < 5) return; setState(() => _working = true); try { await widget.repo.safeguardingAction('${widget.data['reportId']}', action, reason.text.trim(), note: note.text.trim(), assignedTo: action == 'assign' ? widget.accountId : null); if (mounted) { Navigator.pop(context); widget.changed(); } } catch (_) { if (mounted) setState(() => _working = false); } }
  @override Widget build(BuildContext context) { final reporter = widget.data['reporter'] is Map ? Map<String,dynamic>.from(widget.data['reporter']) : <String,dynamic>{}; return SafeArea(child: Padding(padding: const EdgeInsets.all(20), child: ListView(shrinkWrap: true, children: [Text(t('admin.caseDetails'), style: Theme.of(context).textTheme.titleLarge), Text('${widget.data['category']} · ${widget.data['urgency']} · ${widget.data['status']}'), const SizedBox(height: 12), Text('${t('admin.reporter')}: ${reporter['name'] ?? t('admin.unavailable')} · ${reporter['contact'] ?? ''}'), const SizedBox(height: 12), Text('${widget.data['description'] ?? ''}'), if (widget.data['notes'] is List) ...(widget.data['notes'] as List).whereType<Map>().map((n) => ListTile(title: Text('${n['body'] ?? ''}'), subtitle: Text(t('admin.internalNote')))), const SizedBox(height: 12), Wrap(spacing: 6, children: [for (final a in ['acknowledge','assign','escalate','resolve','close']) if (_validAction(a, '${widget.data['status']}')) OutlinedButton(onPressed: _working ? null : () => _act(a), child: Text(t('admin.action.$a')))]), if (_working) const Center(child: CircularProgressIndicator()), Text(t('admin.safeguardingConfidentiality'), style: const TextStyle(color: _forest))]))); }
  bool _validAction(String action, String status) {
    if (!widget.canManage && ['assign','resolve','close'].contains(action)) return false;
    if (action == 'acknowledge') return status == 'submitted';
    if (action == 'assign') return ['submitted','acknowledged','escalated'].contains(status);
    if (action == 'escalate') return ['submitted','acknowledged','assigned'].contains(status);
    if (action == 'resolve') return !['resolved','closed'].contains(status);
    if (action == 'close') return status == 'resolved';
    return false;
  }
}

class _ContentPage extends StatefulWidget { const _ContentPage({required this.locale, required this.repo, required this.roleSet}); final LocaleController locale; final AdminRepository repo; final Set<String> roleSet; @override State<_ContentPage> createState() => _ContentPageState(); }
class _ContentPageState extends State<_ContentPage> {
  List<Map<String,dynamic>> _items = [], _programmes = [], _topics = []; bool _busy = true, _failed = false; String t(String k) => widget.locale.text(k);
  @override void initState() { super.initState(); _load(); }
  Future<void> _load() async { setState(() { _busy = true; _failed = false; }); try { final values = await Future.wait([widget.repo.contentItems(), widget.repo.programmes(), widget.repo.topics()]); if (mounted) setState(() { _items = values[0]; _programmes = values[1]; _topics = values[2]; _busy = false; }); } catch (_) { if (mounted) setState(() { _failed = true; _busy = false; }); } }
  String _slug(String value) => value.toLowerCase().trim().replaceAll(RegExp(r'[^a-z0-9]+'), '-').replaceAll(RegExp(r'^-|-$'), '');
  Future<void> _author(String kind, {String? programmeId}) async {
    final id = TextEditingController();
    final title = TextEditingController();
    final description = TextEditingController();
    final asset = TextEditingController();
    final bands = <String>{'child', 'youth'};
    var language = 'en';
    var mediaType = 'audio';
    var access = 'free';

    final saved = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, update) => AlertDialog(
          title: Text(t('admin.create.$kind')),
          content: SizedBox(
            width: 520,
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  TextField(
                    controller: id,
                    decoration: InputDecoration(labelText: t('admin.identifier')),
                    onChanged: (value) {
                      if (title.text.isEmpty) title.text = value.replaceAll('-', ' ');
                    },
                  ),
                  TextField(controller: title, decoration: InputDecoration(labelText: t('admin.titleField'))),
                  TextField(controller: description, minLines: 2, maxLines: 4, decoration: InputDecoration(labelText: t('admin.descriptionField'))),
                  DropdownButtonFormField<String>(
                    value: language,
                    decoration: InputDecoration(labelText: t('admin.contentLanguage')),
                    items: ['en', 'hi', 'ml', 'ta'].map((value) => DropdownMenuItem(value: value, child: Text(value.toUpperCase()))).toList(),
                    onChanged: (value) => update(() => language = value ?? 'en'),
                  ),
                  if (kind == 'content') ...[
                    DropdownButtonFormField<String>(
                      value: mediaType,
                      decoration: InputDecoration(labelText: t('admin.mediaType')),
                      items: ['audio', 'video'].map((value) => DropdownMenuItem(value: value, child: Text(value))).toList(),
                      onChanged: (value) => update(() => mediaType = value ?? 'audio'),
                    ),
                    TextField(controller: asset, decoration: InputDecoration(labelText: t('admin.assetKey'))),
                    DropdownButtonFormField<String>(
                      value: access,
                      decoration: InputDecoration(labelText: t('admin.access')),
                      items: ['free', 'paid'].map((value) => DropdownMenuItem(value: value, child: Text(value))).toList(),
                      onChanged: (value) => update(() => access = value ?? 'free'),
                    ),
                  ],
                  if (kind == 'programme')
                    Padding(
                      padding: const EdgeInsets.only(top: 8),
                      child: Align(
                        alignment: AlignmentDirectional.centerStart,
                        child: Text(t('admin.paidProgrammesUnavailable')),
                      ),
                    ),
                  if (['content', 'programme', 'activity'].contains(kind))
                    for (final band in ['child', 'youth'])
                      CheckboxListTile(
                        value: bands.contains(band),
                        title: Text(t('age.$band')),
                        onChanged: (value) => update(() => value == true ? bands.add(band) : bands.remove(band)),
                      ),
                ],
              ),
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text(t('action.cancel'))),
            FilledButton(onPressed: () => Navigator.pop(ctx, true), child: Text(t('action.save'))),
          ],
        ),
      ),
    );
    if (saved != true) return;
    final itemId = _slug(id.text);
    if (itemId.length < 2 || title.text.trim().isEmpty || (kind != 'topic' && description.text.trim().length < 5)) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(t('admin.formInvalid'))));
      return;
    }
    try {
      if (kind == 'topic') await widget.repo.createTopic(itemId, title.text.trim());
      if (kind == 'content') await widget.repo.createContent({
        'contentId': itemId, 'contentGroupId': itemId, 'title': title.text.trim(), 'description': description.text.trim(),
        'contentLanguage': language, 'mediaType': mediaType, 'mediaAssetKey': asset.text.trim(), 'ageBands': bands.toList(),
        'accessRequirement': access, 'topicIds': [], 'learningObjectives': [],
      });
      if (kind == 'programme') await widget.repo.createProgramme({
        'programmeId': itemId, 'title': title.text.trim(), 'description': description.text.trim(),
        'contentLanguage': language, 'ageBands': bands.toList(), 'accessRequirement': 'free', 'learningObjectives': [],
      });
      if (kind == 'module' && programmeId != null) await widget.repo.createModule(programmeId, {
        'moduleId': itemId, 'title': title.text.trim(), 'description': description.text.trim(), 'contentLanguage': language,
      });
      if (kind == 'activity' && programmeId != null) await widget.repo.createActivity(programmeId, {
        'activityId': itemId, 'title': title.text.trim(), 'description': description.text.trim(),
        'contentLanguage': language, 'ageBands': bands.toList(),
      });
      await _load();
    } catch (_) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(t('admin.actionFailed'))));
    }
  }
  Future<void> _change(Map<String,dynamic> item, bool programme, String status) async { final reason = TextEditingController(); final yes = await showDialog<bool>(context: context, builder: (ctx) => AlertDialog(title: Text(t('admin.publicationReason')), content: TextField(controller: reason, minLines: 2, maxLines: 4, decoration: InputDecoration(labelText: t('admin.reason'))), actions: [TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text(t('action.cancel'))), FilledButton(onPressed: () => Navigator.pop(ctx, true), child: Text(t('action.save')))])); if (yes != true || reason.text.trim().length < 5) return; try { if (programme) await widget.repo.setProgrammeStatus('${item['id']}', status, reason.text.trim()); else await widget.repo.setContentStatus('${item['id']}', status, reason.text.trim()); await _load(); } catch (_) { if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(t('admin.actionFailed')))); } }
  Future<void> _changeTopic(String id, String status) async { final reason = TextEditingController(); final ok = await showDialog<bool>(context: context, builder: (ctx) => AlertDialog(title: Text(t('admin.publicationReason')), content: TextField(controller: reason, decoration: InputDecoration(labelText: t('admin.reason'))), actions: [TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text(t('action.cancel'))), FilledButton(onPressed: () => Navigator.pop(ctx, true), child: Text(t('action.save')))])); if (ok != true || reason.text.trim().length < 5) return; try { await widget.repo.setTopicStatus(id, status, reason.text.trim()); await _load(); } catch (_) { if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(t('admin.actionFailed')))); } }
  Widget _topicCard(Map<String,dynamic> topic) { final labels = topic['labels'] is Map ? Map<String,dynamic>.from(topic['labels']) : <String,dynamic>{}; final status = '${topic['publicationStatus'] ?? ''}'; final editor = widget.roleSet.contains('content_editor'), reviewer = widget.roleSet.contains('content_reviewer'); final next = editor && status == 'draft' ? 'in_review' : reviewer && status == 'in_review' ? 'published' : reviewer && status == 'published' ? 'archived' : null; return Card(color: Colors.white, child: ListTile(title: Text('${labels['en'] ?? topic['id']}'), subtitle: Text('${topic['id']} · $status'), trailing: next == null ? null : TextButton(onPressed: () => _changeTopic('${topic['id']}', next), child: Text(t(next == 'in_review' ? 'admin.submitReview' : next == 'published' ? 'admin.publish' : 'admin.archive'))))); }
  Future<void> _programmeComponents(String id) async { try { final detail = await widget.repo.programmeDetail(id); if (!mounted) return; await showModalBottomSheet<void>(context: context, isScrollControlled: true, builder: (ctx) => SafeArea(child: Padding(padding: const EdgeInsets.all(18), child: ListView(shrinkWrap: true, children: [Text(t('admin.components'), style: Theme.of(ctx).textTheme.titleLarge), for (final entry in [('module', true, detail['modules']), ('activity', false, detail['activities'])]) ...[Text(t(entry.$1 == 'module' ? 'admin.modules' : 'admin.activities')), if (entry.$3 is List) ...(entry.$3 as List).whereType<Map>().map((raw) { final component = Map<String,dynamic>.from(raw); final status = '${component['publicationStatus'] ?? ''}'; final isModule = entry.$2; final componentId = '${component['id'] ?? ''}'; final next = status == 'draft' && widget.roleSet.contains('content_editor') ? 'in_review' : status == 'in_review' && widget.roleSet.contains('content_reviewer') ? 'published' : null; return ListTile(title: Text('${component['title'] ?? componentId}'), subtitle: Text(status), trailing: next == null ? null : TextButton(onPressed: () async { final reason = TextEditingController(); final ok = await showDialog<bool>(context: ctx, builder: (d) => AlertDialog(title: Text(t('admin.publicationReason')), content: TextField(controller: reason, decoration: InputDecoration(labelText: t('admin.reason'))), actions: [TextButton(onPressed: () => Navigator.pop(d, false), child: Text(t('action.cancel'))), FilledButton(onPressed: () => Navigator.pop(d, true), child: Text(t('action.save')))])); if (ok != true || reason.text.trim().length < 5) return; try { await widget.repo.setComponentStatus(id, componentId, isModule, next!, reason.text.trim()); if (mounted) { Navigator.pop(ctx); await _programmeComponents(id); await _load(); } } catch (_) { if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(t('admin.actionFailed')))); } }, child: Text(t(next == 'in_review' ? 'admin.submitReview' : 'admin.publish')))); })]]]))); } catch (_) { if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(t('admin.loadFailed')))); } }
  Widget _card(Map<String,dynamic> item, bool programme) { final editor = widget.roleSet.contains('content_editor'), reviewer = widget.roleSet.contains('content_reviewer'); final status = '${item['publicationStatus'] ?? ''}'; final controls = <Widget>[]; if (programme) { controls.add(TextButton(onPressed: () => _programmeComponents('${item['id']}'), child: Text(t('admin.components')))); if (editor && status == 'draft') { controls.add(TextButton(onPressed: () => _author('module', programmeId: '${item['id']}'), child: Text(t('admin.addModule')))); controls.add(TextButton(onPressed: () => _author('activity', programmeId: '${item['id']}'), child: Text(t('admin.addActivity')))); } } if (editor && status == 'draft') controls.add(TextButton(onPressed: () => _change(item, programme, 'in_review'), child: Text(t('admin.submitReview')))); if (reviewer && status == 'in_review') controls.add(TextButton(onPressed: () => _change(item, programme, 'published'), child: Text(t('admin.publish')))); if (reviewer && status == 'published') controls.add(TextButton(onPressed: () => _change(item, programme, 'draft'), child: Text(t('admin.unpublish')))); if (reviewer && status != 'archived') controls.add(TextButton(onPressed: () => _change(item, programme, 'archived'), child: Text(t('admin.archive')))); return Card(color: Colors.white, child: ExpansionTile(title: Text('${item['title'] ?? item['id']}', style: const TextStyle(fontWeight: FontWeight.bold)), subtitle: Text('${item['contentLanguage'] ?? ''} · ${item['publicationStatus'] ?? ''}${item['mediaConfigured'] == false ? ' · ${t('admin.mediaUnavailable')}' : ''}'), children: [Padding(padding: const EdgeInsets.symmetric(horizontal: 16), child: Text('${item['description'] ?? t('admin.previewUnavailable')}')), Wrap(spacing: 4, children: controls)])); }
  @override Widget build(BuildContext context) => RefreshIndicator(onRefresh: _load, child: ListView(padding: const EdgeInsets.all(16), children: [Text(t('admin.content'), style: Theme.of(context).textTheme.headlineSmall?.copyWith(color: _forest, fontWeight: FontWeight.bold)), Text(t('admin.contentHelp')), if (widget.roleSet.contains('content_editor')) Wrap(spacing: 6, children: [TextButton.icon(onPressed: () => _author('topic'), icon: const Icon(Icons.add), label: Text(t('admin.create.topic'))), TextButton.icon(onPressed: () => _author('content'), icon: const Icon(Icons.add), label: Text(t('admin.create.content'))), TextButton.icon(onPressed: () => _author('programme'), icon: const Icon(Icons.add), label: Text(t('admin.create.programme')))]), if (_busy) const Center(child: Padding(padding: EdgeInsets.all(26), child: CircularProgressIndicator())) else if (_failed) TextButton.icon(onPressed: _load, icon: const Icon(Icons.refresh), label: Text(t('admin.loadFailed'))) else ...[Text(t('admin.topics'), style: Theme.of(context).textTheme.titleMedium), if (_topics.isEmpty) Text(t('admin.empty')), ..._topics.map(_topicCard), Text(t('admin.learningItems'), style: Theme.of(context).textTheme.titleMedium), if (_items.isEmpty) Text(t('admin.empty')), ..._items.map((i) => _card(i, false)), const SizedBox(height: 14), Text(t('admin.programmes'), style: Theme.of(context).textTheme.titleMedium), if (_programmes.isEmpty) Text(t('admin.empty')), ..._programmes.map((i) => _card(i, true)), const SizedBox(height: 12), Text(t('admin.noMediaPublishing'), style: const TextStyle(color: _forest))]]));
}

class _FinancePage extends StatefulWidget { const _FinancePage({required this.locale, required this.repo}); final LocaleController locale; final AdminRepository repo; @override State<_FinancePage> createState() => _FinancePageState(); }
class _FinancePageState extends State<_FinancePage> {
  List<Map<String,dynamic>> _refunds = [], _orders = []; bool? _providerConfigured; bool _busy = true, _failed = false; String t(String k) => widget.locale.text(k);
  @override void initState() { super.initState(); _load(); }
  Future<void> _load() async { setState(() { _busy = true; _failed = false; }); try { final values = await Future.wait([widget.repo.refunds(), widget.repo.financeOrders(), widget.repo.providerStatus()]); final provider = values[2]['paymentProvider']; if (mounted) setState(() { _refunds = values[0]; _orders = values[1]; _providerConfigured = provider is Map && provider['configured'] == true; _busy = false; }); } catch (_) { if (mounted) setState(() { _failed = true; _busy = false; }); } }
  String _money(Map<String,dynamic> value) { final minor = value['amountMinor']; final rawExponent = value['currencyExponent']; if (minor is! num || rawExponent is! num) return ''; final exponent = rawExponent.toInt(); var divisor = 1; for (var i = 0; i < exponent; i++) { divisor *= 10; } return '${value['currency'] ?? ''} ${(minor / divisor).toStringAsFixed(exponent)}'; }
  Future<void> _audit(String id) async { try { final events = await widget.repo.orderAudit(id); if (!mounted) return; await showDialog<void>(context: context, builder: (ctx) => AlertDialog(title: Text(t('admin.transactionHistory')), content: SizedBox(width: 480, child: ListView(shrinkWrap: true, children: events.isEmpty ? [Text(t('admin.empty'))] : events.map((e) => ListTile(title: Text('${e['eventType']}'), subtitle: Text('${e['actorType']} · ${e['occurredAt']}'))).toList())), actions: [TextButton(onPressed: () => Navigator.pop(ctx), child: Text(t('action.continue')))])); } catch (_) { if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(t('admin.loadFailed')))); } }
  Future<void> _refundNotes(String id) async { try { final notes = await widget.repo.refundNotes(id); if (!mounted) return; await showDialog<void>(context: context, builder: (ctx) => AlertDialog(title: Text(t('admin.refundNotes')), content: SizedBox(width: 480, child: ListView(shrinkWrap: true, children: notes.isEmpty ? [Text(t('admin.empty'))] : notes.map((n) => ListTile(title: Text('${n['body'] ?? ''}'), subtitle: Text('${n['createdAt'] ?? ''}'))).toList())), actions: [TextButton(onPressed: () => Navigator.pop(ctx), child: Text(t('action.continue')))])); } catch (_) { if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(t('admin.loadFailed')))); } }
  Future<void> _review(Map<String,dynamic> refund) async { final note = TextEditingController(); final ok = await showDialog<bool>(context: context, builder: (ctx) => AlertDialog(title: Text(t('admin.refundReview')), content: TextField(controller: note, minLines: 2, maxLines: 5, decoration: InputDecoration(labelText: t('admin.refundNote'))), actions: [TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text(t('action.cancel'))), FilledButton(onPressed: () => Navigator.pop(ctx, true), child: Text(t('action.save')))])); if (ok != true || note.text.trim().isEmpty) return; try { await widget.repo.reviewRefund('${refund['id']}', note.text.trim()); await _load(); } catch (_) { if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(t('admin.actionFailed')))); } }
  @override Widget build(BuildContext context) => RefreshIndicator(onRefresh: _load, child: ListView(padding: const EdgeInsets.all(16), children: [Text(t('admin.finance'), style: Theme.of(context).textTheme.headlineSmall?.copyWith(color: _forest, fontWeight: FontWeight.bold)), Text(t('admin.financeHelp')), if (!_busy && !_failed) Card(color: Colors.white, child: ListTile(leading: Icon(_providerConfigured == true ? Icons.verified_outlined : Icons.info_outline, color: _green), title: Text(t('admin.financeProvider')), subtitle: Text(t(_providerConfigured == true ? 'admin.financeProviderAvailable' : 'admin.financeProviderState')))), const SizedBox(height: 14), if (_busy) const Center(child: Padding(padding: EdgeInsets.all(24), child: CircularProgressIndicator())) else if (_failed) TextButton.icon(onPressed: _load, icon: const Icon(Icons.refresh), label: Text(t('admin.loadFailed'))) else ...[Text(t('admin.orders'), style: Theme.of(context).textTheme.titleMedium), if (_orders.isEmpty) Text(t('admin.empty')), ..._orders.map((o) { final entitlement = o['entitlement'] is Map ? Map<String,dynamic>.from(o['entitlement']) : <String,dynamic>{}; return Card(color: Colors.white, child: ListTile(title: Text('${o['programmeTitle'] ?? ''}'), subtitle: Text('${o['status']} · ${_money(o)} · ${t('admin.entitlement')}: ${entitlement['status'] ?? t('admin.noneRecorded')}'), trailing: IconButton(tooltip: t('admin.transactionHistory'), onPressed: () => _audit('${o['id']}'), icon: const Icon(Icons.history))); }), const SizedBox(height: 14), Text(t('admin.refunds'), style: Theme.of(context).textTheme.titleMedium), if (_refunds.isEmpty) Text(t('admin.empty')), ..._refunds.map((r) { final order = r['order'] is Map ? Map<String,dynamic>.from(r['order']) : <String,dynamic>{}; return Card(color: Colors.white, child: ListTile(leading: IconButton(tooltip: t('admin.refundNotes'), onPressed: () => _refundNotes('${r['id']}'), icon: const Icon(Icons.notes_outlined)), title: Text('${order['programmeTitle'] ?? t('admin.orderUnavailable')}'), subtitle: Text('${r['reason'] ?? ''} · ${r['status'] ?? ''}\n${r['message'] ?? ''} · ${_money(order)} · ${order['status'] ?? ''}'), isThreeLine: true, trailing: TextButton(onPressed: () => _review(r), child: Text(t('admin.reviewRefund'))))); })]]));
}

class SafeguardingReportScreen extends StatefulWidget { const SafeguardingReportScreen({required this.locale, required this.repository, super.key}); final LocaleController locale; final AdminRepository repository; @override State<SafeguardingReportScreen> createState() => _SafeguardingReportScreenState(); }
class _SafeguardingReportScreenState extends State<SafeguardingReportScreen> {
  final _description = TextEditingController(); String _category = 'safety', _urgency = 'routine'; bool _busy = false, _historyBusy = true; List<Map<String,dynamic>> _reports = []; String? _reportId, _reportStatus;
  String t(String k) => widget.locale.text(k);
  @override void initState() { super.initState(); _loadReports(); }
  Future<void> _loadReports() async { try { final rows = await widget.repository.reporterReports(); if (mounted) setState(() { _reports = rows; _historyBusy = false; }); } catch (_) { if (mounted) setState(() => _historyBusy = false); } }
  Future<void> _submit() async { if (_description.text.trim().length < 10) return; setState(() => _busy = true); try { final report = await widget.repository.submitConcern(category: _category, urgency: _urgency, description: _description.text.trim()); if (mounted) { _description.clear(); setState(() { _reportId = '${report['reportId'] ?? ''}'; _reportStatus = '${report['status'] ?? 'submitted'}'; _busy = false; }); await _loadReports(); } } catch (_) { if (mounted) { setState(() => _busy = false); ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(t('safeguarding.submitFailed')))); } } }
  Future<void> _refreshStatus() async { final id = _reportId; if (id == null || id.isEmpty) return; setState(() => _busy = true); try { final report = await widget.repository.reporterStatus(id); if (mounted) setState(() { _reportStatus = '${report['status'] ?? _reportStatus}'; _busy = false; }); } catch (_) { if (mounted) setState(() => _busy = false); } }
  Future<void> _refreshOne(String id) async { try { final latest = await widget.repository.reporterStatus(id); if (mounted) setState(() { _reportId = '${latest['reportId']}'; _reportStatus = '${latest['status']}'; }); } catch (_) { if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(t('admin.loadFailed')))); } }
  @override Widget build(BuildContext context) => Scaffold(backgroundColor: _ivory, appBar: AppBar(title: Text(t('safeguarding.reportTitle')), backgroundColor: _ivory, foregroundColor: _forest), body: ListView(padding: const EdgeInsets.all(18), children: [Text(t('safeguarding.reportIntro')), Text(t('safeguarding.myReports'), style: Theme.of(context).textTheme.titleMedium), if (_historyBusy) const Center(child: CircularProgressIndicator()) else if (_reports.isEmpty) Text(t('admin.empty')) else ..._reports.map((report) => Card(color: Colors.white, child: ListTile(title: Text('${t('safeguarding.status')}: ${report['status']}'), subtitle: Text('${report['createdAt'] ?? ''}'), trailing: IconButton(tooltip: t('action.retry'), onPressed: () => _refreshOne('${report['reportId']}'), icon: const Icon(Icons.refresh)))), if (_reportId != null) Card(color: Colors.white, child: ListTile(title: Text(t('safeguarding.submitted')), subtitle: Text('${t('safeguarding.status')}: $_reportStatus'), trailing: IconButton(tooltip: t('action.retry'), onPressed: _refreshStatus, icon: const Icon(Icons.refresh)))), const SizedBox(height: 14), DropdownButtonFormField<String>(value: _category, decoration: InputDecoration(labelText: t('safeguarding.category')), items: ['safety','wellbeing','conduct','other'].map((v) => DropdownMenuItem(value: v, child: Text(t('safeguarding.category.$v')))).toList(), onChanged: (v) => setState(() => _category = v ?? 'other')), DropdownButtonFormField<String>(value: _urgency, decoration: InputDecoration(labelText: t('safeguarding.urgency')), items: ['routine','urgent'].map((v) => DropdownMenuItem(value: v, child: Text(t('safeguarding.urgency.$v')))).toList(), onChanged: (v) => setState(() => _urgency = v ?? 'routine')), const SizedBox(height: 12), TextField(controller: _description, minLines: 5, maxLines: 10, maxLength: 4000, decoration: InputDecoration(labelText: t('safeguarding.description'), alignLabelWithHint: true, filled: true, fillColor: Colors.white)), const SizedBox(height: 8), Text(t('safeguarding.privacy')), const SizedBox(height: 16), FilledButton(onPressed: _busy ? null : _submit, child: _busy ? const CircularProgressIndicator() : Text(t('safeguarding.submit')))]));
}
