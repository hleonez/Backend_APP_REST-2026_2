ALTER TABLE "mensajes_chat" ADD COLUMN IF NOT EXISTS "clef_raiz" varchar(64);
--> statement-breakpoint
ALTER TABLE "mensajes_chat" ADD COLUMN IF NOT EXISTS "clef_score_crisis" numeric(6, 4);
--> statement-breakpoint
ALTER TABLE "mensajes_chat" ADD COLUMN IF NOT EXISTS "clef_fuera_de_dominio" boolean;
