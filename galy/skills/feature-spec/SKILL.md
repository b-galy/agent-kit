---
name: feature-spec
description: Turn a Castalie brief into a technical spec — explore your own codebase, weigh design options, then write phases, risks and acceptance tests. Writes the spec via the Castalie MCP and its body via the cs CLI. Your code stays local; only the plan and its metadata go to Castalie.
---

# feature-spec — write the technical spec for a brief

Turn a `feature_brief` into a `feature_spec`: the technical approach, cut into phases, with risks and
acceptance tests. You explore the client's codebase **locally** to ground the plan; only the plan text
and metadata are written to Castalie.

## Arguments

- `create --feature <briefId>` — create a new spec under a brief.
- `edit <specId>` — amend an existing spec.

## Model

A dev should be able to read the spec top-to-bottom and implement it. The executive summary orients
them; the active phase's plan and cases are required before coding. The body lives in a local buffer
synced by the CLI.

## Steps

1. **Load the brief.** `mcp__cs__feature_brief_get(briefId)` for metadata; `cs content pull
   feature-brief <briefId>` then read the buffer for the problem/vision. Fetch the objective header with
   `mcp__cs__strategy_get_objective_breadcrumb`.
2. **Explore the codebase — locally.** Use Read/Grep/Glob over the client's repository to find where the
   change lands, the existing patterns to follow, the seams to cut phases along. This never leaves the
   machine — Castalie sees none of it.
   **Read the host's own rules first**, following `${CLAUDE_PLUGIN_ROOT}/instructions/host-instructions.md`:
   the lines carrying `<!-- galy:instructions -->` in the root instruction file name the files a skill
   must open, and a marker naming `feature-spec` is addressed to you — their conventions, the writes
   that cost real data, how long a branch of theirs may live. A plan written against conventions nobody
   read is corrected phase by phase by the implementer, who then owns a design they did not choose.
   **Nothing names you, or there is no such line: say nothing and carry on.**
3. **Design.** Weigh **at least two** realistic options; pick the durable one (implementation speed is
   never a factor — see the repo's own conventions). Write the one you rejected and the criterion that
   separated them into the `solution` field: an option nobody wrote down is proposed again by the next
   reader, and the same argument is had twice, the second time without the facts. If a decision is
   genuinely contested, invoke `contrarian` before committing.
   Read `${CLAUDE_PLUGIN_ROOT}/instructions/acceptance-criteria.md` and define each phase's **Cases to
   cover** before its action plan: concrete states, expected outcomes, forbidden effects, verification
   level and existing coverage. Resolve meaningful business ambiguities before handoff. Plan scenarios,
   not executable test code; use proportional alternatives for wording, spacing or instruction changes.
4. **Adopt the spec that is already there, or create one.** Step 1 returned the brief with its child
   specs: one that is plainly this plan is the one you continue — `mcp__cs__feature_spec_get` it, and
   go on from the first thing it is missing, phases and risks included. **A run that died after the
   create leaves a spec with a title and no phases**, and the next run opens a second one; the
   implementer then claims whichever id they were handed, and the other plan is never built.
   Nothing matches →
   `mcp__cs__feature_spec_create(featureBriefId=<briefId>, title, scope, category, initialEstimateHours?)`
   → capture `spec_id`. Write the body via `cs content pull feature-spec <spec_id>`, edit the buffer
   (fields `executive`, `problem`, `solution`), `cs content push feature-spec <spec_id>`.
5. **Phases.** One `mcp__cs__feature_spec_add_phase(specId, title, objectiveMd, actionPlanMd,
   validationCriterionMd, estimateHours)` per phase — cut at natural seams (layers, page sets,
   independent modules), each a coherent unit an implementer can finish and verify. Store its observable
   completion criterion and case table in `validationCriterionMd`; no separate database structure.
   **Then say where the phases converge, in the first phase's plan.** A phase that reaches the default
   branch leaves the product in the state it left it, and on a chain where merging ships, that state is
   what customers get: when you would not show it, the phases land on an integration branch and one
   merge carries the whole thing. **Write that branch's name down** — an implementer who has to guess
   takes the default branch, the one guess nobody undoes quietly. **The kit names no duration.** How
   long a spec may run before its branch stops being able to follow the default one is a fact about a
   team's merge tempo, and a number that is wrong reads like a rule; where they have written one it is
   in the rules file their doctrine declares (step 2), and where nothing says, the state each phase
   leaves behind decides on its own.
6. **Risks.** `mcp__cs__feature_spec_add_risk(specId, label, riskType, severity, probability, mitigation)`
   for each real risk (technical/business/timeline).
7. **Acceptance tests.** `mcp__cs__feature_spec_add_acceptance_test(specId, kind, label, verificationMd)`
   — how the assistant will verify each outcome at end of dev (a URL, a command, a query — never code).
   Follow `${CLAUDE_PLUGIN_ROOT}/instructions/acceptance-criteria.md`.
8. **Follow-up.** Add technical follow-up checks and set the first horizon per
   `${CLAUDE_PLUGIN_ROOT}/instructions/followup-conventions.md` via `mcp__cs__followup_check_add(featureSpecId=<spec_id>, checkType="technical", …)`.
9. **Have it read by someone who did not write it**, before you print the link. Spawn one sub-agent
   with the brief and the spec as written, and ask it for what an implementer would have to invent: a
   phase whose completion cannot be observed, a case with no expected outcome, a user story no phase
   reaches, a risk with no mitigation. Same rule as the review panel
   (`${CLAUDE_PLUGIN_ROOT}/instructions/review-lenses.md`): it returns findings, never a verdict, and
   **nothing found is not a pass** — retry once, then read it yourself against that list. An author
   re-reading their own spec reads what they meant to write, which is why the gaps survive to the
   implementer, who fills them alone and unattended.

## Confirmation

Print the spec title, its phases, and a clickable Castalie link; point to `feature-implement <spec_id>` as
the next step.

## Discipline

- **Body and code stay local.** Only plan text and metadata reach Castalie — never a file's contents or a diff.
- **Empty phases = unfinished spec.** Never hand an implementer a spec with no phases.
- **Check case completeness before handoff.** Each phase has concrete expected outcomes, suitable
  verification and existing tests considered; a green CI alone is never its completion criterion.
- **Acceptance tests describe *how to check*, not code.** URLs, commands, queries.
