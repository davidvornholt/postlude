CREATE TABLE "entry" (
	"entry_date" date PRIMARY KEY NOT NULL,
	"journal_markdown" text,
	"journal_word_count" integer DEFAULT 0 NOT NULL,
	"scripture_markdown" text,
	"scripture_word_count" integer DEFAULT 0 NOT NULL,
	"scripture_book" text,
	"scripture_chapter" integer,
	"scripture_verse_start" integer,
	"scripture_verse_end" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "entry_journal_word_count_non_negative" CHECK ("entry"."journal_word_count" >= 0),
	CONSTRAINT "entry_scripture_word_count_non_negative" CHECK ("entry"."scripture_word_count" >= 0),
	CONSTRAINT "entry_scripture_reference_complete" CHECK (num_nonnulls("entry"."scripture_book", "entry"."scripture_chapter", "entry"."scripture_verse_start") in (0, 3)),
	CONSTRAINT "entry_scripture_verse_end_after_start" CHECK ("entry"."scripture_verse_end" is null or ("entry"."scripture_verse_start" is not null and "entry"."scripture_verse_end" >= "entry"."scripture_verse_start")),
	CONSTRAINT "entry_scripture_chapter_positive" CHECK ("entry"."scripture_chapter" is null or "entry"."scripture_chapter" >= 1),
	CONSTRAINT "entry_scripture_verse_start_positive" CHECK ("entry"."scripture_verse_start" is null or "entry"."scripture_verse_start" >= 1),
	CONSTRAINT "entry_scripture_book_not_blank" CHECK ("entry"."scripture_book" is null or "entry"."scripture_book" ~ '[^[:space:]]')
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"issuer" text NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "account_issuer_account_id_unique" ON "account" USING btree ("issuer","account_id");