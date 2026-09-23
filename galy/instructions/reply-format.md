# How a turn ends — two sentences, then what is waited for

Shared convention for the **last block a skill prints before handing back**. Referenced by
`acceptance`, `bug-fix`, `feature-brief`, `feature-implement`, `feature-spec`, `feature-followup`,
`maturity-actions`, `ship` and `audit-organisation`. It governs the shape of the hand-back, not the
content of a delivery report (`delivery-report.md`), which keeps its own form.

A team that reads twenty hand-backs a day stops reading the ones it has to decode. Two sessions
ending a turn two different ways cost more than either shape would have.

## The shape

```
<One or two sentences, in the user's language: what is true now, and what happens next on its own.>

> *En attente : <what is waited for>, <who or what unblocks it, and when if known>.*
```

- **The sentences say what is true now**, never what has been started, queued or merely attempted.
  A pull request that is open is not a delivery; say what it is.
- **The waiting line names its blocker** — a person, a running job, an answer, a version to be
  published. "Pending" on its own gives the reader nothing to act on. Nothing is waited for → omit
  the line.
- **In the words the user uses.** No class name, no file path, no branch, no raw identifier, unless
  they asked for one.
- **No table, no bullet list, no headings.** A hand-back is read, not scanned.

## A decision you need back

Ask it with the harness's choice prompt, after the waiting line, each option carrying its cost. A
question folded into the sentences has already been missed.

## What this is not

- Not a progress log: a turn that did one thing says one thing.
- Not a place for evidence: a command, a query or a diff belongs where the skill already puts it.
- Not a replacement for the delivery report: where one is printed, the waiting line follows it and
  closes the turn.
