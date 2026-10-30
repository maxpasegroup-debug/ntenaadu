import type { RequestHandler } from 'express';
import { forbidden, unauthorized } from '../errors';
import { ParentAccount } from '../models';

export const requireFinanceSupport: RequestHandler = async (req, _res, next) => {
  try {
    if (!req.nteAuth) return next(unauthorized());
    const account = await ParentAccount.findOne({
      _id: req.nteAuth.parentId,
      accountStatus: 'active',
      verificationStatus: 'verified',
      adultVerificationStatus: 'verified',
      staffRoles: 'finance_support',
    }).select('+staffRoles +adultVerificationStatus');
    if (!account) return next(forbidden());
    next();
  } catch (error) { next(error); }
};
