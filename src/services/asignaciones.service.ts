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