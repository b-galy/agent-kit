# How a turn ends — a short reply, then one verdict

Shared convention for **how a skill speaks to the user and hands back**. Referenced by
`acceptance`, `bug-fix`, `feature-brief`, `feature-implement`, `feature-spec`, `feature-followup`,
`maturity-actions`, `ship` and `audit-organisation`. It governs the shape of the hand-back, not the
content of a delivery report (`delivery-report.md`), which keeps its own form above the verdict.

A team that reads twenty hand-backs a day stops reading the ones it has to decode. Two sessions
ending a turn two different ways cost more than either shape would have.

## The reply

- **Five bullets at most**, one idea each, what changed for the user first.
- **Mechanics only on request**: no branch, commit, file path or phase unless they asked.
- **Minimal and direct**: no politeness formula, no restating the request. Terse phrasing is fine.
- **What the user must judge sits in the reply itself**, never behind a link they have to open.
- **Plain language for a non-specialist**, in the user's language: translate opaque jargon, gloss
  an unavoidable term once, keep the team's own abbreviations.
- **No em dashes in text written for the user**: a colon, a semicolon, a comma or parentheses.

## The verdict closes the turn

A turn ends only on a delivered result or a legitimate stop. Its last block is **one verdict, in
a blockquote opened by a bold heading**, never inside the bullets:

```
> **Finished, you can close the session.**
> <a gesture only the user can perform, if one is left>
```

```
> **Waiting: <what>**
> <who or what unblocks it, and when if known>
```

```
> **I need you: <the decision>**
> a) <option>, <what it costs>
> b) <option>, <what it costs>
```

- **Exactly one of the three.** Never two, never a topic name in their place.
- **The options are lettered**, each with its cost, answerable with a single letter without
  reading back up.
- **A gesture only the user can perform**, once everything else is delivered, is a line under
  *Finished*, never an *I need you*; one another session already took on is not asked again.
- **Never end on your own stated intention** ("I'll check X next"): do it in the same turn. A
  wake-up loop is a safety net for a dead turn, never a reason to defer work you can do now.
- **An errored or interrupted tool call is unfinished**: re-issue it, never hand back as if done.

## What this is not

- Not a progress log: a turn that did one thing says one thing.
- Not a place for evidence: a command, a query or a diff belongs where the skill already puts it.
- Not a replacement for the delivery report: where one is printed, the verdict follows it.
