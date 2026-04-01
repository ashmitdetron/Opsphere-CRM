import { Request, Response, NextFunction } from 'express';
import pool from '../db/pool.js';
import { AuthenticatedRequest } from '../types/index.js';

export function entityScope(req: Request, res: Response, next: NextFunction): void {
  const authedReq = req as AuthenticatedRequest;
  const headerEntityId = req.headers['x-entity-id'] as string | undefined;

  if (!headerEntityId) {
    res.status(400).json({
      error: { code: 'MISSING_ENTITY', message: 'X-Entity-Id header is required' },
    });
    return;
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(headerEntityId)) {
    res.status(400).json({
      error: { code: 'INVALID_ENTITY', message: 'X-Entity-Id must be a valid UUID' },
    });
    return;
  }

  if (authedReq.user.entityId !== headerEntityId) {
    res.status(403).json({
      error: { code: 'ENTITY_MISMATCH', message: 'X-Entity-Id does not match token entity' },
    });
    return;
  }

  pool.query(
    'SELECT 1 FROM crm_entity_members WHERE entity_id = $1 AND user_id = $2 LIMIT 1',
    [headerEntityId, authedReq.user.sub]
  )
    .then((result) => {
      if (result.rowCount === 0) {
        res.status(403).json({
          error: { code: 'NOT_MEMBER', message: 'User is not a member of this organisation' },
        });
        return;
      }
      authedReq.entityId = headerEntityId;
      next();
    })
    .catch(next);
}
