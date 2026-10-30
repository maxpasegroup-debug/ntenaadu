class PurchaseQuote {
  const PurchaseQuote({required this.programmeId, required this.programmeTitle, required this.purchaserName, required this.learnerName, required this.learnerId, required this.providerConfigured, required this.checkoutAvailable, required this.purchaseModelAvailable, this.amountMinor, this.currency, this.currencyExponent, this.purchaseType, this.termsVersion, this.terms});
  final String programmeId, programmeTitle, purchaserName, learnerName, learnerId;
  final int? amountMinor;
  final String? currency, purchaseType, termsVersion, terms;
  final int? currencyExponent;
  final bool providerConfigured, checkoutAvailable, purchaseModelAvailable;
  factory PurchaseQuote.fromJson(Map<String, dynamic> json) => PurchaseQuote(
    programmeId: json['programmeId']?.toString() ?? '', programmeTitle: json['programmeTitle']?.toString() ?? '',
    purchaserName: json['purchaserName']?.toString() ?? '', learnerName: json['learnerName']?.toString() ?? '', learnerId: json['learnerId']?.toString() ?? '',
    amountMinor: (json['amountMinor'] as num?)?.toInt(), currency: json['currency']?.toString(), currencyExponent: (json['currencyExponent'] as num?)?.toInt(), purchaseType: json['purchaseType']?.toString(),
    termsVersion: json['termsVersion']?.toString(), terms: json['terms']?.toString(), providerConfigured: json['providerConfigured'] == true,
    checkoutAvailable: json['checkoutAvailable'] == true, purchaseModelAvailable: json['purchaseModelAvailable'] == true,
  );
}

class PaymentOrderSummary {
  const PaymentOrderSummary({required this.orderId, required this.programmeId, required this.programmeTitle, required this.learnerId, required this.learnerName, required this.amountMinor, required this.currency, required this.currencyExponent, required this.status, required this.createdAt, this.verifiedAt});
  final String orderId, programmeId, programmeTitle, learnerId, learnerName, currency, status;
  final int currencyExponent;
  final int amountMinor;
  final DateTime? createdAt, verifiedAt;
  factory PaymentOrderSummary.fromJson(Map<String, dynamic> json) => PaymentOrderSummary(
    orderId: json['orderId']?.toString() ?? '', programmeId: json['programmeId']?.toString() ?? '', programmeTitle: json['programmeTitle']?.toString() ?? '',
    learnerId: json['learnerId']?.toString() ?? '', learnerName: json['learnerName']?.toString() ?? '', amountMinor: (json['amountMinor'] as num?)?.toInt() ?? 0, currency: json['currency']?.toString() ?? '',
    status: json['status']?.toString() ?? 'unavailable', currencyExponent: (json['currencyExponent'] as num?)?.toInt() ?? 2, createdAt: DateTime.tryParse(json['createdAt']?.toString() ?? ''), verifiedAt: DateTime.tryParse(json['verifiedAt']?.toString() ?? ''),
  );
}

class RefundSummary {
  const RefundSummary({required this.id, required this.reason, required this.status, this.amountMinor, this.currency});
  final String id, reason, status;
  final int? amountMinor;
  final String? currency;
  factory RefundSummary.fromJson(Map<String, dynamic> json) => RefundSummary(id: json['id']?.toString() ?? '', reason: json['reason']?.toString() ?? '', status: json['status']?.toString() ?? '', amountMinor: (json['amountMinor'] as num?)?.toInt(), currency: json['currency']?.toString());
}
