class ProgrammeSummary {
  const ProgrammeSummary({required this.id, required this.title, required this.description, required this.language, required this.languages, required this.ageBands, required this.access, required this.accessStatus, required this.activityCount, required this.objectives, this.durationMinutes, this.priceAmountMinor, this.priceCurrency, this.priceCurrencyExponent, this.purchaseType, this.enrollmentStatus});
  final String id, title, description, language, access, accessStatus;
  final List<String> languages, ageBands;
  final int activityCount;
  final int? durationMinutes;
  final List<String> objectives;
  final int? priceAmountMinor, priceCurrencyExponent;
  final String? priceCurrency, purchaseType;
  final String? enrollmentStatus;
  factory ProgrammeSummary.fromJson(Map<String, dynamic> json) => ProgrammeSummary(
    id: json['id']?.toString() ?? '', title: json['title']?.toString() ?? '', description: json['description']?.toString() ?? '',
    language: json['contentLanguage']?.toString() ?? 'en', languages: _strings(json['availableLanguages']), ageBands: _strings(json['ageBands']),
    access: json['accessRequirement']?.toString() ?? 'restricted', accessStatus: json['accessStatus']?.toString() ?? 'restricted',
    activityCount: (json['activityCount'] as num?)?.toInt() ?? 0, durationMinutes: (json['durationMinutes'] as num?)?.toInt(), objectives: _strings(json['learningObjectives']), priceAmountMinor: (json['priceAmountMinor'] as num?)?.toInt(), priceCurrencyExponent: (json['priceCurrencyExponent'] as num?)?.toInt(), priceCurrency: json['priceCurrency']?.toString(), purchaseType: json['purchaseType']?.toString(), enrollmentStatus: json['enrollmentStatus']?.toString(),
  );
}

class ProgrammeActivity {
  const ProgrammeActivity({required this.id, required this.title, required this.description, required this.language, this.moduleId, this.learningContentId, this.status});
  final String id, title, description, language;
  final String? moduleId, learningContentId, status;
  factory ProgrammeActivity.fromJson(Map<String, dynamic> json) => ProgrammeActivity(
    id: json['id']?.toString() ?? '', title: json['title']?.toString() ?? '', description: json['description']?.toString() ?? '',
    language: json['contentLanguage']?.toString() ?? 'en', moduleId: json['moduleId']?.toString(),
    learningContentId: json['learningContentId']?.toString(), status: json['status']?.toString(),
  );
}

class ProgrammeDetails {
  const ProgrammeDetails({required this.programme, required this.modules, required this.activities, required this.enrollmentStatus});
  final ProgrammeSummary programme;
  final List<ProgrammeModule> modules;
  final List<ProgrammeActivity> activities;
  final String? enrollmentStatus;
}

class ProgrammeModule {
  const ProgrammeModule({required this.id, required this.title, required this.description});
  final String id, title, description;
  factory ProgrammeModule.fromJson(Map<String, dynamic> json) => ProgrammeModule(id: json['id']?.toString() ?? '', title: json['title']?.toString() ?? '', description: json['description']?.toString() ?? '');
}

List<String> _strings(Object? value) => value is List ? value.whereType<String>().toList(growable: false) : const [];
