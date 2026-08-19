import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';

export const authorizeUserResource = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const requestedUserId = Number(req.params.id);
  const authenticatedUser = req.user;

  if (!authenticatedUser || !Number.isInteger(requestedUserId)) {
    res.status(403).json({ message: 'No autorizado' });
    return;
  }

  if (
    authenticatedUser.role === 'admin' ||
    authenticatedUser.role === 'psicologo' ||
    (authenticatedUser.role === 'usuario' && authenticatedUser.id === requestedUserId)
  ) {
    next();
    return;
  }

  res.status(403).json({ message: 'No autorizado' });
};