-- Migration 0007: Campos de personalización y asignación de actividades por psicólogo
ALTER TABLE "registro_actividades_usuarios" 
  ADD COLUMN IF NOT EXISTS "asignado_por_id" integer REFERENCES "usuarios"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "titulo_personalizado" varchar(255),
  ADD COLUMN IF NOT EXISTS "descripcion_personalizada" text,
  ADD COLUMN IF NOT EXISTS "dimension_objetivo" varchar(80),
  ADD COLUMN IF NOT EXISTS "prioridad" varchar(20) DEFAULT 'media' NOT NULL,
  ADD COLUMN IF NOT EXISTS "estado" varchar(30) DEFAULT 'pendiente' NOT NULL,
  ADD COLUMN IF NOT EXISTS "fecha_completada" timestamp,
  ADD COLUMN IF NOT EXISTS "reflexiones_estudiante" text;

CREATE INDEX IF NOT EXISTS "idx_registro_actividades_usuarios_asignado_por" ON "registro_actividades_usuarios" ("asignado_por_id");
CREATE INDEX IF NOT EXISTS "idx_registro_actividades_usuarios_estado" ON "registro_actividades_usuarios" ("estado");
