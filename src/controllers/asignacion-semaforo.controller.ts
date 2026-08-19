import { Response } from 'express';
import { z } from 'zod';
import { desc, eq } from 'drizzle-orm';
import { db } from '../db';
import * as schema from '../db/schema';
import { AuthRequest } from '../middleware/auth.middleware';

const asignarSemaforoSchema = z.object({
  puntaje_manual: z.number().min(0).max(100).optional(),
});

const calcularEstadoSemaforo = (puntaje: number): 'verde' | 'amarillo' | 'rojo' => {
  if (puntaje >= 70) return 'rojo';
  if (puntaje >= 40) return 'amarillo';
  return 'verde';
};

export const asignarSemaforoUsuarioAutenticado = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ message: 'Usuario no autenticado' });
      return;
    }

    const parsed = asignarSemaforoSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: 'Datos inválidos', errors: parsed.error.errors });
      return;
    }

    const usuarioId = req.user.id;
    const puntajeManual = parsed.data.puntaje_manual;

    const [ultimaEvaluacion] = await db
      .select()
      .from(schema.evaluaciones)
      .where(eq(schema.evaluaciones.usuario_id, usuarioId))
      .orderBy(desc(schema.evaluaciones.fecha))
      .limit(1);

    const registrosEmocionales = await db
      .select({ puntaje: schema.registro_emocional.puntaje })
      .from(schema.registro_emocional)
      .where(eq(schema.registro_emocional.usuario_id, usuarioId))
      .orderBy(desc(schema.registro_emocional.fecha))
      .limit(7);

    const puntajeEvaluacion = puntajeManual ?? ultimaEvaluacion?.puntaje_total ?? null;
    const promedioRegistro = registrosEmocionales.length > 0
      ? registrosEmocionales.reduce((acc, item) => acc + item.puntaje, 0) / registrosEmocionales.length
      : null;
    const puntajeRegistroNormalizado = promedioRegistro === null
      ? null
      : Math.max(0, Math.min(100, promedioRegistro * 20));

    let puntajeFinal: number | null = null;
    if (puntajeEvaluacion !== null && puntajeRegistroNormalizado !== null) {
      puntajeFinal = Math.round((puntajeEvaluacion * 0.7) + (puntajeRegistroNormalizado * 0.3));
    } else if (puntajeEvaluacion !== null) {
      puntajeFinal = Math.round(puntajeEvaluacion);
    } else if (puntajeRegistroNormalizado !== null) {
      puntajeFinal = Math.round(puntajeRegistroNormalizado);
    }

    if (puntajeFinal === null) {
      res.status(400).json({ message: 'No hay información suficiente para asignar semáforo' });
      return;
    }

    const estado = calcularEstadoSemaforo(puntajeFinal);
    const observacionSemaforo = `Asignación automática de semáforo: ${estado} (puntaje ${puntajeFinal})`;

    let evaluacionActualizada;

    if (ultimaEvaluacion) {
      const observacionesCombinadas = [ultimaEvaluacion.observaciones, observacionSemaforo]
        .filter(Boolean)
        .join(' | ');

      [evaluacionActualizada] = await db
        .update(schema.evaluaciones)
        .set({
          puntaje_total: puntajeFinal,
          estado_semaforo: estado,
          observaciones: observacionesCombinadas,
          updated_at: new Date(),
        })
        .where(eq(schema.evaluaciones.id, ultimaEvaluacion.id))
        .returning();
    } else {
      [evaluacionActualizada] = await db
        .insert(schema.evaluaciones)
        .values({
          usuario_id: usuarioId,
          puntaje_total: puntajeFinal,
          estado_semaforo: estado,
          observaciones: observacionSemaforo,
        })
        .returning();
    }

    res.json({
      message: 'Semáforo asignado correctamente',
      data: {
        usuario_id: usuarioId,
        estado_semaforo: estado,
        puntaje_total: puntajeFinal,
        evaluacion: evaluacionActualizada,
      },
    });
  } catch (error) {
    console.error('Error asignando semáforo:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
};
