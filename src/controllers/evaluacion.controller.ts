import { Request, Response } from 'express';
import { z } from 'zod';
import { eq, desc, isNull, inArray, and } from 'drizzle-orm';
import { AuthRequest } from '../middleware/auth.middleware';
import { analizarRespuestasOllama, construirDimensionesEvaluacionClasica } from '../services/ollama.service';
import { db } from '../db';
import * as schema from '../db/schema';

// Validation schema for evaluation responses
const evaluacionSchema = z.object({
  respuestas: z.array(
    z.object({
      pregunta_id: z.number(),
      respuesta: z.number().min(1).max(5),
    })
  ),
  observaciones: z.string().optional(),
});

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

    // Ensure respuestas have the correct type
    const respuestasTyped = respuestas as { pregunta_id: number; respuesta: number; }[];

    let analisisResult;

    try {
      console.log('Usando Ollama para análisis...');
      analisisResult = await analizarRespuestasOllama(preguntas, respuestasTyped);
    } catch (aiError) {
      console.error('Error en análisis IA:', aiError);
      
      // Algoritmo avanzado de semáforo para evitar filtraciones
      const rawScore = respuestasTyped.reduce((sum, resp) => {
        const pregunta = preguntas.find(p => p.id === resp.pregunta_id);
        return sum + (resp.respuesta * (pregunta?.peso || 1));
      }, 0);

      // Calcular estadísticas adicionales
      let respuestasAltas = 0; // Contador de respuestas 4-5
      let respuestasBajas = 0; // Contador de respuestas 1-2
      const totalPreguntas = respuestasTyped.length;
      
      respuestasTyped.forEach(resp => {
        if (resp.respuesta >= 4) respuestasAltas++;
        if (resp.respuesta <= 2) respuestasBajas++;
      });
      
      const porcentajeAltas = (respuestasAltas / totalPreguntas) * 100;
      const puntajePromedio = rawScore / totalPreguntas;
      
      // Criterios más estrictos para evitar filtraciones
      let estado: 'verde' | 'amarillo' | 'rojo' = 'verde';
      
      if (rawScore > 50 && porcentajeAltas > 60) {
        // Solo ROJO si puntaje alto Y más del 60% de respuestas son altas (4-5)
        estado = 'rojo';
      } else if (rawScore > 35 || porcentajeAltas > 40) {
        // AMARILLO si puntaje moderado O más del 40% de respuestas altas
        estado = 'amarillo';
      } else if (rawScore > 20 || porcentajeAltas > 25) {
        // AMARILLO suave si hay indicadores moderados
        estado = 'amarillo';
      } else {
        // VERDE por defecto
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
        puntaje: Math.min(rawScore * 2, 100),
        observaciones: `Evaluación realizada con sistema de respaldo avanzado. Puntaje: ${rawScore}, Respuestas altas: ${porcentajeAltas.toFixed(1)}%`,
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

    res.status(201).json({
      message: 'Evaluación creada exitosamente',
      evaluacion: {
        ...nuevaEvaluacion,
        dimensiones: analisisResult.dimensiones,
      },
      analisis: analisisResult
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

    const evaluacionesConDimensiones = evaluaciones.map((evaluacion) => ({
      ...evaluacion,
      dimensiones: dimensionesPorEvaluacion.get(evaluacion.id) ?? [],
    }));

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

    res.json({
      ...evaluacion,
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