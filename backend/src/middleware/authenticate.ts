import type { NextFunction, Request, Response } from 'express';
import { unauthorized } from '../errors';
import { verifyAccessToken } from '../services/auth';

export async function authenticateParent(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw unauthorized();
    const { parent, session } = await verifyAccessToken(header.slice(7));
    req.nteAuth = {
      parentId: String(parent._id),
      sessionId: String(session._id),
      sessionVersion: parent.sessionVersion,
      requestId: req.nteRequestId ?? '',
    };
    next();
  } catch {
    next(unauthorized());
  }
}
