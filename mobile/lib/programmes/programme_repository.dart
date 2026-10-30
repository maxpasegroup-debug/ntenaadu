import 'package:dio/dio.dart';
import '../network/api_client.dart';
import 'programme_models.dart';

class ProgrammeServiceException implements Exception {
  const ProgrammeServiceException(this.code);
  final String code;
}

abstract interface class ProgrammeRepository {
  Future<List<ProgrammeSummary>> list({String? query, String? language, String? studentProfileId});
  Future<ProgrammeDetails> details(String id, {String? studentProfileId});
  Future<String> enroll(String id, String studentProfileId);
  Future<void> updateActivity(String programmeId, String activityId, String studentProfileId, String status);
}

class ProgrammeApiRepository implements ProgrammeRepository {
  ProgrammeApiRepository(this.client);
  final ApiClient client;
  Future<T> _request<T>(Future<T> Function() call) async {
    try { return await call(); }
    on NteApiException catch (e) { throw ProgrammeServiceException(e.code); }
    on DioException catch (e) { throw ProgrammeServiceException(ApiClient.fromDio(e).code); }
    catch (e) { if (e is ProgrammeServiceException) rethrow; throw const ProgrammeServiceException('SERVICE_UNAVAILABLE'); }
  }
  Map<String, dynamic> _map(dynamic raw) => Map<String, dynamic>.from(raw as Map);
  @override
  Future<List<ProgrammeSummary>> list({String? query, String? language, String? studentProfileId}) => _request(() async {
    final response = await client.dio.get<Map<String, dynamic>>('/programmes', queryParameters: {
      if (query?.trim().isNotEmpty == true) 'q': query!.trim(), if (language?.isNotEmpty == true) 'language': language,
      if (studentProfileId != null) 'studentProfileId': studentProfileId,
    });
    final values = response.data?['programmes'];
    return values is List ? values.whereType<Map>().map((e) => ProgrammeSummary.fromJson(Map<String, dynamic>.from(e))).where((e) => e.id.isNotEmpty).toList(growable: false) : const [];
  });
  @override
  Future<ProgrammeDetails> details(String id, {String? studentProfileId}) => _request(() async {
    final response = await client.dio.get<Map<String, dynamic>>('/programmes/${Uri.encodeComponent(id)}', queryParameters: {if (studentProfileId != null) 'studentProfileId': studentProfileId});
    final raw = _map(response.data?['programme']);
    final activities = raw['activities'];
    final modules = raw['modules'];
    return ProgrammeDetails(programme: ProgrammeSummary.fromJson(raw), modules: modules is List ? modules.whereType<Map>().map((e) => ProgrammeModule.fromJson(Map<String, dynamic>.from(e))).toList(growable: false) : const [], activities: activities is List ? activities.whereType<Map>().map((e) => ProgrammeActivity.fromJson(Map<String, dynamic>.from(e))).toList(growable: false) : const [], enrollmentStatus: raw['enrollmentStatus']?.toString());
  });
  @override
  Future<String> enroll(String id, String studentProfileId) => _request(() async {
    final response = await client.dio.post<Map<String, dynamic>>('/programmes/${Uri.encodeComponent(id)}/enrolments', data: {'studentProfileId': studentProfileId});
    return response.data?['enrollmentStatus']?.toString() ?? 'active';
  });
  @override
  Future<void> updateActivity(String programmeId, String activityId, String studentProfileId, String status) => _request(() async {
    await client.dio.put('/programmes/${Uri.encodeComponent(programmeId)}/activities/${Uri.encodeComponent(activityId)}/progress', data: {'studentProfileId': studentProfileId, 'status': status});
  });
}

class UnconfiguredProgrammeRepository implements ProgrammeRepository {
  const UnconfiguredProgrammeRepository();
  Never _fail() => throw const ProgrammeServiceException('SERVICE_UNAVAILABLE');
  @override Future<List<ProgrammeSummary>> list({String? query, String? language, String? studentProfileId}) async => _fail();
  @override Future<ProgrammeDetails> details(String id, {String? studentProfileId}) async => _fail();
  @override Future<String> enroll(String id, String studentProfileId) async => _fail();
  @override Future<void> updateActivity(String programmeId, String activityId, String studentProfileId, String status) async => _fail();
}
