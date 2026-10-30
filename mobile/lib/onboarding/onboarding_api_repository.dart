import 'package:dio/dio.dart';

import '../network/api_client.dart';
import 'onboarding_models.dart';
import 'onboarding_repository.dart';

class OnboardingServiceException implements Exception {
  const OnboardingServiceException(this.code, this.statusCode);
  final String code;
  final int? statusCode;
}

class OnboardingApiRepository implements OnboardingRepository {
  OnboardingApiRepository(this.client);
  final ApiClient client;

  Future<T> _request<T>(Future<T> Function() action) async {
    try { return await action(); }
    on NteApiException catch (error) { throw OnboardingServiceException(error.code, error.statusCode); }
    on FormatException { throw const OnboardingServiceException('API_CONFIGURATION_REQUIRED', null); }
    on DioException catch (error) {
      final apiError = ApiClient.fromDio(error);
      throw OnboardingServiceException(apiError.code, apiError.statusCode);
    }
  }

  Map<String, dynamic> _map(dynamic value) => Map<String, dynamic>.from(value as Map);

  @override
  Future<RegistrationResult> registerGuardian(GuardianRegistrationRequest request) => _request(() async {
    // Student drafts are intentionally not included in account registration.
    // They are created separately under an authenticated guardian relationship.
    final response = await client.dio.post<Map<String, dynamic>>('/auth/parents/registrations', data: {
      'name': request.name,
      'contact': request.contact,
      'password': request.password,
      'preferredLanguage': request.preferredLanguage,
    });
    return RegistrationResult(verificationPending: response.data?['status'] == 'verification_pending');
  });

  @override
  Future<void> completeVerification({required String contact, required String code}) => _request(() async {
    await client.dio.post<void>('/auth/verification/complete', data: {'contact': contact, 'code': code});
  });

  @override
  Future<ParentAccount> signIn(SignInRequest request) => _request(() async {
    final response = await client.dio.post<Map<String, dynamic>>('/auth/sessions', data: {
      'contact': request.identifier,
      'password': request.password,
    });
    final data = response.data ?? const <String, dynamic>{};
    final parent = _map(data['parent']);
    final accessToken = data['accessToken'];
    final refreshToken = data['refreshToken'];
    if (accessToken is! String || refreshToken is! String) {
      throw const OnboardingServiceException('SERVICE_RESPONSE_INVALID', null);
    }
    await client.saveTokens(accessToken, refreshToken);
    return _parent(parent);
  });

  @override
  Future<ParentAccount?> restoreSession() async {
    try {
      return await _request(() async {
        if (!await client.hasSessionToken()) return null;
        final response = await client.dio.get<Map<String, dynamic>>('/auth/me');
        return _parent(_map(response.data?['parent']));
      });
    } on OnboardingServiceException catch (error) {
      if (error.statusCode == 401) await client.clearTokens();
      rethrow;
    }
  }

  ParentAccount _parent(Map<String, dynamic> parent) => ParentAccount(
    id: parent['id'].toString(),
    name: parent['name'].toString(),
    contact: parent['contact'].toString(),
    preferredLanguage: parent['preferredLanguage'].toString(),
  );

  @override
  Future<void> signOut() => _request(() => client.signOut());

  @override
  Future<void> updatePreferredLanguage(String languageCode) => _request(() async {
    await client.dio.patch<void>('/auth/me/language', data: {'preferredLanguage': languageCode});
  });

  @override
  Future<void> requestAccountRecovery(String contact) => _request(() async {
    await client.dio.post<void>('/auth/recovery-requests', data: {'contact': contact});
  });

  @override
  Future<void> completeAccountRecovery({required String contact, required String code, required String newPassword}) => _request(() async {
    await client.dio.post<void>('/auth/recovery-completions', data: {
      'contact': contact,
      'code': code,
      'newPassword': newPassword,
    });
  });

  @override
  Future<List<StudentProfileDraft>> getStudentProfiles() => _request(() async {
    final response = await client.dio.get<Map<String, dynamic>>('/family/students');
    final students = response.data?['students'];
    if (students is! List) return <StudentProfileDraft>[];
    return students.map((item) => _student(_map(item))).toList();
  });

  @override
  Future<StudentProfileDraft> addStudentProfile(StudentProfileDraft profile) => _request(() async {
    final response = await client.dio.post<Map<String, dynamic>>('/family/students', data: {
      'preferredName': profile.preferredName,
      'ageGroup': _ageGroup(profile.ageGroup),
      'preferredLanguage': profile.preferredLanguage,
    });
    return _student(_map(response.data?['student']));
  });

  @override
  Future<void> updateStudentProfile(StudentProfileDraft profile) => _request(() async {
    await client.dio.patch<void>('/family/students/${Uri.encodeComponent(profile.localId)}', data: {
      'preferredName': profile.preferredName,
      'ageGroup': _ageGroup(profile.ageGroup),
      'preferredLanguage': profile.preferredLanguage,
    });
  });

  @override
  Future<void> removeStudentProfile(String studentId) => _request(() async {
    await client.dio.delete<void>('/family/students/${Uri.encodeComponent(studentId)}');
  });

  @override
  Future<ConsentPolicyDocument> getConsentPolicy(String languageCode) => _request(() async {
    final response = await client.dio.get<Map<String, dynamic>>('/family/consent-policy', queryParameters: {'language': languageCode});
    final policy = _map(response.data?['policy']);
    return ConsentPolicyDocument(
      id: policy['id'].toString(),
      version: policy['version'].toString(),
      languageCode: policy['languageCode'].toString(),
      title: policy['title'].toString(),
      body: policy['body'].toString(),
    );
  });

  @override
  Future<void> recordGuardianConsent(String relationshipId, ConsentPolicyDocument policy) => _request(() async {
    await client.dio.post<void>('/family/relationships/${Uri.encodeComponent(relationshipId)}/consent', data: {
      'confirm': true,
      'policyId': policy.id,
      'policyVersion': policy.version,
      'languageCode': policy.languageCode,
    });
  });

  @override
  Future<void> revokeGuardianConsent(String relationshipId) => _request(() async {
    await client.dio.post<void>('/family/relationships/${Uri.encodeComponent(relationshipId)}/consent/revocations', data: {'confirm': true});
  });

  StudentProfileDraft _student(Map<String, dynamic> json) {
    final ageGroup = json['ageGroup'] == 'youth' ? StudentAgeGroup.youth : StudentAgeGroup.child;
    final relationship = switch (json['relationshipStatus']) {
      'active' => GuardianRelationshipStatus.active,
      'revoked' => GuardianRelationshipStatus.revoked,
      'archived' => GuardianRelationshipStatus.archived,
      _ => GuardianRelationshipStatus.pendingConsent,
    };
    final consent = switch (json['consentStatus']) {
      'granted' => GuardianConsentStatus.recorded,
      'revoked' => GuardianConsentStatus.revoked,
      _ => GuardianConsentStatus.notRecorded,
    };
    return StudentProfileDraft(
      localId: json['id'].toString(),
      relationshipId: json['relationshipId']?.toString(),
      preferredName: json['preferredName'].toString(),
      ageGroup: ageGroup,
      preferredLanguage: json['preferredLanguage'].toString(),
      relationshipStatus: relationship,
      consentStatus: consent,
      persisted: true,
      profileStatus: json['profileStatus']?.toString() ?? 'pending_consent',
    );
  }

  String _ageGroup(StudentAgeGroup value) => value == StudentAgeGroup.child ? 'child' : 'youth';
}
