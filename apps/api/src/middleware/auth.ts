import { Request, Response, NextFunction } from 'express';
import { expressjwt as jwt } from 'express-jwt';
import jwksRsa from 'jwks-rsa';

export const authMiddleware = jwt({
  secret: jwksRsa.expressJwtSecret({
    cache: true,
    rateLimit: true,
    jwksUri: https://login.microsoftonline.com//discovery/v2.0/keys
  }),
  audience: process.env.AZURE_CLIENT_ID,
  issuer: https://login.microsoftonline.com//v2.0,
  algorithms: ['RS256']
});
