-- /wrap stores the day log with its report, through the same role, and replaces
-- the log's search evidence with it. The role reads nothing new of David's.
GRANT SELECT (day_log, day_log_search_token_text)
  ON TABLE agent_area TO postlude_agent;
--> statement-breakpoint
GRANT INSERT (day_log, day_log_search_token_text)
  ON TABLE agent_area TO postlude_agent;
--> statement-breakpoint
GRANT UPDATE (day_log, day_log_search_token_text)
  ON TABLE agent_area TO postlude_agent;
--> statement-breakpoint
GRANT SELECT, INSERT, DELETE ON TABLE day_log_search_evidence TO postlude_agent;
