// Libs
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

// Types
import { RoleNombre } from '../shared/types/roles.types';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET?.trim();
const JWT_EXPIRE = process.env.JWT_EXPIRES_IN?.trim();

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is required');
}

if (!JWT_EXPIRE) {
  throw new Error('JWT_EXPIRES_IN is required');
}

export interface JwtPayload {
  id: number;
  correo: string;
  role: RoleNombre;
}

export const generateToken = (payload: JwtPayload): string => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRE as jwt.SignOptions['expiresIn'] });
};

export const verifyToken = (token: string): JwtPayload | null => {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch (error) {
    return null;
  }
}; 