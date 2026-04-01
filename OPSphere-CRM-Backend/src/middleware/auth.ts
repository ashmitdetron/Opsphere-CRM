import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthenticatedRequest, JwtAccessPayload } from '../types/index.js';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-dev-secret';

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Missing or malformed Authorization header' },
    });
    return;
  }

  const token = header.slice(7);

  try {
    const payload = jwt.verify(token, JWT_SECRET) as JwtAccessPayload;
    (req as AuthenticatedRequest).user = payload;
    (req as AuthenticatedRequest).entityId = payload.entityId;
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        error: { code: 'TOKEN_EXPIRED', message: 'Access token has expired' },
      });
      return;
    }
    res.status(401).json({
      error: { code: 'INVALID_TOKEN', message: 'Invalid access token' },
    });
  }
}
