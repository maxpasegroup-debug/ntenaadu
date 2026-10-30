import 'onboarding_models.dart';

class GuardianRegistrationRequest {
  const GuardianRegistrationRequest({
    required this.name,
    required this.contact,
    required this.password,
    required this.preferredLanguage,
    required this.students,
  });

  final String name;
  final String contact;
  final String password;
  final String preferredLanguage;
  final List<StudentProfileDraft> students;
}

class ParentAccount {
  const ParentAccount({required this.id, required this.name, required this.contact, required this.preferredLanguage});
  final String id;
  final String name;
  final String contact;
  final String preferredLanguage;
}

class RegistrationResult {
  const RegistrationResult({required this.verificationPending});
  final bool verificationPending;
}

class SignInRequest {
  const SignInRequest({required this.identifier, required this.password});

  final String identifier;
  final String password;
}

/// Integration boundary for NTE Naadu account services. The API adapter owns
/// request paths and response mapping; UI code depends on these operations.
abstract interface class OnboardingRepository {
  Future<RegistrationResult> registerGuardian(GuardianRegistrationRequest request);
  Future<void> completeVerification({required String contact, required String code});
  Future<ParentAccount> signIn(SignInRequest request);
  Future<ParentAccount?> restoreSession();
  Future<void> signOut();
  Future<void> updatePreferredLanguage(String languageCode);
  Future<void> requestAccountRecovery(String contact);
  Future<void> completeAccountRecovery({required String contact, required String code, required String newPassword});
  Future<List<StudentProfileDraft>> getStudentProfiles();
  Future<StudentProfileDraft> addStudentProfile(StudentProfileDraft profile);
  Future<void> updateStudentProfile(StudentProfileDraft profile);
  Future<void> removeStudentProfile(String studentId);
  Future<ConsentPolicyDocument> getConsentPolicy(String languageCode);
  Future<void> recordGuardianConsent(String relationshipId, ConsentPolicyDocument policy);
  Future<void> revokeGuardianConsent(String relationshipId);
}

class OnboardingIntegrationUnavailable implements Exception {
  const OnboardingIntegrationUnavailable();
}

/// Used until an Ente Naadu backend and reviewed consent policy are configured.
/// It never returns a simulated account, profile, or consent success.
class UnconfiguredOnboardingRepository implements OnboardingRepository {
  const UnconfiguredOnboardingRepository();

  Never _unavailable() => throw const OnboardingIntegrationUnavailable();

  @override
  Future<RegistrationResult> registerGuardian(GuardianRegistrationRequest request) async => _unavailable();

  @override
  Future<void> completeVerification({required String contact, required String code}) async => _unavailable();

  @override
  Future<ParentAccount> signIn(SignInRequest request) async => _unavailable();

  @override
  Future<ParentAccount?> restoreSession() async => _unavailable();

  @override
  Future<void> signOut() async => _unavailable();

  @override
  Future<void> updatePreferredLanguage(String languageCode) async => _unavailable();

  @override
  Future<void> requestAccountRecovery(String contact) async => _unavailable();

  @override
  Future<void> completeAccountRecovery({required String contact, required String code, required String newPassword}) async => _unavailable();

  @override
  Future<List<StudentProfileDraft>> getStudentProfiles() async => _unavailable();

  @override
  Future<StudentProfileDraft> addStudentProfile(StudentProfileDraft profile) async => _unavailable();

  @override
  Future<void> updateStudentProfile(StudentProfileDraft profile) async => _unavailable();

  @override
  Future<void> removeStudentProfile(String studentId) async => _unavailable();

  @override
  Future<ConsentPolicyDocument> getConsentPolicy(String languageCode) async => _unavailable();

  @override
  Future<void> recordGuardianConsent(String relationshipId, ConsentPolicyDocument policy) async => _unavailable();

  @override
  Future<void> revokeGuardianConsent(String relationshipId) async => _unavailable();
}
