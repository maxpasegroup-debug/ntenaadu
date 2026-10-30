import type { ErrorRequestHandler } from 'express';
import { ApiError } from '../errors';

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  if (error instanceof ApiError) {
    response.status(error.status).json({ error: { code: error.code, message: error.message } });
    return;
  }
  if ((error as { name?: string })?.name === 'ValidationError') {
    response.status(400).json({ error: { code: 'VALIDATION_FAILED', message: 'Review the submitted information.' } });
    return;
  }
  if ((error as { code?: number })?.code === 11000) {
    response.status(409).json({ error: { code: 'ACCOUNT_CONFLICT', message: 'This account cannot be registered with those details.' } });
    return;
  }
  if ((error as { type?: string })?.type === 'entity.too.large') {
    response.status(413).json({ error: { code: 'REQUEST_TOO_LARGE', message: 'The request is too large.' } });
    return;
  }
  response.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'The request could not be completed.' } });
};
