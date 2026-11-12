-- Reports become documents Postlude draws. The text of a report is now written
-- with it, by whoever writes the report, because the order of a document's
-- words can't be read back out of jsonb. A report stored as a page keeps the
-- text report_plain_text extracted from it: dropping the expression keeps
-- every stored value. report_plain_text stays, so a converted report can get
-- its page's text back.
ALTER TABLE "agent_area" DROP CONSTRAINT "agent_area_wrap_complete";--> statement-breakpoint
ALTER TABLE "agent_area" ALTER COLUMN "report_text" DROP EXPRESSION;--> statement-breakpoint
-- Setting the expression rewrites the column and its index in place.
ALTER TABLE "agent_area" ALTER COLUMN "report_search_vector" SET EXPRESSION AS (to_tsvector('simple', regexp_replace(translate(lower(left(report_text, 100000) collate "pg_c_utf8"), 'ς', 'σ'), '[^[:alnum:]]+', ' ', 'g')));--> statement-breakpoint
ALTER TABLE "agent_area" ADD COLUMN "report_document" jsonb;--> statement-breakpoint
ALTER TABLE "agent_area" ADD CONSTRAINT "agent_area_report_document_object" CHECK ("agent_area"."report_document" is null or jsonb_typeof("agent_area"."report_document") = 'object');--> statement-breakpoint
ALTER TABLE "agent_area" ADD CONSTRAINT "agent_area_wrap_complete" CHECK (num_nonnulls("agent_area"."day_metrics", "agent_area"."metrics_version", coalesce("agent_area"."report_document", to_jsonb("agent_area"."report_html")), "agent_area"."report_text", "agent_area"."report_model", "agent_area"."report_generated_at") in (0, 6));--> statement-breakpoint
-- /wrap writes the document and its text through the CLI, and reads back the
-- document. It may still read a page it stored before, and clear it when it
-- stores a document over it, but no longer store one.
GRANT SELECT (report_document) ON TABLE agent_area TO postlude_agent;--> statement-breakpoint
GRANT INSERT (report_document, report_text) ON TABLE agent_area TO postlude_agent;--> statement-breakpoint
GRANT UPDATE (report_document, report_text) ON TABLE agent_area TO postlude_agent;--> statement-breakpoint
REVOKE INSERT (report_html) ON TABLE agent_area FROM postlude_agent;
