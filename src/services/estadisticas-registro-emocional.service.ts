import { db } from '../db';
import {
  registro_emocional,
  opciones_registro_emocional,
  preguntas_registro_emocional,
  opciones_registro_actividades,
  registro_actividades_usuarios,
} from '../db/schema';
import { eq, and, gte, lte, isNull, sql } from 'drizzle-orm';
import { getTodayIso, toIsoDate } from '../shared/utils/fechas.utils';

interface CalendarioDiaData {
  fecha: string;
  promedio: number;
  registros_realizados: number;
  emociones: string[];
}

type CalendarioData = CalendarioDiaData[];

interface RachasData {
  racha_actual: number;
  racha_maxima_historica: number;
  dias_sin_registrar: number;
  ultimo_registro: string | null;
}

interface EstadisticasData {
  promedio_general: number;
  valor_minimo: number;
  valor_maximo: number;
  total_registros: number;
  emociones_mas_frecuentes: Record<string, number>;
  registros_por_semana: Record<string, number>;
}

interface ResumenDiaData {
  fecha: string;
  promedio_dia: number;
  total_registros: number;
  respuestas: Array<{
    pregunta: string;
    respuesta_seleccionada: string;
    valor: number;
  }>;
}

interface PantallaPersonalDia {
  fecha: string;
  dia: string;
  registro_emocional: boolean;
  estrella_activada: boolean;
}

interface PantallaPersonalData {
  dias_trabajados_en_mi: number;
  racha_actual: number;
  racha_maxima_historica: number;
  dias_sin_registrar: number;
  ultimo_registro: string | null;
  estrella_hoy_activada: boolean;
  puede_activar_estrella_hoy: boolean;
  estrellas_racha_total: number;
  estrellas_racha_mes_actual: number;
  estado_animo_mas_frecuente: {
    nombre: string;
    total: number;
  } | null;
  emociones_frecuentes: Array<{
    nombre: string;
    total: number;
  }>;
  evolucion_estado_animo: {
    tendencia: 'subiendo' | 'estable' | 'bajando';
    promedio_ultimos_7_dias: number;
    promedio_7_dias_anteriores: number;
    serie_ultimos_7_dias: Array<{
      fecha: string;
      promedio: number;
    }>;
  };
  semana_actual: PantallaPersonalDia[];
}

interface ActivarRachaDiariaData {
  activada: boolean;
  mensaje: string;
  fecha: string;
  estrella_otorgada: number;
  total_estrellas_racha: number;
  estrellas_racha_mes_actual: number;
}

const NOMBRE_OPCION_RACHA_DIARIA = 'Racha diaria emocional';

const toDateKey = (value: unknown): string => {
  if (value == null) return '';

  if (value instanceof Date) {
    const y = value.getUTCFullYear().toString().padStart(4, '0');
    const m = (value.getUTCMonth() + 1).toString().padStart(2, '0');
    const d = value.getUTCDate().toString().padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  const raw = String(value).trim();
  if (!raw) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  if (raw.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(raw)) {
    return raw.substring(0, 10);
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    const y = parsed.getUTCFullYear().toString().padStart(4, '0');
    const m = (parsed.getUTCMonth() + 1).toString().padStart(2, '0');
    const d = parsed.getUTCDate().toString().padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return raw;
};

const inicioYFinMesActual = () => {
  const now = new Date();
  const inicio = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const fin = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);
  return { inicio, fin };
};

const getTopEmociones = (emociones: Record<string, number>) => {
  return Object.entries(emociones)
    .sort((a, b) => b[1] - a[1])
    .map(([nombre, total]) => ({ nombre, total }));
};

const ensureRachaDiariaOptionId = async (): Promise<number> => {
  const [existing] = await db
    .select({ id: opciones_registro_actividades.id })
    .from(opciones_registro_actividades)
    .where(
      and(
        eq(opciones_registro_actividades.nombre, NOMBRE_OPCION_RACHA_DIARIA),
        isNull(opciones_registro_actividades.deleted_at)
      )
    )
    .limit(1);

  if (existing?.id) {
    return existing.id;
  }

  const [inserted] = await db
    .insert(opciones_registro_actividades)
    .values({
      nombre: NOMBRE_OPCION_RACHA_DIARIA,
      descripcion: 'Estrella diaria por completar y activar tu registro emocional',
      url_imagen: 'assets/images/star.png',
    })
    .returning({ id: opciones_registro_actividades.id });

  return inserted.id;
};

const getRachaStarsTotals = async (usuarioId: number, opcionRachaId: number) => {
  const { inicio, fin } = inicioYFinMesActual();

  const [totalResult] = await db
    .select({ total: sql<number>`count(*)` })
    .from(registro_actividades_usuarios)
    .where(
      and(
        eq(registro_actividades_usuarios.usuario_id, usuarioId),
        eq(registro_actividades_usuarios.opcion_id, opcionRachaId),
        isNull(registro_actividades_usuarios.deleted_at)
      )
    );

  const [mesActualResult] = await db
    .select({ total: sql<number>`count(*)` })
    .from(registro_actividades_usuarios)
    .where(
      and(
        eq(registro_actividades_usuarios.usuario_id, usuarioId),
        eq(registro_actividades_usuarios.opcion_id, opcionRachaId),
        gte(registro_actividades_usuarios.fecha, inicio),
        lte(registro_actividades_usuarios.fecha, fin),
        isNull(registro_actividades_usuarios.deleted_at)
      )
    );

  return {
    total: Number(totalResult?.total ?? 0),
    mesActual: Number(mesActualResult?.total ?? 0),
  };
};

/**
 * Obtener calendario emocional con rango de fechas
 */
export const getCalendarioEmocionalService = async (
  usuarioId: number,
  inicio: string,
  fin: string
): Promise<CalendarioData> => {
  try {
    const registros = await db
      .select({
        id: registro_emocional.id,
        usuario_id: registro_emocional.usuario_id,
        pregunta_id: registro_emocional.pregunta_id,
        opcion_id: registro_emocional.opcion_id,
        fecha_dia: registro_emocional.fecha_dia,
        valor_emocional: opciones_registro_emocional.puntaje,
        nombre: opciones_registro_emocional.nombre,
      })
      .from(registro_emocional)
      .leftJoin(
        opciones_registro_emocional,
        eq(registro_emocional.opcion_id, opciones_registro_emocional.id)
      )
      .where(
        and(
          eq(registro_emocional.usuario_id, usuarioId),
          gte(registro_emocional.fecha_dia, inicio),
          lte(registro_emocional.fecha_dia, fin),
          isNull(registro_emocional.deleted_at)
        )
      );

    const calendarioMap: { [fecha: string]: CalendarioDiaData } = {};

    registros.forEach((registro) => {
      const fecha = toDateKey(registro.fecha_dia);
      if (!fecha) return;
      if (!calendarioMap[fecha]) {
        calendarioMap[fecha] = {
          fecha,
          promedio: 0,
          registros_realizados: 0,
          emociones: [],
        };
      }

      calendarioMap[fecha].registros_realizados += 1;
      calendarioMap[fecha].emociones.push(registro.nombre || 'Sin emoción');
    });

    // Calcular promedios
    Object.keys(calendarioMap).forEach((fecha) => {
      const registrosDelDia = registros.filter((r) => toDateKey(r.fecha_dia) === fecha);
      const suma = registrosDelDia.reduce((acc, r) => acc + (r.valor_emocional || 0), 0);
      calendarioMap[fecha].promedio = Math.round((suma / registrosDelDia.length) * 100) / 100;
    });

    // Convertir a array ordenado por fecha
    const calendarioArray = Object.values(calendarioMap).sort((a, b) => a.fecha.localeCompare(b.fecha));

    return calendarioArray;
  } catch (error) {
    console.error('Error en getCalendarioEmocionalService:', error);
    throw error;
  }
};

/**
 * Obtener información de rachas (consistencia)
 */
export const getRachasService = async (usuarioId: number): Promise<RachasData> => {
  try {
    const registros = await db
      .select({
        fecha_dia: registro_emocional.fecha_dia,
      })
      .from(registro_emocional)
      .where(and(
        eq(registro_emocional.usuario_id, usuarioId),
        isNull(registro_emocional.deleted_at)
      ))
      .orderBy((table) => table.fecha_dia);

    if (registros.length === 0) {
      return {
        racha_actual: 0,
        racha_maxima_historica: 0,
        dias_sin_registrar: 0,
        ultimo_registro: null,
      };
    }

    // Obtener fechas únicas ordenadas
    const fechasUnicas = [...new Set(registros.map((r) => String(r.fecha_dia)))].sort();

    // Calcular rachas
    let rachaActual = 0;
    let rachaMaxima = 0;
    const hoy = new Date().toISOString().split('T')[0];
    let ultimoRegistro = fechasUnicas[fechasUnicas.length - 1];

    let fechaAnterior = '';
    for (let i = 0; i < fechasUnicas.length; i++) {
      const fechaActual = fechasUnicas[i];

      if (fechaAnterior === '') {
        rachaActual = 1;
      } else {
        const diaAnterior = new Date(fechaAnterior);
        diaAnterior.setDate(diaAnterior.getDate() + 1);
        const diaAnteriorStr = diaAnterior.toISOString().split('T')[0];

        if (diaAnteriorStr === fechaActual) {
          rachaActual += 1;
        } else {
          rachaActual = 1;
        }
      }

      if (rachaActual > rachaMaxima) {
        rachaMaxima = rachaActual;
      }

      fechaAnterior = fechaActual;
    }

    // Calcular días sin registrar
    let diasSinRegistrar = 0;
    const ultimaFecha = new Date(ultimoRegistro);
    const hoyDate = new Date(hoy);
    const diferencia = Math.floor((hoyDate.getTime() - ultimaFecha.getTime()) / (1000 * 60 * 60 * 24));
    diasSinRegistrar = diferencia;

    return {
      racha_actual: rachaActual,
      racha_maxima_historica: rachaMaxima,
      dias_sin_registrar: diasSinRegistrar,
      ultimo_registro: ultimoRegistro,
    };
  } catch (error) {
    console.error('Error en getRachasService:', error);
    throw error;
  }
};

/**
 * Obtener estadísticas detalladas
 */
export const getEstadisticasService = async (usuarioId: number): Promise<EstadisticasData> => {
  try {
    const registros = await db
      .select({
        valor_emocional: opciones_registro_emocional.puntaje,
        fecha_dia: registro_emocional.fecha_dia,
        nombre: opciones_registro_emocional.nombre,
      })
      .from(registro_emocional)
      .leftJoin(
        opciones_registro_emocional,
        eq(registro_emocional.opcion_id, opciones_registro_emocional.id)
      )
      .where(and(
        eq(registro_emocional.usuario_id, usuarioId),
        isNull(registro_emocional.deleted_at)
      ));

    if (registros.length === 0) {
      return {
        promedio_general: 0,
        valor_minimo: 0,
        valor_maximo: 0,
        total_registros: 0,
        emociones_mas_frecuentes: {},
        registros_por_semana: {},
      };
    }

    // Calcular promedios
    const valores = registros.map((r) => r.valor_emocional || 0);
    const suma = valores.reduce((acc, val) => acc + val, 0);
    const promedio = Math.round((suma / valores.length) * 100) / 100;

    // Emociones más frecuentes
    const emocionesFrequencia: Record<string, number> = {};
    registros.forEach((r) => {
      const emocion = r.nombre || 'Sin emoción';
      emocionesFrequencia[emocion] = (emocionesFrequencia[emocion] || 0) + 1;
    });

    // Registros por semana
    const registrosPorSemana: Record<string, number> = {};
    registros.forEach((r) => {
      const fecha = String(r.fecha_dia);
      registrosPorSemana[fecha] = (registrosPorSemana[fecha] || 0) + 1;
    });

    return {
      promedio_general: promedio,
      valor_minimo: Math.min(...valores),
      valor_maximo: Math.max(...valores),
      total_registros: registros.length,
      emociones_mas_frecuentes: emocionesFrequencia,
      registros_por_semana: registrosPorSemana,
    };
  } catch (error) {
    console.error('Error en getEstadisticasService:', error);
    throw error;
  }
};

/**
 * Obtener resumen del día específico
 */
export const getResumenDiaService = async (usuarioId: number, fecha: string): Promise<ResumenDiaData> => {
  try {
    const registros = await db
      .select({
        pregunta_id: registro_emocional.pregunta_id,
        opcion_id: registro_emocional.opcion_id,
        texto: preguntas_registro_emocional.texto,
        nombre: opciones_registro_emocional.nombre,
        valor_emocional: opciones_registro_emocional.puntaje,
      })
      .from(registro_emocional)
      .leftJoin(
        preguntas_registro_emocional,
        eq(registro_emocional.pregunta_id, preguntas_registro_emocional.id)
      )
      .leftJoin(
        opciones_registro_emocional,
        eq(registro_emocional.opcion_id, opciones_registro_emocional.id)
      )
      .where(
        and(
          eq(registro_emocional.usuario_id, usuarioId),
          eq(registro_emocional.fecha_dia, fecha as any),
          isNull(registro_emocional.deleted_at)
        )
      );

    if (registros.length === 0) {
      return {
        fecha,
        promedio_dia: 0,
        total_registros: 0,
        respuestas: [],
      };
    }

    // Calcular promedio del día
    const valores = registros.map((r) => r.valor_emocional || 0);
    const suma = valores.reduce((acc, val) => acc + val, 0);
    const promedioDia = Math.round((suma / valores.length) * 100) / 100;

    // Armar respuestas
    const respuestas = registros.map((r) => ({
      pregunta: r.texto || 'Pregunta desconocida',
      respuesta_seleccionada: r.nombre || 'Opción desconocida',
      valor: r.valor_emocional || 0,
    }));

    return {
      fecha,
      promedio_dia: promedioDia,
      total_registros: registros.length,
      respuestas,
    };
  } catch (error) {
    console.error('Error en getResumenDiaService:', error);
    throw error;
  }
};

export const getPantallaPersonalService = async (
  usuarioId: number,
): Promise<PantallaPersonalData> => {
  const [rachas, estadisticas] = await Promise.all([
    getRachasService(usuarioId),
    getEstadisticasService(usuarioId),
  ]);

  const topEmociones = getTopEmociones(estadisticas.emociones_mas_frecuentes);
  const estadoAnimoMasFrecuente = topEmociones.length
    ? topEmociones[0]
    : null;

  const hoy = new Date();
  const hoyIso = toIsoDate(hoy);
  const diaSemana = (hoy.getDay() + 6) % 7;
  const inicioSemana = new Date(hoy);
  inicioSemana.setDate(hoy.getDate() - diaSemana);
  const finSemana = new Date(inicioSemana);
  finSemana.setDate(inicioSemana.getDate() + 6);

  const [registrosSemana, diasTrabajadosRows] = await Promise.all([
    db
      .select({ fecha_dia: registro_emocional.fecha_dia })
      .from(registro_emocional)
      .where(
        and(
          eq(registro_emocional.usuario_id, usuarioId),
          gte(registro_emocional.fecha_dia, toIsoDate(inicioSemana)),
          lte(registro_emocional.fecha_dia, toIsoDate(finSemana)),
          isNull(registro_emocional.deleted_at)
        )
      ),
    db
      .select({ total: sql<number>`count(distinct ${registro_emocional.fecha_dia})` })
      .from(registro_emocional)
      .where(
        and(
          eq(registro_emocional.usuario_id, usuarioId),
          isNull(registro_emocional.deleted_at)
        )
      ),
  ]);

  const opcionRachaId = await ensureRachaDiariaOptionId();

  const activacionesSemanaRows = await db
    .select({ fecha: registro_actividades_usuarios.fecha })
    .from(registro_actividades_usuarios)
    .where(
      and(
        eq(registro_actividades_usuarios.usuario_id, usuarioId),
        eq(registro_actividades_usuarios.opcion_id, opcionRachaId),
        gte(registro_actividades_usuarios.fecha, inicioSemana),
        lte(registro_actividades_usuarios.fecha, finSemana),
        isNull(registro_actividades_usuarios.deleted_at)
      )
    );

  const registrosSemanaSet = new Set(registrosSemana.map((r) => toDateKey(r.fecha_dia)));
  const activacionesSemanaSet = new Set(activacionesSemanaRows.map((r) => toDateKey(r.fecha)));

  const diasSemanaNombre = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  const semanaActual: PantallaPersonalDia[] = [];

  for (let i = 0; i < 7; i++) {
    const fecha = new Date(inicioSemana);
    fecha.setDate(inicioSemana.getDate() + i);
    const fechaIso = toIsoDate(fecha);

    semanaActual.push({
      fecha: fechaIso,
      dia: diasSemanaNombre[i],
      registro_emocional: registrosSemanaSet.has(fechaIso),
      estrella_activada: activacionesSemanaSet.has(fechaIso),
    });
  }

  const estrellaHoyActivada = activacionesSemanaSet.has(hoyIso);
  const puedeActivarEstrellaHoy = registrosSemanaSet.has(hoyIso) && !estrellaHoyActivada;

  const finEvolucion = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const inicioEvolucion = new Date(finEvolucion);
  inicioEvolucion.setDate(finEvolucion.getDate() - 13);

  const evolucionCompleta = await getCalendarioEmocionalService(
    usuarioId,
    toIsoDate(inicioEvolucion),
    toIsoDate(finEvolucion),
  );

  const serieUltimos7 = evolucionCompleta.slice(-7).map((item) => ({
    fecha: item.fecha,
    promedio: item.promedio,
  }));

  const ultimos7 = evolucionCompleta.slice(-7).map((item) => item.promedio);
  const previos7 = evolucionCompleta.slice(-14, -7).map((item) => item.promedio);

  const promedio = (items: number[]) => {
    if (!items.length) return 0;
    const suma = items.reduce((acc, value) => acc + value, 0);
    return Math.round((suma / items.length) * 100) / 100;
  };

  const promedioUltimos7 = promedio(ultimos7);
  const promedioPrevios7 = promedio(previos7);
  const diferencia = promedioUltimos7 - promedioPrevios7;

  const tendencia: 'subiendo' | 'estable' | 'bajando' =
    diferencia > 0.15 ? 'subiendo' : diferencia < -0.15 ? 'bajando' : 'estable';

  const estrellasRacha = await getRachaStarsTotals(usuarioId, opcionRachaId);

  return {
    dias_trabajados_en_mi: Number(diasTrabajadosRows[0]?.total ?? 0),
    racha_actual: rachas.racha_actual,
    racha_maxima_historica: rachas.racha_maxima_historica,
    dias_sin_registrar: rachas.dias_sin_registrar,
    ultimo_registro: rachas.ultimo_registro,
    estrella_hoy_activada: estrellaHoyActivada,
    puede_activar_estrella_hoy: puedeActivarEstrellaHoy,
    estrellas_racha_total: estrellasRacha.total,
    estrellas_racha_mes_actual: estrellasRacha.mesActual,
    estado_animo_mas_frecuente: estadoAnimoMasFrecuente,
    emociones_frecuentes: topEmociones.slice(0, 3),
    evolucion_estado_animo: {
      tendencia,
      promedio_ultimos_7_dias: promedioUltimos7,
      promedio_7_dias_anteriores: promedioPrevios7,
      serie_ultimos_7_dias: serieUltimos7,
    },
    semana_actual: semanaActual,
  };
};

export const activarRachaDiariaService = async (
  usuarioId: number,
): Promise<ActivarRachaDiariaData> => {
  const hoyIso = getTodayIso();

  const [registroHoy] = await db
    .select({ id: registro_emocional.id })
    .from(registro_emocional)
    .where(
      and(
        eq(registro_emocional.usuario_id, usuarioId),
        eq(registro_emocional.fecha_dia, hoyIso),
        isNull(registro_emocional.deleted_at)
      )
    )
    .limit(1);

  if (!registroHoy) {
    throw new Error('Debes completar tu registro emocional de hoy antes de activar tu estrella diaria.');
  }

  const opcionRachaId = await ensureRachaDiariaOptionId();

  const [yaActivadaHoy] = await db
    .select({ id: registro_actividades_usuarios.id })
    .from(registro_actividades_usuarios)
    .where(
      and(
        eq(registro_actividades_usuarios.usuario_id, usuarioId),
        eq(registro_actividades_usuarios.opcion_id, opcionRachaId),
        sql`DATE(${registro_actividades_usuarios.fecha}) = ${hoyIso}`,
        isNull(registro_actividades_usuarios.deleted_at)
      )
    )
    .limit(1);

  let activada = false;
  if (!yaActivadaHoy) {
    await db.insert(registro_actividades_usuarios).values({
      usuario_id: usuarioId,
      opcion_id: opcionRachaId,
      fecha: new Date(),
      vencimiento: new Date(),
      observaciones: 'Estrella diaria por racha emocional activada',
    });
    activada = true;
  }

  const estrellasRacha = await getRachaStarsTotals(usuarioId, opcionRachaId);

  return {
    activada,
    mensaje: activada
      ? 'Racha diaria activada. Se otorgó 1 estrella.'
      : 'Tu estrella diaria de hoy ya estaba activada.',
    fecha: hoyIso,
    estrella_otorgada: activada ? 1 : 0,
    total_estrellas_racha: estrellasRacha.total,
    estrellas_racha_mes_actual: estrellasRacha.mesActual,
  };
};
