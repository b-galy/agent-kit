import type { EngineInterface, On } from 'claude-code'

import { detailOf, reconcileIdleAgents, statusOf, type IdleAgent, type IdleSince } from './idle'
import {
  COMMAND_DESCRIPTION,
  COMMAND_NAME,
  DEFAULT_IDLE_THRESHOLD_MINUTES,
  MAX_IDLE_THRESHOLD_MINUTES,
  MIN_IDLE_THRESHOLD_MINUTES,
  STATUS_LINE_BUDGET_CHARS,
  storeKey,
} from './names'

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value))

/**
 * Reads this turn's roster, reconciles it against what the plugin kept from the last check,
 * persists the result, and pins (or clears) the status line for it.
 *
 * Shared by the two callers that need a fresh reading: the end of a main-loop turn, and
 * `/idle-agents` asked for the detail beneath it. Both leave the session in the same state —
 * `/idle-agents` is a look at the truth, not a separate one.
 */
async function recompute(
  $: EngineInterface,
  thresholdMs: number,
  touchedSinceLastCheck: Set<string>,
): Promise<readonly IdleAgent[]> {
  const [agents, now, sessionId] = await Promise.all([$.agent.list(), $.clock.now(), $.session.id()])

  const key = storeKey(sessionId)
  const previous = ((await $.store.get(key)) as IdleSince | undefined) ?? {}

  const { since, idle } = reconcileIdleAgents(agents, now, previous, touchedSinceLastCheck)
  touchedSinceLastCheck.clear()

  await $.store.set(key, since)
  $.ui.status(statusOf(idle, thresholdMs, STATUS_LINE_BUDGET_CHARS))

  return idle
}

/**
 * Registers the idle-agents reminder: at the end of every main-loop turn, names the background
 * agents that reported back and have sat idle since, with the line ready to copy to close them.
 *
 * It closes nothing itself — the engine gives a plugin no such call (`$.agent` is `spawn`, `list`
 * and `register`, nothing that ends one; only the person's own TaskStop, typed back at the model,
 * actually stops one). What this plugin can do, and what a pilot running several agents in
 * parallel actually needs, is make the cost of leaving them open visible at the moment that costs
 * nothing to act on — right after a turn, before the next one starts — and never louder than that:
 * nothing shows while every agent is either running or freshly back, and the line clears itself
 * the moment the last idle one is gone.
 *
 * `idle` never means forgotten: a teammate that delivered its report and is waiting for its next
 * instruction is idle by design, and staying addressable across many turns is the whole point of
 * one. This plugin only ever counts time, never assumes intent, and the pilot is the one who
 * decides what a long idle time means.
 *
 * @param on the engine's registrar
 * @param options `idleThresholdMinutes`, from the plugin's `userConfig`
 */
export function register(on: On, options: { idleThresholdMinutes?: number }) {
  const thresholdMs =
    clamp(
      options.idleThresholdMinutes ?? DEFAULT_IDLE_THRESHOLD_MINUTES,
      MIN_IDLE_THRESHOLD_MINUTES,
      MAX_IDLE_THRESHOLD_MINUTES,
    ) * 60_000

  let isActive = false

  // Every id or name a `SendMessage` addressed since the last check — read and cleared inside
  // `recompute`, so it only ever answers for the turn about to be reconciled. In memory only:
  // losing it to a hot reload costs one turn of stale `since` for a just-reused agent, never a
  // wrong answer that lingers, since the next `SendMessage` to it is caught the same way.
  const touchedSinceLastCheck = new Set<string>()

  on('session.start', async ($, e, next) => {
    if (e.surface !== null && e.isInteractive) {
      isActive = true

      // A name already taken (another plugin's `/idle-agents`, unlikely but cheap to guard)
      // costs this plugin its own door and nothing else — the reminder still shows.
      await $.command.register({ name: COMMAND_NAME, description: COMMAND_DESCRIPTION }).catch(() => undefined)
    }

    return next(e)
  })

  on('tool.call', { tool: 'SendMessage' }, async ($, e, next) => {
    if (typeof e.to === 'string') touchedSinceLastCheck.add(e.to)

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    // Every hook sees a subagent's own turn too; this plugin only ever checks in at the end of
    // the main loop's, or it would recompute — and pin a status line no subagent has — once per
    // spawned agent's turn as well.
    if (!isActive || e.agentId !== undefined) return next(e)

    await recompute($, thresholdMs, touchedSinceLastCheck).catch(() => undefined)

    return next(e)
  })

  on('command.run', { command: COMMAND_NAME }, async ($, e, next) => {
    if (!isActive) return next(e)

    const idle = await recompute($, thresholdMs, touchedSinceLastCheck)

    return { text: detailOf(idle, thresholdMs) }
  })
}
