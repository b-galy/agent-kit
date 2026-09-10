---
name: knowledge
description: Read, capture, review and publish workspace knowledge through B.Galy's durable source, citation and article contract; never keep a client wiki or local memory as the canonical store.
---

# knowledge — workspace knowledge in B.Galy

Use this skill when a user wants to capture a source, prepare a knowledge article, find reviewed
workspace knowledge, refresh evidence, or configure optional generation. B.Galy is the durable
system of record: source snapshots, versions, hashes, linked briefs/specs/tickets, article drafts
and publications, citations, dependencies, review issues, history, settings and maintenance jobs
all live behind the workspace MCP service. A checkout, a local wiki, an agent memory file and a
conversation transcript are not canonical knowledge stores.

## Read and search

Use `knowledge_source_list` and `knowledge_source_get` to inspect retained evidence. A source is
an immutable snapshot identified by its source id and exact version. Use `knowledge_search` or
`knowledge_list` for published articles; use `include_review=true` when the user explicitly wants
published articles requiring review. Find pending proposals with `knowledge_review_list` and inspect
them with `knowledge_get(include_review=true)`. `knowledge_get` returns the article's validity, versions,
citations, dependencies and open issues. Every result is scoped to the current tenant and the
same access rules apply to the browser and MCP.

## Capture evidence

Use `knowledge_source_create` for pasted text or Markdown and for snapshots linked to a B.Galy
brief, spec or bug. Give linked records their B.Galy type and id; do not paste a mutable external
record into an unlinked local file. Add a new immutable snapshot with `knowledge_source_add_version`
when the upstream revision changes. Use the supplied idempotency key when a retry could repeat a
write, and pass the expected concurrency token when editing an existing record. `knowledge_source_link`
changes provenance only after the target is checked in B.Galy.

## Propose and publish

Prepare an article with `knowledge_save_draft`. Include exact excerpts and their source version ids
in `citations_json`, and declare supporting articles or source versions in `dependencies_json`.
The service checks that every excerpt exists in the retained snapshot. A draft is a proposal, even
when it was prepared by an agent or an optional model. Present it for human review and use
`knowledge_publish` only with a verification note, complete coverage and current evidence.
`knowledge_reject` records a reason without changing the published version. Never describe a draft
or a successful lint job as published truth.

## Freshness and maintenance

Use `knowledge_refresh_request` or `knowledge_source_refresh` to create a durable job. Read it with
`knowledge_job_get`; cancel with `knowledge_job_cancel` when the user asks. `knowledge_review_list`
shows changed sources, missing evidence, deadlines, conflicts and proposals. Resolve each issue
with `knowledge_review_resolve` and a durable reason. A source revision or archive can invalidate
dependent articles; keep the review state visible until a new version is verified and published.
`knowledge_history` is the audit trail.

## Optional generation

Generation is tenant opt-in and runs as bounded background work in the B.Galy product. Inspect or
change the provider, model, approved credential, call limits and output budget with
`knowledge_settings_get` and `knowledge_settings_update`; the secret value never belongs in a
tool argument, article, source or local file. Select only credentials explicitly authorized by the
instance for this workspace. If generation is unavailable, use the manual draft
flow. Treat generated text as a proposal and retain its input manifest and citations before review.

## Rights and failure handling

The same tenant ACL applies to screen and MCP: active owners and members can edit, viewers can
read, and publication requires the owner or article owner. Never work around a `forbidden`,
`not_found`, `conflict`, `source_stale`, `source_unavailable`, `invalid_citation`,
`incomplete_coverage`, `generation_unavailable` or `budget_exceeded` result. Refresh the record
after a conflict, preserving the proposed text and comparing it with the current version before
retrying; ask the user for a review decision when the product needs one. Do not invent
success or copy durable knowledge into a client repository to bypass the boundary.
