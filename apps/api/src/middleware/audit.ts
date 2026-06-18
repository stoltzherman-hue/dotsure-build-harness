import { Request, Response, NextFunction } from 'express';
import { logger } from '../services/logger';

export const auditMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on('finish', () => {
    if (['POST','PATCH','PUT','DELETE'].includes(req.method)) {
      logger.info('audit', {
        method: req.method,
        path: req.path,
        status: res.statusCode,
        user: (req as any).auth?.sub || 'anonymous',
        duration: Date.now() - start,
        ip: req.ip,
        body: req.body
      });
    }
  });
  next();
};
