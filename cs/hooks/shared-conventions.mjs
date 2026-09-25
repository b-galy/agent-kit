#!/usr/bin/env node
// The kit's shared conventions, in EVERY session — not only the turns a skill closes.
//
// `instructions/shared-conventions.md` is the one source of what every project shares; every skill that hands
// back reads it. A turn that runs no skill read nothing: each host repository then carried its
// own copy of the rules in its CLAUDE.md, or a pointer the agent never followed, or nothing at
// all — three repositories of one team ended their turns three different ways, and a correction
// made in one reached neither of the others.
//
// So the plugin hands the rules to the session itself, at its start and again after a compaction,
// as context. It prints nothing to the person: this is not a session that speaks at its opening,
// it is the convention being in force before the first reply. The host's CLAUDE.md keeps at most a
// line saying where the convention lives.
//
// It never blocks a session: a missing or unreadable file injects nothing and exits 0.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const source = join(here, "..", "instructions", "shared-conventions.md");

try {
  const text = readFileSync(source, "utf8").replace(/\r\n/g, "\n");
  // From the first rule to the last shared section. "What the hand-back is not" is guidance
  // for the skills that already print a delivery report, not for every turn.
  const start = text.indexOf("## The two rules, verbatim");
  const end = text.indexOf("## What the hand-back is not");
  if (start >= 0) {
    const body = text.slice(start, end > start ? end : undefined).trim();
    const context = "The Castalie kit's shared conventions (instructions/shared-conventions.md), "
      + "in force in every session of every project that uses it, inside a skill or not:\n\n" + body;
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: context },
    }));
  }
} catch {
  // Nothing to inject; the session starts as it would have.
}
process.exit(0);
