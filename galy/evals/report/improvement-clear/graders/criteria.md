---
type: llm
weight: 1
---

The report skill must recognise an improvement without asking a nature question, use the available
context instead of asking for it again, search for duplicates before creating anything, and make at
most one bug_create call. The call must use ticket_type=feature, source=mcp, a title no longer than
255 characters, the three sections Who / Gain / Today, the exact `_Original wording:_` line, and no
severity field. The final assistant line must be exactly a ticket link in the form
`👁️ https://<space>/tickets/<id>`, with no text after it.
