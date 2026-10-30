import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'languages.dart';

class LocaleController extends ChangeNotifier {
  LocaleController(this._preferences);

  static const _preferenceKey = 'nte_naadu.ui_language';
  static const defaultLocale = Locale('en');

  final SharedPreferencesAsync _preferences;
  Locale _locale = defaultLocale;
  Map<String, String> _english = const {};
  Map<String, String> _current = const {};
  bool _initialized = false;

  Locale get locale => _locale;
  bool get initialized => _initialized;

  Future<void> initialize() async {
    final saved = await _preferences.getString(_preferenceKey);
    final requested = saved == null ? defaultLocale : Locale(saved);
    final language = languageFor(requested);
    _english = await _loadResource(defaultLocale);
    _locale = language?.locale ?? defaultLocale;
    _current = _locale == defaultLocale ? _english : await _loadResource(_locale);
    _initialized = true;
    notifyListeners();
  }

  Future<void> setLocale(Locale requested) async {
    final language = languageFor(requested);
    if (language == null) return;
    final resources = language.locale == defaultLocale
        ? _english
        : await _loadResource(language.locale);
    await _preferences.setString(_preferenceKey, language.locale.languageCode);
    _locale = language.locale;
    _current = resources;
    notifyListeners();
  }

  /// Missing keys fall back individually to English. This is a safety net for
  /// incomplete packs, not a claim that the selected pack is fully translated.
  String text(String key, [Map<String, Object?> arguments = const {}]) {
    var value = _current[key] ?? _english[key] ?? key;
    for (final entry in arguments.entries) {
      value = value.replaceAll('{${entry.key}}', entry.value?.toString() ?? '');
    }
    return value;
  }

  Future<Map<String, String>> _loadResource(Locale locale) async {
    try {
      final raw = await rootBundle.loadString('assets/l10n/${locale.languageCode}.json');
      final decoded = jsonDecode(raw) as Map<String, dynamic>;
      return decoded.map((key, value) => MapEntry(key, value.toString()));
    } on Object catch (error, stackTrace) {
      FlutterError.reportError(FlutterErrorDetails(
        exception: error,
        stack: stackTrace,
        library: 'NTE Naadu localization',
        context: ErrorDescription('while loading ${locale.languageCode} locale resources'),
      ));
      return const {};
    }
  }
}
