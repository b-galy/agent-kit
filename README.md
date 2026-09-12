# Galy Agent Kit

Drive your work in [Galy](https://galy.io) — strategy, briefs, specs — and let **your own agent**
read those objects and implement them **in your own repository**.

Galy is an agent-native project-management tool. You define the *why* (strategy → briefs) and the *how*
(specs) inside Galy; this kit connects your assistant to that workspace over MCP so it can plan,
implement, and follow up — without you ever copy-pasting a ticket into a prompt.

## Galy never sees your code

This is the core guarantee, enforced end to end:

- The flow is **strictly outward**. Your assistant *reads* strategy, briefs and specs from Galy, and
  *writes back* plans, statuses and follow-ups. That's it.
- **No tool accepts source code, a diff, or file content** — verified by the conformance suite
  (`galy/contract/conformance`), which fails if any verb ever declares a `code` / `diff` / `file_content`
  parameter.
- Your codebase is explored **locally** by your assistant. It never leaves your machine.

You are connecting *your assistant* to *your Galy workspace* — not giving Galy access to your repository.

## Local bug evaluation runner

The plugin ships the portable `bg bug-evaluation` command. It qualifies a Linux bubblewrap profile,
creates a content-addressed local snapshot, polls and claims a server run, and keeps reports, patches
and prompts in the workstation archive. The server receives only the typed run contract and opaque
hashes. Use `bg bug-evaluation run self-test` for the controlled analyst → solver → oracle → judge
qualification; it makes no model or billing request. Real runs use a named provider adapter
(`openai` Responses API or `anthropic` Messages API; `--adapter <name>`) whose model, harness and
effort identity must match the server contract. Unknown providers and harnesses are refused, and
the fixture adapter is accepted only by the self-test path.
Real runs also require an evaluator-owned `bug-evaluation-oracle-v1` JSON descriptor containing one
shared shell check and a local reference root. The runner mounts each fresh baseline, reference and
candidate root as `/input` and executes that exact check inside the qualified read-only bubblewrap
sandbox; variant-specific commands and reference/candidate mounts are refused.
A remote oracle is available only for explicit adapter qualification with `--allow-remote-oracle`.
Each provider request is journaled before dispatch with a stable workspace/run/role identity and
idempotency key. A `requesting` or `unknown` journal is reconciled by the adapter before any retry;
an unresolved billable request stays recoverable and is never dispatched a second time. When a
provider supplies its receipt later, `bg bug-evaluation run settle` attaches the immutable amount,
currency, cost basis and pricing version to that same attempt without another provider request.

Snapshots exclude Git history, caches, instruction files, secrets and links. Archive retention is 180
days by default, with preflight limits of 2 GiB per snapshot, 20 MiB per patch, 50 MiB per log and a
4 GiB local archive. Every published run requires a frozen `IsolationProfileHash`, an explicit
`--profile-file` and `--profile-root`; the runner re-runs the qualification probe before any model
call. Production Galy endpoints require an explicit `--allow-production` after the approved budget
and worker are ready; otherwise point a qualification at a disposable local or staging endpoint.
Keep `GALY_TOKEN` in the process environment. `bg bug-evaluation inspect --human` emits a separate
opaque reviewer projection without model, configuration, verdict or billing fields, and
`bg bug-evaluation rejudge` approves (or reuses `--protocol-revision`) and executes one judge-only
protocol against the existing final archive. It records a new attempt/evaluation revision without
rerunning analysis or solver work; pass the approved worker and lease generation for publication.
Use `--approve-only` when preparing a protocol without executing its judge.

## Install

### Option A — one command (recommended)

```
npx -y github:b-galy/agent-kit <your-galy-token> --endpoint https://<your-workspace>.galy.cloud
```

Both values are on one page in Galy — **Connect my agent**, in the top bar of any screen — which prints
that exact command with your address already filled in, and a copy button. Every active member of the
workspace reaches it and mints **their own** token: a borrowed one would attribute your check-ins and
every access-log line to somebody else.

It installs the plugin, registers the MCP endpoint **for that project only** (address and token stored
literally in Claude Code's local scope, outside your repository), writes `.bg/config.json` for the
CLI, gitignores it, and proves the connection before saying it worked — by shaking hands with `/mcp`,
the door your assistant will actually use, rather than with the REST surface it will not.

There is no default address, on purpose: Galy is multi-tenant, and every workspace answers on its own
host. A guessed host does not fail loudly — it fails as a `401` that reads like a bad token.

### Option B — via the plugin marketplace

```
claude plugin marketplace add b-galy/agent-kit
claude plugin install bg@b-galy
```

**Installed while the marketplace was still called `galy`?** A workstation keys the plugin by the
marketplace's name, so the old entry stays and keeps serving its cached copy. Re-run the setup command
above, or by hand: `claude plugin marketplace remove galy`, then the two lines of option B.

The plugin declares no MCP server of its own, so it has nothing to connect to yet. Open your agent in
your repository and it will say so and point you at the `connect` skill — or run the `galy-setup`
command above, which does the same thing in one line.

Your token never goes into a tracked file, a shell profile, or the Windows registry.

### How updates reach you

The marketplace tracks this repository, so a skill improved here reaches every installation without
anyone reinstalling anything — that is the whole point of shipping through a marketplace rather than a
copy per client. What it does not do is arrive the same second: your agent refreshes its marketplace
cache on its own schedule. To pull the current state right now:

```
claude plugin marketplace update b-galy
```

## It says nothing until you ask

**The kit takes no part in the opening of a session.** It installs no startup hook, injects no
instruction, and spends none of a session's first seconds on itself. Open your agent in a connected
repository and you get your agent, on the subject you came for.

That was not always so. A `SessionStart` hook used to hand every session one instruction — read the
practice baseline, then open on a line about it — and it was wrong on both counts. It cost a process
at every start, and the line landed in front of somebody who had come to do something else. A tool
that says its own name before the user has said theirs is a tool people turn off, and the practices
are worth more than the reminder that they exist.

The only thing the kit does at the other end is let go. When a session closes, the row under the
prompt drops the work it was naming, so the next one opens on an empty row rather than on yesterday's
spec — a row that names the wrong work is read as the right one, every time.

Nothing has to be typed as a command. **A plain sentence starts the first pass** — "démarre
l'onboarding Galy", "start the Galy onboarding", "où en sont nos pratiques ?", "fais le point" — and
the `audit` skill takes it from there.

## The first pass is a conversation, not a script

`audit` orchestrates from your own session: it opens the pass, runs the probes the instance can
run alone, then **asks you what it may look at** — the repository and its history, the forge, the
infrastructure, production in read. Each authorised surface immediately puts a **subject agent** on
it, and they work in parallel while the conversation continues.

| Agent | What it observes |
|---|---|
| `project-management` | **first, alone** — where briefs, specs, tickets and objectives already live, and whether an assistant can reach them |
| `ground` | the written doctrine, and whether the infrastructure description still matches reality |
| `secrets` | the git history, the secret store, and whether production can be read without being able to write |
| `delivery` | review, quality gate, release trace, rollback, environment isolation — over 90 days of forge history |
| `schema` | the tooled schema path, reversible migrations, gated data repairs, server access |
| `autonomy` | the tool contract, strategy in the system, and the four criteria of unattended work |

**What you do not authorise is not probed**, and its criteria are recorded as not verifiable with the
reason — never guessed, never quietly skipped. The questions gate the work; they are not a formality.

The questions stay in your session on purpose: a subagent cannot reach you, so the orchestrator asks
and the agents look.

## It fits into what you already have — as a pull request

`project-management` runs **first and alone**, because one fact changes the meaning of everything
else: *where does your work already live?* A team that tracks its briefs and tickets in an existing
system will not move them, and should not have to.

What comes out of it is not a report but a **pull request**, opened by `adapt`:

- one **delimited section added** to your root instruction file — who owns what, which id shape
  belongs to which system, and the rule that nothing existing changes;
- **skills bound to your environment**, written beside your own — your server names, your id shapes,
  your branch and commit conventions read from your history.

Name collisions are the common case, not the edge case: a team already working this way has skills
called `feature-spec` and `feature-implement` too. `adapt` never overwrites one. It either skips
yours — saying what Galy would have added — or ships its own under a `galy-` prefix, and tells you
how to tell them apart.

No workflow is edited, no command renamed, no `.mcp.json` touched, and **the pull request is never
merged**. Your review is the point.

## What the skills do on their own, and what they stop to ask

Every preference answers one question: when a skill reaches a step it could take unattended —
committing a reviewed change, opening the pull request, moving to the next phase — does it take it,
or does it stop and ask you?

Two layers decide, and the top one wins: your **administrator's policy** for the whole workspace —
`allow`, `deny`, or `user_choice`, set per skill and per option — and, under `user_choice`, **your
own preference**. Both live on your Galy account, so they follow you from one checkout to the next;
a local `.bg/workflow-defaults.json` mirrors the user layer for headless runs, and is never
committed.

Ask "quels réglages Galy sont actifs ?" and the `workflows` skill shows the table, says who decided
each line, and links the page on your account. `ask` is always a real answer, never a fallback: a
developer who wants the question every time has decided to stay in the loop.

None of it makes the kit merge or deploy. It **stops at "PR ready"** — a documented boundary, not a
gap — and the merge stays with the process you already have.

### Nothing leaves your instance

No verb in this kit sends anything out of your tenant. **Support is blind by construction**, and
nothing in the contract can change that.

The first pass finishes by **writing** a retrospective — what worked, what was awkward, the
questions it could not answer, your suggestions — about the onboarding process itself. It is
written to your own instance and nothing is asked, because writing in your own workspace asks
nobody's permission.

Whether that instance forwards anything to Galy is an **instance setting your administrator holds**,
disabled by default. It is not a question put to the developer at the terminal, and no skill
pretends otherwise.

## What you get

Eighteen skills that take a need from idea to shipped, each driven by the Galy objects you manage:

| Skill | What it does |
|---|---|
| `audit` | Where your practices stand, first pass and every one after: audit how you already track work, open the adapting pull request, observe the twenty criteria, record what was seen. Applies nothing. |
| `adapt` | Turn the kit's generic skills into skills bound to your environment, as a pull request. Never overwrites, never merges. |
| `connect` | Wire a repository to your workspace, or diagnose a connection that answers nothing. |
| `workflows` | See and change what the skills may do on your behalf — and what your administrator decided for everyone. |
| `bug-fix` | A bug from report to pull request: reproduce first, fix the cause, prove it on the user's own path, leave a follow-up check. |
| `report` | Receive a bug report or improvement request from an agent, find or create its ticket, and return the link. |
| `acceptance` | Sit in front of the running product and fire remarks: each is queued the instant it lands, then coded one at a time in the order received — one commit per remark, a single PR. |
| `strategy` | Explore your objectives tree (read-only) and map work to the objective it serves. |
| `okr-review` | Where the objectives stand: the tree with its progress, off-track and unreported key results first, and the pace each one now demands. Reads only. |
| `okr-checkin` | The check-in ritual: one pass over the key results you own, one question, a dated trace on every figure that moved. |
| `feature-brief` | Frame a business need into a brief — problem, vision, user stories, success criteria. |
| `feature-spec` | Turn a brief into a technical spec — explore your codebase, design, phases, risks, acceptance tests. |
| `feature-implement` | Implement a spec autonomously in your repo, phase by phase, ending at "PR ready". |
| `feature-followup` | Replay a delivered spec's checks in production and reschedule the next horizon. |
| `retro` | Post durable learnings from a run as retro suggestions for later review. |
| `contrarian` | Challenge an idea before you commit — adversarial sub-agents + a verdict you own. |
| `analyse` | Meta-reflection on the assistant's own behavior, producing concrete rule edits. |
| `ship` | Commit, open a PR, run a self-review panel, fix blockers — ends at "PR ready" (never merges). |
| `end` | Celebrate a verified delivery with a live deep link. |

The kit **stops at "PR ready"** on purpose. Merging and deploying stay with your own CI/process — a
documented extension point, not a gap.

## The `bg` CLI

A shell-friendly companion to the MCP tools — search work items, read compact JSON cards, and pull/push
the large markdown bodies of briefs and specs as local files:

```
bg search "seller onboarding"
bg brief 12
bg spec 42
bg content pull feature-spec 42     # → .tmp/galy-content/feature-spec/42.md
bg content push feature-spec 42     # after you edit the buffer
```

It reads its config from `GALY_ENDPOINT` / `GALY_TOKEN` or `.bg/config.json`. Like the tools, it only
carries work items and their text — never your source.

## More than one harness

The kit is written for an agent, not for one vendor's agent. The product already holds that line
and tests it — its maturity catalogue carries no vendor name, so a client who changes harness keeps
their score — and this repository is the side the client actually installs, so it has to hold the
same line.

`galy/skills/` and `galy/agents/` are the source of truth. A projection turns them into the layouts
Codex reads:

```
node scripts/build-codex.mjs           # write .agents/skills/ and .codex/agents/
node scripts/build-codex.mjs --check   # report drift, write nothing (CI)
```

Two properties make it trustworthy rather than decorative:

- **The transformation is mechanical.** The body markdown is copied byte for byte — published
  measurements put model-authored instruction files at -20% success rate and +20% inference cost,
  so no sentence is reworded, shortened or summarised. Everything the projection adds sits above
  the original text.
- **Capabilities Codex lacks are declared, never silently dropped.** Each generated file opens with
  the list of proprietary capabilities its body uses and what to do instead. The reader sees the
  gap; the text stays intact. Substituting names inside the prose would corrupt code fences and
  tables, and would be a rewrite.

What the projection currently declares missing:

| Capability | Where | What a Codex session does instead |
|---|---|---|
| `AskUserQuestion` | `audit` | Ask in plain text with numbered options and wait — never assume a default |
| the `bg:` namespace | `adapt`, `audit`, `bug-fix`, `connect`, `autonomy` | One flat namespace: drop the prefix; a `bg:<agent>` is a Codex subagent, a `bg:<skill>` a Codex skill |
| `${CLAUDE_PLUGIN_ROOT}` | 8 skills | Read the file from `.agents/skills/` relative to the repository |
| `CronCreate` | `feature-implement` | A scheduled task on the host, with a written stop condition |

The first line is the honest one: `audit` orchestrates through a question only some harnesses can
ask. Codex reads that it must ask in text and wait, rather than finding the step quietly removed.

The output is gitignored. It is a build artifact, not a second copy to maintain.

## Layout

```
.claude-plugin/marketplace.json   # marketplace entry
galy/
  .claude-plugin/plugin.json      # plugin manifest
  hooks/hooks.json                # the guard on CLAUDE.md, the work in hand (taken on a write, let go when the session ends), and two Stop hooks: work recorded, slot given back
  statusline/bg-statusline.mjs    # the row under the prompt: objective > brief > spec, for this copy's own work
  agents/<name>.md                # the 6 subject agents the first pass dispatches
  skills/<name>/SKILL.md          # the 17 skills
  instructions/                   # shared conventions the skills reference
  contract/pm-v1.json             # the project-management tool + REST contract
  contract/conformance/           # the outward-only conformance suite (MCP + REST)
  bin/bg.mjs                      # the bg CLI
package.json                      # makes the repo itself runnable: npx -y github:b-galy/agent-kit
setup/setup.mjs                   # the one-command setup
scripts/build-codex.mjs           # projection into the layouts Codex reads (gitignored output)
```

## License

Proprietary — see [LICENSE](LICENSE). Use is tied to a valid Galy account.
