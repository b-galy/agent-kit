---
name: okr-review
description: The state of play of your objectives, read-only — the tree with its progress, and the key results that are off track or that nobody has reported on in a fortnight, at the top. Use it before a review, at the start of a quarter check, or whenever someone asks how the period is going. Reads via the Castalie MCP; writes nothing.
---

# okr-review — where the objectives really stand

A stocktake, not a conversation. It reads the objectives of one period, ranks the key results by
how much doubt they carry, and says for each what is left to close. Output is your analysis, in the
user's language.

It **writes nothing**. Recording a figure is `okr-checkin`; mapping a piece of work to an objective
is `strategy`.

## When it fires

- "où en sont mes OKR ?", "how is the quarter going?", "fais le point sur les objectifs".
- Before a board or team review, and at the start of the check-in ritual — `okr-checkin` calls it
  to know what to ask about.

## Scope, fixed on purpose

Two runs a month apart have to be comparable, so these are not decided per run:

| | Rule |
|---|---|
| Period | The latest one, which is what the "My OKRs" screen shows. `--period <id>` for another. |
| Reach | Every objective of that period. `--mine` for the ones the user owns, `--team <id>` for a team's load. |
| Silence | **14 days** without a check-in. A key result that has never been reported on is silent too, and counts as the worst case. |

State the period and the reach in your first line. Never change the threshold because a run looks
better with another one; if the user asks for a different one, say which you used.

## Tools

- `mcp__castalie__whoami` — who is asking, needed for `--mine` and to address the user as the owner.
- `mcp__castalie__strategy_list_periods` — the periods, when the user names one.
- `mcp__castalie__strategy_my_okrs` — one call: the objectives someone owns, their key results, the
  progress, and for each the `last_check_in` with `days_since_check_in`. Takes `period_id` and
  `team_id`.
- `mcp__castalie__strategy_navigate_children` — the rest of the tree, one level at a time
  (`period_id` for the roots, then `parent_objective_id`). Key results arrive in the same shape,
  silence included.
- `mcp__castalie__strategy_check_in_history` — the last check-ins of one key result. Call it for the
  handful you are about to call out, never for every key result: it answers "is this figure really
  moving?", which one value cannot.
- `mcp__castalie__strategy_get_objective_breadcrumb` — the parent chain, to name where a key result
  lives when the tree is deep.

## Order of presentation, fixed

1. **Off track** — the last check-in says `off_track`.
2. **At risk** — the last check-in says `at_risk`.
3. **Silent** — no check-in for 14 days or more; never reported on comes first, then longest
   silence first.
4. **The rest**, lowest progress first.

Within a group, keep the objectives' own order. A key result that is both off track and silent
belongs to group 1 — say the silence on its line rather than listing it twice.

## What each line carries

- The key result's title, and the objective it measures.
- `current → target` with its unit, and the progress.
- **The gap left to close**, in the unit, never only as a percentage.
- **The pace it now demands**: gap ÷ weeks left in the period, when the period has an end date.
  This is the number that turns "40 %" into a decision.
- Who reported it last and how long ago — or "never reported on".

## How to work

1. `whoami`, then settle the period. Say which one you are reading.
2. `strategy_my_okrs` for the owner's load. For the whole tree, walk down from the period roots
   with `strategy_navigate_children`, one level at a time, only as deep as there are objectives.
3. Rank with the rules above. Do not ask the user how to sort — the whole point is that the order
   is the same every time.
4. Open with the count in one sentence: how many key results, how many off track, how many silent.
   Then the ranked list, groups labelled.
5. Close with **the single next step**: the one check-in that would remove the most doubt, and the
   handover — `okr-checkin` to record it.

## Discipline

- **Read-only.** No `strategy_create_check_in`, no `strategy_update_key_result`, no objective
  created here, even to "fix" an obvious typo.
- **Never invent a figure.** A key result with no check-in has no trend: say so. Deducing a value
  from progress is inventing it.
- **Silent is not failing.** A key result nobody has reported on may well be on course; what is
  missing is the report, and that is what you say. The two must not be blended into one verdict.
- **Name things, never ids.** Objectives and key results by their title, with a clickable link
  (`/strategie/objectif/<id>`, `/strategie/resultat/<id>` on the workspace host). A bare `#12`
  means nothing to the person reading.
- **No advice on strategy.** Setting a target or dropping an objective is the user's call. You show
  where things stand and what pace remains; you do not propose to lower the bar.
