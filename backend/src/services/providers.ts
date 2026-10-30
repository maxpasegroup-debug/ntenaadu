import type { ConsentPolicyDocument } from '../types';

export interface ContactVerificationProvider {
  readonly available: boolean;
  sendVerification(contact: string, code: string): Promise<void>;
}

export interface AccountRecoveryProvider {
  readonly available: boolean;
  sendRecovery(contact: string, code: string): Promise<void>;
}

export class DisabledContactVerificationProvider implements ContactVerificationProvider {
  readonly available = false;
  async sendVerification(_contact: string, _code: string): Promise<void> {
    throw new Error('Contact verification provider is unavailable.');
  }
}

export class DisabledAccountRecoveryProvider implements AccountRecoveryProvider {
  readonly available = false;
  async sendRecovery(_contact: string, _code: string): Promise<void> {
    throw new Error('Account recovery provider is unavailable.');
  }
}

export interface ActiveConsentPolicyProvider {
  getPublished(languageCode: string): Promise<ConsentPolicyDocument | null>;
}
