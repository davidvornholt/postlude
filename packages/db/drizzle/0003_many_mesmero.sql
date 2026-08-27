ALTER TABLE "entry" ADD COLUMN "journal_search_text" text NOT NULL;--> statement-breakpoint
ALTER TABLE "entry" ADD COLUMN "scripture_search_text" text NOT NULL;--> statement-breakpoint
ALTER TABLE "entry" ADD COLUMN "scripture_reference_search_text" text NOT NULL;--> statement-breakpoint
ALTER TABLE "entry" ADD COLUMN "search_vector" "tsvector" GENERATED ALWAYS AS (to_tsvector('simple', journal_search_text || ' ' || scripture_search_text || ' ' || scripture_reference_search_text)) STORED;--> statement-breakpoint
CREATE INDEX "entry_search_vector_index" ON "entry" USING gin ("search_vector");