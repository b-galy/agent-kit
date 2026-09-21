---
name: feature-brief
description: Frame a business need into a Galy brief — problem, vision, user stories, success criteria — attached to an objective. Interactive discovery with targeted questions; writes the brief via the Galy MCP and its body via the bg CLI. This is the WHAT and WHY, never the HOW (that is feature-spec).
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
2. **Read who this repository already writes for**, following
   `${CLAUDE_PLUGIN_ROOT}/instructions/host-instructions.md`: the lines carrying
   `<!-- galy:instructions -->` in the root instruction file name the files a skill must open, and a
   marker naming `feature-brief` is addressed to you — their personas, their vocabulary, the customers
   they do not serve. **The story's persona is one of theirs**, never one invented at the moment of
   writing it: a brief framed for an average user gets a feature an average user does not buy.
   **Nothing names you, or there is no such line: say nothing and carry on.**
3. **Discovery.** Ask only what you cannot infer: who is the user, what breaks today, what "better"
   looks like, how you would know it worked. Keep it to a handful of questions. Announce the domain you
   inferred in one line and continue.
   **And carry the plausible answers into the question.** Where you can name two or three, name them
   and let one be picked. An open question hands the framing back to the person who came to have it
   done, and it is answered with a shrug or with whatever is shortest to type — which you then write
   down as their intent.
4. **Look for the brief before you create one.**
   `mcp__bg__feature_brief_list(ownerUserId=<userId>, statusFilter="Draft", query=<a distinctive word
   of the title>)`. One that is plainly this need is the one you continue: `mcp__bg__feature_brief_get`
   it, say in one line what it already carries, and pick up at the first step it is missing.
   **A session that died between the create and the body leaves a brief with a title and nothing else**
   — invisible to whoever relaunches, so they frame it again, and the workspace ends with two records
   of one need and a spec hanging off whichever the second run remembered.
   Nothing matches → `mcp__bg__feature_brief_create(title, domain, objectiveId, ownerUserId=<userId>,
   nextFollowupDate?)` → capture `brief_id`. Never pass the body as an argument.
5. **Write the body via the CLI.** `bg content pull feature-brief <brief_id>` to seed the buffer,
   edit `.tmp/galy-content/feature-brief/<brief_id>.md` (fields `problem`, `vision`, `executive` —
   executive ≤ 375 words, readable without internal jargon), then `bg content push feature-brief <brief_id>`.
6. **User stories** (P0 first): `mcp__bg__feature_brief_add_user_story(briefId, persona, action, benefit, priority)`.
7. **Business success criteria:** a brief carries no acceptance test of its own — that verb belongs
   to specs. Capture measurable outcomes as **business follow-up checks** instead —
   `mcp__bg__followup_check_add(featureBriefId=<brief_id>, checkType="business", title, followupPromptMd=<outcome + pass/fail threshold>, scheduleOffsetDays=<J+N>, onFailAction="create_spec")`.
   See `${CLAUDE_PLUGIN_ROOT}/instructions/followup-conventions.md`.

## Confirmation

Print the brief title and a clickable Galy link, and point to `feature-spec` as the next step. Close on
`👁️ <Galy brief link>`.

## Discipline

- **Body via the CLI, never a tool argument.**
- **No effort estimate in a brief** — duration belongs to specs. One brief = one business outcome.
- **Acceptance criteria that mention code** are technical — they belong to a spec.
- **Auto-chain on HOW signals.** If discovery surfaced implementation detail (file paths, libraries,
  architecture), invoke `feature-spec` right after confirmation — the user already crossed into HOW.
