import { describe, expect, test } from 'claude-code/testing'
import type { AgentInfo } from 'claude-code'

import { detailOf, formatDuration, reconcileIdleAgents, statusOf } from './idle'

const NONE = new Set<string>()

const agentOf = (fields: Partial<AgentInfo> & Pick<AgentInfo, 'id'>): AgentInfo => ({
  description: fields.id,
  type: 'teammate',
  status: 'completed',
  ...fields,
})

describe('reconcileIdleAgents', () => {
  test('a freshly-idle named agent starts its clock at now, not before', () => {
    const agents = [agentOf({ id: 'a1', name: 'collision-73' })]

    const { since, idle } = reconcileIdleAgents(agents, 10_000, {}, NONE)

    expect(since).toEqual({ a1: 10_000 })
    expect(idle).toEqual([{ id: 'a1', name: 'collision-73', description: 'a1', idleMs: 0 }])
  })

  test('an agent already tracked keeps its old since across turns', () => {
    const agents = [agentOf({ id: 'a1', name: 'collision-73' })]
    const previous = { a1: 0 }

    const { since, idle } = reconcileIdleAgents(agents, 42 * 60_000, previous, NONE)

    expect(since).toEqual({ a1: 0 })
    expect(idle[0]?.idleMs).toBe(42 * 60_000)
  })

  test('a running agent is never tracked, even if it was idle a moment ago', () => {
    const agents = [agentOf({ id: 'a1', name: 'collision-73', status: 'running' })]
    const previous = { a1: 0 }

    const { since, idle } = reconcileIdleAgents(agents, 10_000, previous, NONE)

    expect(since).toEqual({})
    expect(idle).toEqual([])
  })

  test('a killed agent is already gone: nothing left to close, nothing left to name', () => {
    const agents = [agentOf({ id: 'a1', name: 'collision-73', status: 'killed' })]

    const { since, idle } = reconcileIdleAgents(agents, 10_000, { a1: 0 }, NONE)

    expect(since).toEqual({})
    expect(idle).toEqual([])
  })

  test('an unnamed agent is a synchronous subagent: it never sits idle, so it is never tracked', () => {
    const agents = [agentOf({ id: 'a1', name: undefined, status: 'completed' })]

    const { since, idle } = reconcileIdleAgents(agents, 10_000, {}, NONE)

    expect(since).toEqual({})
    expect(idle).toEqual([])
  })

  test('an agent no longer listed is dropped from the state, not kept as a ghost', () => {
    const previous = { a1: 0, gone: 5_000 }

    const { since } = reconcileIdleAgents([agentOf({ id: 'a1', name: 'collision-73' })], 10_000, previous, NONE)

    expect(since).toEqual({ a1: 0 })
  })

  test('a SendMessage this turn resets the clock, even for an agent tracked long before', () => {
    const agents = [agentOf({ id: 'a1', name: 'collision-73' })]
    const previous = { a1: 0 }
    const touchedByName = new Set(['collision-73'])

    const { idle } = reconcileIdleAgents(agents, 45 * 60_000, previous, touchedByName)

    expect(idle[0]?.idleMs).toBe(0)
  })

  test('a touch by id resets the clock exactly as a touch by name does', () => {
    const agents = [agentOf({ id: 'a1', name: 'collision-73' })]
    const previous = { a1: 0 }

    const { idle } = reconcileIdleAgents(agents, 45 * 60_000, previous, new Set(['a1']))

    expect(idle[0]?.idleMs).toBe(0)
  })

  test('idle agents come out oldest first', () => {
    const agents = [agentOf({ id: 'young', name: 'lot-export' }), agentOf({ id: 'old', name: 'gel-source' })]
    const previous = { young: 9_000, old: 0 }

    const { idle } = reconcileIdleAgents(agents, 10_000, previous, NONE)

    expect(idle.map(agent => agent.id)).toEqual(['old', 'young'])
  })
})

describe('formatDuration', () => {
  test('under an hour is minutes alone', () => {
    expect(formatDuration(42 * 60_000)).toBe('42m')
  })

  test('a whole number of hours carries no trailing zero', () => {
    expect(formatDuration(2 * 60 * 60_000)).toBe('2h')
  })

  test('hours and minutes both show when neither is zero', () => {
    expect(formatDuration(72 * 60_000)).toBe('1h12m')
  })
})

describe('statusOf', () => {
  const THRESHOLD_MS = 15 * 60_000

  test('nothing past the threshold shows nothing at all', () => {
    const idle = [{ id: 'a1', name: 'lot-export', description: '', idleMs: 5 * 60_000 }]

    expect(statusOf(idle, THRESHOLD_MS, 150)).toBeUndefined()
  })

  test('the freshly-idle agent from the current turn (idleMs 0) never appears', () => {
    const idle = [{ id: 'a1', name: 'collision-73', description: '', idleMs: 0 }]

    expect(statusOf(idle, THRESHOLD_MS, 150)).toBeUndefined()
  })

  test('one overdue agent is named with the line ready to copy', () => {
    const idle = [{ id: 'a1', name: 'gel-source', description: '', idleMs: 42 * 60_000 }]

    const status = statusOf(idle, THRESHOLD_MS, 150)

    expect(status).toContain('gel-source')
    expect(status).toContain('42m')
    expect(status).toContain('Close gel-source, it\'s done.')
  })

  test('several names join, with plural wording', () => {
    const idle = [
      { id: 'a1', name: 'gel-source', description: '', idleMs: 42 * 60_000 },
      { id: 'a2', name: 'collision-73', description: '', idleMs: 20 * 60_000 },
    ]

    const status = statusOf(idle, THRESHOLD_MS, 150)

    expect(status).toContain('2 agents idle')
    expect(status).toContain('gel-source, collision-73')
    expect(status).toContain('they\'re done.')
  })

  test('past the character budget, names give way to a count and a pointer', () => {
    const idle = Array.from({ length: 12 }, (_, index) => ({
      id: `a${index}`,
      name: `some-quite-long-agent-name-${index}`,
      description: '',
      idleMs: (30 - index) * 60_000,
    }))

    const status = statusOf(idle, THRESHOLD_MS, 60)

    expect(status?.length).toBeLessThanOrEqual(60)
    expect(status).toContain('12 agents idle')
    expect(status).toContain('/idle-agents')
  })
})

describe('detailOf', () => {
  const THRESHOLD_MS = 15 * 60_000

  test('nothing idle says so plainly', () => {
    expect(detailOf([], THRESHOLD_MS)).toBe('No agent is sitting idle in this session right now.')
  })

  test('every idle agent gets its own row, overdue or not', () => {
    const idle = [
      { id: 'a1', name: 'gel-source', description: '', idleMs: 42 * 60_000 },
      { id: 'a2', name: 'lot-export', description: '', idleMs: 2 * 60_000 },
    ]

    const detail = detailOf(idle, THRESHOLD_MS)

    expect(detail).toContain('gel-source')
    expect(detail).toContain('42m')
    expect(detail).toContain('lot-export')
    expect(detail).toContain('2m')
  })

  test('under the threshold across the board, the closing line says so instead of naming nobody', () => {
    const idle = [{ id: 'a1', name: 'lot-export', description: '', idleMs: 2 * 60_000 }]

    expect(detailOf(idle, THRESHOLD_MS)).toContain('None of them has sat idle past the threshold yet.')
  })
})
