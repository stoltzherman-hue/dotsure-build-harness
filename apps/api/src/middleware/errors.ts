import { Request, Response, NextFunction } from 'express';
import { logger } from '../services/logger';

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  logger.error(err.message, { stack: err.stack, path: req.path });
  if (err.name === 'UnauthorizedError') return res.status(401).json({ error: 'Unauthorised' });
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
};
