# idle-agents

Names the background agents and teammates that reported back and have sat idle since — in a quiet
status line at the end of each turn, and in full under `/idle-agents`.

## Why

A pilot running several agents in parallel often keeps a finished one open on purpose: `idle` means
"delivered its report, waiting for its next instruction," not "done." Reopening it with its context
intact is the whole point of a background agent. But nothing else ever says how long one has been
sitting there, so a two-hour-old tab looks exactly like a two-minute-old one until someone thinks to
check — and by the time someone does, there can be a dozen of them.

This plugin makes that cost visible, at the moment it costs nothing to act on, and nowhere else:

- **Nothing shows while everything is fresh.** A status line only appears once an agent has been
  idle past the threshold (fifteen minutes by default — long enough that a still-thinking agent is
  never named by mistake, short enough that a long session gets more than one reminder).
- **The agent just used is never named**, even if it was idle for an hour before. A `SendMessage`
  to it resets its clock, so reusing an agent never triggers a false reminder about the very agent
  about to be used.
- **The line is ready to copy**, naming every overdue agent, so closing them does not mean writing
  one instruction per agent by hand.
- **`/idle-agents`** prints the full list — every idle agent with its own duration — for whenever the
  status line falls back to a count because too many names would not fit on one line.

## What it does not do

It never closes an agent. The engine gives a plugin no such call: `$.agent` is `spawn`, `list` and
`register` — nothing that ends one. Only a person, by typing (or pasting) an instruction the model
acts on with its own `TaskStop`, actually closes one. This plugin's only job is to make sure that
instruction is easy to reach when it is worth reaching for.

## Setting the threshold

`idleThresholdMinutes` — `/config`, or `pluginConfigs["idle-agents"].options` in settings.json.
Default: 15.
