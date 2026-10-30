import mongoose from 'mongoose';
import type { Request, Response } from 'express';
import { ApiError, badRequest, forbidden, notFound, unauthorized, unavailable } from '../errors';
import { AuditEvent, Club, ClubAnnouncement, ClubApplication, ClubMembershipRequest, Family, GuardianRelationship, ParentAccount, StudentProfile } from '../models';
import { appendAudit } from '../services/audit';
import { adultVerificationProvider } from '../services/adult-verification';

const ageBands = new Set(['child', 'youth']);
const meetingFormats = new Set(['online', 'in_person', 'hybrid']);
const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function auth(req: Request) {
  if (!req.nteAuth) throw unauthorized();
  return req.nteAuth;
}

function id(value: unknown): string {
  if (typeof value !== 'string' || !mongoose.isValidObjectId(value)) throw notFound();
  return value;
}

function membershipKey(clubId: unknown, studentId: unknown): string { return `${String(clubId)}:${String(studentId)}`; }

async function ownStudent(parentId: string, studentIdValue: unknown, session?: mongoose.ClientSession) {
  const studentId = id(studentIdValue);
  const familyQuery = Family.findOne({ guardianId: parentId, status: 'active' });
  if (session) familyQuery.session(session);
  const family = await familyQuery;
  if (!family) throw notFound();
  const studentQuery = StudentProfile.findOne({ _id: studentId, familyId: family._id, status: 'active' });
  if (session) studentQuery.session(session);
  const student = await studentQuery;
  if (!student) throw notFound();
  const relationshipQuery = GuardianRelationship.findOne({
    familyId: family._id, guardianId: parentId, studentId: student._id,
    relationshipStatus: 'active', consentStatus: 'granted',
  });
  if (session) relationshipQuery.session(session);
  const relationship = await relationshipQuery;
  if (!relationship) throw forbidden();
  return { family, student, relationship };
}

function clubSummary(club: typeof Club.prototype) {
  return {
    id: String(club._id),
    name: club.name,
    purpose: club.purpose,
    approximateLocality: club.approximateLocality,
    meetingFormat: club.meetingFormat,
    ageBands: club.ageBands,
    status: club.status,
    approvedAt: club.approvedAt,
  };
}

async function withLeaderNames(club: typeof Club.prototype) {
  const leaders = await ParentAccount.find({ _id: { $in: club.leaderAccountIds }, accountStatus: 'active' }).select('name');
  return leaders.map((leader) => ({ name: leader.name }));
}

async function approvedClub(clubIdValue: unknown) {
  const clubId = id(clubIdValue);
  const club = await Club.findOne({ _id: clubId, status: 'approved' });
  if (!club) throw notFound();
  return club;
}

async function isLeader(accountId: string, club: typeof Club.prototype) {
  return (club.leaderAccountIds ?? []).some((leaderId: unknown) => String(leaderId) === accountId);
}

export async function listClubs(req: Request, res: Response): Promise<void> {
  const current = auth(req);
  const student = req.query.studentProfileId ? (await ownStudent(current.parentId, req.query.studentProfileId)).student : undefined;
  const query: Record<string, unknown> = { status: 'approved' };
  const search = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const locality = typeof req.query.locality === 'string' ? req.query.locality.trim() : '';
  if (search.length > 100 || locality.length > 100) throw badRequest('FILTER_TOO_LONG', 'Club filters are too long.');
  if (search) {
    const expression = new RegExp(escapeRegex(search), 'i');
    query.$or = [{ name: expression }, { purpose: expression }, { approximateLocality: expression }];
  }
  if (locality) query.approximateLocality = new RegExp(escapeRegex(locality), 'i');
  const ageBand = student?.ageGroup ?? (typeof req.query.ageBand === 'string' ? req.query.ageBand : '');
  if (ageBand) {
    if (!ageBands.has(ageBand)) throw badRequest('AGE_GROUP_INVALID', 'Select an available age band.');
    query.ageBands = ageBand;
  }
  const clubs = await Club.find(query).sort({ name: 1 }).limit(80);
  res.json({ clubs: clubs.map((club) => clubSummary(club)) });
}

export async function getClub(req: Request, res: Response): Promise<void> {
  const current = auth(req);
  const club = await approvedClub(req.params.clubId);
  const leaders = await withLeaderNames(club);
  let membershipStatus: Record<string, unknown> | null = null;
  if (req.query.studentProfileId) {
    const { student } = await ownStudent(current.parentId, req.query.studentProfileId);
    if (!(club.ageBands ?? []).includes(student.ageGroup)) throw notFound();
    const membership = await ClubMembershipRequest.findOne({ clubId: club._id, studentId: student._id, guardianId: current.parentId }).sort({ createdAt: -1 });
    membershipStatus = membership ? {
      requestId: String(membership._id), status: membership.status,
      guardianApprovalStatus: membership.guardianApprovalStatus,
      leaderDecision: membership.leaderDecision,
    } : { status: 'none' };
  }
  res.json({ club: { ...clubSummary(club), leaders, eventsAvailable: false }, membershipStatus });
}

export async function createApplication(req: Request, res: Response): Promise<void> {
  const current = auth(req);
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const purpose = typeof req.body?.purpose === 'string' ? req.body.purpose.trim() : '';
  const approximateLocality = typeof req.body?.approximateLocality === 'string' ? req.body.approximateLocality.trim() : '';
  const meetingFormat = req.body?.meetingFormat;
  const selectedAgeBands = Array.isArray(req.body?.ageBands) ? [...new Set(req.body.ageBands)] : [];
  if (name.length < 2 || name.length > 100) throw badRequest('CLUB_NAME_INVALID', 'Enter a club name between 2 and 100 characters.');
  if (purpose.length < 10 || purpose.length > 1200) throw badRequest('CLUB_PURPOSE_INVALID', 'Describe the club purpose in 10 to 1200 characters.');
  if (!approximateLocality || approximateLocality.length > 100) throw badRequest('CLUB_LOCALITY_INVALID', 'Enter an approximate town, panchayat, or district only.');
  if (!meetingFormats.has(meetingFormat)) throw badRequest('MEETING_FORMAT_INVALID', 'Select a supported meeting format.');
  if (selectedAgeBands.length === 0 || selectedAgeBands.some((value) => !ageBands.has(value))) throw badRequest('AGE_GROUP_INVALID', 'Select at least one available age band.');
  const verification = await adultVerificationProvider.checkApplicant(current.parentId);
  const status = verification === 'verified' ? 'pending_review' : 'awaiting_verification';
  const application = await ClubApplication.create({
    applicantId: current.parentId, name, purpose, approximateLocality, meetingFormat,
    ageBands: selectedAgeBands, status, adultVerificationStatus: verification,
  });
  await appendAudit({ actorId: current.parentId, subjectId: String(application._id), eventType: 'club.application_submitted', requestId: current.requestId,
    details: { status, meetingFormat, ageBandCount: selectedAgeBands.length } });
  res.status(201).json({ application: applicationDto(application), activationAvailable: adultVerificationProvider.available });
}

function applicationDto(application: typeof ClubApplication.prototype, applicantName?: string) {
  return {
    id: String(application._id),
    ...(applicantName ? { applicantName } : {}),
    name: application.name,
    purpose: application.purpose,
    approximateLocality: application.approximateLocality,
    meetingFormat: application.meetingFormat,
    ageBands: application.ageBands,
    status: application.status,
    adultVerificationStatus: application.adultVerificationStatus,
    reviewNote: application.reviewNote ?? null,
    createdAt: application.createdAt,
    reviewedAt: application.reviewedAt ?? null,
    clubId: application.clubId ? String(application.clubId) : null,
  };
}

export async function listMyApplications(req: Request, res: Response): Promise<void> {
  const current = auth(req);
  const applications = await ClubApplication.find({ applicantId: current.parentId }).sort({ createdAt: -1 }).limit(50);
  res.json({ applications: applications.map((application) => applicationDto(application)) });
}

export async function cancelApplication(req: Request, res: Response): Promise<void> {
  const current = auth(req);
  const application = await ClubApplication.findOneAndUpdate(
    { _id: id(req.params.applicationId), applicantId: current.parentId, status: { $in: ['awaiting_verification', 'pending_review'] } },
    { $set: { status: 'cancelled' } }, { new: true },
  );
  if (!application) throw new ApiError(409, 'APPLICATION_NOT_CANCELLABLE', 'This application can no longer be cancelled.');
  await appendAudit({ actorId: current.parentId, subjectId: String(application._id), eventType: 'club.application_cancelled', requestId: current.requestId });
  res.json({ application: applicationDto(application) });
}

export async function staffCapabilities(req: Request, res: Response): Promise<void> {
  const current = auth(req);
  const account = await ParentAccount.findOne({ _id: current.parentId, accountStatus: 'active', verificationStatus: 'verified', adultVerificationStatus: 'verified' }).select('+staffRoles +adultVerificationStatus');
  const roles = (account?.staffRoles ?? []) as string[];
  res.json({ roles: roles.filter((role) => role === 'club_reviewer' || role === 'club_moderator' || role === 'event_manager') });
}

export async function staffApplicationQueue(_req: Request, res: Response): Promise<void> {
  const applications = await ClubApplication.find({ status: { $in: ['awaiting_verification', 'pending_review'] } }).sort({ createdAt: 1 }).limit(100);
  const applicantIds = [...new Set(applications.map((application) => String(application.applicantId)))];
  const applicants = await ParentAccount.find({ _id: { $in: applicantIds } }).select('name');
  const nameById = new Map(applicants.map((account) => [String(account._id), account.name] as const));
  res.json({ applications: applications.map((application) => applicationDto(application, nameById.get(String(application.applicantId)))) });
}

export async function staffClubList(_req: Request, res: Response): Promise<void> {
  const clubs = await Club.find({ status: { $in: ['approved', 'suspended'] } }).sort({ name: 1 }).limit(100);
  res.json({ clubs: clubs.map((club) => clubSummary(club)) });
}

export async function reviewApplication(req: Request, res: Response): Promise<void> {
  const current = auth(req);
  const decision = req.body?.decision;
  const reviewNote = typeof req.body?.reviewNote === 'string' ? req.body.reviewNote.trim().slice(0, 500) : '';
  if (!['approve', 'reject'].includes(decision)) throw badRequest('DECISION_INVALID', 'Choose approve or reject.');
  const session = await mongoose.startSession();
  let response: Record<string, unknown> | undefined;
  try {
    await session.withTransaction(async () => {
      const application = await ClubApplication.findOne({ _id: id(req.params.applicationId), status: { $in: ['awaiting_verification', 'pending_review'] } }).session(session);
      if (!application) throw notFound();
      if (decision === 'approve' && application.adultVerificationStatus !== 'verified') {
        throw unavailable('ADULT_VERIFICATION_UNAVAILABLE', 'This adult applicant has not completed a configured age and identity verification workflow. The club cannot be approved.');
      }
      let club: typeof Club.prototype | undefined;
      if (decision === 'approve') {
        const applicant = await ParentAccount.updateOne({ _id: application.applicantId, accountStatus: 'active' }, { $set: { adultVerificationStatus: 'verified', adultVerifiedAt: new Date() } }, { session });
        if (applicant.matchedCount !== 1) throw notFound();
        const [created] = await Club.create([{
          name: application.name, purpose: application.purpose, approximateLocality: application.approximateLocality,
          meetingFormat: application.meetingFormat, ageBands: application.ageBands, status: 'approved',
          leaderAccountIds: [application.applicantId], createdFromApplicationId: application._id,
          approvedBy: current.parentId, approvedAt: new Date(),
        }], { session });
        club = created;
      }
      application.status = decision === 'approve' ? 'approved' : 'rejected';
      application.reviewerId = new mongoose.Types.ObjectId(current.parentId);
      application.reviewedAt = new Date();
      application.reviewNote = reviewNote;
      if (club) application.clubId = club._id;
      await application.save({ session });
      await appendAudit({ actorId: current.parentId, subjectId: String(application._id), eventType: decision === 'approve' ? 'club.application_approved' : 'club.application_rejected', requestId: current.requestId,
        details: { status: application.status, ...(club ? { clubId: String(club._id) } : {}) } }, session);
      response = { application: applicationDto(application), ...(club ? { club: clubSummary(club) } : {}) };
    });
  } finally { await session.endSession(); }
  res.json(response);
}

export async function moderateClub(req: Request, res: Response): Promise<void> {
  const current = auth(req);
  const action = req.body?.action;
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
  if (!['suspend', 'reinstate'].includes(action) || reason.length < 5 || reason.length > 500) throw badRequest('MODERATION_INPUT_INVALID', 'Choose an action and provide a reason between 5 and 500 characters.');
  const club = await Club.findById(id(req.params.clubId));
  if (!club) throw notFound();
  if (action === 'suspend' && club.status !== 'approved') throw new ApiError(409, 'CLUB_STATUS_CONFLICT', 'Only an approved club can be suspended.');
  if (action === 'reinstate' && club.status !== 'suspended') throw new ApiError(409, 'CLUB_STATUS_CONFLICT', 'Only a suspended club can be reinstated.');
  club.status = action === 'suspend' ? 'suspended' : 'approved';
  club.moderationReason = reason;
  club.suspendedBy = action === 'suspend' ? new mongoose.Types.ObjectId(current.parentId) : undefined;
  club.suspendedAt = action === 'suspend' ? new Date() : undefined;
  await club.save();
  await appendAudit({ actorId: current.parentId, subjectId: String(club._id), eventType: action === 'suspend' ? 'club.suspended' : 'club.reinstated', requestId: current.requestId, details: { reason } });
  res.json({ club: clubSummary(club) });
}

export async function createMembershipRequest(req: Request, res: Response): Promise<void> {
  const current = auth(req);
  const club = await approvedClub(req.params.clubId);
  const { family, student } = await ownStudent(current.parentId, req.body?.studentProfileId);
  if (!(club.ageBands ?? []).includes(student.ageGroup)) throw new ApiError(409, 'AGE_BAND_NOT_ELIGIBLE', 'This club is not approved for this profile age band.');
  const active = await ClubMembershipRequest.findOne({ clubId: club._id, studentId: student._id, status: { $in: ['pending_guardian', 'pending_leader', 'accepted'] } });
  if (active) throw new ApiError(409, 'MEMBERSHIP_REQUEST_EXISTS', 'A request or membership already exists for this profile.');
  try {
    const membership = await ClubMembershipRequest.create({
      clubId: club._id, familyId: family._id, guardianId: current.parentId, studentId: student._id,
      status: 'pending_guardian', guardianApprovalStatus: 'pending', leaderDecision: 'pending',
      activeKey: membershipKey(club._id, student._id),
    });
    await appendAudit({ actorId: current.parentId, familyId: String(family._id), subjectId: String(student._id), eventType: 'club.membership_request_created', requestId: current.requestId,
      details: { clubId: String(club._id), requestId: String(membership._id), status: membership.status } });
    res.status(201).json({ request: membershipDto(membership, club.name, student.ageGroup) });
  } catch (error) {
    if ((error as { code?: number })?.code === 11000) throw new ApiError(409, 'MEMBERSHIP_REQUEST_EXISTS', 'A request or membership already exists for this profile.');
    throw error;
  }
}

function membershipDto(membership: typeof ClubMembershipRequest.prototype, clubName?: string, ageGroup?: string, studentName?: string) {
  return {
    id: String(membership._id),
    clubId: String(membership.clubId),
    ...(clubName ? { clubName } : {}),
    ...(ageGroup ? { ageGroup } : {}),
    ...(studentName ? { studentName } : {}),
    status: membership.status,
    guardianApprovalStatus: membership.guardianApprovalStatus,
    leaderDecision: membership.leaderDecision,
    createdAt: membership.createdAt,
  };
}

export async function listGuardianRequests(req: Request, res: Response): Promise<void> {
  const current = auth(req);
  const family = await Family.findOne({ guardianId: current.parentId, status: 'active' });
  if (!family) throw notFound();
  const requests = await ClubMembershipRequest.find({ guardianId: current.parentId, familyId: family._id }).sort({ createdAt: -1 }).limit(100);
  const clubIds = [...new Set(requests.map((request) => String(request.clubId)))];
  const studentIds = [...new Set(requests.map((request) => String(request.studentId)))];
  const [clubs, students] = await Promise.all([
    Club.find({ _id: { $in: clubIds } }).select('name'),
    StudentProfile.find({ _id: { $in: studentIds }, familyId: family._id }).select('preferredName ageGroup'),
  ]);
  const clubNames = new Map(clubs.map((club) => [String(club._id), club.name] as const));
  const studentById = new Map(students.map((student) => [String(student._id), student] as const));
  res.json({ requests: requests.map((request) => {
    const student = studentById.get(String(request.studentId));
    return membershipDto(request, clubNames.get(String(request.clubId)), student?.ageGroup, student?.preferredName);
  }) });
}

export async function decideGuardianRequest(req: Request, res: Response): Promise<void> {
  const current = auth(req);
  const decision = req.body?.decision;
  if (!['approve', 'reject'].includes(decision)) throw badRequest('DECISION_INVALID', 'Choose approve or reject.');
  const membership = await ClubMembershipRequest.findOne({ _id: id(req.params.requestId), guardianId: current.parentId, status: 'pending_guardian' });
  if (!membership) throw notFound();
  if (decision === 'approve') await ownStudent(current.parentId, String(membership.studentId));
  const family = await Family.findOne({ _id: membership.familyId, guardianId: current.parentId, status: 'active' });
  if (!family) throw notFound();
  membership.guardianApprovalStatus = decision === 'approve' ? 'approved' : 'rejected';
  membership.status = decision === 'approve' ? 'pending_leader' : 'declined';
  membership.guardianReviewedAt = new Date();
  if (decision === 'reject') membership.activeKey = undefined;
  await membership.save();
  await appendAudit({ actorId: current.parentId, familyId: String(family._id), subjectId: String(membership.studentId), eventType: decision === 'approve' ? 'club.guardian_approved_membership' : 'club.guardian_rejected_membership', requestId: current.requestId,
    details: { clubId: String(membership.clubId), requestId: String(membership._id), status: membership.status } });
  res.json({ request: membershipDto(membership) });
}

export async function cancelMembershipRequest(req: Request, res: Response): Promise<void> {
  const current = auth(req);
  const membership = await ClubMembershipRequest.findOne({ _id: id(req.params.requestId), guardianId: current.parentId, status: { $in: ['pending_guardian', 'pending_leader'] } });
  if (!membership) throw new ApiError(409, 'REQUEST_NOT_CANCELLABLE', 'Only requests awaiting guardian or club-leader decisions can be cancelled.');
  const family = await Family.findOne({ _id: membership.familyId, guardianId: current.parentId, status: 'active' });
  if (!family) throw notFound();
  membership.status = 'cancelled';
  membership.cancelledAt = new Date();
  membership.activeKey = undefined;
  await membership.save();
  await appendAudit({ actorId: current.parentId, familyId: String(family._id), subjectId: String(membership.studentId), eventType: 'club.membership_request_cancelled', requestId: current.requestId,
    details: { clubId: String(membership.clubId), requestId: String(membership._id) } });
  res.json({ request: membershipDto(membership) });
}

export async function leaderClubs(req: Request, res: Response): Promise<void> {
  const current = auth(req);
  const clubs = await Club.find({ leaderAccountIds: current.parentId, status: { $in: ['approved', 'suspended'] } }).sort({ name: 1 });
  res.json({ clubs: clubs.map((club) => clubSummary(club)) });
}

export async function leaderRequests(req: Request, res: Response): Promise<void> {
  const current = auth(req);
  const clubs = await Club.find({ leaderAccountIds: current.parentId, status: 'approved' }).select('_id name');
  const names = new Map(clubs.map((club) => [String(club._id), club.name] as const));
  const requests = await ClubMembershipRequest.find({ clubId: { $in: [...names.keys()] }, status: 'pending_leader', guardianApprovalStatus: 'approved' }).sort({ createdAt: 1 }).limit(100);
  const students = await StudentProfile.find({ _id: { $in: requests.map((request) => request.studentId) }, status: 'active' }).select('ageGroup');
  const ages = new Map(students.map((student) => [String(student._id), student.ageGroup] as const));
  res.json({ requests: requests.map((request) => membershipDto(request, names.get(String(request.clubId)), ages.get(String(request.studentId)))) });
}

export async function decideLeaderRequest(req: Request, res: Response): Promise<void> {
  const current = auth(req);
  const decision = req.body?.decision;
  if (!['accept', 'reject'].includes(decision)) throw badRequest('DECISION_INVALID', 'Choose accept or reject.');
  const membership = await ClubMembershipRequest.findOne({ _id: id(req.params.requestId), status: 'pending_leader', guardianApprovalStatus: 'approved' });
  if (!membership) throw notFound();
  const club = await approvedClub(String(membership.clubId));
  if (!(await isLeader(current.parentId, club))) throw forbidden();
  await ownStudent(String(membership.guardianId), String(membership.studentId));
  membership.leaderDecision = decision === 'accept' ? 'accepted' : 'declined';
  membership.status = decision === 'accept' ? 'accepted' : 'declined';
  membership.leaderAccountId = new mongoose.Types.ObjectId(current.parentId);
  membership.leaderDecidedAt = new Date();
  if (decision === 'reject') membership.activeKey = undefined;
  await membership.save();
  await appendAudit({ actorId: current.parentId, familyId: String(membership.familyId), subjectId: String(membership.studentId), eventType: `club.leader_${decision === 'accept' ? 'accepted' : 'rejected'}_membership`, requestId: current.requestId,
    details: { clubId: String(club._id), requestId: String(membership._id), status: membership.status } });
  res.json({ request: membershipDto(membership) });
}

export async function createAnnouncement(req: Request, res: Response): Promise<void> {
  const current = auth(req);
  const body = typeof req.body?.body === 'string' ? req.body.body.trim() : '';
  if (!body || body.length > 1600) throw badRequest('ANNOUNCEMENT_INVALID', 'Enter an announcement up to 1600 characters.');
  const club = await approvedClub(req.params.clubId);
  if (!(await isLeader(current.parentId, club))) throw forbidden();
  const announcement = await ClubAnnouncement.create({ clubId: club._id, authorId: current.parentId, body, status: 'published' });
  await appendAudit({ actorId: current.parentId, subjectId: String(club._id), eventType: 'club.announcement_published', requestId: current.requestId,
    details: { announcementId: String(announcement._id) } });
  res.status(201).json({ announcement: { id: String(announcement._id), body: announcement.body, createdAt: announcement.createdAt, authorName: (await ParentAccount.findById(current.parentId).select('name'))?.name ?? '' } });
}

export async function clubAnnouncements(req: Request, res: Response): Promise<void> {
  const current = auth(req);
  const club = await approvedClub(req.params.clubId);
  const leader = await isLeader(current.parentId, club);
  if (!leader) {
    const { student } = await ownStudent(current.parentId, req.query.studentProfileId);
    const member = await ClubMembershipRequest.findOne({ clubId: club._id, guardianId: current.parentId, studentId: student._id, status: 'accepted' });
    if (!member) throw forbidden();
  }
  const announcements = await ClubAnnouncement.find({ clubId: club._id, status: 'published' }).sort({ createdAt: -1 }).limit(50);
  const authors = await ParentAccount.find({ _id: { $in: announcements.map((item) => item.authorId) }, accountStatus: 'active' }).select('name');
  const authorNames = new Map(authors.map((author) => [String(author._id), author.name] as const));
  res.json({ announcements: announcements.map((item) => ({ id: String(item._id), body: item.body, createdAt: item.createdAt, authorName: authorNames.get(String(item.authorId)) ?? '' })) });
}

export async function removeAnnouncement(req: Request, res: Response): Promise<void> {
  const current = auth(req);
  const announcement = await ClubAnnouncement.findOneAndUpdate({ _id: id(req.params.announcementId), status: 'published' },
    { $set: { status: 'removed', removedBy: current.parentId, removedAt: new Date() } }, { new: true });
  if (!announcement) throw notFound();
  await appendAudit({ actorId: current.parentId, subjectId: String(announcement.clubId), eventType: 'club.announcement_removed', requestId: current.requestId,
    details: { announcementId: String(announcement._id) } });
  res.status(204).end();
}

export async function staffAudit(req: Request, res: Response): Promise<void> {
  const current = auth(req);
  const events = await AuditEvent.find({ eventType: /^club\./ }).sort({ occurredAt: -1 }).limit(100).select('eventType subjectId occurredAt details actorId');
  res.json({ events: events.map((event) => ({ eventType: event.eventType, subjectId: event.subjectId ? String(event.subjectId) : null, occurredAt: event.occurredAt, details: event.details })) });
}
