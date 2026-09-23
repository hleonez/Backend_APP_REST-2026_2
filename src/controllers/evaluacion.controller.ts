import { Request, Response } from 'express';
import { z } from 'zod';
import { eq, desc, isNull, inArray, and } from 'drizzle-orm';
import { AuthRequest } from '../middleware/auth.middleware';
import { analizarRespuestasOllama, construirDimensionesEvaluacionClasica } from '../services/ollama.service';
import { obtenerRecomendacionesPorEstado } from '../shared/utils/semaforo-dimensiones.utils';
import { db } from '../db';
import * as schema from '../db/schema';


// Validation schema for evaluation responses
const evaluacionSchema = z.object({
  respuestas: z.array(
    z.object({
      pregunta_id: z.number(),
      respuesta: z.number().min(0).max(5),
    })
  ),
  observaciones: z.string().optional(),
});

/**
 * La encuesta diaria (registro emocional) usa una escala Likert 0-4 donde
 * 0 = "Muy mal" (peor) y 4 = "Excelente" (mejor), mientras la evaluación
 * interna usa 1-5 donde 5 = mayor gravedad. Se invierte la escala para que
 * el semáforo sea coherente: "Muy mal" -> 5 (rojo), "Excelente" -> 1 (verde).
 * Valores fuera de 0-4 (escala clásica 1-5) se conservan sin cambios.
 */
const normalizarRespuestaLikert = (respuesta: number): number => {
  if (respuesta >= 0 && respuesta <= 4) {
    return 5 - respuesta;
  }
  return respuesta;
};

/**
 * Get all available questions for evaluations
 */
export const getPreguntas = async (_req: Request, res: Response): Promise<void> => {
  try {
    const preguntas = await db.select().from(schema.preguntas);
    res.json(preguntas);
  } catch (error) {
    console.error('Error fetching questions:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
};

/**
 * Create a new evaluation with AI analysis
 */
export const crearEvaluacion = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ message: 'Usuario no autenticado' });
      return;
    }

    // Validate request body
    const validationResult = evaluacionSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      res.status(400).json({ 
        message: 'Datos inválidos', 
        errors: validationResult.error.errors 
      });
      return;
    }

    const { respuestas, observaciones } = validationResult.data;

    // Get questions for analysis
    const preguntas = await db.select().from(schema.preguntas);

    // Ensure respuestas have the correct type (escala diaria 0-4 -> 1-5)
    const respuestasTyped = respuestas.map((r) => ({
      pregunta_id: r.pregunta_id,
      respuesta: normalizarRespuestaLikert(r.respuesta),
    }));

    let analisisResult;

    try {
      console.log('Usando Ollama para análisis...');
      analisisResult = await analizarRespuestasOllama(preguntas, respuestasTyped);
    } catch (aiError) {
      console.error('Error en análisis IA:', aiError);
      
      const rawScore = respuestasTyped.reduce((sum, resp) => {
        const pregunta = preguntas.find(p => p.id === resp.pregunta_id);
        return sum + (resp.respuesta * (pregunta?.peso || 1));
      }, 0);

      const totalPreguntas = respuestasTyped.length;
      let respuestasAltas = 0; // Contador de respuestas 4-5
      let respuestasBajas = 0; // Contador de respuestas 1-2
      
      respuestasTyped.forEach(resp => {
        if (resp.respuesta >= 4) respuestasAltas++;
        if (resp.respuesta <= 2) respuestasBajas++;
      });
      
      const minScore = totalPreguntas;
      const maxScore = totalPreguntas * 5;
      const puntajeNormalizado = totalPreguntas > 0
        ? Math.round(Math.max(0, Math.min(100, ((rawScore - minScore) / (maxScore - minScore)) * 100)))
        : 0;
      const porcentajeAltas = totalPreguntas > 0 ? (respuestasAltas / totalPreguntas) * 100 : 0;
      
      // Criterios de semáforo coherentes:
      // Verde: 0-39 | Amarillo: 40-69 (ej. 'Normal' = 50) | Rojo: >= 70
      let estado: 'verde' | 'amarillo' | 'rojo' = 'verde';
      
      if (puntajeNormalizado >= 70 || porcentajeAltas >= 60) {
        estado = 'rojo';
      } else if (puntajeNormalizado >= 40 || porcentajeAltas >= 30) {
        estado = 'amarillo';
      } else {
        estado = 'verde';
      }

      // Fase 5: detalle por dimensión y subcategoría principal, calculados
      // de forma determinista igual que en `analizarRespuestasOllama`.
      const { dimensiones, subcategoria_principal } = construirDimensionesEvaluacionClasica(
        preguntas,
        respuestasTyped,
        estado
      );

      analisisResult = {
        estado,
        puntaje: puntajeNormalizado,
        observaciones: `Evaluación realizada con sistema de respaldo seguro. Estado clasificado como ${estado}.`,
        recomendaciones: [
          'Mantén rutinas saludables de sueño y ejercicio',
          'Busca apoyo en familiares y amigos cercanos',
          'Considera hablar con un profesional si persisten las molestias'
        ],
        dimensiones,
        subcategoria_principal,
      };
    }


    // Create evaluation in database (map to schema)
    const observacionesTexto = [
      analisisResult.observaciones,
      observaciones ? `Observaciones usuario: ${observaciones}` : null,
    ].filter(Boolean).join(' | ');

    const pesoPorPregunta = new Map(preguntas.map(p => [p.id, p.peso]));
    const respuestasAInsertar = respuestasTyped.map((r) => ({
      pregunta_id: r.pregunta_id,
      respuesta: r.respuesta,
      puntaje_calculado: r.respuesta * (pesoPorPregunta.get(r.pregunta_id) || 1),
    }));

    // Fase 5: persistir la evaluación, sus respuestas y el detalle por
    // dimensión en una sola transacción para mantener todo consistente.
    const nuevaEvaluacion = await db.transaction(async (tx) => {
      const [evaluacionCreada] = await tx.insert(schema.evaluaciones)
        .values({
          usuario_id: req.user!.id,
          puntaje_total: analisisResult.puntaje,
          estado_semaforo: analisisResult.estado,
          observaciones: observacionesTexto,
          subcategoria_principal: analisisResult.subcategoria_principal ?? null,
        })
        .returning();

      if (respuestasAInsertar.length > 0) {
        await tx.insert(schema.respuestas).values(
          respuestasAInsertar.map((r) => ({ ...r, evaluacion_id: evaluacionCreada.id }))
        );
      }

      if (analisisResult.dimensiones.length > 0) {
        await tx.insert(schema.semaforo_dimensiones).values(
          analisisResult.dimensiones.map((d) => ({
            evaluacion_id: evaluacionCreada.id,
            dimension: d.dimension,
            puntaje: d.puntaje,
            nivel: d.nivel,
          }))
        );
      }

      return evaluacionCreada;
    });

    const recs = analisisResult.recomendaciones && analisisResult.recomendaciones.length > 0
      ? analisisResult.recomendaciones
      : obtenerRecomendacionesPorEstado(analisisResult.estado, analisisResult.subcategoria_principal);

    const evaluacionPayload = {
      ...nuevaEvaluacion,
      estado: nuevaEvaluacion.estado_semaforo,
      estado_semaforo: nuevaEvaluacion.estado_semaforo,
      puntaje: nuevaEvaluacion.puntaje_total,
      puntaje_total: nuevaEvaluacion.puntaje_total,
      recomendaciones: recs,
      sugerencias: recs,
      dimensiones: analisisResult.dimensiones,
    };

    res.status(201).json({
      message: 'Evaluación creada exitosamente',
      evaluacion: evaluacionPayload,
      analisis: {
        ...analisisResult,
        estado: analisisResult.estado,
        estado_semaforo: analisisResult.estado,
        recomendaciones: recs,
        sugerencias: recs,
      },
      estado: analisisResult.estado,
      estado_semaforo: analisisResult.estado,
      puntaje: analisisResult.puntaje,
      puntaje_total: analisisResult.puntaje,
      recomendaciones: recs,
      sugerencias: recs,
      dimensiones: analisisResult.dimensiones,
      subcategoria_principal: analisisResult.subcategoria_principal,
    });

  } catch (error) {
    console.error('Error creating evaluation:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
};

/**
 * Get user evaluations
 */
export const getEvaluaciones = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ message: 'Usuario no autenticado' });
      return;
    }

    const evaluaciones = await db
      .select()
      .from(schema.evaluaciones)
      .where(eq(schema.evaluaciones.usuario_id, req.user.id as number))
      .orderBy(desc(schema.evaluaciones.fecha));

    // Fase 5: adjuntar el detalle por dimensión de cada evaluación
    // (`subcategoria_principal` ya viene incluido por ser columna propia
    // de `evaluaciones`).
    const evaluacionIds = evaluaciones.map((e) => e.id);
    const dimensionesPorEvaluacion = await obtenerDimensionesPorEvaluaciones(evaluacionIds);

    const evaluacionesConDimensiones = evaluaciones.map((evaluacion) => {
      const recs = obtenerRecomendacionesPorEstado(
        evaluacion.estado_semaforo,
        evaluacion.subcategoria_principal,
      );

      return {
        ...evaluacion,
        estado: evaluacion.estado_semaforo,
        estado_semaforo: evaluacion.estado_semaforo,
        puntaje: evaluacion.puntaje_total,
        puntaje_total: evaluacion.puntaje_total,
        recomendaciones: recs,
        sugerencias: recs,
        dimensiones: dimensionesPorEvaluacion.get(evaluacion.id) ?? [],
      };
    });

    res.json(evaluacionesConDimensiones);
  } catch (error) {
    console.error('Error fetching evaluations:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
};

/**
 * Get specific evaluation by ID
 */
export const getEvaluacion = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ message: 'Usuario no autenticado' });
      return;
    }

    const evaluacionId = parseInt(req.params.id);
    
    if (isNaN(evaluacionId)) {
      res.status(400).json({ message: 'ID de evaluación inválido' });
      return;
    }

    const [evaluacion] = await db
      .select()
      .from(schema.evaluaciones)
      .where(eq(schema.evaluaciones.id, evaluacionId))
      .limit(1);

    if (!evaluacion) {
      res.status(404).json({ message: 'Evaluación no encontrada' });
      return;
    }

    // Check if evaluation belongs to user
    if (evaluacion.usuario_id !== req.user.id) {
      res.status(403).json({ message: 'No tienes acceso a esta evaluación' });
      return;
    }

    // Fase 5: adjuntar el detalle por dimensión de la evaluación
    // (`subcategoria_principal` ya viene incluido por ser columna propia
    // de `evaluaciones`).
    const dimensionesPorEvaluacion = await obtenerDimensionesPorEvaluaciones([evaluacion.id]);
    const recs = obtenerRecomendacionesPorEstado(
      evaluacion.estado_semaforo,
      evaluacion.subcategoria_principal,
    );

    res.json({
      ...evaluacion,
      estado: evaluacion.estado_semaforo,
      estado_semaforo: evaluacion.estado_semaforo,
      puntaje: evaluacion.puntaje_total,
      puntaje_total: evaluacion.puntaje_total,
      recomendaciones: recs,
      sugerencias: recs,
      dimensiones: dimensionesPorEvaluacion.get(evaluacion.id) ?? [],
    });
  } catch (error) {
    console.error('Error fetching evaluation:', error);
    res.status(500).json({ message: 'Error en el servidor' });

  }
};

/**
 * Fase 5: obtiene el detalle por dimensión (`semaforo_dimensiones`) para un
 * conjunto de evaluaciones, agrupado por `evaluacion_id`. Ignora filas
 * borradas lógicamente (soft-delete).
 */
const obtenerDimensionesPorEvaluaciones = async (
  evaluacionIds: number[]
): Promise<Map<number, { id: number; dimension: string; puntaje: number; nivel: string }[]>> => {
  const resultado = new Map<number, { id: number; dimension: string; puntaje: number; nivel: string }[]>();

  if (evaluacionIds.length === 0) {
    return resultado;
  }

  const filas = await db
    .select({
      id: schema.semaforo_dimensiones.id,
      evaluacion_id: schema.semaforo_dimensiones.evaluacion_id,
      dimension: schema.semaforo_dimensiones.dimension,
      puntaje: schema.semaforo_dimensiones.puntaje,
      nivel: schema.semaforo_dimensiones.nivel,
    })
    .from(schema.semaforo_dimensiones)
    .where(
      and(
        inArray(schema.semaforo_dimensiones.evaluacion_id, evaluacionIds),
        isNull(schema.semaforo_dimensiones.deleted_at),
      ),
    );

  for (const fila of filas) {
    if (fila.evaluacion_id === null) continue;

    const lista = resultado.get(fila.evaluacion_id) ?? [];
    lista.push({
      id: fila.id,
      dimension: fila.dimension,
      puntaje: fila.puntaje,
      nivel: fila.nivel,
    });
    resultado.set(fila.evaluacion_id, lista);
  }

  return resultado;
};