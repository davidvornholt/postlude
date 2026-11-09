-- The text of /wrap's report as a reader sees it: the HTML without its
-- scripts, styles, title, drawings and tags, with its character references
-- decoded, in NFKC as the app's search text is, and with its white space
-- collapsed. Scripts go first, so markup quoted in one can't end a style or a
-- drawing early. The generated columns below are stored, so this must stay immutable:
-- changing what it returns needs a new function and new columns.
CREATE FUNCTION report_plain_text(html text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
RETURN btrim(regexp_replace(normalize(coalesce((
  SELECT string_agg(CASE
      WHEN part[4] IS NOT NULL THEN part[4]
      WHEN part[3] = 'amp' THEN '&'
      WHEN part[3] = 'lt' THEN '<'
      WHEN part[3] = 'gt' THEN '>'
      WHEN part[3] = 'quot' THEN '"'
      WHEN part[3] = 'apos' THEN ''''
      WHEN part[3] = 'nbsp' THEN ' '
      WHEN code BETWEEN 1 AND 1114111 AND code NOT BETWEEN 55296 AND 57343 THEN chr(code)
      ELSE chr(65533)
    END, '' ORDER BY place)
  FROM regexp_matches(
    regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(html,
      '<script\M.*?</script\s*>', ' ', 'gi'),
      '<style\M.*?</style\s*>', ' ', 'gi'),
      '<title\M.*?</title\s*>', ' ', 'gi'),
      '<svg\M.*?</svg\s*>', ' ', 'gi'),
      '<[a-zA-Z/!?][^>]*>', ' ', 'g'),
    '&#([0-9]{1,7});|&#[xX]([0-9a-fA-F]{1,6});|&(amp|lt|gt|quot|apos|nbsp);|([^&]+|&)', 'g'
  ) WITH ORDINALITY AS found(part, place)
  CROSS JOIN LATERAL (
    SELECT coalesce(part[1]::integer, ('x' || lpad(part[2], 8, '0'))::bit(32)::integer) AS code
  ) AS reference
), ''), NFKC), '\s+', ' ', 'g'));--> statement-breakpoint
ALTER TABLE "agent_area" ADD COLUMN "report_text" text GENERATED ALWAYS AS (report_plain_text(report_html)) STORED;--> statement-breakpoint
ALTER TABLE "agent_area" ADD COLUMN "report_search_vector" "tsvector" GENERATED ALWAYS AS (to_tsvector('simple', regexp_replace(translate(lower(report_plain_text(report_html) collate "pg_c_utf8"), 'ς', 'σ'), '[^[:alnum:]]+', ' ', 'g'))) STORED;--> statement-breakpoint
CREATE INDEX "agent_area_report_search_vector_index" ON "agent_area" USING gin ("report_search_vector");
