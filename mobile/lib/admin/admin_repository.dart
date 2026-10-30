import 'package:dio/dio.dart';
import '../network/api_client.dart';

class AdminException implements Exception { const AdminException(this.code); final String code; }

class AdminRepository {
  AdminRepository(this.client);
  final ApiClient client;

  Future<T> _call<T>(Future<T> Function() action) async {
    try { return await action(); }
    on NteApiException catch (e) { throw AdminException(e.code); }
    on DioException catch (e) { throw AdminException(ApiClient.fromDio(e).code); }
    on FormatException { throw const AdminException('API_CONFIGURATION_REQUIRED'); }
  }
  Map<String, dynamic> _map(dynamic value) => value is Map ? Map<String, dynamic>.from(value) : <String, dynamic>{};
  List<Map<String, dynamic>> _list(dynamic value) => value is List ? value.whereType<Map>().map(_map).toList() : <Map<String, dynamic>>[];

  Future<List<String>> capabilities() => _call(() async {
    final r = await client.dio.get<Map<String, dynamic>>('/admin/capabilities');
    return (r.data?['roles'] as List? ?? const []).whereType<String>().toList();
  });
  Future<Map<String, dynamic>> overview() => _call(() async => _map((await client.dio.get<Map<String, dynamic>>('/admin/overview')).data?['counts']));
  Future<Map<String, dynamic>> providerStatus() => _call(() async => _map((await client.dio.get<Map<String, dynamic>>('/admin/provider-status')).data));
  Future<List<Map<String, dynamic>>> members({String query = '', String status = '', int offset = 0}) => _call(() async => _list((await client.dio.get<Map<String, dynamic>>('/admin/members', queryParameters: {'q': query, 'limit': 100, 'offset': offset, if (status.isNotEmpty) 'status': status})).data?['members']));
  Future<void> setMemberStatus(String id, String status, String reason) => _call(() async { await client.dio.patch<void>('/admin/members/${Uri.encodeComponent(id)}/status', data: {'status': status, 'reason': reason}); });
  Future<List<Map<String, dynamic>>> audit({String eventType = '', String actorId = '', String from = '', String to = '', int offset = 0}) => _call(() async => _list((await client.dio.get<Map<String, dynamic>>('/admin/audit', queryParameters: {'limit': 50, 'offset': offset, if (eventType.isNotEmpty) 'eventType': eventType, if (actorId.isNotEmpty) 'actorId': actorId, if (from.isNotEmpty) 'from': from, if (to.isNotEmpty) 'to': to})).data?['events']));
  Future<List<Map<String, dynamic>>> safeguardingQueue(String reason, {int offset = 0}) => _call(() async => _list((await client.dio.get<Map<String, dynamic>>('/safeguarding/staff/reports', queryParameters: {'limit': 50, 'offset': offset, 'reason': reason})).data?['reports']));
  Future<Map<String, dynamic>> safeguardingCase(String id, String reason) => _call(() async => _map((await client.dio.get<Map<String, dynamic>>('/safeguarding/staff/reports/${Uri.encodeComponent(id)}', queryParameters: {'reason': reason})).data?['report']));
  Future<void> safeguardingAction(String id, String action, String reason, {String? note, String? assignedTo}) => _call(() async { await client.dio.post<void>('/safeguarding/staff/reports/${Uri.encodeComponent(id)}/actions', data: {'action': action, 'reason': reason, if (note != null && note.isNotEmpty) 'note': note, if (assignedTo != null) 'assignedTo': assignedTo}); });
  Future<List<Map<String, dynamic>>> contentItems() => _call(() async => _list((await client.dio.get<Map<String, dynamic>>('/admin/content/items')).data?['items']));
  Future<List<Map<String, dynamic>>> topics() => _call(() async => _list((await client.dio.get<Map<String, dynamic>>('/admin/content/topics')).data?['topics']));
  Future<List<Map<String, dynamic>>> programmes() => _call(() async => _list((await client.dio.get<Map<String, dynamic>>('/admin/programmes')).data?['programmes']));
  Future<void> createTopic(String id, String englishLabel) => _call(() async { await client.dio.post<void>('/admin/content/topics', data: {'topicId': id, 'labels': {'en': englishLabel}}); });
  Future<void> setTopicStatus(String id, String status, String reason) => _call(() async { await client.dio.post<void>('/admin/content/topics/${Uri.encodeComponent(id)}/publication', data: {'status': status, 'reason': reason}); });
  Future<void> createContent(Map<String,dynamic> data) => _call(() async { await client.dio.post<void>('/admin/content/items', data: data); });
  Future<void> createProgramme(Map<String,dynamic> data) => _call(() async { await client.dio.post<void>('/admin/programmes', data: data); });
  Future<void> createModule(String programmeId, Map<String,dynamic> data) => _call(() async { await client.dio.post<void>('/admin/programmes/${Uri.encodeComponent(programmeId)}/modules', data: data); });
  Future<void> createActivity(String programmeId, Map<String,dynamic> data) => _call(() async { await client.dio.post<void>('/admin/programmes/${Uri.encodeComponent(programmeId)}/activities', data: data); });
  Future<Map<String,dynamic>> programmeDetail(String id) => _call(() async => _map((await client.dio.get<Map<String,dynamic>>('/admin/programmes/${Uri.encodeComponent(id)}')).data?['programme']));
  Future<void> setComponentStatus(String programmeId, String componentId, bool module, String status, String reason) => _call(() async { await client.dio.post<void>('/admin/programmes/${Uri.encodeComponent(programmeId)}/${module ? 'modules' : 'activities'}/${Uri.encodeComponent(componentId)}/publication', data: {'status': status, 'reason': reason}); });
  Future<void> setContentStatus(String id, String status, String reason) => _call(() async { await client.dio.post<void>('/admin/content/items/${Uri.encodeComponent(id)}/publication', data: {'status': status, 'reason': reason}); });
  Future<void> setProgrammeStatus(String id, String status, String reason) => _call(() async { await client.dio.post<void>('/admin/programmes/${Uri.encodeComponent(id)}/publication', data: {'status': status, 'reason': reason}); });
  Future<List<Map<String, dynamic>>> refunds() => _call(() async => _list((await client.dio.get<Map<String, dynamic>>('/payments/support/refunds')).data?['refunds']));
  Future<List<Map<String, dynamic>>> financeOrders() => _call(() async => _list((await client.dio.get<Map<String, dynamic>>('/payments/support/orders')).data?['orders']));
  Future<List<Map<String, dynamic>>> orderAudit(String id) => _call(() async => _list((await client.dio.get<Map<String, dynamic>>('/payments/support/orders/${Uri.encodeComponent(id)}/audit')).data?['events']));
  Future<void> reviewRefund(String id, String note) => _call(() async { await client.dio.post<void>('/payments/support/refunds/${Uri.encodeComponent(id)}/review', data: {'note': note}); });
  Future<List<Map<String,dynamic>>> refundNotes(String id) => _call(() async => _list((await client.dio.get<Map<String,dynamic>>('/payments/support/refunds/${Uri.encodeComponent(id)}/notes')).data?['notes']));
  Future<Map<String, dynamic>> submitConcern({required String category, required String urgency, required String description}) => _call(() async => _map((await client.dio.post<Map<String, dynamic>>('/safeguarding/reports', data: {'category': category, 'urgency': urgency, 'description': description})).data?['report']));
  Future<Map<String, dynamic>> reporterStatus(String id) => _call(() async => _map((await client.dio.get<Map<String, dynamic>>('/safeguarding/reports/${Uri.encodeComponent(id)}/status')).data?['report']));
  Future<List<Map<String,dynamic>>> reporterReports() => _call(() async => _list((await client.dio.get<Map<String,dynamic>>('/safeguarding/reports/mine')).data?['reports']));
}
