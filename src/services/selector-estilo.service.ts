import type { EstiloRespuestaId } from '../shared/const/estilos-respuesta.const';
import type { SentimientoLabel } from './sentimiento.service';

export type Semaforo = 'verde' | 'amarillo' | 'rojo';

export interface PerfilParaSelector {
  emociones_frecuentes?: string[];
  temas_recurrentes?: string[];
  patrones_comportamiento?: string[];
  dias_sin_comunicacion?: number;
  tiene_historial?: boolean;
}

export interface SentimientoParaSelector {
  label: SentimientoLabel;
  confianza: number;
}

export interface ElegirEstiloParams {
  sentimiento: SentimientoParaSelector;
  semaforo?: Semaforo | null;
  /** Dominio especifico en alerta (academico, social, sueno, etc.). */
  subcategoria?: string | null;
  perfil?: PerfilParaSelector | null;
  /** Registros emocionales recientes del estudiante (registro_emocional). */
  ultimosRegistros?: unknown[] | null;
  /** true si el estudiante todavia no tiene historial/evaluacion inicial. */
  onboarding?: boolean;
  /**
   * Bandera opcional para dejar el selector completo y testeable de forma
   * aislada. En el pipeline real (chat.controller.ts) la derivación por
   * crisis (PALABRAS_ALERTA_CRITICA) ocurre ANTES de llamar a este
   * selector y responde sin pasar por el LLM, por lo que en la práctica
   * `chatConIA` casi nunca necesita pasar este flag en true.
   */
  esCritico?: boolean;
  /**
   * Señal opcional de que el mensaje describe un problema concreto aunque
   * el sentimiento detectado sea neutral (NEU). Si no se provee, se
   * infiere de forma heuristica a partir del perfil emocional.
   */
  problemaDetectado?: boolean;
}

const UMBRAL_NEG_ALTO = 0.6;
const UMBRAL_NEG_MODERADO = 0.35;
const UMBRAL_POS_ALTO = 0.6;
const DIAS_SIN_HABLAR_CHECKIN = 3;

const inferirProblemaDetectado = (perfil?: PerfilParaSelector | null): boolean => {
  if (!perfil) return false;
  return (perfil.patrones_comportamiento?.length ?? 0) > 0;
};

const hayRegistroEmocionalPendiente = (ultimosRegistros?: unknown[] | null): boolean =>
  Array.isArray(ultimosRegistros) && ultimosRegistros.length === 0;

/**
 * Selector determinista de estilo de respuesta (Fase 3).
 *
 * El catálogo inicial de estilos (ver `estilos-respuesta.const.ts`)
 * define esta tabla de reglas, en orden de prioridad declarado:
 *   1. crisis_derivacion       — palabras clave de crisis (prioridad máxima)
 *   2. contencion_emocional    — NEG >= 0.6
 *   3. apoyo_practico          — NEG 0.35-0.6, o NEU con problema detectado
 *   4. orientacion_por_dominio — semáforo amarillo/rojo en un dominio + NEG moderado
 *   5. refuerzo_positivo       — POS >= 0.6
 *   6. conversacion_neutral    — NEU dominante sin riesgo
 *   7. check_in_seguimiento    — > 3 días sin hablar o registro pendiente
 *
 * IMPORTANTE — orden de EVALUACIÓN vs. orden de la tabla:
 * Si estas reglas se evaluaran en el orden literal 1→7 con "primer match
 * gana", dos reglas quedarían inalcanzables en la práctica:
 *   - La regla 4 (dominio) nunca se alcanzaría para NEG en [0.35, 0.6)
 *     porque la regla 3 (apoyo_practico) ya captura todo ese rango antes.
 *   - La regla 7 (check-in) nunca se alcanzaría para sentimiento NEU
 *     porque la regla 6 (conversacion_neutral) ya captura todo NEU sin
 *     riesgo antes.
 * Para que ambas reglas sean funcionalmente alcanzables, este selector
 * evalúa primero la condición MÁS ESPECÍFICA de cada par antes que la
 * más genérica que la contendría (dominio antes de apoyo_practico,
 * check-in antes de conversacion_neutral). El resultado final devuelto
 * sigue representando fielmente la prioridad de negocio de la tabla
 * (crisis > malestar emocional > refuerzo positivo > seguimiento >
 * conversación por defecto); solo se reordenó la implementación interna
 * para evitar reglas muertas.
 *
 * Reemplaza la rotación por `numeroMensaje % 6`. `numeroMensaje` ya no
 * participa en esta selección: se conserva en el resto del pipeline
 * únicamente para debugging y para variar el fraseo dentro de un mismo
 * estilo (ver `prompts-enhanced.service.ts`).
 *
 * El encoder de sentimiento NUNCA decide una derivación por crisis; esa
 * responsabilidad es exclusiva de `detectarAlertaCritica` en
 * chat.controller.ts, evaluada antes de llegar a este selector.
 */
export const elegirEstilo = (params: ElegirEstiloParams): EstiloRespuestaId => {
  const {
    sentimiento,
    semaforo,
    subcategoria,
    perfil,
    ultimosRegistros,
    onboarding = false,
    esCritico = false,
    problemaDetectado,
  } = params;

  // 1. Crisis: prioridad máxima, no depende del encoder de sentimiento.
  if (esCritico) {
    return 'crisis_derivacion';
  }

  const label = sentimiento?.label ?? 'NEU';
  const confianza = sentimiento?.confianza ?? 0;
  const tieneProblema = problemaDetectado ?? inferirProblemaDetectado(perfil);
  const semaforoEnAlerta = semaforo === 'amarillo' || semaforo === 'rojo';

  // 2. Contención emocional: NEG alto.
  if (label === 'NEG' && confianza >= UMBRAL_NEG_ALTO) {
    return 'contencion_emocional';
  }

  // 3. Orientación por dominio: semáforo en alerta en un dominio concreto
  // combinado con sentimiento negativo moderado. Se evalúa ANTES de
  // apoyo_practico (ver nota de diseño arriba) porque es la condición
  // más específica dentro del mismo rango de NEG moderado.
  if (semaforoEnAlerta && !!subcategoria && label === 'NEG' && confianza >= UMBRAL_NEG_MODERADO) {
    return 'orientacion_por_dominio';
  }

  // 4. Apoyo práctico: NEG moderado (sin señal de dominio), o NEU con un
  // problema concreto detectado.
  if (
    (label === 'NEG' && confianza >= UMBRAL_NEG_MODERADO && confianza < UMBRAL_NEG_ALTO) ||
    (label === 'NEU' && tieneProblema)
  ) {
    return 'apoyo_practico';
  }

  // 5. Refuerzo positivo: POS alto.
  if (label === 'POS' && confianza >= UMBRAL_POS_ALTO) {
    return 'refuerzo_positivo';
  }

  // 6. Check-in de seguimiento: silencio prolongado o registro pendiente.
  // Se evalúa ANTES de conversacion_neutral (ver nota de diseño arriba)
  // porque de lo contrario nunca se alcanzaría para sentimiento NEU, que
  // es el caso más común en un mensaje de saludo tras una ausencia.
  // Se omite durante el onboarding, ya que un estudiante nuevo no tiene
  // aun un "hace X días" significativo.
  if (!onboarding) {
    const diasSinComunicacion = perfil?.dias_sin_comunicacion ?? 0;
    const registroPendiente = hayRegistroEmocionalPendiente(ultimosRegistros);
    if (diasSinComunicacion > DIAS_SIN_HABLAR_CHECKIN || registroPendiente) {
      return 'check_in_seguimiento';
    }
  }

  // 7. Conversación neutral: catch-all determinista. Cubre tanto el caso
  // "NEU dominante sin riesgo" como cualquier combinación no capturada
  // por las reglas anteriores, garantizando que siempre se devuelva uno
  // de los 7 estilos válidos.
  return 'conversacion_neutral';
};
