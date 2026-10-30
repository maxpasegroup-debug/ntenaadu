import { unavailable } from '../errors';

export interface MediaGrant {
  url: string;
  expiresAt: Date;
}

export interface LearningMediaProvider {
  readonly available: boolean;
  createPlaybackGrant(assetKey: string, contentId: string, accountId: string): Promise<MediaGrant>;
  createThumbnailGrant(assetKey: string, contentId: string, accountId: string): Promise<MediaGrant>;
}

class DisabledLearningMediaProvider implements LearningMediaProvider {
  readonly available = false;

  async createPlaybackGrant(_assetKey: string, _contentId: string, _accountId: string): Promise<MediaGrant> {
    throw unavailable('MEDIA_UNAVAILABLE', 'NTE Naadu media delivery is not configured.');
  }

  async createThumbnailGrant(_assetKey: string, _contentId: string, _accountId: string): Promise<MediaGrant> {
    throw unavailable('MEDIA_UNAVAILABLE', 'NTE Naadu media delivery is not configured.');
  }
}

// Provider selection is deliberately locked to disabled until a separately
// configured NTE storage/signing implementation is reviewed and added.
export const learningMediaProvider: LearningMediaProvider = new DisabledLearningMediaProvider();
