import mongoose from 'mongoose';
import type { Request, Response } from 'express';
import { badRequest, forbidden, notFound, unauthorized } from '../errors';
import { Family, GuardianRelationship, PaymentEntitlement, Programme, ProgrammeActivity, ProgrammeEnrollment, ProgrammeModule, ProgrammeProgress, StudentProfile } from '../models';
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
  if (student) {
    const enrollment = await ProgrammeEnrollment.findOne({ programmeId: programme.programmeId, guardianId: current.parentId, studentId: student._id, status: { $in: ['active', 'completed'] } });
    enrollmentStatus = enrollment?.status ?? null;
    if (enrollment) progress = await ProgrammeProgress.find({ programmeId: programme.programmeId, guardianId: current.parentId, studentId: student._id }).select('activityId status completionSource -_id').lean();
  }
  const progressByActivity = new Map(progress.map((p) => [p.activityId, p.status]));
  res.json({ programme: { ...programmeDto(programme, Boolean(entitlement)), modules: modules.map((m) => ({ id: m.moduleId, title: m.title, description: m.description })), activities: activities.map((a) => ({ id: a.activityId, moduleId: a.moduleId ?? null, title: a.title, description: a.description, contentLanguage: a.contentLanguage, learningContentId: a.learningContentId ?? null, status: progressByActivity.get(a.activityId) ?? 'not_started' })), enrollmentStatus, progress } });
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
  const now = new Date();
  await ProgrammeProgress.findOneAndUpdate({ programmeId, activityId, studentId: student._id }, {
    $set: { familyId: family._id, guardianId: current.parentId, status, recordedBy: current.parentId, recordedAt: now, completionSource: 'guardian_recorded' },
  }, { upsert: true, new: true, runValidators: true });
  await appendAudit({ actorId: current.parentId, familyId: String(family._id), subjectId: String(student._id), eventType: 'programme.progress_recorded', requestId: requestId(req), details: { programmeId, activityId, status, source: 'guardian_recorded' } });
  if (status === 'completed') {
    const total = await activityCount(programmeId, student.ageGroup);
    const completed = await ProgrammeProgress.countDocuments({ programmeId, studentId: student._id, status: 'completed' });
    if (total > 0 && completed >= total) {
      enrollment.status = 'completed'; enrollment.completedAt = now; await enrollment.save();
      await appendAudit({ actorId: current.parentId, familyId: String(family._id), subjectId: String(student._id), eventType: 'programme.completion_recorded', requestId: requestId(req), details: { programmeId, source: 'guardian_recorded' } });
    }
  }
  res.json({ status, completionSource: 'guardian_recorded' });
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
  res.json({ programmeId, enrollmentStatus: enrollment.status, activityCount: activities, completedCount: completed, completionSource: 'guardian_recorded', progress });
}
