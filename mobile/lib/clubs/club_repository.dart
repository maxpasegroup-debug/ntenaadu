import 'package:dio/dio.dart';
import '../network/api_client.dart';

class ClubException implements Exception { const ClubException(this.code); final String code; }
class ClubRecord {
  const ClubRecord({required this.id, required this.name, required this.purpose, required this.locality, required this.format, required this.ageBands, required this.status, this.leaders = const [], this.membershipStatus = 'none'});
  final String id, name, purpose, locality, format, status, membershipStatus;
  final List<String> ageBands, leaders;
  factory ClubRecord.fromJson(Map<String,dynamic> j) => ClubRecord(id: '${j['id'] ?? ''}', name: '${j['name'] ?? ''}', purpose: '${j['purpose'] ?? ''}', locality: '${j['approximateLocality'] ?? ''}', format: '${j['meetingFormat'] ?? ''}', ageBands: _strings(j['ageBands']), status: '${j['status'] ?? ''}', leaders: j['leaders'] is List ? (j['leaders'] as List).whereType<Map>().map((e) => '${e['name'] ?? ''}').toList() : const [], membershipStatus: '${j['membershipStatus'] ?? 'none'}');
}
class ClubItem { const ClubItem(this.id, this.name, this.text, this.status, {this.aux = ''}); final String id,name,text,status,aux; }
List<String> _strings(dynamic v) => v is List ? v.whereType<String>().toList() : const [];

abstract interface class ClubRepository {
 Future<List<ClubRecord>> discover({String query = '', String locality = '', String? studentId});
 Future<ClubRecord> detail(String id, {String? studentId});
 Future<ClubItem> requestMembership(String clubId, String studentId);
 Future<List<ClubItem>> guardianRequests();
 Future<ClubItem> guardianDecision(String requestId, String decision);
 Future<void> cancelMembership(String requestId);
 Future<List<ClubItem>> myApplications();
 Future<ClubItem> apply(Map<String,dynamic> data);
 Future<void> cancelApplication(String applicationId);
 Future<List<ClubItem>> leaderClubs();
 Future<List<ClubItem>> leaderRequests();
 Future<ClubItem> leaderDecision(String requestId,String decision);
 Future<void> publishAnnouncement(String clubId,String body);
 Future<List<ClubItem>> announcements(String clubId,{String? studentId});
 Future<List<String>> capabilities();
 Future<List<ClubItem>> reviewQueue();
 Future<void> review(String id,String decision,String note);
 Future<List<ClubItem>> staffClubs();
 Future<void> moderate(String id,String action,String reason);
}
class ClubApiRepository implements ClubRepository {
 ClubApiRepository(this.client); final ApiClient client;
 Future<T> _wrap<T>(Future<T> Function() f) async { try{return await f();} on NteApiException catch(e){throw ClubException(e.code);} on DioException catch(e){throw ClubException(ApiClient.fromDio(e).code);} on FormatException {throw const ClubException('API_CONFIGURATION_REQUIRED');} }
 Map<String,dynamic> _map(dynamic d)=>Map<String,dynamic>.from(d as Map);
 List<ClubItem> _items(dynamic d,String key)=>d is List?d.whereType<Map>().map((e){final m=Map<String,dynamic>.from(e);return ClubItem('${m['id']??''}','${m['name']??m['clubName']??''}','${m['purpose']??m['body']??m['studentName']??''}','${m['status']??''}',aux:'${m['ageGroup']??m['adultVerificationStatus']??''}');}).toList():const [];
 @override Future<List<ClubRecord>> discover({String query='',String locality='',String? studentId})=>_wrap(()async{final r=await client.dio.get<Map<String,dynamic>>('/clubs',queryParameters:{if(query.isNotEmpty)'q':query,if(locality.isNotEmpty)'locality':locality,if(studentId!=null)'studentProfileId':studentId});return (r.data?['clubs'] as List? ?? const []).whereType<Map>().map((e)=>ClubRecord.fromJson(_map(e))).toList();});
 @override Future<ClubRecord> detail(String id,{String? studentId})=>_wrap(()async{final r=await client.dio.get<Map<String,dynamic>>('/clubs/${Uri.encodeComponent(id)}',queryParameters:{if(studentId!=null)'studentProfileId':studentId});final c=_map(r.data?['club']);final m=r.data?['membershipStatus'];if(m is Map)c['membershipStatus']=m['status'];return ClubRecord.fromJson(c);});
 @override Future<ClubItem> requestMembership(String clubId,String studentId)=>_wrap(()async{final r=await client.dio.post<Map<String,dynamic>>('/clubs/${Uri.encodeComponent(clubId)}/membership-requests',data:{'studentProfileId':studentId});final m=_map(r.data?['request']);return ClubItem('${m['id']}','', '', '${m['status']}');});
 @override Future<List<ClubItem>> guardianRequests()=>_wrap(()async{final r=await client.dio.get<Map<String,dynamic>>('/clubs/guardian/requests');return _items(r.data?['requests'],'requests');});
 @override Future<ClubItem> guardianDecision(String id,String decision)=>_wrap(()async{final r=await client.dio.post<Map<String,dynamic>>('/clubs/membership-requests/${Uri.encodeComponent(id)}/guardian-decision',data:{'decision':decision});final m=_map(r.data?['request']);return ClubItem('${m['id']}','${m['clubName']??''}','${m['studentName']??''}','${m['status']}');});
 @override Future<void> cancelMembership(String id)=>_wrap(()async{await client.dio.post<void>('/clubs/membership-requests/${Uri.encodeComponent(id)}/cancellation');});
 @override Future<List<ClubItem>> myApplications()=>_wrap(()async{final r=await client.dio.get<Map<String,dynamic>>('/clubs/applications/mine');return _items(r.data?['applications'],'applications');});
 @override Future<ClubItem> apply(Map<String,dynamic> data)=>_wrap(()async{final r=await client.dio.post<Map<String,dynamic>>('/clubs/applications',data:data);final m=_map(r.data?['application']);return ClubItem('${m['id']}','${m['name']}','${m['purpose']}','${m['status']}',aux:'${m['adultVerificationStatus']}');});
 @override Future<void> cancelApplication(String id)=>_wrap(()async{await client.dio.post<void>('/clubs/applications/${Uri.encodeComponent(id)}/cancellation');});
 @override Future<List<ClubItem>> leaderClubs()=>_wrap(()async{final r=await client.dio.get<Map<String,dynamic>>('/clubs/leader/clubs');return _items(r.data?['clubs'],'clubs');});
 @override Future<List<ClubItem>> leaderRequests()=>_wrap(()async{final r=await client.dio.get<Map<String,dynamic>>('/clubs/leader/requests');return _items(r.data?['requests'],'requests');});
 @override Future<ClubItem> leaderDecision(String id,String decision)=>_wrap(()async{final r=await client.dio.post<Map<String,dynamic>>('/clubs/leader/membership-requests/${Uri.encodeComponent(id)}/decision',data:{'decision':decision});final m=_map(r.data?['request']);return ClubItem('${m['id']}','${m['clubName']??''}','${m['ageGroup']??''}','${m['status']}');});
 @override Future<void> publishAnnouncement(String clubId,String body)=>_wrap(()async{await client.dio.post<void>('/clubs/leader/clubs/${Uri.encodeComponent(clubId)}/announcements',data:{'body':body});});
 @override Future<List<ClubItem>> announcements(String clubId,{String? studentId})=>_wrap(()async{final r=await client.dio.get<Map<String,dynamic>>('/clubs/${Uri.encodeComponent(clubId)}/announcements',queryParameters:{if(studentId!=null)'studentProfileId':studentId});return _items(r.data?['announcements'],'announcements');});
 @override Future<List<String>> capabilities()=>_wrap(()async{final r=await client.dio.get<Map<String,dynamic>>('/clubs/me/capabilities');return _strings(r.data?['roles']);});
 @override Future<List<ClubItem>> reviewQueue()=>_wrap(()async{final r=await client.dio.get<Map<String,dynamic>>('/clubs/staff/applications');return _items(r.data?['applications'],'applications');});
 @override Future<void> review(String id,String decision,String note)=>_wrap(()async{await client.dio.post<void>('/clubs/staff/applications/${Uri.encodeComponent(id)}/review',data:{'decision':decision,'reviewNote':note});});
 @override Future<List<ClubItem>> staffClubs()=>_wrap(()async{final r=await client.dio.get<Map<String,dynamic>>('/clubs/staff/clubs');return _items(r.data?['clubs'],'clubs');});
 @override Future<void> moderate(String id,String action,String reason)=>_wrap(()async{await client.dio.post<void>('/clubs/staff/${Uri.encodeComponent(id)}/moderation',data:{'action':action,'reason':reason});});
}
