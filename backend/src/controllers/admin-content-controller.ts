import type { Request, Response } from 'express';
import { badRequest, forbidden, notFound, unauthorized, unavailable } from '../errors';
import { LearningContent, LearningTopic, ParentAccount, Programme, ProgrammeActivity, ProgrammeModule } from '../models';
import { learningMediaProvider } from '../services/learning-media';
import { appendAudit } from '../services/audit';

const languages = new Set(['en', 'hi', 'ml', 'ta']);
const ageBands = new Set(['child', 'youth']);
function auth(req: Request) { if (!req.nteAuth) throw unauthorized(); return req.nteAuth; }
function requestId(req: Request) { return req.nteRequestId ?? ''; }
function reason(value: unknown) { if (typeof value !== 'string' || value.trim().length < 5 || value.trim().length > 1000) throw badRequest('CONTENT_ACTION_REASON_REQUIRED', 'Enter a reason of at least five characters.'); return value.trim(); }
function slug(value: unknown, name: string): string { if (typeof value !== 'string' || !/^[a-z0-9][a-z0-9._-]{1,119}$/.test(value)) throw badRequest('CONTENT_ID_INVALID', `Enter a valid ${name}.`); return value; }
function str(value: unknown, name: string, min: number, max: number): string { if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) throw badRequest('CONTENT_FIELD_INVALID', `Enter a valid ${name}.`); return value.trim(); }
function list(value: unknown, allowed: Set<string>, name: string): string[] {
  if (!Array.isArray(value) || value.length < 1 || value.some((item) => typeof item !== 'string' || !allowed.has(item))) throw badRequest('CONTENT_FIELD_INVALID', `Select valid ${name}.`);
  return [...new Set(value as string[])];
}
function labels(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw badRequest('CONTENT_LABELS_INVALID', 'Enter language labels.');
  const result: Record<string, string> = {};
  for (const [language, text] of Object.entries(value as Record<string, unknown>)) {
    if (!languages.has(language) || typeof text !== 'string' || text.trim().length > 120) throw badRequest('CONTENT_LABELS_INVALID', 'Use supported language codes and labels no longer than 120 characters.');
    if (text.trim()) result[language] = text.trim();
  }
  if (!Object.keys(result).length) throw badRequest('CONTENT_LABELS_INVALID', 'Add at least one language label.');
  return result;
}
async function audit(req: Request, eventType: string, subjectId?: string, actionReason?: string) {
  await appendAudit({ actorId: auth(req).parentId, ...(subjectId ? { subjectId } : {}), eventType, requestId: requestId(req), details: actionReason ? { reason: actionReason } : {} });
}
async function requireActorRole(req: Request, expected: 'content_editor' | 'content_reviewer') {
  const account = await ParentAccount.findOne({ _id: auth(req).parentId, accountStatus: 'active', verificationStatus: 'verified', adultVerificationStatus: 'verified', staffRoles: expected }).select('_id');
  if (!account) throw forbidden();
}
function contentDto(item: typeof LearningContent.prototype) {
  return { id: item.contentId, contentGroupId: item.contentGroupId, title: item.title, description: item.description, contentLanguage: item.contentLanguage,
    mediaType: item.mediaType, durationSeconds: item.durationSeconds ?? null, topicIds: item.topicIds, programmeId: item.programmeId ?? null,
    programmeName: item.programmeName ?? null, ageBands: item.ageBands, learningObjectives: item.learningObjectives, accessRequirement: item.accessRequirement,
    publicationStatus: item.publicationStatus, mediaConfigured: Boolean(item.mediaAssetKey), mediaProviderAvailable: learningMediaProvider.available };
}
async function editableContent(contentId: unknown) {
  const item = await LearningContent.findOne({ contentId }).select('+mediaAssetKey');
  if (!item) throw notFound();
  if (item.publicationStatus !== 'draft') throw forbidden();
  return item;
}

export async function listTopics(req: Request, res: Response): Promise<void> {
  const status = typeof req.query.status === 'string' ? req.query.status : '';
  const query = status && ['draft', 'in_review', 'published', 'archived'].includes(status) ? { publicationStatus: status } : {};
  const topics = await LearningTopic.find(query).sort({ topicId: 1 }).limit(200).select('topicId labels publicationStatus updatedAt');
  await audit(req, 'admin.content_topics_viewed');
  res.json({ topics: topics.map((topic) => ({ id: topic.topicId, labels: topic.labels, publicationStatus: topic.publicationStatus, updatedAt: topic.updatedAt })) });
}

export async function createTopic(req: Request, res: Response): Promise<void> {
  await requireActorRole(req, 'content_editor');
  const topicId = slug(req.body?.topicId, 'topic identifier');
  const localized = labels(req.body?.labels);
  const topic = await LearningTopic.create({ topicId, labels: localized, publicationStatus: 'draft' });
  await audit(req, 'admin.content_topic_created', topicId);
  res.status(201).json({ topic: { id: topic.topicId, labels: topic.labels, publicationStatus: topic.publicationStatus } });
}

export async function updateTopic(req: Request, res: Response): Promise<void> {
  await requireActorRole(req, 'content_editor');
  const topic = await LearningTopic.findOne({ topicId: req.params.topicId });
  if (!topic || topic.publicationStatus !== 'draft') throw notFound();
  topic.labels = labels(req.body?.labels) as typeof topic.labels;
  await topic.save();
  await audit(req, 'admin.content_topic_updated', topic.topicId);
  res.json({ topic: { id: topic.topicId, labels: topic.labels, publicationStatus: topic.publicationStatus } });
}

export async function setTopicPublication(req: Request, res: Response): Promise<void> {
  const status = req.body?.status; const actionReason = reason(req.body?.reason);
  if (!['in_review', 'draft', 'published', 'archived'].includes(status)) throw badRequest('PUBLICATION_STATUS_INVALID', 'Select a valid publication state.');
  await requireActorRole(req, status === 'in_review' ? 'content_editor' : 'content_reviewer');
  const topic = await LearningTopic.findOne({ topicId: req.params.topicId }); if (!topic) throw notFound();
  if (status === 'in_review' && topic.publicationStatus !== 'draft') throw badRequest('PUBLICATION_TRANSITION_INVALID', 'Only drafts can be submitted for review.');
  if (status === 'published' && topic.publicationStatus !== 'in_review') throw badRequest('PUBLICATION_TRANSITION_INVALID', 'Only reviewed topics can be published.');
  topic.publicationStatus = status; await topic.save(); await audit(req, `admin.content_topic_${status}`, topic.topicId, actionReason);
  res.json({ id: topic.topicId, publicationStatus: topic.publicationStatus });
}

export async function listContent(req: Request, res: Response): Promise<void> {
  const status = typeof req.query.status === 'string' ? req.query.status : '';
  const query = status && ['draft', 'in_review', 'published', 'archived'].includes(status) ? { publicationStatus: status } : {};
  const items = await LearningContent.find(query).sort({ updatedAt: -1 }).limit(100).select('+mediaAssetKey');
  await audit(req, 'admin.learning_content_viewed');
  res.json({ items: items.map(contentDto), mediaProviderAvailable: learningMediaProvider.available });
}

export async function createContent(req: Request, res: Response): Promise<void> {
  await requireActorRole(req, 'content_editor');
  const body = req.body ?? {};
  const contentId = slug(body.contentId, 'content identifier');
  const contentGroupId = slug(body.contentGroupId, 'content group identifier');
  const contentLanguage = str(body.contentLanguage, 'content language', 2, 8);
  if (!languages.has(contentLanguage)) throw badRequest('CONTENT_LANGUAGE_INVALID', 'Select a supported content language.');
  if (!['audio', 'video'].includes(body.mediaType)) throw badRequest('CONTENT_MEDIA_TYPE_INVALID', 'Select audio or video.');
  const bands = list(body.ageBands, ageBands, 'age groups');
  if (!['free', 'paid'].includes(body.accessRequirement)) throw badRequest('CONTENT_ACCESS_INVALID', 'Select a valid access type.');
  const mediaKey = body.mediaAssetKey == null || body.mediaAssetKey === '' ? undefined : str(body.mediaAssetKey, 'NTE media asset key', 1, 500);
  if (mediaKey && (/^https?:\/\//i.test(mediaKey) || /[?#]/.test(mediaKey))) throw badRequest('MEDIA_REFERENCE_INVALID', 'Use an NTE media asset key, not a URL.');
  const item = await LearningContent.create({ contentId, contentGroupId, title: str(body.title, 'title', 1, 240), description: str(body.description, 'description', 1, 4000), contentLanguage,
    mediaType: body.mediaType, ...(mediaKey ? { mediaAssetKey: mediaKey } : {}), ...(Number.isSafeInteger(body.durationSeconds) && body.durationSeconds > 0 ? { durationSeconds: body.durationSeconds } : {}),
    topicIds: Array.isArray(body.topicIds) ? body.topicIds.map((x: unknown) => slug(x, 'topic identifier')) : [], programmeId: body.programmeId ? slug(body.programmeId, 'programme identifier') : undefined,
    programmeName: body.programmeName ? str(body.programmeName, 'programme name', 1, 240) : undefined, ageBands: bands,
    learningObjectives: Array.isArray(body.learningObjectives) ? body.learningObjectives.filter((x: unknown) => typeof x === 'string').map((x: string) => str(x, 'learning objective', 1, 500)) : [],
    accessRequirement: body.accessRequirement, publicationStatus: 'draft' });
  await audit(req, 'admin.learning_content_created', item.contentId);
  res.status(201).json({ item: contentDto(item) });
}

export async function updateContent(req: Request, res: Response): Promise<void> {
  await requireActorRole(req, 'content_editor');
  const item = await editableContent(req.params.contentId);
  const body = req.body ?? {};
  for (const field of ['title', 'description', 'programmeName'] as const) if (body[field] != null) (item as any)[field] = str(body[field], field, 1, field === 'description' ? 4000 : 240);
  if (body.contentLanguage != null) { if (!languages.has(body.contentLanguage)) throw badRequest('CONTENT_LANGUAGE_INVALID', 'Select a supported content language.'); item.contentLanguage = body.contentLanguage; }
  if (body.ageBands != null) item.ageBands = list(body.ageBands, ageBands, 'age groups');
  if (body.topicIds != null) item.topicIds = Array.isArray(body.topicIds) ? body.topicIds.map((x: unknown) => slug(x, 'topic identifier')) : [];
  if (body.learningObjectives != null) item.learningObjectives = Array.isArray(body.learningObjectives) ? body.learningObjectives.map((x: unknown) => str(x, 'learning objective', 1, 500)) : [];
  if (body.mediaAssetKey != null) { const key = body.mediaAssetKey === '' ? '' : str(body.mediaAssetKey, 'NTE media asset key', 1, 500); if (/^https?:\/\//i.test(key) || /[?#]/.test(key)) throw badRequest('MEDIA_REFERENCE_INVALID', 'Use an NTE media asset key, not a URL.'); item.mediaAssetKey = key || undefined; }
  await item.save();
  await audit(req, 'admin.learning_content_updated', item.contentId);
  res.json({ item: contentDto(item) });
}

export async function setContentPublication(req: Request, res: Response): Promise<void> {
  const status = req.body?.status;
  const actionReason = reason(req.body?.reason);
  if (!['in_review', 'draft', 'published', 'archived'].includes(status)) throw badRequest('PUBLICATION_STATUS_INVALID', 'Select a valid publication state.');
  await requireActorRole(req, status === 'in_review' ? 'content_editor' : 'content_reviewer');
  const item = await LearningContent.findOne({ contentId: req.params.contentId }).select('+mediaAssetKey');
  if (!item) throw notFound();
  if (status === 'in_review' && item.publicationStatus !== 'draft') throw badRequest('PUBLICATION_TRANSITION_INVALID', 'Only drafts can be submitted for review.');
  if (status === 'published') {
    if (item.publicationStatus !== 'in_review') throw badRequest('PUBLICATION_TRANSITION_INVALID', 'Only reviewed items can be published.');
    if (!item.mediaAssetKey || !learningMediaProvider.available) throw unavailable('MEDIA_PROVIDER_UNAVAILABLE', 'A configured NTE media provider and asset are required before publishing media.');
    if (!item.ageBands.length || !item.title.trim() || !item.description.trim()) throw badRequest('CONTENT_INCOMPLETE', 'Add a title, description and age eligibility before publishing.');
    if (item.topicIds.length && (await LearningTopic.countDocuments({ topicId: { $in: item.topicIds }, publicationStatus: 'published' })) !== item.topicIds.length) throw badRequest('CONTENT_TOPIC_UNAVAILABLE', 'All linked topics must be published.');
    if (item.programmeId && !(await Programme.exists({ programmeId: item.programmeId, publicationStatus: 'published' }))) throw badRequest('CONTENT_PROGRAMME_UNAVAILABLE', 'Publish the linked programme before this content.');
    if (item.accessRequirement === 'paid' && !item.programmeId) throw badRequest('CONTENT_PROGRAMME_REQUIRED', 'Paid content must link to a paid programme entitlement.');
  }
  item.publicationStatus = status; if (status === 'published') item.publishedAt = new Date(); if (status !== 'published') item.publishedAt = undefined;
  await item.save();
  await audit(req, `admin.learning_content_${status}`, item.contentId, actionReason);
  res.json({ item: contentDto(item) });
}

export async function listProgrammes(req: Request, res: Response): Promise<void> {
  const status = typeof req.query.status === 'string' ? req.query.status : '';
  const query = status && ['draft', 'in_review', 'published', 'archived'].includes(status) ? { publicationStatus: status } : {};
  const items = await Programme.find(query).sort({ updatedAt: -1 }).limit(100).select('-purchaseTerms -priceAmountMinor -priceCurrency -priceCurrencyExponent');
  await audit(req, 'admin.programmes_viewed');
  res.json({ programmes: items.map((p) => ({ id: p.programmeId, title: p.title, description: p.description, contentLanguage: p.contentLanguage, ageBands: p.ageBands,
    durationMinutes: p.durationMinutes ?? null, objectives: p.learningObjectives, accessRequirement: p.accessRequirement, publicationStatus: p.publicationStatus,
    purchaseConfigured: Boolean(p.priceAmountMinor && p.priceCurrency && p.purchaseTermsVersion && p.purchaseTermsReviewStatus === 'approved') })) });
}

export async function createProgramme(req: Request, res: Response): Promise<void> {
  await requireActorRole(req, 'content_editor');
  const body = req.body ?? {};
  if (!languages.has(body.contentLanguage)) throw badRequest('CONTENT_LANGUAGE_INVALID', 'Select a supported content language.');
  if (!['free', 'paid'].includes(body.accessRequirement)) throw badRequest('PROGRAMME_ACCESS_INVALID', 'Select free or paid access.');
  if (body.accessRequirement === 'paid') throw unavailable('PAID_PROGRAMMES_DISABLED', 'Paid programme publishing is disabled until payment policy and provider approval are complete.');
  const programme = await Programme.create({ programmeId: slug(body.programmeId, 'programme identifier'), title: str(body.title, 'title', 1, 240), description: str(body.description, 'description', 1, 4000),
    contentLanguage: body.contentLanguage, ageBands: list(body.ageBands, ageBands, 'age groups'),
    ...(Number.isSafeInteger(body.durationMinutes) && body.durationMinutes > 0 ? { durationMinutes: body.durationMinutes } : {}),
    learningObjectives: Array.isArray(body.learningObjectives) ? body.learningObjectives.map((x: unknown) => str(x, 'learning objective', 1, 500)) : [],
    accessRequirement: body.accessRequirement, publicationStatus: 'draft' });
  await audit(req, 'admin.programme_created', programme.programmeId);
  res.status(201).json({ id: programme.programmeId, publicationStatus: programme.publicationStatus });
}

export async function updateProgramme(req: Request, res: Response): Promise<void> {
  await requireActorRole(req, 'content_editor');
  const programme = await Programme.findOne({ programmeId: req.params.programmeId, publicationStatus: 'draft' }); if (!programme) throw notFound();
  const body = req.body ?? {};
  if (body.title != null) programme.title = str(body.title, 'title', 1, 240);
  if (body.description != null) programme.description = str(body.description, 'description', 1, 4000);
  if (body.contentLanguage != null) { if (!languages.has(body.contentLanguage)) throw badRequest('CONTENT_LANGUAGE_INVALID', 'Select a supported content language.'); programme.contentLanguage = body.contentLanguage; }
  if (body.ageBands != null) programme.ageBands = list(body.ageBands, ageBands, 'age groups');
  if (body.accessRequirement != null) {
    if (!['free', 'paid'].includes(body.accessRequirement)) throw badRequest('PROGRAMME_ACCESS_INVALID', 'Select free or paid access.');
    if (body.accessRequirement === 'paid') throw unavailable('PAID_PROGRAMMES_DISABLED', 'Paid programme publishing is disabled until payment policy and provider approval are complete.');
    programme.accessRequirement = body.accessRequirement;
  }
  if (body.durationMinutes != null) { if (!Number.isSafeInteger(body.durationMinutes) || body.durationMinutes < 1) throw badRequest('PROGRAMME_DURATION_INVALID', 'Enter a positive duration.'); programme.durationMinutes = body.durationMinutes; }
  if (body.learningObjectives != null) programme.learningObjectives = Array.isArray(body.learningObjectives) ? body.learningObjectives.map((x: unknown) => str(x, 'learning objective', 1, 500)) : [];
  await programme.save(); await audit(req, 'admin.programme_updated', programme.programmeId);
  res.json({ id: programme.programmeId, publicationStatus: programme.publicationStatus });
}

export async function programmeDetail(req: Request, res: Response): Promise<void> {
  const programme = await Programme.findOne({ programmeId: req.params.programmeId }).select('-purchaseTerms -priceAmountMinor -priceCurrency -priceCurrencyExponent'); if (!programme) throw notFound();
  const [modules, activities] = await Promise.all([
    ProgrammeModule.find({ programmeId: programme.programmeId }).sort({ sortOrder: 1 }).select('moduleId title description contentLanguage sortOrder publicationStatus'),
    ProgrammeActivity.find({ programmeId: programme.programmeId }).sort({ sortOrder: 1 }).select('activityId moduleId title description contentLanguage ageBands learningContentId sortOrder publicationStatus'),
  ]);
  await audit(req, 'admin.programme_detail_viewed', programme.programmeId);
  res.json({ programme: { id: programme.programmeId, title: programme.title, description: programme.description, contentLanguage: programme.contentLanguage, ageBands: programme.ageBands, accessRequirement: programme.accessRequirement, publicationStatus: programme.publicationStatus,
    modules: modules.map((m) => ({ id: m.moduleId, title: m.title, description: m.description, contentLanguage: m.contentLanguage, sortOrder: m.sortOrder, publicationStatus: m.publicationStatus })),
    activities: activities.map((a) => ({ id: a.activityId, moduleId: a.moduleId ?? null, title: a.title, description: a.description, contentLanguage: a.contentLanguage, ageBands: a.ageBands, learningContentId: a.learningContentId ?? null, sortOrder: a.sortOrder, publicationStatus: a.publicationStatus })) } });
}

export async function createModule(req: Request, res: Response): Promise<void> {
  await requireActorRole(req, 'content_editor');
  const body = req.body ?? {}; const programmeId = slug(body.programmeId, 'programme identifier');
  const programme = await Programme.findOne({ programmeId, publicationStatus: { $in: ['draft', 'in_review'] } }); if (!programme) throw notFound();
  const language = typeof body.contentLanguage === 'string' && languages.has(body.contentLanguage) ? body.contentLanguage : programme.contentLanguage;
  const module = await ProgrammeModule.create({ programmeId, moduleId: slug(body.moduleId, 'module identifier'), title: str(body.title, 'title', 1, 240), description: str(body.description, 'description', 1, 4000), contentLanguage: language, sortOrder: Number.isSafeInteger(body.sortOrder) ? body.sortOrder : 0, publicationStatus: 'draft' });
  await audit(req, 'admin.programme_module_created', module.moduleId);
  res.status(201).json({ id: module.moduleId, publicationStatus: module.publicationStatus });
}

export async function createActivity(req: Request, res: Response): Promise<void> {
  await requireActorRole(req, 'content_editor');
  const body = req.body ?? {}; const programmeId = slug(body.programmeId, 'programme identifier');
  const programme = await Programme.findOne({ programmeId, publicationStatus: { $in: ['draft', 'in_review'] } }); if (!programme) throw notFound();
  const language = typeof body.contentLanguage === 'string' && languages.has(body.contentLanguage) ? body.contentLanguage : programme.contentLanguage;
  const age = list(body.ageBands ?? programme.ageBands, ageBands, 'age groups');
  const learningContentId = body.learningContentId ? slug(body.learningContentId, 'learning content identifier') : undefined;
  if (learningContentId && !(await LearningContent.exists({ contentId: learningContentId, publicationStatus: { $in: ['draft', 'in_review', 'published'] } }))) throw notFound();
  const activity = await ProgrammeActivity.create({ programmeId, activityId: slug(body.activityId, 'activity identifier'), moduleId: body.moduleId ? slug(body.moduleId, 'module identifier') : undefined,
    title: str(body.title, 'title', 1, 240), description: str(body.description, 'description', 1, 4000), contentLanguage: language, ageBands: age, learningContentId,
    sortOrder: Number.isSafeInteger(body.sortOrder) ? body.sortOrder : 0, publicationStatus: 'draft' });
  await audit(req, 'admin.programme_activity_created', activity.activityId);
  res.status(201).json({ id: activity.activityId, publicationStatus: activity.publicationStatus });
}

export async function updateProgrammeComponent(req: Request, res: Response): Promise<void> {
  await requireActorRole(req, 'content_editor');
  const body = req.body ?? {}; const programmeId = req.params.programmeId;
  if (req.params.moduleId) {
    const module = await ProgrammeModule.findOne({ programmeId, moduleId: req.params.moduleId, publicationStatus: 'draft' }); if (!module) throw notFound();
    if (body.title != null) module.title = str(body.title, 'title', 1, 240);
    if (body.description != null) module.description = str(body.description, 'description', 1, 4000);
    if (body.contentLanguage != null) { if (!languages.has(body.contentLanguage)) throw badRequest('CONTENT_LANGUAGE_INVALID', 'Select a supported content language.'); module.contentLanguage = body.contentLanguage; }
    if (body.sortOrder != null) { if (!Number.isSafeInteger(body.sortOrder)) throw badRequest('CONTENT_SORT_INVALID', 'Enter a valid order number.'); module.sortOrder = body.sortOrder; }
    await module.save(); await audit(req, 'admin.programme_module_updated', module.moduleId); res.json({ id: module.moduleId, publicationStatus: module.publicationStatus }); return;
  }
  const activityId = req.params.activityId;
  const activity = await ProgrammeActivity.findOne({ programmeId, activityId, publicationStatus: 'draft' }); if (!activity) throw notFound();
  if (body.title != null) activity.title = str(body.title, 'title', 1, 240);
  if (body.description != null) activity.description = str(body.description, 'description', 1, 4000);
  if (body.contentLanguage != null) { if (!languages.has(body.contentLanguage)) throw badRequest('CONTENT_LANGUAGE_INVALID', 'Select a supported content language.'); activity.contentLanguage = body.contentLanguage; }
  if (body.ageBands != null) activity.ageBands = list(body.ageBands, ageBands, 'age groups');
  if (body.learningContentId != null) { const id = body.learningContentId === '' ? '' : slug(body.learningContentId, 'learning content identifier'); if (id && !(await LearningContent.exists({ contentId: id, publicationStatus: { $in: ['draft', 'in_review', 'published'] } }))) throw notFound(); activity.learningContentId = id || undefined; }
  if (body.moduleId != null) { const id = body.moduleId === '' ? '' : slug(body.moduleId, 'module identifier'); if (id && !(await ProgrammeModule.exists({ programmeId, moduleId: id, publicationStatus: 'published' }))) throw notFound(); activity.moduleId = id || undefined; }
  if (body.sortOrder != null) { if (!Number.isSafeInteger(body.sortOrder)) throw badRequest('CONTENT_SORT_INVALID', 'Enter a valid order number.'); activity.sortOrder = body.sortOrder; }
  await activity.save(); await audit(req, 'admin.programme_activity_updated', activity.activityId); res.json({ id: activity.activityId, publicationStatus: activity.publicationStatus });
}

export async function setProgrammeComponentPublication(req: Request, res: Response): Promise<void> {
  const status = req.body?.status; const actionReason = reason(req.body?.reason);
  if (!['in_review', 'draft', 'published', 'archived'].includes(status)) throw badRequest('PUBLICATION_STATUS_INVALID', 'Select a valid publication state.');
  await requireActorRole(req, status === 'in_review' ? 'content_editor' : 'content_reviewer');
  const programmeId = req.params.programmeId;
  const isModule = Boolean(req.params.moduleId);
  const component = isModule
    ? await ProgrammeModule.findOne({ programmeId, moduleId: req.params.moduleId })
    : await ProgrammeActivity.findOne({ programmeId, activityId: req.params.activityId });
  if (!component) throw notFound();
  if (status === 'in_review' && component.publicationStatus !== 'draft') throw badRequest('PUBLICATION_TRANSITION_INVALID', 'Only drafts can be submitted for review.');
  if (status === 'published') {
    if (component.publicationStatus !== 'in_review') throw badRequest('PUBLICATION_TRANSITION_INVALID', 'Only reviewed content can be published.');
    const programme = await Programme.findOne({ programmeId }); if (!programme) throw notFound();
    if (isModule) {
      if (!(component as typeof ProgrammeModule.prototype).title.trim()) throw badRequest('CONTENT_INCOMPLETE', 'Add a module title before publishing.');
    } else {
      const activity = component as typeof ProgrammeActivity.prototype;
      if (!activity.ageBands.length || !activity.title.trim() || !activity.description.trim()) throw badRequest('CONTENT_INCOMPLETE', 'Add an activity title, description and age eligibility before publishing.');
      if (activity.ageBands.some((band) => !programme.ageBands.includes(band))) throw badRequest('CONTENT_AGE_MISMATCH', 'Activity eligibility must be within the programme age groups.');
      if (activity.moduleId && !(await ProgrammeModule.exists({ programmeId, moduleId: activity.moduleId, publicationStatus: 'published' }))) throw badRequest('CONTENT_MODULE_UNAVAILABLE', 'Publish the linked module before this activity.');
      if (activity.learningContentId) {
        const linked = await LearningContent.findOne({ contentId: activity.learningContentId, publicationStatus: 'published' }).select('+mediaAssetKey');
        if (!linked || !linked.mediaAssetKey || !learningMediaProvider.available) throw unavailable('MEDIA_PROVIDER_UNAVAILABLE', 'Linked learning media is not configured and published.');
      }
    }
  }
  component.publicationStatus = status; await component.save();
  const id = isModule ? (component as typeof ProgrammeModule.prototype).moduleId : (component as typeof ProgrammeActivity.prototype).activityId;
  await audit(req, `admin.programme_component_${status}`, id, actionReason);
  res.json({ id, publicationStatus: component.publicationStatus });
}

export async function setProgrammePublication(req: Request, res: Response): Promise<void> {
  const status = req.body?.status; const actionReason = reason(req.body?.reason);
  if (!['in_review', 'draft', 'published', 'archived'].includes(status)) throw badRequest('PUBLICATION_STATUS_INVALID', 'Select a valid publication state.');
  await requireActorRole(req, status === 'in_review' ? 'content_editor' : 'content_reviewer');
  const programme = await Programme.findOne({ programmeId: req.params.programmeId }); if (!programme) throw notFound();
  if (status === 'in_review' && programme.publicationStatus !== 'draft') throw badRequest('PUBLICATION_TRANSITION_INVALID', 'Only drafts can be submitted for review.');
  if (status === 'published') {
    if (programme.publicationStatus !== 'in_review') throw badRequest('PUBLICATION_TRANSITION_INVALID', 'Only reviewed programmes can be published.');
    if (programme.accessRequirement === 'paid') throw unavailable('PAID_PROGRAMMES_DISABLED', 'Paid programme publishing is disabled until payment policy and provider approval are complete.');
    const modules = await ProgrammeModule.countDocuments({ programmeId: programme.programmeId, contentLanguage: programme.contentLanguage, publicationStatus: 'published' });
    const activities = await ProgrammeActivity.countDocuments({ programmeId: programme.programmeId, contentLanguage: programme.contentLanguage, publicationStatus: 'published' });
    if (!modules || !activities) throw badRequest('PROGRAMME_INCOMPLETE', 'Publish at least one module and activity before the programme.');
    if (programme.accessRequirement === 'paid' && !(programme.priceAmountMinor && programme.priceCurrency && programme.purchaseType && programme.purchaseTerms && programme.purchaseTermsVersion && programme.purchaseTermsLanguageCode && programme.purchaseTermsReviewStatus === 'approved')) throw badRequest('PROGRAMME_PURCHASE_CONFIGURATION_REQUIRED', 'Paid programmes need approved price, purchase type and terms before publication.');
  }
  programme.publicationStatus = status; if (status === 'published') programme.publishedAt = new Date(); if (status !== 'published') programme.publishedAt = undefined;
  await programme.save(); await audit(req, `admin.programme_${status}`, programme.programmeId, actionReason);
  res.json({ id: programme.programmeId, publicationStatus: programme.publicationStatus });
}

