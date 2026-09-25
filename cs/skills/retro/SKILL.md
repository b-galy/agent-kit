---
name: retro
description: End-of-run retrospective — reflect on the durable learnings from the run that just finished and post them as retro suggestions in Castalie for later human review. Additive and non-blocking; it edits nothing and never fails the run. Targets the plugin's own skills or your CLAUDE.md, never your product code.
---

# retro — capture durable learnings after a run

After a delivery, reflect on what would make the *next* run better and post it as a suggestion in Castalie
for a human to review later. It **decides nothing, edits nothing, asks nothing** — it only proposes. Its
failure must never fail the run that called it. The one question it may ask is the line before a kit
improvement leaves the workspace, and only with a person there (step 3).

## When it fires

Invoked at the end of `feature-implement`, `ship`, or `feature-followup` (or by the user directly). Runs
in the background of a completed parcours.

## What to look for

Durable, cross-run lessons — not one-off incidents:

- A convention the run had to rediscover the hard way (belongs in your `CLAUDE.md` / a skill).
- A step in a plugin skill that misfired or was ambiguous.
- A repeated correction the user made that should become a rule.

Ignore anything specific to this one task — a retro captures the *rule*, not the incident.

## Steps

1. Review the run: where did friction, rework, or a user correction happen?
2. For each durable learning, post one suggestion:
   `mcp__castalie__retro_suggestion_add(source="<origin skill>", target_kind="instruction|skill|command|doc",
   target_file="<path where the rule should live>", title, summary)`.
   The `summary` is the lesson **plus** the rule to encode — a reviewer should be able to act on it
   without more context. `target_file` is a pointer, never the file's content.
3. A learning that targets **the kit itself** — a file under `${CLAUDE_PLUGIN_ROOT}` — goes to the
   team that publishes the kit, but only with a person there: `cs on-behalf` says whether the session
   is attended (`${CLAUDE_PLUGIN_ROOT}/instructions/on-whose-behalf.md`). Ask in one line (the kit
   file as `cs/<path>`, the lesson in one sentence); on yes call
   `mcp__castalie__kit_feedback_send(target_file, title, summary, proposed_diff, kit_version)` instead
   of `retro_suggestion_add`, the version as `cs version` prints it. Unattended, on no, or on
   `kit_feedback_disabled`, it stays local with `retro_suggestion_add`.
4. Report in one line how many suggestions you posted and how many were sent; do nothing else.

## Discipline

- **Never blocks.** On any error, log it and return — the calling skill must not fail because retro did.
- **Targets config, never product code.** A retro suggestion improves how the assistant works (skills,
  your `CLAUDE.md`, docs) — it never proposes a change to your application's source, and it never sends
  code to Castalie. What `kit_feedback_send` carries names kit paths and kit wording only.
- **The rule survives, the incident does not.** Write the general rule, drop the ticket/PR particulars.
