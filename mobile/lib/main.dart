import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'admin/admin_repository.dart';
import 'admin/admin_console.dart';

import 'localization/languages.dart';
import 'localization/locale_controller.dart';
import 'dashboard/dashboard_screens.dart';
import 'learning/learning_repository.dart';
import 'clubs/club_repository.dart';
import 'events/event_repository.dart';
import 'programmes/programme_repository.dart';
import 'payments/payment_repository.dart';
import 'network/api_client.dart';
import 'onboarding/onboarding_api_repository.dart';
import 'onboarding/onboarding_screens.dart';
import 'onboarding/onboarding_session.dart';

const _forest = Color(0xFF263A30);
const _green = Color(0xFF4C8B69);
const _saffron = Color(0xFFF3A66B);
const _ivory = Color(0xFFF6F3EC);

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initializeDateFormatting();
  final localeController = LocaleController(SharedPreferencesAsync());
  await localeController.initialize();
  final apiClient = ApiClient();
  final onboardingSession = OnboardingSession(
    repository: OnboardingApiRepository(apiClient),
    learningRepository: LearningApiRepository(apiClient),
    clubRepository: ClubApiRepository(apiClient),
    eventRepository: EventApiRepository(apiClient),
    programmeRepository: ProgrammeApiRepository(apiClient),
    paymentRepository: PaymentApiRepository(apiClient),
    adminRepository: AdminRepository(apiClient),
  );
  runApp(NteNaaduApp(
    localeController: localeController,
    onboardingSession: onboardingSession,
  ));
  onboardingSession.restoreSession();
}

class NteNaaduApp extends StatelessWidget {
  const NteNaaduApp({super.key, required this.localeController, required this.onboardingSession});

  final LocaleController localeController;
  final OnboardingSession onboardingSession;

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: Listenable.merge([localeController, onboardingSession]),
    builder: (context, _) => MaterialApp(
      title: localeController.text('brand.name'),
      debugShowCheckedModeBanner: false,
      locale: localeController.locale,
      supportedLocales: appSupportedLocales,
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      theme: ThemeData(
        useMaterial3: true,
        scaffoldBackgroundColor: _ivory,
        colorScheme: ColorScheme.fromSeed(
          seedColor: _green,
          primary: _green,
          secondary: _saffron,
          surface: Colors.white,
          onSurface: _forest,
        ),
        textTheme: ThemeData.light().textTheme.apply(bodyColor: _forest, displayColor: _forest),
        filledButtonTheme: FilledButtonThemeData(
          style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(52)),
        ),
      ),
      home: !onboardingSession.sessionRestoreComplete
          ? Scaffold(body: SafeArea(child: Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
              const CircularProgressIndicator(), const SizedBox(height: 12), Text(localeController.text('status.loading')),
            ]))))
          : onboardingSession.account == null
              ? WelcomeScreen(locale: localeController, session: onboardingSession)
              : DashboardScreen(
                  locale: localeController,
                  session: onboardingSession,
                  familyBuilder: (_) => FamilyProfilesScreen(locale: localeController, session: onboardingSession),
                  settingsBuilder: (_) => ProfileSettingsScreen(locale: localeController, session: onboardingSession),
                  adminBuilder: (_) => AdminConsoleScreen(locale: localeController, session: onboardingSession),
                ),
    ),
  );
}

