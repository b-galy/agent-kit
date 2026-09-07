---
name: acceptance
description: Run an acceptance pass on a running feature — you fire remarks in rapid succession while you click through the product, each one is written to a local queue the instant it lands and then pushed to Galy, then coded one at a time in the order received, one commit per remark, a single PR. Trivia is decided on the spot; a real product decision parks without stopping the queue. Ends at "PR ready" and hands the drained pass to the environment's release step; it merges nothing itself.
allowed-tools: Bash, Read, Edit, Write, Glob, Grep, Skill, mcp__bg__whoami, mcp__bg__acceptance_open, mcp__bg__acceptance_add_remark, mcp__bg__acceptance_list, mcp__bg__acceptance_claim_next, mcp__bg__acceptance_resolve, mcp__bg__acceptance_park, mcp__bg__acceptance_answer, mcp__bg__acceptance_set_pr, mcp__bg__acceptance_close
---

# acceptance — fire remarks, drain them one at a time, one PR

You are sitting in front of the running product with the person who asked for it. Remarks come faster
than they can be coded, and the session that holds them only in context loses them at the first
`/compact` or crash — which is why the first act on every remark is to **write it down**, before
anything else, coding included.

Each remark is then implemented **in the order received**: one commit per item, one branch, one PR.

## Modes

| You typed | Mode |
|---|---|
| nothing, or a spec id / a topic | **start** — open or resume an acceptance pass |
| `status` | show the queue and the open questions |
| `answer <n> <text>` | reply to a parked question; the item re-queues |
| `stop` | stop taking remarks, drain what is left, hand the PR to `ship` |
| anything else, while a pass is open | a **remark** — it goes to the queue |

## The queue: the file first, then Galy

One file, `.bg/acceptance/<session>.json`, in the repo you are working in. `.bg/` is gitignored
(`connect` makes sure of it). The pass and its remarks also live in Galy, where anyone can read them
back months later — but **the file is written first, always**.

```json
{
  "session": "acceptance-checkout-1",
  "branch": "acceptance-checkout-1",
  "galy_session": 12,
  "spec": null,
  "pr": null,
  "intake": "open",
  "items": [
    { "n": 1, "text": "the total ignores the discount", "status": "pending",
      "question": null, "answer": null, "commit": null, "result": null,
      "galy_id": 41, "pushed": true }
  ]
}
```

`status` is one of `pending`, `in_progress`, `done`, `wont_fix`, `failed`, `awaiting_user`.

**THE ORDER IS THE RULE, NOT A STEP: file, THEN Galy.** A network call is a worse first move than a
file write — it can be slow, it can fail, and a lost remark is the one defect this skill cannot
afford. So:

1. Write the item to the file, with `pushed: false`.
2. Call `acceptance_add_remark`. On success, record `galy_id` and set `pushed: true`.
3. **If it fails, say nothing and move on.** Do not retry on the spot, do not slow the person down,
   do not turn a background hiccup into a conversation. The remark is already safe.

**The catch-up rides on the next push.** Before sending a new remark, send any that are still
`pushed: false`, oldest first. No timer, no background task — the next gesture carries the backlog.

**And an unreachable Galy never stops a pass.** If `acceptance_open` fails at start, open the pass
locally with `galy_session: null` and keep going; the first push that succeeds opens it and adopts
the backlog. Refusing to start an acceptance pass because a server did not answer would be exactly
backwards.

## start

1. Name the session after what is being reviewed, not after a date. Create the branch from the base
   branch if you are not already on one for this session; resume the existing file if there is one.
2. `acceptance_open(title=<what is being reviewed>, branch_name=<branch>)` → record `galy_session`.
   It is idempotent on the branch, so resuming hands back the same pass rather than forking the queue.
3. Start the product the way this repository starts it, and keep it running — every item is verified on
   the real surface before it is called done.
4. Open **one** draft PR for the whole session, record its URL in the file, and
   `acceptance_set_pr(galy_session, prNumber, prUrl)`. One session, one PR: a PR per remark buries the
   reviewer, and a reviewer who skims is a reviewer you no longer have.
5. Say in one line that you are ready to take remarks, then stop talking. The person is looking at the
   product, not at your terminal.

**EVERYTHING YOU SAY IN THIS PASS IS IN THE PERSON'S OWN LANGUAGE**, and that includes the four words
you say most often. This skill is written in English because the kit is; the person facing the product
did not ask for English, and a French session that answers `#3 queued` has just told them the tool was
not built for them. The state names — `pending`, `done`, `wont_fix` — are data and stay as they are in
the file and in Galy; what you PRINT is theirs.

## Taking the remarks

Every line the person types that is not a mode is a remark. **Write it to the file first**, push it to
Galy second, then acknowledge in a single short line — the number, the remark's first words, and one
word saying it is recorded, in their language — and nothing else. No restating it back in your own words, no plan, no estimate, and
no mention of the push either way.

## Drain

Pick the **oldest** `pending` item. Not the last one typed: a fresh remark joins the back of the queue.

1. Mark it `in_progress` in the file. `acceptance_claim_next(galy_session, claimed_by=<hostname>)`
   keeps Galy in step and, if you die mid-item, lets the next session pick it up when the lease runs out.
2. Fix the cause, following the `bug-fix` discipline. **Decide trivia on the spot** — naming, which file,
   which format, anything you can settle from the code in under a minute.
3. **Only what a commit cannot undo parks**: write the question into the item, set it `awaiting_user`,
   `acceptance_park(galy_id, question_md)`, and move to the next item. Never wait, never end the turn on
   it. The person can also answer it from the Galy screen, and the queue picks that up.
4. Verify it on the surface the person was looking at, in the running product.
5. One commit, referencing the item, pushed to the session branch.
6. Mark it `done` with the commit sha and one line of what changed; then
   `acceptance_resolve(galy_id, status="done", commit_sha=…, result_md=…)`.

Then pick the next oldest. Repeat until nothing is `pending` — an emptied queue is a release, so run the
environment's release step, then go back to taking remarks.

**A remark you looked at and chose to leave alone is `wont_fix`, never `done`.** Put the reason in
`result_md` — that is the whole point of the state. What you fixed is readable in the commits; what you
knowingly decided not to fix is readable nowhere else, and it is the half nobody can reconstruct three
months later. `failed` is for something you genuinely could not fix, and the reason goes there too.

Short items stay inline — an agent per remark costs more than it saves. A long item, judged before
opening the code, is always delegated to a background agent, so that the next remark finds you free.
Related long items can queue on the same agent; different ones take another; independent ones launch
together.

## status

Print one compact block, every item named by its first words: done (with commits) · in progress ·
pending · set aside · open questions.
Nothing else — **unless remarks are still `pushed: false`**, in which case say how many, on one line.
That number is the only thing standing between a pass and a trace nobody will find.

## answer

`answer <n> <text>` appends the answer to item `n`, calls `acceptance_answer(galy_id, answer_md)`, and
puts it back to `pending`. It is picked up in its original position, not at the front — the order the
person gave still holds.

## stop

1. Close the intake in the file — the field is `intake`, and it stays that word.
2. **Push whatever is still `pushed: false`.** If any of them will not go, say which, and stop there.
   Closing a pass whose remarks never reached Galy is closing a pass nobody can read back — the exact
   thing this skill exists to prevent.
3. Drain what is left. If items are still `awaiting_user`, surface them and stop there: they are the only
   other thing that legitimately blocks.
4. Hand the single PR to `ship` — the review panel runs on the whole session's diff at once.
5. `acceptance_close(galy_session, status="merged")`, and print the Galy link to the pass.
6. The kit ends at **PR ready** and hands over: run the environment's release step if it has one.
   Merging is that step's call, and its gate.

## Discipline

- **You speak the person's language, always.** The skill is in English, the states are in English, the
  person is not. What appears on their screen is theirs.
- **The file is written before anything else happens, and Galy right after.** A remark that exists only
  in context is a remark you will lose, and nobody will know which one.
- **A failed push is not an event.** It costs the person nothing and it costs you one line at `status`.
  Never interrupt a pass to report one.
- **Never end a turn waiting for a go.** A recap is not a stop. Keep draining.
- **Park what a commit cannot undo, and nothing else.** A change one revert takes back is yours to
  make: if you have a recommendation, apply it and say which one — waiting costs more than being wrong.
- **Newest is not next.** After each item, re-pick the oldest `pending`.
- **One item, one commit.** A commit that carries three remarks cannot be reverted for one of them.
- **Verified means seen.** An item is `done` when you watched the product do the right thing, not when
  the build went green.
