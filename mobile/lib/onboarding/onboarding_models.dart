enum GuardianRelationshipStatus { draftOnly, pendingConsent, active, revoked, archived }

enum GuardianConsentStatus { policyNotConfigured, notRecorded, pendingVerification, recorded, revoked }

enum StudentAgeGroup { child, youth }

class GuardianProfileDraft {
  const GuardianProfileDraft({required this.name, required this.contact});

  final String name;
  final String contact;
}

/// A local, unsaved form draft. It is deliberately not an account record.
class StudentProfileDraft {
  const StudentProfileDraft({
    required this.localId,
    required this.preferredName,
    required this.ageGroup,
    required this.preferredLanguage,
    this.relationshipId,
    this.persisted = false,
    this.profileStatus = 'draft',
    this.relationshipStatus = GuardianRelationshipStatus.draftOnly,
    this.consentStatus = GuardianConsentStatus.notRecorded,
  });

  final String localId;
  final String preferredName;
  final StudentAgeGroup ageGroup;
  final String preferredLanguage;
  final String? relationshipId;
  final bool persisted;
  final String profileStatus;
  final GuardianRelationshipStatus relationshipStatus;
  final GuardianConsentStatus consentStatus;

  StudentProfileDraft copyWith({
    String? preferredName,
    StudentAgeGroup? ageGroup,
    String? preferredLanguage,
    String? relationshipId,
    bool? persisted,
    String? profileStatus,
  }) => StudentProfileDraft(
    localId: localId,
    preferredName: preferredName ?? this.preferredName,
    ageGroup: ageGroup ?? this.ageGroup,
    preferredLanguage: preferredLanguage ?? this.preferredLanguage,
    relationshipId: relationshipId ?? this.relationshipId,
    persisted: persisted ?? this.persisted,
    profileStatus: profileStatus ?? this.profileStatus,
    relationshipStatus: relationshipStatus,
    consentStatus: consentStatus,
  );
}

class ConsentPolicyDocument {
  const ConsentPolicyDocument({
    required this.id,
    required this.version,
    required this.title,
    required this.body,
    required this.languageCode,
  });

  final String version;
  final String id;
  final String title;
  final String body;
  final String languageCode;
}

class GuardianChildRelationship {
  const GuardianChildRelationship({
    required this.guardianId,
    required this.studentId,
    required this.status,
    required this.consentStatus,
    this.consentPolicyVersion,
    this.consentRecordedAt,
  });

  final String? guardianId;
  final String? studentId;
  final GuardianRelationshipStatus status;
  final GuardianConsentStatus consentStatus;
  final String? consentPolicyVersion;
  final DateTime? consentRecordedAt;
}
