import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import { env } from '../config/env';
import { ApiError, unauthorized, unavailable } from '../errors';
import { AuthSession, ParentAccount } from '../models';
import type { ContactType, LanguageCode } from '../types';

const ISSUER = 'nte-naadu-api';
const AUDIENCE = 'nte-naadu-mobile';
const PASSWORD_MIN = 10;

export function normalizeContact(value: unknown): { value: string; type: ContactType } {
  if (typeof value !== 'string') throw new ApiError(400, 'CONTACT_INVALID', 'Enter an email address or phone number.');
  const trimmed = value.trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return { value: trimmed.toLowerCase(), type: 'email' };
  const phone = trimmed.replace(/[\s()-]/g, '');
  if (/^\+[1-9]\d{7,14}$/.test(phone)) return { value: phone, type: 'phone' };
  throw new ApiError(400, 'CONTACT_INVALID', 'Enter a valid email address or international phone number.');
}

export function validatePassword(value: unknown): asserts value is string {
  if (typeof value !== 'string' || value.length < PASSWORD_MIN || value.length > 128) {
    throw new ApiError(400, 'PASSWORD_INVALID', `Password must contain ${PASSWORD_MIN} to 128 characters.`);
  }
}

export async function hashPassword(password: string): Promise<string> {
  validatePassword(password);
  return bcrypt.hash(password, 12);
}

function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function signAccessToken(parentId: string, sessionId: string, sessionVersion: number): string {
  return jwt.sign({ sub: parentId, sid: sessionId, sv: sessionVersion }, env.jwtSecret, {
    algorithm: 'HS256',
    expiresIn: env.accessTokenTtlSeconds,
    issuer: ISSUER,
    audience: AUDIENCE,
  });
}

function refreshExpiry(): Date {
  return new Date(Date.now() + env.refreshTokenTtlDays * 24 * 60 * 60 * 1000);
}

export async function createSession(parentId: string, sessionVersion: number) {
  const refreshToken = randomBytes(48).toString('base64url');
  const session = await AuthSession.create({
    parentId: new Types.ObjectId(parentId),
    refreshTokenHash: hashRefreshToken(refreshToken),
    expiresAt: refreshExpiry(),
  });
  return {
    accessToken: signAccessToken(parentId, String(session._id), sessionVersion),
    refreshToken,
    expiresIn: env.accessTokenTtlSeconds,
  };
}

export async function authenticateParent(contactValue: unknown, passwordValue: unknown) {
  const contact = normalizeContact(contactValue);
  if (typeof passwordValue !== 'string' || passwordValue.length > 128) throw unauthorized();
  const parent = await ParentAccount.findOne({ contact: contact.value }).select('+passwordHash');
  if (!parent || !(await bcrypt.compare(passwordValue, parent.passwordHash))) throw unauthorized();
  if (parent.accountStatus !== 'active' || parent.verificationStatus !== 'verified') throw unauthorized();
  return parent;
}

export async function rotateSession(refreshValue: unknown) {
  if (typeof refreshValue !== 'string' || refreshValue.length < 40 || refreshValue.length > 256) throw unauthorized();
  const oldHash = hashRefreshToken(refreshValue);
  const nextRefresh = randomBytes(48).toString('base64url');
  const nextHash = hashRefreshToken(nextRefresh);
  const session = await AuthSession.findOneAndUpdate(
    { refreshTokenHash: oldHash, revokedAt: { $exists: false }, expiresAt: { $gt: new Date() } },
    { $set: { refreshTokenHash: nextHash, lastUsedAt: new Date(), expiresAt: refreshExpiry() } },
    { new: true },
  );
  if (!session) throw unauthorized();
  const parent = await ParentAccount.findOne({ _id: session.parentId, accountStatus: 'active', verificationStatus: 'verified' });
  if (!parent) {
    await AuthSession.updateOne({ _id: session._id }, { $set: { revokedAt: new Date() } });
    throw unauthorized();
  }
  return {
    accessToken: signAccessToken(String(parent._id), String(session._id), parent.sessionVersion),
    refreshToken: nextRefresh,
    expiresIn: env.accessTokenTtlSeconds,
  };
}

export async function revokeSession(sessionId: string, parentId: string): Promise<void> {
  await AuthSession.updateOne(
    { _id: sessionId, parentId, revokedAt: { $exists: false } },
    { $set: { revokedAt: new Date() } },
  );
}

export async function verifyAccessToken(token: string) {
  let claims: jwt.JwtPayload;
  try {
    const result = jwt.verify(token, env.jwtSecret, {
      algorithms: ['HS256'], issuer: ISSUER, audience: AUDIENCE,
    });
    if (typeof result === 'string') throw unauthorized();
    claims = result;
  } catch {
    throw unauthorized();
  }
  if (typeof claims.sub !== 'string' || typeof claims.sid !== 'string' || !Number.isSafeInteger(claims.sv)) {
    throw unauthorized();
  }
  const [parent, session] = await Promise.all([
    ParentAccount.findById(claims.sub),
    AuthSession.findOne({ _id: claims.sid, parentId: claims.sub, revokedAt: { $exists: false }, expiresAt: { $gt: new Date() } }),
  ]);
  if (!parent || !session || parent.accountStatus !== 'active' || parent.verificationStatus !== 'verified' ||
      parent.sessionVersion !== claims.sv) throw unauthorized();
  return { parent, session };
}

export function providerUnavailable(provider: string): ApiError {
  return unavailable(`${provider.toUpperCase()}_UNAVAILABLE`, `${provider} service is not configured.`);
}

