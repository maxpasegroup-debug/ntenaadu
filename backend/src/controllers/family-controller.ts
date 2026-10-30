import mongoose from 'mongoose';
import type { Request, Response } from 'express';
import { ApiError, badRequest, notFound, unauthorized, unavailable } from '../errors';
import { AuditEvent, ConsentEvent, ConsentPolicy, Family, GuardianRelationship, StudentProfile } from '../models';
import { appendAudit } from '../services/audit';
import { DatabaseConsentPolicyProvider } from '../services/consent-policy';
import type { AgeGroup, LanguageCode } from '../types';

const policyProvider = new DatabaseConsentPolicyProvider();
const allowedLanguages = new Set(['en', 'hi', 'ml', 'ta']);
const allowedAgeGroups = new Set(['child', 'youth']);
const policyUnavailable = () => unavailable('CONSENT_POLICY_UNAVAILABLE', 'No approved consent policy is available in this language. No consent was recorded.');

function auth(req: Request) {
  if (!req.nteAuth) throw unauthorized();
  return req.nteAuth;
}

function studentDto(student: typeof StudentProfile.prototype, relationship: typeof GuardianRelationship.prototype) {
  return {
    id: String(student._id),
    relationshipId: String(relationship._id),
    preferredName: student.preferredName,
    ageGroup: student.ageGroup,
    preferredLanguage: student.preferredLanguage,
    profileStatus: student.status,
    relationshipStatus: relationship.relationshipStatus,
    consentStatus: relationship.consentStatus,
    consentPolicyId: relationship.consentPolicyId ?? null,
    consentPolicyVersion: relationship.consentPolicyVersion ?? null,
    consentRecordedAt: relationship.consentRecordedAt ?? null,
    consentRevokedAt: relationship.consentRevokedAt ?? null,
  };
}

async function ownedFamily(parentId: string, session?: mongoose.ClientSession) {
  let query = Family.findOne({ guardianId: parentId, status: 'active' });
  if (session) query = query.session(session);
  const family = await query;
  if (!family) throw notFound();
  return family;
}

export async function listStudents(req: Request, res: Response): Promise<void> {
  const current = auth(req);
  const family = await ownedFamily(current.parentId);
  const students = await StudentProfile.find({ familyId: family._id, status: { $ne: 'archived' } }).sort({ createdAt: 1 });
  const relationships = await GuardianRelationship.find({ familyId: family._id, guardianId: current.parentId });
  const byStudent = new Map(relationships.map((relationship) => [String(relationship.studentId), relationship] as const));
  res.json({ familyId: String(family._id), students: students.flatMap((student) => {
    const relationship = byStudent.get(String(student._id));
    return relationship ? [studentDto(student, relationship)] : [];
  }) });
}

export async function createStudent(req: Request, res: Response): Promise<void> {
  const current = auth(req);
  const preferredName = typeof req.body?.preferredName === 'string' ? req.body.preferredName.trim() : '';
  const ageGroup = req.body?.ageGroup;
  const preferredLanguage = req.body?.preferredLanguage;
  if (!preferredName || preferredName.length > 80) throw badRequest('STUDENT_NAME_INVALID', 'Enter a preferred name up to 80 characters.');
  if (!allowedAgeGroups.has(ageGroup)) throw badRequest('AGE_GROUP_INVALID', 'Select a supported broad age group.');
  if (!allowedLanguages.has(preferredLanguage)) throw badRequest('LANGUAGE_INVALID', 'Select an available language.');

  const session = await mongoose.startSession();
  let output: Record<string, unknown> | undefined;
  try {
    await session.withTransaction(async () => {
      const family = await ownedFamily(current.parentId, session);
      const [student] = await StudentProfile.create([{
        familyId: family._id,
        preferredName,
        ageGroup: ageGroup as AgeGroup,
        preferredLanguage: preferredLanguage as LanguageCode,
        status: 'pending_consent',
      }], { session });
      const [relationship] = await GuardianRelationship.create([{
        familyId: family._id,
        guardianId: current.parentId,
        studentId: student._id,
        relationshipType: 'guardian',
        relationshipStatus: 'pending_consent',
        consentStatus: 'not_recorded',
      }], { session });
      await appendAudit({
        actorId: current.parentId,
        familyId: String(family._id),
        subjectId: String(student._id),
        eventType: 'family.student_profile_created',
        requestId: current.requestId,
        details: { ageGroup, preferredLanguage },
      }, session);
      output = studentDto(student, relationship);
    });
  } finally { await session.endSession(); }
  res.status(201).json({ student: output });
}

export async function updateStudent(req: Request, res: Response): Promise<void> {
  const current = auth(req);
  const family = await ownedFamily(current.parentId);
  const update: Record<string, unknown> = {};
  if (req.body?.preferredName !== undefined) {
    if (typeof req.body.preferredName !== 'string' || !req.body.preferredName.trim() || req.body.preferredName.trim().length > 80) {
      throw badRequest('STUDENT_NAME_INVALID', 'Enter a preferred name up to 80 characters.');
    }
    update.preferredName = req.body.preferredName.trim();
  }
  if (req.body?.ageGroup !== undefined) {
    if (!allowedAgeGroups.has(req.body.ageGroup)) throw badRequest('AGE_GROUP_INVALID', 'Select a supported broad age group.');
    update.ageGroup = req.body.ageGroup;
  }
  if (req.body?.preferredLanguage !== undefined) {
    if (!allowedLanguages.has(req.body.preferredLanguage)) throw badRequest('LANGUAGE_INVALID', 'Select an available language.');
    update.preferredLanguage = req.body.preferredLanguage;
  }
  if (Object.keys(update).length === 0) throw badRequest('NO_CHANGES', 'Provide at least one profile field to update.');
  const session = await mongoose.startSession();
  let output: Record<string, unknown> | undefined;
  try {
    await session.withTransaction(async () => {
      const student = await StudentProfile.findOneAndUpdate(
        { _id: req.params.studentId, familyId: family._id, status: { $ne: 'archived' } },
        { $set: update }, { new: true, runValidators: true, session },
      );
      if (!student) throw notFound();
      const relationship = await GuardianRelationship.findOne({ studentId: student._id, familyId: family._id, guardianId: current.parentId }).session(session);
      if (!relationship) throw notFound();
      await appendAudit({
        actorId: current.parentId, familyId: String(family._id), subjectId: String(student._id),
        eventType: 'family.student_profile_updated', requestId: current.requestId,
        details: { fields: Object.keys(update).join(',') },
      }, session);
      output = studentDto(student, relationship);
    });
  } finally { await session.endSession(); }
  res.json({ student: output });
}

export async function archiveStudent(req: Request, res: Response): Promise<void> {
  const current = auth(req);
  const family = await ownedFamily(current.parentId);
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const student = await StudentProfile.findOneAndUpdate(
        { _id: req.params.studentId, familyId: family._id, status: { $ne: 'archived' } },
        { $set: { status: 'archived' } }, { new: true, session },
      );
      if (!student) throw notFound();
      await GuardianRelationship.updateOne(
        { studentId: student._id, familyId: family._id, guardianId: current.parentId },
        { $set: { relationshipStatus: 'archived' } }, { session },
      );
      await appendAudit({ actorId: current.parentId, familyId: String(family._id), subjectId: String(student._id),
        eventType: 'family.student_profile_archived', requestId: current.requestId }, session);
    });
  } finally { await session.endSession(); }
  res.status(204).end();
}

export async function getConsentPolicy(req: Request, res: Response): Promise<void> {
  auth(req);
  const language = typeof req.query.language === 'string' ? req.query.language : '';
  if (!allowedLanguages.has(language)) throw badRequest('LANGUAGE_INVALID', 'Select an available language.');
  const policy = await policyProvider.getPublished(language);
  if (!policy) throw policyUnavailable();
  res.json({ policy });
}

async function ownedRelationship(parentId: string, relationshipId: string) {
  if (!mongoose.isValidObjectId(relationshipId)) throw notFound();
  const relationship = await GuardianRelationship.findOne({ _id: relationshipId, guardianId: parentId });
  if (!relationship) throw notFound();
  return relationship;
}

export async function grantConsent(req: Request, res: Response): Promise<void> {
  const current = auth(req);
  if (req.body?.confirm !== true) throw badRequest('EXPLICIT_CONFIRMATION_REQUIRED', 'Explicitly confirm after reviewing the policy.');
  const policyId = typeof req.body?.policyId === 'string' ? req.body.policyId : '';
  const policyVersion = typeof req.body?.policyVersion === 'string' ? req.body.policyVersion : '';
  const languageCode = typeof req.body?.languageCode === 'string' ? req.body.languageCode : '';
  if (!policyId || !policyVersion || !allowedLanguages.has(languageCode)) throw badRequest('POLICY_REFERENCE_REQUIRED', 'A published policy ID, version, and language are required.');
  const policy = await ConsentPolicy.findOne({
    policyId, version: policyVersion, languageCode, reviewStatus: 'published', effectiveAt: { $lte: new Date() },
    $or: [{ retiredAt: { $exists: false } }, { retiredAt: null }, { retiredAt: { $gt: new Date() } }],
  });
  if (!policy) throw policyUnavailable();
  const relationship = await ownedRelationship(current.parentId, req.params.relationshipId);
  const family = await ownedFamily(current.parentId);
  if (String(relationship.familyId) !== String(family._id) || relationship.relationshipStatus === 'archived') throw notFound();
  const now = new Date();
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const relationshipUpdate = await GuardianRelationship.updateOne({ _id: relationship._id, guardianId: current.parentId, relationshipStatus: { $ne: 'archived' } }, { $set: {
        relationshipStatus: 'active', consentStatus: 'granted', consentPolicyId, consentPolicyVersion: policyVersion,
        consentLanguageCode: languageCode, consentRecordedAt: now, consentRevokedAt: null,
      } }, { session });
      if (relationshipUpdate.matchedCount !== 1) throw notFound();
      const studentUpdate = await StudentProfile.updateOne({ _id: relationship.studentId, familyId: family._id, status: { $ne: 'archived' } }, { $set: { status: 'active' } }, { session });
      if (studentUpdate.matchedCount !== 1) throw notFound();
      await ConsentEvent.create([{
        relationshipId: relationship._id, familyId: family._id, actorId: current.parentId, action: 'granted',
        policyId, policyVersion, languageCode, occurredAt: now, requestId: current.requestId,
      }], { session });
      await appendAudit({ actorId: current.parentId, familyId: String(family._id), subjectId: String(relationship.studentId),
        eventType: 'family.guardian_consent_granted', requestId: current.requestId,
        details: { policyId, policyVersion, languageCode } }, session);
    });
  } finally { await session.endSession(); }
  res.json({ status: 'granted', policyId, policyVersion, recordedAt: now });
}

export async function revokeConsent(req: Request, res: Response): Promise<void> {
  const current = auth(req);
  if (req.body?.confirm !== true) throw badRequest('EXPLICIT_CONFIRMATION_REQUIRED', 'Explicitly confirm consent revocation.');
  const relationship = await ownedRelationship(current.parentId, req.params.relationshipId);
  if (relationship.consentStatus !== 'granted' || !relationship.consentPolicyId || !relationship.consentPolicyVersion || !relationship.consentLanguageCode) {
    throw new ApiError(409, 'CONSENT_NOT_GRANTED', 'There is no recorded consent to revoke.');
  }
  const family = await ownedFamily(current.parentId);
  const now = new Date();
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const relationshipUpdate = await GuardianRelationship.updateOne({ _id: relationship._id, guardianId: current.parentId, consentStatus: 'granted' }, { $set: {
        relationshipStatus: 'revoked', consentStatus: 'revoked', consentRevokedAt: now,
      } }, { session });
      if (relationshipUpdate.matchedCount !== 1) throw new ApiError(409, 'CONSENT_NOT_GRANTED', 'There is no current consent to revoke.');
      const studentUpdate = await StudentProfile.updateOne({ _id: relationship.studentId, familyId: family._id, status: { $ne: 'archived' } }, { $set: { status: 'pending_consent' } }, { session });
      if (studentUpdate.matchedCount !== 1) throw notFound();
      await ConsentEvent.create([{
        relationshipId: relationship._id, familyId: family._id, actorId: current.parentId, action: 'revoked',
        policyId: relationship.consentPolicyId, policyVersion: relationship.consentPolicyVersion,
        languageCode: relationship.consentLanguageCode, occurredAt: now, requestId: current.requestId,
      }], { session });
      await appendAudit({ actorId: current.parentId, familyId: String(family._id), subjectId: String(relationship.studentId),
        eventType: 'family.guardian_consent_revoked', requestId: current.requestId,
        details: { policyId: relationship.consentPolicyId, policyVersion: relationship.consentPolicyVersion } }, session);
    });
  } finally { await session.endSession(); }
  res.json({ status: 'revoked', revokedAt: now });
}

export async function listFamilyAudit(req: Request, res: Response): Promise<void> {
  const current = auth(req);
  const family = await ownedFamily(current.parentId);
  const events = await AuditEvent.find({ familyId: family._id })
    .sort({ occurredAt: -1 }).limit(100).select('eventType subjectId occurredAt details');
  res.json({ events: events.map((event) => ({
    eventType: event.eventType,
    subjectId: event.subjectId ? String(event.subjectId) : null,
    occurredAt: event.occurredAt,
    details: event.details,
  })) });
}

