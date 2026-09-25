CREATE TABLE "entry_search_evidence" (
	"entry_date" date NOT NULL,
	"kind" text NOT NULL,
	"token" text NOT NULL,
	"position" integer NOT NULL,
	"excerpt" text NOT NULL,
	"match_start" integer NOT NULL,
	"match_length" integer NOT NULL,
	CONSTRAINT "entry_search_evidence_bounded" CHECK (octet_length("entry_search_evidence"."excerpt") <= 960),
	CONSTRAINT "entry_search_evidence_kind" CHECK ("entry_search_evidence"."kind" in ('evening', 'scripture-notes', 'passage-reference')),
	CONSTRAINT "entry_search_evidence_range" CHECK ("entry_search_evidence"."match_start" >= 0 and "entry_search_evidence"."match_length" >= 1 and "entry_search_evidence"."match_start" + "entry_search_evidence"."match_length" <= char_length("entry_search_evidence"."excerpt"))
);
--> statement-breakpoint
ALTER TABLE "entry" ADD COLUMN "search_evidence_revision" integer;--> statement-breakpoint
ALTER TABLE "entry_search_evidence" ADD CONSTRAINT "entry_search_evidence_entry_date_entry_entry_date_fk" FOREIGN KEY ("entry_date") REFERENCES "public"."entry"("entry_date") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "entry_search_evidence_prefix" ON "entry_search_evidence" USING btree ("entry_date","kind","token" collate "C");