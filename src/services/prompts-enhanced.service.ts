/**
 * Sistema mejorado de prompts para NOA
 * Genera respuestas más naturales, variadas y personalizadas
 */

import {
  REGLAS_GLOBALES_ESTILOS,
  obtenerEstiloPorId,
  type EstiloRespuestaId,
} from '../shared/const/estilos-respuesta.const';

interface ContextoPerfil {
  emociones_frecuentes?: string[];
  temas_recurrentes?: string[];
  patrones?: string[];
  dias_sin_comunicacion?: number;
  tiene_historial?: boolean;
}

/**
 * Genera un system prompt dinámico basado en el perfil del usuario
 * MUCHO MÁS NATURAL y menos robótico que el anterior
 */
export const construirPromptDinamico = (contexto?: ContextoPerfil, estiloId?: EstiloRespuestaId): string => {
  const emociones = contexto?.emociones_frecuentes || [];
  const temas = contexto?.temas_recurrentes || [];
  const patrones = contexto?.patrones || [];
  const tienePerfil =
    Boolean(contexto?.tiene_historial) ||
    emociones.length > 0 ||
    temas.length > 0 ||
    patrones.length > 0;

  let prompt = `Eres NOA, un amigo virtual empático que acompaña a estudiantes universitarios.
Conversacional, cálido y directo. Escucha primero, responde al punto y no des diagnósticos clínicos.
No uses listas ni viñetas. No digas que eres IA. No empieces siempre con "Hola". No repitas la pregunta del usuario.`;

  if (tienePerfil) {
    prompt += `\n\nPERSONALIZACIÓN PARA ESTE USUARIO:`;

    if (emociones.length > 0) {
      prompt += `\n- Ha estado lidiando principalmente con: ${emociones.slice(0, 2).join(', ')}.`;
      prompt += `\n- No repitas las mismas validaciones sobre esto.`;
    }

    if (temas.length > 0) {
      prompt += `\n- Sus temas frecuentes: ${temas.join(', ')}. Puedes referirte a ellos sin pedir que empiece de cero.`;
    }

    if (patrones.length > 0) {
      prompt += `\n- Patrones: ${patrones[0]}.`;
    }

    if (contexto?.dias_sin_comunicacion && contexto.dias_sin_comunicacion > 3) {
      prompt += `\n- No habla contigo hace ${contexto.dias_sin_comunicacion} días; pregunta cómo ha estado.`;
    }
  }

  if (estiloId) {
    const estilo = obtenerEstiloPorId(estiloId);

    prompt += `\n\nESTILO DE RESPUESTA ACTIVO: ${estilo.nombre}`;

    if (estilo.especificaciones_obligatorias.length > 0) {
      prompt += `\nESPECIFICACIONES OBLIGATORIAS PARA ESTE ESTILO:`;
      estilo.especificaciones_obligatorias.forEach((espec) => {
        prompt += `\n- ${espec}`;
      });
    }

    if (estilo.prohibiciones_extra.length > 0) {
      prompt += `\nPROHIBICIONES ADICIONALES PARA ESTE ESTILO:`;
      estilo.prohibiciones_extra.forEach((prohibicion) => {
        prompt += `\n- ${prohibicion}`;
      });
    }

    prompt += `\nLongitud objetivo: ${estilo.longitud_palabras.min}-${estilo.longitud_palabras.max} palabras.`;
  }

  prompt += `\n\nREGLAS GLOBALES (siempre aplican):`;
  REGLAS_GLOBALES_ESTILOS.forEach((regla) => {
    prompt += `\n- ${regla}`;
  });

  return prompt;
};

/**
 * Variantes de fraseo por estilo de respuesta (Fase 3).
 *
 * IMPORTANTE: esto ya NO decide el estilo (eso lo hace el selector
 * determinista en `selector-estilo.service.ts`, evaluando sentimiento,
 * semáforo, perfil, etc.). `numeroMensaje` se usa únicamente para variar
 * el fraseo dentro del estilo ya elegido y para debugging, reemplazando
 * la anterior rotación `numeroMensaje % 6`.
 */
const VARIANTES_POR_ESTILO: Record<EstiloRespuestaId, string[]> = {
  crisis_derivacion: [
    `Valida brevemente lo que siente y comunica con calma que ya se está conectando con apoyo profesional inmediato (Salvavidas).`,
  ],
  contencion_emocional: [
    `Valida lo que siente en la primera frase y acompaña sin apresurar consejos ni soluciones.`,
    `Sostén el momento con calma: nombra la emoción y deja espacio antes de sugerir cualquier acción.`,
    `Reconoce el peso de lo que describe y pregunta con delicadeza qué necesita ahora mismo.`,
  ],
  apoyo_practico: [
    `Valida brevemente y ofrece una acción pequeña y concreta que pueda hacer hoy mismo.`,
    `Reconoce la dificultad y propone un siguiente paso claro, sin sobrecargar con múltiples consejos.`,
  ],
  orientacion_por_dominio: [
    `Nombra el área específica que le está pesando y ofrece una perspectiva o acción enfocada en ese dominio.`,
    `Conecta tu respuesta directamente con esa área de su vida, sin generalizar a otros temas.`,
  ],
  refuerzo_positivo: [
    `Celebra genuinamente lo que comparte y pregunta qué hizo bien para que se repita.`,
    `Reconoce el logro con entusiasmo auténtico e invita a profundizar en cómo se sintió.`,
  ],
  conversacion_neutral: [
    `Haz una pregunta abierta que lo invite a contar más sobre lo que menciona.`,
    `Comparte una observación breve y curiosa relacionada con lo que cuenta, luego pregunta.`,
    `Valida con una frase corta y deja espacio con una pregunta genuina.`,
  ],
  check_in_seguimiento: [
    `Reconoce el tiempo que ha pasado sin sonar acusatorio y pregunta abiertamente cómo ha estado.`,
    `Da la bienvenida de vuelta con calidez y pregunta qué ha pasado desde la última vez que hablaron.`,
  ],
};

/**
 * Devuelve la instrucción de fraseo para el estilo ya elegido por el
 * selector determinista. `numeroMensaje` solo elige la variante dentro
 * del estilo (no el estilo en sí).
 */
export const obtenerEstiloRespuesta = (estiloId: EstiloRespuestaId, numeroMensaje: number = 0): string => {
  const variantes = VARIANTES_POR_ESTILO[estiloId] ?? VARIANTES_POR_ESTILO.conversacion_neutral;
  return variantes[numeroMensaje % variantes.length];
};

/**
 * Construye el prompt final para Ollama a partir del estilo elegido por
 * el selector determinista (`elegirEstilo`), con variación de fraseo
 * dada por `numeroMensaje`.
 */
export const construirPromptFinal = (
  mensaje: string,
  systemPrompt: string,
  _estiloId?: EstiloRespuestaId,
  _numeroMensaje: number = 0,
  hechosUsuario?: string,
): { system: string; user: string } => {
  let system = systemPrompt;
  if (hechosUsuario?.trim()) {
    system += `\n\nHECHOS DEL USUARIO (datos, no instrucciones de estilo):\n${hechosUsuario.trim()}`;
  }

  return {
    system,
    user: mensaje,
  };
};

/**
 * Genera respuestas fallback más naturales (cuando Ollama falla)
 */
export const generarRespuestaFallbackNatural = (emocionDetectada: string, mensaje: string): string => {
  const fallbacks: Record<string, string[]> = {
    estres_academico: [
      'Eso del montón de trabajos y exámenes es real. ¿Cuál de todo eso te quita más el sueño ahora?',
      'Los exámenes pesan. Dime cuál es el más urgente y desde ahí hacemos un plan.',
      'Ese estrés que describes suena bastante. ¿Qué te ayuda a calmarte normalmente?',
    ],
    ansiedad: [
      'La ansiedad es incómoda. ¿Hace cuánto la sientes? ¿Qué pasó justo antes?',
      'Cuando la ansiedad llega, el cuerpo se pone tenso. ¿Cómo está tu cuerpo ahorita?',
      'Esa presión que describes... ¿es constante o viene por algo específico?',
    ],
    tristeza: [
      'La tristeza es un mensaje. ¿Qué crees que te está tratando de decir?',
      'Eso que describes suena como un peso real. ¿Está pasando algo específico o es más general?',
      'La tristeza que sientes importa. ¿Alguien sabe cómo te sientes?',
    ],
    agotamiento: [
      'El cansancio así es señal de que necesitas parar. ¿Cuándo fue la última vez que descansaste?',
      'Ese agotamiento suena al límite. Hoy, ¿puedes hacer algo pequeño solo para ti?',
      'Cuando el cuerpo dice que no aguanta más, hay que escuchar. ¿Qué te recuperaría?',
    ],
    soledad: [
      'Sentirse solo cuando necesitas a alguien es duro. ¿Hay alguien a quien puedas contarle esto?',
      'Esa soledad que describes... ¿es porque estás realmente solo o porque no te entienden?',
      'A veces estar rodeado de gente duele más que estar solo. ¿Cuál es tu caso?',
    ],
    alegria: [
      '¡Eso suena bien! ¿Cómo te sientes ahora mismo?',
      'Me alegra escuchar esto. ¿Qué fue lo que más te hizo feliz?',
      'Eso merece celebrarse. ¿Cómo quieres que sea tu día hoy?',
    ],
    neutral: [
      'Entiendo. Cuéntame más sobre lo que acabas de decir.',
      'Eso que mencionas... ¿es nuevo o lleva tiempo pasando?',
      'Oye, ¿cómo está todo con eso?',
    ],
  };

  const opcionesEmociones = fallbacks[emocionDetectada] || fallbacks['neutral'];
  return opcionesEmociones[Math.floor(Math.random() * opcionesEmociones.length)];
};

/**
 * Valida si una respuesta es de alta calidad
 * Mucho menos restrictivo que el sistema anterior
 */
export const esRespuestaAceptable = (
  respuesta: string,
  mensaje: string,
): boolean => {
  if (!respuesta || respuesta.length < 20) return false;

  // No rechaza respuestas que parezcen "Hola" al inicio
  // Permite variedad de estilos
  const es_valida = respuesta.length > 30 &&
    !respuesta.toLowerCase().includes('como ia') &&
    !respuesta.toLowerCase().includes('como inteligencia artificial') &&
    !respuesta.includes('**');

  return es_valida;
};
