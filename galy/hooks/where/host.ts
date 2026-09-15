import type {
  CommandSpec,
  FsStat,
  McpToolResult,
  PaneCloseArgs,
  PaneOpenArgs,
  TimerCall,
  ToolInfo,
} from 'claude-code'

/**
 * The engine as `session.start` bound it from its `$`, each member spelled
 * `$.noun.event(...)` there; every later hook, timer and press reads it through this.
 *
 * Binding it once is what makes the rest of the mod plain functions over an object: a
 * test hands the same shape and never a running Claude Code.
 */
export type Host = {
  /** `$.clock.now`. */
  now: () => Promise<number>

  /** `$.clock.after`. */
  after: TimerCall

  /** `$.clock.every`. */
  every: TimerCall

  /** `$.fs.exists`. */
  exists: (path: string) => Promise<boolean>

  /** `$.fs.read`; rejects where the file is not there. */
  readFile: (path: string) => Promise<string>

  /** `$.fs.stat`. */
  stat: (path: string) => Promise<FsStat>

  /** `$.store.get`: the plugin's store, shared by every session of this machine. */
  storeGet: (key: string) => Promise<unknown>

  /** `$.store.set`. */
  storeSet: (key: string, value: unknown) => Promise<void>

  /** `$.mcp.call`: the session's own connection and credentials, never the plugin's. */
  mcpCall: (server: string, tool: string, args: Record<string, unknown>) => Promise<McpToolResult>

  /** `$.tool.list`: what the model can call now, built-in and MCP alike. */
  toolList: () => Promise<ToolInfo[]>

  /** `$.session.cwd`. */
  cwd: () => Promise<string>

  /** `$.ui.invalidate("ui.render")`: every pane instance draws again. */
  invalidate: () => void

  /** `$.ui.log`: one debug line under the plugin's name. */
  uiLog: (text: string) => void

  /** `$.ui.open`. */
  openPane: (pane: PaneOpenArgs) => Promise<void>

  /** `$.ui.close`. */
  closePane: (pane: PaneCloseArgs) => Promise<void>

  /** `$.command.register`; rejects while another `/where` is listed. */
  registerCommand: (spec: CommandSpec) => Promise<unknown>
}
