import { createHash, randomBytes } from 'node:crypto';
import { parse, serialize } from 'cookie';
import type { Pool } from 'pg';
import type { RequestHandler, Response } from 'express';
import type { Config } from '../../config.js';
import { AppError } from '../../lib/errors.js';

export type User = { id: string; name: string; email: string };
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

const cookieName = 'sweety_session';
const lifetime = 7 * 24 * 60 * 60;
const hash = (token: string) => createHash('sha256').update(token).digest('hex');
const tokenFrom = (header?: string) => parse(header ?? '')[cookieName];

export async function issueSession(
  pool: Pool,
  userId: string,
  res: Response,
  config: Config,
): Promise<void> {
  const token = randomBytes(32).toString('hex');
  await pool.query('DELETE FROM sessions WHERE expires_at < now()');
  await pool.query(
    "INSERT INTO sessions(token_hash, user_id, expires_at) VALUES ($1, $2, now() + interval '7 days')",
    [hash(token), userId],
  );
  res.setHeader(
    'Set-Cookie',
    serialize(cookieName, token, {
      httpOnly: true,
      secure: config.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api',
      maxAge: lifetime,
    }),
  );
}

export async function revokeSession(
  pool: Pool,
  cookie: string | undefined,
  res: Response,
  config: Config,
): Promise<void> {
  const token = tokenFrom(cookie);
  if (token) await pool.query('DELETE FROM sessions WHERE token_hash = $1', [hash(token)]);
  res.setHeader(
    'Set-Cookie',
    serialize(cookieName, '', {
      httpOnly: true,
      secure: config.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api',
      maxAge: 0,
    }),
  );
}

export function requireAuth(pool: Pool): RequestHandler {
  return async (req, _res, next) => {
    const token = tokenFrom(req.headers.cookie);
    if (!token || !/^[a-f0-9]{64}$/.test(token))
      throw new AppError(401, 'UNAUTHENTICATED', 'Please log in to continue.');
    const result = await pool.query<User>(
      'SELECT u.id, u.name, u.email FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = $1 AND s.expires_at > now()',
      [hash(token)],
    );
    if (!result.rows[0])
      throw new AppError(401, 'UNAUTHENTICATED', 'Your session has expired. Please log in again.');
    req.user = result.rows[0];
    next();
  };
}
