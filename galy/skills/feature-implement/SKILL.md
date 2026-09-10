---
name: feature-implement
description: Implement a Galy spec autonomously in your own repository — claim the spec, read its phases, code phase by phase with a cron watchdog as a safety net, verify against the acceptance tests, and end at "PR ready". Never merges (that is your CI/process). Reads the spec from Galy; the code never leaves your machine.
---

# feature-implement — autonomous implementation loop

Implement a complete `feature_spec` from Galy, autonomously, in the client's own repository. Reads the
plan from Galy, writes code locally, reports phase statuses back to Galy, and ends at **PR ready** — the
merge is always your own CI/process (extension point).

## Arguments

- `<specId>` — required.
- `--continue` — internal flag injected by the watchdog cron on resume. Never type it by hand.

## Operating model

The developer typed the command, then walks away and comes back to a ready PR. After the spec is loaded,
**run continuously in the same turn** — implement, build, test, next phase — until every phase is ✅ and
the PR is ready. A `watchdog cron` (every ~20 min) is armed **as a safety net**, not an iterator: if the
turn dies, a new turn resumes with `--continue`. If the turn finishes the whole spec in one go, the
watchdog never fires — ideal.

## Steps

1. **Lock the spec.** `mcp__bg__whoami` → userId. `mcp__bg__feature_spec_pick(specId, userId)`.
   `success:false` → it is held by `current_lead_name`; stop, ask them to release it. (Skip on `--continue`.)
2. **Arm the watchdog once** (skip on `--continue` or if `CronList` already shows one for this spec):
   `CronCreate(cron: "7,27,47 * * * *", prompt: "/feature-implement <specId> --continue", durable: true)`.
3. **Read the spec.** `mcp__bg__feature_spec_get(specId)` for phases (id + status), risks, acceptance
   tests. `bg content pull feature-spec <specId>` then read the buffer for the solution body. Skip
   `Done` phases; finish `InProgress` ones first; target `NotStarted` next.
4. **Implement phase by phase, same turn.** For each phase:
   - Mark it `mcp__bg__feature_spec_set_phase_status(phaseId, status="InProgress")`.
   - Read `${CLAUDE_PLUGIN_ROOT}/instructions/acceptance-criteria.md` and the phase's
     `validationCriterionMd`. Fill missing legacy cases before the relevant code and reuse exact
     existing coverage. Implement **one case at a time: relevant failing test → code → passing tests**,
     using the convention's proportional alternatives and resume rules. Follow the repo's own coding
     conventions. Cut PRs at natural seams; a small spec is a single PR.
   - Persist test references and observed evidence in the phase's coverage cells through
     `mcp__bg__feature_spec_update_phase(phaseId, validationCriterionMd=...)`, preserving expected outcomes.
   - Re-read the phase plan; if the implementation deviated, record it via
     `mcp__bg__feature_spec_update_phase(phaseId, actionPlanMd=<updated with a "deviation" note>)` —
     never silence a deviation.
   - Build + run the change to prove it works (not just green tests). On failure, fix and retry.
   - Reconcile every required case with executed evidence and the actual CI selection before marking
     it `mcp__bg__feature_spec_set_phase_status(phaseId, status="Done", prUrl=<your PR url>)`.
5. **Verify against acceptance tests.** Walk the spec's acceptance tests (see
   `${CLAUDE_PLUGIN_ROOT}/instructions/acceptance-criteria.md`); set each status; screenshot visual blocks.
6. **PR ready.** Invoke `ship` with the spec/phase ids and case evidence to open/finish the PR through
   the self-review panel; it reuses the coverage and checks for gaps. Apply the
   `feature-implement`/`merge_mode` default (see `${CLAUDE_PLUGIN_ROOT}/instructions/workflow-defaults.md`):
   `stop-before-merge` → stop at PR ready; `auto-merge` → hand the ready PR to your own merge process;
   `merge-and-release` → hand it over, then trigger your release too. **This kit never merges and never
   releases for you** — the value says where the loop stops handing over, never what Galy does. On a
   chain where merging already ships, the last two describe the same thing, and `ship`/`release_trigger`
   is what says so.
7. **Close.** `mcp__bg__feature_spec_complete(specId, prUrl)`. Adjust the brief's follow-up horizon if
   delivery slipped (follow-up conventions). Then invoke `retro` (additive, never blocking).
8. **Disarm the watchdog last** — `CronList` → `CronDelete` — only after the report is delivered.

## Autonomy contract

Runs for hours; the developer is gone. The only acceptable stops: a real merge conflict on business
logic, an unresolved business expectation that only the user can settle, a hard build/test failure
you cannot fix, or an action only the user can take (report it + the
resume command, then `CronDelete`). Naming, formatting, file layout, which seam to cut — decide from the
repo's patterns and keep going. You are not the final reviewer: build + the `ship` panel + your CI are
behind you. Continue independent work during a clarification; those later checks never authorize
silently changing a required outcome or treating an unverified case as complete.

## Report

Deliver the **ship — spec** variant from `${CLAUDE_PLUGIN_ROOT}/instructions/delivery-report.md`.
