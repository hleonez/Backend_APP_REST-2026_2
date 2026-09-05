-- Fase 5: semáforo con subcategorías y dimensiones

ALTER TABLE "preguntas_registro_emocional" ADD COLUMN IF NOT EXISTS "categoria" varchar(80) DEFAULT 'general' NOT NULL;
--> statement-breakpoint

ALTER TABLE "evaluaciones" ADD COLUMN IF NOT EXISTS "subcategoria_principal" varchar(80);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "semaforo_dimensiones" (
	"id" serial PRIMARY KEY NOT NULL,
	"evaluacion_id" integer,
	"dimension" varchar(80) NOT NULL,
	"puntaje" integer NOT NULL,
	"nivel" varchar(20) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_semaforo_dimensiones_evaluacion_id" ON "semaforo_dimensiones" ("evaluacion_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_semaforo_dimensiones_dimension" ON "semaforo_dimensiones" ("dimension");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_preguntas_registro_emocional_categoria" ON "preguntas_registro_emocional" ("categoria");
--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "semaforo_dimensiones" ADD CONSTRAINT "semaforo_dimensiones_evaluacion_id_evaluaciones_id_fk" FOREIGN KEY ("evaluacion_id") REFERENCES "evaluaciones"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
