CREATE TABLE "day_log_search_evidence" (
	"entry_date" date NOT NULL,
	"token" text NOT NULL,
	"position" integer NOT NULL,
	"excerpt" text NOT NULL,
	"match_start" integer NOT NULL,
	"match_length" integer NOT NULL,
	"anchor_length" integer NOT NULL,
	CONSTRAINT "day_log_search_evidence_bounded" CHECK (octet_length("day_log_search_evidence"."excerpt") <= 960),
	CONSTRAINT "day_log_search_evidence_range" CHECK ("day_log_search_evidence"."match_start" >= 0 and "day_log_search_evidence"."match_length" >= 1 and "day_log_search_evidence"."anchor_length" >= 1 and "day_log_search_evidence"."anchor_length" <= "day_log_search_evidence"."match_length" and "day_log_search_evidence"."match_start" + "day_log_search_evidence"."match_length" <= char_length("day_log_search_evidence"."excerpt"))
);
--> statement-breakpoint
ALTER TABLE "agent_area" ADD COLUMN "day_log" text;--> statement-breakpoint
ALTER TABLE "agent_area" ADD COLUMN "day_log_search_token_text" text;--> statement-breakpoint
ALTER TABLE "agent_area" ADD COLUMN "day_log_search_vector" "tsvector" GENERATED ALWAYS AS (case when day_log_search_token_text = '' then ''::tsvector else array_to_tsvector(string_to_array(day_log_search_token_text, ' ')) end) STORED;--> statement-breakpoint
ALTER TABLE "day_log_search_evidence" ADD CONSTRAINT "day_log_search_evidence_entry_date_agent_area_entry_date_fk" FOREIGN KEY ("entry_date") REFERENCES "public"."agent_area"("entry_date") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "day_log_search_evidence_prefix" ON "day_log_search_evidence" USING btree ("entry_date","token" collate "C");--> statement-breakpoint
CREATE INDEX "agent_area_day_log_search_vector_index" ON "agent_area" USING gin ("day_log_search_vector");--> statement-breakpoint
ALTER TABLE "agent_area" ADD CONSTRAINT "agent_area_day_log_with_wrap" CHECK ("agent_area"."day_log" is null or "agent_area"."report_html" is not null);--> statement-breakpoint
ALTER TABLE "agent_area" ADD CONSTRAINT "agent_area_day_log_bounded" CHECK ("agent_area"."day_log" is null or (char_length("agent_area"."day_log") <= 20000 and "agent_area"."day_log" ~ '[^[:space:]]'));--> statement-breakpoint
ALTER TABLE "agent_area" ADD CONSTRAINT "agent_area_day_log_indexed" CHECK (num_nonnulls("agent_area"."day_log", "agent_area"."day_log_search_token_text") in (0, 2));