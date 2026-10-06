import { Response } from 'express';
import { z } from 'zod';
import { db } from '../db';
import * as schema from '../db/schema';
import { and, desc, eq } from 'drizzle-orm';
import { AuthRequest } from '../middleware/auth.middleware';

const createSchema = z.object({
  opcion_id: z.number().int().positive(),
  vencimiento: z.coerce.date().optional(),
  fecha: z.coerce.date().optional(),
  observaciones: z.string().optional(),
});

const putSchema = createSchema;
const patchSchema = createSchema.partial();

export const listRegistros = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user?.id) { res.status(401).json({ message: 'No autenticado' }); return; }
    const registros = await db
      .select()
      .from(schema.registro_actividades_usuarios)
      .where(eq(schema.registro_actividades_usuarios.usuario_id, req.user.id as number))
      .orderBy(desc(schema.registro_actividades_usuarios.fecha));
    res.json(registros);
  } catch (error) {
    console.error('Error list registros actividades:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
};

export const getRegistroById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) { res.status(400).json({ message: 'ID inválido' }); return; }
    if (!req.user?.id) { res.status(401).json({ message: 'No autenticado' }); return; }
    const [registro] = await db
      .select()
      .from(schema.registro_actividades_usuarios)
      .where(and(eq(schema.registro_actividades_usuarios.id, id), eq(schema.registro_actividades_usuarios.usuario_id, req.user.id as number)))
      .limit(1);
    if (!registro) { res.status(404).json({ message: 'Registro no encontrado' }); return; }
    res.json(registro);
  } catch (error) {
    console.error('Error get registro actividad:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
};

export const createRegistro = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user?.id) { res.status(401).json({ message: 'No autenticado' }); return; }
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ message: 'Datos inválidos', errors: parsed.error.errors }); return; }
    const data = parsed.data;
    const [inserted] = await db
      .insert(schema.registro_actividades_usuarios)
      .values({
        usuario_id: req.user.id as number,
        opcion_id: data.opcion_id,
        vencimiento: data.vencimiento ?? new Date(),
        fecha: data.fecha ?? new Date(),
        observaciones: data.observaciones,
      })
      .returning();
    res.status(201).json(inserted);
  } catch (error) {
    console.error('Error create registro actividad:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
};

export const updateRegistroPut = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) { res.status(400).json({ message: 'ID inválido' }); return; }
    if (!req.user?.id) { res.status(401).json({ message: 'No autenticado' }); return; }
    const parsed = putSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ message: 'Datos inválidos', errors: parsed.error.errors }); return; }
    const data = parsed.data;
    const [existing] = await db
      .select({ id: schema.registro_actividades_usuarios.id })
      .from(schema.registro_actividades_usuarios)
      .where(and(eq(schema.registro_actividades_usuarios.id, id), eq(schema.registro_actividades_usuarios.usuario_id, req.user.id as number)))
      .limit(1);
    if (!existing) { res.status(404).json({ message: 'Registro no encontrado' }); return; }
    const [updated] = await db
      .update(schema.registro_actividades_usuarios)
      .set({
        opcion_id: data.opcion_id,
        vencimiento: data.vencimiento ?? new Date(),
        fecha: data.fecha ?? new Date(),
        observaciones: data.observaciones,
        updated_at: new Date(),
      })
      .where(eq(schema.registro_actividades_usuarios.id, id))
      .returning();
    res.json(updated);
  } catch (error) {
    console.error('Error put registro actividad:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
};

export const updateRegistroPatch = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) { res.status(400).json({ message: 'ID inválido' }); return; }
    if (!req.user?.id) { res.status(401).json({ message: 'No autenticado' }); return; }
    const parsed = patchSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ message: 'Datos inválidos', errors: parsed.error.errors }); return; }
    const data = parsed.data;
    const [existing] = await db
      .select({ id: schema.registro_actividades_usuarios.id })
      .from(schema.registro_actividades_usuarios)
      .where(and(eq(schema.registro_actividades_usuarios.id, id), eq(schema.registro_actividades_usuarios.usuario_id, req.user.id as number)))
      .limit(1);
    if (!existing) { res.status(404).json({ message: 'Registro no encontrado' }); return; }
    const payload: any = { updated_at: new Date() };
    if (data.opcion_id !== undefined) payload.opcion_id = data.opcion_id;
    if (data.vencimiento !== undefined) payload.vencimiento = data.vencimiento;
    if (data.fecha !== undefined) payload.fecha = data.fecha;
    if (data.observaciones !== undefined) payload.observaciones = data.observaciones;
    const [updated] = await db
      .update(schema.registro_actividades_usuarios)
      .set(payload)
      .where(eq(schema.registro_actividades_usuarios.id, id))
      .returning();
    res.json(updated);
  } catch (error) {
    console.error('Error patch registro actividad:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
};

export const deleteRegistro = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) { res.status(400).json({ message: 'ID inválido' }); return; }
    if (!req.user?.id) { res.status(401).json({ message: 'No autenticado' }); return; }
    const [existing] = await db
      .select({ id: schema.registro_actividades_usuarios.id })
      .from(schema.registro_actividades_usuarios)
      .where(and(eq(schema.registro_actividades_usuarios.id, id), eq(schema.registro_actividades_usuarios.usuario_id, req.user.id as number)))
      .limit(1);
    if (!existing) { res.status(404).json({ message: 'Registro no encontrado' }); return; }
    await db.delete(schema.registro_actividades_usuarios).where(eq(schema.registro_actividades_usuarios.id, id));
    res.json({ message: 'Registro eliminado' });
  } catch (error) {
    console.error('Error delete registro actividad:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
};

const completarSchema = z.object({
  reflexiones_estudiante: z.string().optional(),
});

export const completarActividad = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) { res.status(400).json({ message: 'ID inválido' }); return; }
    if (!req.user?.id) { res.status(401).json({ message: 'No autenticado' }); return; }

    const parsed = completarSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ message: 'Datos inválidos', errors: parsed.error.errors }); return; }

    const [existing] = await db
      .select()
      .from(schema.registro_actividades_usuarios)
      .where(
        and(
          eq(schema.registro_actividades_usuarios.id, id),
          eq(schema.registro_actividades_usuarios.usuario_id, req.user.id as number),
          schema.registro_actividades_usuarios.deleted_at === undefined ? undefined : eq(schema.registro_actividades_usuarios.id, id)
        )
      )
      .limit(1);

    if (!existing) {
      res.status(404).json({ message: 'Actividad no encontrada' });
      return;
    }

    const [completada] = await db
      .update(schema.registro_actividades_usuarios)
      .set({
        estado: 'completada',
        fecha_completada: new Date(),
        reflexiones_estudiante: parsed.data.reflexiones_estudiante?.trim() || null,
        updated_at: new Date(),
      })
      .where(eq(schema.registro_actividades_usuarios.id, id))
      .returning();

    res.json({
      message: 'Actividad completada exitosamente',
      actividad: completada,
    });
  } catch (error) {
    console.error('Error completar actividad:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
};

export const listarActividadesAsignadasPsicologo = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user?.id) { res.status(401).json({ message: 'No autenticado' }); return; }

    const actividades = await db
      .select({
        id: schema.registro_actividades_usuarios.id,
        fecha: schema.registro_actividades_usuarios.fecha,
        vencimiento: schema.registro_actividades_usuarios.vencimiento,
        observaciones: schema.registro_actividades_usuarios.observaciones,
        asignado_por_id: schema.registro_actividades_usuarios.asignado_por_id,
        titulo_personalizado: schema.registro_actividades_usuarios.titulo_personalizado,
        descripcion_personalizada: schema.registro_actividades_usuarios.descripcion_personalizada,
        dimension_objetivo: schema.registro_actividades_usuarios.dimension_objetivo,
        prioridad: schema.registro_actividades_usuarios.prioridad,
        estado: schema.registro_actividades_usuarios.estado,
        fecha_completada: schema.registro_actividades_usuarios.fecha_completada,
        reflexiones_estudiante: schema.registro_actividades_usuarios.reflexiones_estudiante,
        opcion: {
          id: schema.opciones_registro_actividades.id,
          nombre: schema.opciones_registro_actividades.nombre,
          descripcion: schema.opciones_registro_actividades.descripcion,
          url_imagen: schema.opciones_registro_actividades.url_imagen,
        },
      })
      .from(schema.registro_actividades_usuarios)
      .leftJoin(
        schema.opciones_registro_actividades,
        eq(schema.registro_actividades_usuarios.opcion_id, schema.opciones_registro_actividades.id)
      )
      .where(
        and(
          eq(schema.registro_actividades_usuarios.usuario_id, req.user.id as number),
          schema.registro_actividades_usuarios.asignado_por_id !== null ? eq(schema.registro_actividades_usuarios.usuario_id, req.user.id as number) : undefined
        )
      )
      .orderBy(desc(schema.registro_actividades_usuarios.vencimiento));

    // Filtrar solo las asignadas por psicólogo
    const asignadas = actividades.filter((a) => a.asignado_por_id !== null);

    res.json(asignadas);
  } catch (error) {
    console.error('Error listar actividades asignadas psicologo:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
};