import { randomUUID } from 'node:crypto';
import type { Passwords } from './passwords.js';
import { Router } from 'express';
import { rateLimit, type Store } from 'express-rate-limit';
import type { Pool } from 'pg';
import { z } from 'zod';
import type { Config } from '../../config.js';
import { AppError } from '../../lib/errors.js';
import {
  createSession,
  deleteSession,
  setSessionCookie,
  requireAuth,
  revokeSession,
  type User,
} from './session.js';
import { transaction } from '../../db/transaction.js';

const email = z.string().trim().toLowerCase().email('Enter a valid email address.').max(254);
const password = z
  .string()
  .min(8, 'Use at least 8 characters.')
  .refine((v) => Buffer.byteLength(v, 'utf8') <= 72, 'Password must be at most 72 UTF-8 bytes.');
const registration = z
  .object({
    name: z.string().trim().min(1, 'Enter your name.').max(80, 'Use at most 80 characters.'),
    email,
    password,
  })
  .strict();
const login = z.object({ email, password: z.string().min(1).max(256) }).strict();

export function authRoutes(
  pool: Pool,
  config: Config,
  passwords: Passwords,
  rateStore?: Store,
): Router {
  const router = Router();
  const limiter = rateLimit({
    store: rateStore,
    windowMs: 15 * 60 * 1000,
    limit: config.AUTH_RATE_LIMIT,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: {
      error: { code: 'RATE_LIMITED', message: 'Too many attempts. Try again in 15 minutes.' },
    },
  });
  router.post('/register', limiter, async (req, res) => {
    const input = registration.parse(req.body);
    const passwordHash = await passwords.hash(input.password);
    try {
      const { user, token } = await transaction(pool, async (client) => {
        const result = await client.query<User>(
          'INSERT INTO users(id, name, email, password_hash) VALUES ($1, $2, $3, $4) RETURNING id, name, email',
          [randomUUID(), input.name, input.email, passwordHash],
        );
        const user = result.rows[0]!;
        const token = await createSession(client, user.id);
        return { user, token };
      });
      setSessionCookie(res, token, config);
      res.status(201).json({ user });
    } catch (error) {
      if (
        (error as { code?: string; constraint?: string }).code === '23505' &&
        (error as { constraint?: string }).constraint === 'users_email_key'
      )
        throw new AppError(
          409,
          'EMAIL_EXISTS',
          'An account with this email already exists. Try logging in.',
        );
      throw error;
    }
  });
  router.post('/login', limiter, async (req, res) => {
    const input = login.parse(req.body);
    const result = await pool.query<User & { password_hash: string }>(
      'SELECT id, name, email, password_hash FROM users WHERE email = $1',
      [input.email],
    );
    const row = result.rows[0];
    const valid = await passwords.compare(input.password, row?.password_hash);
    if (!row || !valid)
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
    const token = await transaction(pool, async (client) => {
      await deleteSession(client, req.headers.cookie);
      return createSession(client, row.id);
    });
    setSessionCookie(res, token, config);
    res.json({ user: { id: row.id, name: row.name, email: row.email } });
  });
  router.get('/me', requireAuth(pool), (req, res) => res.json({ user: req.user }));
  router.post('/logout', async (req, res) => {
    await revokeSession(pool, req.headers.cookie, res, config);
    res.status(204).end();
  });
  return router;
}
