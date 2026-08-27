ALTER TABLE "entry" ALTER COLUMN "journal_search_text" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "entry" ALTER COLUMN "scripture_search_text" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "entry" ALTER COLUMN "scripture_reference_search_text" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "entry" ALTER COLUMN "search_token_text" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "entry" ALTER COLUMN "search_projection_revision" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "entry" ADD COLUMN "search_vector" "tsvector" GENERATED ALWAYS AS (case when search_token_text = '' then ''::tsvector else array_to_tsvector(string_to_array(search_token_text, ' ')) end) STORED;--> statement-breakpoint
CREATE INDEX "entry_search_vector_index" ON "entry" USING gin ("search_vector");--> statement-breakpoint
ALTER TABLE "entry" ADD CONSTRAINT "entry_search_projection_current" CHECK ("entry"."search_projection_revision" = "entry"."revision");