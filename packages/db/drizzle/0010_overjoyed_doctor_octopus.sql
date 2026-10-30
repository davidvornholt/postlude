-- The agent role reads David's days and writes only the /wrap columns of the
-- agent area. On prod-1 the infrastructure creates it as a login role with peer
-- authentication before this migration runs, and the app's role can't create
-- roles, so a missing role fails the deploy here. Development, CI, and preview
-- databases get a role without login, so the grants and their tests run there.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'postlude_agent') THEN
    CREATE ROLE postlude_agent NOLOGIN;
  END IF;
EXCEPTION
  -- Another database's migration created it between the check and the create.
  WHEN duplicate_object OR unique_violation THEN NULL;
END
$$;
--> statement-breakpoint
GRANT SELECT ON TABLE entry, entry_search_evidence, day_rating TO postlude_agent;
--> statement-breakpoint
GRANT SELECT (entry_date, day_metrics, metrics_version, report_html, report_model, report_generated_at)
  ON TABLE agent_area TO postlude_agent;
--> statement-breakpoint
GRANT INSERT (entry_date, day_metrics, metrics_version, report_html, report_model, report_generated_at)
  ON TABLE agent_area TO postlude_agent;
--> statement-breakpoint
GRANT UPDATE (day_metrics, metrics_version, report_html, report_model, report_generated_at)
  ON TABLE agent_area TO postlude_agent;
