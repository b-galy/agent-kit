// Constants for the idle-agents plugin: thresholds, the store key, the
// registered command, and the budget that decides whether names fit on the
// status line or the plugin falls back to a count.

/**
 * Below this, an agent has probably just been handed its task and is still
 * working through it, or the pilot stepped away for a moment — not yet
 * worth a line. Above thirty, it is very likely the pilot moved on and
 * never came back to it. Fifteen sits between the two: long enough that a
 * still-thinking agent will not be named by mistake, short enough that a
 * two-hour session (the case this plugin was written for) gets more than
 * one reminder along the way.
 */
export const DEFAULT_IDLE_THRESHOLD_MINUTES = 15

/** Floor and ceiling `idleThresholdMinutes` is clamped to, against a typo in `/config`. */
export const MIN_IDLE_THRESHOLD_MINUTES = 1
export const MAX_IDLE_THRESHOLD_MINUTES = 240

/**
 * How long a status line is let run before the plugin drops the names and
 * falls back to a count with a pointer to `/idle-agents`. A terminal's
 * narrowest common width leaves room for this and the engine's own pinned
 * notices beside it.
 */
export const STATUS_LINE_BUDGET_CHARS = 150

/** The slash command that prints every idle agent and the line ready to copy. */
export const COMMAND_NAME = 'idle-agents'
export const COMMAND_DESCRIPTION =
  'List the agents sitting idle in this session, and the line ready to copy to close the old ones.'

/** This plugin's `$.store` key, namespaced per session so concurrent sessions never share one map. */
export const storeKey = (sessionId: string): string => `idleSince:${sessionId}`
