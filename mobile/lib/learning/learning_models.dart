enum LearningAccessStatus { available, entitlementUnavailable, restricted }
enum LearningMediaType { audio, video }

class LearningTopic {
  const LearningTopic({required this.id, required this.name});
  final String id;
  final String name;
}

class LearningProgramme {
  const LearningProgramme({required this.id, required this.names});
  final String id;
  final Map<String, String> names;

  String label(String language) => names[language] ?? id;
}

class LearningItem {
  const LearningItem({
    required this.id,
    required this.contentGroupId,
    required this.title,
    required this.description,
    required this.contentLanguage,
    required this.availableLanguages,
    required this.mediaType,
    required this.topicIds,
    required this.topics,
    required this.ageBands,
    required this.learningObjectives,
    required this.accessRequirement,
    required this.accessStatus,
    required this.mediaAvailable,
    required this.thumbnailAvailable,
    this.durationSeconds,
    this.programmeId,
    this.programmeName,
  });

  final String id;
  final String contentGroupId;
  final String title;
  final String description;
  final String contentLanguage;
  final List<String> availableLanguages;
  final LearningMediaType mediaType;
  final List<String> topicIds;
  final List<LearningTopic> topics;
  final List<String> ageBands;
  final List<String> learningObjectives;
  final String accessRequirement;
  final LearningAccessStatus accessStatus;
  final bool mediaAvailable;
  final bool thumbnailAvailable;
  final int? durationSeconds;
  final String? programmeId;
  final String? programmeName;

  factory LearningItem.fromJson(Map<String, dynamic> json) {
    List<String> strings(Object? value) => value is List ? value.whereType<String>().toList(growable: false) : const [];
    final topicsJson = json['topics'];
    final topics = topicsJson is List ? topicsJson.whereType<Map>().map((topic) => LearningTopic(
      id: topic['id']?.toString() ?? '',
      name: _topicLabel(topic['labels'], json['contentLanguage']?.toString() ?? 'en'),
    )).where((topic) => topic.id.isNotEmpty && topic.name.isNotEmpty).toList(growable: false) : const <LearningTopic>[];
    final status = switch (json['accessStatus']) {
      'available' => LearningAccessStatus.available,
      'entitlement_unavailable' => LearningAccessStatus.entitlementUnavailable,
      _ => LearningAccessStatus.restricted,
    };
    return LearningItem(
      id: json['id']?.toString() ?? '',
      contentGroupId: json['contentGroupId']?.toString() ?? '',
      title: json['title']?.toString() ?? '',
      description: json['description']?.toString() ?? '',
      contentLanguage: json['contentLanguage']?.toString() ?? 'en',
      availableLanguages: strings(json['availableLanguages']),
      mediaType: json['mediaType'] == 'video' ? LearningMediaType.video : LearningMediaType.audio,
      topicIds: strings(json['topicIds']),
      topics: topics,
      ageBands: strings(json['ageBands']),
      learningObjectives: strings(json['learningObjectives']),
      accessRequirement: json['accessRequirement']?.toString() ?? 'restricted',
      accessStatus: status,
      mediaAvailable: json['mediaAvailable'] == true,
      thumbnailAvailable: json['thumbnailAvailable'] == true,
      durationSeconds: json['durationSeconds'] is num ? (json['durationSeconds'] as num).toInt() : null,
      programmeId: json['programmeId']?.toString(),
      programmeName: json['programmeName']?.toString(),
    );
  }

  static String _topicLabel(Object? raw, String language) {
    if (raw is String) return raw;
    if (raw is Map) return raw['name']?.toString() ?? raw[language]?.toString() ?? '';
    return '';
  }
}

class LearningCatalog {
  const LearningCatalog({required this.items, required this.availableLanguages, required this.programmes, required this.hasMore, required this.nextOffset});
  final List<LearningItem> items;
  final List<String> availableLanguages;
  final List<LearningProgramme> programmes;
  final bool hasMore;
  final int nextOffset;
}

class PlaybackGrant {
  const PlaybackGrant({required this.url, required this.expiresAt, required this.mediaType, this.durationSeconds});
  final Uri url;
  final DateTime expiresAt;
  final LearningMediaType mediaType;
  final int? durationSeconds;
}
