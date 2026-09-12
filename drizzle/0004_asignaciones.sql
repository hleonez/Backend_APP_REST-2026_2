CREATE TABLE IF NOT EXISTS "asignaciones" (
	"id" serial PRIMARY KEY NOT NULL,
	"estudiante_id" integer,
	"psicologo_id" integer,
	"estado" varchar(30) DEFAULT 'pendiente' NOT NULL,
	"mensaje" text,
	"solicitado_en" timestamp DEFAULT now() NOT NULL,
	"procesado_en" timestamp,
	"finalizado_en" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_asignaciones_estudiante_id" ON "asignaciones" ("estudiante_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_asignaciones_psicologo_id" ON "asignaciones" ("psicologo_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_asignaciones_estudiante_aprobado" ON "asignaciones" ("estudiante_id") WHERE estado = 'aprobado' AND deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_asignaciones_estudiante_psicologo_pendiente" ON "asignaciones" ("estudiante_id","psicologo_id") WHERE estado = 'pendiente' AND deleted_at IS NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "asignaciones" ADD CONSTRAINT "asignaciones_estudiante_id_usuarios_id_fk" FOREIGN KEY ("estudiante_id") REFERENCES "usuarios"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "asignaciones" ADD CONSTRAINT "asignaciones_psicologo_id_usuarios_id_fk" FOREIGN KEY ("psicologo_id") REFERENCES "usuarios"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
