import { createHash, randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import type { Request, Response } from 'express';
import { badRequest, forbidden, notFound, unauthorized, unavailable } from '../errors';
import { Family, GuardianRelationship, ParentAccount, PaymentAuditEvent, PaymentEntitlement, PaymentOrder, PaymentSupportNote, PaymentWebhookEvent, Programme, RefundRequest, StudentProfile } from '../models';
import { paymentProvider } from '../services/payments/payment-provider';

const supportedLanguages = new Set(['en', 'hi', 'ml', 'ta']);
const paidProgrammesEnabled = false;

function auth(req: Request) { if (!req.nteAuth) throw unauthorized(); return req.nteAuth; }
function requestId(req: Request) { return req.nteRequestId ?? ''; }
function objectId(value: unknown): string { if (typeof value !== 'string' || !mongoose.isValidObjectId(value)) throw notFound(); return value; }
async function ownStudent(guardianId: string, value: unknown) {
  const studentId = objectId(value);
  const family = await Family.findOne({ guardianId, status: 'active' }); if (!family) throw notFound();
  const student = await StudentProfile.findOne({ _id: studentId, familyId: family._id, status: 'active' }); if (!student) throw notFound();
  const relation = await GuardianRelationship.findOne({ familyId: family._id, guardianId, studentId, relationshipStatus: 'active', consentStatus: 'granted' });
  if (!relation) throw forbidden();
  return { family, student };
}
function orderDto(order: typeof PaymentOrder.prototype) {
  return { orderId: order.orderId, programmeId: order.programmeId, programmeTitle: order.programmeTitle, learnerName: order.learnerName,
    learnerId: String(order.studentId), amountMinor: order.amountMinor, currency: order.currency, currencyExponent: order.currencyExponent,
    purchaseType: order.purchaseType, status: order.status, createdAt: order.createdAt,
    verifiedAt: order.verifiedAt ?? null };
}
async function audit(input: { actorType: 'guardian' | 'finance_support' | 'provider'; actorId?: string; eventType: string; orderId?: string; refundRequestId?: string; requestId: string; details?: Record<string, string | number | boolean | null> }, session?: mongoose.ClientSession) {
  await PaymentAuditEvent.create([{ ...input, occurredAt: new Date(), details: input.details ?? {} }], session ? { session } : undefined);
}

async function purchaseContext(guardianId: string, programmeId: string, studentProfileId: unknown) {
  if (!paidProgrammesEnabled) throw unavailable('PAID_PROGRAMMES_DISABLED', 'Paid programmes are not available in this MVP.');
  const { family, student } = await ownStudent(guardianId, studentProfileId);
  const programme = await Programme.findOne({ programmeId, publicationStatus: 'published', accessRequirement: 'paid' });
  if (!programme || !programme.ageBands.includes(student.ageGroup)) throw notFound();
  const guardian = await ParentAccount.findOne({ _id: guardianId, accountStatus: 'active' }).select('name');
  if (!guardian) throw unauthorized();
  return { family, student, programme, guardian };
}

export async function quote(req: Request, res: Response): Promise<void> {
  const current = auth(req);
  const { student, programme, guardian } = await purchaseContext(current.parentId, req.params.programmeId, req.query.studentProfileId);
  const language = typeof req.query.language === 'string' ? req.query.language : 'en';
  if (!supportedLanguages.has(language)) throw badRequest('LANGUAGE_INVALID', 'Select an available language.');
  const priceConfigured = Number.isSafeInteger(programme.priceAmountMinor) && (programme.priceAmountMinor ?? 0) > 0 && Boolean(programme.priceCurrency) && Number.isInteger(programme.priceCurrencyExponent) && programme.priceCurrencyExponent! >= 0 && programme.priceCurrencyExponent! <= 3;
  const termsAvailable = programme.purchaseTermsReviewStatus === 'approved' && programme.purchaseTermsLanguageCode === language && Boolean(programme.purchaseTermsVersion && programme.purchaseTerms);
  const oneTimeFlowAvailable = programme.purchaseType === 'one_time';
  const available = priceConfigured && termsAvailable && oneTimeFlowAvailable && paymentProvider.configured;
  await audit({ actorType: 'guardian', actorId: current.parentId, eventType: 'payment.quote_viewed', requestId: requestId(req), details: { programmeId: programme.programmeId, learnerId: String(student._id) } });
  res.json({ quote: {
    programmeId: programme.programmeId, programmeTitle: programme.title,
    purchaserName: guardian.name, learnerName: student.preferredName, learnerId: String(student._id),
    amountMinor: priceConfigured ? programme.priceAmountMinor : null,
    currency: priceConfigured ? programme.priceCurrency : null,
    currencyExponent: priceConfigured ? programme.priceCurrencyExponent : null,
    purchaseType: programme.purchaseType ?? null,
    termsVersion: termsAvailable ? programme.purchaseTermsVersion : null,
    termsLanguageCode: termsAvailable ? programme.purchaseTermsLanguageCode : null,
    terms: termsAvailable ? programme.purchaseTerms : null,
    providerConfigured: paymentProvider.configured,
    checkoutAvailable: available,
    purchaseModelAvailable: oneTimeFlowAvailable,
    status: available ? 'available' : 'unavailable',
  } });
}

export async function createOrder(req: Request, res: Response): Promise<void> {
  const current = auth(req);
  const { family, student, programme, guardian } = await purchaseContext(current.parentId, req.params.programmeId, req.body?.studentProfileId);
  const language = req.body?.language;
  if (typeof language !== 'string' || !supportedLanguages.has(language)) throw badRequest('LANGUAGE_INVALID', 'Select an available language.');
  const key = req.body?.idempotencyKey;
  if (typeof key !== 'string' || key.length < 16 || key.length > 120) throw badRequest('PAYMENT_IDEMPOTENCY_KEY_INVALID', 'A valid purchase request identifier is required.');
  if (!paymentProvider.configured) throw unavailable('PAYMENT_PROVIDER_UNAVAILABLE', 'Payments are not available because an approved provider is not configured.');
  if (!Number.isSafeInteger(programme.priceAmountMinor) || !programme.priceCurrency || !Number.isInteger(programme.priceCurrencyExponent) || programme.priceCurrencyExponent! < 0 || programme.priceCurrencyExponent! > 3 || programme.purchaseType !== 'one_time' || programme.purchaseTermsReviewStatus !== 'approved' || !programme.purchaseTermsVersion || programme.purchaseTermsLanguageCode !== language || !programme.purchaseTerms) {
    throw unavailable('PURCHASE_CONFIGURATION_UNAVAILABLE', 'The programme price and reviewed purchase terms are not configured.');
  }
  const existing = await PaymentOrder.findOne({ guardianId: current.parentId, idempotencyKey: key }).select('+checkoutUrl +providerOrderReference');
  if (existing && (existing.status !== 'pending' || existing.checkoutUrl)) { res.json({ order: orderDto(existing), checkoutUrl: existing.checkoutUrl ?? null }); return; }
  const order = existing ?? await PaymentOrder.create({ orderId: randomUUID(), idempotencyKey: key, guardianId: current.parentId, familyId: family._id, studentId: student._id,
    learnerName: student.preferredName, programmeId: programme.programmeId, programmeTitle: programme.title, amountMinor: programme.priceAmountMinor,
    currency: programme.priceCurrency, currencyExponent: programme.priceCurrencyExponent, purchaseType: programme.purchaseType, purchaseTermsVersion: programme.purchaseTermsVersion, purchaseTermsLanguageCode: programme.purchaseTermsLanguageCode,
    providerId: paymentProvider.providerId, status: 'pending' });
  const orderId = order.orderId;
  try {
    const checkout = await paymentProvider.createCheckoutSession({ orderId, amountMinor: programme.priceAmountMinor, currency: programme.priceCurrency,
      description: programme.title, purchaserReference: String(guardian._id), idempotencyKey: key });
    if (!checkout.checkoutUrl.startsWith('https://')) throw new Error('PAYMENT_CHECKOUT_URL_INVALID');
    order.providerOrderReference = checkout.providerOrderReference;
    order.checkoutUrl = checkout.checkoutUrl;
    order.expiresAt = checkout.expiresAt;
    await order.save();
    await audit({ actorType: 'guardian', actorId: current.parentId, eventType: 'payment.order_created', orderId, requestId: requestId(req), details: { programmeId: programme.programmeId, amountMinor: programme.priceAmountMinor, currency: programme.priceCurrency } });
    res.status(201).json({ order: orderDto(order), checkoutUrl: checkout.checkoutUrl });
  } catch {
    // The provider may have accepted a request before a network error. Keep the
    // order pending and reuse its idempotency key; only a verified callback may
    // settle its final payment state.
    throw unavailable('PAYMENT_PROVIDER_UNAVAILABLE', 'Checkout could not be confirmed. The order remains pending while the provider is checked.');
  }
}

export async function listOrders(req: Request, res: Response): Promise<void> {
  const current = auth(req);
  const query: Record<string, unknown> = { guardianId: current.parentId };
  if (req.query.studentProfileId) {
    const { student } = await ownStudent(current.parentId, req.query.studentProfileId);
    query.studentId = student._id;
  }
  const orders = await PaymentOrder.find(query).sort({ createdAt: -1 }).limit(100);
  await audit({ actorType: 'guardian', actorId: current.parentId, eventType: 'payment.history_viewed', requestId: requestId(req), details: { orderCount: orders.length } });
  res.json({ orders: orders.map(orderDto) });
}

export async function getOrder(req: Request, res: Response): Promise<void> {
  const current = auth(req);
  const order = await PaymentOrder.findOne({ orderId: req.params.orderId, guardianId: current.parentId });
  if (!order) throw notFound();
  await audit({ actorType: 'guardian', actorId: current.parentId, eventType: 'payment.order_viewed', orderId: order.orderId, requestId: requestId(req) });
  const refunds = await RefundRequest.find({ orderId: order.orderId, guardianId: current.parentId }).sort({ createdAt: -1 }).select('refundRequestId reasonCode status amountMinor currency createdAt updatedAt');
  res.json({ order: orderDto(order), refunds: refunds.map((refund) => ({ id: refund.refundRequestId, reason: refund.reasonCode, status: refund.status, amountMinor: refund.amountMinor ?? null, currency: refund.currency ?? null, createdAt: refund.createdAt })) });
}

export async function requestRefund(req: Request, res: Response): Promise<void> {
  const current = auth(req);
  const order = await PaymentOrder.findOne({ orderId: req.params.orderId, guardianId: current.parentId, status: { $in: ['succeeded', 'partially_refunded'] } });
  if (!order) throw notFound();
  const reasonCode = req.body?.reasonCode;
  if (!['duplicate', 'unable_to_access', 'other'].includes(reasonCode)) throw badRequest('REFUND_REASON_INVALID', 'Select a refund request reason.');
  const prior = await RefundRequest.findOne({ orderId: order.orderId, guardianId: current.parentId, status: { $in: ['requested', 'under_review', 'approved_for_provider', 'provider_pending'] } });
  if (prior) { res.json({ refundRequest: { id: prior.refundRequestId, status: prior.status } }); return; }
  const message = typeof req.body?.message === 'string' ? req.body.message.trim().slice(0, 1200) : '';
  const refund = await RefundRequest.create({ refundRequestId: randomUUID(), orderId: order.orderId, guardianId: current.parentId, familyId: order.familyId, studentId: order.studentId, reasonCode, ...(message ? { message } : {}), status: 'requested' });
  await audit({ actorType: 'guardian', actorId: current.parentId, eventType: 'payment.refund_requested', orderId: order.orderId, refundRequestId: refund.refundRequestId, requestId: requestId(req), details: { reasonCode } });
  res.status(201).json({ refundRequest: { id: refund.refundRequestId, status: refund.status } });
}

export async function supportRefundQueue(req: Request, res: Response): Promise<void> {
  const current = auth(req);
  const refunds = await RefundRequest.find({ status: { $in: ['requested', 'under_review'] } }).sort({ createdAt: 1 }).limit(100);
  const orderIds = [...new Set(refunds.map((r) => r.orderId))];
  const orders = orderIds.length ? await PaymentOrder.find({ orderId: { $in: orderIds } }).select('orderId programmeTitle amountMinor currency currencyExponent status') : [];
  const byId = new Map(orders.map((o) => [o.orderId, o]));
  await audit({ actorType: 'finance_support', actorId: current.parentId, eventType: 'payment.refund_queue_viewed', requestId: requestId(req), details: { refundCount: refunds.length } });
  res.json({ refunds: refunds.map((r) => { const o = byId.get(r.orderId); return { id: r.refundRequestId, orderId: r.orderId, reason: r.reasonCode, message: r.message ?? '', status: r.status, createdAt: r.createdAt,
    order: o ? { programmeTitle: o.programmeTitle, amountMinor: o.amountMinor, currency: o.currency, currencyExponent: o.currencyExponent, status: o.status } : null }; }) });
}

export async function supportOrders(req: Request, res: Response): Promise<void> {
  const current = auth(req);
  const status = typeof req.query.status === 'string' && ['pending','succeeded','failed','cancelled','refunded','partially_refunded','reversed','chargeback'].includes(req.query.status) ? req.query.status : undefined;
  const orders = await PaymentOrder.find(status ? { status } : {}).sort({ createdAt: -1 }).limit(100).select('orderId programmeTitle amountMinor currency currencyExponent status verifiedAt createdAt updatedAt');
  const entitlements = orders.length ? await PaymentEntitlement.find({ orderId: { $in: orders.map((o) => o.orderId) } }).select('orderId status grantedAt expiresAt revokedAt') : [];
  const byOrder = new Map(entitlements.map((entitlement) => [entitlement.orderId, entitlement]));
  await audit({ actorType: 'finance_support', actorId: current.parentId, eventType: 'payment.support_orders_viewed', requestId: requestId(req), details: { orderCount: orders.length, ...(status ? { status } : {}) } });
  res.json({ orders: orders.map((order) => { const entitlement = byOrder.get(order.orderId); return { id: order.orderId, programmeTitle: order.programmeTitle, amountMinor: order.amountMinor, currency: order.currency, currencyExponent: order.currencyExponent, status: order.status, verifiedAt: order.verifiedAt ?? null, createdAt: order.createdAt, updatedAt: order.updatedAt, entitlement: entitlement ? { status: entitlement.status, grantedAt: entitlement.grantedAt, expiresAt: entitlement.expiresAt ?? null, revokedAt: entitlement.revokedAt ?? null } : null }; }) });
}

export async function supportOrderAudit(req: Request, res: Response): Promise<void> {
  const current = auth(req);
  const order = await PaymentOrder.findOne({ orderId: req.params.orderId }).select('orderId');
  if (!order) throw notFound();
  const events = await PaymentAuditEvent.find({ orderId: order.orderId }).sort({ occurredAt: -1 }).limit(100).select('eventType actorType occurredAt requestId');
  await audit({ actorType: 'finance_support', actorId: current.parentId, eventType: 'payment.support_order_audit_viewed', orderId: order.orderId, requestId: requestId(req) });
  res.json({ events: events.map((event) => ({ eventType: event.eventType, actorType: event.actorType, occurredAt: event.occurredAt, requestId: event.requestId })) });
}

export async function reviewRefund(req: Request, res: Response): Promise<void> {
  const current = auth(req);
  const body = typeof req.body?.note === 'string' ? req.body.note.trim() : '';
  if (body.length < 1 || body.length > 2000) throw badRequest('PAYMENT_SUPPORT_NOTE_INVALID', 'Enter a support note.');
  const refund = await RefundRequest.findOne({ refundRequestId: req.params.refundRequestId, status: { $in: ['requested', 'under_review'] } });
  if (!refund) throw notFound();
  const now = new Date();
  refund.status = 'under_review'; refund.reviewedBy = current.parentId; refund.reviewedAt = now; await refund.save();
  await PaymentSupportNote.create({ refundRequestId: refund.refundRequestId, authorId: current.parentId, body, createdAt: now });
  await audit({ actorType: 'finance_support', actorId: current.parentId, eventType: 'payment.refund_reviewed', orderId: refund.orderId, refundRequestId: refund.refundRequestId, requestId: requestId(req) });
  res.json({ id: refund.refundRequestId, status: refund.status });
}

export async function refundSupportNotes(req: Request, res: Response): Promise<void> {
  const current = auth(req);
  const request = await RefundRequest.findOne({ refundRequestId: req.params.refundRequestId }).select('refundRequestId');
  if (!request) throw notFound();
  const notes = await PaymentSupportNote.find({ refundRequestId: request.refundRequestId }).sort({ createdAt: 1 }).select('authorId body createdAt');
  await audit({ actorType: 'finance_support', actorId: current.parentId, eventType: 'payment.refund_notes_viewed', refundRequestId: request.refundRequestId, requestId: requestId(req) });
  res.json({ notes: notes.map((note) => ({ authorId: String(note.authorId), body: note.body, createdAt: note.createdAt })) });
}

export async function webhook(req: Request, res: Response): Promise<void> {
  const raw = (req as Request & { rawBody?: Buffer }).rawBody;
  if (!raw?.length) throw badRequest('PAYMENT_WEBHOOK_BODY_INVALID', 'The provider callback body is invalid.');
  const providerId = req.params.providerId;
  if (!paymentProvider.configured || paymentProvider.providerId !== providerId) throw unavailable('PAYMENT_PROVIDER_UNAVAILABLE', 'No payment provider is configured for callbacks.');
  let event;
  try { event = await paymentProvider.verifyWebhook(raw, req.headers); }
  catch { throw forbidden(); }
  if (!event.providerEventId || !event.providerOrderReference || !Number.isSafeInteger(event.amountMinor) || !/^[A-Z]{3}$/.test(event.currency)) throw badRequest('PAYMENT_EVENT_INVALID', 'The verified provider event is incomplete.');
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const order = await PaymentOrder.findOne({ providerId, providerOrderReference: event.providerOrderReference }).select('+providerOrderReference +providerTransactionReference +receiptReference').session(session);
      if (!order) throw notFound();
      if (order.currency !== event.currency || event.amountMinor <= 0 || (event.kind === 'refund_succeeded' ? event.amountMinor > order.amountMinor : order.amountMinor !== event.amountMinor)) throw forbidden();
      const seen = await PaymentWebhookEvent.findOne({ providerId, providerEventId: event.providerEventId }).session(session);
      if (seen) return;
      await PaymentWebhookEvent.create([{ providerId, providerEventId: event.providerEventId, orderId: order.orderId, eventType: event.kind,
        payloadDigest: createHash('sha256').update(raw).digest('hex'), status: 'processed', occurredAt: event.occurredAt }], { session });
      const when = Number.isFinite(event.occurredAt.getTime()) ? event.occurredAt : new Date();
      if (event.kind === 'payment_succeeded' && order.status === 'pending') {
        if (!event.providerTransactionReference) throw badRequest('PAYMENT_EVENT_REFERENCE_MISSING', 'The confirmed provider transaction reference is required.');
        order.status = 'succeeded'; order.providerTransactionReference = event.providerTransactionReference; order.receiptReference = event.receiptReference; order.verifiedAt = when; await order.save({ session });
        await PaymentEntitlement.updateOne({ orderId: order.orderId }, { $setOnInsert: { guardianId: order.guardianId, familyId: order.familyId, studentId: order.studentId,
          programmeId: order.programmeId, orderId: order.orderId, providerId, providerTransactionReference: event.providerTransactionReference,
          amountMinor: order.amountMinor, currency: order.currency, currencyExponent: order.currencyExponent, status: 'active', grantedAt: when } }, { upsert: true, session });
        await audit({ actorType: 'provider', eventType: 'payment.entitlement_granted', orderId: order.orderId, requestId: requestId(req), details: { programmeId: order.programmeId } }, session);
      } else if (event.kind === 'payment_failed' || event.kind === 'payment_cancelled') {
        if (order.status === 'pending') { order.status = event.kind === 'payment_failed' ? 'failed' : 'cancelled'; await order.save({ session }); }
      } else if (event.kind === 'refund_succeeded') {
        const refund = await RefundRequest.findOne({ orderId: order.orderId, status: { $in: ['approved_for_provider', 'provider_pending'] } }).session(session);
        if (!refund || !event.providerRefundReference) throw notFound();
        refund.status = 'issued'; refund.providerRefundReference = event.providerRefundReference; refund.providerConfirmedAt = when;
        refund.amountMinor = event.amountMinor; refund.currency = event.currency; await refund.save({ session });
        const [refundTotal] = await RefundRequest.aggregate([
          { $match: { orderId: order.orderId, status: 'issued' } },
          { $group: { _id: null, amountMinor: { $sum: '$amountMinor' } } },
        ]).session(session) as Array<{ amountMinor: number }>;
        const fullRefund = (refundTotal?.amountMinor ?? 0) >= order.amountMinor;
        order.status = fullRefund ? 'refunded' : 'partially_refunded'; await order.save({ session });
        if (fullRefund) await PaymentEntitlement.updateOne({ orderId: order.orderId, status: { $in: ['active', 'review_required'] } }, { $set: { status: 'revoked', revokedAt: when, revocationReason: 'refund' } }, { session });
        else await PaymentEntitlement.updateOne({ orderId: order.orderId, status: 'active' }, { $set: { status: 'review_required', revocationReason: 'partial_refund_review' } }, { session });
        await audit({ actorType: 'provider', eventType: fullRefund ? 'payment.entitlement_revoked_refund' : 'payment.entitlement_review_required_partial_refund', orderId: order.orderId, refundRequestId: refund.refundRequestId, requestId: requestId(req), details: { amountMinor: event.amountMinor, currency: event.currency } }, session);
      } else {
        const reason = event.kind === 'payment_reversed' ? 'reversal' : 'chargeback';
        order.status = event.kind === 'payment_reversed' ? 'reversed' : 'chargeback'; await order.save({ session });
        await PaymentEntitlement.updateOne({ orderId: order.orderId, status: 'active' }, { $set: { status: 'revoked', revokedAt: when, revocationReason: reason } }, { session });
        await audit({ actorType: 'provider', eventType: `payment.entitlement_revoked_${reason}`, orderId: order.orderId, requestId: requestId(req) }, session);
      }
    });
    res.status(200).json({ received: true });
  } finally { await session.endSession(); }
}
