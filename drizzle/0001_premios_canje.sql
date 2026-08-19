CREATE TABLE IF NOT EXISTS "premios" (
  "id" serial PRIMARY KEY NOT NULL,
  "nombre" varchar(255) NOT NULL,
  "descripcion" text,
  "estrellas_requeridas" integer NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "deleted_at" timestamp,
  CONSTRAINT "uq_premios_nombre" UNIQUE("nombre")
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "solicitudes_premios" (
  "id" serial PRIMARY KEY NOT NULL,
  "usuario_id" integer,
  "premio_id" integer,
  "estado" varchar(30) DEFAULT 'pendiente' NOT NULL,
  "estrellas_requeridas" integer NOT NULL,
  "periodo_anio" integer NOT NULL,
  "periodo_mes" integer NOT NULL,
  "solicitado_en" timestamp DEFAULT now() NOT NULL,
  "procesado_en" timestamp,
  "observaciones" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "deleted_at" timestamp
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_premios_estrellas_requeridas" ON "premios" ("estrellas_requeridas");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_solicitudes_premios_usuario_id" ON "solicitudes_premios" ("usuario_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_solicitudes_premios_premio_id" ON "solicitudes_premios" ("premio_id");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_solicitudes_premios_periodo" ON "solicitudes_premios" ("periodo_anio", "periodo_mes");
--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "solicitudes_premios" ADD CONSTRAINT "solicitudes_premios_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "solicitudes_premios" ADD CONSTRAINT "solicitudes_premios_premio_id_premios_id_fk" FOREIGN KEY ("premio_id") REFERENCES "premios"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
