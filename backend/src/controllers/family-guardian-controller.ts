import { createHmac, randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import type { Request, Response } from 'express';
import { ApiError, badRequest, forbidden, notFound, unauthorized } from '../errors';
import { Family, FamilyAccessDispute, FamilyGuardian, FamilyInvitation, GuardianRelationship, ParentAccount, StudentProfile } from '../models';
import { appendAudit } from '../services/audit';
import { normalizeContact } from '../services/auth';
import { env } from '../config/env';

const invitationTtlMs = 48 * 60 * 60 * 1000;
const tokenHash = (value: string) => createHmac('sha256', env.jwtSecret).update(value).digest('hex');

function auth(req: Request) {
  if (!req.nteAuth) throw unauthorized();
  return req.nteAuth;
}

async function ownerFamily(parentId: string) {
  const family = await Family.findOne({ guardianId: parentId, status: 'active' });
  if (!family) throw notFound();
  return family;
}

export async function createInvitation(req: Request, res: Response): Promise<void> {
  const current = auth(req);
  const invitee = normalizeContact(req.body?.contact);
  const inviter = await ParentAccount.findById(current.parentId).select('contact');
  if (!inviter) throw unauthorized();
  if (invitee.value === inviter.contact) throw badRequest('SELF_INVITATION', 'You cannot invite your own account.');
  const family = await ownerFamily(current.parentId);
  const target = await ParentAccount.findOne({ contact: invitee.value, verificationStatus: 'verified', accountStatus: 'active' }).select('_id');
  if (target && await FamilyGuardian.exists({ familyId: family._id, guardianId: target._id, status: 'active' })) {
    throw new ApiError(409, 'GUARDIAN_ALREADY_CONNECTED', 'This account is already connected to the family.');
  }
  const pending = await FamilyInvitation.findOne({ familyId: family._id, inviteeContact: invitee.value, status: 'pending', expiresAt: { $gt: new Date() } });
  if (pending) throw new ApiError(409, 'INVITATION_ALREADY_PENDING', 'An invitation for this contact is already pending.');

  const secret = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + invitationTtlMs);
  const invitation = await FamilyInvitation.create({
    familyId: family._id, inviterId: current.parentId, inviteeContact: invitee.value,
    contactType: invitee.type, tokenHash: tokenHash(secret), status: 'pending', expiresAt,
  });
  await appendAudit({ actorId: current.parentId, familyId: String(family._id), eventType: 'family.guardian_invitation_created', requestId: current.requestId, details: { invitationId: String(invitation._id), contactType: invitee.type } });
  // The secret is returned once for the inviter to share out of band. Acceptance
  // still requires a verified signed-in account with the exact invited contact.
  res.status(201).json({ invitation: { id: String(invitation._id), status: invitation.status, expiresAt }, invitationToken: secret });
}

export async function listInvitations(req: Request, res: Response): Promise<void> {
  const current = auth(req);
  const account = await ParentAccount.findById(current.parentId).select('contact');
  if (!account) throw unauthorized();
  const family = await Family.findOne({ guardianId: current.parentId, status: 'active' });
  const [incoming, outgoing] = await Promise.all([
    FamilyInvitation.find({ inviteeContact: account.contact, status: 'pending', expiresAt: { $gt: new Date() } }).sort({ createdAt: -1 }).limit(50).select('familyId inviterId contactType expiresAt createdAt'),
    family ? FamilyInvitation.find({ familyId: family._id, inviterId: current.parentId, status: { $in: ['pending', 'accepted', 'rejected', 'revoked', 'expired'] } }).sort({ createdAt: -1 }).limit(50).select('inviteeContact contactType status expiresAt createdAt respondedAt') : Promise.resolve([]),
  ]);
  const inviterIds = [...new Set(incoming.map((item) => String(item.inviterId)))];
  const inviters = await ParentAccount.find({ _id: { $in: inviterIds }, accountStatus: 'active' }).select('name membershipCategory');
  const inviterById = new Map(inviters.map((item) => [String(item._id), item] as const));
  res.json({
    incoming: incoming.map((item) => ({ id: String(item._id), inviterName: inviterById.get(String(item.inviterId))?.name ?? '', expiresAt: item.expiresAt, createdAt: item.createdAt })),
    outgoing: outgoing.map((item) => ({ id: String(item._id), inviteeContact: item.inviteeContact, contactType: item.contactType, status: item.status === 'pending' && item.expiresAt <= new Date() ? 'expired' : item.status, expiresAt: item.expiresAt, createdAt: item.createdAt, respondedAt: item.respondedAt ?? null })),
  });
}

export async function respondToInvitation(req: Request, res: Response): Promise<void> {
  const current = auth(req);
  const decision = req.body?.decision;
  const secret = req.body?.invitationToken;
  if (!['accept', 'reject'].includes(decision) || typeof secret !== 'string' || secret.length < 40 || secret.length > 100) {
    throw badRequest('INVITATION_RESPONSE_INVALID', 'Provide an invitation token and accept or reject decision.');
  }
  if (!mongoose.isValidObjectId(req.params.invitationId)) throw notFound();
  const account = await ParentAccount.findById(current.parentId).select('contact verificationStatus accountStatus membershipCategory');
  if (!account || account.verificationStatus !== 'verified' || account.accountStatus !== 'active') throw forbidden();
  const invitation = await FamilyInvitation.findOne({
    _id: req.params.invitationId, inviteeContact: account.contact, tokenHash: tokenHash(secret), status: 'pending', expiresAt: { $gt: new Date() },
  }).select('+tokenHash');
  if (!invitation) throw notFound();
  const family = await Family.findOne({ _id: invitation.familyId, status: 'active' });
  if (!family || String(family.guardianId) === current.parentId) throw notFound();

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const now = new Date();
      const updated = await FamilyInvitation.updateOne({ _id: invitation._id, status: 'pending', expiresAt: { $gt: now } }, {
        $set: { status: decision === 'accept' ? 'accepted' : 'rejected', respondedAt: now, ...(decision === 'accept' ? { acceptedBy: current.parentId } : {}) },
      }, { session });
      if (updated.modifiedCount !== 1) throw new ApiError(409, 'INVITATION_ALREADY_HANDLED', 'This invitation has already been handled.');
      if (decision === 'accept') {
        const activeOtherLinks = await FamilyGuardian.find({ guardianId: current.parentId, status: { $in: ['active', 'disputed'] }, familyId: { $ne: family._id } }).session(session).select('_id');
        if (activeOtherLinks.length) throw new ApiError(409, 'FAMILY_CONNECTION_CONFLICT', 'This account is already connected to another family. Contact NTE Naadu support before changing family access.');
        const existingOwnedFamily = await Family.findOne({ guardianId: current.parentId, status: 'active' }).session(session);
        if (existingOwnedFamily && String(existingOwnedFamily._id) !== String(family._id)) {
          const existingStudentCount = await StudentProfile.countDocuments({ familyId: existingOwnedFamily._id }).session(session);
          if (existingStudentCount > 0) throw new ApiError(409, 'FAMILY_DATA_CONFLICT', 'This account already manages student profiles. NTE Naadu support must review the family connection before it can be accepted.');
          existingOwnedFamily.status = 'closed'; existingOwnedFamily.closedReason = 'connected_family';
          await existingOwnedFamily.save({ session });
          await appendAudit({ actorId: current.parentId, familyId: String(existingOwnedFamily._id), eventType: 'family.empty_account_family_closed_for_connection', requestId: current.requestId, details: { invitationId: String(invitation._id) } }, session);
        }
        const existingLink = await FamilyGuardian.findOne({ familyId: family._id, guardianId: current.parentId }).session(session);
        if (existingLink?.status === 'active' || existingLink?.status === 'disputed') throw new ApiError(409, 'FAMILY_LINK_EXISTS', 'This account already has a family connection.');
        if (existingLink) {
          existingLink.status = 'active'; existingLink.permissions = ['view_students']; existingLink.acceptedAt = now; existingLink.revokedAt = undefined;
          await existingLink.save({ session });
        } else {
          await FamilyGuardian.create([{ familyId: family._id, guardianId: current.parentId, invitedBy: invitation.inviterId, status: 'active', permissions: ['view_students'], acceptedAt: now }], { session });
        }
        const students = await StudentProfile.find({ familyId: family._id, status: { $ne: 'archived' } }).session(session).select('_id');
        for (const student of students) {
          const relationshipInOtherFamily = await GuardianRelationship.exists({ guardianId: current.parentId, studentId: student._id, familyId: { $ne: family._id } }).session(session);
          if (relationshipInOtherFamily) throw new ApiError(409, 'FAMILY_RELATIONSHIP_CONFLICT', 'An existing family relationship requires manual review before this invitation can be accepted.');
          const existing = await GuardianRelationship.findOne({ familyId: family._id, guardianId: current.parentId, studentId: student._id }).session(session);
          if (existing) {
            existing.relationshipType = 'guardian';
            existing.relationshipStatus = existing.consentStatus === 'granted' && Boolean(existing.consentPolicyId && existing.consentPolicyVersion && existing.consentLanguageCode)
              ? 'active' : 'pending_consent';
            await existing.save({ session });
          } else {
            await GuardianRelationship.create([{ familyId: family._id, guardianId: current.parentId, studentId: student._id, relationshipType: 'guardian', relationshipStatus: 'pending_consent', consentStatus: 'not_recorded' }], { session });
          }
        }
      }
      await appendAudit({ actorId: current.parentId, familyId: String(family._id), eventType: decision === 'accept' ? 'family.guardian_invitation_accepted' : 'family.guardian_invitation_rejected', requestId: current.requestId, details: { invitationId: String(invitation._id), permissions: decision === 'accept' ? 'view_students' : null } }, session);
    });
  } finally { await session.endSession(); }
  res.json({ status: decision === 'accept' ? 'accepted_read_only' : 'rejected' });
}

export async function revokeGuardian(req: Request, res: Response): Promise<void> {
  const current = auth(req);
  if (!mongoose.isValidObjectId(req.params.guardianId)) throw notFound();
  let family = await Family.findOne({ guardianId: current.parentId, status: 'active' });
  const isOwner = Boolean(family);
  if (!family) {
    if (req.params.guardianId !== current.parentId) throw forbidden();
    const selfLink = await FamilyGuardian.findOne({ guardianId: current.parentId, status: 'active' });
    if (selfLink) family = await Family.findOne({ _id: selfLink.familyId, status: 'active' });
  }
  if (!family) throw notFound();
  const member = await FamilyGuardian.findOne({ familyId: family._id, guardianId: req.params.guardianId, status: 'active' });
  if (!member) throw notFound();
  if (!isOwner && String(member.guardianId) !== current.parentId) throw forbidden();
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      member.status = 'revoked'; member.revokedAt = new Date(); member.permissions = [];
      await member.save({ session });
      await GuardianRelationship.updateMany({ familyId: family._id, guardianId: member.guardianId, relationshipStatus: { $ne: 'archived' } }, { $set: { relationshipStatus: 'revoked' } }, { session });
      const dormantFamily = await Family.findOne({ guardianId: member.guardianId, status: 'closed', closedReason: 'connected_family' }).session(session);
      if (dormantFamily && await StudentProfile.countDocuments({ familyId: dormantFamily._id }).session(session) === 0) {
        dormantFamily.status = 'active'; dormantFamily.closedReason = undefined;
        await dormantFamily.save({ session });
        await appendAudit({ actorId: current.parentId, familyId: String(dormantFamily._id), eventType: 'family.account_family_reopened_after_disconnection', requestId: current.requestId }, session);
      }
      await appendAudit({ actorId: current.parentId, familyId: String(family._id), eventType: 'family.guardian_access_revoked', requestId: current.requestId, details: { guardianId: String(member.guardianId) } }, session);
    });
  } finally { await session.endSession(); }
  res.status(204).end();
}

export async function cancelInvitation(req: Request, res: Response): Promise<void> {
  const current = auth(req);
  const family = await ownerFamily(current.parentId);
  if (!mongoose.isValidObjectId(req.params.invitationId)) throw notFound();
  const invitation = await FamilyInvitation.findOneAndUpdate(
    { _id: req.params.invitationId, familyId: family._id, inviterId: current.parentId, status: 'pending' },
    { $set: { status: 'revoked', respondedAt: new Date() } }, { new: true },
  );
  if (!invitation) throw notFound();
  await appendAudit({ actorId: current.parentId, familyId: String(family._id), eventType: 'family.guardian_invitation_cancelled', requestId: current.requestId, details: { invitationId: String(invitation._id) } });
  res.status(204).end();
}

export async function reportAccessDispute(req: Request, res: Response): Promise<void> {
  const current = auth(req);
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
  if (reason.length < 10 || reason.length > 2000) throw badRequest('DISPUTE_REASON_INVALID', 'Describe the family access concern in 10 to 2000 characters.');
  if (!mongoose.isValidObjectId(req.params.guardianId)) throw notFound();
  const owned = await Family.findOne({ guardianId: current.parentId, status: 'active' });
  let family = owned;
  let subjectGuardianId = req.params.guardianId;
  let affectedGuardianId = req.params.guardianId;
  if (owned) {
    if (String(req.params.guardianId) === current.parentId) throw badRequest('DISPUTE_SUBJECT_INVALID', 'Select a connected guardian to report.');
    if (!await FamilyGuardian.exists({ familyId: owned._id, guardianId: req.params.guardianId, status: 'active' })) throw notFound();
  } else {
    if (req.params.guardianId !== current.parentId) throw forbidden();
    const link = await FamilyGuardian.findOne({ guardianId: current.parentId, status: 'active' });
    family = link ? await Family.findOne({ _id: link.familyId, status: 'active' }) : null;
    if (!family) throw notFound();
    subjectGuardianId = String(family.guardianId);
    affectedGuardianId = current.parentId;
  }

  const session = await mongoose.startSession();
  let disputeId = '';
  try {
    await session.withTransaction(async () => {
      const member = await FamilyGuardian.findOne({ familyId: family!._id, guardianId: affectedGuardianId, status: 'active' }).session(session);
      if (!member) throw notFound();
      member.status = 'disputed'; member.permissions = [];
      await member.save({ session });
      await GuardianRelationship.updateMany({ familyId: family!._id, guardianId: affectedGuardianId, relationshipStatus: { $ne: 'archived' } }, { $set: { relationshipStatus: 'revoked' } }, { session });
      const [dispute] = await FamilyAccessDispute.create([{
        familyId: family!._id, reporterId: current.parentId, subjectGuardianId, affectedGuardianId, reason, status: 'open',
      }], { session });
      disputeId = String(dispute._id);
      await appendAudit({ actorId: current.parentId, familyId: String(family!._id), eventType: 'family.access_dispute_submitted', requestId: current.requestId, details: { disputeId, affectedGuardianId } }, session);
    });
  } finally { await session.endSession(); }
  res.status(202).json({ disputeId, status: 'open', accessRestricted: true });
}

export async function staffAccessDisputes(req: Request, res: Response): Promise<void> {
  const current = auth(req);
  const cases = await FamilyAccessDispute.find({ status: 'open' }).sort({ createdAt: 1 }).limit(100).select('+reason');
  await appendAudit({ actorId: current.parentId, eventType: 'admin.family_access_dispute_queue_viewed', requestId: current.requestId, details: { resultCount: cases.length } });
  res.json({ disputes: cases.map((item) => ({
    id: String(item._id), familyId: String(item.familyId), reporterId: String(item.reporterId),
    subjectGuardianId: String(item.subjectGuardianId), affectedGuardianId: String(item.affectedGuardianId),
    reason: item.reason, createdAt: item.createdAt,
  })) });
}

export async function resolveAccessDispute(req: Request, res: Response): Promise<void> {
  const current = auth(req);
  const resolution = req.body?.resolution;
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
  if (!['maintain_restriction', 'restore_connection'].includes(resolution) || reason.length < 10 || reason.length > 2000) {
    throw badRequest('DISPUTE_RESOLUTION_INVALID', 'Choose an outcome and provide a reason of 10 to 2000 characters.');
  }
  if (!mongoose.isValidObjectId(req.params.disputeId)) throw notFound();
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const dispute = await FamilyAccessDispute.findOne({ _id: req.params.disputeId, status: 'open' }).session(session);
      if (!dispute) throw notFound();
      if (resolution === 'restore_connection') {
        const member = await FamilyGuardian.findOne({ familyId: dispute.familyId, guardianId: dispute.affectedGuardianId, status: 'disputed' }).session(session);
        if (!member) throw new ApiError(409, 'FAMILY_CONNECTION_UNAVAILABLE', 'This connection cannot be restored automatically. Support review is required.');
        member.status = 'active'; member.permissions = ['view_students'];
        await member.save({ session });
        const relations = await GuardianRelationship.find({ familyId: dispute.familyId, guardianId: dispute.affectedGuardianId, relationshipStatus: 'revoked' }).session(session);
        for (const relation of relations) {
          relation.relationshipStatus = relation.consentStatus === 'granted' && Boolean(relation.consentPolicyId && relation.consentPolicyVersion && relation.consentLanguageCode)
            ? 'active' : 'pending_consent';
          await relation.save({ session });
        }
      } else {
        const disputedLink = await FamilyGuardian.findOne({ familyId: dispute.familyId, guardianId: dispute.affectedGuardianId, status: 'disputed' }).session(session);
        if (disputedLink) { disputedLink.status = 'revoked'; disputedLink.permissions = []; disputedLink.revokedAt = new Date(); await disputedLink.save({ session }); }
        const dormantFamily = await Family.findOne({ guardianId: dispute.affectedGuardianId, status: 'closed', closedReason: 'connected_family' }).session(session);
        if (dormantFamily && await StudentProfile.countDocuments({ familyId: dormantFamily._id }).session(session) === 0) {
          dormantFamily.status = 'active'; dormantFamily.closedReason = undefined;
          await dormantFamily.save({ session });
          await appendAudit({ actorId: current.parentId, familyId: String(dormantFamily._id), eventType: 'family.account_family_reopened_after_dispute_restriction', requestId: current.requestId }, session);
        }
      }
      dispute.status = 'resolved'; dispute.resolution = resolution; dispute.resolutionReason = reason;
      dispute.resolvedBy = current.parentId; dispute.resolvedAt = new Date();
      await dispute.save({ session });
      await appendAudit({ actorId: current.parentId, familyId: String(dispute.familyId), eventType: `admin.family_access_dispute_${resolution}`, requestId: current.requestId, details: { disputeId: String(dispute._id), affectedGuardianId: String(dispute.affectedGuardianId) } }, session);
    });
  } finally { await session.endSession(); }
  res.status(204).end();
}

export async function listGuardians(req: Request, res: Response): Promise<void> {
  const current = auth(req);
  let family = await Family.findOne({ guardianId: current.parentId, status: 'active' });
  const isOwner = Boolean(family);
  if (!family) {
    const member = await FamilyGuardian.findOne({ guardianId: current.parentId, status: 'active' });
    if (member) family = await Family.findOne({ _id: member.familyId, status: 'active' });
  }
  if (!family) throw notFound();
  const [owner, links] = await Promise.all([
    isOwner ? ParentAccount.findById(family.guardianId).select('name membershipCategory') : Promise.resolve(null),
    FamilyGuardian.find({ familyId: family._id, status: 'active', ...(isOwner ? {} : { guardianId: current.parentId }) }).select('guardianId permissions acceptedAt'),
  ]);
  const accounts = await ParentAccount.find({ _id: { $in: links.map((item) => item.guardianId) }, accountStatus: 'active' }).select('name membershipCategory');
  res.json({ guardians: [
    ...(owner ? [{ id: String(owner._id), name: owner.name, membershipCategory: owner.membershipCategory ?? 'guardian', permissions: ['manage_family'], isOwner: true }] : []),
    ...links.flatMap((link) => { const account = accounts.find((item) => String(item._id) === String(link.guardianId)); return account ? [{ id: String(link.guardianId), name: account.name, membershipCategory: account.membershipCategory ?? 'guardian', permissions: link.permissions, acceptedAt: link.acceptedAt, isOwner: false }] : []; }),
  ] });
}
