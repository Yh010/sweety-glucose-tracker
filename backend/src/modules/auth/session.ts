import { createHash, randomBytes } from 'node:crypto';
import { parse, serialize } from 'cookie';
import type { Pool, PoolClient } from 'pg';
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

export async function createSession(db: PoolClient, userId: string): Promise<string> {
  const token = randomBytes(32).toString('hex');
  await db.query(
    "INSERT INTO sessions(token_hash, user_id, expires_at) VALUES ($1, $2, now() + interval '7 days')",
    [hash(token), userId],
  );
  return token;
}

export function setSessionCookie(res: Response, token: string, config: Config): void {
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

export async function deleteSession(
  db: Pool | PoolClient,
  cookie: string | undefined,
): Promise<void> {
  const token = tokenFrom(cookie);
  if (token) await db.query('DELETE FROM sessions WHERE token_hash = $1', [hash(token)]);
}

export async function revokeSession(
  pool: Pool,
  cookie: string | undefined,
  res: Response,
  config: Config,
): Promise<void> {
  await deleteSession(pool, cookie);
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
