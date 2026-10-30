import type { Request } from 'express';
import type { HydratedDocument } from 'mongoose';

export type LanguageCode = 'en' | 'hi' | 'ml' | 'ta';
export type AgeGroup = 'child' | 'youth';
export type ContactType = 'email' | 'phone';

export type ParentDocument = HydratedDocument<{
  _id: unknown;
  name: string;
  contact: string;
  contactType: ContactType;
  passwordHash: string;
  preferredLanguage: LanguageCode;
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

export interface ConsentPolicyDocument {
  id: string;
  version: string;
  languageCode: LanguageCode;
  title: string;
  body: string;
}

export type NteRequest = Request;
