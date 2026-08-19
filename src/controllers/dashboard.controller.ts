import { Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import { db } from "../db";
import { 
  registro_emocional, opciones_registro_emocional, 
  registro_actividades_usuarios, opciones_registro_actividades,
  diario, texto_aplicacion 
} from "../db/schema";
import { eq, and, between, desc, asc } from "drizzle-orm";


export const getDashboard = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const usuarioId = req.user?.id;
    if (!usuarioId) {
      res.status(401).json({ message: "No autorizado" });
      return;
    }

    // RANGO SEMANAL (Lunes - Domingo)
    const hoy = new Date();
    const dia = hoy.getDay();
    const diffInicio = dia === 0 ? -6 : 1 - dia;
    const formatDate = (date: Date) => {
        return date.toISOString().split('T')[0]; // YYYY-MM-DD
    };

    const inicioSemana = new Date(hoy);
    inicioSemana.setDate(hoy.getDate() + diffInicio);

    const finSemana = new Date(inicioSemana);
    finSemana.setDate(inicioSemana.getDate() + 6);

    // CONSULTAS EN PARALELO
    const [
      emociones,
      actividades,
      ultimoDiario,
      tecnicasRaw
    ] = await Promise.all([

      // 1. Registro emocional (semana)
      db.select({
        fecha: registro_emocional.fecha_dia,
        emoji: opciones_registro_emocional.url_imagen,
        estado: opciones_registro_emocional.nombre,
        puntaje: registro_emocional.puntaje
      })
      .from(registro_emocional)
      .innerJoin(
        opciones_registro_emocional,
        eq(registro_emocional.opcion_id, opciones_registro_emocional.id)
      )
      .where(
        and(
          eq(registro_emocional.usuario_id, usuarioId),
          between(
            registro_emocional.fecha_dia,
            formatDate(inicioSemana),
            formatDate(finSemana)
            )
        )
      )
      .orderBy(asc(registro_emocional.fecha_dia)),

      // 2. Actividades (limitadas para dashboard)
      db.select({
        id: registro_actividades_usuarios.id,
        nombre: opciones_registro_actividades.nombre,
        imagen: opciones_registro_actividades.url_imagen,
        vencimiento: registro_actividades_usuarios.vencimiento
      })
      .from(registro_actividades_usuarios)
      .innerJoin(
        opciones_registro_actividades,
        eq(registro_actividades_usuarios.opcion_id, opciones_registro_actividades.id)
      )
      .where(eq(registro_actividades_usuarios.usuario_id, usuarioId))
      .orderBy(desc(registro_actividades_usuarios.fecha))
      .limit(4),

      //3. Última entrada del diario
      db.query.diario.findFirst({
        where: eq(diario.usuario_id, usuarioId),
        orderBy: [desc(diario.fecha)]
      }),

      // 4. Técnicas
      db.query.texto_aplicacion.findFirst({
        where: eq(texto_aplicacion.codigo, "TECNICAS_RELAX")
      })
    ]);

    // PROCESAMIENTO

    const tecnicas = tecnicasRaw?.texto
      ? JSON.parse(tecnicasRaw.texto)
      : [];

    const diarioFormateado = ultimoDiario
      ? {
          titulo: ultimoDiario.titulo,
          fecha: ultimoDiario.fecha
        }
      : null;

    // RESPUESTA FINAL
    res.status(200).json({
      usuario: {
        id: usuarioId
      },

      registroEmocional: emociones,
      actividades,
      diario: diarioFormateado,
      tecnicas
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error al cargar el dashboard"
    });
  }
};