import 'package:dio/dio.dart';
import '../network/api_client.dart';
import 'payment_models.dart';

class PaymentServiceException implements Exception {
  const PaymentServiceException(this.code);
  final String code;
}

class PaymentOrderDetails {
  const PaymentOrderDetails({required this.order, required this.refunds});
  final PaymentOrderSummary order;
  final List<RefundSummary> refunds;
}

class CheckoutResponse {
  const CheckoutResponse({required this.order, this.checkoutUrl});
  final PaymentOrderSummary order;
  final Uri? checkoutUrl;
}

abstract interface class PaymentRepository {
  Future<PurchaseQuote> quote(String programmeId, String studentProfileId, String language);
  Future<CheckoutResponse> createOrder(String programmeId, String studentProfileId, String language, String idempotencyKey);
  Future<List<PaymentOrderSummary>> listOrders({String? studentProfileId});
  Future<PaymentOrderDetails> getOrder(String orderId);
  Future<String> requestRefund(String orderId, String reasonCode, {String? message});
}

class PaymentApiRepository implements PaymentRepository {
  PaymentApiRepository(this.client);
  final ApiClient client;
  Future<T> _request<T>(Future<T> Function() action) async {
    try { return await action(); }
    on NteApiException catch (e) { throw PaymentServiceException(e.code); }
    on DioException catch (e) { throw PaymentServiceException(ApiClient.fromDio(e).code); }
    catch (e) { if (e is PaymentServiceException) rethrow; throw const PaymentServiceException('SERVICE_UNAVAILABLE'); }
  }
  Map<String, dynamic> _map(dynamic value) => Map<String, dynamic>.from(value as Map);
  @override Future<PurchaseQuote> quote(String programmeId, String studentProfileId, String language) => _request(() async {
    final response = await client.dio.get<Map<String, dynamic>>('/payments/quote/${Uri.encodeComponent(programmeId)}', queryParameters: {'studentProfileId': studentProfileId, 'language': language});
    return PurchaseQuote.fromJson(_map(response.data?['quote']));
  });
  @override Future<CheckoutResponse> createOrder(String programmeId, String studentProfileId, String language, String idempotencyKey) => _request(() async {
    final response = await client.dio.post<Map<String, dynamic>>('/payments/orders/${Uri.encodeComponent(programmeId)}', data: {'studentProfileId': studentProfileId, 'language': language, 'idempotencyKey': idempotencyKey});
    final order = PaymentOrderSummary.fromJson(_map(response.data?['order']));
    final checkoutUrl = Uri.tryParse(response.data?['checkoutUrl']?.toString() ?? '');
    return CheckoutResponse(order: order, checkoutUrl: checkoutUrl?.scheme == 'https' && checkoutUrl!.hasAuthority ? checkoutUrl : null);
  });
  @override Future<List<PaymentOrderSummary>> listOrders({String? studentProfileId}) => _request(() async {
    final response = await client.dio.get<Map<String, dynamic>>('/payments/orders', queryParameters: {if (studentProfileId != null) 'studentProfileId': studentProfileId});
    final values = response.data?['orders'];
    return values is List ? values.whereType<Map>().map((item) => PaymentOrderSummary.fromJson(Map<String, dynamic>.from(item))).toList(growable: false) : const [];
  });
  @override Future<PaymentOrderDetails> getOrder(String orderId) => _request(() async {
    final response = await client.dio.get<Map<String, dynamic>>('/payments/orders/${Uri.encodeComponent(orderId)}');
    final data = response.data ?? const <String, dynamic>{};
    final rawRefunds = data['refunds'];
    return PaymentOrderDetails(order: PaymentOrderSummary.fromJson(_map(data['order'])), refunds: rawRefunds is List ? rawRefunds.whereType<Map>().map((item) => RefundSummary.fromJson(Map<String, dynamic>.from(item))).toList(growable: false) : const []);
  });
  @override Future<String> requestRefund(String orderId, String reasonCode, {String? message}) => _request(() async {
    final response = await client.dio.post<Map<String, dynamic>>('/payments/orders/${Uri.encodeComponent(orderId)}/refunds', data: {'reasonCode': reasonCode, if (message?.trim().isNotEmpty == true) 'message': message!.trim()});
    return _map(response.data?['refundRequest'])['status']?.toString() ?? 'requested';
  });
}

class UnconfiguredPaymentRepository implements PaymentRepository {
  const UnconfiguredPaymentRepository();
  Never _fail() => throw const PaymentServiceException('PAYMENT_PROVIDER_UNAVAILABLE');
  @override Future<PurchaseQuote> quote(String programmeId, String studentProfileId, String language) async => _fail();
  @override Future<CheckoutResponse> createOrder(String programmeId, String studentProfileId, String language, String idempotencyKey) async => _fail();
  @override Future<List<PaymentOrderSummary>> listOrders({String? studentProfileId}) async => _fail();
  @override Future<PaymentOrderDetails> getOrder(String orderId) async => _fail();
  @override Future<String> requestRefund(String orderId, String reasonCode, {String? message}) async => _fail();
}
