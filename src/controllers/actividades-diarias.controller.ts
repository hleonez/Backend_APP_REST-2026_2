import { Response } from 'express';
import { and, desc, eq, gte, inArray, lt, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db';
import * as schema from '../db/schema';
import { AuthRequest } from '../middleware/auth.middleware';

const ACTIVIDADES_POR_DIA = 5;

const asignarActividadDiariaSchema = z.object({
  opcion_id: z.number().int().positive(),
  observaciones: z.string().optional(),
  vencimiento: z.coerce.date().optional(),
});

const getRangoHoy = (): { inicio: Date; fin: Date } => {
  const inicio = new Date();
  inicio.setHours(0, 0, 0, 0);
  const fin = new Date();
  fin.setHours(23, 59, 59, 999);
  return { inicio, fin };
};

const getRangoMesActual = (referencia: Date): { inicioMes: Date; finMes: Date; diasMes: number } => {
  const inicioMes = new Date(referencia.getFullYear(), referencia.getMonth(), 1, 0, 0, 0, 0);
  const finMes = new Date(referencia.getFullYear(), referencia.getMonth() + 1, 1, 0, 0, 0, 0);
  const diasMes = new Date(referencia.getFullYear(), referencia.getMonth() + 1, 0).getDate();
  return { inicioMes, finMes, diasMes };
};

const construirSeleccionDiaria = <T extends { id: number }>(
  opciones: T[],
  usuarioId: number,
  referencia: Date,
): T[] => {
  if (opciones.length <= ACTIVIDADES_POR_DIA) {
    return opciones;
  }

  const semillaFecha =
    referencia.getFullYear() * 10000 +
    (referencia.getMonth() + 1) * 100 +
    referencia.getDate();
  const inicio = Math.abs(usuarioId * 31 + semillaFecha) % opciones.length;

  const seleccion: T[] = [];
  for (let i = 0; i < ACTIVIDADES_POR_DIA; i += 1) {
    const idx = (inicio + i) % opciones.length;
    seleccion.push(opciones[idx]);
  }
  return seleccion;
};

export const getActividadesDiarias = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ message: 'Usuario no autenticado' });
      return;
    }

    const usuarioId = req.user.id;
    const { inicio, fin } = getRangoHoy();
    const { inicioMes, finMes, diasMes } = getRangoMesActual(inicio);

    const [ultimaEvaluacion] = await db
      .select({ estado_semaforo: schema.evaluaciones.estado_semaforo })
      .from(schema.evaluaciones)
      .where(eq(schema.evaluaciones.usuario_id, usuarioId))
      .orderBy(desc(schema.evaluaciones.fecha))
      .limit(1);

    const opciones = await db
      .select({
        id: schema.opciones_registro_actividades.id,
        nombre: schema.opciones_registro_actividades.nombre,
        descripcion: schema.opciones_registro_actividades.descripcion,
        url_imagen: schema.opciones_registro_actividades.url_imagen,
      })
      .from(schema.opciones_registro_actividades);

    const seleccionDelDia = construirSeleccionDiaria(opciones, usuarioId, inicio);
    const idsSeleccion = seleccionDelDia.map((opcion) => opcion.id);

    const actividadesHoy = idsSeleccion.length === 0
      ? []
      : await db
      .select({
        id: schema.registro_actividades_usuarios.id,
        opcion_id: schema.registro_actividades_usuarios.opcion_id,
        fecha: schema.registro_actividades_usuarios.fecha,
        observaciones: schema.registro_actividades_usuarios.observaciones,
        opcion: {
          nombre: schema.opciones_registro_actividades.nombre,
          descripcion: schema.opciones_registro_actividades.descripcion,
          url_imagen: schema.opciones_registro_actividades.url_imagen,
        },
      })
      .from(schema.registro_actividades_usuarios)
      .leftJoin(
        schema.opciones_registro_actividades,
        eq(schema.registro_actividades_usuarios.opcion_id, schema.opciones_registro_actividades.id),
      )
      .where(
        and(
          eq(schema.registro_actividades_usuarios.usuario_id, usuarioId),
          inArray(schema.registro_actividades_usuarios.opcion_id, idsSeleccion),
          gte(schema.registro_actividades_usuarios.fecha, inicio),
          lt(schema.registro_actividades_usuarios.fecha, fin),
        ),
      )
      .orderBy(desc(schema.registro_actividades_usuarios.fecha));

    const idsRealizadas = new Set(actividadesHoy.map((actividad) => actividad.opcion_id));
    const pendientes = seleccionDelDia.filter((opcion) => !idsRealizadas.has(opcion.id));

    const [resumenMensual] = await db
      .select({ total: sql<number>`count(*)` })
      .from(schema.registro_actividades_usuarios)
      .where(
        and(
          eq(schema.registro_actividades_usuarios.usuario_id, usuarioId),
          gte(schema.registro_actividades_usuarios.fecha, inicioMes),
          lt(schema.registro_actividades_usuarios.fecha, finMes),
        ),
      );

    const estrellasMesActual = Number(resumenMensual?.total ?? 0);
    const metaEstrellasMesActual = diasMes * ACTIVIDADES_POR_DIA;

    res.json({
      estado_semaforo_actual: ultimaEvaluacion?.estado_semaforo ?? 'sin_evaluar',
      fecha_referencia: inicio.toISOString().split('T')[0],
      actividades_objetivo_diarias: seleccionDelDia,
      actividades_realizadas_hoy: actividadesHoy,
      actividades_pendientes: pendientes,
      total_objetivo_diario: seleccionDelDia.length,
      total_realizadas_hoy: actividadesHoy.length,
      total_pendientes: pendientes.length,
      estrellas_mes_actual: estrellasMesActual,
      meta_estrellas_mes_actual: metaEstrellasMesActual,
    });
  } catch (error) {
    console.error('Error obteniendo actividades diarias:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
};

export const asignarActividadDiaria = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ message: 'Usuario no autenticado' });
      return;
    }

    const parsed = asignarActividadDiariaSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: 'Datos inválidos', errors: parsed.error.errors });
      return;
    }

    const usuarioId = req.user.id;
    const data = parsed.data;
    const { inicio, fin } = getRangoHoy();

    const opciones = await db
      .select({
        id: schema.opciones_registro_actividades.id,
        nombre: schema.opciones_registro_actividades.nombre,
        descripcion: schema.opciones_registro_actividades.descripcion,
      })
      .from(schema.opciones_registro_actividades);

    const opcionExiste = opciones.some((opcion) => opcion.id === data.opcion_id);
    if (!opcionExiste) {
      res.status(404).json({ message: 'Actividad no encontrada' });
      return;
    }

    const seleccionDelDia = construirSeleccionDiaria(opciones, usuarioId, inicio);
    const permitidaHoy = seleccionDelDia.some((opcion) => opcion.id === data.opcion_id);
    if (!permitidaHoy) {
      res.status(400).json({
        message: `Solo puedes completar una de tus ${ACTIVIDADES_POR_DIA} actividades asignadas para hoy`,
      });
      return;
    }

    const [existeHoy] = await db
      .select({ id: schema.registro_actividades_usuarios.id })
      .from(schema.registro_actividades_usuarios)
      .where(
        and(
          eq(schema.registro_actividades_usuarios.usuario_id, usuarioId),
          eq(schema.registro_actividades_usuarios.opcion_id, data.opcion_id),
          gte(schema.registro_actividades_usuarios.fecha, inicio),
          lt(schema.registro_actividades_usuarios.fecha, fin),
        ),
      )
      .limit(1);

    if (existeHoy) {
      res.status(409).json({ message: 'La actividad ya fue asignada hoy' });
      return;
    }

    const [creado] = await db
      .insert(schema.registro_actividades_usuarios)
      .values({
        usuario_id: usuarioId,
        opcion_id: data.opcion_id,
        fecha: new Date(),
        vencimiento: data.vencimiento ?? new Date(),
        observaciones: data.observaciones,
      })
      .returning();

    res.status(201).json({
      message: 'Actividad diaria asignada correctamente',
      data: creado,
    });
  } catch (error) {
    console.error('Error asignando actividad diaria:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
};
