import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '../db';
import * as schema from '../db/schema';
import { getTodayIso } from '../shared/utils/fechas.utils';

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

  const opciones = await db
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
    );

  const opcionesById = new Map(opciones.map((item) => [item.id, item]));

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

  const inserted = await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: schema.registro_emocional.id })
      .from(schema.registro_emocional)
      .where(
        and(
          eq(schema.registro_emocional.usuario_id, input.usuario_id),
          eq(schema.registro_emocional.fecha_dia, todayIso),
          isNull(schema.registro_emocional.deleted_at),
        ),
      )
      .limit(1);

    if (existing) {
      const error = new Error('Ya completaste el test emocional de hoy.');
      (error as any).code = 'REGISTRO_DUPLICADO';
      throw error;
    }

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

  return {
    usuario_id: input.usuario_id,
    fecha_dia: todayIso,
    registro_del_dia: inserted.length > 0,
    total_puntaje: totalPuntaje,
    respuestas_guardadas: inserted.length,
    respuestas: inserted,
  };
};
