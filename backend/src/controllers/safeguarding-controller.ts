import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import type { Request, Response } from 'express';
import { badRequest, forbidden, notFound, unauthorized } from '../errors';
import { Family, ParentAccount, SafeguardingAuditEvent, SafeguardingNote, SafeguardingReport, StudentProfile } from '../models';

function auth(req: Request) { if (!req.nteAuth) throw unauthorized(); return req.nteAuth; }
function requestId(req: Request) { return req.nteRequestId ?? ''; }
function accessReason(value: unknown) { if (typeof value !== 'string' || value.trim().length < 5 || value.trim().length > 1000) throw badRequest('SAFEGUARDING_REASON_REQUIRED', 'Enter a reason of at least five characters.'); return value.trim(); }
async function audit(req: Request, reportId: string, action: string, reason: string) {
  await SafeguardingAuditEvent.create({ reportId, actorId: auth(req).parentId, action, reason, requestId: requestId(req), occurredAt: new Date() });
}
async function role(req: Request): Promise<Set<string>> {
  const account = await ParentAccount.findOne({ _id: auth(req).parentId, accountStatus: 'active', verificationStatus: 'verified', adultVerificationStatus: 'verified' }).select('+staffRoles +adultVerificationStatus');
  if (!account) throw forbidden();
  return new Set<string>(account.staffRoles ?? []);
}
function statusDto(report: typeof SafeguardingReport.prototype) { return { reportId: report.reportId, status: report.status, createdAt: report.createdAt, updatedAt: report.updatedAt }; }

export async function submitReport(req: Request, res: Response): Promise<void> {
  const current = auth(req);
  const category = req.body?.category;
  const urgency = req.body?.urgency;
  const description = typeof req.body?.description === 'string' ? req.body.description.trim() : '';
  const resourceType = req.body?.resourceType;
  const resourceId = typeof req.body?.resourceId === 'string' ? req.body.resourceId.trim() : '';
  if (!['safety', 'wellbeing', 'conduct', 'other'].includes(category) || !['routine', 'urgent'].includes(urgency) || description.length < 10 || description.length > 4000) throw badRequest('SAFEGUARDING_REPORT_INVALID', 'Complete the concern category and description.');
  if (resourceType != null && !['club', 'event', 'programme', 'other'].includes(resourceType)) throw badRequest('SAFEGUARDING_RESOURCE_INVALID', 'Select a supported related area.');
  if (resourceId.length > 120 || /^https?:\/\//i.test(resourceId)) throw badRequest('SAFEGUARDING_RESOURCE_INVALID', 'Enter a valid related record reference.');
  let reporterFamilyId: unknown;
  const family = await Family.findOne({ guardianId: current.parentId, status: 'active' });
  if (family) reporterFamilyId = family._id;
  let subjectStudentId: mongoose.Types.ObjectId | undefined;
  let subjectGuardianId: mongoose.Types.ObjectId | undefined;
  if (req.body?.subjectStudentProfileId != null) {
    const value = req.body.subjectStudentProfileId;
    if (typeof value !== 'string' || !mongoose.isValidObjectId(value)) throw badRequest('SAFEGUARDING_SUBJECT_INVALID', 'Select a valid student profile.');
    if (!reporterFamilyId) throw notFound();
    const subject = await StudentProfile.findOne({ _id: value, familyId: reporterFamilyId, status: { $ne: 'archived' } }).select('familyId');
    if (!subject) throw notFound();
    const subjectFamily = await Family.findById(subject.familyId).select('guardianId');
    subjectStudentId = subject._id;
    subjectGuardianId = subjectFamily?.guardianId as mongoose.Types.ObjectId | undefined;
  }
  const report = await SafeguardingReport.create({ reportId: randomUUID(), reporterId: current.parentId, ...(reporterFamilyId ? { reporterFamilyId } : {}), category, urgency, description,
    ...(resourceType ? { resourceType } : {}), ...(resourceId ? { resourceId } : {}), ...(subjectStudentId ? { subjectStudentId } : {}), ...(subjectGuardianId ? { subjectGuardianId } : {}), status: 'submitted' });
  await audit(req, report.reportId, 'report_submitted', 'Reporter submitted a concern.');
  res.status(201).json({ report: statusDto(report) });
}

export async function reporterStatus(req: Request, res: Response): Promise<void> {
  const current = auth(req);
  const report = await SafeguardingReport.findOne({ reportId: req.params.reportId, reporterId: current.parentId }).select('+reporterId +subjectGuardianId');
  if (!report || String(report.subjectGuardianId ?? '') === current.parentId) throw notFound();
  res.json({ report: statusDto(report) });
}

export async function reporterReports(req: Request, res: Response): Promise<void> {
  const current = auth(req);
  const reports = await SafeguardingReport.find({ reporterId: current.parentId, $or: [{ subjectGuardianId: { $exists: false } }, { subjectGuardianId: { $ne: current.parentId } }] }).sort({ createdAt: -1 }).limit(50).select('+reporterId reportId status createdAt updatedAt');
  res.json({ reports: reports.map((report) => statusDto(report)) });
}

export async function queue(req: Request, res: Response): Promise<void> {
  const current = auth(req);
  const reason = accessReason(req.query.reason);
  const pagination = page(req);
  const filter: Record<string, unknown> = {};
  if (typeof req.query.status === 'string' && ['submitted', 'acknowledged', 'assigned', 'escalated', 'resolved', 'closed'].includes(req.query.status)) filter.status = req.query.status;
  if (typeof req.query.urgency === 'string' && ['routine', 'urgent'].includes(req.query.urgency)) filter.urgency = req.query.urgency;
  const [reports, total] = await Promise.all([SafeguardingReport.find(filter).sort({ urgency: -1, createdAt: 1 }).skip(pagination.offset).limit(pagination.limit).select('reportId category urgency status resourceType resourceId createdAt updatedAt'), SafeguardingReport.countDocuments(filter)]);
  await SafeguardingAuditEvent.create(reports.map((r) => ({ reportId: r.reportId, actorId: current.parentId, action: 'queue_case_metadata_read', reason, requestId: requestId(req), occurredAt: new Date() })));
  if (reports.length === 0) await audit(req, 'queue', 'queue_read', reason);
  res.json({ reports: reports.map((r) => ({ reportId: r.reportId, category: r.category, urgency: r.urgency, status: r.status, resourceType: r.resourceType ?? null, resourceId: r.resourceId ?? null, createdAt: r.createdAt, updatedAt: r.updatedAt })), total, ...pagination });
}

function page(req: Request) {
  const offset = typeof req.query.offset === 'string' ? Number(req.query.offset) : 0;
  const limit = typeof req.query.limit === 'string' ? Number(req.query.limit) : 25;
  if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw badRequest('PAGINATION_INVALID', 'Search page is invalid.');
  return { offset, limit };
}

export async function caseDetails(req: Request, res: Response): Promise<void> {
  const current = auth(req);
  const reason = accessReason(req.query.reason);
  const report = await SafeguardingReport.findOne({ reportId: req.params.reportId }).select('+reporterId +reporterFamilyId +description +subjectStudentId +subjectGuardianId +assignedTo');
  if (!report) throw notFound();
  const reporter = await ParentAccount.findById(report.reporterId).select('name contact contactType');
  const subject = report.subjectStudentId ? await StudentProfile.findById(report.subjectStudentId).select('preferredName ageGroup status') : null;
  const notes = await SafeguardingNote.find({ reportId: report.reportId }).sort({ createdAt: 1 }).select('authorId body createdAt');
  await audit(req, report.reportId, 'case_details_read', reason);
  res.json({ report: { reportId: report.reportId, category: report.category, urgency: report.urgency, status: report.status, description: report.description,
    resourceType: report.resourceType ?? null, resourceId: report.resourceId ?? null, createdAt: report.createdAt, updatedAt: report.updatedAt,
    reporter: reporter ? { name: reporter.name, contact: reporter.contact, contactType: reporter.contactType } : null,
    subjectStudent: subject ? { preferredName: subject.preferredName, ageGroup: subject.ageGroup, profileStatus: subject.status } : null,
    assignedTo: report.assignedTo ? String(report.assignedTo) : null,
    notes: notes.map((n) => ({ authorId: String(n.authorId), body: n.body, createdAt: n.createdAt })) } });
}

export async function actOnCase(req: Request, res: Response): Promise<void> {
  const current = auth(req);
  const roles = await role(req);
  const action = req.body?.action;
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
  if (!['acknowledge', 'assign', 'escalate', 'resolve', 'close'].includes(action) || reason.length < 5 || reason.length > 1000) throw badRequest('SAFEGUARDING_ACTION_INVALID', 'Choose an action and enter a reason of at least five characters.');
  const leadOnly = ['assign', 'resolve', 'close'].includes(action);
  if (leadOnly ? !roles.has('safeguarding_lead') : !(roles.has('safeguarding_lead') || roles.has('safeguarding_backup'))) throw forbidden();
  const report = await SafeguardingReport.findOne({ reportId: req.params.reportId });
  if (!report) throw notFound();
  const transitions: Record<string, string[]> = {
    acknowledge: ['submitted'], assign: ['submitted', 'acknowledged', 'escalated'], escalate: ['submitted', 'acknowledged', 'assigned'], resolve: ['submitted', 'acknowledged', 'assigned', 'escalated'], close: ['resolved'],
  };
  if (!transitions[action].includes(report.status)) throw badRequest('SAFEGUARDING_TRANSITION_INVALID', 'This case cannot move to that state.');
  let assignedTo: string | undefined;
  if (action === 'assign') {
    assignedTo = req.body?.assignedTo;
    if (typeof assignedTo !== 'string' || !mongoose.isValidObjectId(assignedTo)) throw badRequest('SAFEGUARDING_ASSIGNEE_INVALID', 'Select an authorized safeguarding teammate.');
    const assignee = await ParentAccount.findOne({ _id: assignedTo, accountStatus: 'active', verificationStatus: 'verified', adultVerificationStatus: 'verified', staffRoles: { $in: ['safeguarding_lead', 'safeguarding_backup'] } }).select('_id');
    if (!assignee) throw badRequest('SAFEGUARDING_ASSIGNEE_INVALID', 'Select an authorized safeguarding teammate.');
  }
  const status = action === 'acknowledge' ? 'acknowledged' : action === 'assign' ? 'assigned' : action === 'escalate' ? 'escalated' : action === 'resolve' ? 'resolved' : 'closed';
  report.status = status;
  if (assignedTo) report.assignedTo = assignedTo as unknown as mongoose.Types.ObjectId;
  if (action === 'resolve') report.resolvedAt = new Date();
  if (action === 'close') report.closedAt = new Date();
  await report.save();
  if (typeof req.body?.note === 'string' && req.body.note.trim()) await SafeguardingNote.create({ reportId: report.reportId, authorId: current.parentId, body: req.body.note.trim().slice(0, 3000), createdAt: new Date() });
  await audit(req, report.reportId, `case_${action}`, reason);
  res.json({ report: statusDto(report) });
}
