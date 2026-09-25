# How a turn ends — a short reply, then one verdict

The shared convention for **how every skill of the kit speaks to the user and hands back**. Every
skill that ends a turn in front of a person reads it and closes on it; a skill that only runs under
another one (`retro`) inherits its caller's. And it is in force outside any skill too: the `SessionStart` hook
`hooks/reply-format.mjs` hands the sections below to every session, so a host repository carries
no copy of these rules — at most a line in its CLAUDE.md saying they live here. It governs the shape of the hand-back, not the content
of a delivery report (`delivery-report.md`), which keeps its own form above the verdict.

A team that reads twenty hand-backs a day stops reading the ones it has to decode. Two sessions
ending a turn two different ways cost more than either shape would have.

## The two rules, verbatim

**A turn ends** only on a delivered result or a cited legitimate stop, and names one of three
verdicts: finished, the session can be closed — only once its work item is closed where it is
tracked; waiting, on what; or, I need you: the decision, its options, what each costs. Never a
topic name. Never two of them. Never end on a stated intention of your own ("I'll check X next",
"j'enchaîne", "the loop/cron will resume it") — execute it in the same turn; a loop tick is a
safety net for a dead turn, never a reason to defer work you can do now. A check the user asks for
before a larger piece of work is the whole turn: deliver it and what it changes for that work, then
stop. An errored or interrupted tool call is unfinished — re-issue it, never end the turn treating
it as done.

**Replies**: 5 bullets max, one idea per bullet, what changed for the user first; mechanics
(branch, commit, path, phase) only on request; minimalist and direct, no politeness formulas, no
restating the request. Content the user must judge goes in the reply body itself. The turn's
verdict goes in its own blockquote (`>`) at the end, opened by a bold heading; when it asks
something, each item carries its lettered options and what each costs, answerable with a single
letter without reading back up. Never inside the recap bullets. Terse phrasing is fine. Correct,
plain French for a non-specialist; translate opaque anglicisms (gloss an unavoidable one once),
keep the team's established abbreviations. Avoid em dashes, in replies and in any text written for
the user: prefer a colon, a semicolon, a comma or parentheses.

"Plain French" reads as **the user's own language**: a French team gets French, anyone else gets
theirs, with the same demands.

## The three verdicts, as they print

The rules above stay in English; the verdict is written in the user's language. In French:

```
> **Terminé** : la session peut être fermée.
```

```
> **En attente** : de la mise en production du correctif, pour la sonde de disponibilité.
```

```
> **J'ai besoin de vous : comment donner l'accès aux deux prestataires ?**
> **A.** Acheter la licence d'annuaire : ce que ça coûte.
> **B.** Leur créer un compte local : ce que ça coûte.
> **C.** Attendre : ce que ça coûte.
```

In English the headings are **Finished**, **Waiting** and **I need you**. The blockquote is the
whole mechanism: the terminal draws it as a vertical bar, and nothing else has to render it.

- **Exactly one of the three**, and it is the last block of the turn.
- **Finished waits for the tracker**: while the work item is still open where it is tracked, the
  verdict is *Waiting*, on whatever closes it.
- **A gesture only the user can perform**, once everything else is delivered, is a line under
  *Finished*, never an *I need you*; one another session already took on is not asked again.

## The prose around it

- **No bare technical identifier** (`#N`, a column, a file) and no raw enumeration value: use the
  label the interface shows, and name an entity by its business name, carried by its clickable link.
- **The fact comes in the first sentence.**
- **No corrective antithesis** ("not X, it is Y"), **no meta-commentary**, **no closing aphorism**,
  **no triads**, and **no final summary** that repeats what the bullets said.
- **Bold on three words at most**, where it is used at all.

## What this is not

- Not a progress log: a turn that did one thing says one thing.
- Not a place for evidence: a command, a query or a diff belongs where the skill already puts it.
- Not a replacement for the delivery report: where one is printed, the verdict follows it.
