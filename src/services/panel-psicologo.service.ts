import { and, desc, eq, gt, isNull } from 'drizzle-orm';
import { db } from '../db';
import * as schema from '../db/schema';

// ============================================================
// Tipos de respuesta
// ============================================================

export interface PerfilEstudiante {
  id: number;
  nombres: string;
  apellidos: string;
  ciudad: string | null;
  semestre_actual: string | null;
  edad: number | null;
  sexo: string | null;
  fecha_nacimiento: string | null;
  streak_count: number;
  streak_goal_days: number;
  streak_last_date: string | null;
  fecha_registro: Date;
  is_active: boolean;
}

export interface DimensionSemaforo {
  id: number;
  dimension: string;
  puntaje: number;
  nivel: string;
}

export interface UltimaEvaluacion {
  id: number;
  fecha: Date;
  puntaje_total: number | null;
  estado_semaforo: string | null;
  subcategoria_principal: string | null;
  observaciones: string | null;
  dimensiones: DimensionSemaforo[];
}

export interface ActividadVigente {
  id: number;
  vencimiento: Date;
  observaciones: string | null;
  opcion: {
    id: number;
    nombre: string;
    url_imagen: string;
    descripcion: string | null;
  } | null;
}

export interface ResumenEstudiante {
  perfil: PerfilEstudiante;
  ultima_evaluacion: UltimaEvaluacion | null;
  actividades_vigentes: ActividadVigente[];
}

// ============================================================
// Servicio: Perfil (datos generales seguros)
// ============================================================

/**
 * Retorna los datos generales del estudiante sin información sensible.
 *
 * Campos EXCLUIDOS intencionalmente por privacidad:
 *   - correo, contrasena, telefono
 *   - especialidad_psicologo (irrelevante para el panel del estudiante)
 *   - id_rol (detalle interno)
 *
 * @throws Error con code 'ESTUDIANTE_NO_ENCONTRADO' si no existe o está eliminado.
 */
export const getPerfilEstudianteService = async (
  estudianteId: number
): Promise<PerfilEstudiante> => {
  const [estudiante] = await db
    .select({
      id: schema.usuarios.id,
      nombres: schema.usuarios.nombres,
      apellidos: schema.usuarios.apellidos,
      ciudad: schema.usuarios.ciudad,
      semestre_actual: schema.usuarios.semestre_actual,
      edad: schema.usuarios.edad,
      sexo: schema.usuarios.sexo,
      fecha_nacimiento: schema.usuarios.fecha_nacimiento,
      streak_count: schema.usuarios.streak_count,
      streak_goal_days: schema.usuarios.streak_goal_days,
      streak_last_date: schema.usuarios.streak_last_date,
      fecha_registro: schema.usuarios.fecha_registro,
      is_active: schema.usuarios.is_active,
    })
    .from(schema.usuarios)
    .where(
      and(
        eq(schema.usuarios.id, estudianteId),
        isNull(schema.usuarios.deleted_at)
      )
    )
    .limit(1);

  if (!estudiante) {
    const error = new Error('Estudiante no encontrado.');
    (error as any).code = 'ESTUDIANTE_NO_ENCONTRADO';
    throw error;
  }

  return estudiante;
};

// ============================================================
// Servicio: Resumen (ficha consolidada)
// ============================================================

/**
 * Retorna la ficha consolidada del estudiante para el panel del psicólogo:
 *   - Perfil (datos seguros, sin info sensible)
 *   - Última evaluación con dimensiones de semáforo
 *   - Actividades vigentes (vencimiento futuro, sin soft-delete)
 *
 * Tablas NUNCA consultadas (privacidad estricta):
 *   diario, feedback, fallas_tecnicas, solicitudes_premios
 *
 * @throws Error con code 'ESTUDIANTE_NO_ENCONTRADO' si el estudiante no existe.
 */
export const getResumenEstudianteService = async (
  estudianteId: number
): Promise<ResumenEstudiante> => {
  // 1. Perfil del estudiante
  const perfil = await getPerfilEstudianteService(estudianteId);

  // 2. Última evaluación
  const [ultimaEval] = await db
    .select({
      id: schema.evaluaciones.id,
      fecha: schema.evaluaciones.fecha,
      puntaje_total: schema.evaluaciones.puntaje_total,
      estado_semaforo: schema.evaluaciones.estado_semaforo,
      subcategoria_principal: schema.evaluaciones.subcategoria_principal,
      observaciones: schema.evaluaciones.observaciones,
    })
    .from(schema.evaluaciones)
    .where(
      and(
        eq(schema.evaluaciones.usuario_id, estudianteId),
        isNull(schema.evaluaciones.deleted_at)
      )
    )
    .orderBy(desc(schema.evaluaciones.fecha))
    .limit(1);

  // 3. Dimensiones de esa evaluación (si existe)
  let dimensiones: DimensionSemaforo[] = [];
  if (ultimaEval) {
    dimensiones = await db
      .select({
        id: schema.semaforo_dimensiones.id,
        dimension: schema.semaforo_dimensiones.dimension,
        puntaje: schema.semaforo_dimensiones.puntaje,
        nivel: schema.semaforo_dimensiones.nivel,
      })
      .from(schema.semaforo_dimensiones)
      .where(
        and(
          eq(schema.semaforo_dimensiones.evaluacion_id, ultimaEval.id),
          isNull(schema.semaforo_dimensiones.deleted_at)
        )
      );
  }

  const ultima_evaluacion: UltimaEvaluacion | null = ultimaEval
    ? { ...ultimaEval, dimensiones }
    : null;

  // 4. Actividades vigentes (vencimiento >= ahora)
  const ahora = new Date();
  const actividadesRaw = await db
    .select({
      id: schema.registro_actividades_usuarios.id,
      vencimiento: schema.registro_actividades_usuarios.vencimiento,
      observaciones: schema.registro_actividades_usuarios.observaciones,
      opcion_id: schema.registro_actividades_usuarios.opcion_id,
      opcion_nombre: schema.opciones_registro_actividades.nombre,
      opcion_url_imagen: schema.opciones_registro_actividades.url_imagen,
      opcion_descripcion: schema.opciones_registro_actividades.descripcion,
    })
    .from(schema.registro_actividades_usuarios)
    .leftJoin(
      schema.opciones_registro_actividades,
      eq(
        schema.registro_actividades_usuarios.opcion_id,
        schema.opciones_registro_actividades.id
      )
    )
    .where(
      and(
        eq(schema.registro_actividades_usuarios.usuario_id, estudianteId),
        gt(schema.registro_actividades_usuarios.vencimiento, ahora),
        isNull(schema.registro_actividades_usuarios.deleted_at)
      )
    )
    .orderBy(schema.registro_actividades_usuarios.vencimiento);

  const actividades_vigentes: ActividadVigente[] = actividadesRaw.map((a) => ({
    id: a.id,
    vencimiento: a.vencimiento,
    observaciones: a.observaciones,
    opcion: a.opcion_id
      ? {
          id: a.opcion_id,
          nombre: a.opcion_nombre ?? '',
          url_imagen: a.opcion_url_imagen ?? '',
          descripcion: a.opcion_descripcion ?? null,
        }
      : null,
  }));

  return { perfil, ultima_evaluacion, actividades_vigentes };
};
