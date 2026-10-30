import 'package:flutter/foundation.dart';

import 'onboarding_models.dart';
import 'onboarding_repository.dart';
import '../learning/learning_repository.dart';
import '../clubs/club_repository.dart';
import '../events/event_repository.dart';
import '../programmes/programme_repository.dart';
import '../payments/payment_repository.dart';
import '../admin/admin_repository.dart';

/// Holds temporary onboarding drafts in memory and authenticated server-loaded
/// family data for the current account session. Drafts are never represented
/// as persisted account records.
class OnboardingSession extends ChangeNotifier {
  OnboardingSession({
    required this.repository,
    this.learningRepository = const UnconfiguredLearningRepository(),
    this.clubRepository,
    this.eventRepository,
    this.programmeRepository = const UnconfiguredProgrammeRepository(),
    this.paymentRepository = const UnconfiguredPaymentRepository(),
    this.adminRepository,
    this.consentPolicy,
  }) : _consentPolicy = consentPolicy;

  final OnboardingRepository repository;
  final LearningRepository learningRepository;
  final ClubRepository? clubRepository;
  final EventRepository? eventRepository;
  final ProgrammeRepository programmeRepository;
  final PaymentRepository paymentRepository;
  final AdminRepository? adminRepository;
  List<String> _staffRoles = const [];
  List<String> get staffRoles => List.unmodifiable(_staffRoles);
  ConsentPolicyDocument? _consentPolicy;
  bool _policyLoadFailed = false;
  int _policyRequest = 0;

  GuardianProfileDraft? _guardian;
  final List<StudentProfileDraft> _students = [];
  final List<StudentProfileDraft> _serverStudents = [];
  ParentAccount? _account;
  bool _familyLoadFailed = false;
  bool _sessionRestoreComplete = false;

  GuardianProfileDraft? get guardian => _guardian;
  ParentAccount? get account => _account;
  bool get familyLoadFailed => _familyLoadFailed;
  bool get sessionRestoreComplete => _sessionRestoreComplete;
  ConsentPolicyDocument? get consentPolicy => _consentPolicy;
  bool get policyLoadFailed => _policyLoadFailed;
  List<StudentProfileDraft> get students => List.unmodifiable([..._serverStudents, ..._students]);
  List<StudentProfileDraft> get localDrafts => List.unmodifiable(_students);
  List<StudentProfileDraft> get serverStudents => List.unmodifiable(_serverStudents);
  bool get hasConsentPolicy => _consentPolicy != null;

  Future<void> loadConsentPolicy(String languageCode) async {
    if (_account == null) return;
    final request = ++_policyRequest;
    try {
      final policy = await repository.getConsentPolicy(languageCode);
      if (request != _policyRequest) return;
      _consentPolicy = policy;
      _policyLoadFailed = false;
    } catch (_) {
      if (request != _policyRequest) return;
      _consentPolicy = null;
      _policyLoadFailed = true;
    }
    notifyListeners();
  }

  Future<ParentAccount> signIn(SignInRequest request) async {
    _account = await repository.signIn(request);
    await refreshStaffRoles();
    try {
      _serverStudents
        ..clear()
        ..addAll(await repository.getStudentProfiles());
      _familyLoadFailed = false;
    } catch (_) {
      _familyLoadFailed = true;
    }
    notifyListeners();
    return _account!;
  }

  Future<void> restoreSession() async {
    try {
      _account = await repository.restoreSession();
      if (_account != null) { await refreshServerStudents(); await refreshStaffRoles(); }
    } catch (_) {
      // Preserve secure tokens during transient network/API failures. The user
      // can retry from the family screen without losing the device locale.
    }
    _sessionRestoreComplete = true;
    notifyListeners();
  }

  Future<void> refreshServerStudents() async {
    if (_account == null) return;
    try {
      _serverStudents
        ..clear()
        ..addAll(await repository.getStudentProfiles());
      _familyLoadFailed = false;
    } catch (_) { _familyLoadFailed = true; }
    notifyListeners();
  }

  Future<void> signOut() async {
    try { await repository.signOut(); }
    finally {
      _account = null;
      _staffRoles = const [];
      _serverStudents.clear();
      _familyLoadFailed = false;
      _guardian = null;
      _students.clear();
      notifyListeners();
    }
  }

  Future<void> refreshStaffRoles() async {
    if (_account == null || adminRepository == null) { _staffRoles = const []; return; }
    try { _staffRoles = await adminRepository!.capabilities(); } catch (_) { _staffRoles = const []; }
    notifyListeners();
  }

  Future<void> syncLanguagePreference(String languageCode) async {
    if (_account == null) return;
    await repository.updatePreferredLanguage(languageCode);
    _account = ParentAccount(
      id: _account!.id,
      name: _account!.name,
      contact: _account!.contact,
      preferredLanguage: languageCode,
    );
    notifyListeners();
  }

  void saveGuardianDraft({required String name, required String contact}) {
    _guardian = GuardianProfileDraft(name: name.trim(), contact: contact.trim());
    notifyListeners();
  }

  void addStudentDraft(StudentProfileDraft profile) {
    _students.add(profile);
    notifyListeners();
  }

  void updateStudentDraft(StudentProfileDraft profile) {
    final index = _students.indexWhere((item) => item.localId == profile.localId);
    if (index < 0) return;
    _students[index] = profile;
    notifyListeners();
  }

  Future<StudentProfileDraft> saveStudentProfile(StudentProfileDraft profile) async {
    if (_account == null) {
      if (profile.persisted) throw StateError('A persisted profile requires an authenticated account.');
      if (_students.any((item) => item.localId == profile.localId)) updateStudentDraft(profile);
      else addStudentDraft(profile);
      return profile;
    }
    if (profile.persisted) {
      await repository.updateStudentProfile(profile);
      final index = _serverStudents.indexWhere((item) => item.localId == profile.localId);
      if (index >= 0) _serverStudents[index] = profile;
      notifyListeners();
      return profile;
    }
    final saved = await repository.addStudentProfile(profile);
    _serverStudents.add(saved);
    notifyListeners();
    return saved;
  }

  Future<void> removeStudent(StudentProfileDraft profile) async {
    if (profile.persisted) {
      await repository.removeStudentProfile(profile.localId);
      _serverStudents.removeWhere((item) => item.localId == profile.localId);
    } else {
      _students.removeWhere((item) => item.localId == profile.localId);
    }
    notifyListeners();
  }

  Future<void> grantConsent(String relationshipId, ConsentPolicyDocument policy) async {
    await repository.recordGuardianConsent(relationshipId, policy);
    await refreshServerStudents();
  }

  Future<void> revokeConsent(String relationshipId) async {
    await repository.revokeGuardianConsent(relationshipId);
    await refreshServerStudents();
  }

  void removeStudentDraft(String localId) {
    _students.removeWhere((item) => item.localId == localId);
    notifyListeners();
  }

  void clearDrafts() {
    _guardian = null;
    _students.clear();
    notifyListeners();
  }
}
