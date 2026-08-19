import { Response } from 'express';
import { and, desc, eq, gte, lt, sql } from 'drizzle-orm';
import { z } from 'zod';

import { db } from '../db';
import * as schema from '../db/schema';
import { AuthRequest } from '../middleware/auth.middleware';

const solicitarPremioSchema = z.object({
  premio_id: z.number().int().positive(),
});

const estadoSolicitudSchema = z.enum(['pendiente', 'aprobado', 'rechazado']);

const actualizarEstadoSolicitudSchema = z.object({
  estado: z.enum(['aprobado', 'rechazado']),
  observaciones: z.string().max(600).optional(),
});

const getPeriodoActual = () => {
  const now = new Date();
  const anio = now.getFullYear();
  const mes = now.getMonth() + 1;
  const inicioMes = new Date(anio, now.getMonth(), 1, 0, 0, 0, 0);
  const finMes = new Date(anio, now.getMonth() + 1, 1, 0, 0, 0, 0);
  return { anio, mes, inicioMes, finMes };
};

const getEstrellasPeriodo = async (usuarioId: number, anio: number, mes: number, inicioMes: Date, finMes: Date) => {
  const [acumuladasResult] = await db
    .select({ total: sql<number>`count(*)` })
    .from(schema.registro_actividades_usuarios)
    .where(
      and(
        eq(schema.registro_actividades_usuarios.usuario_id, usuarioId),
        gte(schema.registro_actividades_usuarios.fecha, inicioMes),
        lt(schema.registro_actividades_usuarios.fecha, finMes),
      ),
    );

  const [reservadasResult] = await db
    .select({
      total: sql<number>`coalesce(sum(${schema.solicitudes_premios.estrellas_requeridas}), 0)`,
    })
    .from(schema.solicitudes_premios)
    .where(
      and(
        eq(schema.solicitudes_premios.usuario_id, usuarioId),
        eq(schema.solicitudes_premios.periodo_anio, anio),
        eq(schema.solicitudes_premios.periodo_mes, mes),
        sql`${schema.solicitudes_premios.estado} in ('pendiente', 'aprobado')`,
      ),
    );

  const acumuladas = Number(acumuladasResult?.total ?? 0);
  const reservadas = Number(reservadasResult?.total ?? 0);
  const disponibles = Math.max(0, acumuladas - reservadas);

  return { acumuladas, reservadas, disponibles };
};

export const getPremiosCatalogo = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ message: 'Usuario no autenticado' });
      return;
    }

    const usuarioId = req.user.id;
    const { anio, mes, inicioMes, finMes } = getPeriodoActual();

    const [premios, estrellas] = await Promise.all([
      db
        .select()
        .from(schema.premios)
        .where(eq(schema.premios.is_active, true))
        .orderBy(schema.premios.estrellas_requeridas),
      getEstrellasPeriodo(usuarioId, anio, mes, inicioMes, finMes),
    ]);

    const solicitudes = await db
      .select({
        id: schema.solicitudes_premios.id,
        estado: schema.solicitudes_premios.estado,
        estrellas_requeridas: schema.solicitudes_premios.estrellas_requeridas,
        solicitado_en: schema.solicitudes_premios.solicitado_en,
        premio_nombre: schema.premios.nombre,
      })
      .from(schema.solicitudes_premios)
      .leftJoin(schema.premios, eq(schema.solicitudes_premios.premio_id, schema.premios.id))
      .where(
        and(
          eq(schema.solicitudes_premios.usuario_id, usuarioId),
          eq(schema.solicitudes_premios.periodo_anio, anio),
          eq(schema.solicitudes_premios.periodo_mes, mes),
        ),
      )
      .orderBy(desc(schema.solicitudes_premios.solicitado_en));

    const premiosFormateados = premios.map((premio) => {
      const faltantes = Math.max(0, premio.estrellas_requeridas - estrellas.disponibles);
      return {
        id: premio.id,
        nombre: premio.nombre,
        descripcion: premio.descripcion,
        estrellas_requeridas: premio.estrellas_requeridas,
        solicitar_habilitado: faltantes === 0,
        estrellas_faltantes: faltantes,
      };
    });

    res.json({
      periodo: { anio, mes },
      estrellas: estrellas,
      premios: premiosFormateados,
      solicitudes,
    });
  } catch (error) {
    console.error('Error obteniendo catalogo de premios:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
};

export const solicitarPremio = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ message: 'Usuario no autenticado' });
      return;
    }

    const parsed = solicitarPremioSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: 'Datos inválidos', errors: parsed.error.errors });
      return;
    }

    const usuarioId = req.user.id;
    const { premio_id } = parsed.data;
    const { anio, mes, inicioMes, finMes } = getPeriodoActual();

    const [premio] = await db
      .select()
      .from(schema.premios)
      .where(and(eq(schema.premios.id, premio_id), eq(schema.premios.is_active, true)))
      .limit(1);

    if (!premio) {
      res.status(404).json({ message: 'Premio no encontrado o inactivo' });
      return;
    }

    const [solicitudPendienteMismoPremio] = await db
      .select({ id: schema.solicitudes_premios.id })
      .from(schema.solicitudes_premios)
      .where(
        and(
          eq(schema.solicitudes_premios.usuario_id, usuarioId),
          eq(schema.solicitudes_premios.premio_id, premio_id),
          eq(schema.solicitudes_premios.periodo_anio, anio),
          eq(schema.solicitudes_premios.periodo_mes, mes),
          eq(schema.solicitudes_premios.estado, 'pendiente'),
        ),
      )
      .limit(1);

    if (solicitudPendienteMismoPremio) {
      res.status(409).json({ message: 'Ya tienes una solicitud pendiente para este premio' });
      return;
    }

    const estrellas = await getEstrellasPeriodo(usuarioId, anio, mes, inicioMes, finMes);
    if (estrellas.disponibles < premio.estrellas_requeridas) {
      res.status(400).json({
        message: 'No tienes estrellas suficientes para solicitar este premio',
        estrellas_disponibles: estrellas.disponibles,
        estrellas_requeridas: premio.estrellas_requeridas,
      });
      return;
    }

    const [solicitud] = await db
      .insert(schema.solicitudes_premios)
      .values({
        usuario_id: usuarioId,
        premio_id: premio.id,
        estado: 'pendiente',
        estrellas_requeridas: premio.estrellas_requeridas,
        periodo_anio: anio,
        periodo_mes: mes,
      })
      .returning();

    res.status(201).json({
      message: 'Solicitud registrada correctamente. Bienestar Universitario la revisará en su panel.',
      solicitud,
    });
  } catch (error) {
    console.error('Error solicitando premio:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
};

export const getSolicitudesPremiosPanel = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const estadoRaw = req.query.estado?.toString();
    const estadoParsed = estadoRaw
      ? estadoSolicitudSchema.safeParse(estadoRaw)
      : null;

    if (estadoRaw && !estadoParsed?.success) {
      res.status(400).json({ message: 'Estado inválido. Usa pendiente, aprobado o rechazado.' });
      return;
    }

    const estadoFiltro = estadoParsed?.success ? estadoParsed.data : undefined;

    const where = estadoFiltro
      ? eq(schema.solicitudes_premios.estado, estadoFiltro)
      : undefined;

    const solicitudes = await db
      .select({
        id: schema.solicitudes_premios.id,
        estado: schema.solicitudes_premios.estado,
        estrellas_requeridas: schema.solicitudes_premios.estrellas_requeridas,
        periodo_anio: schema.solicitudes_premios.periodo_anio,
        periodo_mes: schema.solicitudes_premios.periodo_mes,
        solicitado_en: schema.solicitudes_premios.solicitado_en,
        procesado_en: schema.solicitudes_premios.procesado_en,
        observaciones: schema.solicitudes_premios.observaciones,
        premio: {
          id: schema.premios.id,
          nombre: schema.premios.nombre,
        },
        usuario: {
          id: schema.usuarios.id,
          nombres: schema.usuarios.nombres,
          apellidos: schema.usuarios.apellidos,
          correo: schema.usuarios.correo,
        },
      })
      .from(schema.solicitudes_premios)
      .leftJoin(schema.premios, eq(schema.solicitudes_premios.premio_id, schema.premios.id))
      .leftJoin(schema.usuarios, eq(schema.solicitudes_premios.usuario_id, schema.usuarios.id))
      .where(where)
      .orderBy(desc(schema.solicitudes_premios.solicitado_en));

    res.json({ solicitudes });
  } catch (error) {
    console.error('Error obteniendo solicitudes de premios para panel:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
};

export const actualizarSolicitudPremioPanel = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      res.status(400).json({ message: 'ID inválido' });
      return;
    }

    const parsed = actualizarEstadoSolicitudSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: 'Datos inválidos', errors: parsed.error.errors });
      return;
    }

    const [existing] = await db
      .select({
        id: schema.solicitudes_premios.id,
        estado: schema.solicitudes_premios.estado,
      })
      .from(schema.solicitudes_premios)
      .where(eq(schema.solicitudes_premios.id, id))
      .limit(1);

    if (!existing) {
      res.status(404).json({ message: 'Solicitud no encontrada' });
      return;
    }

    if (existing.estado !== 'pendiente') {
      res.status(409).json({ message: 'La solicitud ya fue procesada previamente' });
      return;
    }

    const [updated] = await db
      .update(schema.solicitudes_premios)
      .set({
        estado: parsed.data.estado,
        observaciones: parsed.data.observaciones,
        procesado_en: new Date(),
        updated_at: new Date(),
      })
      .where(eq(schema.solicitudes_premios.id, id))
      .returning();

    res.json({
      message: `Solicitud ${parsed.data.estado} correctamente`,
      solicitud: updated,
    });
  } catch (error) {
    console.error('Error actualizando solicitud de premio:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
};
