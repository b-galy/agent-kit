import { describe, expect, mock, test } from 'claude-code/testing'
import type { AgentInfo, TurnCompleteInput } from 'claude-code'

const MINUTE_MS = 60_000

const agentOf = (fields: Partial<AgentInfo> & Pick<AgentInfo, 'id'>): AgentInfo => ({
  description: fields.id,
  type: 'teammate',
  status: 'completed',
  ...fields,
})

const turnOf = (overrides: { turnId: string; agentId?: string }): TurnCompleteInput => ({
  answer: '',
  durationMs: 100,
  isAborted: false,
  reason: 'answer',
  ...overrides,
})

describe('register', () => {
  test('an agent idle past the threshold is named on the status line', async ($, on) => {
    const clock = mock.clock(on, { now: 0 })
    mock.store(on)

    let agents: AgentInfo[] = [agentOf({ id: 'a1', name: 'collision-73' })]
    on('agent.list', () => ({ value: agents }))
    on('session.id', () => ({ value: 'session-1' }))
    on('session.start', ($$, e) => ({ cwd: e.cwd }))
    on('turn.complete', ($$, e) => ({ text: e.answer }))
    on('command.register', ($$, e) => ({ value: { command: e.name } }))

    const statuses: (string | undefined)[] = []
    on('ui.status', ($$, e) => {
      statuses.push(e.text)
      return { value: undefined }
    })

    await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })

    // First sighting: idle since now, well under the threshold — nothing to show yet.
    await $.turn.complete(turnOf({ turnId: 't0' }))
    expect(statuses.at(-1)).toBeUndefined()

    // Twenty minutes on, past the default fifteen-minute threshold, with nothing else changed.
    await clock.advance(20 * MINUTE_MS)
    await $.turn.complete(turnOf({ turnId: 't1' }))

    expect(statuses.at(-1)).toContain('collision-73')
    expect(statuses.at(-1)).toContain('20m')
  })

  test('a subagent turn never triggers a check: the status line does not move', async ($, on) => {
    mock.clock(on, { now: 0 })
    mock.store(on)

    let listCalls = 0
    on('agent.list', () => {
      listCalls += 1
      return { value: [] }
    })
    on('session.id', () => ({ value: 'session-1' }))
    on('session.start', ($$, e) => ({ cwd: e.cwd }))
    on('turn.complete', ($$, e) => ({ text: e.answer }))
    on('command.register', ($$, e) => ({ value: { command: e.name } }))
    on('ui.status', () => ({ value: undefined }))

    await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
    await $.turn.complete(turnOf({ turnId: 't0' })) // main loop: one check
    await $.turn.complete(turnOf({ turnId: 't0-child', agentId: 'sub-1' })) // a spawned agent's own turn

    expect(listCalls).toBe(1)
  })

  test('a SendMessage this turn keeps the agent it reached off the status line', async ($, on) => {
    const clock = mock.clock(on, { now: 0 })
    mock.store(on)

    const agents: AgentInfo[] = [agentOf({ id: 'a1', name: 'collision-73' })]
    on('agent.list', () => ({ value: agents }))
    on('session.id', () => ({ value: 'session-1' }))
    on('session.start', ($$, e) => ({ cwd: e.cwd }))
    on('turn.complete', ($$, e) => ({ text: e.answer }))
    on('command.register', ($$, e) => ({ value: { command: e.name } }))
    on('tool.call', () => ({ result: {} }))

    const statuses: (string | undefined)[] = []
    on('ui.status', ($$, e) => {
      statuses.push(e.text)
      return { value: undefined }
    })

    await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
    await $.turn.complete(turnOf({ turnId: 't0' })) // seeds since = 0 for a1

    await clock.advance(45 * MINUTE_MS)

    // The pilot resumes the agent moments before the turn ends.
    await $.tool.call({ tool: 'SendMessage', to: 'collision-73', message: 'go on' })
    await $.turn.complete(turnOf({ turnId: 't1' }))

    expect(statuses.at(-1)).toBeUndefined()
  })

  test('/idle-agents prints the full list and the line ready to copy', async ($, on) => {
    const clock = mock.clock(on, { now: 0 })
    mock.store(on)

    const agents: AgentInfo[] = [agentOf({ id: 'a1', name: 'gel-source' })]
    on('agent.list', () => ({ value: agents }))
    on('session.id', () => ({ value: 'session-1' }))
    on('session.start', ($$, e) => ({ cwd: e.cwd }))
    on('turn.complete', ($$, e) => ({ text: e.answer }))
    on('command.register', ($$, e) => ({ value: { command: e.name } }))
    on('ui.status', () => ({ value: undefined }))

    await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
    await $.turn.complete(turnOf({ turnId: 't0' })) // seeds since = 0

    await clock.advance(42 * MINUTE_MS)

    const { text } = await $.command.run({
      command: 'idle-agents',
      args: '',
      origin: { kind: 'composer' },
      presentation: { isFullscreen: false, columns: 80 },
    })

    expect(text).toContain('gel-source')
    expect(text).toContain('42m')
    expect(text).toContain('Close gel-source')
  })
})
