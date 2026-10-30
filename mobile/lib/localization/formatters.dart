import 'package:intl/intl.dart';

String formatDateForLocale(DateTime value, String languageCode) =>
    DateFormat.yMMMd(languageCode).format(value);

String formatTimeForLocale(DateTime value, String languageCode) =>
    DateFormat.jm(languageCode).format(value);

String formatNumberForLocale(num value, String languageCode) =>
    NumberFormat.decimalPattern(languageCode).format(value);

String formatInrForLocale(num value, String languageCode) =>
    NumberFormat.currency(locale: languageCode, name: 'INR', symbol: '₹').format(value);

String pluralForLocale(
  int count,
  String languageCode, {
  required String one,
  String? zero,
  String? two,
  String? few,
  String? many,
  required String other,
}) =>
    Intl.plural(
      count,
      locale: languageCode,
      zero: zero,
      one: one,
      two: two,
      few: few,
      many: many,
      other: other,
    );
