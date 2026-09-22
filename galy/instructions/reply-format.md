# How a turn ends — the state table, then the lettered questions

Shared convention for the **last block a skill prints before handing back**. Referenced by
`acceptance`, `bug-fix`, `feature-brief`, `feature-implement`, `feature-spec`, `feature-followup`,
`maturity-actions`, `ship` and `audit-organisation`. It governs the shape of the hand-back, not the
content of a delivery report (`delivery-report.md`), which keeps its own form.

A team that reads twenty hand-backs a day stops reading the ones it has to decode. Two sessions
ending a turn two different ways cost more than either shape would have.

## The table closes the turn

The last block is a table with two columns, in the user's language:

| Terminé | En attente |
|---|---|
| `<what is true now, one line per subject>` | `<what is waited for, and who or what unblocks it>` |

- **`Terminé` holds what is true now**, never what has been started, queued or merely attempted.
  A pull request that is open is not a delivery; say what it is.
- **Every `En attente` line names its blocker** — a person, a running job, an answer, a version to
  be published. "Pending" on its own gives the reader nothing to act on.
- **One line per subject, in the words the user uses.** No class name, no file path, no branch, no
  raw identifier, unless they asked for one.
- **Nothing in the table asks a question.** Questions have their own place, below.

## The questions come after it, lettered

Anything that needs the user's answer sits under the table, one line each:

```
a) <the choice>, <what it costs>
b) <the other choice>, <what it costs>
```

- Lettered `a)`, `b)`, `c)`, so the user answers **with a single letter**, without scrolling back up.
- Each option carries its cost, not just its name: an option whose price is unknown is not a choice.
- **A question asked anywhere else in the turn has already been missed.** Prose above the table is
  read for what changed, not for what is being asked.

## Above the table

**Five bullets at most**, the effect on the user first, no preamble and no restating of the request
(`user-attention.md` if this kit carries one; otherwise the skill's own discipline). Where a
delivery report is printed, it comes first and keeps its form, and the table closes the turn under
it.

## What this is not

- Not a progress log: a turn that did one thing prints one line, not five.
- Not a place for evidence: a command, a query or a diff belongs where the skill already puts it.
- Not a replacement for the delivery report, whose variants stay table-free.
