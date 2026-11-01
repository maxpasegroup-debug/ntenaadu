import 'package:dio/dio.dart';
import '../network/api_client.dart';

class CommunityException implements Exception { const CommunityException(this.code); final String code; }
class CommunityRepository {
  CommunityRepository(this.client);
  final ApiClient client;
  Future<T> _call<T>(Future<T> Function() action) async { try { return await action(); } on NteApiException catch(e) { throw CommunityException(e.code); } on DioException catch(e) { throw CommunityException(ApiClient.fromDio(e).code); } on FormatException { throw const CommunityException('API_CONFIGURATION_REQUIRED'); } }
  Map<String,dynamic> _map(dynamic value)=>value is Map?Map<String,dynamic>.from(value):<String,dynamic>{};
  List<Map<String,dynamic>> _list(dynamic value)=>value is List?value.whereType<Map>().map(_map).toList():<Map<String,dynamic>>[];
  Future<List<Map<String,dynamic>>> discover({String query='',String? studentId})=>_call(()async=>_list((await client.dio.get<Map<String,dynamic>>('/communities',queryParameters:{if(query.trim().isNotEmpty)'q':query.trim(),if(studentId!=null)'studentProfileId':studentId})).data?['communities']));
  Future<List<Map<String,dynamic>>> mine()=>_call(()async=>_list((await client.dio.get<Map<String,dynamic>>('/communities/mine')).data?['memberships']));
  Future<Map<String,dynamic>> request(String id,{String? studentId})=>_call(()async=>_map((await client.dio.post<Map<String,dynamic>>('/communities/${Uri.encodeComponent(id)}/membership-requests',data:{if(studentId!=null)'studentProfileId':studentId})).data?['membership']));
  Future<Map<String,dynamic>> guardianDecision(String id,String decision)=>_call(()async=>_map((await client.dio.post<Map<String,dynamic>>('/communities/membership-requests/${Uri.encodeComponent(id)}/guardian-decision',data:{'decision':decision})).data?['membership']));
  Future<Map<String,dynamic>> guardianDecision(String id,String decision)=>_call(()async=>_map((await client.dio.post<Map<String,dynamic>>('/communities/membership-requests/${Uri.encodeComponent(id)}/guardian-decision',data:{'decision':decision})).data?['membership']));
  Future<List<Map<String,dynamic>>> announcements(String id,{String? studentId})=>_call(()async=>_list((await client.dio.get<Map<String,dynamic>>('/communities/${Uri.encodeComponent(id)}/announcements',queryParameters:{if(studentId!=null)'studentProfileId':studentId})).data?['announcements']));
  Future<List<Map<String,dynamic>>> participation({String? studentId})=>_call(()async=>_list((await client.dio.get<Map<String,dynamic>>('/communities/me/participation',queryParameters:{if(studentId!=null)'studentProfileId':studentId})).data?['participation']));
  Future<List<Map<String,dynamic>>> introductions()=>_call(()async=>_list((await client.dio.get<Map<String,dynamic>>('/communities/me/introductions')).data?['introductions']));
  Future<List<Map<String,dynamic>>> capabilities()=>_call(()async=>_list((await client.dio.get<Map<String,dynamic>>('/communities/me/capabilities')).data?['appointments']));
  Future<List<Map<String,dynamic>>> membershipQueue(String communityId)=>_call(()async=>_list((await client.dio.get<Map<String,dynamic>>('/communities/${Uri.encodeComponent(communityId)}/membership-requests')).data?['requests']));
  Future<void> decideMembership(String communityId,String membershipId,String decision)=>_call(()async{await client.dio.post<void>('/communities/${Uri.encodeComponent(communityId)}/membership-requests/${Uri.encodeComponent(membershipId)}/decision',data:{'decision':decision});});
  Future<void> publishAnnouncement(String communityId,String body)=>_call(()async{await client.dio.post<void>('/communities/${Uri.encodeComponent(communityId)}/announcements',data:{'body':body});});
  Future<void> cancelMembership(String id)=>_call(()async{await client.dio.post<void>('/communities/memberships/${Uri.encodeComponent(id)}/cancellation');});
  Future<bool> networkingPreference(bool enabled)=>_call(()async{final r=await client.dio.patch<Map<String,dynamic>>('/communities/me/networking-preference',data:{'enabled':enabled});return r.data?['enabled']==true;});
  Future<Map<String,dynamic>> introduce(String communityId,String accountId,String message)=>_call(()async=>_map((await client.dio.post<Map<String,dynamic>>('/communities/${Uri.encodeComponent(communityId)}/introductions',data:{'recipientAccountId':accountId,'message':message})).data?['introduction']));
  Future<void> decideIntroduction(String id,String decision)=>_call(()async{await client.dio.post<void>('/communities/introductions/${Uri.encodeComponent(id)}/decision',data:{'decision':decision});});
}
