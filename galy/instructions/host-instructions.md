# Host instructions — the local rules a repository hands a skill

Read by `bug-fix`, `feature-implement` and `ship` before they touch a team's code. It says how a
repository declares a file of its own rules, and what happens to that file the moment a skill
delegates.

## Why a declaration, when the root instruction file is already in context

A skill reads the root instruction file because the harness puts it there, not because anything
told it to. **That is proximity, not a contract** — and it holds exactly until the rules outgrow a
file every session reads in full. Which is the normal fate of a working repository: the diagnostics
of an estate, the conventions of a stack, the addresses that must never be written to, all move out
into `.github/instructions/`, `docs/`, `.cursor/rules` or wherever that team keeps them, and the
root file is left pointing at them.

From that moment the rules are one link away, and a link is followed only when the model happens to
choose to. The audit already names the same defect on the other side of the door: a document
nobody's doctrine points at is one an agent will never think to open. A document the doctrine
points at, and nothing obliges anyone to read, fails a step later and looks identical.

## The line a host writes

One line per file, inside the `<!-- galy:begin -->` block of the root instruction file:

```markdown
<!-- galy:instructions bug-fix feature-implement --> `.github/instructions/estate-diagnostics.md` — Datadog, the MySQL replica, Site24x7.
```

- **The marker names the skills that read the file**, bare — `bug-fix`, never the namespaced
  `bg:bug-fix` — so the same line works on a harness whose namespace is flat. A skill the marker
  does not name never opens the file.
- **The path is relative to the repository root.** What follows the dash is for whoever reads the
  block; no skill reads it.
- **The marker keeps the name `galy`** for the same reason `<!-- galy:begin -->` does: the blocks
  already written in customers' files carry it, and renaming it would orphan every one of them.

## What a skill does with it

1. In the root instruction file — already in your context, so this costs no tool call — find the
   lines carrying the marker.
2. **Read in full every file whose marker names you**, before the step your skill names. Not
   skimmed, not grepped for the word you expected to find.
3. Where those rules contradict what you were about to do, **they win**. They are this
   repository's written decision and you are a guest in it. Where they contradict each other, or
   the user in front of you, ask — one line.
4. **No line names you, or there are no lines at all: say nothing.** Not a note, not a
   reassurance that you looked, not a sentence about what you are not doing. A team that never
   wrote one must not be able to tell this exists.
5. **A line names a file that is not there: one line in your report**, and carry on with the rest.
   Someone wrote that line on purpose — a silent skip turns a typo into a rule nobody applies, and
   nobody finds out for months. This is the one case that is not silence, and the difference is
   whether a human made a claim: an absent declaration claims nothing, a broken one claims a file.

## Delegation — the brief carries the rules, never the path

A sub-agent gets the root instruction file and nothing else. The domain file is not in its context,
and a path in its brief is a pointer it is free not to follow — the same defect, one level down,
where you can no longer see it happen.

So **paste into the brief the rules that bear on what you are asking**, quoted, under a line saying
which file they came from. Not the whole file, and never a summary in your own words: the half a
diagnostician needs is not the half a reviewer needs, and a rule you reworded is a rule you have
taken responsibility for.

## Adding a skill to the contract

Three skills honour the marker today. A fourth is two sentences inside that skill — the step that
reads, and the report line when a declared file is absent — and nothing changes in any host's file:
a name that nobody honoured simply starts being honoured. Nothing here is versioned, negotiated or
announced.
