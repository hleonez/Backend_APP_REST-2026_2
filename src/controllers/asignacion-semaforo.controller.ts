import { Response } from 'express';
import { z } from 'zod';
import { desc, eq } from 'drizzle-orm';
import { db } from '../db';
import * as schema from '../db/schema';
import { AuthRequest } from '../middleware/auth.middleware';
import {
  agruparPuntajesPorDimension,
  construirSubcategoriaPrincipal,
  determinarDimensionDominante,
  DIMENSION_GENERAL,
} from '../shared/utils/semaforo-dimensiones.utils';

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

    // Fase 5: se trae también la `categoria` (dimensión) de cada pregunta de
    // registro emocional respondida, para poder calcular el detalle por
    // dimensión con la misma muestra usada en el puntaje combinado.
    const registrosEmocionales = await db
      .select({
        puntaje: schema.registro_emocional.puntaje,
        categoria: schema.preguntas_registro_emocional.categoria,
      })
      .from(schema.registro_emocional)
      .leftJoin(
        schema.preguntas_registro_emocional,
        eq(schema.registro_emocional.pregunta_id, schema.preguntas_registro_emocional.id),
      )
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

    // Fase 5: puntaje y nivel por dimensión, calculados a partir del
    // registro emocional (escala 0-4 -> normalizada a 0-100), y dimensión
    // dominante (peor nivel) usada para construir la subcategoría principal.
    const itemsPorDimension = registrosEmocionales.map((item) => ({
      dimension: item.categoria || DIMENSION_GENERAL,
      puntaje: Math.max(0, Math.min(100, (item.puntaje / 4) * 100)),
    }));
    const dimensionesCalculadas = agruparPuntajesPorDimension(itemsPorDimension);
    const dimensionDominante = determinarDimensionDominante(dimensionesCalculadas);
    const subcategoriaPrincipal = dimensionDominante
      ? construirSubcategoriaPrincipal(estado, dimensionDominante.dimension)
      : null;

    const { evaluacionActualizada, dimensionesPersistidas } = await db.transaction(async (tx) => {
      let evaluacion;

      if (ultimaEvaluacion) {
        const observacionesCombinadas = [ultimaEvaluacion.observaciones, observacionSemaforo]
          .filter(Boolean)
          .join(' | ');

        [evaluacion] = await tx
          .update(schema.evaluaciones)
          .set({
            puntaje_total: puntajeFinal,
            estado_semaforo: estado,
            observaciones: observacionesCombinadas,
            // Si no hay datos nuevos de registro emocional para recalcular
            // dimensiones, conservamos la subcategoría previa en vez de
            // borrarla.
            subcategoria_principal: subcategoriaPrincipal ?? ultimaEvaluacion.subcategoria_principal,
            updated_at: new Date(),
          })
          .where(eq(schema.evaluaciones.id, ultimaEvaluacion.id))
          .returning();
      } else {
        [evaluacion] = await tx
          .insert(schema.evaluaciones)
          .values({
            usuario_id: usuarioId,
            puntaje_total: puntajeFinal,
            estado_semaforo: estado,
            observaciones: observacionSemaforo,
            subcategoria_principal: subcategoriaPrincipal,
          })
          .returning();
      }

      // Solo tocamos `semaforo_dimensiones` si hay datos nuevos que
      // persistir; de lo contrario dejamos intactas las filas existentes
      // (por ejemplo, cuando el usuario aún no ha hecho registro emocional).
      if (dimensionesCalculadas.length > 0) {
        await tx
          .update(schema.semaforo_dimensiones)
          .set({ deleted_at: new Date() })
          .where(
            eq(schema.semaforo_dimensiones.evaluacion_id, evaluacion.id),
          );

        await tx.insert(schema.semaforo_dimensiones).values(
          dimensionesCalculadas.map((d) => ({
            evaluacion_id: evaluacion.id,
            dimension: d.dimension,
            puntaje: d.puntaje,
            nivel: d.nivel,
          })),
        );
      }

      return { evaluacionActualizada: evaluacion, dimensionesPersistidas: dimensionesCalculadas };
    });

    res.json({
      message: 'Semáforo asignado correctamente',
      data: {
        usuario_id: usuarioId,
        estado_semaforo: estado,
        puntaje_total: puntajeFinal,
        subcategoria_principal: evaluacionActualizada.subcategoria_principal,
        dimensiones: dimensionesPersistidas,
        evaluacion: evaluacionActualizada,
      },
    });
  } catch (error) {
    console.error('Error asignando semáforo:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
};
