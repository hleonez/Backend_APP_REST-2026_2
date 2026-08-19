import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { generateToken } from '../config/jwt';
import { z } from 'zod';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../db';
import { usuarios, roles } from '../db/schema';
import { ROLES } from '../shared/const/roles.const';
import { RoleNombre } from '../shared/types/roles.types';

// Validation schemas
export const registerSchema = z.object({
  nombres: z.string().min(2, 'Nombre demasiado corto'),
  correo: z.string().email('Correo inválido'),
  contrasena: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  apellidos: z.string().min(2, 'Apellido demasiado corto'),
  telefono: z.string().min(7, 'Teléfono inválido'),
  ciudad: z.string().min(2, 'Ciudad demasiado corta'),
  edad: z.number().min(0, 'Edad inválida'),
  sexo: z.enum(['M', 'F']).optional(),
  semestre_actual: z.string().min(1).optional(),
  fecha_nacimiento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)').optional(),
});

const loginSchema = z.object({
  correo: z.string().email('Correo inválido'),
  contrasena: z.string(),
});

/**
 * Register a new user
 */
export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    // Validate request body
    const validationResult = registerSchema.safeParse(req.body);

    if (!validationResult.success) {
      res.status(400).json({
        message: 'Datos inválidos',
        errors: validationResult.error.errors
      });
      return;
    }

    const userData = validationResult.data;
    const correoNormalizado = userData.correo.toLowerCase().trim();

    // Check if user already exists
    const existingUser = await db
      .select({ id: usuarios.id })
      .from(usuarios)
      .where(eq(usuarios.correo, correoNormalizado))
      .limit(1);

    if (existingUser.length > 0) {
      res.status(409).json({ message: 'El correo ya está registrado' });
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(userData.contrasena, 10);

    // Resolver rol "usuario" por nombre (evita depender de IDs fijos)
    const [usuarioRole] = await db
      .select({ id: roles.id })
      .from(roles)
      .where(eq(roles.nombre, ROLES.USUARIO.nombre))
      .limit(1);

    if (!usuarioRole) {
      res.status(500).json({ message: 'El rol de usuario no está configurado' });
      return;
    }

    const rolUsuarioId = usuarioRole.id;

    // Create user - aseguramos que todos los campos requeridos están explícitamente establecidos
    const [newUser] = await db.insert(usuarios)
      .values({
        correo: correoNormalizado,
        contrasena: hashedPassword,
        nombres: userData.nombres,
        apellidos: userData.apellidos,
        telefono: userData.telefono,
        ciudad: userData.ciudad,
        edad: userData.edad,
        sexo: userData.sexo,
        semestre_actual: userData.semestre_actual,
        fecha_nacimiento: userData.fecha_nacimiento,
        id_rol: rolUsuarioId,
      })
      .returning({
        id: usuarios.id,
        correo: usuarios.correo,
        nombres: usuarios.nombres,
        apellidos: usuarios.apellidos,
      });

    // Generate token
    const token = generateToken({
      id: newUser.id,
      correo: newUser.correo,
      role: ROLES.USUARIO.nombre // Cuando se quiera usar un rol por favor usar el objeto ROLES para mantener consistencia
    });

    // Return user data and token
    res.status(201).json({
      message: 'Usuario registrado exitosamente',
      user: newUser,
      token
    });

  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
};

/**
 * Login user or psychologist
 */
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    // Validate request body
    const validationResult = loginSchema.safeParse(req.body);

    if (!validationResult.success) {
      res.status(400).json({
        message: 'Datos inválidos',
        errors: validationResult.error.errors
      });
      return;
    }

    const { correo, contrasena } = validationResult.data;
    const correoNormalizado = correo.toLowerCase().trim();

    const results = await db
      .select({
        id: usuarios.id,
        correo: usuarios.correo,
        contrasena: usuarios.contrasena,
        nombres: usuarios.nombres,
        apellidos: usuarios.apellidos,
        id_rol: usuarios.id_rol,
      })
      .from(usuarios)
      .where(and(
        eq(usuarios.correo, correoNormalizado),
        isNull(usuarios.deleted_at),
        eq(usuarios.is_active, true),
      ))
      .limit(1);

    if (results.length === 0) {
      res.status(401).json({ message: 'Credenciales inválidas' });
      return;
    }

    const user = results[0];

    const passwordMatch = await bcrypt.compare(contrasena, user.contrasena);
    if (!passwordMatch) {
      res.status(401).json({ message: 'Credenciales inválidas' });
      return;
    }

    let rol: RoleNombre;

    switch (user.id_rol) {
      case 1: rol = ROLES.ADMIN.nombre;
        break;

      case 2: rol = ROLES.PSICOLOGO.nombre;
        break;

      case 4: rol = ROLES.MODERADOR.nombre;
        break;

      case 5: rol = ROLES.INVITADO.nombre;
        break;

      default: rol = ROLES.USUARIO.nombre;
    }

    // Generate token
    const token = generateToken({ 
      id: user.id, 
      correo: user.correo, 
      role: rol 
    });

    // Return user data and token
    res.json({
      message: 'Inicio de sesión exitoso',
      user: {
        id: user.id,
        correo: user.correo,
        nombres: user.nombres,
        apellidos: user.apellidos,
      },
      token
    });

  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
}; 

/**
 * Recover user password
 */
export const recoverPassword = async (
  _req: Request,
  res: Response,
): Promise<void> => {
  res.status(410).json({ message: 'La recuperación de contraseña no está disponible actualmente' });
};