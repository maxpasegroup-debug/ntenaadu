export type VerifiedPaymentEvent = {
  providerEventId: string;
  providerOrderReference: string;
  providerTransactionReference?: string;
  providerRefundReference?: string;
  kind: 'payment_succeeded' | 'payment_failed' | 'payment_cancelled' | 'refund_succeeded' | 'payment_reversed' | 'chargeback_opened';
  amountMinor: number;
  currency: string;
  occurredAt: Date;
  receiptReference?: string;
};

export type CheckoutRequest = {
  orderId: string;
  amountMinor: number;
  currency: string;
  description: string;
  purchaserReference: string;
  idempotencyKey: string;
};

export type CheckoutSession = { providerOrderReference: string; checkoutUrl: string; expiresAt?: Date };
export type ProviderRefundRequest = { providerTransactionReference: string; amountMinor: number; currency: string; idempotencyKey: string };
export type ProviderRefund = { providerRefundReference: string; status: 'pending' };

/** Provider adapters must verify callbacks using that provider's documented signature method. */
export interface PaymentProvider {
  readonly providerId: string;
  readonly configured: boolean;
  createCheckoutSession(request: CheckoutRequest): Promise<CheckoutSession>;
  requestRefund(request: ProviderRefundRequest): Promise<ProviderRefund>;
  verifyWebhook(rawBody: Buffer, headers: Record<string, string | string[] | undefined>): Promise<VerifiedPaymentEvent>;
}

export class UnconfiguredPaymentProvider implements PaymentProvider {
  readonly providerId = 'unconfigured';
  readonly configured = false;
  async createCheckoutSession(): Promise<CheckoutSession> { throw new Error('PAYMENT_PROVIDER_UNAVAILABLE'); }
  async requestRefund(): Promise<ProviderRefund> { throw new Error('PAYMENT_PROVIDER_UNAVAILABLE'); }
  async verifyWebhook(): Promise<VerifiedPaymentEvent> { throw new Error('PAYMENT_PROVIDER_UNAVAILABLE'); }
}

// Intentionally no environment-selected or mock provider. A provider-specific,
// reviewed adapter must be explicitly registered before real payments can run.
export const paymentProvider: PaymentProvider = new UnconfiguredPaymentProvider();
