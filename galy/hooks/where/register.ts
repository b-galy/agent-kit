import type { On, RenderSurface, ToolInfo } from 'claude-code'

import type { Host } from './host'
import * as Names from './names.mjs'
import { dockRows, inlineRows } from './render.mjs'
import { payloadOf, readerOf, serverOf, serversOf } from './reader.mjs'
import { buildModel } from './tree.mjs'
import { paneView, type Press, type Row } from './views.jsx'
import { heldOf, holdsSomething, workFileOf, workingCopyRootOf } from './work-file.mjs'

type Model = Awaited<ReturnType<typeof buildModel>>
type Reader = ReturnType<typeof readerOf>

const EMPTY_MODEL: Model = { status: 'empty', trees: [], gaps: [] }

/** Every surface that draws the pane: all but the mobile app, which is not terminal-wide. */
const isOnPaneSurface = <E extends Record<'surface', RenderSurface>>(
  e: E,
): e is Exclude<E, Record<'surface', 'mobile'>> => e.surface !== 'mobile'

/** A workspace write: what makes the pane worth drawing again. */
const isWorkspaceWrite = (tool: string): boolean =>
  /^mcp__.+?__(feature_(spec|brief)|strategy)_/.test(tool)

/**
 * Registers the pane that names, beside the transcript, the strategy tree of what this
 * working copy has in hand.
 *
 * `session.start` binds the host every later hook reads through and registers `/where`;
 * outside an interactive terminal it binds nothing, so a `-p` run loads a module that
 * does not exist as far as the run is concerned. Everything else hangs off that bind:
 * with no host, every hook passes straight through.
 *
 * @param on the engine's registrar
 */
export function register(on: On) {
  let host: Host | null = null
  let reader: Reader | null = null
  let tools: ToolInfo[] = []
  let root: string | null = null

  let model: Model = EMPTY_MODEL
  let isLoading = false
  let isRefreshing = false
  let isRefreshQueued = false
  let isPaneOpen = false
  let hasAutoOpened = false
  let columns: number | null = null
  let fileStamp = 0
  let expanded: Record<string, boolean> = {}

  const timers = new Map<'refresh' | 'redraw' | 'poll', { cancel: () => void }>()

  // ── Drawing ─────────────────────────────────────────────────────────────

  function redraw(engine: Host) {
    if (timers.has('redraw')) return
    timers.set(
      'redraw',
      engine.after(Names.REDRAW_COALESCE_MS, () => {
        timers.delete('redraw')
        engine.invalidate()
      }),
    )
  }

  // ── Reading ─────────────────────────────────────────────────────────────

  function readerFor(engine: Host): Reader {
    reader ??= readerOf({
      call: async (server, tool, args) => payloadOf(await engine.mcpCall(server, tool, args)),
      storeGet: key => engine.storeGet(key),
      storeSet: (key, value) => engine.storeSet(key, value),
      now: () => engine.now(),
      has: (server, tool) => tools.some(listed => listed.name === `mcp__${server}__${tool}`),
    })

    return reader
  }

  /** The work file's modification time, 0 where there is none yet. */
  async function stampOf(engine: Host): Promise<number> {
    if (root === null) return 0

    return engine
      .stat(workFileOf(root))
      .then(stat => stat.mtimeMs)
      .catch(() => 0)
  }

  /** What the copy has in hand, read from its own file and nowhere else. */
  async function heldNow(engine: Host) {
    if (root === null) return { specs: [], briefs: [] }

    const text = await engine.readFile(workFileOf(root)).catch(() => '')

    return heldOf(text, await engine.now())
  }

  async function refresh(engine: Host): Promise<void> {
    if (isRefreshing) {
      isRefreshQueued = true

      return
    }

    isRefreshing = true

    try {
      const held = await heldNow(engine)
      fileStamp = await stampOf(engine)

      if (!holdsSomething(held)) {
        model = EMPTY_MODEL
        isLoading = false

        return
      }

      if (tools.length === 0) tools = await engine.toolList().catch((): ToolInfo[] => [])
      isLoading = model.trees.length === 0
      redraw(engine)

      const known = readerFor(engine)
      const servers = serversOf(tools)

      model = await buildModel({
        held,
        read: (server, kind, id, wanted) => known.read(server, kind, id, wanted),
        serves: (server, tool) => known.serves(server, tool),
        serverFor: named => serverOf(named, tools) ?? servers[0] ?? null,
      })
      isLoading = false
    } catch (error) {
      isLoading = false
      engine.uiLog(`où j'en suis : ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      isRefreshing = false
      redraw(engine)

      if (isRefreshQueued) {
        isRefreshQueued = false
        scheduleRefresh(engine)
      }
    }
  }

  function scheduleRefresh(engine: Host, delayMs = 0) {
    timers.get('refresh')?.cancel()
    timers.set(
      'refresh',
      engine.after(Math.max(1, delayMs), () => {
        timers.delete('refresh')
        void refresh(engine)
      }),
    )
  }

  /** Reads the file's modification time and refreshes only when another session moved it. */
  async function refreshIfMoved(engine: Host) {
    const stamp = await stampOf(engine)
    if (stamp === fileStamp) return
    fileStamp = stamp
    scheduleRefresh(engine)
  }

  // ── Opening and closing ─────────────────────────────────────────────────

  async function openPane(engine: Host): Promise<void> {
    await engine.openPane({ id: Names.PANE_ID, title: Names.PANE_TITLE })
    isPaneOpen = true
    hasAutoOpened = true
    scheduleRefresh(engine)
  }

  async function closePane(engine: Host): Promise<void> {
    await engine.closePane({ id: Names.PANE_ID }).catch(() => undefined)
    isPaneOpen = false
  }

  /** Opens by itself the first time this copy holds something, unless it was closed. */
  async function openOnFirstHold(engine: Host): Promise<void> {
    if (isPaneOpen || hasAutoOpened) return

    const preference = await engine.storeGet(Names.STORE_OPEN_KEY).catch(() => undefined)
    if (preference === false) return

    const held = await heldNow(engine)
    if (!holdsSomething(held)) return

    await openPane(engine)
  }

  // ── The bind ────────────────────────────────────────────────────────────

  async function bind(engine: Host, cwd: string): Promise<void> {
    try {
      await engine.registerCommand({
        name: Names.COMMAND_NAME,
        description: Names.COMMAND_DESCRIPTION,
      })
    } catch (error) {
      engine.uiLog(
        `/${Names.COMMAND_NAME} is already taken, so the pane has no door: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )

      return
    }

    host = engine
    root = await workingCopyRootOf(cwd, path => engine.exists(path).catch(() => false))
    tools = await engine.toolList().catch((): ToolInfo[] => [])

    await refresh(engine)
    await openOnFirstHold(engine).catch(() => undefined)

    timers.get('poll')?.cancel()
    timers.set(
      'poll',
      engine.every(Names.FILE_POLL_MS, () => {
        if (!isPaneOpen || host === null) return
        void refreshIfMoved(host).catch(() => undefined)
      }),
    )
  }

  // ── The hooks ───────────────────────────────────────────────────────────

  on('session.start', async ($, e, next) => {
    if (e.surface === null || !e.isInteractive) return next(e)

    await bind(
      {
        now: () => $.clock.now(),
        after: (ms, fn) => $.clock.after(ms, fn),
        every: (ms, fn) => $.clock.every(ms, fn),
        exists: path => $.fs.exists(path),
        readFile: path => $.fs.read(path),
        stat: path => $.fs.stat(path),
        storeGet: key => $.store.get(key),
        storeSet: (key, value) => $.store.set(key, value),
        mcpCall: (server, tool, args) => $.mcp.call(server, tool, args),
        toolList: () => $.tool.list(),
        cwd: () => $.session.cwd(),
        invalidate: () => $.ui.invalidate('ui.render'),
        uiLog: text => $.ui.log(text),
        openPane: pane => $.ui.open(pane),
        closePane: pane => $.ui.close(pane),
        registerCommand: spec => $.command.register(spec),
      },
      e.cwd,
    ).catch(() => undefined)

    return next(e)
  })

  on('ui.render', { component: 'Pane' }, async ($, e, next) => {
    if (e.requestId !== Names.PANE_ID || host === null || !isOnPaneSurface(e)) return next(e)

    const { Box, Text, Button } = await $.ui.resolve(e)

    columns = e.viewport?.columns ?? columns
    isPaneOpen = true

    const view = { columns: e.props.bodyColumns, isLoading, expanded }
    const rows: Row[] =
      e.props.placement === 'dock' ? dockRows(model, view) : inlineRows(model, view)

    return paneView({ Box, Text, Button }, rows, press => onPress(press))
  })

  function onPress(press: Press) {
    if (host === null) return

    if (press.kind === 'refresh') {
      void forgetAndRefresh(host).catch(() => undefined)

      return
    }

    if (press.kind === 'sibling' && press.id !== undefined) {
      const key = String(press.id)
      expanded = { ...expanded, [key]: !expanded[key] }

      if (expanded[key]) void loadSiblingPhases(host, press.id).catch(() => undefined)
      redraw(host)
    }
  }

  /** A sibling's phases, read once and kept with the rest of the names. */
  async function loadSiblingPhases(engine: Host, id: number): Promise<void> {
    const tree = model.trees.find(candidate =>
      candidate.siblings.some((sibling: { id: number }) => sibling.id === id),
    )
    if (!tree) return

    const sibling = tree.siblings.find((candidate: { id: number }) => candidate.id === id)
    if (!sibling || Array.isArray(sibling.phases)) return

    const server = serverOf(null, tools) ?? serversOf(tools)[0]
    if (server === undefined || server === null) return

    const spec = await readerFor(engine).read(server, 'spec', id)
    sibling.phases = spec.phases
    redraw(engine)
  }

  /** Forgets every name this copy reads, then reads them again. */
  async function forgetAndRefresh(engine: Host): Promise<void> {
    const known = readerFor(engine)
    const keys: string[] = []

    for (const tree of model.trees) {
      const server = serverOf(null, tools) ?? serversOf(tools)[0]
      if (server === undefined || server === null) continue
      if (tree.spec) keys.push(known.cacheKeyOf(server, 'spec', tree.spec.id))
      if (tree.brief) {
        keys.push(known.cacheKeyOf(server, 'brief', tree.brief.id))
        keys.push(known.cacheKeyOf(server, 'briefSpecs', tree.brief.id))
      }
      for (const node of tree.chain) {
        keys.push(known.cacheKeyOf(server, 'chain', node.id))
        keys.push(known.cacheKeyOf(server, 'objective', node.id))
        keys.push(known.cacheKeyOf(server, 'children', node.id))
      }
    }

    await known.forget(keys)
    reader = null
    await refresh(engine)
  }

  on('ui.close', { id: Names.PANE_ID }, async ($, e, next) => {
    const result = await next(e)
    if (result.deny !== undefined) return result

    isPaneOpen = false

    if (e.origin.kind === 'person' && host !== null) {
      await host.storeSet(Names.STORE_OPEN_KEY, false).catch(() => undefined)
    }

    return result
  })

  on('command.run', { command: Names.COMMAND_NAME }, async ($, e, next) => {
    if (host === null) return next(e)

    columns = e.presentation.columns

    if (isPaneOpen) {
      await closePane(host)
      await host.storeSet(Names.STORE_OPEN_KEY, false).catch(() => undefined)

      return { text: Names.HIDDEN_TEXT }
    }

    if (e.presentation.isFullscreen && columns < Names.OPEN_MIN_COLUMNS) {
      return { text: Names.RESIZE_TEXT }
    }

    if (serversOf(tools).length === 0) {
      tools = await host.toolList().catch((): ToolInfo[] => [])
      if (serversOf(tools).length === 0) return { text: Names.NO_WORKSPACE_TEXT }
    }

    await openPane(host)
    await host.storeSet(Names.STORE_OPEN_KEY, true).catch(() => undefined)

    return { text: Names.SHOWN_TEXT }
  })

  on('command.run', { command: ['clear', 'resume'] }, async ($, e, next) => {
    const result = await next(e)

    if (host !== null) {
      if (isPaneOpen) await closePane(host)
      hasAutoOpened = false
      expanded = {}
      model = EMPTY_MODEL
      fileStamp = 0
    }

    return result
  })

  on('tool.call', async ($, e, next) => {
    try {
      return await next(e)
    } finally {
      if (host !== null && isWorkspaceWrite(String(e.tool))) {
        scheduleRefresh(host, Names.REFRESH_AFTER_WRITE_MS)
        void openOnFirstHold(host).catch(() => undefined)
      }
    }
  })

  on('turn.complete', ($, e, next) => {
    if (host !== null && isPaneOpen) void refreshIfMoved(host).catch(() => undefined)

    return next(e)
  })
}
