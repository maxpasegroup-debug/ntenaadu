import 'package:dio/dio.dart';

import '../network/api_client.dart';
import 'learning_models.dart';

class LearningServiceException implements Exception {
  const LearningServiceException(this.code, this.statusCode);
  final String code;
  final int? statusCode;
}

abstract interface class LearningRepository {
  Future<LearningCatalog> listContent({String? query, String? topicId, String? programmeId, String? ageBand, String? language, String? studentProfileId, int offset = 0});
  Future<List<LearningTopic>> listTopics({required String language});
  Future<LearningItem> getContent(String id, {String? studentProfileId});
  Future<PlaybackGrant> requestPlayback(String id, {String? studentProfileId});
  Future<Uri> requestThumbnail(String id, {String? studentProfileId});
}

class LearningApiRepository implements LearningRepository {
  LearningApiRepository(this.client);
  final ApiClient client;

  Future<T> _request<T>(Future<T> Function() action) async {
    try { return await action(); }
    on NteApiException catch (error) { throw LearningServiceException(error.code, error.statusCode); }
    on FormatException { throw const LearningServiceException('API_CONFIGURATION_REQUIRED', null); }
    on DioException catch (error) {
      final apiError = ApiClient.fromDio(error);
      throw LearningServiceException(apiError.code, apiError.statusCode);
    }
    catch (error) {
      if (error is LearningServiceException) rethrow;
      throw const LearningServiceException('SERVICE_UNAVAILABLE', null);
    }
  }

  Map<String, dynamic> _map(dynamic value) => Map<String, dynamic>.from(value as Map);
  List<String> _strings(dynamic value) => value is List ? value.whereType<String>().toList(growable: false) : const [];

  @override
  Future<LearningCatalog> listContent({String? query, String? topicId, String? programmeId, String? ageBand, String? language, String? studentProfileId, int offset = 0}) => _request(() async {
    final params = <String, dynamic>{
      if (query != null && query.trim().isNotEmpty) 'q': query.trim(),
      if (topicId != null && topicId.isNotEmpty) 'topicId': topicId,
      if (programmeId != null && programmeId.isNotEmpty) 'programmeId': programmeId,
      if (ageBand != null && ageBand.isNotEmpty) 'ageBand': ageBand,
      if (language != null && language.isNotEmpty) 'language': language,
      if (studentProfileId != null) 'studentProfileId': studentProfileId,
      'offset': offset,
    };
    final response = await client.dio.get<Map<String, dynamic>>('/learning/catalog', queryParameters: params);
    final data = response.data ?? const <String, dynamic>{};
    final items = data['items'] is List ? (data['items'] as List).whereType<Map>().map((item) => LearningItem.fromJson(Map<String, dynamic>.from(item))).toList(growable: false) : const <LearningItem>[];
    final programmes = data['programmes'] is List ? (data['programmes'] as List).whereType<Map>().map((item) {
      final names = item['names'] is Map ? Map<String, String>.from((item['names'] as Map).map((key, value) => MapEntry(key.toString(), value.toString()))) : const <String, String>{};
      return LearningProgramme(id: item['id']?.toString() ?? '', names: names);
    }).where((item) => item.id.isNotEmpty).toList(growable: false) : const <LearningProgramme>[];
    return LearningCatalog(items: items, availableLanguages: _strings(data['availableLanguages']), programmes: programmes, hasMore: data['hasMore'] == true, nextOffset: (data['nextOffset'] as num?)?.toInt() ?? items.length);
  });

  @override
  Future<List<LearningTopic>> listTopics({required String language}) => _request(() async {
    final response = await client.dio.get<Map<String, dynamic>>('/learning/topics', queryParameters: {'language': language});
    final topics = response.data?['topics'];
    if (topics is! List) return <LearningTopic>[];
    return topics.whereType<Map>().map((item) => LearningTopic(id: item['id']?.toString() ?? '', name: item['name']?.toString() ?? '')).where((item) => item.id.isNotEmpty && item.name.isNotEmpty).toList(growable: false);
  });

  @override
  Future<LearningItem> getContent(String id, {String? studentProfileId}) => _request(() async {
    final response = await client.dio.get<Map<String, dynamic>>('/learning/content/${Uri.encodeComponent(id)}', queryParameters: {if (studentProfileId != null) 'studentProfileId': studentProfileId});
    return LearningItem.fromJson(_map(response.data?['content']));
  });

  @override
  Future<PlaybackGrant> requestPlayback(String id, {String? studentProfileId}) => _request(() async {
    final response = await client.dio.get<Map<String, dynamic>>('/learning/content/${Uri.encodeComponent(id)}/media-access', queryParameters: {if (studentProfileId != null) 'studentProfileId': studentProfileId});
    final data = response.data ?? const <String, dynamic>{};
    final url = Uri.tryParse(data['url']?.toString() ?? '');
    if (url == null || url.scheme != 'https' || !url.hasAuthority || url.userInfo.isNotEmpty || url.fragment.isNotEmpty) {
      throw const LearningServiceException('MEDIA_RESPONSE_INVALID', null);
    }
    return PlaybackGrant(
      url: url,
      expiresAt: DateTime.tryParse(data['expiresAt']?.toString() ?? '') ?? DateTime.fromMillisecondsSinceEpoch(0),
      mediaType: data['mediaType'] == 'video' ? LearningMediaType.video : LearningMediaType.audio,
      durationSeconds: data['durationSeconds'] is num ? (data['durationSeconds'] as num).toInt() : null,
    );
  });

  @override
  Future<Uri> requestThumbnail(String id, {String? studentProfileId}) => _request(() async {
    final response = await client.dio.get<Map<String, dynamic>>('/learning/content/${Uri.encodeComponent(id)}/thumbnail-access', queryParameters: {if (studentProfileId != null) 'studentProfileId': studentProfileId});
    final uri = Uri.tryParse(response.data?['url']?.toString() ?? '');
    if (uri == null || uri.scheme != 'https' || !uri.hasAuthority || uri.userInfo.isNotEmpty || uri.fragment.isNotEmpty) {
      throw const LearningServiceException('MEDIA_RESPONSE_INVALID', null);
    }
    return uri;
  });
}

class UnconfiguredLearningRepository implements LearningRepository {
  const UnconfiguredLearningRepository();
  Never _unavailable() => throw const LearningServiceException('LEARNING_UNAVAILABLE', null);
  @override
  Future<LearningCatalog> listContent({String? query, String? topicId, String? programmeId, String? ageBand, String? language, String? studentProfileId, int offset = 0}) async => _unavailable();
  @override
  Future<List<LearningTopic>> listTopics({required String language}) async => _unavailable();
  @override
  Future<LearningItem> getContent(String id, {String? studentProfileId}) async => _unavailable();
  @override
  Future<PlaybackGrant> requestPlayback(String id, {String? studentProfileId}) async => _unavailable();
  @override
  Future<Uri> requestThumbnail(String id, {String? studentProfileId}) async => _unavailable();
}
