import { and, asc, eq, inArray, isNull, desc, gte } from 'drizzle-orm';
import { db } from '../db';
import * as schema from '../db/schema';
import { getTodayIso } from '../shared/utils/fechas.utils';
import {
  agruparPuntajesPorDimension,
  construirSubcategoriaPrincipal,
  determinarDimensionDominante,
  calcularNivelPorPuntaje,
  obtenerRecomendacionesPorEstado,
  DIMENSION_GENERAL,
} from '../shared/utils/semaforo-dimensiones.utils';


type SaveRegistroEmocionalInput = {
  usuario_id: number;
  respuestas: Array<{
    pregunta_id: number;
    opcion_id: number;
  }>;
};

const parseDdMmYyyyToIso = (date: string): string | null => {
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(date);
  if (!match) return null;

  const [, day, month, year] = match;
  const iso = `${year}-${month}-${day}`;
  const parsed = new Date(`${iso}T00:00:00.000Z`);

  if (Number.isNaN(parsed.getTime())) return null;
  if (parsed.toISOString().slice(0, 10) !== iso) return null;

  return iso;
};

type PreguntaWithOpciones = {
  id: number;
  texto: string;
  categoria: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  opciones: Array<{
    id: number;
    nombre: string;
    descripcion: string | null;
    url_imagen: string;
    puntaje: number;
    is_active: boolean;
  }>;
};

export const getPreguntasRegistroEmocionalService = async () => {
  const rows = await db
    .select({
      id: schema.preguntas_registro_emocional.id,
      texto: schema.preguntas_registro_emocional.texto,
      categoria: schema.preguntas_registro_emocional.categoria,
      is_active: schema.preguntas_registro_emocional.is_active,
      created_at: schema.preguntas_registro_emocional.created_at,
      updated_at: schema.preguntas_registro_emocional.updated_at,
      opcion_id: schema.opciones_registro_emocional.id,
      opcion_nombre: schema.opciones_registro_emocional.nombre,
      opcion_descripcion: schema.opciones_registro_emocional.descripcion,
      opcion_url_imagen: schema.opciones_registro_emocional.url_imagen,
      opcion_puntaje: schema.opciones_registro_emocional.puntaje,
      opcion_is_active: schema.opciones_registro_emocional.is_active,
    })
    .from(schema.preguntas_registro_emocional)
    .leftJoin(
      schema.opciones_registro_emocional,
      and(
        eq(schema.opciones_registro_emocional.pregunta_id, schema.preguntas_registro_emocional.id),
        isNull(schema.opciones_registro_emocional.deleted_at),
      ),
    )
    .where(isNull(schema.preguntas_registro_emocional.deleted_at))
    .orderBy(
      asc(schema.preguntas_registro_emocional.id),
      asc(schema.opciones_registro_emocional.id),
    );

  const preguntasMap = new Map<number, PreguntaWithOpciones>();

  for (const row of rows) {
    if (!preguntasMap.has(row.id)) {
      preguntasMap.set(row.id, {
        id: row.id,
        texto: row.texto,
        categoria: row.categoria,
        is_active: row.is_active,
        created_at: row.created_at,
        updated_at: row.updated_at,
        opciones: [],
      });
    }

    if (row.opcion_id !== null) {
      if (preguntasMap.get(row.id)) {
        preguntasMap.get(row.id)?.opciones.push({
          id: row.opcion_id,
          nombre: row.opcion_nombre ?? '',
          descripcion: row.opcion_descripcion ?? '',
          url_imagen: row.opcion_url_imagen ?? '',
          puntaje: row.opcion_puntaje ?? 0,
          is_active: row.opcion_is_active ?? false,
        });
      }
    }
  }

  return Array.from(preguntasMap.values());
};

export const getPreguntasAleatoriosService = async () => {
  // Obtener todas las preguntas
  const todasLasPreguntas = await getPreguntasRegistroEmocionalService();
  
  // Si hay 7 o menos preguntas, retornar todas
  if (todasLasPreguntas.length <= 7) {
    return todasLasPreguntas;
  }
  
  // Seleccionar 7 preguntas aleatorias
  const preguntasAleatorias: typeof todasLasPreguntas = [];
  const indices = new Set<number>();
  
  while (preguntasAleatorias.length < 5) {
    const indiceAleatorio = Math.floor(Math.random() * todasLasPreguntas.length);
    if (!indices.has(indiceAleatorio)) {
      indices.add(indiceAleatorio);
      preguntasAleatorias.push(todasLasPreguntas[indiceAleatorio]);
    }
  }
  
  return preguntasAleatorias;
};

export const getPreguntasAdaptativasService = async (usuarioId?: number) => {
  const todasLasPreguntas = await getPreguntasRegistroEmocionalService();

  // Helper para mezclar un array
  const shuffle = <T>(array: T[]) => array.sort(() => 0.5 - Math.random());

  // Si no hay usuario, retornamos 5 preguntas balanceadas de 5 dimensiones diferentes
  if (!usuarioId) {
    const categorias = [...new Set(todasLasPreguntas.map(p => p.categoria))];
    const categoriasSeleccionadas = shuffle(categorias).slice(0, 5);
    const preguntas = categoriasSeleccionadas.map(cat => {
      const preguntasCat = todasLasPreguntas.filter(p => p.categoria === cat);
      return shuffle(preguntasCat)[0];
    });
    // Si por alguna razón hay menos de 5 categorías, rellenamos
    while (preguntas.length < 5 && preguntas.length < todasLasPreguntas.length) {
      const remaining = todasLasPreguntas.filter(p => !preguntas.find(sp => sp.id === p.id));
      if (remaining.length > 0) {
        preguntas.push(shuffle(remaining)[0]);
      } else {
        break;
      }
    }
    return shuffle(preguntas);
  }

  // 1. Obtener dimensión dominante
  let dimensionDominante: string | null = null;
  
  const ultimaEvaluacion = await db.query.evaluaciones.findFirst({
    where: eq(schema.evaluaciones.usuario_id, usuarioId),
    orderBy: [desc(schema.evaluaciones.created_at)],
  });

  if (ultimaEvaluacion && ultimaEvaluacion.subcategoria_principal) {
    // subcategoria_principal suele tener el formato "color_dimension" ej "rojo_ansiedad"
    const partes = ultimaEvaluacion.subcategoria_principal.split('_');
    dimensionDominante = partes.length > 1 ? partes.slice(1).join('_') : partes[0];
  } else {
    // Inferir peor dimensión de los últimos 7 días
    const hace7Dias = new Date();
    hace7Dias.setDate(hace7Dias.getDate() - 7);
    
    const registrosRecientes = await db
      .select({
        puntaje: schema.registro_emocional.puntaje,
        categoria: schema.preguntas_registro_emocional.categoria
      })
      .from(schema.registro_emocional)
      .innerJoin(schema.preguntas_registro_emocional, eq(schema.registro_emocional.pregunta_id, schema.preguntas_registro_emocional.id))
      .where(
        and(
          eq(schema.registro_emocional.usuario_id, usuarioId),
          gte(schema.registro_emocional.fecha, hace7Dias)
        )
      );
      
    if (registrosRecientes.length > 0) {
      const puntajesPorCategoria: Record<string, { total: number; count: number }> = {};
      for (const reg of registrosRecientes) {
        if (!puntajesPorCategoria[reg.categoria]) {
          puntajesPorCategoria[reg.categoria] = { total: 0, count: 0 };
        }
        puntajesPorCategoria[reg.categoria].total += (reg.puntaje || 0);
        puntajesPorCategoria[reg.categoria].count += 1;
      }
      
      let peorCategoria = '';
      let peorPromedio = Infinity;
      
      for (const [cat, data] of Object.entries(puntajesPorCategoria)) {
        const promedio = data.total / data.count;
        // Escala 0-4: menor puntaje = peor estado emocional
        if (promedio < peorPromedio) {
          peorPromedio = promedio;
          peorCategoria = cat;
        }
      }
      dimensionDominante = peorCategoria;
    }
  }

  // Si aún no hay dimensión dominante, elegimos una aleatoria
  if (!dimensionDominante) {
    const categorias = [...new Set(todasLasPreguntas.map(p => p.categoria))];
    dimensionDominante = shuffle(categorias)[0];
  }

  // 2. Obtener historial de preguntas respondidas en últimos 7 días
  const hace7Dias = new Date();
  hace7Dias.setDate(hace7Dias.getDate() - 7);
  
  const historial = await db
    .select({ pregunta_id: schema.registro_emocional.pregunta_id })
    .from(schema.registro_emocional)
    .where(
      and(
        eq(schema.registro_emocional.usuario_id, usuarioId),
        gte(schema.registro_emocional.fecha, hace7Dias)
      )
    );
    
  const respondidasRecientesIds = new Set(historial.map(h => h.pregunta_id));

  // Función para seleccionar N preguntas de un pool, priorizando no respondidas
  const selectQuestions = (pool: PreguntaWithOpciones[], count: number) => {
    const noRespondidas = shuffle(pool.filter(p => !respondidasRecientesIds.has(p.id)));
    const respondidas = shuffle(pool.filter(p => respondidasRecientesIds.has(p.id)));
    
    const seleccion = [...noRespondidas, ...respondidas].slice(0, count);
    return seleccion;
  };

  // 3. Seleccionar 3 preguntas de la dimensión dominante
  // (O flexibilizar el matching si la categoría en base de datos es ligeramente diferente a la de la evaluación)
  const preguntasDominantesPool = todasLasPreguntas.filter(p => 
    p.categoria.toLowerCase().includes(dimensionDominante!.toLowerCase()) || 
    dimensionDominante!.toLowerCase().includes(p.categoria.toLowerCase())
  );
  
  const preguntasDominantes = selectQuestions(preguntasDominantesPool, 3);

  // 4. Seleccionar 2 preguntas de otras dimensiones
  const otrasPreguntasPool = todasLasPreguntas.filter(p => 
    !p.categoria.toLowerCase().includes(dimensionDominante!.toLowerCase()) &&
    !dimensionDominante!.toLowerCase().includes(p.categoria.toLowerCase())
  );
  
  const otrasPreguntas = selectQuestions(otrasPreguntasPool, 2);

  const resultado = [...preguntasDominantes, ...otrasPreguntas];
  
  // Si no se completaron 5 preguntas (ej. la dimensión dominante no tenía 3), rellenar
  if (resultado.length < 5) {
    const remaining = todasLasPreguntas.filter(p => !resultado.find(r => r.id === p.id));
    const fill = selectQuestions(remaining, 5 - resultado.length);
    resultado.push(...fill);
  }

  return shuffle(resultado);
};

export const getRespuestasUsuarioPorFechaService = async (usuarioId: number, fechaDdMmYyyy: string) => {
  const fechaIso = parseDdMmYyyyToIso(fechaDdMmYyyy);
  if (!fechaIso) {
    throw new Error('Formato de fecha inválido. Usa DD-MM-YYYY');
  }

  const rows = await db
    .select({
      id: schema.registro_emocional.id,
      usuario_id: schema.registro_emocional.usuario_id,
      pregunta_id: schema.registro_emocional.pregunta_id,
      opcion_id: schema.registro_emocional.opcion_id,
      puntaje: schema.registro_emocional.puntaje,
      fecha_dia: schema.registro_emocional.fecha_dia,
      fecha: schema.registro_emocional.fecha,
      observaciones: schema.registro_emocional.observaciones,
      pregunta_texto: schema.preguntas_registro_emocional.texto,
      opcion_nombre: schema.opciones_registro_emocional.nombre,
      opcion_descripcion: schema.opciones_registro_emocional.descripcion,
      opcion_url_imagen: schema.opciones_registro_emocional.url_imagen,
      opcion_puntaje: schema.opciones_registro_emocional.puntaje,
    })
    .from(schema.registro_emocional)
    .leftJoin(
      schema.preguntas_registro_emocional,
      eq(schema.registro_emocional.pregunta_id, schema.preguntas_registro_emocional.id),
    )
    .leftJoin(
      schema.opciones_registro_emocional,
      eq(schema.registro_emocional.opcion_id, schema.opciones_registro_emocional.id),
    )
    .where(
      and(
        eq(schema.registro_emocional.usuario_id, usuarioId),
        eq(schema.registro_emocional.fecha_dia, fechaIso),
        isNull(schema.registro_emocional.deleted_at),
      ),
    );

  const respuestas = rows.map((row) => ({
    id: row.id,
    usuario_id: row.usuario_id,
    puntaje: row.puntaje,
    fecha_dia: row.fecha_dia,
    fecha: row.fecha,
    observaciones: row.observaciones,
    pregunta: {
      id: row.pregunta_id,
      texto: row.pregunta_texto,
    },
    opcion: {
      id: row.opcion_id,
      nombre: row.opcion_nombre,
      descripcion: row.opcion_descripcion,
      url_imagen: row.opcion_url_imagen,
      puntaje: row.opcion_puntaje,
    },
  }));

  return {
    usuario_id: usuarioId,
    fecha: fechaDdMmYyyy,
    fecha_iso: fechaIso,
    registro_del_dia: respuestas.length > 0,
    respuestas,
  };
};

export const saveRespuestasRegistroEmocionalService = async (input: SaveRegistroEmocionalInput) => {
  const todayIso = getTodayIso();
  const opcionIds = input.respuestas.map((item) => item.opcion_id);
  const preguntaIds = input.respuestas.map((item) => item.pregunta_id);

  const [opciones, preguntas] = await Promise.all([
    db
      .select({
        id: schema.opciones_registro_emocional.id,
        pregunta_id: schema.opciones_registro_emocional.pregunta_id,
        puntaje: schema.opciones_registro_emocional.puntaje,
      })
      .from(schema.opciones_registro_emocional)
      .where(
        and(
          inArray(schema.opciones_registro_emocional.id, opcionIds),
          isNull(schema.opciones_registro_emocional.deleted_at),
        ),
      ),
    db
      .select({
        id: schema.preguntas_registro_emocional.id,
        categoria: schema.preguntas_registro_emocional.categoria,
      })
      .from(schema.preguntas_registro_emocional)
      .where(
        and(
          inArray(schema.preguntas_registro_emocional.id, preguntaIds),
          isNull(schema.preguntas_registro_emocional.deleted_at),
        ),
      ),
  ]);

  const opcionesById = new Map(opciones.map((item) => [item.id, item]));
  const preguntasById = new Map(preguntas.map((p) => [p.id, p]));

  for (const respuesta of input.respuestas) {
    const opcion = opcionesById.get(respuesta.opcion_id);
    if (!opcion) {
      throw new Error(`La opción ${respuesta.opcion_id} no existe`);
    }

    if (opcion.pregunta_id !== respuesta.pregunta_id) {
      throw new Error(
        `La opción ${respuesta.opcion_id} no pertenece a la pregunta ${respuesta.pregunta_id}`,
      );
    }
  }

  // Guardar respuestas del día reemplazando cualquier intento previo de hoy sin error 409
  const inserted = await db.transaction(async (tx) => {
    await tx
      .delete(schema.registro_emocional)
      .where(
        and(
          eq(schema.registro_emocional.usuario_id, input.usuario_id),
          eq(schema.registro_emocional.fecha_dia, todayIso),
        ),
      );

    const values = input.respuestas.map((item) => {
      const opcion = opcionesById.get(item.opcion_id)!;
      return {
        usuario_id: input.usuario_id,
        pregunta_id: item.pregunta_id,
        opcion_id: item.opcion_id,
        puntaje: opcion.puntaje,
        fecha_dia: todayIso,
        fecha: new Date(),
      };
    });

    return tx.insert(schema.registro_emocional).values(values).returning();
  });

  const totalPuntaje = inserted.reduce((acc, item) => acc + (item.puntaje ?? 0), 0);
  const promedioRegistro = inserted.length > 0 ? totalPuntaje / inserted.length : 2;

  // Escala de registro emocional: 0 = "Muy mal" (100% gravedad), 4 = "Excelente" (0% gravedad)
  // "Normal" (2) => 50% gravedad => Amarillo (40-69)
  const puntajeGravedad = Math.round(
    Math.max(0, Math.min(100, ((4 - promedioRegistro) / 4) * 100))
  );

  const estado = calcularNivelPorPuntaje(puntajeGravedad);

  // Calcular detalle por dimensión
  const itemsPorDimension = input.respuestas.map((r) => {
    const opcion = opcionesById.get(r.opcion_id);
    const pregunta = preguntasById.get(r.pregunta_id);
    const dimension = pregunta?.categoria || DIMENSION_GENERAL;
    const puntajeOpcion = opcion?.puntaje ?? 2;
    const puntajeNormalizado = Math.max(0, Math.min(100, ((4 - puntajeOpcion) / 4) * 100));
    return { dimension, puntaje: puntajeNormalizado };
  });

  const dimensionesCalculadas = agruparPuntajesPorDimension(itemsPorDimension);
  const dimensionDominante = determinarDimensionDominante(dimensionesCalculadas);
  const subcategoriaPrincipal = dimensionDominante
    ? construirSubcategoriaPrincipal(estado, dimensionDominante.dimension)
    : null;

  const recs = obtenerRecomendacionesPorEstado(estado, subcategoriaPrincipal);

  // Sincronizar tabla de evaluaciones y semaforo_dimensiones
  const [ultimaEvaluacion] = await db
    .select()
    .from(schema.evaluaciones)
    .where(eq(schema.evaluaciones.usuario_id, input.usuario_id))
    .orderBy(desc(schema.evaluaciones.fecha))
    .limit(1);

  let evaluacionRow;
  const observacionSemaforo = `Registro emocional diario: ${estado} (puntaje ${puntajeGravedad})`;

  if (ultimaEvaluacion) {
    [evaluacionRow] = await db
      .update(schema.evaluaciones)
      .set({
        puntaje_total: puntajeGravedad,
        estado_semaforo: estado,
        observaciones: observacionSemaforo,
        subcategoria_principal: subcategoriaPrincipal ?? ultimaEvaluacion.subcategoria_principal,
        updated_at: new Date(),
      })
      .where(eq(schema.evaluaciones.id, ultimaEvaluacion.id))
      .returning();
  } else {
    [evaluacionRow] = await db
      .insert(schema.evaluaciones)
      .values({
        usuario_id: input.usuario_id,
        puntaje_total: puntajeGravedad,
        estado_semaforo: estado,
        observaciones: observacionSemaforo,
        subcategoria_principal: subcategoriaPrincipal,
      })
      .returning();
  }

  if (evaluacionRow && dimensionesCalculadas.length > 0) {
    await db
      .update(schema.semaforo_dimensiones)
      .set({ deleted_at: new Date() })
      .where(eq(schema.semaforo_dimensiones.evaluacion_id, evaluacionRow.id));

    await db.insert(schema.semaforo_dimensiones).values(
      dimensionesCalculadas.map((d) => ({
        evaluacion_id: evaluacionRow.id,
        dimension: d.dimension,
        puntaje: d.puntaje,
        nivel: d.nivel,
      }))
    );
  }

  const evaluacionPayload = {
    ...evaluacionRow,
    estado: estado,
    estado_semaforo: estado,
    puntaje: puntajeGravedad,
    puntaje_total: puntajeGravedad,
    subcategoria_principal: subcategoriaPrincipal,
    dimensiones: dimensionesCalculadas,
    recomendaciones: recs,
    sugerencias: recs,
    observaciones: evaluacionRow?.observaciones ?? observacionSemaforo,
  };

  const analisisPayload = {
    estado: estado,
    estado_semaforo: estado,
    puntaje: puntajeGravedad,
    puntaje_total: puntajeGravedad,
    observaciones: evaluacionRow?.observaciones ?? observacionSemaforo,
    recomendaciones: recs,
    sugerencias: recs,
    dimensiones: dimensionesCalculadas,
    subcategoria_principal: subcategoriaPrincipal,
  };

  return {
    usuario_id: input.usuario_id,
    fecha_dia: todayIso,
    registro_del_dia: inserted.length > 0,
    total_puntaje: totalPuntaje,
    respuestas_guardadas: inserted.length,
    respuestas: inserted,
    // Estándar de semáforo para Flutter y clientes REST
    estado: estado,
    estado_semaforo: estado,
    puntaje: puntajeGravedad,
    puntaje_total: puntajeGravedad,
    subcategoria_principal: subcategoriaPrincipal,
    dimensiones: dimensionesCalculadas,
    recomendaciones: recs,
    sugerencias: recs,
    observaciones: evaluacionRow?.observaciones ?? observacionSemaforo,
    evaluacion: evaluacionPayload,
    analisis: analisisPayload,
  };
};

