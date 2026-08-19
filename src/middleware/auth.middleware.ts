// Libs
import { Request, Response, NextFunction } from 'express';
import { and, eq, isNull } from 'drizzle-orm';

// Config
import { verifyToken, JwtPayload } from '../config/jwt';

// Constants
import { ROLES } from '../shared/const/roles.const';
import { db } from '../db';
import { usuarios } from '../db/schema';

export interface AuthRequest extends Request {
  user?: JwtPayload;
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      res.status(401).json({ message: 'No token provided' });
      return;
    }
    
    const [scheme, token] = authHeader.trim().split(/\s+/);
    if (scheme?.toLowerCase() !== 'bearer' || !token) {
      res.status(401).json({ message: 'Invalid authorization header' });
      return;
    }

    const decoded = verifyToken(token);
    
    if (!decoded) {
      res.status(401).json({ message: 'Invalid or expired token' });
      return;
    }
    
    const [activeUser] = await db
      .select({ id: usuarios.id })
      .from(usuarios)
      .where(and(
        eq(usuarios.id, decoded.id),
        isNull(usuarios.deleted_at),
        eq(usuarios.is_active, true),
      ))
      .limit(1);

    if (!activeUser) {
      res.status(401).json({ message: 'Invalid or expired token' });
      return;
    }

    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Authentication failed' });
  }
};

export const isUsuario = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (req.user?.role !== ROLES.USUARIO.nombre) {
    res.status(403).json({ message: 'Access forbidden: User role required' });
    return;
  }
  
  next();
};

export const isPsicologo = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (req.user?.role !== ROLES.PSICOLOGO.nombre) {
    res.status(403).json({ message: 'Access forbidden: Psychologist role required' });
    return;
  }
  
  next();
}; 

export const isAdmin = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (req.user?.role !== ROLES.ADMIN.nombre) {
    res.status(403).json({ message: 'Access forbidden: Admin role required' });
    return;
  }
  
  next();
};

export const isBienestarUniversitario = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const role = req.user?.role;
  const allowed = role === ROLES.MODERADOR.nombre || role === ROLES.ADMIN.nombre;

  if (!allowed) {
    res.status(403).json({ message: 'Access forbidden: BienestarUniversitario/Admin role required' });
    return;
  }

  next();
};