#!/usr/bin/env node
// cs — Stop hook: a pull request that leaves no trace in the workspace is stopped once.
//
// WHAT THE KIT PROMISES, AND WHERE IT LEAKS. Every skill here ends in the same place: the work is
// framed in the workspace, coded in the repository, and recorded back. The recording is the half
// that has no mechanism. Nothing fails when it is skipped — the branch is pushed, the pull request
// is green, the reviewer approves — and what is lost only shows months later, on the day somebody
// asks why a line was changed and the only answer anyone can find is a commit message.
//
// A commit message is not a written cause. It says what was done, never what was wrong, never how
// it was measured, and it schedules no check. That is the whole difference between a repository
// that carries its history and a team that has to remember it.
//
// WHY A `Stop` HOOK AND NOT A LINE IN A SKILL. Because the skills already say it, and it is
// skipped anyway — a session that has just got a green pipeline is a session that considers itself
// finished. `Stop` is the only event that fires exactly there: after the work, before the turn
// closes, while the context that would fill a spec or a defect is still in hand.
//
// WHAT IT LOOKS AT. The transcript of the session, and nothing else — no network, no token. Two
// facts: a pull request was opened, and no write to the workspace happened. Reads do not count: a
// session that opened a spec to answer a question has recorded nothing.
//
// HOW IT AVOIDS BECOMING THE NAG THAT GETS SWITCHED OFF. It asks ONCE per session and then never
// again, so a piece of work that genuinely belongs nowhere costs one sentence. It can never hold a
// session shut: the stamp goes down before the refusal.
//
// stdin:  { session_id, transcript_path, hook_event_name: "Stop", ... }
// stdout: { hookSpecificOutput: { hookEventName: "Stop", permissionDecision: "deny", ... } }
// Silence — no output, exit 0 — in every other case.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

// Under `cs`, beside the stamp of the guard on CLAUDE.md files.
const STAMPS = join(homedir(), ".claude", "cs", "stamps");

// A pull request was opened from this session.
const OPENED_A_PULL_REQUEST = /\bgh\s+pr\s+create\b/;

// Something was WRITTEN to the workspace. The server's alias belongs to whoever registered it, so
// it is matched by shape; what is named exactly is the verb, because reading records nothing.
const WROTE_TO_THE_WORKSPACE =
  /mcp__[a-z0-9_]+__(feature_spec|feature_brief|bug|acceptance|followup|maturity|retro)_[a-z_]*(create|update|add|set|pick|complete|close|record|resolve|answer|claim|declare)/;

function quit() { process.exit(0); }

function readStdin() {
  try { return JSON.parse(readFileSync(0, "utf8") || "{}"); }
  catch { return {}; }
}

const payload = readStdin();
const session = String(payload.session_id || "").replace(/[^\w-]/g, "");
if (!session || !payload.transcript_path) { quit(); }

const stamp = join(STAMPS, `stop-${session}.json`);
if (existsSync(stamp)) { quit(); }

let transcript = "";
try { transcript = readFileSync(payload.transcript_path, "utf8"); }
catch { quit(); }   // no transcript, no evidence, no opinion

if (!OPENED_A_PULL_REQUEST.test(transcript)) { quit(); }
if (WROTE_TO_THE_WORKSPACE.test(transcript)) { quit(); }

// Down BEFORE the refusal: a session that judges this wrong must be able to stop by stopping again.
try {
  mkdirSync(STAMPS, { recursive: true });
  writeFileSync(stamp, JSON.stringify({ at: Date.now() }), "utf8");
} catch {
  quit();   // cannot promise to ask only once, so do not ask at all
}

process.stdout.write(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: "Stop",
    permissionDecision: "deny",
    permissionDecisionReason:
      "This session opened a pull request and wrote nothing to the workspace.\n\n"
      + "A change whose only trace is a commit message has no written cause: it says what was "
      + "done, never what was wrong or how it was measured, and it schedules no check. In six "
      + "months nobody can tell whether the fix held.\n\n"
      + "Record it where the work lives — the spec it delivers, the defect it closes, or the "
      + "follow-up check it earns — and say which pull request carries it. Then stop.\n\n"
      + "If it genuinely belongs nowhere, stop again: this is asked once per session and never "
      + "twice.",
  },
}));
