import { Response } from 'express';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db';
import * as schema from '../db/schema';
import { AuthRequest } from '../middleware/auth.middleware';

const registrarTecnicaSchema = z.object({
  opcion_id: z.number().int().positive(),
  observaciones: z.string().optional(),
});

const PALABRAS_TECNICA = ['relaj', 'respir', 'medit', 'yoga', 'mindfulness', 'estiram'];

const esTecnicaRelajacion = (nombre: string, descripcion?: string | null): boolean => {
  const contenido = `${nombre} ${descripcion ?? ''}`.toLowerCase();
  return PALABRAS_TECNICA.some((palabra) => contenido.includes(palabra));
};

export const listarTecnicasRelajacion = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const opciones = await db.select().from(schema.opciones_registro_actividades);
    const tecnicas = opciones.filter((opcion) => esTecnicaRelajacion(opcion.nombre, opcion.descripcion));

    res.json({
      total: tecnicas.length,
      tecnicas,
    });
  } catch (error) {
    console.error('Error listando técnicas de relajación:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
};

export const registrarPracticaTecnica = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ message: 'Usuario no autenticado' });
      return;
    }

    const parsed = registrarTecnicaSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: 'Datos inválidos', errors: parsed.error.errors });
      return;
    }

    const { opcion_id, observaciones } = parsed.data;

    const [opcion] = await db
      .select()
      .from(schema.opciones_registro_actividades)
      .where(eq(schema.opciones_registro_actividades.id, opcion_id))
      .limit(1);

    if (!opcion) {
      res.status(404).json({ message: 'Técnica no encontrada' });
      return;
    }

    if (!esTecnicaRelajacion(opcion.nombre, opcion.descripcion)) {
      res.status(400).json({ message: 'La actividad seleccionada no corresponde a una técnica de relajación' });
      return;
    }

    const [registro] = await db
      .insert(schema.registro_actividades_usuarios)
      .values({
        usuario_id: req.user.id,
        opcion_id,
        fecha: new Date(),
        vencimiento: new Date(),
        observaciones,
      })
      .returning();

    res.status(201).json({
      message: 'Técnica de relajación registrada correctamente',
      data: registro,
    });
  } catch (error) {
    console.error('Error registrando técnica de relajación:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
};
