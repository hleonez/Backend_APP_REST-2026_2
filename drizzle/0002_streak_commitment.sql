ALTER TABLE "usuarios" ADD COLUMN IF NOT EXISTS "streak_goal_days" integer DEFAULT 7 NOT NULL;
--> statement-breakpoint
ALTER TABLE "usuarios" ADD COLUMN IF NOT EXISTS "streak_count" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "usuarios" ADD COLUMN IF NOT EXISTS "streak_last_date" date;
--> statement-breakpoint
ALTER TABLE "usuarios" ADD COLUMN IF NOT EXISTS "streak_goal_set" boolean DEFAULT false NOT NULL;
