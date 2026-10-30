import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../localization/locale_controller.dart';
import 'payment_models.dart';
import 'payment_repository.dart';

const _forest = Color(0xFF263A30), _green = Color(0xFF4C8B69), _saffron = Color(0xFFF3A66B), _ivory = Color(0xFFF6F3EC);

class PurchaseReviewScreen extends StatefulWidget {
  const PurchaseReviewScreen({required this.locale, required this.repository, required this.programmeId, required this.studentProfileId, super.key});
  final LocaleController locale; final PaymentRepository repository; final String programmeId, studentProfileId;
  @override State<PurchaseReviewScreen> createState() => _PurchaseReviewScreenState();
}
class _PurchaseReviewScreenState extends State<PurchaseReviewScreen> {
  PurchaseQuote? _quote; bool _loading = true, _failed = false, _busy = false; String? _orderStatus;
  @override void initState() { super.initState(); _load(); }
  Future<void> _load() async { setState(() { _loading = true; _failed = false; }); try { final q = await widget.repository.quote(widget.programmeId, widget.studentProfileId, widget.locale.locale.languageCode); if (mounted) setState(() { _quote = q; _loading = false; }); } catch (_) { if (mounted) setState(() { _failed = true; _loading = false; }); } }
  Future<void> _startPurchase() async {
    final quote = _quote;
    if (quote == null || !quote.checkoutAvailable) return;
    setState(() => _busy = true);
    try {
      final key = '${DateTime.now().microsecondsSinceEpoch.toRadixString(36)}-${math.Random.secure().nextInt(1 << 32).toRadixString(36)}';
      final order = await widget.repository.createOrder(quote.programmeId, quote.learnerId, widget.locale.locale.languageCode, key);
      if (mounted) setState(() { _orderStatus = order.order.status; _busy = false; });
    } catch (_) { if (mounted) { setState(() => _busy = false); ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(widget.locale.text('payment.checkoutStartFailed')))); } }
  }
  @override Widget build(BuildContext context) {
    final t = widget.locale.text;
    return Scaffold(backgroundColor: _ivory, appBar: AppBar(backgroundColor: _ivory, foregroundColor: _forest, title: Text(t('payment.reviewTitle'))),
      body: _loading ? const Center(child: CircularProgressIndicator()) : _failed || _quote == null
        ? Center(child: Column(mainAxisSize: MainAxisSize.min, children: [Text(t('payment.quoteUnavailable')), TextButton(onPressed: _load, child: Text(t('action.retry')))]))
        : ListView(padding: const EdgeInsets.all(18), children: [
          Text(_quote!.programmeTitle, style: Theme.of(context).textTheme.headlineSmall?.copyWith(color: _forest, fontWeight: FontWeight.w700)),
          const SizedBox(height: 14), _ReviewRow(label: t('payment.purchaser'), value: _quote!.purchaserName),
          _ReviewRow(label: t('payment.learner'), value: _quote!.learnerName),
          _ReviewRow(label: t('payment.purchaseType'), value: t(_quote!.purchaseType == 'one_time' ? 'payment.oneTime' : 'payment.notConfigured')),
          const Divider(height: 26),
          _ReviewRow(label: t('payment.amountDue'), value: _quote!.amountMinor != null && _quote!.currency != null ? _formatMoney(_quote!.amountMinor!, _quote!.currency!, _quote!.currencyExponent ?? 2, widget.locale.locale.toLanguageTag()) : t('payment.priceUnavailable')),
          if (_quote!.terms != null) ...[
            const SizedBox(height: 14), Text(t('payment.termsTitle'), style: Theme.of(context).textTheme.titleMedium),
            Text(t('payment.termsVersion', {'version': _quote!.termsVersion ?? ''})), const SizedBox(height: 6), Text(_quote!.terms!),
          ] else Padding(padding: const EdgeInsets.only(top: 12), child: _PaymentNotice(text: t('payment.termsUnavailable'))),
          const SizedBox(height: 14),
          if (_quote!.checkoutAvailable && _orderStatus == null) FilledButton(onPressed: _busy ? null : _startPurchase, child: Text(_busy ? t('status.loading') : t('payment.continueToPayment')))
          else if (_orderStatus != null) _PaymentNotice(text: t('payment.orderStatus', {'status': t(_statusKey(_orderStatus!))}))
          else ...[
            if (_quote!.amountMinor == null) _PaymentNotice(text: t('payment.priceUnavailable')),
            if (_quote!.terms == null) _PaymentNotice(text: t('payment.termsUnavailable')),
            if (!_quote!.purchaseModelAvailable) _PaymentNotice(text: t('payment.purchaseModelUnavailable')),
            if (!_quote!.providerConfigured) _PaymentNotice(text: t('payment.providerUnavailable')),
            const SizedBox(height: 8), Text(t('payment.noChargeMessage'), style: Theme.of(context).textTheme.bodySmall),
          ],
        ]));
  }
}

class PaymentHistoryScreen extends StatefulWidget {
  const PaymentHistoryScreen({required this.locale, required this.repository, super.key});
  final LocaleController locale; final PaymentRepository repository;
  @override State<PaymentHistoryScreen> createState() => _PaymentHistoryScreenState();
}
class _PaymentHistoryScreenState extends State<PaymentHistoryScreen> {
  List<PaymentOrderSummary> _orders = const []; bool _loading = true, _failed = false;
  @override void initState() { super.initState(); _load(); }
  Future<void> _load() async { setState(() { _loading = true; _failed = false; }); try { final items = await widget.repository.listOrders(); if (mounted) setState(() { _orders = items; _loading = false; }); } catch (_) { if (mounted) setState(() { _failed = true; _loading = false; }); } }
  @override Widget build(BuildContext context) {
    final t = widget.locale.text;
    return Scaffold(backgroundColor: _ivory, appBar: AppBar(backgroundColor: _ivory, foregroundColor: _forest, title: Text(t('payment.historyTitle'))),
      body: _loading ? const Center(child: CircularProgressIndicator()) : _failed
        ? Center(child: Column(mainAxisSize: MainAxisSize.min, children: [Text(t('payment.historyError')), TextButton(onPressed: _load, child: Text(t('action.retry')))]))
        : _orders.isEmpty ? Center(child: Padding(padding: const EdgeInsets.all(24), child: Text(t('payment.historyEmpty'), textAlign: TextAlign.center)))
        : RefreshIndicator(onRefresh: _load, child: ListView(padding: const EdgeInsets.all(14), children: [
          Text(t('payment.historyPrivacy'), style: Theme.of(context).textTheme.bodySmall), const SizedBox(height: 8),
          ..._orders.map((order) => Card(color: Colors.white, child: ListTile(onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => PaymentOrderDetailScreen(locale: widget.locale, repository: widget.repository, orderId: order.orderId))), title: Text(order.programmeTitle, style: const TextStyle(fontWeight: FontWeight.w700)), subtitle: Text('${t('payment.learner')}: ${order.learnerName}\n${_formatMoney(order.amountMinor, order.currency, order.currencyExponent, widget.locale.locale.toLanguageTag())} · ${order.createdAt == null ? '' : _formatDate(order.createdAt!, widget.locale.locale.toLanguageTag())}'), isThreeLine: true, trailing: Chip(label: Text(t(_statusKey(order.status))))))),
        ])));
  }
}

class PaymentOrderDetailScreen extends StatefulWidget {
  const PaymentOrderDetailScreen({required this.locale, required this.repository, required this.orderId, super.key});
  final LocaleController locale; final PaymentRepository repository; final String orderId;
  @override State<PaymentOrderDetailScreen> createState() => _PaymentOrderDetailScreenState();
}
class _PaymentOrderDetailScreenState extends State<PaymentOrderDetailScreen> {
  PaymentOrderDetails? _details; bool _loading = true;
  @override void initState() { super.initState(); _load(); }
  Future<void> _load() async { setState(() => _loading = true); try { final result = await widget.repository.getOrder(widget.orderId); if (mounted) setState(() { _details = result; _loading = false; }); } catch (_) { if (mounted) setState(() => _loading = false); } }
  Future<void> _refund() async {
    final t = widget.locale.text; String reason = 'unable_to_access'; final message = TextEditingController();
    final accepted = await showDialog<bool>(context: context, builder: (context) => StatefulBuilder(builder: (context, update) => AlertDialog(
      title: Text(t('payment.refundRequestTitle')), content: Column(mainAxisSize: MainAxisSize.min, children: [
        DropdownButtonFormField<String>(value: reason, items: ['unable_to_access', 'duplicate', 'other'].map((value) => DropdownMenuItem(value: value, child: Text(t(_refundReasonKey(value))))).toList(), onChanged: (value) => update(() => reason = value ?? reason)),
        TextField(controller: message, maxLength: 1200, maxLines: 3, decoration: InputDecoration(labelText: t('payment.refundMessageOptional'))),
      ]), actions: [TextButton(onPressed: () => Navigator.pop(context, false), child: Text(t('action.back'))), FilledButton(onPressed: () => Navigator.pop(context, true), child: Text(t('payment.submitRefundRequest')))],
    )));
    if (accepted != true || !mounted) { message.dispose(); return; }
    try { final status = await widget.repository.requestRefund(widget.orderId, reason, message: message.text); if (mounted) { ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(t('payment.refundRequestReceived', {'status': t(_statusKey(status))})))); await _load(); } }
    catch (_) { if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(t('payment.refundRequestFailed')))); }
    message.dispose();
  }
  @override Widget build(BuildContext context) {
    final t = widget.locale.text; final order = _details?.order;
    return Scaffold(backgroundColor: _ivory, appBar: AppBar(backgroundColor: _ivory, foregroundColor: _forest, title: Text(t('payment.transactionTitle'))),
      body: _loading ? const Center(child: CircularProgressIndicator()) : order == null ? Center(child: Text(t('payment.transactionUnavailable'))) : ListView(padding: const EdgeInsets.all(18), children: [
        Text(order.programmeTitle, style: Theme.of(context).textTheme.titleLarge), const SizedBox(height: 8),
        _ReviewRow(label: t('payment.amount'), value: _formatMoney(order.amountMinor, order.currency, order.currencyExponent, widget.locale.locale.toLanguageTag())),
        _ReviewRow(label: t('payment.statusLabel'), value: t(_statusKey(order.status))),
        _ReviewRow(label: t('payment.orderReference'), value: order.orderId),
        if (order.createdAt != null) _ReviewRow(label: t('payment.createdAt'), value: _formatDate(order.createdAt!, widget.locale.locale.toLanguageTag())),
        if (order.verifiedAt != null) _ReviewRow(label: t('payment.providerConfirmedAt'), value: _formatDate(order.verifiedAt!, widget.locale.locale.toLanguageTag())),
        const SizedBox(height: 14), Text(t('payment.receiptUnavailable'), style: Theme.of(context).textTheme.bodySmall),
        if (order.status == 'succeeded') Padding(padding: const EdgeInsets.only(top: 14), child: OutlinedButton.icon(onPressed: _refund, icon: const Icon(Icons.support_agent), label: Text(t('payment.requestRefund')))),
        if ((_details?.refunds ?? []).isNotEmpty) ...[
          const SizedBox(height: 18), Text(t('payment.refundHistoryTitle'), style: Theme.of(context).textTheme.titleMedium),
          ..._details!.refunds.map((refund) => ListTile(contentPadding: EdgeInsets.zero, title: Text(t(_refundReasonKey(refund.reason))), subtitle: Text(t(_refundStatusKey(refund.status))), trailing: refund.amountMinor != null && refund.currency != null ? Text(_formatMoney(refund.amountMinor!, refund.currency!, order.currencyExponent, widget.locale.locale.toLanguageTag())) : null)),
        ],
      ]));
  }
}

class _ReviewRow extends StatelessWidget {
  const _ReviewRow({required this.label, required this.value}); final String label, value;
  @override Widget build(BuildContext context) => Padding(padding: const EdgeInsets.symmetric(vertical: 6), child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [SizedBox(width: 120, child: Text(label, style: Theme.of(context).textTheme.bodySmall)), const SizedBox(width: 12), Expanded(child: Text(value, style: const TextStyle(color: _forest, fontWeight: FontWeight.w600)))]));
}
class _PaymentNotice extends StatelessWidget {
  const _PaymentNotice({required this.text}); final String text;
  @override Widget build(BuildContext context) => Card(color: Colors.white, child: Padding(padding: const EdgeInsets.all(15), child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [const Icon(Icons.info_outline, color: _saffron), const SizedBox(width: 10), Expanded(child: Text(text, style: const TextStyle(color: _forest)))])));
}

String _formatMoney(int amountMinor, String currency, int exponent, String locale) {
  final digits = exponent.clamp(0, 3).toInt(); final divisor = math.pow(10, digits);
  try { return NumberFormat.currency(locale: locale, name: currency, decimalDigits: digits).format(amountMinor / divisor); }
  catch (_) { return '$currency ${amountMinor / divisor}'; }
}
String _formatDate(DateTime date, String locale) { try { return DateFormat.yMMMd(locale).add_jm().format(date.toLocal()); } catch (_) { return date.toLocal().toIso8601String(); } }
String _statusKey(String status) => switch (status) {
  'pending' => 'payment.status.pending', 'succeeded' => 'payment.status.succeeded', 'failed' => 'payment.status.failed', 'cancelled' => 'payment.status.cancelled',
  'refunded' => 'payment.status.refunded', 'partially_refunded' => 'payment.status.partiallyRefunded', 'reversed' => 'payment.status.reversed', 'chargeback' => 'payment.status.chargeback',
  'requested' => 'payment.status.refundRequested', 'under_review' => 'payment.status.underReview', 'approved_for_provider' => 'payment.status.approved', 'provider_pending' => 'payment.status.providerPending', 'issued' => 'payment.status.issued', 'denied' => 'payment.status.denied', _ => 'payment.status.unavailable',
};
String _refundStatusKey(String status) => status == 'failed' ? 'payment.status.refundFailed' : _statusKey(status);
String _refundReasonKey(String reason) => switch (reason) { 'duplicate' => 'payment.refundReason.duplicate', 'other' => 'payment.refundReason.other', _ => 'payment.refundReason.access' };
