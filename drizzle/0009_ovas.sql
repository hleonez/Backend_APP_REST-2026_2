CREATE TABLE IF NOT EXISTS "ovas" (
	"id" serial PRIMARY KEY NOT NULL,
	"creado_por" integer,
	"titulo" varchar(255) NOT NULL,
	"descripcion" text,
	"tipo_actividad" varchar(50) NOT NULL,
	"duracion_minutos" integer DEFAULT 5 NOT NULL,
	"storage_source" varchar(50) DEFAULT 'YOUTUBE' NOT NULL,
	"resource_url" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ova_reglas" (
	"id" serial PRIMARY KEY NOT NULL,
	"ova_id" integer NOT NULL,
	"creado_por" integer,
	"dimension" varchar(80),
	"nivel" varchar(20),
	"prioridad" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "chk_ova_reglas_dimension_o_nivel" CHECK (dimension IS NOT NULL OR nivel IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ova_asignaciones" (
	"id" serial PRIMARY KEY NOT NULL,
	"estudiante_id" integer NOT NULL,
	"ova_id" integer NOT NULL,
	"regla_id" integer,
	"pre_evaluacion_id" integer NOT NULL,
	"post_evaluacion_id" integer,
	"estado" varchar(30) DEFAULT 'PENDING' NOT NULL,
	"matched_dimension" varchar(80),
	"matched_nivel" varchar(20),
	"matched_subcategoria" varchar(120),
	"prioridad" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp,
	"liked" boolean,
	"rating" integer,
	"feedback_en" timestamp,
	"pre_puntaje" numeric(5, 2),
	"post_puntaje" numeric(5, 2),
	"delta_puntaje" numeric(5, 2),
	"pre_estado_semaforo" varchar(20),
	"post_estado_semaforo" varchar(20),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "chk_ova_asignaciones_rating" CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ovas_is_active" ON "ovas" ("is_active");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ovas_creado_por" ON "ovas" ("creado_por");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ova_reglas_ova_id" ON "ova_reglas" ("ova_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ova_reglas_is_active" ON "ova_reglas" ("is_active");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_ova_reglas_match_unique" ON "ova_reglas" ("ova_id", "dimension", "nivel") WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ova_asig_estudiante_estado" ON "ova_asignaciones" ("estudiante_id", "estado");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ova_asig_ova_id" ON "ova_asignaciones" ("ova_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ova_asig_post_eval_pend" ON "ova_asignaciones" ("post_evaluacion_id") WHERE "post_evaluacion_id" IS NULL AND "estado" = 'COMPLETED';
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_ova_asig_estudiante_ova_active" ON "ova_asignaciones" ("estudiante_id", "ova_id") WHERE "estado" IN ('PENDING', 'IN_PROGRESS') AND "deleted_at" IS NULL;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ovas" ADD CONSTRAINT "ovas_creado_por_usuarios_id_fk" FOREIGN KEY ("creado_por") REFERENCES "usuarios"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ova_reglas" ADD CONSTRAINT "ova_reglas_ova_id_ovas_id_fk" FOREIGN KEY ("ova_id") REFERENCES "ovas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ova_reglas" ADD CONSTRAINT "ova_reglas_creado_por_usuarios_id_fk" FOREIGN KEY ("creado_por") REFERENCES "usuarios"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ova_asignaciones" ADD CONSTRAINT "ova_asignaciones_estudiante_id_usuarios_id_fk" FOREIGN KEY ("estudiante_id") REFERENCES "usuarios"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ova_asignaciones" ADD CONSTRAINT "ova_asignaciones_ova_id_ovas_id_fk" FOREIGN KEY ("ova_id") REFERENCES "ovas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ova_asignaciones" ADD CONSTRAINT "ova_asignaciones_regla_id_ova_reglas_id_fk" FOREIGN KEY ("regla_id") REFERENCES "ova_reglas"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ova_asignaciones" ADD CONSTRAINT "ova_asignaciones_pre_evaluacion_id_evaluaciones_id_fk" FOREIGN KEY ("pre_evaluacion_id") REFERENCES "evaluaciones"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ova_asignaciones" ADD CONSTRAINT "ova_asignaciones_post_evaluacion_id_evaluaciones_id_fk" FOREIGN KEY ("post_evaluacion_id") REFERENCES "evaluaciones"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
