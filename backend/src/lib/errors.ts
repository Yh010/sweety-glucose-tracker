import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';

export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
  if (error instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: error.issues[0]?.message ?? 'Invalid request.',
        fields: error.flatten().fieldErrors,
      },
    });
    return;
  }
  if (error instanceof AppError) {
    if (error.status === 503) res.setHeader('Retry-After', '1');
    res.status(error.status).json({ error: { code: error.code, message: error.message } });
    return;
  }
  if (error instanceof SyntaxError && 'body' in error) {
    res
      .status(400)
      .json({ error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON.' } });
    return;
  }
  if (
    typeof error === 'object' &&
    error !== null &&
    'type' in error &&
    error.type === 'entity.too.large'
  ) {
    res.status(413).json({ error: { code: 'BODY_TOO_LARGE', message: 'Request is too large.' } });
    return;
  }
  const databaseCode =
    typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : undefined;
  const unavailable =
    [
      '53300',
      '57P01',
      '57P02',
      '57P03',
      '57014',
      '55P03',
      'ECONNREFUSED',
      'ECONNRESET',
      'ETIMEDOUT',
    ].includes(databaseCode ?? '') ||
    (error instanceof Error && error.message === 'timeout exceeded when trying to connect');
  console.error(
    JSON.stringify({
      event: 'request_error',
      requestId: res.getHeader('X-Request-ID'),
      code: databaseCode && /^[A-Z0-9]{5,16}$/.test(databaseCode) ? databaseCode : undefined,
      name: error instanceof Error ? error.name : 'UnknownError',
    }),
  );
  if (unavailable) {
    res.setHeader('Retry-After', '1');
    res
      .status(503)
      .json({
        error: {
          code: 'DATABASE_BUSY',
          message: 'The service is temporarily busy. Please try again shortly.',
        },
      });
    return;
  }
  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' },
  });
};
