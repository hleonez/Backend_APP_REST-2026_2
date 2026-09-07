/**
 * Fase 5 — Semáforo con subcategorías y dimensiones.
 *
 * Utilidades compartidas para calcular el detalle por dimensión de una
 * evaluación. Usadas desde `ollama.service.ts` (análisis de la evaluación
 * clásica, tabla `preguntas`) y `asignacion-semaforo.controller.ts`
 * (asignación combinada con `registro_emocional`).
 *
 * El color global del semáforo (`verde` | `amarillo` | `rojo`) se mantiene
 * exactamente igual que antes de esta fase; estas utilidades únicamente
 * enriquecen el resultado con el detalle por dimensión y la subcategoría
 * principal (`<color_global>_<dimension_dominante>`).
 */

export type NivelSemaforo = 'verde' | 'amarillo' | 'rojo';

/** Las siete dimensiones propuestas para el semáforo (Fase 5). */
export const DIMENSIONES_SEMAFORO = [
  'ansiedad',
  'estres_academico',
  'humor_depresivo',
  'sueno',
  'relaciones_sociales',
  'autoestima_autocuidado',
  'energia_motivacion',
] as const;

export type DimensionSemaforo = (typeof DIMENSIONES_SEMAFORO)[number];

/**
 * Dimensión de respaldo para preguntas sin categoría explícita asignada o
 * cuyo texto no coincide con ninguna regla heurística. Coincide con el
 * valor por defecto de `preguntas_registro_emocional.categoria`.
 */
export const DIMENSION_GENERAL = 'general';

export interface DimensionCalculada {
  dimension: string;
  /** Puntaje normalizado en escala 0-100. */
  puntaje: number;
  nivel: NivelSemaforo;
}

/**
 * Determina el nivel (verde/amarillo/rojo) de un puntaje normalizado 0-100.
 * Usa los mismos umbrales que el color global del semáforo:
 * verde < 40, amarillo 40-69, rojo >= 70.
 */
export const calcularNivelPorPuntaje = (puntaje: number): NivelSemaforo => {
  if (puntaje >= 70) return 'rojo';
  if (puntaje >= 40) return 'amarillo';
  return 'verde';
};

const normalizarTexto = (texto: string): string =>
  texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

interface ReglaDimension {
  dimension: DimensionSemaforo;
  keywords: string[];
}

/**
 * Reglas heurísticas por palabra clave, usadas únicamente para clasificar
 * preguntas que no tienen una columna `categoria` explícita en BD (caso de
 * la evaluación clásica en la tabla `preguntas`). Para
 * `preguntas_registro_emocional` la dimensión ya viene etiquetada desde el
 * seed y no requiere esta heurística.
 */
const REGLAS_DIMENSIONES: ReglaDimension[] = [
  { dimension: 'ansiedad', keywords: ['ansiedad', 'ansios', 'preocup', 'nervios', 'miedo', 'panico', 'alerta', 'algo malo'] },
  { dimension: 'estres_academico', keywords: ['estres', 'agobiad', 'abrumad', 'sobrecargad', 'examen', 'parcial', 'tarea', 'trabajos', 'calificacion', 'nota', 'concentracion', 'estudio', 'academic'] },
  { dimension: 'humor_depresivo', keywords: ['animo', 'triste', 'depres', 'vacio', 'desmotiv', 'desinteres', 'apetito', 'llanto', 'llor', 'interes o motivacion'] },
  { dimension: 'sueno', keywords: ['sueno', 'dorm', 'insomnio', 'pesadilla'] },
  { dimension: 'relaciones_sociales', keywords: ['apoyo social', 'apoyo de las personas', 'compan', 'soledad', 'solo', 'amigos', 'familia', 'relacion'] },
  { dimension: 'autoestima_autocuidado', keywords: ['autoestima', 'autoval', 'valgo', 'fracaso', 'inutil', 'autocuidado', 'valoracion'] },
  { dimension: 'energia_motivacion', keywords: ['energia', 'cansad', 'fatiga', 'agotad', 'motivacion', 'ganas', 'satisfaccion', 'disfrutar', 'optimismo', 'futuro'] },
];

/**
 * Clasifica un texto libre (por ejemplo, `preguntas.texto` de la evaluación
 * clásica) en una de las siete dimensiones propuestas usando coincidencia de
 * palabras clave. Devuelve `DIMENSION_GENERAL` si no hay coincidencia.
 */
export const clasificarDimensionPorTexto = (texto: string): string => {
  const normalizado = normalizarTexto(texto);

  for (const regla of REGLAS_DIMENSIONES) {
    if (regla.keywords.some((keyword) => normalizado.includes(keyword))) {
      return regla.dimension;
    }
  }

  return DIMENSION_GENERAL;
};

/**
 * Agrupa una lista de puntajes (ya normalizados a escala 0-100) por
 * dimensión, calculando el promedio y el nivel de cada una.
 */
export const agruparPuntajesPorDimension = (
  items: Array<{ dimension: string; puntaje: number }>,
): DimensionCalculada[] => {
  const acumulado = new Map<string, { suma: number; total: number }>();

  for (const item of items) {
    const dimension = item.dimension || DIMENSION_GENERAL;
    const actual = acumulado.get(dimension) ?? { suma: 0, total: 0 };
    actual.suma += item.puntaje;
    actual.total += 1;
    acumulado.set(dimension, actual);
  }

  return Array.from(acumulado.entries()).map(([dimension, { suma, total }]) => {
    const puntaje = total > 0 ? Math.round(suma / total) : 0;
    return {
      dimension,
      puntaje,
      nivel: calcularNivelPorPuntaje(puntaje),
    };
  });
};

const RANGO_NIVEL: Record<NivelSemaforo, number> = {
  verde: 0,
  amarillo: 1,
  rojo: 2,
};

/**
 * Determina la dimensión dominante: aquella con peor nivel (rojo > amarillo
 * > verde). En caso de empate en nivel, gana la de mayor puntaje; si
 * persiste el empate, se ordena alfabéticamente para un resultado
 * determinista.
 */
export const determinarDimensionDominante = (
  dimensiones: DimensionCalculada[],
): DimensionCalculada | null => {
  if (dimensiones.length === 0) return null;

  return [...dimensiones].sort((a, b) => {
    const nivelDiff = RANGO_NIVEL[b.nivel] - RANGO_NIVEL[a.nivel];
    if (nivelDiff !== 0) return nivelDiff;

    const puntajeDiff = b.puntaje - a.puntaje;
    if (puntajeDiff !== 0) return puntajeDiff;

    return a.dimension.localeCompare(b.dimension);
  })[0];
};

/**
 * Construye la subcategoría principal combinando el color global del
 * semáforo con la dimensión dominante: `<color>_<dimension>`.
 */
export const construirSubcategoriaPrincipal = (
  colorGlobal: NivelSemaforo,
  dimensionDominante: string,
): string => `${colorGlobal}_${dimensionDominante}`;
