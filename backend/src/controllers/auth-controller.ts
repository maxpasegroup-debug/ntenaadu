import { randomInt, createHmac } from 'node:crypto';
import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { env } from '../config/env';
import { ApiError, unavailable, unauthorized } from '../errors';
import { AuthSession, Family, IdentityChallenge, ParentAccount } from '../models';
import { appendAudit } from '../services/audit';
import { authenticateParent as verifyCredentials, createSession, hashPassword, normalizeContact, rotateSession, revokeSession } from '../services/auth';
import { DisabledAccountRecoveryProvider, DisabledContactVerificationProvider } from '../services/providers';
import type { LanguageCode } from '../types';

const verifier = new DisabledContactVerificationProvider();
const recoveryProvider = new DisabledAccountRecoveryProvider();
const challengeExpiryMs = 10 * 60 * 1000;
const maxChallengeAttempts = 5;
const verificationUnavailable = () => unavailable('VERIFICATION_UNAVAILABLE', 'Account verification is not configured. No account was created.');
const recoveryUnavailable = () => unavailable('RECOVERY_UNAVAILABLE', 'Account recovery is not configured. No recovery request was sent.');

function challengeHash(contact: string, purpose: string, code: string): string {
  return createHmac('sha256', env.jwtSecret).update(`${contact}:${purpose}:${code}`).digest('hex');
}

function generateCode(): string { return randomInt(0, 1_000_000).toString().padStart(6, '0'); }

function parentPublicRecord(parent: typeof ParentAccount.prototype) {
  return {
    id: String(parent._id),
    name: parent.name,
    contact: parent.contact,
    contactType: parent.contactType,
    preferredLanguage: parent.preferredLanguage,
  };
}

export async function registerParent(req: Request, res: Response): Promise<void> {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const rawContact = req.body?.contact;
  const password = req.body?.password;
  const preferredLanguage = req.body?.preferredLanguage;
  if (!name || name.length > 120) throw new ApiError(400, 'NAME_INVALID', 'Enter a name up to 120 characters.');
  const contact = normalizeContact(rawContact);
  const passwordHash = await hashPassword(password);
  if (!['en', 'hi', 'ml', 'ta'].includes(preferredLanguage)) {
    throw new ApiError(400, 'LANGUAGE_INVALID', 'Select an available interface language.');
  }
  if (!verifier.available) throw verificationUnavailable();

  const code = generateCode();
  const dbSession = await mongoose.startSession();
  let parentId = '';
  try {
    await dbSession.withTransaction(async () => {
      const existing = await ParentAccount.findOne({ contact: contact.value }).session(dbSession);
      if (existing?.verificationStatus === 'verified') return;
      let parent = existing;
      if (!parent) {
        const created = await ParentAccount.create([{
          name,
          contact: contact.value,
          contactType: contact.type,
          passwordHash,
          preferredLanguage: preferredLanguage as LanguageCode,
          verificationStatus: 'pending',
          accountStatus: 'active',
        }], { session: dbSession });
        parent = created[0];
        await Family.create([{ guardianId: parent._id, status: 'active' }], { session: dbSession });
      }
      parentId = String(parent._id);
      await IdentityChallenge.updateMany({ parentId: parent._id, purpose: 'registration', consumedAt: { $exists: false } },
        { $set: { consumedAt: new Date() } }, { session: dbSession });
      await IdentityChallenge.create([{
        parentId: parent._id,
        contact: contact.value,
        purpose: 'registration',
        tokenHash: challengeHash(contact.value, 'registration', code),
        expiresAt: new Date(Date.now() + challengeExpiryMs),
      }], { session: dbSession });
    });
  } finally {
    await dbSession.endSession();
  }
  if (parentId) await verifier.sendVerification(contact.value, code);
  res.status(202).json({ status: 'verification_pending' });
}

export async function completeVerification(req: Request, res: Response): Promise<void> {
  if (!verifier.available) throw verificationUnavailable();
  const contact = normalizeContact(req.body?.contact);
  const code = req.body?.code;
  if (typeof code !== 'string' || !/^\d{6}$/.test(code)) {
    throw new ApiError(400, 'VERIFICATION_CODE_INVALID', 'Enter the six-digit verification code.');
  }
  const parent = await ParentAccount.findOne({ contact: contact.value, verificationStatus: 'pending' });
  if (!parent) throw unauthorized();
  const now = new Date();
  const candidate = await IdentityChallenge.findOne({
    parentId: parent._id,
    purpose: 'registration',
    tokenHash: challengeHash(contact.value, 'registration', code),
    expiresAt: { $gt: now },
    attempts: { $lt: maxChallengeAttempts },
    consumedAt: { $exists: false },
  });
  if (!candidate) {
    await IdentityChallenge.updateMany({ parentId: parent._id, purpose: 'registration', consumedAt: { $exists: false }, attempts: { $lt: maxChallengeAttempts } },
      { $inc: { attempts: 1 } });
    throw unauthorized();
  }
  const dbSession = await mongoose.startSession();
  try {
    await dbSession.withTransaction(async () => {
      await IdentityChallenge.updateOne({ _id: candidate._id, consumedAt: { $exists: false } }, { $set: { consumedAt: now } }, { session: dbSession });
      await ParentAccount.updateOne({ _id: parent._id, verificationStatus: 'pending' },
        { $set: { verificationStatus: 'verified', verifiedAt: now } }, { session: dbSession });
      await appendAudit({ actorId: String(parent._id), eventType: 'parent.account_verified', requestId: req.nteRequestId ?? '' }, dbSession);
    });
  } finally { await dbSession.endSession(); }
  res.status(204).end();
}

export async function signIn(req: Request, res: Response): Promise<void> {
  const parent = await verifyCredentials(req.body?.contact, req.body?.password);
  const tokens = await createSession(String(parent._id), parent.sessionVersion);
  res.json({ parent: parentPublicRecord(parent), ...tokens, tokenType: 'Bearer' });
}

export async function refreshSession(req: Request, res: Response): Promise<void> {
  const tokens = await rotateSession(req.body?.refreshToken);
  res.json({ ...tokens, tokenType: 'Bearer' });
}

export async function signOut(req: Request, res: Response): Promise<void> {
  if (!req.nteAuth) throw unauthorized();
  await revokeSession(req.nteAuth.sessionId, req.nteAuth.parentId);
  res.status(204).end();
}

export async function currentParent(req: Request, res: Response): Promise<void> {
  if (!req.nteAuth) throw unauthorized();
  const parent = await ParentAccount.findById(req.nteAuth.parentId);
  if (!parent) throw unauthorized();
  res.json({ parent: parentPublicRecord(parent) });
}

export async function updatePreferredLanguage(req: Request, res: Response): Promise<void> {
  if (!req.nteAuth) throw unauthorized();
  const language = req.body?.preferredLanguage;
  if (!['en', 'hi', 'ml', 'ta'].includes(language)) {
    throw new ApiError(400, 'LANGUAGE_INVALID', 'Select an available interface language.');
  }
  const parent = await ParentAccount.findByIdAndUpdate(
    req.nteAuth.parentId,
    { $set: { preferredLanguage: language } },
    { new: true, runValidators: true },
  );
  if (!parent) throw unauthorized();
  await appendAudit({
    actorId: req.nteAuth.parentId,
    eventType: 'parent.language_preference_updated',
    requestId: req.nteAuth.requestId,
    details: { preferredLanguage: String(language) },
  });
  res.json({ preferredLanguage: parent.preferredLanguage });
}

export async function requestRecovery(_req: Request, _res: Response): Promise<void> {
  // A generic response is used when a provider exists; this build has none and
  // deliberately does not look up the submitted contact or disclose account state.
  if (!recoveryProvider.available) throw recoveryUnavailable();
  throw recoveryUnavailable();
}

export async function completeRecovery(req: Request, _res: Response): Promise<void> {
  if (!recoveryProvider.available) throw recoveryUnavailable();
  const contact = normalizeContact(req.body?.contact);
  const code = req.body?.code;
  const passwordHash = await hashPassword(req.body?.newPassword);
  if (typeof code !== 'string' || !/^\d{6}$/.test(code)) throw unauthorized();
  const parent = await ParentAccount.findOne({ contact: contact.value });
  if (!parent) throw unauthorized();
  const challenge = await IdentityChallenge.findOne({
    parentId: parent._id, purpose: 'recovery', tokenHash: challengeHash(contact.value, 'recovery', code),
    expiresAt: { $gt: new Date() }, attempts: { $lt: maxChallengeAttempts }, consumedAt: { $exists: false },
  });
  if (!challenge) throw unauthorized();
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await IdentityChallenge.updateOne({ _id: challenge._id, consumedAt: { $exists: false } }, { $set: { consumedAt: new Date() } }, { session });
      await ParentAccount.updateOne({ _id: parent._id }, { $set: { passwordHash }, $inc: { sessionVersion: 1 } }, { session });
      await AuthSession.updateMany({ parentId: parent._id, revokedAt: { $exists: false } }, { $set: { revokedAt: new Date() } }, { session });
      await appendAudit({ actorId: String(parent._id), eventType: 'parent.password_recovered', requestId: req.nteRequestId ?? '' }, session);
    });
  } finally { await session.endSession(); }
  _res.status(204).end();
}

