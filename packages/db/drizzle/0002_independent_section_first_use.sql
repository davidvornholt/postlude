ALTER TABLE "entry" ADD COLUMN "journal_first_used_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "entry" ADD COLUMN "scripture_first_used_at" timestamp with time zone;--> statement-breakpoint
UPDATE "entry"
SET "journal_first_used_at" = "created_at"
WHERE "journal_word_count" > 0;--> statement-breakpoint
UPDATE "entry"
SET "scripture_first_used_at" = "created_at"
WHERE "scripture_word_count" > 0
   OR "scripture_book" IS NOT NULL;
