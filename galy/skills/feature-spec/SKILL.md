---
name: feature-spec
description: Turn a Galy brief into a technical spec — explore your own codebase, weigh design options, then write phases, risks and acceptance tests. Writes the spec via the Galy MCP and its body via the bg CLI. Your code stays local; only the plan and its metadata go to Galy.
---

# feature-spec — write the technical spec for a brief

Turn a `feature_brief` into a `feature_spec`: the technical approach, cut into phases, with risks and
acceptance tests. You explore the client's codebase **locally** to ground the plan; only the plan text
and metadata are written to Galy.

## Arguments

- `create --feature <briefId>` — create a new spec under a brief.
- `edit <specId>` — amend an existing spec.

## Model

A dev should be able to read the spec top-to-bottom and implement it. The executive summary orients
them; the active phase's plan and cases are required before coding. The body lives in a local buffer
synced by the CLI.

## Steps

1. **Load the brief.** `mcp__bg__feature_brief_get(briefId)` for metadata; `bg content pull
   feature-brief <briefId>` then read the buffer for the problem/vision. Fetch the objective header with
   `mcp__bg__strategy_get_objective_breadcrumb`.
2. **Explore the codebase — locally.** Use Read/Grep/Glob over the client's repository to find where the
   change lands, the existing patterns to follow, the seams to cut phases along. This never leaves the
   machine — Galy sees none of it.
3. **Design.** Weigh 1-2 realistic options; pick the durable one (implementation speed is never a factor
   — see the repo's own conventions). If a decision is genuinely contested, invoke `contrarian` before
   committing.
   Read `${CLAUDE_PLUGIN_ROOT}/instructions/acceptance-criteria.md` and define each phase's **Cases to
   cover** before its action plan: concrete states, expected outcomes, forbidden effects, verification
   level and existing coverage. Resolve meaningful business ambiguities before handoff. Plan scenarios,
   not executable test code; use proportional alternatives for wording, spacing or instruction changes.
4. **Create the spec (metadata only):**
   `mcp__bg__feature_spec_create(featureBriefId=<briefId>, title, scope, category, initialEstimateHours?)`
   → capture `spec_id`. Write the body via `bg content pull feature-spec <spec_id>`, edit the buffer
   (fields `executive`, `problem`, `solution`), `bg content push feature-spec <spec_id>`.
5. **Phases.** One `mcp__bg__feature_spec_add_phase(specId, title, objectiveMd, actionPlanMd,
   validationCriterionMd, estimateHours)` per phase — cut at natural seams (layers, page sets,
   independent modules), each a coherent unit an implementer can finish and verify. Store its observable
   completion criterion and case table in `validationCriterionMd`; no separate database structure.
6. **Risks.** `mcp__bg__feature_spec_add_risk(specId, label, riskType, severity, probability, mitigation)`
   for each real risk (technical/business/timeline).
7. **Acceptance tests.** `mcp__bg__feature_spec_add_acceptance_test(specId, kind, label, verificationMd)`
   — how the assistant will verify each outcome at end of dev (a URL, a command, a query — never code).
   Follow `${CLAUDE_PLUGIN_ROOT}/instructions/acceptance-criteria.md`.
8. **Follow-up.** Add technical follow-up checks and set the first horizon per
   `${CLAUDE_PLUGIN_ROOT}/instructions/followup-conventions.md` via `mcp__bg__followup_check_add(featureSpecId=<spec_id>, checkType="technical", …)`.

## Confirmation

Print the spec title, its phases, and a clickable Galy link; point to `feature-implement <spec_id>` as
the next step.

## Discipline

- **Body and code stay local.** Only plan text and metadata reach Galy — never a file's contents or a diff.
- **Empty phases = unfinished spec.** Never hand an implementer a spec with no phases.
- **Check case completeness before handoff.** Each phase has concrete expected outcomes, suitable
  verification and existing tests considered; a green CI alone is never its completion criterion.
- **Acceptance tests describe *how to check*, not code.** URLs, commands, queries.
