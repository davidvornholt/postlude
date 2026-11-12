-- Every report is now a document, so the pages /wrap stored before documents
-- go, and with them the function that read a page's text. A day whose report
-- is still only a page fails the check added back below, so the migration
-- stops instead of losing that report.
ALTER TABLE "agent_area" DROP CONSTRAINT "agent_area_wrap_complete";--> statement-breakpoint
ALTER TABLE "agent_area" DROP COLUMN "report_html";--> statement-breakpoint
ALTER TABLE "agent_area" ADD CONSTRAINT "agent_area_wrap_complete" CHECK (num_nonnulls("agent_area"."day_metrics", "agent_area"."metrics_version", "agent_area"."report_document", "agent_area"."report_text", "agent_area"."report_model", "agent_area"."report_generated_at") in (0, 6));--> statement-breakpoint
DROP FUNCTION report_plain_text(text);
