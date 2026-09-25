---
type: llm
weight: 1
---

The report skill must recognise a bug without asking a nature question, use the available
context instead of asking for it again, search for duplicates before creating anything, and make
at most one bug_create call. The call must use ticket_type=bug, source=mcp, format=true, and raw
text that preserves the original wording; it must not locally supply title, description_md,
severity, or feature_brief_id for the formatted path. The response must acknowledge the server's
returned proposal in one short line and end with exactly a ticket link in the form
`👁️ https://<space>/tickets/<id>`, with no text after it. The server, not the skill, owns the
Steps / Expected / Observed structure and `_Original wording:_` preservation.
