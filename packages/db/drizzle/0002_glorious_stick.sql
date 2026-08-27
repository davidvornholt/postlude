ALTER TABLE "entry" ADD COLUMN "revision" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "entry" ADD CONSTRAINT "entry_revision_positive" CHECK ("entry"."revision" >= 1);