import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import dotenv from 'dotenv';

dotenv.config();

// Función para parsear DATABASE_URL o usar variables individuales
function getDatabaseConfig() {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (databaseUrl) {
    // Si existe DATABASE_URL, parsearla
    const url = new URL(databaseUrl);
    return {
      host: url.hostname,
      port: parseInt(url.port) || 5432,
      user: url.username,
      password: url.password,
      database: url.pathname.slice(1), // Remove leading slash
    };
  }
  
  // Si no existe DATABASE_URL, usar variables individuales con valores por defecto
  return {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'mental_health_app',
  };
}

// Create PostgreSQL connection pool
const pool = new Pool(getDatabaseConfig());

// Create Drizzle instance with our schema
export const db = drizzle(pool, { schema });

// Export schema for use elsewhere
export { schema };

// Export the pool so observability can read its connection counters
export { pool }; 