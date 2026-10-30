import type { RequestHandler } from 'express';
import { forbidden, unauthorized } from '../errors';
import { ParentAccount } from '../models';

export type NteStaffRole = 'platform_admin' | 'safeguarding_lead' | 'safeguarding_backup' | 'club_reviewer' | 'club_moderator' | 'event_manager' | 'content_editor' | 'content_reviewer' | 'finance_support' | 'auditor';

export function requireStaffRole(...allowed: NteStaffRole[]): RequestHandler {
  return async (req, _res, next) => {
    try {
      if (!req.nteAuth) return next(unauthorized());
      const account = await ParentAccount.findOne({
        _id: req.nteAuth.parentId,
        accountStatus: 'active',
        verificationStatus: 'verified',
        adultVerificationStatus: 'verified',
        staffRoles: { $in: allowed },
      }).select('+staffRoles +adultVerificationStatus');
      if (!account) return next(forbidden());
      next();
    } catch (error) { next(error); }
  };
}

