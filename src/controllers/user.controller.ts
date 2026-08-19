import { Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import { db } from '../db';
import * as schema from '../db/schema';
import { and, eq, isNull, ne } from 'drizzle-orm';
import { AuthRequest } from '../middleware/auth.middleware';
import { APISuccessResponse, APIErrorResponse } from '../shared/utils/api.utils';

const userCreateSchema = z.object({
  nombres: z.string().min(1),
  apellidos: z.string().min(1),
  correo: z.string().email(),
  contrasena: z.string().min(6),
});

const userPutSchema = userCreateSchema;
const userPatchSchema = userCreateSchema.partial();
const streakCommitmentSchema = z.object({
  goal_days: z.number().int().min(1).max(365),
});

const activeUserCondition = () => and(
  isNull(schema.usuarios.deleted_at),
  eq(schema.usuarios.is_active, true),
);

const toDateOnlyString = (value: Date): string => value.toISOString().split('T')[0];

const parseDateOnly = (value: Date | string | null): Date | null => {
  if (!value) return null;
  if (value instanceof Date) {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
};

export const getMyStreakCommitment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const usuarioId = req.user?.id;
    if (!usuarioId) {
      res.status(401).json(APIErrorResponse('Usuario no autenticado'));
      return;
    }

    const [user] = await db
      .select({
        streak_goal_days: schema.usuarios.streak_goal_days,
        streak_count: schema.usuarios.streak_count,
        streak_last_date: schema.usuarios.streak_last_date,
        streak_goal_set: schema.usuarios.streak_goal_set,
      })
      .from(schema.usuarios)
      .where(eq(schema.usuarios.id, usuarioId))
      .limit(1);

    if (!user) {
      res.status(404).json(APIErrorResponse('Usuario no encontrado'));
      return;
    }

    res.status(200).json(APISuccessResponse({
      goal_days: user.streak_goal_days,
      streak_count: user.streak_count,
      last_streak_date: user.streak_last_date ? toDateOnlyString(new Date(user.streak_last_date)) : null,
      streak_goal_set: user.streak_goal_set,
    }, 'Compromiso de racha obtenido correctamente'));
  } catch (error) {
    console.error('Error getMyStreakCommitment:', error);
    res.status(500).json(APIErrorResponse('Error al obtener compromiso de racha'));
  }
};

export const updateMyStreakCommitment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const usuarioId = req.user?.id;
    if (!usuarioId) {
      res.status(401).json(APIErrorResponse('Usuario no autenticado'));
      return;
    }

    const parsed = streakCommitmentSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json(APIErrorResponse('Datos inválidos', parsed.error.errors.map((e) => e.message)));
      return;
    }

    const goalDays = parsed.data.goal_days;

    const [updated] = await db
      .update(schema.usuarios)
      .set({
        streak_goal_days: goalDays,
        streak_goal_set: true,
        updated_at: new Date(),
      })
      .where(eq(schema.usuarios.id, usuarioId))
      .returning({
        streak_goal_days: schema.usuarios.streak_goal_days,
        streak_count: schema.usuarios.streak_count,
        streak_last_date: schema.usuarios.streak_last_date,
        streak_goal_set: schema.usuarios.streak_goal_set,
      });

    if (!updated) {
      res.status(404).json(APIErrorResponse('Usuario no encontrado'));
      return;
    }

    res.status(200).json(APISuccessResponse({
      goal_days: updated.streak_goal_days,
      streak_count: updated.streak_count,
      last_streak_date: updated.streak_last_date ? toDateOnlyString(new Date(updated.streak_last_date)) : null,
      streak_goal_set: updated.streak_goal_set,
    }, 'Compromiso de racha actualizado correctamente'));
  } catch (error) {
    console.error('Error updateMyStreakCommitment:', error);
    res.status(500).json(APIErrorResponse('Error al actualizar compromiso de racha'));
  }
};

export const registerMyDailyStreak = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const usuarioId = req.user?.id;
    if (!usuarioId) {
      res.status(401).json(APIErrorResponse('Usuario no autenticado'));
      return;
    }

    const [current] = await db
      .select({
        streak_goal_days: schema.usuarios.streak_goal_days,
        streak_count: schema.usuarios.streak_count,
        streak_last_date: schema.usuarios.streak_last_date,
        streak_goal_set: schema.usuarios.streak_goal_set,
      })
      .from(schema.usuarios)
      .where(eq(schema.usuarios.id, usuarioId))
      .limit(1);

    if (!current) {
      res.status(404).json(APIErrorResponse('Usuario no encontrado'));
      return;
    }

    if (!current.streak_goal_set) {
      res.status(409).json(APIErrorResponse('Debes elegir tu compromiso de racha primero'));
      return;
    }

    const today = parseDateOnly(new Date())!;
    const last = parseDateOnly(current.streak_last_date);
    let nextCount = current.streak_count;
    let activatedToday = false;

    if (!last) {
      nextCount = 1;
      activatedToday = true;
    } else {
      const diffDays = Math.floor((today.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays === 0) {
        activatedToday = false;
      } else if (diffDays === 1) {
        nextCount += 1;
        activatedToday = true;
      } else {
        nextCount = 1;
        activatedToday = true;
      }
    }

    const [updated] = await db
      .update(schema.usuarios)
      .set({
        streak_count: nextCount,
        streak_last_date: activatedToday ? today.toISOString().split('T')[0] : current.streak_last_date,
        updated_at: new Date(),
      })
      .where(eq(schema.usuarios.id, usuarioId))
      .returning({
        streak_goal_days: schema.usuarios.streak_goal_days,
        streak_count: schema.usuarios.streak_count,
        streak_last_date: schema.usuarios.streak_last_date,
        streak_goal_set: schema.usuarios.streak_goal_set,
      });

    if (!updated) {
      res.status(404).json(APIErrorResponse('Usuario no encontrado'));
      return;
    }

    res.status(200).json(APISuccessResponse({
      activated_today: activatedToday,
      goal_days: updated.streak_goal_days,
      streak_count: updated.streak_count,
      last_streak_date: updated.streak_last_date ? toDateOnlyString(new Date(updated.streak_last_date)) : null,
      streak_goal_set: updated.streak_goal_set,
    }, activatedToday ? 'Racha diaria registrada' : 'La racha de hoy ya estaba registrada'));
  } catch (error) {
    console.error('Error registerMyDailyStreak:', error);
    res.status(500).json(APIErrorResponse('Error al registrar racha diaria'));
  }
};

export const listUsers = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const users = await db
      .select({
        id: schema.usuarios.id,
        correo: schema.usuarios.correo,
        nombres: schema.usuarios.nombres,
        apellidos: schema.usuarios.apellidos,
        id_rol: schema.usuarios.id_rol,
      })
      .from(schema.usuarios)
      .where(activeUserCondition());
    res.json(users);
  } catch (error) {
    console.error('Error list users:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
};

export const createUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parsed = userCreateSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ message: 'Datos inválidos', errors: parsed.error.errors }); return; }
    const data = parsed.data;
    const normalizedEmail = data.correo.toLowerCase().trim();
    const [exists] = await db.select().from(schema.usuarios)
      .where(eq(schema.usuarios.correo, normalizedEmail))
      .limit(1);
    if (exists) { res.status(409).json({ message: 'El correo ya está registrado' }); return; }
    const hashed = await bcrypt.hash(data.contrasena, 10);
    const [created] = await db
      .insert(schema.usuarios)
      .values({ nombres: data.nombres, apellidos: data.apellidos, correo: normalizedEmail, contrasena: hashed })
      .returning({ id: schema.usuarios.id, correo: schema.usuarios.correo, nombres: schema.usuarios.nombres, apellidos: schema.usuarios.apellidos });
    res.status(201).json(created);
  } catch (error) {
    console.error('Error create user:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
};

export const updateUserPut = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = Number(req.params.id);
    if (Number.isNaN(userId)) { res.status(400).json({ message: 'ID inválido' }); return; }
    if (Object.prototype.hasOwnProperty.call(req.body, 'id_rol')) {
      res.status(403).json({ message: 'No puedes modificar el rol mediante esta operación' });
      return;
    }
    const parsed = userPutSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ message: 'Datos inválidos', errors: parsed.error.errors }); return; }
    const data = parsed.data;
    const normalizedEmail = data.correo.toLowerCase().trim();
    const [emailOwner] = await db.select({ id: schema.usuarios.id })
      .from(schema.usuarios)
      .where(and(eq(schema.usuarios.correo, normalizedEmail), ne(schema.usuarios.id, userId)))
      .limit(1);
    if (emailOwner) { res.status(409).json({ message: 'El correo ya está registrado' }); return; }
    const [existing] = await db.select().from(schema.usuarios).where(and(
      eq(schema.usuarios.id, userId),
      activeUserCondition(),
    )).limit(1);
    if (!existing) { res.status(404).json({ message: 'Usuario no encontrado' }); return; }
    const hashed = await bcrypt.hash(data.contrasena, 10);
    const [updated] = await db
      .update(schema.usuarios)
      .set({ nombres: data.nombres, apellidos: data.apellidos, correo: normalizedEmail, contrasena: hashed, updated_at: new Date() })
      .where(eq(schema.usuarios.id, userId))
      .returning({ id: schema.usuarios.id, correo: schema.usuarios.correo, nombres: schema.usuarios.nombres, apellidos: schema.usuarios.apellidos });
    res.json(updated);
  } catch (error) {
    console.error('Error put user:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
};

export const updateUserPatch = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = Number(req.params.id);
    if (Number.isNaN(userId)) { res.status(400).json({ message: 'ID inválido' }); return; }
    if (Object.prototype.hasOwnProperty.call(req.body, 'id_rol')) {
      res.status(403).json({ message: 'No puedes modificar el rol mediante esta operación' });
      return;
    }
    const parsed = userPatchSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ message: 'Datos inválidos', errors: parsed.error.errors }); return; }
    const normalizedEmail = parsed.data.correo?.toLowerCase().trim();
    if (normalizedEmail) {
      const [emailOwner] = await db.select({ id: schema.usuarios.id })
        .from(schema.usuarios)
        .where(and(eq(schema.usuarios.correo, normalizedEmail), ne(schema.usuarios.id, userId)))
        .limit(1);
      if (emailOwner) { res.status(409).json({ message: 'El correo ya está registrado' }); return; }
    }
    const [existing] = await db.select().from(schema.usuarios).where(and(
      eq(schema.usuarios.id, userId),
      activeUserCondition(),
    )).limit(1);
    if (!existing) { res.status(404).json({ message: 'Usuario no encontrado' }); return; }
    const data = parsed.data;
    const payload: any = { updated_at: new Date() };
    if (data.nombres !== undefined) payload.nombres = data.nombres;
    if (data.apellidos !== undefined) payload.apellidos = data.apellidos;
    if (normalizedEmail !== undefined) payload.correo = normalizedEmail;
    if (data.contrasena !== undefined) payload.contrasena = await bcrypt.hash(data.contrasena, 10);
    const [updated] = await db.update(schema.usuarios).set(payload).where(eq(schema.usuarios.id, userId)).returning({ id: schema.usuarios.id, correo: schema.usuarios.correo, nombres: schema.usuarios.nombres, apellidos: schema.usuarios.apellidos });
    res.json(updated);
  } catch (error) {
    console.error('Error patch user:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
};

export const deleteUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = Number(req.params.id);
    if (Number.isNaN(userId)) { res.status(400).json({ message: 'ID inválido' }); return; }
    const [existing] = await db.select().from(schema.usuarios).where(and(
      eq(schema.usuarios.id, userId),
      activeUserCondition(),
    )).limit(1);
    if (!existing) { res.status(404).json({ message: 'Usuario no encontrado' }); return; }
    if (req.user?.role !== 'psicologo') { res.status(403).json({ message: 'No autorizado' }); return; }
    await db.update(schema.usuarios)
      .set({ deleted_at: new Date(), is_active: false, updated_at: new Date() })
      .where(and(eq(schema.usuarios.id, userId), activeUserCondition()));
    res.json({ message: 'Usuario eliminado' });
  } catch (error) {
    console.error('Error delete user:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
};

export const getUserById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.params.id;

    const [user] = await db
      .select()
      .from(schema.usuarios)
      .where(and(eq(schema.usuarios.id, Number(userId)), activeUserCondition()))
      .limit(1);

    if (!user) {
      res.status(404).json({ message: 'Usuario no encontrado' });
      return;
    }
    
    const { contrasena, ...safeUser } = user;
    res.json(safeUser);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
};

/**
 * Get current authenticated user profile
 */
export const getProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ message: 'Usuario no autenticado' });
      return;
    }
    
    const [user] = await db
      .select()
      .from(schema.usuarios)
      .where(and(eq(schema.usuarios.id, req.user.id as number), activeUserCondition()))
      .limit(1);
    
    if (!user) {
      res.status(404).json({ message: 'Usuario no encontrado' });
      return;
    }
    
    // Eliminamos la contraseña antes de devolver el usuario
    const { contrasena, ...userSinContrasena } = user;
    
    res.json(userSinContrasena);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
};