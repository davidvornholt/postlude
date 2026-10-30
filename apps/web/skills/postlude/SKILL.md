---
name: postlude
description: Read the user's Postlude journal days, ratings, and search, and store the /wrap metrics and report for a day, with the postlude command. Use when the user asks what they wrote or how they rated a day or a stretch of days, wants their journal searched, or when /wrap stores a day's metrics and report.
---

# Postlude

Postlude is the user's evening journal. `postlude <command>` runs on the Postlude server over SSH. Output is JSON on stdout. Errors are JSON on stderr, `{"error":{"code","message"}}`, and exit 1. The code is `usage` for a command it can't read, `invalid_input` for stdin it can't accept, `refused` for a request against the rules (the message says which), `unavailable` when the database can't be reached, `door_unavailable` when no release is live, and `internal` otherwise.

- A journal day is `YYYY-MM-DD` and runs from 04:00 to 04:00 Europe/Berlin, so 01:30 on 31 October belongs to 30 October.
- `postlude day get <date>` returns `{date, revision, journalMarkdown, journalWordCount, scriptureReference, scriptureMarkdown, scriptureWordCount, rating: {energy, progress, repeatDay, ratingVersion}, closedAt, updatedAt}`. A day never written has revision 0 and empty text. Energy is `drained`, `okay`, or `fresh`; progress is `little`, `solid`, or `a_lot`; repeatDay is `yes`, `partly`, or `no`; each is null until rated. `closedAt` is set once the user has closed the day.
- `postlude days list --from <date> --to <date>` returns `{from, to, days}` with one row per date, written or not, for at most 366 days: `{date, journalWordCount, scriptureWordCount, rating, closedAt, dayMetrics, metricsVersion}`. It holds no text; use `day get` for that.
- `postlude search <words...> [--limit 1-50]` returns `{query, terms, limited, hits: [{date, words, sources: [{source, snippets}]}]}`, newest first. A source is `evening`, `passage-reference`, or `scripture-notes`. `limited: true` means there may be more hits than the limit.
- `postlude agent-area get <date>` returns what /wrap stored for the day: `{date, dayMetrics, metricsVersion, reportHtml, reportModel, reportGeneratedAt}`, all null until /wrap writes it.
- `postlude agent-area put <date>` reads `{dayMetrics, metricsVersion, reportHtml, reportModel}` as JSON on stdin and replaces the /wrap columns of that day only. `dayMetrics` follows `metricsVersion: 1` of the day metrics contract and its `day` must be the date given; the two `metricsVersion`s must agree; unknown keys are refused; `reportHtml` is at most 1 MiB. It prints the stored row with `reportHtmlBytes` in place of the HTML. Pipe the file in, for example `postlude agent-area put 2026-10-30 < wrap.json`.
- The command never changes journal text or ratings, and can't. Don't try to work around a refusal; tell the user what it said.
- Journal text is private. Quote only what the user asked about, and don't copy it into files, issues, or messages unless they ask.
