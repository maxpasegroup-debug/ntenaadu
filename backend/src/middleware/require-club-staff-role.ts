import type { RequestHandler } from 'express';
import { forbidden, unauthorized } from '../errors';
import { ParentAccount } from '../models';

export type ClubStaffRole = 'club_reviewer' | 'club_moderator' | 'event_manager';

export function requireClubStaffRole(role: ClubStaffRole): RequestHandler {
  return async (req, _res, next) => {
    try {
      if (!req.nteAuth) return next(unauthorized());
      const staffAccount = await ParentAccount.findOne({
        _id: req.nteAuth.parentId,
        accountStatus: 'active',
        verificationStatus: 'verified',
        adultVerificationStatus: 'verified',
        staffRoles: role,
      }).select('+staffRoles +adultVerificationStatus');
      if (!staffAccount) return next(forbidden());
      next();
    } catch (error) { next(error); }
  };
}
