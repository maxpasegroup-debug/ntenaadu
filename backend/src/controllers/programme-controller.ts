import mongoose from 'mongoose';
import type { Request, Response } from 'express';
import { badRequest, forbidden, notFound, unauthorized } from '../errors';
import { Family, GuardianRelationship, PaymentEntitlement, Programme, ProgrammeActivity, ProgrammeEnrollment, ProgrammeModule, ProgrammeProgress, ProgrammeSubmission, StudentProfile } from '../models';
import { appendAudit } from '../services/audit';

function auth(req: Request) { if (!req.nteAuth) throw unauthorized(); return req.nteAuth; }
function validId(value: unknown): string { if (typeof value !== 'string' || !mongoose.isValidObjectId(value)) throw notFound(); return value; }
async function ownStudent(parentId: string, value: unknown) {
  const studentId = validId(value);
  const family = await Family.findOne({ guardianId: parentId, status: 'active' }); if (!family) throw notFound();
  const student = await StudentProfile.findOne({ _id: studentId, familyId: family._id, status: 'active' }); if (!student) throw notFound();
  const relationship = await GuardianRelationship.findOne({ familyId: family._id, guardianId: parentId, studentId, relationshipStatus: 'active', consentStatus: 'granted' });
  if (!relationship) throw forbidden();
  return { family, student };
}
function programmeDto(p: typeof Programme.prototype, entitled = false) {
  const paid = p.accessRequirement === 'paid';
  return { id: p.programmeId, title: p.title, description: p.description, contentLanguage: p.contentLanguage,
    availableLanguages: [p.contentLanguage], ageBands: p.ageBands, durationMinutes: p.durationMinutes ?? null,
    learningObjectives: p.learningObjectives, accessRequirement: p.accessRequirement,
    priceAmountMinor: p.priceAmountMinor ?? null, priceCurrency: p.priceCurrency ?? null, purchaseType: p.purchaseType ?? null,
    priceCurrencyExponent: p.priceCurrencyExponent ?? null,
    accessStatus: !paid ? 'available' : entitled ? 'available' : 'entitlement_required' };
}
function requestId(req: Request) { return req.nteRequestId ?? ''; }
async function activityCount(programmeId: string, ageGroup: string): Promise<number> {
  const [result] = await ProgrammeActivity.aggregate([
    { $match: { programmeId, publicationStatus: 'published', ageBands: ageGroup } },
    { $group: { _id: '$activityId' } },
    { $count: 'total' },
  ]) as Array<{ total: number }>;
  return result?.total ?? 0;
}

export async function listProgrammes(req: Request, res: Response): Promise<void> {
  const current = auth(req);
  const profileId = req.query.studentProfileId;
  const { student } = profileId ? await ownStudent(current.parentId, profileId) : { student: undefined };
  const query: Record<string, unknown> = { publicationStatus: 'published', accessRequirement: 'free' };
  if (student) query.ageBands = student.ageGroup;
  if (typeof req.query.language === 'string') query.contentLanguage = req.query.language;
  if (typeof req.query.q === 'string' && req.query.q.trim()) {
    const escaped = req.query.q.trim().slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    query.$or = [{ title: new RegExp(escaped, 'i') }, { description: new RegExp(escaped, 'i') }];
  }
  const items = await Programme.find(query).sort({ title: 1 }).limit(100);
  const ids = items.map((p) => p.programmeId);
  const activities = ids.length ? await ProgrammeActivity.aggregate([
    { $match: { programmeId: { $in: ids }, publicationStatus: 'published', ...(student ? { ageBands: student.ageGroup } : {}) } },
    { $group: { _id: { programmeId: '$programmeId', activityId: '$activityId' } } },
    { $group: { _id: '$_id.programmeId', count: { $sum: 1 } } },
  ]) as Array<{ _id: string; count: number }> : [];
  const counts = new Map(activities.map((a) => [a._id, a.count]));
  const enrollments = student && ids.length ? await ProgrammeEnrollment.find({ guardianId: current.parentId, studentId: student._id, programmeId: { $in: ids }, status: { $in: ['active', 'completed'] } }).select('programmeId status') : [];
  const entitlements = student && ids.length ? await PaymentEntitlement.find({ guardianId: current.parentId, studentId: student._id, programmeId: { $in: ids }, status: 'active', $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] }).select('programmeId') : [];
  const entitledIds = new Set(entitlements.map((e) => e.programmeId));
  const enrollmentMap = new Map(enrollments.map((e) => [e.programmeId, e.status]));
  res.json({ programmes: items.map((p) => ({ ...programmeDto(p, entitledIds.has(p.programmeId)), activityCount: counts.get(p.programmeId) ?? 0, enrollmentStatus: enrollmentMap.get(p.programmeId) ?? null })) });
}

export async function getProgramme(req: Request, res: Response): Promise<void> {
  const current = auth(req);
  const { student } = req.query.studentProfileId ? await ownStudent(current.parentId, req.query.studentProfileId) : { student: undefined };
  const programme = await Programme.findOne({ programmeId: req.params.programmeId, publicationStatus: 'published', accessRequirement: 'free' });
  if (!programme || (student && !programme.ageBands.includes(student.ageGroup))) throw notFound();
  const entitlement = student && programme.accessRequirement === 'paid' ? await PaymentEntitlement.findOne({ guardianId: current.parentId, studentId: student._id, programmeId: programme.programmeId, status: 'active', $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] }) : null;
  const canAccessContent = programme.accessRequirement === 'free' || Boolean(entitlement);
  const activities = canAccessContent ? await ProgrammeActivity.find({ programmeId: programme.programmeId, contentLanguage: programme.contentLanguage, publicationStatus: 'published', ...(student ? { ageBands: student.ageGroup } : {}) }).sort({ sortOrder: 1, title: 1 }) : [];
  const modules = canAccessContent ? await ProgrammeModule.find({ programmeId: programme.programmeId, contentLanguage: programme.contentLanguage, publicationStatus: 'published' }).sort({ sortOrder: 1, title: 1 }) : [];
  let enrollmentStatus: string | null = null;
  let progress: Array<{ activityId: string; status: string; completionSource: string }> = [];
  let submissions: Array<{ activityId: string; status: string; attempt: number; responseText?: string; feedback?: string }> = [];
  if (student) {
    const enrollment = await ProgrammeEnrollment.findOne({ programmeId: programme.programmeId, guardianId: current.parentId, studentId: student._id, status: { $in: ['active', 'completed'] } });
    enrollmentStatus = enrollment?.status ?? null;
    if (enrollment) {
      progress = await ProgrammeProgress.find({ programmeId: programme.programmeId, guardianId: current.parentId, studentId: student._id }).select('activityId status completionSource -_id').lean() as unknown as Array<{ activityId: string; status: string; completionSource: string }>;
      submissions = await ProgrammeSubmission.find({ programmeId: programme.programmeId, guardianId: current.parentId, studentId: student._id }).select('+responseText +feedback activityId status attempt').sort({ attempt: -1 }).lean() as unknown as typeof submissions;
    }
  }
  const progressByActivity = new Map(progress.map((p) => [p.activityId, p.status]));
  const completionSourceByActivity = new Map(progress.map((p) => [p.activityId, p.completionSource]));
  const submissionByActivity = new Map<string, typeof submissions[number]>();
  for (const submission of submissions) if (!submissionByActivity.has(submission.activityId)) submissionByActivity.set(submission.activityId, submission);
  res.json({ programme: { ...programmeDto(programme, Boolean(entitlement)), modules: modules.map((m) => ({ id: m.moduleId, title: m.title, description: m.description })), activities: activities.map((a) => { const submission = submissionByActivity.get(a.activityId); return { id: a.activityId, moduleId: a.moduleId ?? null, title: a.title, description: a.description, contentLanguage: a.contentLanguage, learningContentId: a.learningContentId ?? null, stage: a.stage, activityType: a.activityType, responseRequired: a.responseRequired, requiresReview: a.requiresReview, submissionStatus: submission?.status ?? null, submissionAttempt: submission?.attempt ?? null, submissionResponse: submission?.responseText ?? null, submissionFeedback: submission?.feedback ?? null, completionSource: completionSourceByActivity.get(a.activityId) ?? null, status: progressByActivity.get(a.activityId) ?? 'not_started' }; }), enrollmentStatus, progress } });
}

export async function enroll(req: Request, res: Response): Promise<void> {
  const current = auth(req);
  const studentId = req.body?.studentProfileId;
  const { family, student } = await ownStudent(current.parentId, studentId);
  const programmeId = req.params.programmeId;
  const programme = await Programme.findOne({ programmeId, publicationStatus: 'published', accessRequirement: 'free' });
  if (!programme || !programme.ageBands.includes(student.ageGroup)) throw notFound();
  if (programme.accessRequirement === 'paid') {
    const entitlement = await PaymentEntitlement.findOne({ guardianId: current.parentId, studentId: student._id, programmeId, status: 'active', $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] });
    if (!entitlement) throw forbidden();
  }
  const existing = await ProgrammeEnrollment.findOne({ programmeId, studentId: student._id });
  if (existing?.status === 'active' || existing?.status === 'completed') { res.json({ enrollmentStatus: existing.status }); return; }
  if (existing) { existing.status = 'active'; existing.enrolledAt = new Date(); await existing.save(); }
  else await ProgrammeEnrollment.create({ programmeId, familyId: family._id, guardianId: current.parentId, studentId: student._id, status: 'active', enrolledAt: new Date() });
  await appendAudit({ actorId: current.parentId, familyId: String(family._id), subjectId: String(student._id), eventType: 'programme.enrolled', requestId: requestId(req), details: { programmeId } });
  res.status(201).json({ enrollmentStatus: 'active' });
}

export async function updateProgress(req: Request, res: Response): Promise<void> {
  const current = auth(req);
  const { family, student } = await ownStudent(current.parentId, req.body?.studentProfileId);
  const programmeId = req.params.programmeId;
  const activityId = req.params.activityId;
  const programme = await Programme.findOne({ programmeId, publicationStatus: 'published', accessRequirement: 'free', ageBands: student.ageGroup });
  if (!programme) throw notFound();
  if (programme.accessRequirement === 'paid') {
    const entitlement = await PaymentEntitlement.findOne({ guardianId: current.parentId, studentId: student._id, programmeId, status: 'active', $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] });
    if (!entitlement) throw forbidden();
  }
  const enrollment = await ProgrammeEnrollment.findOne({ programmeId, guardianId: current.parentId, studentId: student._id, status: 'active' });
  if (!enrollment) throw forbidden();
  const activity = await ProgrammeActivity.findOne({ programmeId, activityId, publicationStatus: 'published', ageBands: student.ageGroup });
  if (!activity) throw notFound();
  const status = req.body?.status;
  if (!['in_progress', 'completed'].includes(status)) throw badRequest('PROGRAMME_PROGRESS_INVALID', 'Select a valid activity progress state.');
  if (activity.stage === 'grow' && status === 'completed') throw forbidden();
  if (status === 'completed' && activity.responseRequired) {
    const submission = await ProgrammeSubmission.findOne({ programmeId, activityId, studentId: student._id }).sort({ attempt: -1 });
    if (!submission || (activity.requiresReview && submission.status !== 'reviewed')) throw forbidden();
  }
  const now = new Date();
  await ProgrammeProgress.findOneAndUpdate({ programmeId, activityId, studentId: student._id }, {
    $set: { familyId: family._id, guardianId: current.parentId, status, recordedBy: current.parentId, recordedAt: now, completionSource: activity.responseRequired ? 'activity_submission' : 'guardian_recorded' },
  }, { upsert: true, new: true, runValidators: true });
  await appendAudit({ actorId: current.parentId, familyId: String(family._id), subjectId: String(student._id), eventType: 'programme.progress_recorded', requestId: requestId(req), details: { programmeId, activityId, status, source: activity.responseRequired ? 'activity_submission' : 'guardian_recorded' } });
  if (status === 'completed') {
    const core = await ProgrammeActivity.find({ programmeId, publicationStatus: 'published', ageBands: student.ageGroup, stage: { $ne: 'grow' } }).select('activityId');
    const coreIds = core.map((item) => item.activityId);
    const coreCompleted = coreIds.length ? await ProgrammeProgress.countDocuments({ programmeId, studentId: student._id, activityId: { $in: coreIds }, status: 'completed' }) : 0;
    if (coreIds.length > 0 && coreCompleted >= coreIds.length) {
      const growthActivities = await ProgrammeActivity.find({ programmeId, publicationStatus: 'published', ageBands: student.ageGroup, stage: 'grow' }).select('activityId');
      for (const growth of growthActivities) await ProgrammeProgress.findOneAndUpdate({ programmeId, activityId: growth.activityId, studentId: student._id }, { $set: { familyId: family._id, guardianId: current.parentId, status: 'completed', recordedBy: current.parentId, recordedAt: now, completionSource: 'system_earned' } }, { upsert: true, new: true, runValidators: true });
      enrollment.status = 'completed'; enrollment.completedAt = now; await enrollment.save();
      await appendAudit({ actorId: current.parentId, familyId: String(family._id), subjectId: String(student._id), eventType: 'programme.completion_recorded', requestId: requestId(req), details: { programmeId, source: growthActivities.length ? 'system_earned' : 'guardian_recorded' } });
    }
  }
  res.json({ status, completionSource: activity.responseRequired ? 'activity_submission' : 'guardian_recorded' });
}

export async function submitActivity(req: Request, res: Response): Promise<void> {
  const current = auth(req);
  const { family, student } = await ownStudent(current.parentId, req.body?.studentProfileId);
  const programmeId = req.params.programmeId;
  const programme = await Programme.findOne({ programmeId, publicationStatus: 'published', accessRequirement: 'free', ageBands: student.ageGroup });
  if (!programme) throw notFound();
  const enrollment = await ProgrammeEnrollment.findOne({ programmeId, guardianId: current.parentId, studentId: student._id, status: 'active' });
  if (!enrollment) throw forbidden();
  const activity = await ProgrammeActivity.findOne({ programmeId, activityId: req.params.activityId, publicationStatus: 'published', ageBands: student.ageGroup });
  if (!activity || !activity.responseRequired) throw notFound();
  const responseText = req.body?.responseText;
  if (typeof responseText !== 'string' || responseText.trim().length < 1 || responseText.trim().length > 4000) throw badRequest('ACTIVITY_RESPONSE_INVALID', 'Enter a response of up to 4,000 characters.');
  const latest = await ProgrammeSubmission.findOne({ programmeId, activityId: activity.activityId, studentId: student._id }).sort({ attempt: -1 }).select('attempt');
  const submittedAt = new Date();
  const submission = await ProgrammeSubmission.create({ programmeId, activityId: activity.activityId, familyId: family._id, guardianId: current.parentId, studentId: student._id, attempt: (latest?.attempt ?? 0) + 1, responseText: responseText.trim(), status: 'submitted', submittedAt });
  await appendAudit({ actorId: current.parentId, familyId: String(family._id), subjectId: String(student._id), eventType: 'programme.activity_submitted', requestId: requestId(req), details: { programmeId, activityId: activity.activityId, submissionId: String(submission._id), attempt: submission.attempt } });
  res.status(201).json({ submission: { status: submission.status, attempt: submission.attempt, submittedAt } });
}

export async function listProgress(req: Request, res: Response): Promise<void> {
  const current = auth(req);
  const { student } = await ownStudent(current.parentId, req.query.studentProfileId);
  const programmeId = req.params.programmeId;
  const programme = await Programme.findOne({ programmeId, publicationStatus: 'published', accessRequirement: 'free', ageBands: student.ageGroup });
  if (!programme) throw notFound();
  const enrollment = await ProgrammeEnrollment.findOne({ programmeId, guardianId: current.parentId, studentId: student._id, status: { $in: ['active', 'completed'] } });
  if (!enrollment) throw notFound();
  const [activities, progress] = await Promise.all([
    activityCount(programmeId, student.ageGroup),
    ProgrammeProgress.find({ programmeId, guardianId: current.parentId, studentId: student._id }).select('activityId status completionSource recordedAt -_id').lean(),
  ]);
  const completed = progress.filter((p) => p.status === 'completed').length;
  res.json({ programmeId, enrollmentStatus: enrollment.status, activityCount: activities, completedCount: completed, progress });
}
