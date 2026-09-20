---
name: feature-brief
description: Frame a business need into a Galy brief — problem, vision, user stories, success criteria — attached to an objective. Interactive discovery with targeted questions; writes the brief via the Galy MCP and its body via the bgaly CLI. This is the WHAT and WHY, never the HOW (that is feature-spec).
---

# feature-brief — frame a business need

Turn a fuzzy intention into a `feature_brief` in Galy: the problem, the vision, the user stories and the
business success criteria — attached to the objective it serves. No code, no implementation detail —
that belongs to `feature-spec`.

## Arguments

- `<free subject>` — a short summary of the intent (optional).
- `--domain <marketing|product|internal|editorial>` — force the domain; otherwise inferred.
- `edit <briefId>` — edit an existing brief instead of creating one.

## Edit mode

If the first token is `edit`, do only this: `feature_brief_get(briefId)`, summarize it in 2-3 sentences,
ask what to change, then apply one change at a time (`feature_brief_update`, `feature_brief_add_user_story`),
confirming each. Body edits go through the CLI (see below).

## Model

The user arrives with a fuzzy need. Lead a **targeted discovery** — a few sharp questions, not a
questionnaire — then create the brief and its children via the Galy MCP. The body lives in a local
buffer synced by the CLI, never passed as a tool argument.

## Steps

1. **Identity + objective.** `mcp__bg__whoami` for the userId. Pick the objective the need serves —
   invoke the `strategy` skill or `mcp__bg__strategy_navigate_children` to find it. A brief with no
   objective has no reason to exist: refuse to create one without it.
2. **Discovery.** Ask only what you cannot infer: who is the user, what breaks today, what "better"
   looks like, how you would know it worked. Keep it to a handful of questions. Announce the domain you
   inferred in one line and continue.
3. **Create the brief (metadata only):** `mcp__bg__feature_brief_create(title, domain, objectiveId)`
   → capture `brief_id`. Never pass the body as an argument. **Creation takes no owner**, so give it
   one in the next call: `mcp__bg__feature_brief_assign(featureBriefId=<brief_id>, userId=<userId>)`.
   A second call is not a workaround waiting for a better create — a brief changes hands, and the
   verb that hands it over is the one that has to work anyway.
4. **Write the body via the CLI.** `bgaly content pull feature-brief <brief_id>` to seed the buffer,
   edit `.tmp/galy-content/feature-brief/<brief_id>.md` (fields `problem`, `vision`, `executive` —
   executive ≤ 375 words, readable without internal jargon), then `bgaly content push feature-brief <brief_id>`.
5. **User stories** (P0 first): `mcp__bg__feature_brief_add_user_story(briefId, persona, action, benefit, priority)`.
6. **What "done" means, before anyone knows how:**
   `mcp__bg__feature_brief_add_acceptance_test(featureBriefId=<brief_id>, givenText, whenText, thenText)`,
   one per outcome the brief promises. A brief's criterion is not a spec's: it is given / when / then
   in business words, it names no file, no route and no library, and it is written while the solution
   is still open. Anything you can only state by naming code belongs to the spec.
7. **Measuring it afterwards** is a different object again, and both are wanted: the criterion says
   what has to be true, a follow-up check says when someone goes and looks —
   `mcp__bg__followup_check_add(featureBriefId=<brief_id>, checkType="business", title, followupPromptMd=<outcome + pass/fail threshold>, scheduleOffsetDays=<J+N>, onFailAction="create_spec")`.
   See `${CLAUDE_PLUGIN_ROOT}/instructions/followup-conventions.md`. A date on the brief itself is not
   how this skill schedules one: the check carries its own offset, and two places to say "look again
   on the 12th" is one place too many.

## Confirmation

Print the brief title and a clickable Galy link, and point to `feature-spec` as the next step. Close on
`👁️ <Galy brief link>`.

## Discipline

- **Body via the CLI, never a tool argument.**
- **No effort estimate in a brief** — duration belongs to specs. One brief = one business outcome.
- **Acceptance criteria that mention code** are technical — they belong to a spec.
- **Auto-chain on HOW signals.** If discovery surfaced implementation detail (file paths, libraries,
  architecture), invoke `feature-spec` right after confirmation — the user already crossed into HOW.
