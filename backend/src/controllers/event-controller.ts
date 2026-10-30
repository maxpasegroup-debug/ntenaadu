import mongoose from 'mongoose';
import type { Request, Response } from 'express';
import { ApiError, badRequest, forbidden, notFound, unauthorized } from '../errors';
import { AuditEvent, Club, Event, EventAnnouncement, EventAttendance, EventRegistration, Family, GuardianRelationship, ParentAccount, StudentProfile } from '../models';
import { appendAudit } from '../services/audit';

const validBands = new Set(['child', 'youth']);
function auth(req: Request) { if (!req.nteAuth) throw unauthorized(); return req.nteAuth; }
function objectId(value: unknown): string { if (typeof value !== 'string' || !mongoose.isValidObjectId(value)) throw notFound(); return value; }
function bands(value: unknown): string[] {
  if (!Array.isArray(value) || value.length === 0 || value.some((entry) => typeof entry !== 'string' || !validBands.has(entry))) throw badRequest('EVENT_AGE_BANDS_INVALID', 'Select one or more available age groups.');
  return [...new Set(value as string[])];
}
function eventDto(event: typeof Event.prototype, clubName?: string) {
  return { id: String(event._id), clubId: String(event.clubId), ...(clubName ? { clubName } : {}), title: event.title, description: event.description, startsAt: event.startsAt, endsAt: event.endsAt, approximateLocality: event.approximateLocality, ageBands: event.ageBands, capacity: event.capacity, confirmedCount: event.confirmedCount, placesAvailable: Math.max(0, event.capacity - event.confirmedCount), participationInstructions: event.participationInstructions ?? '', status: event.status };
}
async function ownStudent(parentId: string, studentValue: unknown, session?: mongoose.ClientSession) {
  const studentId = objectId(studentValue);
  const fq = Family.findOne({ guardianId: parentId, status: 'active' }); if (session) fq.session(session);
  const family = await fq; if (!family) throw notFound();
  const sq = StudentProfile.findOne({ _id: studentId, familyId: family._id, status: 'active' }); if (session) sq.session(session);
  const student = await sq; if (!student) throw notFound();
  const rq = GuardianRelationship.findOne({ familyId: family._id, guardianId: parentId, studentId, relationshipStatus: 'active', consentStatus: 'granted' }); if (session) rq.session(session);
  const relationship = await rq; if (!relationship) throw forbidden();
  return { family, student, relationship };
}
async function organizer(accountId: string, club: typeof Club.prototype): Promise<boolean> {
  const leader = (club.leaderAccountIds ?? []).some((leaderId: unknown) => String(leaderId) === accountId);
  if (!leader) return false;
  return Boolean(await ParentAccount.findOne({ _id: accountId, accountStatus: 'active', verificationStatus: 'verified', adultVerificationStatus: 'verified' }).select('_id +adultVerificationStatus'));
}
async function canManage(accountId: string, club: typeof Club.prototype): Promise<boolean> {
  if (await organizer(accountId, club)) return true;
  return Boolean(await ParentAccount.findOne({ _id: accountId, accountStatus: 'active', verificationStatus: 'verified', adultVerificationStatus: 'verified', staffRoles: 'event_manager' }).select('+staffRoles +adultVerificationStatus'));
}
async function eventAndClub(eventId: unknown, allowCancelled = false) {
  const event = await Event.findOne({ _id: objectId(eventId), ...(allowCancelled ? {} : { status: 'published' }) });
  if (!event) throw notFound();
  const club = await Club.findOne({ _id: event.clubId, status: 'approved' });
  if (!club) throw notFound();
  return { event, club };
}
function parseDate(value: unknown, code: string): Date {
  if (typeof value !== 'string') throw badRequest(code, 'Enter a valid date and time.');
  const date = new Date(value); if (!Number.isFinite(date.getTime())) throw badRequest(code, 'Enter a valid date and time.');
  return date;
}

export async function listEvents(req: Request, res: Response): Promise<void> {
  const current = auth(req);
  const view = req.query.view === 'past' ? 'past' : 'upcoming';
  const student = req.query.studentProfileId ? (await ownStudent(current.parentId, req.query.studentProfileId)).student : undefined;
  const query: Record<string, unknown> = { status: 'published', startsAt: view === 'past' ? { $lt: new Date() } : { $gte: new Date() } };
  if (typeof req.query.clubId === 'string') query.clubId = objectId(req.query.clubId);
  if (student) query.ageBands = student.ageGroup;
  const events = await Event.find(query).sort({ startsAt: view === 'past' ? -1 : 1 }).limit(100);
  const clubs = await Club.find({ _id: { $in: events.map((event) => event.clubId) }, status: 'approved' }).select('name');
  const names = new Map(clubs.map((club) => [String(club._id), club.name] as const));
  const visibleEvents = events.filter((event) => names.has(String(event.clubId)));
  const registrations = student ? await EventRegistration.find({ eventId: { $in: visibleEvents.map((event) => event._id) }, studentId: student._id, guardianId: current.parentId }).select('eventId status guardianApprovalStatus') : [];
  const regByEvent = new Map(registrations.map((registration) => [String(registration.eventId), registration] as const));
  res.json({ events: visibleEvents.map((event) => ({ ...eventDto(event, names.get(String(event.clubId))), registration: regByEvent.has(String(event._id)) ? { id: String(regByEvent.get(String(event._id))!._id), status: regByEvent.get(String(event._id))!.status, guardianApprovalStatus: regByEvent.get(String(event._id))!.guardianApprovalStatus } : null })) });
}

export async function getEvent(req: Request, res: Response): Promise<void> {
  const current = auth(req); const { event, club } = await eventAndClub(req.params.eventId, true);
  let registration = null;
  if (req.query.studentProfileId) {
    const { student } = await ownStudent(current.parentId, req.query.studentProfileId);
    const record = await EventRegistration.findOne({ eventId: event._id, studentId: student._id, guardianId: current.parentId });
    if (record) registration = { id: String(record._id), status: record.status, guardianApprovalStatus: record.guardianApprovalStatus };
  }
  res.json({ event: eventDto(event, club.name), registration });
}

export async function createEvent(req: Request, res: Response): Promise<void> {
  const current = auth(req); const club = await Club.findOne({ _id: objectId(req.params.clubId), status: 'approved' }); if (!club) throw notFound();
  if (!(await canManage(current.parentId, club))) throw forbidden();
  const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
  const description = typeof req.body?.description === 'string' ? req.body.description.trim() : '';
  const approximateLocality = typeof req.body?.approximateLocality === 'string' ? req.body.approximateLocality.trim() : '';
  const instructions = typeof req.body?.participationInstructions === 'string' ? req.body.participationInstructions.trim() : '';
  const startsAt = parseDate(req.body?.startsAt, 'EVENT_START_INVALID'); const endsAt = parseDate(req.body?.endsAt, 'EVENT_END_INVALID');
  const capacity = req.body?.capacity;
  const selectedBands = bands(req.body?.ageBands);
  if (title.length < 2 || title.length > 160 || description.length < 10 || description.length > 4000 || !approximateLocality || approximateLocality.length > 100 || instructions.length > 2000) throw badRequest('EVENT_DETAILS_INVALID', 'Complete the event details using the stated limits.');
  if (startsAt <= new Date() || endsAt <= startsAt) throw badRequest('EVENT_TIME_INVALID', 'Choose a future start time and a later end time.');
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 10000) throw badRequest('EVENT_CAPACITY_INVALID', 'Set an event capacity between 1 and 10000.');
  if (selectedBands.some((band) => !(club.ageBands ?? []).includes(band))) throw badRequest('EVENT_AGE_BANDS_INVALID', 'Event age groups must be within the approved club age groups.');
  const session = await mongoose.startSession(); let event: typeof Event.prototype | undefined;
  try { await session.withTransaction(async () => {
    const [created] = await Event.create([{ clubId: club._id, title, description, startsAt, endsAt, approximateLocality, ageBands: selectedBands, capacity, participationInstructions: instructions, status: 'published', createdBy: current.parentId }], { session });
    event = created;
    await appendAudit({ actorId: current.parentId, subjectId: String(created._id), eventType: 'event.created', requestId: current.requestId, details: { clubId: String(club._id), capacity, ageBandCount: selectedBands.length } }, session);
  }); } finally { await session.endSession(); }
  if (!event) throw new ApiError(500, 'EVENT_CREATE_FAILED', 'The event could not be saved.');
  res.status(201).json({ event: eventDto(event, club.name) });
}

export async function updateEvent(req: Request, res: Response): Promise<void> {
  const current = auth(req); const { event, club } = await eventAndClub(req.params.eventId);
  if (!(await canManage(current.parentId, club))) throw forbidden();
  if (event.startsAt <= new Date()) throw new ApiError(409, 'EVENT_ALREADY_STARTED', 'Started events can no longer be edited.');
  const startsAt = req.body?.startsAt === undefined ? event.startsAt : parseDate(req.body.startsAt, 'EVENT_START_INVALID');
  const endsAt = req.body?.endsAt === undefined ? event.endsAt : parseDate(req.body.endsAt, 'EVENT_END_INVALID');
  const capacity = req.body?.capacity === undefined ? event.capacity : req.body.capacity;
  const selectedBands = req.body?.ageBands === undefined ? event.ageBands : bands(req.body.ageBands);
  if (startsAt <= new Date() || endsAt <= startsAt || !Number.isInteger(capacity) || capacity < event.confirmedCount || capacity > 10000) throw badRequest('EVENT_UPDATE_INVALID', 'The new date or capacity is invalid. Capacity cannot be lower than confirmed registrations.');
  if (selectedBands.some((band) => !(club.ageBands ?? []).includes(band))) throw badRequest('EVENT_AGE_BANDS_INVALID', 'Event age groups must be within the approved club age groups.');
  if (selectedBands.join(',') !== (event.ageBands ?? []).join(',')) {
    const activeRegistrations = await EventRegistration.find({ eventId: event._id, status: { $in: ['pending_guardian', 'confirmed', 'waitlisted'] } }).select('studentId');
    const activeStudents = await StudentProfile.find({ _id: { $in: activeRegistrations.map((registration) => registration.studentId) } }).select('ageGroup');
    if (activeStudents.some((student) => !selectedBands.includes(student.ageGroup))) throw new ApiError(409, 'EVENT_AGE_BANDS_IN_USE', 'Age groups cannot be removed while affected registrations remain active.');
  }
  const title = req.body?.title === undefined ? event.title : typeof req.body.title === 'string' ? req.body.title.trim() : '';
  const description = req.body?.description === undefined ? event.description : typeof req.body.description === 'string' ? req.body.description.trim() : '';
  const locality = req.body?.approximateLocality === undefined ? event.approximateLocality : typeof req.body.approximateLocality === 'string' ? req.body.approximateLocality.trim() : '';
  const instructions = req.body?.participationInstructions === undefined ? event.participationInstructions : typeof req.body.participationInstructions === 'string' ? req.body.participationInstructions.trim() : '';
  if (title.length < 2 || title.length > 160 || description.length < 10 || description.length > 4000 || !locality || locality.length > 100 || instructions.length > 2000) throw badRequest('EVENT_DETAILS_INVALID', 'Complete the event details using the stated limits.');
  Object.assign(event, { title, description, startsAt, endsAt, capacity, ageBands: selectedBands, approximateLocality: locality, participationInstructions: instructions });
  await event.save();
  await appendAudit({ actorId: current.parentId, subjectId: String(event._id), eventType: 'event.updated', requestId: current.requestId, details: { capacity, confirmedCount: event.confirmedCount } });
  res.json({ event: eventDto(event, club.name) });
}

export async function cancelEvent(req: Request, res: Response): Promise<void> {
  const current = auth(req); const { event, club } = await eventAndClub(req.params.eventId);
  if (!(await canManage(current.parentId, club))) throw forbidden();
  if (event.endsAt <= new Date()) throw new ApiError(409, 'EVENT_ALREADY_ENDED', 'Ended events can no longer be cancelled.');
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
  if (reason.length < 5 || reason.length > 500) throw badRequest('EVENT_CANCELLATION_REASON_INVALID', 'Provide a cancellation reason between 5 and 500 characters.');
  event.status = 'cancelled'; event.cancelledBy = new mongoose.Types.ObjectId(current.parentId); event.cancelledAt = new Date(); await event.save();
  await appendAudit({ actorId: current.parentId, subjectId: String(event._id), eventType: 'event.cancelled', requestId: current.requestId, details: { clubId: String(club._id), reason } });
  res.json({ event: eventDto(event, club.name) });
}

export async function registerForEvent(req: Request, res: Response): Promise<void> {
  const current = auth(req); const { event, club } = await eventAndClub(req.params.eventId);
  const { family, student } = await ownStudent(current.parentId, req.body?.studentProfileId);
  if (!(event.ageBands ?? []).includes(student.ageGroup) || !(club.ageBands ?? []).includes(student.ageGroup)) throw new ApiError(409, 'EVENT_AGE_INELIGIBLE', 'This event is not approved for the selected profile age group.');
  if (event.startsAt <= new Date()) throw new ApiError(409, 'EVENT_REGISTRATION_CLOSED', 'Registration is closed because the event has started.');
  const session = await mongoose.startSession(); let registration: typeof EventRegistration.prototype | undefined;
  try {
    await session.withTransaction(async () => {
      const [created] = await EventRegistration.create([{ eventId: event._id, clubId: club._id, familyId: family._id, guardianId: current.parentId, studentId: student._id, status: 'pending_guardian', guardianApprovalStatus: 'pending', activeKey: `${event._id}:${student._id}` }], { session });
      registration = created;
      await appendAudit({ actorId: current.parentId, familyId: String(family._id), subjectId: String(student._id), eventType: 'event.registration_requested', requestId: current.requestId, details: { eventId: String(event._id), registrationId: String(created._id), status: created.status } }, session);
    });
    if (!registration) throw new ApiError(500, 'EVENT_REGISTRATION_FAILED', 'The registration could not be saved.');
    res.status(201).json({ registration: { id: String(registration._id), eventId: String(event._id), status: registration.status, guardianApprovalStatus: registration.guardianApprovalStatus } });
  } catch (error) {
    if ((error as { code?: number })?.code === 11000) throw new ApiError(409, 'EVENT_REGISTRATION_EXISTS', 'An active registration already exists for this profile.');
    throw error;
  } finally { await session.endSession(); }
}

export async function guardianRegistrations(req: Request, res: Response): Promise<void> {
  const current = auth(req); const family = await Family.findOne({ guardianId: current.parentId, status: 'active' }); if (!family) throw notFound();
  const query: Record<string, unknown> = { guardianId: current.parentId, familyId: family._id };
  if (req.query.studentProfileId) { const student = await StudentProfile.findOne({ _id: objectId(req.query.studentProfileId), familyId: family._id }); if (!student) throw notFound(); query.studentId = student._id; }
  const registrations = await EventRegistration.find(query).sort({ createdAt: -1 }).limit(100);
  const eventIds = [...new Set(registrations.map((r) => String(r.eventId)))]; const studentIds = [...new Set(registrations.map((r) => String(r.studentId)))];
  const [events, students] = await Promise.all([Event.find({ _id: { $in: eventIds } }).select('title startsAt status'), StudentProfile.find({ _id: { $in: studentIds }, familyId: family._id }).select('preferredName ageGroup')]);
  const eventMap = new Map(events.map((e) => [String(e._id), e] as const)); const studentMap = new Map(students.map((s) => [String(s._id), s] as const));
  res.json({ registrations: registrations.map((r) => ({ id: String(r._id), eventId: String(r.eventId), eventTitle: eventMap.get(String(r.eventId))?.title ?? '', startsAt: eventMap.get(String(r.eventId))?.startsAt ?? null, eventStatus: eventMap.get(String(r.eventId))?.status ?? 'cancelled', studentId: String(r.studentId), studentName: studentMap.get(String(r.studentId))?.preferredName ?? '', ageGroup: studentMap.get(String(r.studentId))?.ageGroup ?? '', status: r.status, guardianApprovalStatus: r.guardianApprovalStatus })) });
}

export async function decideGuardianRegistration(req: Request, res: Response): Promise<void> {
  const current = auth(req); const decision = req.body?.decision;
  if (!['approve', 'reject'].includes(decision)) throw badRequest('EVENT_DECISION_INVALID', 'Choose approve or reject.');
  const session = await mongoose.startSession(); let result: Record<string, unknown> | undefined;
  try { await session.withTransaction(async () => {
    const registration = await EventRegistration.findOne({ _id: objectId(req.params.registrationId), guardianId: current.parentId, status: 'pending_guardian' }).session(session);
    if (!registration) throw notFound();
    const family = await Family.findOne({ _id: registration.familyId, guardianId: current.parentId, status: 'active' }).session(session); if (!family) throw notFound();
    if (decision === 'reject') { registration.status = 'declined'; registration.guardianApprovalStatus = 'rejected'; }
    else {
      const { student } = await ownStudent(current.parentId, String(registration.studentId), session);
      const event = await Event.findOne({ _id: registration.eventId, status: 'published', startsAt: { $gt: new Date() } }).session(session);
      if (!event) throw new ApiError(409, 'EVENT_REGISTRATION_CLOSED', 'This event is no longer accepting registrations.');
      if (!(event.ageBands ?? []).includes(student.ageGroup)) throw new ApiError(409, 'EVENT_AGE_INELIGIBLE', 'The selected profile is no longer eligible for this event age group.');
      const reserved = await Event.findOneAndUpdate({ _id: event._id, status: 'published', confirmedCount: { $lt: event.capacity } }, { $inc: { confirmedCount: 1 } }, { new: true, session });
      registration.guardianApprovalStatus = 'approved';
      registration.status = reserved ? 'confirmed' : 'waitlisted';
    }
    registration.guardianReviewedAt = new Date(); if (decision === 'reject') registration.activeKey = undefined; await registration.save({ session });
    await appendAudit({ actorId: current.parentId, familyId: String(registration.familyId), subjectId: String(registration.studentId), eventType: decision === 'approve' ? `event.guardian_approved_${registration.status}` : 'event.guardian_rejected', requestId: current.requestId, details: { eventId: String(registration.eventId), registrationId: String(registration._id), status: registration.status } }, session);
    result = { id: String(registration._id), status: registration.status, guardianApprovalStatus: registration.guardianApprovalStatus };
  }); } finally { await session.endSession(); }
  res.json({ registration: result });
}

async function promoteWaitlist(eventId: mongoose.Types.ObjectId, session: mongoose.ClientSession, requestId: string, actorId: string): Promise<void> {
  for (let i = 0; i < 50; i += 1) {
    const event = await Event.findOne({ _id: eventId, status: 'published' }).session(session); if (!event || event.confirmedCount >= event.capacity) return;
    const candidate = await EventRegistration.findOne({ eventId, status: 'waitlisted', guardianApprovalStatus: 'approved' }).sort({ createdAt: 1 }).session(session); if (!candidate) return;
    const relationship = await GuardianRelationship.findOne({ familyId: candidate.familyId, guardianId: candidate.guardianId, studentId: candidate.studentId, relationshipStatus: 'active', consentStatus: 'granted' }).session(session);
    const student = await StudentProfile.findOne({ _id: candidate.studentId, familyId: candidate.familyId, status: 'active' }).session(session);
    if (!relationship || !student || !(event.ageBands ?? []).includes(student.ageGroup)) { candidate.status = 'cancelled'; candidate.activeKey = undefined; candidate.cancelledAt = new Date(); await candidate.save({ session }); await appendAudit({ actorId, familyId: String(candidate.familyId), subjectId: String(candidate.studentId), eventType: 'event.waitlist_cancelled_ineligible', requestId, details: { eventId: String(eventId), registrationId: String(candidate._id) } }, session); continue; }
    const reserved = await Event.findOneAndUpdate({ _id: eventId, status: 'published', confirmedCount: { $lt: event.capacity } }, { $inc: { confirmedCount: 1 } }, { new: true, session }); if (!reserved) return;
    candidate.status = 'confirmed'; await candidate.save({ session });
    await appendAudit({ actorId, familyId: String(candidate.familyId), subjectId: String(candidate.studentId), eventType: 'event.waitlist_promoted', requestId, details: { eventId: String(eventId), registrationId: String(candidate._id) } }, session);
  }
}

export async function cancelRegistration(req: Request, res: Response): Promise<void> {
  const current = auth(req); const session = await mongoose.startSession(); let result: Record<string, unknown> | undefined;
  try { await session.withTransaction(async () => {
    const registration = await EventRegistration.findOne({ _id: objectId(req.params.registrationId), guardianId: current.parentId, status: { $in: ['pending_guardian', 'confirmed', 'waitlisted'] } }).session(session);
    if (!registration) throw new ApiError(409, 'EVENT_REGISTRATION_NOT_CANCELLABLE', 'This registration can no longer be cancelled.');
    const family = await Family.findOne({ _id: registration.familyId, guardianId: current.parentId, status: 'active' }).session(session); if (!family) throw notFound();
    const event = await Event.findById(registration.eventId).session(session); if (!event) throw notFound();
    const wasConfirmed = registration.status === 'confirmed';
    if (wasConfirmed && event.status === 'published' && event.startsAt <= new Date()) throw new ApiError(409, 'EVENT_CANCELLATION_CLOSED', 'Confirmed registration cancellation is closed because the event has started.');
    registration.status = 'cancelled'; registration.cancelledAt = new Date(); registration.activeKey = undefined; await registration.save({ session });
    if (wasConfirmed) {
      await Event.updateOne({ _id: registration.eventId, confirmedCount: { $gt: 0 } }, { $inc: { confirmedCount: -1 } }, { session });
      await promoteWaitlist(registration.eventId as mongoose.Types.ObjectId, session, current.requestId, current.parentId);
    }
    await appendAudit({ actorId: current.parentId, familyId: String(family._id), subjectId: String(registration.studentId), eventType: 'event.registration_cancelled', requestId: current.requestId, details: { eventId: String(registration.eventId), registrationId: String(registration._id), wasConfirmed } }, session);
    result = { id: String(registration._id), status: registration.status, guardianApprovalStatus: registration.guardianApprovalStatus };
  }); } finally { await session.endSession(); }
  res.json({ registration: result });
}

export async function managedEvents(req: Request, res: Response): Promise<void> {
  const current = auth(req); const clubs = await Club.find({ status: 'approved' }); const allowed: string[] = [];
  for (const club of clubs) if (await canManage(current.parentId, club)) allowed.push(String(club._id));
  const events = await Event.find({ clubId: { $in: allowed } }).sort({ startsAt: -1 }).limit(100); res.json({ events: events.map((event) => eventDto(event)) });
}
export async function managedClubs(req: Request, res: Response): Promise<void> {
  const current = auth(req); const clubs = await Club.find({ status: 'approved' }); const results = [];
  for (const club of clubs) if (await canManage(current.parentId, club)) results.push({ id: String(club._id), name: club.name, ageBands: club.ageBands });
  res.json({ clubs: results });
}

async function authorizedOrganizer(req: Request, res: Response, allowCancelled = false) {
  const current = auth(req); const { event, club } = await eventAndClub(req.params.eventId, allowCancelled);
  if (!(await canManage(current.parentId, club))) throw forbidden();
  return { current, event, club };
}
export async function eventRoster(req: Request, res: Response): Promise<void> {
  const { event } = await authorizedOrganizer(req, res, true);
  const registrations = await EventRegistration.find({ eventId: event._id, status: 'confirmed' }).sort({ createdAt: 1 });
  const relationshipQuery = registrations.map((r) => ({ familyId: r.familyId, guardianId: r.guardianId, studentId: r.studentId, relationshipStatus: 'active', consentStatus: 'granted' }));
  const relationships = relationshipQuery.length ? await GuardianRelationship.find({ $or: relationshipQuery }).select('guardianId studentId') : [];
  const eligibleKeys = new Set(relationships.map((relationship) => `${String(relationship.guardianId)}:${String(relationship.studentId)}`));
  const eligibleRegistrations = registrations.filter((r) => eligibleKeys.has(`${String(r.guardianId)}:${String(r.studentId)}`));
  const students = await StudentProfile.find({ _id: { $in: eligibleRegistrations.map((r) => r.studentId) }, status: 'active' }).select('preferredName ageGroup');
  const activeStudents = new Set(students.map((student) => String(student._id)));
  const safeRegistrations = eligibleRegistrations.filter((registration) => activeStudents.has(String(registration.studentId)));
  const attendance = await EventAttendance.find({ eventId: event._id, registrationId: { $in: safeRegistrations.map((r) => r._id) } }).select('registrationId status');
  const studentMap = new Map(students.map((s) => [String(s._id), s] as const)); const attendanceMap = new Map(attendance.map((a) => [String(a.registrationId), a.status] as const));
  res.json({ roster: safeRegistrations.map((r) => ({ registrationId: String(r._id), studentName: studentMap.get(String(r.studentId))?.preferredName ?? '', ageGroup: studentMap.get(String(r.studentId))?.ageGroup ?? '', attendanceStatus: attendanceMap.get(String(r._id)) ?? null })) });
}
export async function recordAttendance(req: Request, res: Response): Promise<void> {
  const { current, event } = await authorizedOrganizer(req, res, true); const registrationId = objectId(req.params.registrationId); const status = req.body?.status;
  if (!['present', 'absent', 'excused'].includes(status)) throw badRequest('ATTENDANCE_STATUS_INVALID', 'Choose present, absent, or excused.');
  if (event.status !== 'published') throw new ApiError(409, 'ATTENDANCE_EVENT_CANCELLED', 'Attendance cannot be recorded for a cancelled event.');
  if (event.startsAt > new Date()) throw new ApiError(409, 'ATTENDANCE_NOT_OPEN', 'Attendance can be recorded after the event starts.');
  const registration = await EventRegistration.findOne({ _id: registrationId, eventId: event._id, status: 'confirmed' }); if (!registration) throw notFound();
  const relationship = await GuardianRelationship.findOne({ familyId: registration.familyId, guardianId: registration.guardianId, studentId: registration.studentId, relationshipStatus: 'active', consentStatus: 'granted' });
  const student = await StudentProfile.findOne({ _id: registration.studentId, familyId: registration.familyId, status: 'active' });
  if (!relationship || !student) throw forbidden();
  const session = await mongoose.startSession();
  try { await session.withTransaction(async () => {
    const existing = await EventAttendance.findOne({ eventId: event._id, registrationId }).session(session);
    await EventAttendance.findOneAndUpdate({ eventId: event._id, registrationId }, { $set: { studentId: registration.studentId, status, recordedBy: current.parentId, recordedAt: new Date() } }, { upsert: true, new: true, runValidators: true, session });
    await appendAudit({ actorId: current.parentId, familyId: String(registration.familyId), subjectId: String(registration.studentId), eventType: existing ? 'event.attendance_corrected' : 'event.attendance_recorded', requestId: current.requestId, details: { eventId: String(event._id), registrationId: String(registration._id), previousStatus: existing?.status ?? null, status } }, session);
  }); } finally { await session.endSession(); }
  res.json({ registrationId: String(registration._id), attendanceStatus: status });
}

export async function createEventAnnouncement(req: Request, res: Response): Promise<void> {
  const { current, event } = await authorizedOrganizer(req, res); const body = typeof req.body?.body === 'string' ? req.body.body.trim() : '';
  if (!body || body.length > 1600) throw badRequest('EVENT_ANNOUNCEMENT_INVALID', 'Enter an event update up to 1600 characters.');
  const session = await mongoose.startSession(); let announcement: typeof EventAnnouncement.prototype | undefined;
  try { await session.withTransaction(async () => {
    const [created] = await EventAnnouncement.create([{ eventId: event._id, authorId: current.parentId, body, status: 'published' }], { session });
    announcement = created;
    await appendAudit({ actorId: current.parentId, subjectId: String(event._id), eventType: 'event.announcement_published', requestId: current.requestId, details: { announcementId: String(created._id) } }, session);
  }); } finally { await session.endSession(); }
  if (!announcement) throw new ApiError(500, 'EVENT_ANNOUNCEMENT_FAILED', 'The event update could not be saved.');
  const author = await ParentAccount.findById(current.parentId).select('name');
  res.status(201).json({ announcement: { id: String(announcement._id), body: announcement.body, createdAt: announcement.createdAt, authorName: author?.name ?? '' } });
}
export async function eventAnnouncements(req: Request, res: Response): Promise<void> {
  const current = auth(req); const { event, club } = await eventAndClub(req.params.eventId, true);
  const leader = await canManage(current.parentId, club); const query: Record<string, unknown> = { eventId: event._id, guardianId: current.parentId, status: { $in: ['pending_guardian', 'confirmed', 'waitlisted'] } };
  if (req.query.studentProfileId) { const { student } = await ownStudent(current.parentId, req.query.studentProfileId); query.studentId = student._id; }
  const registration = leader ? true : await EventRegistration.exists(query); if (!registration) throw forbidden();
  const announcements = await EventAnnouncement.find({ eventId: event._id, status: 'published' }).sort({ createdAt: -1 }).limit(50);
  const authors = await ParentAccount.find({ _id: { $in: announcements.map((a) => a.authorId) }, accountStatus: 'active' }).select('name');
  const authorNames = new Map(authors.map((author) => [String(author._id), author.name] as const));
  res.json({ announcements: announcements.map((a) => ({ id: String(a._id), body: a.body, createdAt: a.createdAt, authorName: authorNames.get(String(a.authorId)) ?? '' })) });
}
export async function removeEventAnnouncement(req: Request, res: Response): Promise<void> {
  const current = auth(req); const session = await mongoose.startSession(); let announcement: typeof EventAnnouncement.prototype | null = null;
  try { await session.withTransaction(async () => {
    announcement = await EventAnnouncement.findOneAndUpdate({ _id: objectId(req.params.announcementId), status: 'published' }, { $set: { status: 'removed', removedBy: current.parentId, removedAt: new Date() } }, { new: true, session });
    if (!announcement) throw notFound();
    await appendAudit({ actorId: current.parentId, subjectId: String(announcement.eventId), eventType: 'event.announcement_removed', requestId: current.requestId, details: { announcementId: String(announcement._id) } }, session);
  }); } finally { await session.endSession(); }
  res.status(204).end();
}

export async function eventAudit(req: Request, res: Response): Promise<void> {
  const events = await AuditEvent.find({ eventType: /^event\./ }).sort({ occurredAt: -1 }).limit(100).select('eventType occurredAt details');
  res.json({ events: events.map((event) => ({ eventType: event.eventType, occurredAt: event.occurredAt, details: event.details })) });
}
