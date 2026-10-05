import { Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import bcrypt from "bcrypt";

import { db } from "../db";
import * as schema from "../db/schema";

import { eq } from "drizzle-orm";
import { z } from "zod";

// Normaliza cadenas vacías a null en campos opcionales (evita errores 500 en columnas date)
const emptyToNull = (value: unknown): unknown => (value === "" ? null : value);

// Esquema de validación para actualizar perfil (actualización parcial: solo campos enviados)
const updateProfileSchema = z.object({
  nombres: z.string().min(1).optional(),
  apellidos: z.string().min(1).optional(),
  telefono: z.preprocess(emptyToNull, z.string().nullable().optional()),
  semestre_actual: z.preprocess(emptyToNull, z.string().nullable().optional()),
  fecha_nacimiento: z.preprocess(
    emptyToNull,
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de fecha inválido (YYYY-MM-DD)")
      .nullable()
      .optional()
  )
});
// Esquema para enviar el feedback
const sendFeedbackSchema = z.object({
  puntaje: z.number().min(1).max(5),
  que_mas_te_gusto: z.string().min(1),
  comentarios: z.string().optional()
});
// Esquema para enviar un reporte de problema
const sendReportSchema = z.object({
  titulo: z.string().min(1),
  descripcion: z.string().min(1)
});
//esquema para actualiza las preferencias (idioma)
const updatePreferencesSchema = z.object({
  idioma: z.enum(["es", "en", "pt", "fr", "de"])
});

// Esquema para cambiar la contraseña estando autenticado
const changePasswordSchema = z
  .object({
    contrasenaActual: z.string().min(1, "Ingresa tu contraseña actual"),
    nuevaContrasena: z
      .string()
      .min(8, "La contraseña debe tener al menos 8 caracteres"),
    confirmarContrasena: z.string().min(8, "Confirma la nueva contraseña"),
  })
  .refine((data) => data.nuevaContrasena === data.confirmarContrasena, {
    message: "Las contraseñas no coinciden",
    path: ["confirmarContrasena"],
  });

// Cambiar la contraseña del usuario autenticado
export const changePassword = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ message: "Usuario no autenticado" });
      return;
    }

    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Datos inválidos", errors: parsed.error.errors });
      return;
    }

    const { contrasenaActual, nuevaContrasena } = parsed.data;

    const [existing] = await db
      .select({ id: schema.usuarios.id, contrasena: schema.usuarios.contrasena })
      .from(schema.usuarios)
      .where(eq(schema.usuarios.id, userId))
      .limit(1);

    if (!existing) {
      res.status(404).json({ message: "Usuario no encontrado" });
      return;
    }

    const passwordMatch = await bcrypt.compare(contrasenaActual, existing.contrasena);
    if (!passwordMatch) {
      res.status(401).json({ message: "La contraseña actual es incorrecta" });
      return;
    }

    const hashedPassword = await bcrypt.hash(nuevaContrasena, 10);

    await db
      .update(schema.usuarios)
      .set({ contrasena: hashedPassword, updated_at: new Date() })
      .where(eq(schema.usuarios.id, userId));

    res.status(200).json({ message: "Contraseña actualizada exitosamente" });
  } catch (error) {
    console.error("Error changing password:", error);
    res.status(500).json({ message: "Error en el servidor" });
  }
};

// Obtener perfil del usuario
export const getProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ message: 'Usuario no autenticado' });
      return;
    }
    const [user] = await db
      .select()
      .from(schema.usuarios)
      .where(eq(schema.usuarios.id, userId))
      .limit(1);
    if (!user) {
      res.status(404).json({ message: 'Usuario no encontrado' });
      return;
    }
    // Nunca exponer la contraseña
    const { contrasena, ...userSinContrasena } = user;
    res.json(userSinContrasena);
  } catch (error) {
    console.error('Error getting profile:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
};

// Actualizar perfil del usuario
export const updateProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ message: 'Usuario no autenticado' });
      return;
    }
    const parsed = updateProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: 'Datos inválidos', errors: parsed.error.errors });
      return;
    }
    const data = parsed.data;

    // Construir el payload únicamente con los campos enviados (actualización parcial)
    const payload: any = { updated_at: new Date() };
    if (data.nombres !== undefined) payload.nombres = data.nombres;
    if (data.apellidos !== undefined) payload.apellidos = data.apellidos;
    if (data.telefono !== undefined) payload.telefono = data.telefono;
    if (data.semestre_actual !== undefined) payload.semestre_actual = data.semestre_actual;
    if (data.fecha_nacimiento !== undefined) payload.fecha_nacimiento = data.fecha_nacimiento;

    if (Object.keys(payload).length === 1) {
      res.status(400).json({ message: 'No hay campos para actualizar' });
      return;
    }

    const [existing] = await db
      .select()
      .from(schema.usuarios)
      .where(eq(schema.usuarios.id, userId))
      .limit(1);
    if (!existing) {
      res.status(404).json({ message: 'Usuario no encontrado' });
      return;
    }
    const [updated] = await db
      .update(schema.usuarios)
      .set(payload)
      .where(eq(schema.usuarios.id, userId))
      .returning({
        id: schema.usuarios.id,
        nombres: schema.usuarios.nombres,
        apellidos: schema.usuarios.apellidos,
        correo: schema.usuarios.correo,
        telefono: schema.usuarios.telefono,
        semestre_actual: schema.usuarios.semestre_actual,
        fecha_nacimiento: schema.usuarios.fecha_nacimiento
      });

    res.status(200).json({
      message: 'Perfil actualizado correctamente',
      user: updated
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
};
// Actualizar preferencias del usuario (idioma)
export const updatePreferences = async (req: AuthRequest, res: Response): Promise<void> => {
  try {

    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({
        message: "Usuario no autenticado"
      });
      return;
    }

    const parsed = updatePreferencesSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        message: "Datos inválidos",
        errors: parsed.error.errors
      });
      return;
    }

    const { idioma } = parsed.data;

    const [updatedUser] = await db
      .update(schema.usuarios)
      .set({
        idioma
      })
      .where(eq(schema.usuarios.id, userId))
      .returning({
        idioma: schema.usuarios.idioma
      });

    res.status(200).json({
      message: "Preferencias actualizadas correctamente",
      preferences: updatedUser
    });

  } catch (error) {

    console.error("Error updating preferences:", error);

    res.status(500).json({
      message: "Error en el servidor"
    });

  }
};


// Reportar un problema
export const reportIssue = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({
        message: "Usuario no autenticado"
      });
      return;
    }

    const parsed = sendReportSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        message: "Datos inválidos",
        errors: parsed.error.errors
      });
      return;
    }

    const data = parsed.data;

    const [newReport] = await db
      .insert(schema.fallas_tecnicas)
      .values({
        usuario_id: userId,
        titulo: data.titulo,
        descripcion: data.descripcion
      })
      .returning();

    res.status(201).json({
      message: "Problema reportado correctamente",
      report: newReport
    });

  } catch (error) {

    console.error("Error reporting issue:", error);

    res.status(500).json({
      message: "Error en el servidor"
    });

  }
};
// Enviar feedback
export const sendFeedback = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({
        message: "Usuario no autenticado"
      });
      return;
    }
    const parsed = sendFeedbackSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        message: "Datos inválidos",
        errors: parsed.error.errors
      });
      return;
    }
    const data = parsed.data;
    const [newFeedback] = await db
      .insert(schema.feedback)
      .values({
        usuario_id: userId,
        puntaje: data.puntaje,
        que_mas_te_gusto: data.que_mas_te_gusto,
        comentarios: data.comentarios
      })
      .returning();
    res.status(201).json({
      message: "Feedback enviado correctamente",
      feedback: newFeedback
    });

  } catch (error) {

    console.error("Error sending feedback:", error);

    res.status(500).json({
      message: "Error en el servidor"
    });

  }
};



// Obtener código de conducta, política de privacidad y términos
export const getCodeOfConduct = async (req: AuthRequest, res: Response): Promise<void> => {
  try {

    const result = await db
      .select()
      .from(schema.texto_aplicacion)
      .where(eq(schema.texto_aplicacion.codigo, "code_of_conduct"))
      .limit(1);

    if (result.length === 0) {
      res.status(404).json({
        message: "Código de conducta no encontrado"
      });
      return;
    }

    res.status(200).json(result[0]);

  } catch (error) {
    res.status(500).json({
      message: "Error obteniendo código de conducta",
      error
    });
  }
};

export const getPrivacyPolicy = async (req: AuthRequest, res: Response): Promise<void> => {
  try {

    const result = await db
      .select()
      .from(schema.texto_aplicacion)
      .where(eq(schema.texto_aplicacion.codigo, "privacy_policy"))
      .limit(1);

    if (result.length === 0) {
      res.status(404).json({
        message: "Política de privacidad no encontrada"
      });
      return;
    }

    res.status(200).json(result[0]);

  } catch (error) {
    res.status(500).json({
      message: "Error obteniendo política de privacidad",
      error
    });
  }
};

export const getTerms = async (req: AuthRequest, res: Response): Promise<void> => {
  try {

    const result = await db
      .select()
      .from(schema.texto_aplicacion)
      .where(eq(schema.texto_aplicacion.codigo, "terms"))
      .limit(1);

    if (result.length === 0) {
      res.status(404).json({
        message: "Términos y condiciones no encontrados"
      });
      return;
    }

    res.status(200).json(result[0]);

  } catch (error) {
    res.status(500).json({
      message: "Error obteniendo términos y condiciones",
      error
    });
  }
};