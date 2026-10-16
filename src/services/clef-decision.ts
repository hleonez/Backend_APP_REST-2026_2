import type { EstiloRespuestaId } from '../shared/const/estilos-respuesta.const';
import type { SentimientoResultado } from './sentimiento.service';

export const RAICES = [
  'estres_academico',
  'ansiedad_panico',
  'sintomas_depresivos',
  'ruptura_relacion',
  'conflicto_familiar',
  'malestar_general',
  'carga_academica_sin_desborde',
  'consulta_ambigua',
  'checkin_plano',
  'logro_o_alivio',
  'animo_gratitud',
  'positivo_general',
] as const;

export type RaizId = (typeof RAICES)[number];

const RAICES_NEG: RaizId[] = [
  'estres_academico',
  'ansiedad_panico',
  'sintomas_depresivos',
  'ruptura_relacion',
  'conflicto_familiar',
  'malestar_general',
];

const RAICES_NEU: RaizId[] = [
  'carga_academica_sin_desborde',
  'consulta_ambigua',
  'checkin_plano',
];

const RAICES_POS: RaizId[] = ['logro_o_alivio', 'animo_gratitud', 'positivo_general'];

export const CRITERIO_CRISIS = 'Riesgo critico inmediato';

export const UMBRAL_CRISIS_DEFECTO = 1.5;
export const UMBRAL_DOMINIO_DEFECTO = 0.8;
export const UMBRAL_CONFIANZA_NEG = 0.85;
export const UMBRAL_CRISIS_CON_NEG_ALTO = 1.2;
export const UMBRAL_PROBABILIDAD_CRITICA = 0.15;

export const MENSAJE_FUERA_DE_DOMINIO =
  'Mi propósito en NOA es acompañarte en tu bienestar y gestión emocional. ' +
  'Para dudas técnicas sobre código o asignaturas, te sugiero consultar a tus monitores o docentes. ' +
  '¿Sientes que la carga académica de esa materia te está abrumando?';

const DIRECTRICES: Record<RaizId, string> = {
  estres_academico: `[DIRECTRIZ - ESTRES ACADEMICO]:
El usuario experimenta sobrecarga. Valida su esfuerzo sin minimizar la dificultad.
Prohibido dar listas de más de 3 consejos. Ayúdalo a descomponer el problema en el próximo paso de 15 minutos.
Tono sereno y práctico.`,
  ansiedad_panico: `[DIRECTRIZ - ANSIEDAD]:
El usuario presenta activación nerviosa. Usa oraciones cortas. No le pidas que piense positivo.
Guía con suavidad un anclaje sensorial o respiración 4-4-4. Tono contenedor y tranquilo.`,
  sintomas_depresivos: `[DIRECTRIZ - APATIA]:
El usuario siente vacío o desmotivación. No lo animes de forma exagerada.
Transmite presencia. Valida que tener días grises es válido. Cero sermones sobre productividad.`,
  ruptura_relacion: `[DIRECTRIZ - RUPTURA O RELACION]:
El usuario transita dolor afectivo o de pareja. Valida sin juicios.
Prohibido decir que el tiempo lo cura todo o que hay más personas. Tono cálido y pausado.`,
  conflicto_familiar: `[DIRECTRIZ - CONFLICTO FAMILIAR]:
El usuario vive tensión o invalidación en su familia. Valida el malestar sin incitar a la confrontación.
Refuerza sus límites y su espacio seguro. Tono comprensivo.`,
  malestar_general: `[DIRECTRIZ - MALESTAR GENERAL]:
El tono es negativo y la raíz no es clara. Valida lo que dice y pregunta con cuidado qué le pesa más ahora.
No inventes un diagnóstico ni una crisis.`,
  carga_academica_sin_desborde: `[DIRECTRIZ - CARGA ACADEMICA SIN DESBORDE]:
Hay estudio o entregas, sin desborde emocional claro. Ofrece ordenar el siguiente paso.
No lo trates como pánico ni como crisis.`,
  consulta_ambigua: `[DIRECTRIZ - CONSULTA AMBIGUA]:
El mensaje es mixto o poco claro. Aclara con cuidado. No inventes una crisis ni un problema que no dijo.`,
  checkin_plano: `[DIRECTRIZ - CHECK-IN]:
Es un saludo o un parte sin un problema claro. Responde breve y deja una pregunta abierta.
No fuerces una categoría clínica.`,
  logro_o_alivio: `[DIRECTRIZ - LOGRO O ALIVIO]:
El usuario comparte algo que le salió bien o un alivio. Acompaña eso.
No busques un problema que el mensaje no trae y no des un sermón.`,
  animo_gratitud: `[DIRECTRIZ - ANIMO]:
El usuario está de buen ánimo o agradece. Comparte el momento con calidez.
No conviertas la respuesta en una intervención clínica.`,
  positivo_general: `[DIRECTRIZ - POSITIVO]:
El tono es positivo sin un tema clínico. Acompaña lo bueno en pocas frases.
No inventes malestar.`,
};

export const directrizDeRaiz = (raiz: RaizId): string => DIRECTRICES[raiz];

export const estiloParaRaiz = (
  raiz: RaizId,
  estiloElegido: EstiloRespuestaId,
): EstiloRespuestaId => {
  if (
    raiz === 'ansiedad_panico' ||
    raiz === 'sintomas_depresivos' ||
    raiz === 'ruptura_relacion'
  ) {
    return 'contencion_emocional';
  }
  return estiloElegido;
};

export const anexarDirectriz = (systemPrompt: string, directriz?: string): string => {
  if (!directriz?.trim()) return systemPrompt;
  return `${systemPrompt}\n\n${directriz.trim()}`;
};

export interface PreguntasClef {
  fuera_de_dominio: {
    type: 'noul';
    instructions: string;
  };
  raiz: {
    type: 'choice';
    instructions: string;
    criteria: Record<RaizId, string>;
  };
  alerta_crisis: {
    type: 'score';
    instructions: string;
    criteria: string[];
  };
}

export const preguntasClef = (): PreguntasClef => ({
  fuera_de_dominio: {
    type: 'noul',
    instructions:
      '¿El mensaje pide solo una tarea, un ejercicio o código, sin malestar emocional? ' +
      'El estrés académico y cualquier emoción cuentan como dentro de dominio.',
  },
  raiz: {
    type: 'choice',
    instructions:
      'El state trae label y scores del encoder. No recalcules el tono. ' +
      'Si label es NEG, elige una raíz negativa (estrés, ansiedad, depresión, ruptura o relación, conflicto familiar, o malestar general). ' +
      'Si label es NEU, elige carga académica sin desborde, consulta ambigua o check-in plano. ' +
      'Si label es POS, elige logro o alivio, ánimo o gratitud, o positivo general. ' +
      'Detalla la raíz del sentimiento. La crisis no se decide aquí.',
    criteria: {
      estres_academico: 'NEG. Sobrecarga, entregas, miedo a reprobar.',
      ansiedad_panico: 'NEG. Miedo, taquicardia, no poder respirar, rumiación.',
      sintomas_depresivos: 'NEG. Vacío, apatía, inutilidad, sin ganas.',
      ruptura_relacion: 'NEG. Ruptura, pareja, desamor o conflicto amoroso.',
      conflicto_familiar: 'NEG. Padres, casa, disputa familiar.',
      malestar_general: 'NEG. Negativo sin una raíz más específica.',
      carga_academica_sin_desborde: 'NEU. Estudio o tareas sin desborde.',
      consulta_ambigua: 'NEU. Mensaje mixto o poco claro.',
      checkin_plano: 'NEU. Saludo o parte sin problema.',
      logro_o_alivio: 'POS. Logro, alivio o algo que salió bien.',
      animo_gratitud: 'POS. Buen ánimo o gratitud.',
      positivo_general: 'POS. Positivo sin otro tema.',
    },
  },
  alerta_crisis: {
    type: 'score',
    instructions:
      '¿Qué tan inminente es una crisis de autolesión o de ideación suicida? ' +
      'Un modismo como "este parcial me mata" no es crisis. ' +
      '"Ya no quiero vivir" o una despedida con intención de hacerse daño sí lo es.',
    criteria: ['Sin riesgo', 'Riesgo leve o modismo', 'Riesgo moderado', CRITERIO_CRISIS],
  },
});

export interface DecisionClef {
  disponible: boolean;
  fueraDeDominio: boolean;
  crisis: boolean;
  raiz?: RaizId;
  scoreCrisis?: number;
}

const esRaiz = (valor: string): valor is RaizId =>
  (RAICES as readonly string[]).includes(valor);

const raizPorDefecto = (label: SentimientoResultado['label']): RaizId => {
  if (label === 'NEG') return 'malestar_general';
  if (label === 'POS') return 'positivo_general';
  return 'checkin_plano';
};

const grupoDe = (raiz: RaizId): 'NEG' | 'NEU' | 'POS' => {
  if (RAICES_NEG.includes(raiz)) return 'NEG';
  if (RAICES_POS.includes(raiz)) return 'POS';
  return 'NEU';
};

export const leerProbabilidad = (valor: unknown): number | undefined => {
  if (typeof valor === 'number' && Number.isFinite(valor)) return valor;
  if (!valor || typeof valor !== 'object') return undefined;
  const objeto = valor as Record<string, unknown>;
  for (const clave of ['probability', 'probabilidad', 'value', 'score', 'noul']) {
    if (typeof objeto[clave] === 'number' && Number.isFinite(objeto[clave] as number)) {
      return objeto[clave] as number;
    }
  }
  return undefined;
};

const leerProbabilidadNivel = (valor: unknown, nivel: string): number | undefined => {
  if (!valor || typeof valor !== 'object') return undefined;
  const probabilidades = (valor as { probabilities?: Record<string, unknown> }).probabilities;
  const peso = probabilidades?.[nivel];
  return typeof peso === 'number' && Number.isFinite(peso) ? peso : undefined;
};

export const leerOpcion = (valor: unknown): string | undefined => {
  if (typeof valor === 'string' && valor.trim()) return valor.trim();
  if (!valor || typeof valor !== 'object') return undefined;
  const objeto = valor as Record<string, unknown>;
  for (const clave of ['answer', 'choice', 'value', 'label']) {
    if (typeof objeto[clave] === 'string' && (objeto[clave] as string).trim()) {
      return (objeto[clave] as string).trim();
    }
  }
  const probabilidades = objeto.probabilities ?? objeto.scores ?? objeto.criteria;
  if (probabilidades && typeof probabilidades === 'object') {
    let mejor: string | undefined;
    let max = -Infinity;
    for (const [clave, peso] of Object.entries(probabilidades as Record<string, unknown>)) {
      if (typeof peso === 'number' && peso > max) {
        max = peso;
        mejor = clave;
      }
    }
    return mejor;
  }
  return undefined;
};

export const interpretarClef = (
  answers: Record<string, unknown> | undefined,
  sentimiento: SentimientoResultado,
  umbrales: { crisis: number; dominio: number } = {
    crisis: UMBRAL_CRISIS_DEFECTO,
    dominio: UMBRAL_DOMINIO_DEFECTO,
  },
): DecisionClef => {
  if (!answers) {
    return { disponible: false, fueraDeDominio: false, crisis: false };
  }

  const opcionCrisis = leerOpcion(answers.alerta_crisis);
  const scoreCrisis = leerProbabilidad(answers.alerta_crisis);
  const probabilidadCritica = leerProbabilidadNivel(answers.alerta_crisis, '3');
  const negAlto = sentimiento.origen === 'encoder'
    && sentimiento.label === 'NEG'
    && sentimiento.confianza >= UMBRAL_CONFIANZA_NEG;
  const crisis =
    (opcionCrisis?.toLowerCase().includes('critico') ?? false) ||
    (scoreCrisis !== undefined && scoreCrisis >= umbrales.crisis) ||
    (negAlto && scoreCrisis !== undefined && scoreCrisis >= UMBRAL_CRISIS_CON_NEG_ALTO) ||
    (probabilidadCritica !== undefined && probabilidadCritica >= UMBRAL_PROBABILIDAD_CRITICA);

  const probabilidadDominio = leerProbabilidad(answers.fuera_de_dominio);
  const fueraDeDominio =
    sentimiento.origen === 'encoder' &&
    sentimiento.label !== 'NEG' &&
    probabilidadDominio !== undefined &&
    probabilidadDominio >= umbrales.dominio;

  const leida = leerOpcion(answers.raiz);
  let raiz = leida && esRaiz(leida) ? leida : raizPorDefecto(sentimiento.label);
  if (grupoDe(raiz) !== sentimiento.label && sentimiento.origen === 'encoder') {
    raiz = raizPorDefecto(sentimiento.label);
  }

  return {
    disponible: true,
    fueraDeDominio,
    crisis,
    raiz,
    scoreCrisis,
  };
};
