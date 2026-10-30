export type AdultVerificationStatus = 'unavailable' | 'pending' | 'verified';

export interface AdultVerificationProvider {
  readonly available: boolean;
  checkApplicant(accountId: string): Promise<AdultVerificationStatus>;
}

class DisabledAdultVerificationProvider implements AdultVerificationProvider {
  readonly available = false;
  async checkApplicant(_accountId: string): Promise<AdultVerificationStatus> { return 'unavailable'; }
}

// Contact verification is not proof of adult age. This adapter remains disabled
// until an approved age/identity verification provider and policy are supplied.
export const adultVerificationProvider: AdultVerificationProvider = new DisabledAdultVerificationProvider();
