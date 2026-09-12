---
name: report
description: Receive a bug report or improvement request from an agent and route it to the right ticket or brief. Triggered by "ça ne marche pas", "j'ai un bug", "il faudrait", "ce serait mieux si", "report a bug", "request an improvement", or "bg:report <text>".
---

# report — give a problem a door

This skill receives a problem from the person using the agent. It records a defect or an
improvement request in the connected workspace, or hands a larger improvement to
`bg:feature-brief`. It does not fix the problem, invent a solution, or send a message outside the
workspace.

## Where the report lands

1. Call `mcp__bg__whoami` first. Use the authenticated workspace and the current connected
   instance as the destination. Never guess a workspace address, ask the person to choose a
   tenant, or hard-code an instance host.
2. Keep the person's original wording exactly. The report may be clarified and structured, but
   `_Original wording:_` always contains the words that started this exchange.
3. A report belongs to the workspace of the authenticated user. Do not create a ticket before
   that identity and destination are known.

## The nature, in one question

Recognise the nature from the wording and from facts already visible to the agent. Do not ask a
question when the wording already settles it:

- `ça ne marche pas`, `j'ai un bug`, `erreur`, `cassé`, `broken`, and `does not work` mean **bug**.
- `il faudrait`, `ce serait mieux si`, `pourrait`, `améliorer`, `request an improvement`, and
  `could work better` mean **improvement**.

When the nature is genuinely ambiguous, ask exactly this one question:

> Is this something that should work and does not (a bug), or something that could work better (an improvement)?

Say what you understood in one short sentence — for example, “I understand this as a bug.” —
then continue. The nature question is skipped when the sentence already answers it.

## The context, two questions at most

The total budget is **three user questions, including the nature question and any duplicate
confirmation**. Skip every question answered by the wording, the current page, the terminal, or
the connected workspace. Never ask the person for facts the agent can see.

For a bug, collect only what is missing:

1. **Where did this happen (URL, screen, or command)?**
2. **What did you do, what did you expect, and what happened instead?**

For an improvement, collect only what is missing:

1. **Who would benefit from this?**
2. **What gain should it create over what happens today?**

The answers become the three description sections below. A bug uses the page, command, or error
already visible to the agent where available. An improvement's second answer supplies both the
gain and the current situation when the person gives them together. Do not add a severity
question: use `minor` for a bug unless the wording clearly supplies another supported severity.

## Duplicates first

As soon as there is enough information for a useful title, make a concise title without losing
the original wording and run `pm_search` on the title's meaningful words before creating anything.
Use the matching `mcp__bg__pm_search` tool exposed by the connected server. Look for an open,
close ticket, not merely a similarly worded brief. If an obvious brief is the subject of the
request, retain its id for `feature_brief_id`.

If an open ticket is a genuine match, show its title and ask **“Is it this one?”**. This
confirmation counts against the three-question budget. On **yes**, call `discussion_post` for
that ticket with the newly collected context and the original wording; do not call
`bug_create`. On **no**, continue with the missing context that fits inside the remaining budget.
Use the existing ticket's id for the final ticket link.

## Create

Create exactly one ticket when no duplicate was confirmed. Call `mcp__bg__bug_create` once with:

- `ticket_type = "bug"` for a defect, or `ticket_type = "feature"` for an improvement;
- a human title of **255 characters or fewer**. The server refuses a longer title; never pass a
  mechanically truncated title. Rewrite it semantically if it needs shortening;
- `description_md` in exactly the relevant three sections, followed by the unchanged original
  wording;
- `source = "mcp"`;
- `severity = "minor"` (or another supported severity already evident in the wording) **only for
  a bug**. Never send `severity` for an improvement;
- `feature_brief_id` only when `pm_search` found an obviously matching brief;
- use `domain_suggest` only if that existing server verb is exposed, and only with its returned
  suggestion. It is optional and does not justify changing `contract/pm-v1.json`.

For a bug, write:

```md
## Steps
<what was done, including where>

## Expected
<what should have happened>

## Observed
<what happened instead, including the visible error>

_Original wording:_ <the exact words supplied by the person>
```

For an improvement, write:

```md
## Who
<the people who would benefit>

## Gain
<the desired benefit>

## Today
<what happens today>

_Original wording:_ <the exact words supplied by the person>
```

Do not invent reproduction steps, outcomes, users, or benefits. Use “not provided” in a section
when the person did not provide it and the three-question budget is spent.

## The link

After a successful creation or duplicate confirmation, render the ticket link as the final line
and render nothing after it:

`👁️ https://<space>/tickets/<id>`

Use the connected workspace address and the returned ticket id. Do not add a recap, a closing
sentence, punctuation, or a second ticket link after this line.

## Too big for a ticket → feature-brief

An improvement that spans several screens, introduces a new concept, or requires an integration
is bigger than one ticket. Say so in one sentence, then invoke `bg:feature-brief` with the text
already collected. Do not create a feature ticket first and do not ask the person to repeat the
context. Let `feature-brief` own the brief, its objective, and its follow-up.

## What happened to my report?

When the person asks “What happened to my report?” or an equivalent question, identify the ticket
id from their link or ask for that id only in this follow-up path. Do not start a new report.

1. Call `mcp__bg__bug_get(id=<id>)` for the ticket.
2. Call `mcp__bg__discussion_read(entity_type="bug", entity_id=<id>)` for the ticket's
   discussion. Use the same id returned from the link; do not retry a successful read.
3. If `is_awaiting_feedback` is true, show the latest question from the ticket's latest message,
   ask for the answer, then post that answer with `mcp__bg__discussion_post`. If the person's
   current message already contains the answer, post it immediately instead of asking again. Do
   not create a second ticket. Use `entity_type="bug"`, `entity_id=<id>`, `body_md=<answer>`, and
   `author_kind="agent"` for that post. When a post succeeds, read the ticket and discussion once
   more if the server supports read-back; if the read-back is still unchanged, report what it
   returned without speculating about indexing or delivery.
4. Report exactly three plain-text lines, with no preamble, explanation, code fence, ticket link,
   or fourth line on this follow-up path:

   ```text
   Status: <current status>
   Last event: <latest event>
   Last message: <latest discussion message>
   ```

## Discipline

- Ask no more than three questions in one report flow, and skip questions already answered.
- Call `bug_create` at most once, and never after a confirmed duplicate.
- Use only existing verbs: `whoami`, `pm_search`, `bug_create`, `discussion_post`, `bug_get`,
  `discussion_read`, and `domain_suggest` when it is already exposed. Never add a verb or edit
  `contract/pm-v1.json` for this skill.
- Keep this skill and its instructions in English. Match the person's register in any short
  question or acknowledgement.
- A useful result comes before explanation. The ticket link is the last line on the create path.
