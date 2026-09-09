import { Response } from 'express';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../db';
import * as schema from '../db/schema';
import { AuthRequest } from '../middleware/auth.middleware';
import { ROLES } from '../shared/const/roles.const';

const psicologoDirectorioColumns = {
  id: schema.usuarios.id,
  nombres: schema.usuarios.nombres,
  apellidos: schema.usuarios.apellidos,
  especialidad_psicologo: schema.usuarios.especialidad_psicologo,
  ciudad: schema.usuarios.ciudad,
  idioma: schema.usuarios.idioma,
};

export const listPsicologos = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const items = await db
      .select(psicologoDirectorioColumns)
      .from(schema.usuarios)
      .where(and(
        eq(schema.usuarios.id_rol, ROLES.PSICOLOGO.id),
        eq(schema.usuarios.is_active, true),
        isNull(schema.usuarios.deleted_at),
      ));
    res.json(items);
  } catch (error) {
    console.error('Error listing psicologos:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
};

export const getPsicologoById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) { res.status(400).json({ message: 'ID inválido' }); return; }

    const [item] = await db
      .select(psicologoDirectorioColumns)
      .from(schema.usuarios)
      .where(and(
        eq(schema.usuarios.id, id),
        eq(schema.usuarios.id_rol, ROLES.PSICOLOGO.id),
        eq(schema.usuarios.is_active, true),
        isNull(schema.usuarios.deleted_at),
      ))
      .limit(1);

    if (!item) { res.status(404).json({ message: 'Psicólogo no encontrado' }); return; }
    res.json(item);
  } catch (error) {
    console.error('Error getting psicologo:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
};