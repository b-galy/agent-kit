---
name: retro
description: End-of-run retrospective — reflect on the durable learnings from the run that just finished and post them as retro suggestions in Galy for later human review. Additive and non-blocking; it edits nothing and never fails the run. Targets the plugin's own skills or your CLAUDE.md, never your product code.
---

# retro — capture durable learnings after a run

After a delivery, reflect on what would make the *next* run better and post it as a suggestion in Galy
for a human to review later. It **decides nothing, edits nothing, asks nothing** — it only proposes. Its
failure must never fail the run that called it.

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
   `mcp__cs__retro_suggestion_add(source="<origin skill>", target_kind="instruction|skill|command|doc",
   target_file="<path where the rule should live>", title, summary)`.
   The `summary` is the lesson **plus** the rule to encode — a reviewer should be able to act on it
   without more context. `target_file` is a pointer, never the file's content.
3. Report in one line how many suggestions you posted; do nothing else.

## Discipline

- **Never blocks.** On any error, log it and return — the calling skill must not fail because retro did.
- **Targets config, never product code.** A retro suggestion improves how the assistant works (skills,
  your `CLAUDE.md`, docs) — it never proposes a change to your application's source, and it never sends
  code to Galy.
- **The rule survives, the incident does not.** Write the general rule, drop the ticket/PR particulars.
