import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export function requestContext(req: Request, res: Response, next: NextFunction): void {
  const requestId = randomUUID();
  req.nteRequestId = requestId;
  res.setHeader('X-Request-ID', requestId);
  next();
}
