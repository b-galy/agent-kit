#!/usr/bin/env node
// cs — Stop hook: a merge that leaves the working copy on its branch is stopped once.
//
// WHERE A MERGE ACTUALLY ENDS. Not at the forge's green. A pull request merged from a working
// copy that stays on its branch leaves two things behind: a remote branch nobody will delete,
// and a copy that a pool of working copies can no longer hand to anyone — its branch is
// delivered, its files are clean, and every launcher reads it as work in progress. On
// 5 September 2026, twelve slots out of twenty sat like that, on work merged days before, for
// three live sessions. A pool of copies nobody gives back is a shared checkout with extra steps.
//
// WHY A `Stop` HOOK AND NOT A LINE IN A SKILL. The skills say it — the merge skill's own gesture
// carries the three lines — and it is skipped anyway, because the session that has just merged
// is a session that considers itself finished, and the copy has no visible outcome for anyone.
// `Stop` is the only event that fires exactly there: after the merge, before the turn closes,
// while the branch's name is still in hand.
//
// WHAT IT LOOKS AT. Two facts, no network, no token: the transcript says a pull request was
// merged from this session, and the working copy the session runs in still sits on a branch
// that is not the default one. A detached copy, or one on the default branch, is a copy given
// back — silence. It does not try to prove the branch is the merged one: squash merges make
// ancestry useless, and asking the forge costs what a hook may not spend.
//
// HOW IT AVOIDS BECOMING THE NAG THAT GETS SWITCHED OFF. It asks ONCE per session and then never
// again, so a session that merged somebody else's request from its own branch costs one
// sentence. It can never hold a session shut: the stamp goes down before the refusal.
//
// stdin:  { session_id, transcript_path, cwd, hook_event_name: "Stop", ... }
// stdout: { hookSpecificOutput: { hookEventName: "Stop", permissionDecision: "deny", ... } }
// Silence — no output, exit 0 — in every other case.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { execFileSync } from "node:child_process";

// Under `cs`, beside the stamps of the other hooks.
const STAMPS = join(homedir(), ".claude", "cs", "stamps");

// A pull request was merged from this session — the two forges the kit's skills name.
const MERGED_A_PULL_REQUEST = /\bgh\s+pr\s+merge\b|\bglab\s+mr\s+merge\b/;

function quit() { process.exit(0); }

function readStdin() {
  try { return JSON.parse(readFileSync(0, "utf8") || "{}"); }
  catch { return {}; }
}

function git(cwd, args) {
  try {
    return execFileSync("git", args, { cwd, encoding: "utf8", timeout: 2000, stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch { return ""; }
}

const payload = readStdin();
const session = String(payload.session_id || "").replace(/[^\w-]/g, "");
if (!session || !payload.transcript_path) { quit(); }

const stamp = join(STAMPS, `given-back-${session}.json`);
if (existsSync(stamp)) { quit(); }

let transcript = "";
try { transcript = readFileSync(payload.transcript_path, "utf8"); }
catch { quit(); }   // no transcript, no evidence, no opinion

if (!MERGED_A_PULL_REQUEST.test(transcript)) { quit(); }

const cwd = payload.cwd || process.cwd();
const branch = git(cwd, ["rev-parse", "--abbrev-ref", "HEAD"]);
if (!branch || branch === "HEAD") { quit(); }   // detached: given back, or not a repository

// The default branch as the remote declares it; `main` or `master` when nothing declares one.
const declared = git(cwd, ["symbolic-ref", "--short", "refs/remotes/origin/HEAD"]).replace(/^origin\//, "");
const defaults = declared ? [declared] : ["main", "master"];
if (defaults.includes(branch)) { quit(); }

// Down BEFORE the refusal: a session that judges this wrong must be able to stop by stopping again.
try {
  mkdirSync(STAMPS, { recursive: true });
  writeFileSync(stamp, JSON.stringify({ at: Date.now(), branch }), "utf8");
} catch {
  quit();   // cannot promise to ask only once, so do not ask at all
}

process.stdout.write(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: "Stop",
    permissionDecision: "deny",
    permissionDecisionReason:
      `This session merged a pull request, and its working copy still sits on the branch \`${branch}\`.\n\n`
      + "A merge is not over at the forge's green. It is over when the branch is gone — on the "
      + "remote and here — and the working copy is back on the default branch, so that whatever "
      + "hands out working copies can hand this one to the next piece of work. A copy left on a "
      + "delivered branch is one nobody reclaims.\n\n"
      + "Give it back: delete the remote branch, put the copy on the default branch (detached is "
      + "fine), delete the local branch. Then stop.\n\n"
      + "If this branch is not the one you merged, stop again: this is asked once per session and "
      + "never twice.",
  },
}));
