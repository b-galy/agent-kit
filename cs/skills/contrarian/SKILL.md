---
name: contrarian
description: Challenge an idea before you commit to it — spawn a fresh adversarial sub-agent that steelmans the idea, then attacks it hardest, names the single decisive test, surfaces failure modes and a cheaper alternative; then converge on a verdict you own. No Castalie tools needed; it reasons about the idea, not your data.
---

# contrarian — challenge an idea before committing

An idea is on the table (a metric, a threshold, an architecture, a plan). Before it gets built, hand it
to a **fresh contrarian sub-agent** whose job is to argue against it. The win: a clean context with no
authorship pride finds the flaw the thread is invested in not seeing.

## When it fires

- The user types the command, OR
- You are about to commit to a choice that is expensive to reverse, data-dependent, or a guessed
  number/threshold (e.g. inside `feature-spec` design).

## Steps

1. **State the claim precisely** — one falsifiable sentence. Fold in the argument if present, else take
   the latest concrete suggestion in the thread. A vague claim produces a vague challenge.

2. **Spawn the contrarian** as a sub-agent (fresh context — pass only the claim + the minimum facts it
   needs, never the invested thread). Instruct it, in order:
   - **Steelman first** — restate the idea at its strongest, so the critique is fair.
   - **Then attack hardest** — hidden assumptions, why it could be useless or actively harmful, where it
     breaks at scale or under adversarial use (Goodhart: what does optimizing this metric actually cause?).
   - **The decisive test** — the single measurable fact that settles whether it works, and the cheapest
     way to check it. This is the most valuable output.
   - **Cheaper alternative** — the simpler thing that captures 80% of the value.
   - **Verdict** — `proceed` / `proceed-with-conditions` / `drop`, with the condition stated. Default to
     skepticism: when uncertain, demand the test before committing.
   - For a high-stakes call, spawn **3 agents with distinct lenses** (data/statistical · business/
     incentives · second-order effects) in parallel and keep only objections that survive.

3. **Spawn an action challenger** — feed it the critics' salvo. Its bias is action: it turns every
   *drop / needs-a-perfect-test* into the **smallest reversible step that creates value now**, names the
   cost of waiting, and flags perfectionism that protects no one.

4. **Send the challenger's verdict back to the open critics** — let them concede, defend, or sharpen.
   The value is the exchange, not isolated salvos.

5. **Adjudicate, don't relay.** Weigh the full exchange: keep what holds, rebut what overreaches (say
   why), add what they missed.

6. **Converge on a path you own** — ONE recommendation: the revised plan, a concrete do-now action (not
   just "drop"), the decisive test, a clear verdict. A demolition with no next move is a failed run.

## Discipline

- **No Castalie tools required.** This skill reasons about the idea; it does not read or write your data.
- **Own the verdict.** You are a participant, not a router — end on a recommendation you stand behind.

## Hand back

Close the turn on the reply and the verdict of
`${CLAUDE_PLUGIN_ROOT}/instructions/shared-conventions.md`.
