#!/usr/bin/env node
// Castalie — PreToolUse hook: a substantial addition to a CLAUDE.md is shown before it is written.
//
// WHY THIS IS A HOOK AND NOT A LINE IN A SKILL. The discipline already existed, written down
// and well written, in `skills/analyse`: present the edit, keep the diff minimal, announce the
// word delta, wait for the go. It fires only when someone types `/cs:analyse`. The request
// that produces the damage never arrives that way — it arrives as "note this in claude.md",
// in plain prose, down the one path that has no guard at all. A rule that lives in a skill
// nobody invoked is a rule that does not exist.
//
// WHAT IT PROTECTS. A CLAUDE.md is loaded in full into every session, forever. A hundred words
// added today is a hundred words every future session pays for, and the cost is invisible at
// the moment of writing — which is exactly why an assistant will happily write four hundred of
// them in one go, matching the dense style of the sections around it. Nothing verifies prose:
// no test goes red, no build breaks. The only reader who can judge it is the person whose
// doctrine it is.
//
// HOW IT AVOIDS BECOMING THE NAG THAT GETS SWITCHED OFF. Three ways:
//
//   1. It is silent on every file that is not a CLAUDE.md, and silent on small edits — fixing a
//      word, a path, a stale sentence goes straight through. Only an addition big enough to be
//      a new RULE stops.
//   2. It refuses a given text ONCE. The refusal is stamped by content hash; the same text
//      offered again passes. So the sequence is: first attempt refused with an explanation →
//      the assistant shows the text and its word delta → the person says go → the second
//      attempt writes. It can never block twice on the same words, and it cannot deadlock.
//   3. It never blocks a deletion or a rewrite that shortens. Cutting a CLAUDE.md is the one
//      move nobody needs to be talked out of.
//
// stdin:  { tool_name, tool_input: { file_path, ... }, ... }
// stdout: { hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision, ... } }
// Silence — no output, exit 0 — whenever the answer is "nothing to say here".

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { basename, join } from "node:path";
import { homedir } from "node:os";
import { createHash } from "node:crypto";

// Below this many added words, an edit is a correction and goes through untouched. Above it,
// the edit is long enough to be a rule someone will read in every session from now on.
const WORDS_THAT_DESERVE_A_LOOK = 40;

// A refusal is remembered for long enough to cover the round trip through the person, and no
// longer: a stamp that outlived the conversation would let an unrelated edit through tomorrow.
const STAMP_TTL_MS = 6 * 60 * 60 * 1000;

// Under `cs`, the kit's one name on the agent side. It was `galy/stamps`, then `bg/stamps`, under
// the names that came before; a stamp lives six hours at most, so the ones left there cost one
// extra refusal, once.
const STAMPS = join(homedir(), ".claude", "cs", "stamps");

function quit() { process.exit(0); }

function readStdin() {
  try { return JSON.parse(readFileSync(0, "utf8") || "{}"); }
  catch { return {}; }
}

const words = (text) => (String(text || "").match(/\S+/g) || []).length;

/**
 * How many words this call ADDS to the file — negative when it shortens it.
 * Returns null for a tool shape we do not recognise: an unknown shape is not a reason to
 * block someone, and guessing at it is how a guard starts refusing the wrong things.
 */
function wordsAdded(toolName, input) {
  if (toolName === "Edit") {
    return words(input.new_string) - words(input.old_string);
  }

  if (toolName === "MultiEdit" && Array.isArray(input.edits)) {
    return input.edits.reduce((n, e) => n + words(e.new_string) - words(e.old_string), 0);
  }

  if (toolName === "Write") {
    let before = 0;
    try { before = words(readFileSync(input.file_path, "utf8")); } catch { /* new file */ }
    return words(input.content) - before;
  }

  return null;
}

/** True the first time this exact text is offered for this file, false on every retry. */
function firstAttempt(fingerprint) {
  const path = join(STAMPS, `claude-md-${fingerprint}.json`);

  if (existsSync(path)) {
    try {
      const seen = JSON.parse(readFileSync(path, "utf8"));
      if (Date.now() - seen.at < STAMP_TTL_MS) { return false; }
    } catch { /* an unreadable stamp is a stamp we do not have */ }
  }

  try {
    mkdirSync(STAMPS, { recursive: true });
    writeFileSync(path, JSON.stringify({ at: Date.now() }), "utf8");
  } catch {
    // Cannot stamp — so we cannot promise to let the retry through, and a guard that might
    // block twice is worse than no guard. Stay out of the way.
    return false;
  }

  return true;
}

const payload = readStdin();
const input = payload.tool_input || {};
const filePath = input.file_path || input.path || "";

if (!filePath || basename(filePath).toUpperCase() !== "CLAUDE.MD") { quit(); }

const added = wordsAdded(payload.tool_name, input);
if (added === null || added < WORDS_THAT_DESERVE_A_LOOK) { quit(); }

const fingerprint = createHash("sha256")
  .update(`${filePath}\0${JSON.stringify(input)}`)
  .digest("hex")
  .slice(0, 16);

if (!firstAttempt(fingerprint)) { quit(); }

process.stdout.write(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    permissionDecision: "deny",
    permissionDecisionReason:
      `This adds ~${added} words to ${basename(filePath)}, which every session loads in full, `
      + "forever. Nothing verifies prose — no test, no build — so the only reader who can judge "
      + "it is the person whose doctrine it is.\n\n"
      + "Before writing it, do three things:\n"
      + "1. Check whether a rule that covers this already exists. If one does and did not fire, "
      + "fix THAT rule — a second rule saying the same thing is how a CLAUDE.md becomes unread.\n"
      + "2. Draft it long, then cut to the shortest form that keeps the behaviour. Prefer "
      + "swapping three words over adding a paragraph.\n"
      + "3. Show the person the exact text and its word count, and end your turn there.\n\n"
      + "Offer the same text again once they have said go, and this guard will let it through — "
      + "it refuses a given wording once and never twice.",
  },
}));
process.exit(0);
