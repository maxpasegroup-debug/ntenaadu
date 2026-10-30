import mongoose from 'mongoose';
import type { Request, Response } from 'express';
import { badRequest, forbidden, notFound, unauthorized } from '../errors';
import { AuditEvent, ClubApplication, Family, GuardianRelationship, LearningContent, LearningTopic, ParentAccount, PaymentOrder, Programme, RefundRequest, SafeguardingReport, StudentProfile } from '../models';
import { requireStaffRole } from '../middleware/require-staff-role';
import { appendAudit } from '../services/audit';
import { learningMediaProvider } from '../services/learning-media';
import { paymentProvider } from '../services/payments/payment-provider';

const staffRoles = ['platform_admin', 'safeguarding_lead', 'safeguarding_backup', 'club_reviewer', 'club_moderator', 'event_manager', 'content_editor', 'content_reviewer', 'finance_support', 'auditor'] as const;
function auth(req: Request) { if (!req.nteAuth) throw unauthorized(); return req.nteAuth; }
function requestId(req: Request) { return req.nteRequestId ?? ''; }
function page(req: Request) {
  const offset = typeof req.query.offset === 'string' ? Number(req.query.offset) : 0;
  const limit = typeof req.query.limit === 'string' ? Number(req.query.limit) : 25;
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 100000 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw badRequest('PAGINATION_INVALID', 'Search page is invalid.');
  return { offset, limit };
}

export async function capabilities(req: Request, res: Response): Promise<void> {
  const current = auth(req);
  const account = await ParentAccount.findOne({ _id: current.parentId, accountStatus: 'active' }).select('+staffRoles');
  if (!account) throw unauthorized();
  res.json({ roles: (account.staffRoles ?? []).filter((role: string) => (staffRoles as readonly string[]).includes(role)) });
}

export async function overview(req: Request, res: Response): Promise<void> {
  const current = auth(req);
  const account = await ParentAccount.findById(current.parentId).select('+staffRoles');
  if (!account) throw unauthorized();
  const roles = new Set<string>(account.staffRoles ?? []);
  const counts: Record<string, number> = {};
  const jobs: Array<Promise<void>> = [];
  if (roles.has('platform_admin')) jobs.push((async () => { counts.parentAccounts = await ParentAccount.countDocuments({ accountStatus: 'active' }); counts.families = await Family.countDocuments({ status: 'active' }); })());
  if (roles.has('club_reviewer')) jobs.push((async () => { counts.clubApplicationsPending = await ClubApplication.countDocuments({ status: 'pending_review' }); })());
  if (roles.has('content_editor') || roles.has('content_reviewer')) {
    jobs.push((async () => { counts.publishedLearningItems = await LearningContent.countDocuments({ publicationStatus: 'published' }); counts.publishedTopics = await LearningTopic.countDocuments({ publicationStatus: 'published' }); counts.publishedProgrammes = await Programme.countDocuments({ publicationStatus: 'published' }); })());
  }
  if (roles.has('finance_support')) jobs.push((async () => { counts.paymentOrders = await PaymentOrder.countDocuments(); counts.refundRequestsOpen = await RefundRequest.countDocuments({ status: { $in: ['requested', 'under_review'] } }); })());
  if (roles.has('safeguarding_lead') || roles.has('safeguarding_backup')) {
    jobs.push((async () => { counts.safeguardingReportsOpen = await SafeguardingReport.countDocuments({ status: { $nin: ['resolved', 'closed'] } }); })());
  }
  await Promise.all(jobs);
  res.json({ counts });
}

export async function providerStatus(req: Request, res: Response): Promise<void> {
  const account = await ParentAccount.findById(auth(req).parentId).select('+staffRoles');
  if (!account) throw unauthorized();
  const roles = new Set<string>(account.staffRoles ?? []);
  res.json({
    ...(roles.has('finance_support') ? { paymentProvider: { configured: paymentProvider.configured, providerId: paymentProvider.configured ? paymentProvider.providerId : null } } : {}),
    ...(roles.has('content_editor') || roles.has('content_reviewer') ? { mediaProvider: { available: learningMediaProvider.available } } : {}),
  });
}

export async function members(req: Request, res: Response): Promise<void> {
  const { offset, limit } = page(req);
  const search = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (search.length > 100) throw badRequest('SEARCH_TOO_LONG', 'Search text must be 100 characters or fewer.');
  const filter: Record<string, unknown> = {};
  if (typeof req.query.status === 'string' && ['active', 'suspended'].includes(req.query.status)) filter.accountStatus = req.query.status;
  if (search) { const expression = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'); filter.$or = [{ name: expression }, { contact: expression }]; }
  const [accounts, total] = await Promise.all([
    ParentAccount.find(filter).select('name contact contactType verificationStatus verifiedAt accountStatus createdAt').sort({ createdAt: -1 }).skip(offset).limit(limit),
    ParentAccount.countDocuments(filter),
  ]);
  const accountIds = accounts.map((item) => item._id);
  const families = accountIds.length ? await Family.find({ guardianId: { $in: accountIds } }).select('_id guardianId status') : [];
  const familyIds = families.map((f) => f._id);
  const children = familyIds.length ? await StudentProfile.find({ familyId: { $in: familyIds } }).select('familyId preferredName ageGroup status') : [];
  const relationshipIds = children.map((c) => c._id);
  const relations = relationshipIds.length ? await GuardianRelationship.find({ studentId: { $in: relationshipIds } }).select('studentId relationshipStatus consentStatus consentPolicyVersion consentRecordedAt') : [];
  const relationMap = new Map(relations.map((r) => [String(r.studentId), r]));
  const familyByGuardian = new Map(families.map((f) => [String(f.guardianId), f]));
  const childrenByFamily = new Map<string, typeof children>();
  for (const child of children) { const key = String(child.familyId); const list = childrenByFamily.get(key) ?? []; list.push(child); childrenByFamily.set(key, list); }
  await appendAudit({ actorId: auth(req).parentId, eventType: 'admin.member_list_viewed', requestId: requestId(req), details: { resultCount: accounts.length } });
  res.json({ members: accounts.map((account) => {
    const family = familyByGuardian.get(String(account._id));
    return { id: String(account._id), name: account.name, contact: account.contact, contactType: account.contactType,
      verificationStatus: account.verificationStatus, verifiedAt: account.verifiedAt ?? null, accountStatus: account.accountStatus, createdAt: account.createdAt,
      family: family ? { status: family.status, students: (childrenByFamily.get(String(family._id)) ?? []).map((child) => {
        const relation = relationMap.get(String(child._id));
        return { preferredName: child.preferredName, ageGroup: child.ageGroup, profileStatus: child.status,
          relationshipStatus: relation?.relationshipStatus ?? 'not_recorded', consentStatus: relation?.consentStatus ?? 'not_recorded',
          consentPolicyVersion: relation?.consentPolicyVersion ?? null, consentRecordedAt: relation?.consentRecordedAt ?? null };
      }) } : null };
  }), total, offset, limit });
}

export async function setMemberStatus(req: Request, res: Response): Promise<void> {
  const current = auth(req);
  if (req.params.parentId === current.parentId) throw forbidden();
  const status = req.body?.status;
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
  if (!['active', 'suspended'].includes(status) || reason.length < 5 || reason.length > 1000) throw badRequest('MEMBER_ACTION_INVALID', 'Choose a status and enter a reason of at least five characters.');
  const account = await ParentAccount.findById(req.params.parentId);
  if (!account) throw notFound();
  account.accountStatus = status; if (status === 'suspended') account.sessionVersion += 1;
  await account.save();
  await appendAudit({ actorId: current.parentId, subjectId: String(account._id), eventType: `admin.parent_account_${status}`, requestId: requestId(req), details: { reason } });
  res.json({ id: String(account._id), accountStatus: account.accountStatus });
}

export async function auditLog(req: Request, res: Response): Promise<void> {
  const { offset, limit } = page(req);
  const filter: Record<string, unknown> = {};
  if (typeof req.query.actorId === 'string' && mongoose.isValidObjectId(req.query.actorId)) filter.actorId = req.query.actorId;
  if (typeof req.query.eventType === 'string' && req.query.eventType.length <= 100) filter.eventType = req.query.eventType;
  if (typeof req.query.from === 'string' || typeof req.query.to === 'string') {
    const occurredAt: Record<string, Date> = {};
    if (typeof req.query.from === 'string' && Number.isFinite(new Date(req.query.from).getTime())) occurredAt.$gte = new Date(req.query.from);
    if (typeof req.query.to === 'string' && Number.isFinite(new Date(req.query.to).getTime())) occurredAt.$lte = new Date(req.query.to);
    if (Object.keys(occurredAt).length) filter.occurredAt = occurredAt;
  }
  const [events, total] = await Promise.all([AuditEvent.find(filter).sort({ occurredAt: -1 }).skip(offset).limit(limit).select('actorId familyId subjectId eventType requestId occurredAt details'), AuditEvent.countDocuments(filter)]);
  await appendAudit({ actorId: auth(req).parentId, eventType: 'admin.audit_log_viewed', requestId: requestId(req), details: { resultCount: events.length } });
  res.json({ events: events.map((event) => ({ actorId: String(event.actorId), subjectId: event.subjectId ? String(event.subjectId) : null, eventType: event.eventType, requestId: event.requestId, occurredAt: event.occurredAt })), total, offset, limit });
}

export const requirePlatformAdmin = requireStaffRole('platform_admin');
