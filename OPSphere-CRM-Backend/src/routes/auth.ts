import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import pool from '../db/pool.js';
import { CrmUser, JwtAccessPayload, JwtRefreshPayload, AuthenticatedRequest } from '../types/index.js';
import { AppError } from '../middleware/errorHandler.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-dev-secret';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'fallback-refresh-secret';
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';
const SALT_ROUNDS = 12;

// ─── Schemas ──────────────────────────────────────────────

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(1).optional(),
  organisationName: z.string().min(1),
  industry: z.string().optional(),
  website: z.string().url().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1).optional(),
});

// ─── Helpers ──────────────────────────────────────────────

function signAccessToken(user: CrmUser): string {
  const payload: JwtAccessPayload = {
    sub: user.id,
    entityId: user.entity_id,
    role: user.role,
    tv: user.token_version,
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
}

function signRefreshToken(user: CrmUser): string {
  const payload: JwtRefreshPayload = {
    sub: user.id,
    tv: user.token_version,
  };
  return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });
}

// ─── POST /api/auth/register ─────────────────────────────

router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = registerSchema.parse(req.body);

    const existingUser = await pool.query(
      'SELECT id FROM crm_users WHERE email = $1',
      [body.email],
    );
    if (existingUser.rowCount && existingUser.rowCount > 0) {
      throw new AppError(409, 'EMAIL_EXISTS', 'A user with this email already exists');
    }

    const passwordHash = await bcrypt.hash(body.password, SALT_ROUNDS);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const orgResult = await client.query<{ id: string }>(
        `INSERT INTO organisations (name, industry, website)
         VALUES ($1, $2, $3) RETURNING id`,
        [body.organisationName, body.industry ?? null, body.website ?? null],
      );
      const orgId = orgResult.rows[0].id;

      const userResult = await client.query<CrmUser>(
        `INSERT INTO crm_users (entity_id, email, password_hash, display_name, role)
         VALUES ($1, $2, $3, $4, 'owner')
         RETURNING *`,
        [orgId, body.email, passwordHash, body.displayName ?? null],
      );
      const user = userResult.rows[0];

      await client.query(
        `INSERT INTO crm_entity_members (entity_id, user_id, role)
         VALUES ($1, $2, 'owner')`,
        [orgId, user.id],
      );

      await client.query('COMMIT');

      const accessToken = signAccessToken(user);
      const refreshToken = signRefreshToken(user);

      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/api/auth',
      });

      res.status(201).json({
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          email: user.email,
          displayName: user.display_name,
          role: user.role,
        },
        entity: {
          id: orgId,
          name: body.organisationName,
        },
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: err.errors },
      });
      return;
    }
    next(err);
  }
});

// ─── POST /api/auth/login ────────────────────────────────

router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = loginSchema.parse(req.body);

    const result = await pool.query<CrmUser>(
      'SELECT * FROM crm_users WHERE email = $1',
      [body.email],
    );

    if (result.rowCount === 0) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(body.password, user.password_hash);

    if (!valid) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }

    const orgResult = await pool.query<{ id: string; name: string }>(
      'SELECT id, name FROM organisations WHERE id = $1',
      [user.entity_id],
    );

    const accessToken = signAccessToken(user);
    const refreshToken = signRefreshToken(user);

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/api/auth',
    });

    res.json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        role: user.role,
      },
      entity: orgResult.rows[0]
        ? { id: orgResult.rows[0].id, name: orgResult.rows[0].name }
        : null,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: err.errors },
      });
      return;
    }
    next(err);
  }
});

// ─── POST /api/auth/refresh ──────────────────────────────

router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = refreshSchema.parse(req.body);
    const token = body.refreshToken || req.cookies?.refreshToken;

    if (!token) {
      throw new AppError(401, 'NO_REFRESH_TOKEN', 'Refresh token is required');
    }

    let payload: JwtRefreshPayload;
    try {
      payload = jwt.verify(token, JWT_REFRESH_SECRET) as JwtRefreshPayload;
    } catch {
      throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'Invalid or expired refresh token');
    }

    const result = await pool.query<CrmUser>(
      'SELECT * FROM crm_users WHERE id = $1',
      [payload.sub],
    );

    if (result.rowCount === 0) {
      throw new AppError(401, 'USER_NOT_FOUND', 'User not found');
    }

    const user = result.rows[0];

    if (user.token_version !== payload.tv) {
      throw new AppError(401, 'TOKEN_REVOKED', 'Refresh token has been revoked');
    }

    const accessToken = signAccessToken(user);
    const refreshToken = signRefreshToken(user);

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/api/auth',
    });

    res.json({ accessToken, refreshToken });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: err.errors },
      });
      return;
    }
    next(err);
  }
});

// ─── POST /api/auth/logout ───────────────────────────────

router.post('/logout', async (_req: Request, res: Response) => {
  res.clearCookie('refreshToken', { path: '/api/auth' });
  res.json({ ok: true });
});

// ─── GET /api/auth/me ────────────────────────────────────

router.get('/me', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authed = req as AuthenticatedRequest;
    const result = await pool.query<CrmUser>(
      'SELECT id, entity_id, email, display_name, role, created_at FROM crm_users WHERE id = $1',
      [authed.user.sub],
    );

    if (result.rowCount === 0) {
      throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
    }

    const user = result.rows[0];
    const orgResult = await pool.query<{ id: string; name: string }>(
      'SELECT id, name FROM organisations WHERE id = $1',
      [user.entity_id],
    );

    res.json({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        role: user.role,
        createdAt: user.created_at,
      },
      entity: orgResult.rows[0] ?? null,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
