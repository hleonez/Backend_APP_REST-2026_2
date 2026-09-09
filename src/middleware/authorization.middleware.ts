import { Response, NextFunction } from 'express';
import { and, eq, isNull } from 'drizzle-orm';
import { AuthRequest } from './auth.middleware';
import { db } from '../db';
import { asignaciones } from '../db/schema';
import { ASIGNACION_ESTADO } from '../shared/const/asignacion.const';
import { ROLES } from '../shared/const/roles.const';

export const authorizeUserResource = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const requestedUserId = Number(req.params.id);
  const authenticatedUser = req.user;

  if (!authenticatedUser || !Number.isInteger(requestedUserId)) {
    res.status(403).json({ message: 'No autorizado' });
    return;
  }

  if (
    authenticatedUser.role === ROLES.ADMIN.nombre ||
    authenticatedUser.role === 'admin' ||
    authenticatedUser.id === requestedUserId
  ) {
    next();
    return;
  }

  res.status(403).json({ message: 'No autorizado' });
};

/**
 * Middleware que verifica si el psicólogo autenticado tiene una asignación activa (aprobada)
 * con el estudiante especificado en req.params (id o estudianteId).
 */
export const esPsicologoDeEstudiante = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authenticatedUser = req.user;
    const estudianteIdParam = req.params.estudianteId || req.params.id;
    const estudianteId = Number(estudianteIdParam);

    if (!authenticatedUser || !Number.isInteger(estudianteId)) {
      res.status(403).json({ message: 'No autorizado' });
      return;
    }

    // Administradores tienen acceso global
    if (authenticatedUser.role === ROLES.ADMIN.nombre || authenticatedUser.role === 'admin') {
      next();
      return;
    }

    // Debe ser psicólogo
    if (authenticatedUser.role !== ROLES.PSICOLOGO.nombre && authenticatedUser.role !== 'psicologo') {
      res.status(403).json({ message: 'Acceso denegado. Se requiere rol de psicólogo' });
      return;
    }

    // Verificar si existe una asignación activa (aprobada)
    const [asignacionActiva] = await db
      .select({ id: asignaciones.id })
      .from(asignaciones)
      .where(
        and(
          eq(asignaciones.estudiante_id, estudianteId),
          eq(asignaciones.psicologo_id, authenticatedUser.id),
          eq(asignaciones.estado, ASIGNACION_ESTADO.APROBADO),
          isNull(asignaciones.deleted_at)
        )
      )
      .limit(1);

    if (!asignacionActiva) {
      res.status(403).json({ message: 'Acceso denegado. No tiene una asignación activa con este estudiante' });
      return;
    }

    next();
  } catch (error) {
    res.status(500).json({ message: 'Error interno en la verificación de autorización' });
  }
};