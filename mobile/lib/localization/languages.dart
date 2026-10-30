import 'package:flutter/widgets.dart';

class AppLanguage {
  const AppLanguage({
    required this.locale,
    required this.englishName,
    required this.nativeName,
    required this.available,
  });

  final Locale locale;
  final String englishName;
  final String nativeName;
  final bool available;
}

/// India-wide language catalogue. Only languages with reviewed resources are
/// selectable; the others remain discoverable as coming soon.
const appLanguages = <AppLanguage>[
  AppLanguage(locale: Locale('as'), englishName: 'Assamese', nativeName: 'অসমীয়া', available: false),
  AppLanguage(locale: Locale('bn'), englishName: 'Bengali', nativeName: 'বাংলা', available: false),
  AppLanguage(locale: Locale('brx'), englishName: 'Bodo', nativeName: 'बड़ो', available: false),
  AppLanguage(locale: Locale('doi'), englishName: 'Dogri', nativeName: 'डोगरी', available: false),
  AppLanguage(locale: Locale('gu'), englishName: 'Gujarati', nativeName: 'ગુજરાતી', available: false),
  AppLanguage(locale: Locale('hi'), englishName: 'Hindi', nativeName: 'हिन्दी', available: true),
  AppLanguage(locale: Locale('kn'), englishName: 'Kannada', nativeName: 'ಕನ್ನಡ', available: false),
  AppLanguage(locale: Locale('ks'), englishName: 'Kashmiri', nativeName: 'कॉशुर / کٲشُر', available: false),
  AppLanguage(locale: Locale('kok'), englishName: 'Konkani', nativeName: 'कोंकणी', available: false),
  AppLanguage(locale: Locale('ml'), englishName: 'Malayalam', nativeName: 'മലയാളം', available: true),
  AppLanguage(locale: Locale('mni'), englishName: 'Manipuri (Meitei)', nativeName: 'মৈতৈলোন্', available: false),
  AppLanguage(locale: Locale('mai'), englishName: 'Maithili', nativeName: 'मैथिली', available: false),
  AppLanguage(locale: Locale('mr'), englishName: 'Marathi', nativeName: 'मराठी', available: false),
  AppLanguage(locale: Locale('ne'), englishName: 'Nepali', nativeName: 'नेपाली', available: false),
  AppLanguage(locale: Locale('or'), englishName: 'Odia', nativeName: 'ଓଡ଼ିଆ', available: false),
  AppLanguage(locale: Locale('pa'), englishName: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ', available: false),
  AppLanguage(locale: Locale('sa'), englishName: 'Sanskrit', nativeName: 'संस्कृतम्', available: false),
  AppLanguage(locale: Locale('sat'), englishName: 'Santali', nativeName: 'ᱥᱟᱱᱛᱟᱲᱤ', available: false),
  AppLanguage(locale: Locale('sd'), englishName: 'Sindhi', nativeName: 'سنڌي / सिन्धी', available: false),
  AppLanguage(locale: Locale('ta'), englishName: 'Tamil', nativeName: 'தமிழ்', available: true),
  AppLanguage(locale: Locale('te'), englishName: 'Telugu', nativeName: 'తెలుగు', available: false),
  AppLanguage(locale: Locale('ur'), englishName: 'Urdu', nativeName: 'اردو', available: false),
  AppLanguage(locale: Locale('en'), englishName: 'English', nativeName: 'English', available: true),
];

const appSupportedLocales = <Locale>[
  Locale('en'),
  Locale('hi'),
  Locale('ml'),
  Locale('ta'),
];

AppLanguage? languageFor(Locale locale) {
  for (final language in appLanguages) {
    if (language.locale.languageCode == locale.languageCode && language.available) {
      return language;
    }
  }
  return null;
}
