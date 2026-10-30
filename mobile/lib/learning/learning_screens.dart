import 'dart:async';

import 'package:flutter/material.dart';
import 'package:just_audio/just_audio.dart';

import '../localization/languages.dart';
import '../localization/locale_controller.dart';
import 'learning_models.dart';
import 'learning_repository.dart';

const _forest = Color(0xFF263A30);
const _green = Color(0xFF4C8B69);
const _saffron = Color(0xFFF3A66B);
const _ivory = Color(0xFFF6F3EC);

class LearningSearchScreen extends StatelessWidget {
  const LearningSearchScreen({required this.locale, required this.repository, this.studentProfileId, this.initialQuery = '', super.key});
  final LocaleController locale;
  final LearningRepository repository;
  final String? studentProfileId;
  final String initialQuery;

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: _ivory,
    appBar: AppBar(backgroundColor: _ivory, foregroundColor: _forest, title: Text(locale.text('learning.searchTitle'))),
    body: SafeArea(child: Center(child: ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 640),
      child: LearningLibraryTab(locale: locale, repository: repository, studentProfileId: studentProfileId, initialQuery: initialQuery, searchOnly: true),
    ))),
  );
}

class LearningLibraryTab extends StatefulWidget {
  const LearningLibraryTab({required this.locale, required this.repository, this.studentProfileId, this.initialQuery = '', this.searchOnly = false, this.onOpenProgrammes, super.key});
  final LocaleController locale;
  final LearningRepository repository;
  final String? studentProfileId;
  final String initialQuery;
  final bool searchOnly;
  final VoidCallback? onOpenProgrammes;

  @override
  State<LearningLibraryTab> createState() => _LearningLibraryTabState();
}

class _LearningLibraryTabState extends State<LearningLibraryTab> {
  late final TextEditingController _search;
  Timer? _debounce;
  List<LearningTopic> _topics = const [];
  List<LearningItem> _items = const [];
  List<LearningProgramme> _programmes = const [];
  List<String> _availableLanguages = const [];
  int _nextOffset = 0;
  bool _hasMore = false;
  bool _loadingMore = false;
  String? _topicId;
  String? _programmeId;
  String? _ageBand;
  String? _contentLanguage;
  bool _loading = true;
  bool _failed = false;
  int _loadGeneration = 0;

  @override
  void initState() {
    super.initState();
    _search = TextEditingController(text: widget.initialQuery);
    widget.locale.addListener(_localeChanged);
    _load();
  }

  @override
  void didUpdateWidget(covariant LearningLibraryTab oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.studentProfileId != widget.studentProfileId) _load();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    widget.locale.removeListener(_localeChanged);
    _search.dispose();
    super.dispose();
  }

  void _localeChanged() {
    _topics = const [];
    _load();
  }

  Future<void> _load() async {
    final generation = ++_loadGeneration;
    setState(() { _loading = true; _failed = false; _loadingMore = false; _nextOffset = 0; _hasMore = false; });
    try {
      final topics = await widget.repository.listTopics(language: widget.locale.locale.languageCode);
      final topicFilter = _topicId != null && topics.any((topic) => topic.id == _topicId) ? _topicId : null;
      final catalog = await widget.repository.listContent(
        query: _search.text,
        topicId: topicFilter,
        programmeId: _programmeId,
        ageBand: widget.studentProfileId == null ? _ageBand : null,
        language: _contentLanguage,
        studentProfileId: widget.studentProfileId,
      );
      if (!mounted || generation != _loadGeneration) return;
      setState(() {
        _topics = topics;
        _topicId = topicFilter;
        _items = catalog.items;
        _programmes = catalog.programmes;
        _availableLanguages = catalog.availableLanguages;
        _nextOffset = catalog.nextOffset;
        _hasMore = catalog.hasMore;
        _failed = false;
      });
    } catch (_) {
      if (!mounted || generation != _loadGeneration) return;
      setState(() { _items = const []; _failed = true; });
    } finally {
      if (mounted && generation == _loadGeneration) setState(() => _loading = false);
    }
  }

  void _scheduleSearch(String _) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), _load);
  }

  @override
  Widget build(BuildContext context) {
    final t = widget.locale.text;
    final hasQuery = _search.text.trim().isNotEmpty;
    return RefreshIndicator(
      onRefresh: _load,
      child: CustomScrollView(slivers: [
        SliverPadding(padding: const EdgeInsets.fromLTRB(18, 14, 18, 4), sliver: SliverToBoxAdapter(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          if (!widget.searchOnly) ...[
            Text(t('learning.homeTitle'), style: Theme.of(context).textTheme.headlineSmall?.copyWith(color: _forest, fontWeight: FontWeight.w700)),
            const SizedBox(height: 4),
            Text(t('learning.homeIntro')),
            const SizedBox(height: 14),
          ],
          TextField(
            controller: _search,
            autofocus: widget.searchOnly,
            textInputAction: TextInputAction.search,
            onChanged: _scheduleSearch,
            onSubmitted: (_) => _load(),
            decoration: InputDecoration(
              hintText: t('learning.searchHint'),
              prefixIcon: const Icon(Icons.search),
              suffixIcon: IconButton(tooltip: t('learning.searchAction'), onPressed: _load, icon: const Icon(Icons.arrow_forward)),
              filled: true, fillColor: Colors.white,
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
            ),
          ),
          if (!widget.searchOnly) Align(alignment: AlignmentDirectional.centerStart, child: TextButton.icon(
            onPressed: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => LearningSearchScreen(
              locale: widget.locale, repository: widget.repository, studentProfileId: widget.studentProfileId, initialQuery: _search.text,
            ))),
            icon: const Icon(Icons.manage_search), label: Text(t('learning.openSearch')),
          )),
          if (!widget.searchOnly && widget.onOpenProgrammes != null) Align(alignment: AlignmentDirectional.centerStart, child: TextButton.icon(
            onPressed: widget.onOpenProgrammes, icon: const Icon(Icons.spa_outlined), label: Text(t('learning.openProgrammes')),
          )),
          const SizedBox(height: 8),
          Text(t('learning.contentLanguageNotice'), style: Theme.of(context).textTheme.bodySmall),
          const SizedBox(height: 12),
          _filters(context),
          const SizedBox(height: 14),
          if (!widget.searchOnly) _InfoPanel(icon: Icons.history, title: t('learning.historyUnavailableTitle'), body: t('learning.historyUnavailableBody')),
          const SizedBox(height: 10),
          Text(hasQuery ? t('learning.searchResults') : t('learning.libraryResults'), style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
        ]))),
        if (_loading)
          SliverFillRemaining(hasScrollBody: false, child: Center(child: Column(mainAxisSize: MainAxisSize.min, children: [const CircularProgressIndicator(), const SizedBox(height: 10), Text(t('status.loading'))])))
        else if (_failed)
          SliverPadding(padding: const EdgeInsets.all(18), sliver: SliverToBoxAdapter(child: _InfoPanel(
            icon: Icons.cloud_off_outlined, title: t('learning.loadFailedTitle'), body: t('learning.loadFailedBody'),
            action: TextButton.icon(onPressed: _load, icon: const Icon(Icons.refresh), label: Text(t('action.retry'))),
          )))
        else if (_items.isEmpty)
          SliverPadding(padding: const EdgeInsets.all(18), sliver: SliverToBoxAdapter(child: _InfoPanel(
            icon: hasQuery ? Icons.search_off : Icons.menu_book_outlined,
            title: t(hasQuery ? 'learning.noSearchResultsTitle' : 'learning.emptyLibraryTitle'),
            body: t(hasQuery ? 'learning.noSearchResultsBody' : 'learning.emptyLibraryBody'),
          )))
        else
          SliverPadding(padding: const EdgeInsets.fromLTRB(14, 6, 14, 24), sliver: SliverList.builder(
            itemCount: _items.length,
            itemBuilder: (context, index) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: _LearningListCard(
                item: _items[index], locale: widget.locale,
                onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => LearningContentDetailScreen(
                  contentId: _items[index].id,
                  locale: widget.locale,
                  repository: widget.repository,
                  studentProfileId: widget.studentProfileId,
                  onOpenProgrammes: widget.onOpenProgrammes,
                ))),
              ),
            ),
          )),
        if (!_loading && !_failed && _hasMore)
          SliverToBoxAdapter(child: Padding(padding: const EdgeInsets.fromLTRB(18, 4, 18, 24), child: Center(child: OutlinedButton.icon(
            onPressed: _loadingMore ? null : _loadMore,
            icon: _loadingMore ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.expand_more),
            label: Text(t('learning.loadMore')),
          )))),
      ]),
    );
  }

  Future<void> _loadMore() async {
    if (_loadingMore || !_hasMore) return;
    final generation = _loadGeneration;
    setState(() => _loadingMore = true);
    try {
      final page = await widget.repository.listContent(
        query: _search.text, topicId: _topicId, programmeId: _programmeId,
        ageBand: widget.studentProfileId == null ? _ageBand : null,
        language: _contentLanguage, studentProfileId: widget.studentProfileId, offset: _nextOffset,
      );
      if (!mounted || generation != _loadGeneration) return;
      setState(() { _items = [..._items, ...page.items]; _nextOffset = page.nextOffset; _hasMore = page.hasMore; });
    } catch (_) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(widget.locale.text('learning.loadMoreFailed'))));
    } finally { if (mounted) setState(() => _loadingMore = false); }
  }

  Widget _filters(BuildContext context) {
    final t = widget.locale.text;
    final topicEntries = ['', ..._topics.map((item) => item.id)];
    final languageEntries = ['', ..._availableLanguages];
    final programmeEntries = ['', ..._programmes.map((item) => item.id)];
    final ageEntries = widget.studentProfileId == null ? const ['', 'child', 'youth'] : const [''];
    return Column(children: [
      Row(children: [
        Expanded(child: _filter<String>(t('learning.topicFilter'), _topicId ?? '', topicEntries, (value) => value.isEmpty ? t('learning.allTopics') : _topics.firstWhere((item) => item.id == value, orElse: () => const LearningTopic(id: '', name: '')).name, (value) { setState(() => _topicId = value?.isEmpty == true ? null : value); _load(); })),
        const SizedBox(width: 8),
        Expanded(child: _filter<String>(t('learning.programmeFilter'), _programmeId ?? '', programmeEntries, (value) => value.isEmpty ? t('learning.allProgrammes') : _programmes.firstWhere((item) => item.id == value, orElse: () => const LearningProgramme(id: '', names: {})).label(_contentLanguage ?? widget.locale.locale.languageCode), (value) { setState(() => _programmeId = value?.isEmpty == true ? null : value); _load(); })),
      ]),
      const SizedBox(height: 8),
      Row(children: [
        Expanded(child: _filter<String>(t('learning.ageFilter'), _ageBand ?? '', ageEntries, (value) => widget.studentProfileId != null ? t('learning.yourAgeBand') : value == 'child' ? t('age.child') : value == 'youth' ? t('age.youth') : t('learning.allAges'), (value) { setState(() => _ageBand = value?.isEmpty == true ? null : value); _load(); })),
        const SizedBox(width: 8),
        Expanded(child: _filter<String>(t('learning.languageFilter'), _contentLanguage ?? '', languageEntries, (value) => value.isEmpty ? t('learning.allLanguages') : _languageName(value), (value) { setState(() => _contentLanguage = value?.isEmpty == true ? null : value); _load(); })),
      ]),
    ]);
  }

  Widget _filter<T>(String label, T selected, List<T> values, String Function(T) labelFor, ValueChanged<T?> onChanged) =>
      DropdownButtonFormField<T>(
        value: selected,
        isExpanded: true,
        decoration: InputDecoration(labelText: label, filled: true, fillColor: Colors.white, contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10), border: OutlineInputBorder(borderRadius: BorderRadius.circular(12))),
        items: values.map((value) => DropdownMenuItem<T>(value: value, child: Text(labelFor(value), maxLines: 1, overflow: TextOverflow.ellipsis))).toList(),
        onChanged: onChanged,
      );

  String _languageName(String code) {
    for (final language in appLanguages) {
      if (language.locale.languageCode == code) return '${language.nativeName} (${language.englishName})';
    }
    return code;
  }
}

class _LearningListCard extends StatelessWidget {
  const _LearningListCard({required this.item, required this.locale, required this.onTap});
  final LearningItem item;
  final LocaleController locale;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final t = locale.text;
    final paidUnavailable = item.accessStatus != LearningAccessStatus.available;
    return Card(color: Colors.white, clipBehavior: Clip.antiAlias, child: InkWell(onTap: onTap, child: Padding(padding: const EdgeInsets.all(14), child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Container(width: 66, height: 66, decoration: BoxDecoration(color: _ivory, borderRadius: BorderRadius.circular(12)), child: Icon(item.mediaType == LearningMediaType.audio ? Icons.headphones : Icons.ondemand_video_outlined, size: 30, color: _green)),
      const SizedBox(width: 12),
      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(item.title, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w700, color: _forest)),
        const SizedBox(height: 5), Text(_languageName(locale, item.contentLanguage), style: Theme.of(context).textTheme.bodySmall),
        const SizedBox(height: 6), Wrap(spacing: 6, runSpacing: 4, children: [
          _AccessChip(label: t(paidUnavailable ? 'learning.accessRestricted' : 'learning.accessFree'), restricted: paidUnavailable),
          if (item.durationSeconds != null) _AccessChip(label: _duration(Duration(seconds: item.durationSeconds!)), restricted: false),
        ]),
      ])),
      const Icon(Icons.chevron_right, color: _forest),
    ]))));
  }
}

class LearningContentDetailScreen extends StatefulWidget {
  const LearningContentDetailScreen({required this.contentId, required this.locale, required this.repository, this.studentProfileId, this.onOpenProgrammes, super.key});
  final String contentId;
  final LocaleController locale;
  final LearningRepository repository;
  final String? studentProfileId;
  final VoidCallback? onOpenProgrammes;

  @override
  State<LearningContentDetailScreen> createState() => _LearningContentDetailScreenState();
}

class _LearningContentDetailScreenState extends State<LearningContentDetailScreen> {
  LearningItem? _item;
  bool _loading = true;
  String? _errorKey;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    setState(() { _loading = true; _errorKey = null; });
    try {
      final item = await widget.repository.getContent(widget.contentId, studentProfileId: widget.studentProfileId);
      if (mounted) setState(() { _item = item; _loading = false; });
    } catch (error) {
      if (mounted) setState(() { _errorKey = _learningErrorKey(error, detail: true); _loading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = widget.locale.text;
    final item = _item;
    return Scaffold(
      backgroundColor: _ivory,
      appBar: AppBar(backgroundColor: _ivory, foregroundColor: _forest, title: Text(t('learning.detailTitle'))),
      body: SafeArea(child: Center(child: ConstrainedBox(constraints: const BoxConstraints(maxWidth: 640), child: _loading
        ? const Center(child: CircularProgressIndicator())
        : _errorKey != null || item == null
            ? Center(child: Padding(padding: const EdgeInsets.all(24), child: _InfoPanel(
                icon: Icons.cloud_off_outlined,
                title: t(_errorKey == 'learning.detailNotFound' ? 'learning.detailNotFound' : 'learning.detailFailedTitle'),
                body: t(_errorKey == null || _errorKey == 'learning.detailNotFound' ? 'learning.detailFailedBody' : _errorKey!),
                action: TextButton.icon(onPressed: _load, icon: const Icon(Icons.refresh), label: Text(t('action.retry'))),
              )))
            : _detail(item))),
    );
  }

  Widget _detail(LearningItem item) {
    final t = widget.locale.text;
    final paidUnavailable = item.accessStatus != LearningAccessStatus.available;
    final canUseFreeItem = !paidUnavailable;
    return ListView(padding: const EdgeInsets.all(18), children: [
      _Thumbnail(item: item, locale: widget.locale, repository: widget.repository, studentProfileId: widget.studentProfileId),
      const SizedBox(height: 16),
      Text(item.title, style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w700, color: _forest)),
      const SizedBox(height: 6),
      Text('${t('learning.contentLanguage')}: ${_languageName(widget.locale, item.contentLanguage)}'),
      if (item.availableLanguages.length > 1) ...[
        const SizedBox(height: 4),
        Text('${t('learning.availableLanguages')}: ${item.availableLanguages.map((code) => _languageName(widget.locale, code)).join(', ')}'),
      ],
      if (item.durationSeconds != null) ...[const SizedBox(height: 4), Text('${t('learning.duration')}: ${_duration(Duration(seconds: item.durationSeconds!))}')],
      if (item.programmeName != null) ...[const SizedBox(height: 4), Text('${t('learning.programme')}: ${item.programmeName}')],
      if (item.topics.isNotEmpty) ...[const SizedBox(height: 4), Text('${t('learning.topics')}: ${item.topics.map((topic) => topic.name).join(', ')}')],
      const SizedBox(height: 14),
      Text(item.description, style: Theme.of(context).textTheme.bodyLarge?.copyWith(height: 1.5)),
      const SizedBox(height: 14),
      _AccessChip(label: t(paidUnavailable ? 'learning.accessRestricted' : 'learning.accessFree'), restricted: paidUnavailable),
      if (paidUnavailable) ...[
        const SizedBox(height: 10),
        _InfoPanel(icon: Icons.lock_outline, title: t('learning.entitlementUnavailableTitle'), body: t('learning.entitlementUnavailableBody')),
        if (item.programmeId != null && widget.onOpenProgrammes != null) TextButton.icon(onPressed: () { Navigator.of(context).pop(); widget.onOpenProgrammes!.call(); }, icon: const Icon(Icons.spa_outlined), label: Text(t('learning.findPaidProgramme'))),
      ] else if (!item.mediaAvailable) ...[
        const SizedBox(height: 10),
        _InfoPanel(icon: Icons.cloud_off_outlined, title: t('learning.mediaUnavailableTitle'), body: t('learning.mediaUnavailableBody')),
      ],
      if (item.learningObjectives.isNotEmpty) ...[
        const SizedBox(height: 18), Text(t('learning.objectivesTitle'), style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
        const SizedBox(height: 4), ...item.learningObjectives.map((objective) => ListTile(dense: true, contentPadding: EdgeInsets.zero, leading: const Icon(Icons.check_circle_outline, color: _green), title: Text(objective))),
      ],
      const SizedBox(height: 18),
      if (item.mediaType == LearningMediaType.audio)
        FilledButton.icon(
          onPressed: canUseFreeItem && item.mediaAvailable ? () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => AudioPlayerScreen(item: item, locale: widget.locale, repository: widget.repository, studentProfileId: widget.studentProfileId))) : null,
          icon: const Icon(Icons.play_arrow), label: Text(t(item.mediaAvailable ? 'learning.openAudioPlayer' : 'learning.audioUnavailable')),
        )
      else
        _InfoPanel(icon: Icons.videocam_off_outlined, title: t('learning.videoUnavailableTitle'), body: t('learning.videoUnavailableBody')),
    ]);
  }
}

class _Thumbnail extends StatefulWidget {
  const _Thumbnail({required this.item, required this.locale, required this.repository, this.studentProfileId});
  final LearningItem item;
  final LocaleController locale;
  final LearningRepository repository;
  final String? studentProfileId;

  @override
  State<_Thumbnail> createState() => _ThumbnailState();
}

class _ThumbnailState extends State<_Thumbnail> {
  Future<Uri>? _image;

  @override
  void initState() {
    super.initState();
    _loadImage();
  }

  @override
  void didUpdateWidget(covariant _Thumbnail oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.item.id != widget.item.id || oldWidget.item.thumbnailAvailable != widget.item.thumbnailAvailable) _loadImage();
  }

  void _loadImage() {
    _image = widget.item.thumbnailAvailable ? widget.repository.requestThumbnail(widget.item.id, studentProfileId: widget.studentProfileId) : null;
  }

  @override
  Widget build(BuildContext context) => ClipRRect(
    borderRadius: BorderRadius.circular(18),
    child: AspectRatio(aspectRatio: 16 / 9, child: _image != null
      ? FutureBuilder<Uri>(future: _image, builder: (context, snapshot) => snapshot.hasData
          ? Image.network(snapshot.data.toString(), fit: BoxFit.cover, errorBuilder: (_, __, ___) => _placeholder())
          : _placeholder())
      : _placeholder()),
  );

  Widget _placeholder() => Container(color: _green, child: const Center(child: Icon(Icons.eco_outlined, color: Colors.white, size: 54)));
}

class AudioPlayerScreen extends StatefulWidget {
  const AudioPlayerScreen({required this.item, required this.locale, required this.repository, this.studentProfileId, super.key});
  final LearningItem item;
  final LocaleController locale;
  final LearningRepository repository;
  final String? studentProfileId;

  @override
  State<AudioPlayerScreen> createState() => _AudioPlayerScreenState();
}

class _AudioPlayerScreenState extends State<AudioPlayerScreen> {
  late final AudioPlayer _player;
  StreamSubscription<PlayerException>? _errorSubscription;
  bool _loading = true;
  bool _ready = false;
  String? _errorKey;

  @override
  void initState() {
    super.initState();
    _player = AudioPlayer();
    _errorSubscription = _player.errorStream.listen((_) {
      if (mounted) setState(() => _errorKey = 'learning.playbackError');
    });
    _prepare();
  }

  Future<void> _prepare() async {
    if (mounted) setState(() { _loading = true; _errorKey = null; _ready = false; });
    if (!widget.item.mediaAvailable) {
      if (mounted) setState(() { _loading = false; _errorKey = 'learning.mediaUnavailableBody'; });
      return;
    }
    try {
      final grant = await widget.repository.requestPlayback(widget.item.id, studentProfileId: widget.studentProfileId);
      if (!grant.expiresAt.isAfter(DateTime.now())) throw const LearningServiceException('MEDIA_GRANT_EXPIRED', null);
      await _player.setUrl(grant.url.toString());
      if (mounted) setState(() { _ready = true; _loading = false; });
    } catch (error) {
      if (mounted) setState(() { _errorKey = _learningErrorKey(error, player: true); _loading = false; });
    }
  }

  @override
  void dispose() {
    if (_errorSubscription != null) unawaited(_errorSubscription!.cancel());
    unawaited(_player.dispose());
    super.dispose();
  }

  Future<void> _toggle() async {
    try {
      if (_player.playing) await _player.pause();
      else await _player.play();
    } catch (_) { if (mounted) setState(() => _errorKey = 'learning.playbackError'); }
  }

  Future<void> _retry() async {
    try { await _player.stop(); } catch (_) { }
    await _prepare();
  }

  Future<void> _skip(Duration amount) async {
    final duration = _player.duration;
    final current = _player.position;
    final target = current + amount;
    final bounded = duration == null
        ? (target.isNegative ? Duration.zero : target)
        : target < Duration.zero ? Duration.zero : target > duration ? duration : target;
    await _player.seek(bounded);
  }

  @override
  Widget build(BuildContext context) {
    final t = widget.locale.text;
    return Scaffold(
      backgroundColor: _forest,
      appBar: AppBar(backgroundColor: _forest, foregroundColor: Colors.white, title: Text(t('learning.playerTitle'))),
      body: SafeArea(child: Center(child: ConstrainedBox(constraints: const BoxConstraints(maxWidth: 560), child: SingleChildScrollView(padding: const EdgeInsets.all(24), child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
        Container(width: 220, height: 220, decoration: BoxDecoration(color: _green, borderRadius: BorderRadius.circular(24)), child: const Icon(Icons.headphones, color: Colors.white, size: 88)),
        const SizedBox(height: 24),
        Text(widget.item.title, textAlign: TextAlign.center, maxLines: 3, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w700)),
        const SizedBox(height: 6),
        Text('${t('learning.contentLanguage')}: ${_languageName(widget.locale, widget.item.contentLanguage)}', style: const TextStyle(color: Colors.white70)),
        const SizedBox(height: 24),
        if (_errorKey != null) ...[
          _PlayerError(text: t(_errorKey!)),
          const SizedBox(height: 8),
          OutlinedButton.icon(onPressed: _loading ? null : _retry, icon: const Icon(Icons.refresh), label: Text(t('action.retry'))),
        ],
        if (_loading) const Padding(padding: EdgeInsets.all(12), child: CircularProgressIndicator(color: _saffron)),
        StreamBuilder<Duration?>(stream: _player.durationStream, builder: (context, snapshot) {
          final duration = snapshot.data ?? (widget.item.durationSeconds == null ? null : Duration(seconds: widget.item.durationSeconds!));
          return StreamBuilder<Duration>(stream: _player.positionStream, builder: (context, positionSnapshot) {
            final position = positionSnapshot.data ?? Duration.zero;
            final max = duration?.inMilliseconds.toDouble() ?? 0;
            final value = max > 0 ? position.inMilliseconds.clamp(0, max.toInt()).toDouble() : 0.0;
            return Column(children: [
              Slider(value: value, max: max > 0 ? max : 1, onChanged: _ready && duration != null ? (next) => _player.seek(Duration(milliseconds: next.round())) : null, activeColor: _saffron, inactiveColor: Colors.white24),
              Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                Text(_duration(position), style: const TextStyle(color: Colors.white70)),
                Text(duration == null ? t('learning.durationUnknown') : '−${_duration(duration - position)}', style: const TextStyle(color: Colors.white70)),
              ]),
            ]);
          });
        }),
        const SizedBox(height: 10),
        Row(mainAxisAlignment: MainAxisAlignment.center, children: [
          IconButton(tooltip: t('learning.skipBack'), onPressed: _ready ? () => _skip(const Duration(seconds: -15)) : null, color: Colors.white, iconSize: 32, icon: const Icon(Icons.replay_10)),
          const SizedBox(width: 12),
          StreamBuilder<PlayerState>(stream: _player.playerStateStream, builder: (context, snapshot) {
            final playing = snapshot.data?.playing == true;
            return FilledButton(onPressed: _ready ? _toggle : null, style: FilledButton.styleFrom(backgroundColor: Colors.white, foregroundColor: _forest, shape: const CircleBorder(), padding: const EdgeInsets.all(18)), child: Icon(playing ? Icons.pause : Icons.play_arrow, size: 34));
          }),
          const SizedBox(width: 12),
          IconButton(tooltip: t('learning.skipForward'), onPressed: _ready ? () => _skip(const Duration(seconds: 15)) : null, color: Colors.white, iconSize: 32, icon: const Icon(Icons.forward_10)),
        ]),
        const SizedBox(height: 8),
        Text(t('learning.noOfflineOrBackground'), textAlign: TextAlign.center, style: const TextStyle(color: Colors.white70)),
      ]))))),
    );
  }
}

class _InfoPanel extends StatelessWidget {
  const _InfoPanel({required this.icon, required this.title, required this.body, this.action});
  final IconData icon;
  final String title;
  final String body;
  final Widget? action;
  @override
  Widget build(BuildContext context) => Card(color: Colors.white, child: Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
    Row(children: [Icon(icon, color: _saffron), const SizedBox(width: 10), Expanded(child: Text(title, style: const TextStyle(fontWeight: FontWeight.w700, color: _forest)))]),
    const SizedBox(height: 8), Text(body, softWrap: true), if (action != null) Align(alignment: AlignmentDirectional.centerStart, child: action!),
  ])));
}

class _AccessChip extends StatelessWidget {
  const _AccessChip({required this.label, required this.restricted});
  final String label;
  final bool restricted;
  @override
  Widget build(BuildContext context) => Chip(
    label: Text(label, style: TextStyle(color: restricted ? _forest : _green, fontSize: 12)),
    backgroundColor: restricted ? _saffron.withValues(alpha: .25) : _green.withValues(alpha: .12),
    side: BorderSide.none,
    visualDensity: VisualDensity.compact,
  );
}

class _PlayerError extends StatelessWidget {
  const _PlayerError({required this.text});
  final String text;
  @override
  Widget build(BuildContext context) => Container(width: double.infinity, padding: const EdgeInsets.all(12), decoration: BoxDecoration(color: Colors.white12, borderRadius: BorderRadius.circular(12)), child: Text(text, style: const TextStyle(color: Colors.white), textAlign: TextAlign.center));
}

String _languageName(LocaleController locale, String code) {
  for (final language in appLanguages) {
    if (language.locale.languageCode == code) return '${language.nativeName} (${language.englishName})';
  }
  return code;
}

String _duration(Duration duration) {
  if (duration.isNegative) return '00:00';
  final seconds = duration.inSeconds;
  final hours = seconds ~/ 3600;
  final minutes = (seconds % 3600) ~/ 60;
  final remainder = seconds % 60;
  if (hours > 0) return '${hours.toString().padLeft(2, '0')}:${minutes.toString().padLeft(2, '0')}:${remainder.toString().padLeft(2, '0')}';
  return '${minutes.toString().padLeft(2, '0')}:${remainder.toString().padLeft(2, '0')}';
}

String _learningErrorKey(Object error, {bool player = false, bool detail = false}) {
  if (error is LearningServiceException) {
    return switch (error.code) {
      'ENTITLEMENT_UNAVAILABLE' => 'learning.entitlementUnavailableBody',
      'MEDIA_UNAVAILABLE' || 'THUMBNAIL_UNAVAILABLE' => 'learning.mediaUnavailableBody',
      'STUDENT_ACCESS_RESTRICTED' || 'FORBIDDEN' => 'learning.studentAccessRestricted',
      'API_CONFIGURATION_REQUIRED' => 'learning.apiNotConfigured',
      'NOT_FOUND' => detail ? 'learning.detailNotFound' : 'learning.loadFailedBody',
      _ => player ? 'learning.playbackError' : 'learning.loadFailedBody',
    };
  }
  return player ? 'learning.playbackError' : 'learning.loadFailedBody';
}
