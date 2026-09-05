ALTER TABLE "mensajes_chat" ADD COLUMN IF NOT EXISTS "sentimiento" varchar(10);
--> statement-breakpoint
ALTER TABLE "mensajes_chat" ADD COLUMN IF NOT EXISTS "confianza" numeric(5,3);
--> statement-breakpoint
ALTER TABLE "mensajes_chat" ADD COLUMN IF NOT EXISTS "sentimiento_scores" jsonb;
