import type { Request } from 'express';
import type { HydratedDocument } from 'mongoose';

export type LanguageCode = 'en' | 'hi' | 'ml' | 'ta';
export type AgeGroup = 'child' | 'youth';
export type ContactType = 'email' | 'phone';
export type MembershipCategory = 'mother' | 'father' | 'guardian';
export type MembershipStatus = 'pending_verification' | 'active' | 'suspended';

export type ParentDocument = HydratedDocument<{
  _id: unknown;
  name: string;
  contact: string;
  contactType: ContactType;
  passwordHash: string;
  preferredLanguage: LanguageCode;
  membershipCategory: MembershipCategory;
  membershipId?: string;
  membershipStatus: MembershipStatus;
  verificationStatus: 'pending' | 'verified';
  verifiedAt?: Date;
  accountStatus: 'active' | 'suspended';
  sessionVersion: number;
}>;

export interface AuthContext {
  parentId: string;
  sessionId: string;
  sessionVersion: number;
  requestId: string;
}

declare global {
  namespace Express {
    interface Request { nteAuth?: AuthContext; nteRequestId?: string; rawBody?: Buffer; }
  }
}

declare module 'http' {
  interface IncomingMessage { rawBody?: Buffer; }
}

export interface ConsentPolicyDocument {
  id: string;
  version: string;
  languageCode: LanguageCode;
  title: string;
  body: string;
}

export type NteRequest = Request;
