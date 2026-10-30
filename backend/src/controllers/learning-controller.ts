import mongoose from 'mongoose';
import type { Request, Response } from 'express';
import { ApiError, badRequest, forbidden, notFound, unauthorized, unavailable } from '../errors';
import { Family, GuardianRelationship, LearningContent, LearningTopic, PaymentEntitlement, StudentProfile } from '../models';
import { learningMediaProvider } from '../services/learning-media';

const supportedLanguages = new Set(['en', 'hi', 'ml', 'ta']);
const supportedAgeGroups = new Set(['child', 'youth']);

function auth(req: Request) {
  if (!req.nteAuth) throw unauthorized();
  return req.nteAuth;
}

async function authorizeStudent(parentId: string, profileId: unknown) {
  if (profileId === undefined || profileId === null || profileId === '') return undefined;
  if (typeof profileId !== 'string' || !mongoose.isValidObjectId(profileId)) throw notFound();
  const family = await Family.findOne({ guardianId: parentId, status: 'active' });
  if (!family) throw notFound();
  const student = await StudentProfile.findOne({ _id: profileId, familyId: family._id, status: 'active' });
  if (!student) throw notFound();
  const relationship = await GuardianRelationship.findOne({
    familyId: family._id, guardianId: parentId, studentId: student._id,
    relationshipStatus: 'active', consentStatus: 'granted',
  });
  if (!relationship) throw forbidden();
  return student;
}

function enforceAgeBand(content: typeof LearningContent.prototype, student: Awaited<ReturnType<typeof authorizeStudent>>) {
  if (student && !(content.ageBands ?? []).includes(student.ageGroup)) throw notFound();
}

async function hasEntitlement(parentId: string, content: typeof LearningContent.prototype, student: Awaited<ReturnType<typeof authorizeStudent>>) {
  if (content.accessRequirement !== 'paid') return true;
  if (!student || !content.programmeId) return false;
  return Boolean(await PaymentEntitlement.findOne({ guardianId: parentId, studentId: student._id, programmeId: content.programmeId, status: 'active', $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] }).select('_id'));
}

function contentDto(content: typeof LearningContent.prototype, availableLanguages: string[], entitled: boolean) {
  const paid = content.accessRequirement === 'paid';
  return {
    id: content.contentId,
    contentGroupId: content.contentGroupId,
    title: content.title,
    description: content.description,
    contentLanguage: content.contentLanguage,
    availableLanguages,
    mediaType: content.mediaType,
    durationSeconds: content.durationSeconds ?? null,
    topicIds: content.topicIds,
    programmeId: content.programmeId ?? null,
    programmeName: content.programmeName ?? null,
    ageBands: content.ageBands,
    learningObjectives: paid && !entitled ? [] : content.learningObjectives,
    accessRequirement: content.accessRequirement,
    accessStatus: paid ? entitled ? 'available' : 'entitlement_required' : 'available',
    mediaAvailable: (!paid || entitled) && learningMediaProvider.available && Boolean(content.mediaAssetKey),
    thumbnailAvailable: (!paid || entitled) && learningMediaProvider.available && Boolean(content.thumbnailAssetKey),
  };
}

function searchExpression(value: string): RegExp {
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(escaped, 'i');
}

export async function listTopics(req: Request, res: Response): Promise<void> {
  auth(req);
  const language = typeof req.query.language === 'string' ? req.query.language : 'en';
  if (!supportedLanguages.has(language)) throw badRequest('LANGUAGE_INVALID', 'Select an available language.');
  const topics = await LearningTopic.find({ publicationStatus: 'published', [`labels.${language}`]: { $type: 'string', $ne: '' } })
    .sort({ [`labels.${language}`]: 1 }).select('topicId labels');
  res.json({ topics: topics.map((topic) => ({ id: topic.topicId, name: (topic.labels as unknown as Record<string, string>)[language] })) });
}

export async function listContent(req: Request, res: Response): Promise<void> {
  const current = auth(req);
  const student = await authorizeStudent(current.parentId, req.query.studentProfileId);
  const query: Record<string, unknown> = { publicationStatus: 'published' };
  const search = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (search.length > 100) throw badRequest('SEARCH_TOO_LONG', 'Search text must be 100 characters or fewer.');
  if (search) {
    const expression = searchExpression(search);
    query.$or = [{ title: expression }, { description: expression }];
  }
  const language = typeof req.query.language === 'string' ? req.query.language : '';
  if (language) {
    if (!supportedLanguages.has(language)) throw badRequest('LANGUAGE_INVALID', 'Select an available content language.');
    query.contentLanguage = language;
  }
  const requestedAge = typeof req.query.ageBand === 'string' ? req.query.ageBand : '';
  if (!student && requestedAge) {
    if (!supportedAgeGroups.has(requestedAge)) throw badRequest('AGE_GROUP_INVALID', 'Select a supported age band.');
    query.ageBands = requestedAge;
  } else if (student) {
    query.ageBands = student.ageGroup;
  }
  const topicId = typeof req.query.topicId === 'string' ? req.query.topicId.trim().toLowerCase() : '';
  if (topicId) query.topicIds = topicId;
  const programmeId = typeof req.query.programmeId === 'string' ? req.query.programmeId.trim() : '';
  if (programmeId) query.programmeId = programmeId;
  const offsetValue = typeof req.query.offset === 'string' ? Number(req.query.offset) : 0;
  if (!Number.isSafeInteger(offsetValue) || offsetValue < 0 || offsetValue > 100_000) throw badRequest('OFFSET_INVALID', 'Catalogue position is invalid.');

  const [content, availableContentLanguages, programmeFacetDocs] = await Promise.all([
    LearningContent.find(query).select('+mediaAssetKey +thumbnailAssetKey').sort({ title: 1 }).skip(offsetValue).limit(81),
    LearningContent.distinct('contentLanguage', { publicationStatus: 'published' }),
    LearningContent.aggregate([
      { $match: { publicationStatus: 'published', programmeId: { $exists: true, $ne: '' } } },
      { $group: { _id: '$programmeId', names: { $push: { language: '$contentLanguage', name: '$programmeName' } } } },
    ]),
  ]);
  const languagesByGroup = new Map<string, Set<string>>();
  const programmes = new Map<string, Record<string, string>>();
  for (const facet of programmeFacetDocs as Array<{ _id: string; names: Array<{ language: string; name?: string }> }>) {
    const names: Record<string, string> = {};
    for (const localized of facet.names) if (localized.name) names[localized.language] = localized.name;
    programmes.set(facet._id, names);
  }
  const page = content.slice(0, 80);
  const contentGroupIds = [...new Set(page.map((item) => item.contentGroupId))];
  if (contentGroupIds.length) {
    const groupLanguageFacets = await LearningContent.aggregate([
      { $match: { publicationStatus: 'published', contentGroupId: { $in: contentGroupIds } } },
      { $group: { _id: '$contentGroupId', languages: { $addToSet: '$contentLanguage' } } },
    ]) as Array<{ _id: string; languages: string[] }>;
    for (const facet of groupLanguageFacets) languagesByGroup.set(facet._id, new Set(facet.languages));
  }
  const topicIds = [...new Set(page.flatMap((item) => item.topicIds ?? []))];
  const topics = topicIds.length ? await LearningTopic.find({ topicId: { $in: topicIds }, publicationStatus: 'published' }).select('topicId labels') : [];
  const topicMap = new Map(topics.map((topic) => [topic.topicId, topic.labels] as const));
  const paidProgrammeIds = student ? [...new Set(page.filter((item) => item.accessRequirement === 'paid' && item.programmeId).map((item) => item.programmeId!))] : [];
  const activeEntitlements = paidProgrammeIds.length ? await PaymentEntitlement.find({ guardianId: current.parentId, studentId: student!._id, programmeId: { $in: paidProgrammeIds }, status: 'active', $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] }).select('programmeId') : [];
  const entitledProgrammeIds = new Set(activeEntitlements.map((item) => item.programmeId));
  res.json({
    items: page.map((item) => ({
      ...contentDto(item, [...(languagesByGroup.get(item.contentGroupId) ?? new Set([item.contentLanguage]))].sort(),
        item.accessRequirement !== 'paid' || Boolean(student && item.programmeId && entitledProgrammeIds.has(item.programmeId))),
      topics: (item.topicIds ?? []).map((id) => ({ id, labels: topicMap.get(id) ?? {} })),
    })),
    availableLanguages: (availableContentLanguages as string[]).filter((value) => supportedLanguages.has(value)).sort(),
    programmes: [...programmes.entries()].map(([id, names]) => ({ id, names })),
    hasMore: content.length > 80,
    nextOffset: offsetValue + page.length,
  });
}

export async function getContent(req: Request, res: Response): Promise<void> {
  const current = auth(req);
  const student = await authorizeStudent(current.parentId, req.query.studentProfileId);
  const content = await LearningContent.findOne({ contentId: req.params.contentId, publicationStatus: 'published' })
    .select('+mediaAssetKey +thumbnailAssetKey');
  if (!content) throw notFound();
  enforceAgeBand(content, student);
  const entitled = await hasEntitlement(current.parentId, content, student);
  const [topicDocs, languageVariants] = await Promise.all([
    LearningTopic.find({ topicId: { $in: content.topicIds }, publicationStatus: 'published' }).select('topicId labels'),
    LearningContent.distinct('contentLanguage', { contentGroupId: content.contentGroupId, publicationStatus: 'published' }),
  ]);
  res.json({
    content: {
      ...contentDto(content, languageVariants.sort(), entitled),
      topics: topicDocs.map((topic) => ({ id: topic.topicId, labels: topic.labels })),
    },
  });
}

async function publishedContent(contentId: string) {
  const content = await LearningContent.findOne({ contentId, publicationStatus: 'published' })
    .select('+mediaAssetKey +thumbnailAssetKey');
  if (!content) throw notFound();
  return content;
}

export async function createMediaAccess(req: Request, res: Response): Promise<void> {
  const current = auth(req);
  const student = await authorizeStudent(current.parentId, req.query.studentProfileId);
  const content = await publishedContent(req.params.contentId);
  enforceAgeBand(content, student);
  if (!(await hasEntitlement(current.parentId, content, student))) throw unavailable('ENTITLEMENT_UNAVAILABLE', 'Paid access cannot be verified without an active server-issued entitlement.');
  if (!content.mediaAssetKey) throw unavailable('MEDIA_UNAVAILABLE', 'No media asset is configured for this published item.');
  const grant = await learningMediaProvider.createPlaybackGrant(content.mediaAssetKey, content.contentId, current.parentId);
  res.json({ url: grant.url, expiresAt: grant.expiresAt, mediaType: content.mediaType, durationSeconds: content.durationSeconds ?? null });
}

export async function createThumbnailAccess(req: Request, res: Response): Promise<void> {
  const current = auth(req);
  const student = await authorizeStudent(current.parentId, req.query.studentProfileId);
  const content = await publishedContent(req.params.contentId);
  enforceAgeBand(content, student);
  if (!(await hasEntitlement(current.parentId, content, student))) throw unavailable('ENTITLEMENT_UNAVAILABLE', 'Paid access cannot be verified without an active server-issued entitlement.');
  if (!content.thumbnailAssetKey) throw unavailable('THUMBNAIL_UNAVAILABLE', 'No thumbnail asset is configured for this item.');
  const grant = await learningMediaProvider.createThumbnailGrant(content.thumbnailAssetKey, content.contentId, current.parentId);
  res.json({ url: grant.url, expiresAt: grant.expiresAt });
}
