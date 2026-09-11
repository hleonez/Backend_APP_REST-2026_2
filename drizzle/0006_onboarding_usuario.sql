-- Fase 7: Agregar columna onboarding_completado a usuarios
ALTER TABLE "usuarios" ADD COLUMN IF NOT EXISTS "onboarding_completado" boolean DEFAULT false NOT NULL;
