# Host instructions — the local rules a repository hands a skill

Read by `bug-fix`, `feature-implement` and `ship` before they touch a team's code, and by
`feature-brief` and `feature-spec` before they write a plan against it. It says how a repository
declares a file of its own rules, and what happens to that file the moment a skill delegates.

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

## Which file the root instruction file is

**The one your harness put in your context without you opening it.** Under Claude Code that is
`CLAUDE.md`. Under Codex it is `AGENTS.md`, at the repository root. Other harnesses spell it
differently again, and the spelling is the only thing that differs: the role is identical, and
everything below is written to the role.

That definition is enough to read the block and not enough to find it, which is the whole defect.
A team writes the block once, in the file the harness they set the kit up with reads. A session of
the other harness then has a different file in context, finds no marker, and says nothing — which
is correct behaviour for a team that never wrote a line, and indistinguishable from it. The rules
are there, in the repository, one filename away, and nobody learns they were skipped.

**So the rule is the union, not the file in your context: at the repository root, read every
`CLAUDE.md` and every `AGENTS.md` that is there, and take the marker lines from all of them.** Two
files carrying the same line name the same file, and a file read twice is read once, so the union
costs a read and can double nothing.

**Nothing here decides which of the two wins where they disagree.** What is measured is that Codex
reads `AGENTS.md` at the repository root; a precedence between the two is not, and the union is
built so that it never has to be. If you find yourself needing that answer, you are being asked to
arbitrate a host's own files — ask them.

And when you WRITE one — `adapt` proposes a whole block — put it in the file you read it from.
Where both exist and neither carries a block, ask which, in one line: a team that runs both
harnesses may want it in both, and that is their decision to make, not yours to infer.

## The line a host writes

One line per file, inside the `<!-- galy:begin -->` block of the root instruction file:

```markdown
<!-- galy:instructions bug-fix feature-implement --> `.github/instructions/estate-diagnostics.md` — Datadog, the MySQL replica, Site24x7.
```

- **The marker names the skills that read the file**, bare — `bug-fix`, never the namespaced
  `cs:bug-fix` — so the same line works on a harness whose namespace is flat. A skill the marker
  does not name never opens the file.
- **The path is relative to the repository root.** What follows the dash is for whoever reads the
  block; no skill reads it.
- **The marker keeps the name `galy`** for the same reason `<!-- galy:begin -->` does: the blocks
  already written in customers' files carry it, and renaming it would orphan every one of them.

## What a skill does with it

1. In the root instruction file — already in your context, so this costs no tool call — find the
   lines carrying the marker. **Then, if the repository root holds the other spelling as well,
   open it**: one read, once, and it is the only way a block written from the other harness ever
   reaches you.
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

Five skills honour the marker today. A sixth is two sentences inside that skill — the step that
reads, and the report line when a declared file is absent — and nothing changes in any host's file:
a name that nobody honoured simply starts being honoured. Nothing here is versioned, negotiated or
announced.
