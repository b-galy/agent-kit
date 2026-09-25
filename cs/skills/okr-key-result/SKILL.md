---
name: okr-key-result
description: Give an objective its key result, read off a report — never typed by hand. Builds (or finds) the report that tracks the metric over time, proposes a target from the data for the user to confirm, then creates the one key result of that objective and links it to the report, so its value comes from the report and carries the report's address. Prefers a report of this workspace, falls back to the HTTPS address of a report in another system, and refuses to create a key result with neither. Use it when someone points at an objective and asks to "add a KR", "track this", "set a target", "mesure cet objectif".
model: claude-opus-5-5
effort: high
---

# okr-key-result — a key result is read off a report

Turns an objective into a measurable one. The deliverable is always the same pair:

1. **a report that tracks the metric over time** — table 1 is the value today, table 2 the
   trajectory, actual against target;
2. **the one key result of the objective, linked to that report**, so its value comes from the
   report and anyone reading the key result can open the report it was read from.

Never a figure typed by hand with nothing behind it. Reading where the objectives stand is
`okr-review`; recording where a key result stands is `okr-checkin`.

## No report, no key result

This is the rule the skill exists to hold, and it has no exception:

- **A key result with no report and no report address is refused.** Say why in one sentence: a
  figure typed by hand cannot be checked, drifts from the data without anyone noticing, and is
  averaged into the objective's progress as if it were measured. A number typed after the fact
  measures the person who typed it, not the work.
- The user insisting on a figure does not lift the rule. Offer the two routes below, and if
  neither is possible today, stop: the missing piece is the report, and building it is the next
  step, not a key result without one.
- An existing key result is not a loophole either: a key result this skill refines ends linked, or
  is left untouched.

## The two routes, in this order

1. **A report of this workspace** (`report_id`) — preferred. The workspace's report engine reads
   the value from table 1 every day and on demand; the key result's curve is table 2. Nobody
   carries a figure over by hand, so nobody can carry it wrong. Possible when the workspace serves
   reports and the metric is in the data those reports can read.
2. **A report that lives elsewhere** (`external_report_url`) — when the metric lives in another
   system: billing, analytics, a CRM, a data warehouse. The key result carries the report's HTTPS
   address; nothing is computed from it, so every value is read off that report at check-in, and
   the check-in cites it. The report must already exist there and track the metric over time — a
   dashboard's home page or a spreadsheet of hand-typed figures is not a report.

Which route applies is settled by where the data is, never by which is faster to set up.

## Tools

- `mcp__castalie__whoami` — who is asking; a key result is authored under the token's identity.
- `mcp__castalie__strategy_search_objectives` — find the objective when only a title is given.
- `mcp__castalie__strategy_get_objective` — the objective, its key results, the title of its
  parent and `main_key_result_id` when one is designated.
- `mcp__castalie__strategy_get_objective_breadcrumb` — the ancestry, with each node's page
  address: the parent often carries the band that bounds a reasonable target.
- `mcp__castalie__report_get_context` — the report-building rules and the schema a report can
  read. It answers only where the workspace serves reports, to those allowed to author them.
- `mcp__castalie__report_create`, `mcp__castalie__report_save_table` — build the report.
- `mcp__castalie__report_read_table` — read a report as its page shows it: `report_id` alone lists
  its tables, `report_table_id` reads one. Open to every member.
- `mcp__castalie__strategy_create_key_result` — create the key result already linked: `report_id`
  (and `report_table_id` when the value is not in the first table), or `external_report_url`. A
  refused link creates nothing.
- `mcp__castalie__strategy_update_key_result` — refine an existing key result, or link one that
  has no report yet.
- `mcp__castalie__strategy_refresh_key_result` — recalculate from the linked workspace report.
- `mcp__castalie__strategy_create_check_in` — the first value of a key result whose report lives
  elsewhere.

## Inputs

- **The objective** — an id, its page, or a title. Never invent one; when only a title is given,
  `strategy_search_objectives` finds it, and two candidates are a question, not a guess.
- **The metric** — what is measured. If the user named it, use it. If not, infer it from the
  objective's title and its parent, then confirm it in one question.
- **The target** — proposed by you from the data, **confirmed by the user before anything is
  created**. A target is the user's strategic call. "Pick what seems reasonable" still means:
  propose, show the reasoning, confirm.

## How to work

### 1. Read the objective

`whoami`, then `strategy_get_objective(objective_id)` for its key results, and
`strategy_get_objective_breadcrumb` for its parent and its page address. State the objective and
its period in your first line.

**One key result per objective.** An objective carries exactly one key result: the measure its own
title promises. A second one is averaged into the objective's progress and buries the measure
that matters; leading signals and per-lever counters belong in the report, which tracks them over
time. So, before creating anything:

- **no active key result** — go on;
- **one, and it is the right measure** — create nothing: link it to its report (steps 2 to 5,
  then step 6 as a refinement with `strategy_update_key_result`);
- **one, and it is the wrong measure** — propose the swap and let the user choose which survives.
  Archiving a key result (`strategy_delete_key_result`) is final — nothing restores it — so it is
  never done to "try something";
- **several** — say so, name the one `main_key_result_id` designates if any, and ask which one is
  the measure. Do not add to the pile.

### 2. Settle the route

Call `report_get_context`.

- **It answers**, and the schema it lists holds the metric's data → **workspace report**. Look for
  a report that already measures a sibling objective, and read it with `report_read_table` so the
  new one mirrors its definition and filters: an identical definition is what lets two key results
  add up into their parent without drift.
- **It answers, but the metric is not in that schema** → the metric lives elsewhere: **external
  report**.
- **It is refused** (`reports_unavailable`, or you may not author reports here) → **external
  report**, or a workspace report someone allowed to author builds first. A report that already
  exists here can still be linked by anyone who may read it: ask whether there is one.

For an external report, ask for its HTTPS address, and check it is one: anything but `https://`
is refused by the workspace. If the user has no such report, stop on the refusal above: name the
system the metric lives in, and say that the report is to be built there first.

### 3. Read the data

Establish three figures, from the data and never from memory:

- **the baseline** — the metric at the start of the objective's period;
- **the current value** — the last *closed* period (month or week): an open one is incomplete and
  reads as a drop;
- **the trend** — the series since the baseline, one point per closed period.

An **event-driven metric** (a survey wave, a campaign, a closing) is read on its last closed event,
never on a rolling window that empties between events.

- *Workspace report*: build the report now (step 5) with the actual series only, and read both
  tables back with `report_read_table`. The target comes later.
- *External report*: open the address if you can reach it; otherwise ask the user for the three
  figures as that report shows them. Never estimate one.

### 4. Propose the target

Extrapolate the trend, then cap it at what the parent allows (a band, a ceiling, a total the
children add up to). State the reasoning in one or two sentences: the current pace, why the
number is reachable, where the ceiling comes from. Then ask **one** question, the recommended
option first. Pick the durable, honest number: a sandbagged target is as useless as a fantasy.

For an external report, ask the **confidence** of today's value in the same question
(`on_track`, `at_risk` or `off_track`): it is the owner's reading, and step 6 records it.

Create nothing until the user has picked or amended the target.

### 5. Build the report (workspace route)

Follow the rules `report_get_context` hands you — they win over anything below. Then
`report_create(title)`, attached with `featureBriefId` to the brief that serves this objective
when there is one, and two `report_save_table` calls:

- **Table 1 — the value.** Exactly **one row**, whose **first cell is the current value, as a
  number**: that is the figure the engine reads into the key result. Baseline, target and gap
  follow as context columns. The subtitle states the metric's definition, the baseline and the
  period. Never make a chart the value table: its first cell is a label or a date, not the value.
- **Table 2 — the trajectory.** A several-series line over time (`MultiLine`: series, date,
  value). `Actual` is the series per closed period; `Target` is the linear path from the baseline
  to the target over the period. First saved with `Actual` alone (step 3), then saved again on the
  same `tableId` with `Target` once the target is confirmed.

Title: durable and plain — `OKR — <metric> <scope>`, mirroring a sibling report's naming; no
period (it lives in the subtitle), no chart type.

**Read both tables back with `report_read_table` before going further**: table 1 returns one row
with a numeric first cell, table 2 returns both series. A report that does not read cleanly is not
linked — fix it first. The report stays a main report (no parent report): only a main report can
measure a key result.

### 6. Create the key result and link it

`strategy_create_key_result(objective_id, title, metric_type, unit, start_value=<baseline>,
target_value=<target>, previous_value_type, <the link>)` — `metric_type` is `number`, `percent`,
`currency` or `boolean`; `previous_value_type` is `period_start` (progress from the baseline, the
default) or `previous_period` (a counter that restarts at zero for the period). **Get the baseline
right now**: it is what progress is measured from.

**The link travels in the creation call itself**, so the key result never exists without its
report — a refused link creates nothing:

- *Workspace report*: pass `report_id=<report>`, adding `report_table_id` only when the value is
  not in the report's first table. A new key result still shows its baseline until it is first
  calculated, so call `strategy_refresh_key_result(key_result_id)` right away: the value it returns
  must equal table 1's first cell. No check-in is written — a measurement is not something a
  person reported.
- *External report*: pass `external_report_url=<address>`, then
  `strategy_create_check_in(key_result_id, new_value=<current value read off that report>,
  confidence=<the user's reading>, comment=<one sentence that cites the report's address>)`.

An older server may not know these creation parameters (the answer omits `report_id`, or rejects
them): then create, and link **in the very next call** with `strategy_update_key_result`.

When refining an existing key result, the same `strategy_update_key_result` call carries the
corrected definition and the link. A unit left out is kept; pass one only to change it.

**If the link is refused** (`report_forbidden`, `report_not_found`, `report_table_not_in_report`,
`reports_unavailable`, `external_report_url_https_required`): fix the cause and try again. If it cannot be fixed now, say
plainly that a key result exists without a report, name it with its link, and say what is
missing. Never leave that silently.

### 7. Hand over

- The objective and the key result, by title, with their links (the objective's page from the
  breadcrumb; the key result at `/strategie/resultat/<id>` on the workspace host).
- **The report's address**: `/Report/Viewer/View/<reportId>` on the workspace host, or the
  external address.
- The value now carried, and where it came from.
- How it stays current, in one sentence:
  - *workspace report* — the engine reads it every day; `okr-checkin` recalculates it on demand;
  - *external report* — nothing computes it; each check-in reads it off that report and cites the
    address. Say it plainly: a value that looks live but is carried by hand would be worse than
    one known to be.

## Discipline

- **Never invent a figure** — not the baseline, not the current value, not a point of the trend.
  A figure you cannot read is a question to the user or a stop.
- **Never type the key result's value.** It comes from the report: the engine reads it, or a
  check-in carries what the external report shows. `current_value` is for correcting a mistake,
  never for seeding a key result.
- **The target and the confidence are the user's**, the reasoning is yours.
- **One key result per objective**, upheld here: nothing else in the workspace stops a second one.
- **Touch nothing else**: no other key result, no other objective's report.
- **Name things, never ids**: titles and clickable links.

## Hand back

Close the turn on the reply and the verdict of
`${CLAUDE_PLUGIN_ROOT}/instructions/shared-conventions.md`.
