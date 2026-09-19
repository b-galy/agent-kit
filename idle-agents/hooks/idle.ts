// The plugin's own reasoning, kept free of `$`: given a roster and a clock reading, what is idle,
// since when, and what a turn should show for it. `register.ts` is the only file that calls into
// the engine; everything here is a plain function over plain data, so `idle.test.ts` proves it
// without mounting anything.

import type { AgentInfo } from 'claude-code'

/** How long each still-listed, addressable agent has been idle, keyed by its id. Persisted in `$.store`. */
export type IdleSince = Readonly<Record<string, number>>

/** One idle agent, ready to report. */
export type IdleAgent = {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly idleMs: number
}

/** What one turn's worth of bookkeeping produced: the map to persist, and every agent it still finds idle. */
export type IdleSnapshot = {
  readonly since: IdleSince
  readonly idle: readonly IdleAgent[]
}

/**
 * A background agent still listed and not running: the one kind of row this plugin ever counts.
 *
 * An agent with no `name` is a synchronous subagent — it cannot outlive the call that made it, so
 * it never sits idle waiting to be closed. `killed` means someone (or something) already stopped
 * it: it costs nothing left in the display and there is nothing left to close.
 */
const isTrackable = (agent: AgentInfo): agent is AgentInfo & { name: string } =>
  agent.name !== undefined && agent.status !== 'running' && agent.status !== 'killed'

/**
 * Reconciles this turn's roster against the last one this plugin checked, and answers who is idle
 * and since when.
 *
 * An agent keeps its old `since` across turns — that is what lets a two-hour-old agent be named as
 * such. It gets a fresh one, `now`, in two cases: the first time this plugin ever sees it idle, and
 * when `touched` says the pilot addressed it again since the last check (a `SendMessage` this very
 * turn, caught by `register.ts`'s own `tool.call` hook). Without that second case, a teammate the
 * pilot just resumed would still carry the idle time from before it was reused — exactly the agent
 * this plugin must stay quiet about, since it is the one about to be used, not the one left behind.
 *
 * @param agents `$.agent.list()`, this turn's whole roster
 * @param now milliseconds since the epoch, this turn's own clock reading
 * @param previous the `since` map this plugin kept from the last turn it checked
 * @param touched every id or name a `SendMessage` addressed since the last check
 */
export function reconcileIdleAgents(
  agents: readonly AgentInfo[],
  now: number,
  previous: IdleSince,
  touched: ReadonlySet<string>,
): IdleSnapshot {
  const since: Record<string, number> = {}
  const idle: IdleAgent[] = []

  for (const agent of agents) {
    if (!isTrackable(agent)) continue

    const trackedSince = previous[agent.id]
    const wasTouched = touched.has(agent.id) || touched.has(agent.name)
    const idleSince = trackedSince !== undefined && !wasTouched ? trackedSince : now

    since[agent.id] = idleSince
    idle.push({ id: agent.id, name: agent.name, description: agent.description, idleMs: now - idleSince })
  }

  // Oldest first throughout: a report's `overdue[0]` is always the one that has waited longest.
  idle.sort((a, b) => b.idleMs - a.idleMs)

  return { since, idle }
}

const MINUTE_MS = 60_000

/** `42m`, `1h`, `1h12m` — never a decimal, never a unit smaller than a minute. */
export function formatDuration(ms: number): string {
  const totalMinutes = Math.max(0, Math.round(ms / MINUTE_MS))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  if (hours === 0) return `${minutes}m`

  return minutes === 0 ? `${hours}h` : `${hours}h${minutes}m`
}

const closeLine = (names: readonly string[]): string =>
  names.length === 1 ? `Close ${names[0]}, it's done.` : `Close ${names.join(', ')}, they're done.`

/**
 * What `$.ui.status` should show at the end of a turn, or `undefined` when nothing has sat idle
 * past `thresholdMs` — the plugin's status line disappears the moment there is nothing to say,
 * rather than sitting there empty or repeating itself.
 *
 * The names ride on the line itself while the whole thing fits in `budgetChars`; past that it
 * falls back to a count and a pointer to `/idle-agents`, which always carries the full list.
 *
 * @param idle every agent `reconcileIdleAgents` currently finds idle, oldest first
 */
export function statusOf(
  idle: readonly IdleAgent[],
  thresholdMs: number,
  budgetChars: number,
): string | undefined {
  const overdue = idle.filter(agent => agent.idleMs >= thresholdMs)
  if (overdue.length === 0) return undefined

  const names = overdue.map(agent => agent.name)
  const oldest = formatDuration(overdue[0]!.idleMs)
  const count = `${overdue.length} agent${overdue.length > 1 ? 's' : ''} idle`
  const withNames = `${count} (oldest ${oldest}): ${names.join(', ')} — copy: "${closeLine(names)}"`

  return withNames.length <= budgetChars ? withNames : `${count} (oldest ${oldest}) — /idle-agents to see them`
}

/**
 * What `/idle-agents` prints: every idle agent with its own duration, then the line ready to copy
 * for the ones already past the threshold — the detail the status line falls back to a pointer for.
 */
export function detailOf(idle: readonly IdleAgent[], thresholdMs: number): string {
  if (idle.length === 0) return 'No agent is sitting idle in this session right now.'

  const overdue = idle.filter(agent => agent.idleMs >= thresholdMs)
  const rows = idle.map(agent => `  ${agent.name}  —  idle ${formatDuration(agent.idleMs)}`).join('\n')
  const closing =
    overdue.length > 0
      ? `\n\nCopy to close the one${overdue.length > 1 ? 's' : ''} past the threshold:\n"${closeLine(
          overdue.map(agent => agent.name),
        )}"`
      : '\n\nNone of them has sat idle past the threshold yet.'

  return `${idle.length} agent${idle.length > 1 ? 's' : ''} idle:\n${rows}${closing}`
}
