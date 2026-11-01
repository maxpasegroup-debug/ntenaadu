import 'package:flutter/material.dart';

/// Shared NTE Naadu visual tokens. Keep product colors and layout primitives
/// here so mobile and future browser surfaces can map to the same design.
abstract final class NteColors {
  static const saffron = Color(0xFFF3A66B);
  static const white = Color(0xFFFFFFFF);
  static const green = Color(0xFF4C8B69);
  static const ivory = Color(0xFFF6F3EC);
  static const forest = Color(0xFF263A30);
}

abstract final class NteSpacing {
  static const xs = 4.0;
  static const sm = 8.0;
  static const md = 12.0;
  static const lg = 16.0;
  static const xl = 24.0;
  static const page = 20.0;
}

abstract final class NteRadii {
  static const control = 12.0;
  static const card = 16.0;
  static const hero = 22.0;
}

abstract final class NteLayout {
  static const mobileContentMaxWidth = 640.0;
  static const onboardingContentMaxWidth = 560.0;
  static const adminContentMaxWidth = 900.0;
}

abstract final class NteTheme {
  static ThemeData light() {
    final base = ThemeData(useMaterial3: true);
    final scheme = ColorScheme.fromSeed(
      seedColor: NteColors.green,
      primary: NteColors.green,
      secondary: NteColors.saffron,
      surface: NteColors.white,
      onSurface: NteColors.forest,
    );

    return base.copyWith(
      scaffoldBackgroundColor: NteColors.ivory,
      colorScheme: scheme,
      textTheme: base.textTheme.apply(
        bodyColor: NteColors.forest,
        displayColor: NteColors.forest,
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: NteColors.ivory,
        foregroundColor: NteColors.forest,
        elevation: 0,
        centerTitle: false,
      ),
      cardTheme: CardThemeData(
        color: NteColors.white,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(NteRadii.card),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: NteColors.white,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: NteSpacing.lg,
          vertical: NteSpacing.md,
        ),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(NteRadii.control),
          borderSide: BorderSide.none,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(NteRadii.control),
          borderSide: const BorderSide(color: Color(0xFFD9DED8)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(NteRadii.control),
          borderSide: const BorderSide(color: NteColors.green, width: 1.5),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size.fromHeight(52),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(NteRadii.control),
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          minimumSize: const Size(48, 48),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(NteRadii.control),
          ),
        ),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: NteColors.white,
        indicatorColor: NteColors.green.withValues(alpha: 0.14),
        height: 72,
      ),
    );
  }
}
