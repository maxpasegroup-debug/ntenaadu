import { ConsentPolicy } from '../models';
import type { ActiveConsentPolicyProvider } from './providers';

export class DatabaseConsentPolicyProvider implements ActiveConsentPolicyProvider {
  async getPublished(languageCode: string) {
    const now = new Date();
    const record = await ConsentPolicy.findOne({
      languageCode,
      reviewStatus: 'published',
      effectiveAt: { $lte: now },
      $or: [{ retiredAt: { $exists: false } }, { retiredAt: null }, { retiredAt: { $gt: now } }],
    }).sort({ effectiveAt: -1, createdAt: -1 });
    if (!record) return null;
    return {
      id: record.policyId,
      version: record.version,
      languageCode: record.languageCode as 'en' | 'hi' | 'ml' | 'ta',
      title: record.title,
      body: record.body,
    };
  }
}
