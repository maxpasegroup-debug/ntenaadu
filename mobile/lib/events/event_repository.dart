import 'package:dio/dio.dart';
import '../network/api_client.dart';

class EventException implements Exception { const EventException(this.code); final String code; }
class EventRecord {
 const EventRecord({required this.id,required this.clubId,required this.title,required this.description,required this.startsAt,required this.endsAt,required this.locality,required this.ageBands,required this.capacity,required this.confirmedCount,required this.instructions,required this.status,required this.clubName,this.registrationId,this.registrationStatus,this.guardianApprovalStatus});
 final String id,clubId,title,description,locality,instructions,status,clubName; final DateTime? startsAt,endsAt; final List<String> ageBands; final int capacity,confirmedCount; final String? registrationId,registrationStatus,guardianApprovalStatus;
 int get available=> (capacity-confirmedCount).clamp(0,capacity).toInt();
 factory EventRecord.fromJson(Map<String,dynamic> j){final reg=j['registration'] is Map?Map<String,dynamic>.from(j['registration'] as Map):const <String,dynamic>{};return EventRecord(id:'${j['id']??''}',clubId:'${j['clubId']??''}',title:'${j['title']??''}',description:'${j['description']??''}',startsAt:DateTime.tryParse('${j['startsAt']??''}'),endsAt:DateTime.tryParse('${j['endsAt']??''}'),locality:'${j['approximateLocality']??''}',ageBands:j['ageBands'] is List?(j['ageBands'] as List).whereType<String>().toList():const [],capacity:(j['capacity'] as num?)?.toInt()??0,confirmedCount:(j['confirmedCount'] as num?)?.toInt()??0,instructions:'${j['participationInstructions']??''}',status:'${j['status']??''}',clubName:'${j['clubName']??''}',registrationId:reg['id']?.toString(),registrationStatus:reg['status']?.toString(),guardianApprovalStatus:reg['guardianApprovalStatus']?.toString());}
}
class EventRegistrationRecord {const EventRegistrationRecord({required this.id,required this.eventId,required this.title,required this.studentId,required this.studentName,required this.status,required this.guardianStatus,required this.startsAt,required this.eventStatus});final String id,eventId,title,studentId,studentName,status,guardianStatus,eventStatus;final DateTime? startsAt;}
class ManagedClub {const ManagedClub(this.id,this.name,this.ageBands);final String id,name;final List<String> ageBands;}
class EventRosterEntry {const EventRosterEntry(this.registrationId,this.studentName,this.ageGroup,this.attendance);final String registrationId,studentName,ageGroup;final String? attendance;}
class EventNotice {const EventNotice(this.id,this.body,this.createdAt,this.authorName);final String id,body,authorName;final DateTime? createdAt;}

abstract interface class EventRepository {
 Future<List<EventRecord>> list({required String view,String? clubId,String? studentId});
 Future<EventRecord> detail(String id,{String? studentId});
 Future<List<EventRegistrationRecord>> registrations({String? studentId});
 Future<EventRegistrationRecord> register(String eventId,String studentId);
 Future<EventRegistrationRecord> guardianDecision(String registrationId,String decision);
 Future<void> cancelRegistration(String registrationId);
 Future<List<ManagedClub>> managedClubs();
 Future<List<EventRecord>> managedEvents();
 Future<EventRecord> create(String clubId,Map<String,dynamic> payload);
 Future<EventRecord> update(String eventId,Map<String,dynamic> payload);
 Future<void> cancelEvent(String eventId,String reason);
 Future<List<EventRosterEntry>> roster(String eventId);
 Future<void> recordAttendance(String eventId,String registrationId,String status);
 Future<List<EventNotice>> announcements(String eventId,{String? studentId});
 Future<void> announce(String eventId,String body);
}
class EventApiRepository implements EventRepository {
 EventApiRepository(this.client);final ApiClient client;
 Future<T> _wrap<T>(Future<T> Function() task)async{try{return await task();}on NteApiException catch(e){throw EventException(e.code);}on DioException catch(e){throw EventException(ApiClient.fromDio(e).code);}on FormatException{throw const EventException('API_CONFIGURATION_REQUIRED');}}
 Map<String,dynamic> _map(dynamic v)=>Map<String,dynamic>.from(v as Map);
 @override Future<List<EventRecord>> list({required String view,String? clubId,String? studentId})=>_wrap(()async{final r=await client.dio.get<Map<String,dynamic>>('/events',queryParameters:{'view':view,if(clubId!=null)'clubId':clubId,if(studentId!=null)'studentProfileId':studentId});return (r.data?['events'] as List? ?? const []).whereType<Map>().map((v)=>EventRecord.fromJson(_map(v))).toList();});
 @override Future<EventRecord> detail(String id,{String? studentId})=>_wrap(()async{final r=await client.dio.get<Map<String,dynamic>>('/events/${Uri.encodeComponent(id)}',queryParameters:{if(studentId!=null)'studentProfileId':studentId});return EventRecord.fromJson(_map(r.data?['event'])..['registration']=r.data?['registration']);});
 @override Future<List<EventRegistrationRecord>> registrations({String? studentId})=>_wrap(()async{final r=await client.dio.get<Map<String,dynamic>>('/events/guardian/registrations',queryParameters:{if(studentId!=null)'studentProfileId':studentId});return (r.data?['registrations'] as List? ?? const []).whereType<Map>().map((v){final m=_map(v);return EventRegistrationRecord(id:'${m['id']??''}',eventId:'${m['eventId']??''}',title:'${m['eventTitle']??''}',studentId:'${m['studentId']??''}',studentName:'${m['studentName']??''}',status:'${m['status']??''}',guardianStatus:'${m['guardianApprovalStatus']??''}',startsAt:DateTime.tryParse('${m['startsAt']??''}'),eventStatus:'${m['eventStatus']??''}');}).toList();});
 @override Future<EventRegistrationRecord> register(String eventId,String studentId)=>_wrap(()async{final r=await client.dio.post<Map<String,dynamic>>('/events/${Uri.encodeComponent(eventId)}/registrations',data:{'studentProfileId':studentId});final m=_map(r.data?['registration']);return EventRegistrationRecord(id:'${m['id']??''}',eventId:'${m['eventId']??eventId}',title:'',studentId:studentId,studentName:'',status:'${m['status']??''}',guardianStatus:'${m['guardianApprovalStatus']??''}',startsAt:null,eventStatus:'published');});
 @override Future<EventRegistrationRecord> guardianDecision(String registrationId,String decision)=>_wrap(()async{final r=await client.dio.post<Map<String,dynamic>>('/events/registrations/${Uri.encodeComponent(registrationId)}/guardian-decision',data:{'decision':decision});final m=_map(r.data?['registration']);return EventRegistrationRecord(id:'${m['id']??registrationId}',eventId:'',title:'',studentId:'',studentName:'',status:'${m['status']??''}',guardianStatus:'${m['guardianApprovalStatus']??''}',startsAt:null,eventStatus:'published');});
 @override Future<void> cancelRegistration(String id)=>_wrap(()async{await client.dio.post<void>('/events/registrations/${Uri.encodeComponent(id)}/cancellation');});
 @override Future<List<ManagedClub>> managedClubs()=>_wrap(()async{final r=await client.dio.get<Map<String,dynamic>>('/events/leader/clubs');return (r.data?['clubs'] as List? ?? const []).whereType<Map>().map((v){final m=_map(v);return ManagedClub('${m['id']??''}','${m['name']??''}',m['ageBands'] is List?(m['ageBands'] as List).whereType<String>().toList():const []);}).toList();});
 @override Future<List<EventRecord>> managedEvents()=>_wrap(()async{final r=await client.dio.get<Map<String,dynamic>>('/events/leader/managed');return (r.data?['events'] as List? ?? const []).whereType<Map>().map((v)=>EventRecord.fromJson(_map(v))).toList();});
 @override Future<EventRecord> create(String clubId,Map<String,dynamic> payload)=>_wrap(()async{final r=await client.dio.post<Map<String,dynamic>>('/clubs/${Uri.encodeComponent(clubId)}/events',data:payload);return EventRecord.fromJson(_map(r.data?['event']));});
 @override Future<EventRecord> update(String id,Map<String,dynamic> payload)=>_wrap(()async{final r=await client.dio.patch<Map<String,dynamic>>('/events/${Uri.encodeComponent(id)}',data:payload);return EventRecord.fromJson(_map(r.data?['event']));});
 @override Future<void> cancelEvent(String id,String reason)=>_wrap(()async{await client.dio.post<void>('/events/${Uri.encodeComponent(id)}/cancellation',data:{'reason':reason});});
 @override Future<List<EventRosterEntry>> roster(String id)=>_wrap(()async{final r=await client.dio.get<Map<String,dynamic>>('/events/${Uri.encodeComponent(id)}/roster');return (r.data?['roster'] as List? ?? const []).whereType<Map>().map((v){final m=_map(v);return EventRosterEntry('${m['registrationId']??''}','${m['studentName']??''}','${m['ageGroup']??''}',m['attendanceStatus']?.toString());}).toList();});
 @override Future<void> recordAttendance(String eventId,String registrationId,String status)=>_wrap(()async{await client.dio.patch<void>('/events/${Uri.encodeComponent(eventId)}/attendance/${Uri.encodeComponent(registrationId)}',data:{'status':status});});
 @override Future<List<EventNotice>> announcements(String id,{String? studentId})=>_wrap(()async{final r=await client.dio.get<Map<String,dynamic>>('/events/${Uri.encodeComponent(id)}/announcements',queryParameters:{if(studentId!=null)'studentProfileId':studentId});return (r.data?['announcements'] as List? ?? const []).whereType<Map>().map((v){final m=_map(v);return EventNotice('${m['id']??''}','${m['body']??''}',DateTime.tryParse('${m['createdAt']??''}'),'${m['authorName']??''}');}).toList();});
 @override Future<void> announce(String id,String body)=>_wrap(()async{await client.dio.post<void>('/events/${Uri.encodeComponent(id)}/announcements',data:{'body':body});});
}
