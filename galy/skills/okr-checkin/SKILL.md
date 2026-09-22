---
name: okr-checkin
description: The check-in ritual — go through the key results you own in one pass, record where each one really stands (value, confidence, one sentence), and say what changed and what has just tipped into risk. Writes to Castalie through the MCP; every figure comes from the user, never from you.
---

# okr-checkin — record where the key results stand

The Monday-morning ritual. One pass over what the user owns, one question, then a dated trace on
every figure that moved. A check-in is signed and timestamped: it is what turns a number on a
screen into something someone said.

Reading the state of play without recording anything is `okr-review`.

## When it fires

- "point d'avancement", "check-in", "je mets à jour mes OKR", "let's update where we are".
- At the end of `okr-review`, when the user wants to record what the review just surfaced.

## Tools

- `mcp__castalie__whoami` — the author. The check-in is signed from the token, so nothing to pass.
- `mcp__castalie__strategy_my_okrs` — the key results the user owns, with their current value and
  `days_since_check_in`. This is the working list.
- `mcp__castalie__strategy_check_in_history` — the last check-ins of one key result, when the user
  asks what the previous value was or since when it has been stuck.
- `mcp__castalie__strategy_create_check_in` — the write: `key_result_id`, `new_value`, `confidence`,
  `comment`. It moves the key result's current value and refreshes every gauge above it, and
  returns the objectives whose progress changed.

## The one pass

1. `whoami`, then `strategy_my_okrs`. Announce the period you are working in.
2. **Show the whole list at once** — every key result the user owns, its current value, its target,
   and how long it has been silent. Order it as `okr-review` does: off track, at risk, silent,
   then the rest.
3. **Ask once**, in a single message: which ones moved, and for each the new value, the confidence
   (`on_track` / `at_risk` / `off_track`) and a sentence explaining the figure. One question per
   key result turns a five-minute ritual into an interrogation, and it is why check-ins stop
   happening.
4. Record each answer with `strategy_create_check_in`. Nothing else moves: a key result the user
   did not mention is left exactly as it is — silence is a fact worth keeping, not a gap to fill.
5. **Close on what changed**: the figures that moved and by how much, the objectives whose progress
   shifted (the tool hands them back), and above all **what has just tipped into risk** — a
   confidence that went from `on_track` to `at_risk` or `off_track` is the headline, not a detail.

## The three fields are mandatory

A check-in without all three is not worth recording:

- **The value** comes from the user. Never derive it from a percentage, never carry over the
  previous one to "have something", never round to make a target look reachable.
- **The confidence** comes from the user too, and it is not the value in disguise: a key result at
  30 % of its target can be `on_track` early in the quarter and `off_track` at the end. If the user
  gives a figure without a confidence, ask for that one thing.
- **The comment** is one sentence saying what explains the figure. It is what someone reads in
  three months when they wonder why the curve bends here. "MAJ" is not a comment.

## Discipline

- **Never invent a figure**, and never accept one you inferred yourself. If the user does not know
  a value, the key result stays untouched and you say it is still awaiting a check-in — an
  approximation recorded as a fact is worse than a hole.
- **Correcting is not reporting.** A figure entered by mistake is fixed with
  `strategy_update_key_result(current_value=…)`; a figure that has genuinely moved is recorded with
  a check-in, which leaves the trace. Never use one for the other.
- **You are not the author of the judgement.** The confidence is the owner's reading, not yours. You
  may point out that a pace no longer adds up; you do not change `on_track` into `at_risk` yourself.
- **One pass, then stop.** Do not chain into replanning, into creating key results, or into
  rewriting targets. Creating a key result is a strategic decision, made by the user in Castalie.
- **Name things, never ids** — titles and clickable links (`/strategie/resultat/<id>` on the
  workspace host), so the user can open what you just wrote to.

## Hand back

Close the turn on the state table and the lettered questions of
`${CLAUDE_PLUGIN_ROOT}/instructions/reply-format.md`.
