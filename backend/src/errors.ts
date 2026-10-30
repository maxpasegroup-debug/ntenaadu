export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const unavailable = (code: string, message: string) => new ApiError(503, code, message);
export const badRequest = (code: string, message: string) => new ApiError(400, code, message);
export const unauthorized = () => new ApiError(401, 'AUTH_REQUIRED', 'Authentication required.');
export const forbidden = () => new ApiError(403, 'FORBIDDEN', 'This action is not allowed.');
export const notFound = () => new ApiError(404, 'NOT_FOUND', 'The requested item was not found.');
