import { and, desc, eq, isNull } from 'drizzle-orm';
import { db } from '../db';
import * as schema from '../db/schema';
import { ASIGNACION_ESTADO } from '../shared/const/asignacion.const';
import { ROLES } from '../shared/const/roles.const';

interface CrearSolicitudInput {
  estudiante_id: number;
  psicologo_id: number;
  mensaje?: string;
}

/**
 * Crea una solicitud de atención (estado 'pendiente') de un estudiante hacia un psicólogo.
 *
 * Reglas de negocio:
 * - No autoasignación.
 * - El psicólogo destino debe existir, tener rol psicologo y estar activo.
 * - No se permite una segunda solicitud pendiente al mismo psicólogo (unique parcial en BD).
 * - No se permite solicitar si el estudiante ya tiene una asignación aprobada activa (unique parcial en BD).
 *
 * Los checks de duplicidad se hacen dentro de una transacción para evitar condiciones
 * de carrera; el índice único parcial en `asignaciones` es la última línea de defensa
 * (ver catch de error 23505 en el controller).
 */
export const crearSolicitudService = async (input: CrearSolicitudInput) => {
  const { estudiante_id, psicologo_id, mensaje } = input;

  if (estudiante_id === psicologo_id) {
    const error = new Error('No puedes solicitarte atención a ti mismo.');
    (error as any).code = 'AUTOASIGNACION';
    throw error;
  }

  return db.transaction(async (tx) => {
    const [psicologo] = await tx
      .select({ id: schema.usuarios.id })
      .from(schema.usuarios)
      .where(and(
        eq(schema.usuarios.id, psicologo_id),
        eq(schema.usuarios.id_rol, ROLES.PSICOLOGO.id),
        eq(schema.usuarios.is_active, true),
        isNull(schema.usuarios.deleted_at),
      ))
      .limit(1);

    if (!psicologo) {
      const error = new Error('El psicólogo indicado no existe o no está disponible.');
      (error as any).code = 'PSICOLOGO_NO_ENCONTRADO';
      throw error;
    }

    const [solicitudPendiente] = await tx
      .select({ id: schema.asignaciones.id })
      .from(schema.asignaciones)
      .where(and(
        eq(schema.asignaciones.estudiante_id, estudiante_id),
        eq(schema.asignaciones.psicologo_id, psicologo_id),
        eq(schema.asignaciones.estado, ASIGNACION_ESTADO.PENDIENTE),
        isNull(schema.asignaciones.deleted_at),
      ))
      .limit(1);

    if (solicitudPendiente) {
      const error = new Error('Ya tienes una solicitud pendiente con este psicólogo.');
      (error as any).code = 'SOLICITUD_DUPLICADA';
      throw error;
    }

    const [asignacionAprobada] = await tx
      .select({ id: schema.asignaciones.id })
      .from(schema.asignaciones)
      .where(and(
        eq(schema.asignaciones.estudiante_id, estudiante_id),
        eq(schema.asignaciones.estado, ASIGNACION_ESTADO.APROBADO),
        isNull(schema.asignaciones.deleted_at),
      ))
      .limit(1);

    if (asignacionAprobada) {
      const error = new Error('Ya tienes una asignación activa con un psicólogo.');
      (error as any).code = 'ASIGNACION_ACTIVA_EXISTENTE';
      throw error;
    }

    const [creada] = await tx
      .insert(schema.asignaciones)
      .values({
        estudiante_id,
        psicologo_id,
        mensaje: mensaje ?? null,
        estado: ASIGNACION_ESTADO.PENDIENTE,
      })
      .returning();

    return creada;
  });
};

/**
 * Historial de solicitudes/asignaciones del estudiante autenticado, más recientes primero.
 */
export const getMisSolicitudesService = async (estudianteId: number) => {
  return db
    .select()
    .from(schema.asignaciones)
    .where(and(
      eq(schema.asignaciones.estudiante_id, estudianteId),
      isNull(schema.asignaciones.deleted_at),
    ))
    .orderBy(desc(schema.asignaciones.solicitado_en));
};

/**
 * Solicitudes pendientes dirigidas al psicólogo autenticado (buzón de entrada).
 */
export const getSolicitudesPsicologoService = async (psicologoId: number) => {
  return db
    .select()
    .from(schema.asignaciones)
    .where(and(
      eq(schema.asignaciones.psicologo_id, psicologoId),
      eq(schema.asignaciones.estado, ASIGNACION_ESTADO.PENDIENTE),
      isNull(schema.asignaciones.deleted_at),
    ))
    .orderBy(desc(schema.asignaciones.solicitado_en));
};

/**
 * Aprueba una solicitud pendiente dirigida al psicólogo autenticado.
 *
 * Reglas de negocio:
 * - La solicitud debe existir, pertenecer al psicólogo autenticado y estar en estado 'pendiente'.
 * - Al aprobar, se debe finalizar cualquier otra asignación 'aprobado' previa del mismo
 *   estudiante (con otro psicólogo), porque el índice único parcial
 *   `uq_asignaciones_estudiante_aprobado` solo permite UNA fila 'aprobado' por estudiante.
 *   Si no se finaliza antes de aprobar, el INSERT/UPDATE revienta con 23505.
 * - Todo dentro de una transacción para que ambos cambios (finalizar la vieja, aprobar la
 *   nueva) sean atómicos.
 */
export const aprobarSolicitudService = async (asignacionId: number, psicologoId: number) => {
  return db.transaction(async (tx) => {
    const [solicitud] = await tx
      .select()
      .from(schema.asignaciones)
      .where(and(
        eq(schema.asignaciones.id, asignacionId),
        isNull(schema.asignaciones.deleted_at),
      ))
      .limit(1);

    if (!solicitud) {
      const error = new Error('Solicitud no encontrada.');
      (error as any).code = 'SOLICITUD_NO_ENCONTRADA';
      throw error;
    }

    if (solicitud.psicologo_id !== psicologoId) {
      const error = new Error('Esta solicitud no está dirigida a ti.');
      (error as any).code = 'NO_AUTORIZADO';
      throw error;
    }

    if (solicitud.estado !== ASIGNACION_ESTADO.PENDIENTE) {
      const error = new Error(`La solicitud ya fue procesada (estado actual: ${solicitud.estado}).`);
      (error as any).code = 'SOLICITUD_YA_PROCESADA';
      throw error;
    }

    if (solicitud.estudiante_id === null) {
      const error = new Error('La solicitud no tiene un estudiante asociado válido.');
      (error as any).code = 'SOLICITUD_INVALIDA';
      throw error;
    }

    // Finalizar cualquier asignación aprobada previa del estudiante (con cualquier psicólogo)
    // ANTES de aprobar esta, para no violar el unique parcial.
    await tx
      .update(schema.asignaciones)
      .set({ estado: ASIGNACION_ESTADO.FINALIZADO, finalizado_en: new Date() })
      .where(and(
        eq(schema.asignaciones.estudiante_id, solicitud.estudiante_id),
        eq(schema.asignaciones.estado, ASIGNACION_ESTADO.APROBADO),
        isNull(schema.asignaciones.deleted_at),
      ));

    const [actualizada] = await tx
      .update(schema.asignaciones)
      .set({ estado: ASIGNACION_ESTADO.APROBADO, procesado_en: new Date() })
      .where(and(
        eq(schema.asignaciones.id, asignacionId),
        eq(schema.asignaciones.estado, ASIGNACION_ESTADO.PENDIENTE)
      ))
      .returning();

    if (!actualizada) {
      const error = new Error('La solicitud fue procesada por otra transacción concurrentemente.');
      (error as any).code = 'SOLICITUD_YA_PROCESADA';
      throw error;
    }

    return actualizada;
  });
};

/**
 * Rechaza una solicitud pendiente dirigida al psicólogo autenticado.
 */
export const rechazarSolicitudService = async (asignacionId: number, psicologoId: number) => {
  const [solicitud] = await db
    .select()
    .from(schema.asignaciones)
    .where(and(
      eq(schema.asignaciones.id, asignacionId),
      isNull(schema.asignaciones.deleted_at),
    ))
    .limit(1);

  if (!solicitud) {
    const error = new Error('Solicitud no encontrada.');
    (error as any).code = 'SOLICITUD_NO_ENCONTRADA';
    throw error;
  }

  if (solicitud.psicologo_id !== psicologoId) {
    const error = new Error('Esta solicitud no está dirigida a ti.');
    (error as any).code = 'NO_AUTORIZADO';
    throw error;
  }

  if (solicitud.estado !== ASIGNACION_ESTADO.PENDIENTE) {
    const error = new Error(`La solicitud ya fue procesada (estado actual: ${solicitud.estado}).`);
    (error as any).code = 'SOLICITUD_YA_PROCESADA';
    throw error;
  }

  const [actualizada] = await db
    .update(schema.asignaciones)
    .set({ estado: ASIGNACION_ESTADO.RECHAZADO, procesado_en: new Date() })
    .where(and(
      eq(schema.asignaciones.id, asignacionId),
      eq(schema.asignaciones.estado, ASIGNACION_ESTADO.PENDIENTE)
    ))
    .returning();

  if (!actualizada) {
    const error = new Error('La solicitud fue procesada por otra transacción concurrentemente.');
    (error as any).code = 'SOLICITUD_YA_PROCESADA';
    throw error;
  }

  return actualizada;
};

/**
 * Finaliza o cancela una asignación.
 * Estudiantes pueden cancelar solicitudes pendientes o finalizar asignaciones aprobadas propias.
 * Psicólogos pueden finalizar asignaciones aprobadas de sus pacientes o rechazar/cancelar solicitudes.
 */
export const eliminarAsignacionService = async (asignacionId: number, usuarioId: number, isPsicologo: boolean) => {
  return db.transaction(async (tx) => {
    const [asignacion] = await tx
      .select()
      .from(schema.asignaciones)
      .where(and(
        eq(schema.asignaciones.id, asignacionId),
        isNull(schema.asignaciones.deleted_at)
      ))
      .limit(1);

    if (!asignacion) {
      const error = new Error('Asignación no encontrada.');
      (error as any).code = 'SOLICITUD_NO_ENCONTRADA';
      throw error;
    }

    if (isPsicologo) {
      if (asignacion.psicologo_id !== usuarioId) {
        const error = new Error('No autorizado para modificar esta asignación.');
        (error as any).code = 'NO_AUTORIZADO';
        throw error;
      }
    } else {
      if (asignacion.estudiante_id !== usuarioId) {
        const error = new Error('No autorizado para modificar esta asignación.');
        (error as any).code = 'NO_AUTORIZADO';
        throw error;
      }
    }

    if (asignacion.estado === ASIGNACION_ESTADO.FINALIZADO || asignacion.estado === ASIGNACION_ESTADO.RECHAZADO) {
      const error = new Error('La asignación ya se encuentra inactiva.');
      (error as any).code = 'SOLICITUD_YA_PROCESADA';
      throw error;
    }

    const [actualizada] = await tx
      .update(schema.asignaciones)
      .set({ estado: ASIGNACION_ESTADO.FINALIZADO, finalizado_en: new Date() })
      .where(and(
        eq(schema.asignaciones.id, asignacionId),
        eq(schema.asignaciones.estado, asignacion.estado)
      ))
      .returning();

    if (!actualizada) {
      const error = new Error('La asignación fue modificada por otra transacción concurrentemente.');
      (error as any).code = 'SOLICITUD_YA_PROCESADA';
      throw error;
    }

    return actualizada;
  });
};

export interface PacienteResumen {
  id: number;
  estudiante_id: number;
  nombres: string;
  apellidos: string;
  ultimo_semaforo: string | null;
  fecha_ultima_actividad: string | null;
}

/**
 * Estudiantes actualmente activos (asignación 'aprobado') a cargo del psicólogo autenticado.
 *
 * Devuelve un resumen POR ESTUDIANTE con `id = estudiante_id` (el panel web usa ese id
 * para navegar a /pacientes/:id y /chat/:id) junto con nombres y apellidos.
 */
export const getMisPacientesService = async (psicologoId: number): Promise<PacienteResumen[]> => {
  const rows = await db
    .select({
      estudiante_id: schema.asignaciones.estudiante_id,
      nombres: schema.usuarios.nombres,
      apellidos: schema.usuarios.apellidos,
    })
    .from(schema.asignaciones)
    .innerJoin(schema.usuarios, eq(schema.usuarios.id, schema.asignaciones.estudiante_id))
    .where(and(
      eq(schema.asignaciones.psicologo_id, psicologoId),
      eq(schema.asignaciones.estado, ASIGNACION_ESTADO.APROBADO),
      isNull(schema.asignaciones.deleted_at),
    ))
    .orderBy(desc(schema.asignaciones.procesado_en));

  return rows.flatMap((row) =>
    row.estudiante_id == null
      ? []
      : [{
          id: row.estudiante_id,
          estudiante_id: row.estudiante_id,
          nombres: row.nombres,
          apellidos: row.apellidos,
          ultimo_semaforo: null,
          fecha_ultima_actividad: null,
        }]
  );
};