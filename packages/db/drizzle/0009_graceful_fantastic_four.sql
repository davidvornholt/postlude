CREATE TABLE "agent_area" (
	"entry_date" date PRIMARY KEY NOT NULL,
	"day_metrics" jsonb,
	"metrics_version" integer,
	"report_html" text,
	"report_model" text,
	"report_generated_at" timestamp with time zone,
	"agent_note" text,
	"agent_note_model" text,
	"agent_note_revision" integer,
	"agent_note_status" text,
	"agent_note_error" text,
	"agent_note_requested_at" timestamp with time zone,
	"agent_note_generated_at" timestamp with time zone,
	CONSTRAINT "agent_area_wrap_complete" CHECK (num_nonnulls("agent_area"."day_metrics", "agent_area"."metrics_version", "agent_area"."report_html", "agent_area"."report_model", "agent_area"."report_generated_at") in (0, 5)),
	CONSTRAINT "agent_area_day_metrics_object" CHECK ("agent_area"."day_metrics" is null or jsonb_typeof("agent_area"."day_metrics") = 'object'),
	CONSTRAINT "agent_area_metrics_version_positive" CHECK ("agent_area"."metrics_version" is null or "agent_area"."metrics_version" >= 1),
	CONSTRAINT "agent_area_note_status" CHECK ("agent_area"."agent_note_status" in ('pending', 'ready', 'failed')),
	CONSTRAINT "agent_area_note_revision_non_negative" CHECK ("agent_area"."agent_note_revision" is null or "agent_area"."agent_note_revision" >= 0),
	CONSTRAINT "agent_area_note_without_status" CHECK ("agent_area"."agent_note_status" is not null or num_nonnulls("agent_area"."agent_note", "agent_area"."agent_note_model", "agent_area"."agent_note_revision", "agent_area"."agent_note_error", "agent_area"."agent_note_requested_at", "agent_area"."agent_note_generated_at") = 0),
	CONSTRAINT "agent_area_note_pending" CHECK ("agent_area"."agent_note_status" is distinct from 'pending' or "agent_area"."agent_note_requested_at" is not null),
	CONSTRAINT "agent_area_note_ready" CHECK ("agent_area"."agent_note_status" is distinct from 'ready' or num_nonnulls("agent_area"."agent_note", "agent_area"."agent_note_model", "agent_area"."agent_note_revision", "agent_area"."agent_note_generated_at") = 4),
	CONSTRAINT "agent_area_note_failed" CHECK ("agent_area"."agent_note_status" is distinct from 'failed' or "agent_area"."agent_note_error" is not null)
);
--> statement-breakpoint
CREATE TABLE "day_rating" (
	"entry_date" date PRIMARY KEY NOT NULL,
	"energy" text,
	"progress" text,
	"repeat_day" text,
	"rating_version" integer NOT NULL,
	"closed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "day_rating_energy_scale" CHECK ("day_rating"."energy" in ('drained', 'okay', 'fresh')),
	CONSTRAINT "day_rating_progress_scale" CHECK ("day_rating"."progress" in ('little', 'solid', 'a_lot')),
	CONSTRAINT "day_rating_repeat_day_scale" CHECK ("day_rating"."repeat_day" in ('yes', 'partly', 'no')),
	CONSTRAINT "day_rating_version_positive" CHECK ("day_rating"."rating_version" >= 1),
	CONSTRAINT "day_rating_closed_when_rated" CHECK ("day_rating"."closed_at" is null or ("day_rating"."energy" is not null and "day_rating"."progress" is not null))
);
