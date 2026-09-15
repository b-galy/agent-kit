#!/usr/bin/env node
// bg-work — records, beside the code, what THIS working copy has in hand.
//
// The row under the prompt names the specs and briefs of one working copy. Nothing in a
// repository says which those are, and asking the workspace cannot answer it: two
// worktrees of the same repository share an account, a token and a queue, and differ
// only in what each is doing. So the answer is written where the difference lives —
// in the copy's own `.bg/work.json`, kept out of git, one file per copy.
//
// What it watches is the writes. A copy HOLDS a spec when it claims or creates one, and
// a brief when it writes into one; it LETS GO of a spec when it completes it. Reading
// marks nothing: a session that opens spec 9 to answer a question is not working on it,
// and a row that said otherwise would be back to naming things nobody asked about.
//
// And what a copy has in hand belongs to the SESSION that took it up. Every entry carries the
// `session_id` of the write that made it, and a session that starts keeps the entries that
// carry its own id and drops the rest. So the same conversation reopened — `claude --resume`,
// `/resume`, a compaction — finds its work again, because the id has not changed; a new
// conversation on the same copy starts empty, because none of the entries is its own; and a
// row still naming yesterday's spec is never read as today's, which is the one mistake this
// file exists to prevent. `/clear` empties everything: same id, new subject.
//
// The end of a session drops nothing. It used to empty the file, blind to who had filled it,
// and a relaunch on the same conversation lost its work twice over: the old process, dying,
// wiped what the resumed one had just written (claim at 15:27:23, wiped at 15:27:58), and a
// resumed conversation that outlived its process found nothing. The horizon the row applies
// stays the backstop for work put down and never picked up again.
//
// It runs after every call to the workspace and must never make one fail: it writes a
// small file, says nothing, and exits 0 whatever happens.

import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";

const HELD_AT_MOST = 8;                                    // the row has a budget, and shows "+n"
const CACHE_DIR = join(tmpdir(), "bg-statusline");

// `id` does not mean the same thing twice. On `feature_spec_pick` it is the spec; on
// `feature_spec_set_phase_status` it is the PHASE, on `feature_spec_update_risk` the
// risk, on `feature_spec_update_acceptance_test` the test. So every tool is named with
// the field to read: a rule guessed from the shape of the name would file a phase id as
// a spec, and put a stranger's title on the row of someone who never opened it.
//
// Two workspaces speak the same tools and spell the field differently — `id` on one,
// `specId` on the other — so each rule names every spelling of the field it reads, and
// never one that means something else: `featureBriefId` on `feature_spec_update` moves
// the spec under another brief, it does not name the spec.
const SPEC = ["id", "specId", "spec_id", "feature_spec_id", "featureSpecId"];
const BRIEF = ["id", "briefId", "brief_id", "feature_brief_id", "featureBriefId"];
const CLAIMS = {
  feature_spec_pick:                { of: "specs",  read: SPEC },
  feature_spec_update:              { of: "specs",  read: SPEC },
  feature_spec_create:              { of: "specs",  read: "@answer" },
  feature_spec_add_phase:           { of: "specs",  read: SPEC },
  feature_spec_add_risk:            { of: "specs",  read: SPEC },
  feature_spec_add_acceptance_test: { of: "specs",  read: SPEC },
  feature_spec_add_sql_script:      { of: "specs",  read: SPEC },
  feature_brief_create:             { of: "briefs", read: "@answer" },
  feature_brief_update:             { of: "briefs", read: BRIEF },
  feature_brief_add_user_story:     { of: "briefs", read: BRIEF },
};
const RELEASES = {
  feature_spec_complete:            { of: "specs",  read: SPEC },
};
// What a creation answers with, in the spellings the workspaces use.
const CREATED = ["feature_spec_id", "spec_id", "feature_brief_id", "brief_id", "id", "SpecId", "BriefId", "Id"];

// An answer reaches a hook as the content envelope, as a string, or already parsed,
// depending on the harness. All three are read; none of them is required.
function answer(response) {
  let body = response;
  if (body?.content?.[0]?.text !== undefined) body = body.content[0].text;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { return {}; } }
  return body && typeof body === "object" ? body : {};
}

function workingCopyRoot(from) {
  let dir = resolve(from);
  for (;;) {
    if (existsSync(join(dir, ".git"))) return dir;   // a FILE here — a worktree — counts as much as a folder
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function first(record, names) {
  return names.map((name) => record?.[name]).find((value) => value !== undefined && value !== null);
}

// The server the harness routed the call through, read where the harness writes it: the
// tool's own name, `mcp__<server>__<verb>`. A call made outside MCP names no server.
function serverOf(toolName) {
  return /^mcp__(.+?)__[a-z][a-z0-9_]*$/.exec(String(toolName || ""))?.[1] || null;
}

// The file is this copy's and nobody else's: it must never show up as something to commit.
// The kit does not edit the repository's `.gitignore` — that file is the team's — so the
// exclusion goes into the repository's own private list, which git reads and never ships.
function keepOutOfGit(root, file) {
  try {
    const git = (...args) => execFileSync("git", ["-C", root, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 3000, windowsHide: true }).trim();
    try { git("check-ignore", "-q", file); return; } catch { /* not ignored yet */ }
    const exclude = resolve(root, git("rev-parse", "--git-path", "info/exclude"));
    mkdirSync(dirname(exclude), { recursive: true });
    const lines = existsSync(exclude) ? readFileSync(exclude, "utf8") : "";
    if (!/^\.bg\/work\.json$/m.test(lines)) {
      appendFileSync(exclude, (lines && !lines.endsWith("\n") ? "\n" : "") + ".bg/work.json\n", "utf8");
    }
  } catch { /* outside a repository, or no git on the path: the file stays, unlisted */ }
}

// The session an event belongs to, as the harness names it. The same id is carried by every
// event of one conversation — its tool calls, its subagents' tool calls, its start after a
// `--resume` or a compaction — and by nothing else.
function sessionOf(event) {
  return String(event.session_id || "");
}

// A session starts, and the file is sorted by who wrote it: the entries carrying this
// session's id stay, the others go. Sorted, never removed — a row drawn elsewhere is redrawn
// because this file has become newer than the cache holding it, and a file that is gone never
// becomes newer than anything.
//
// The id decides, never the reason for the start. A `--resume` reports `resume` on one
// version and `startup` on another, and both carry the resumed id; a compaction carries the
// same id as before; a new conversation carries a fresh one, and a fork of an old one a fresh
// one too, so both open on nothing. `/clear` is the one reason read: same id, new subject,
// nothing kept. An entry with no session at all was written before the field existed and is
// dropped: nobody can say whose it is.
function keepThisSessionsOnly(event) {
  const root = workingCopyRoot(event.cwd || process.cwd());
  if (!root) return;
  const file = join(root, ".bg", "work.json");
  if (!existsSync(file)) return;                    // a copy that claimed nothing has nothing to sort
  const before = readFileSync(file, "utf8");
  let held = {};
  try { held = JSON.parse(before); } catch { held = {}; }
  if (!held || typeof held !== "object") held = {};

  const session = sessionOf(event);
  const own = (entries) => (event.source === "clear" || !session ? [] : (Array.isArray(entries) ? entries : []))
    .filter((entry) => entry && typeof entry === "object" && entry.session === session);
  const next = { ...held, specs: own(held.specs), briefs: own(held.briefs) };

  const text = JSON.stringify(next, null, 2) + "\n";
  if (text === before) return;                      // nothing to drop: the file stays as old as it was
  writeFileSync(file, text, "utf8");
  keepOutOfGit(root, file);
}

function main(event) {
  if (event.hook_event_name === "SessionStart") return keepThisSessionsOnly(event);
  // A session that ends leaves the file as it is: what it wrote is its own, and its own
  // resumed conversation is the one reader entitled to find it there.
  if (event.hook_event_name === "SessionEnd") return;

  const called = String(event.tool_name || "");
  const names = { ...CLAIMS, ...RELEASES };
  // The server is registered under an alias the user chose, so the prefix is not known
  // here — only the verb at the end of it is.
  const verb = Object.keys(names).find((name) => called === name || called.endsWith(`__${name}`));
  if (!verb) return;

  const body = answer(event.tool_response);
  if (body.success === false || event.tool_response?.isError) return;   // a refused write holds nothing

  const rule = names[verb];
  const raw = rule.read === "@answer" ? first(body, CREATED) : first(event.tool_input, rule.read);
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) return;

  const root = workingCopyRoot(event.cwd || process.cwd());
  if (!root) return;

  const file = join(root, ".bg", "work.json");
  let held = {};
  try { held = JSON.parse(readFileSync(file, "utf8")); } catch { /* the first claim writes the first file */ }
  const kept = (Array.isArray(held?.[rule.of]) ? held[rule.of] : [])
    .filter((entry) => Number.isInteger(entry?.id) && entry.id !== id);
  // Which workspace this claim went through, so a reader can ask the right one back. A
  // workstation may hold copies of two repositories answering on two servers, and an id
  // means nothing without the server that issued it. Entries written before this field
  // existed have no `server` and stay exactly as readable: the reader falls back on the
  // only server that serves the contract.
  //
  // And which session took it up, so the next start can tell its own work from a
  // stranger's. The readers ignore the field: the file is sorted at start, and what is in
  // it when they read is this session's.
  const session = sessionOf(event);
  const claim = {
    id,
    at: new Date().toISOString(),
    ...(serverOf(called) ? { server: serverOf(called) } : {}),
    ...(session ? { session } : {}),
  };
  const next = RELEASES[verb] ? kept : [claim, ...kept];

  held = { ...(held && typeof held === "object" ? held : {}), [rule.of]: next.slice(0, HELD_AT_MOST) };
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(held, null, 2) + "\n", "utf8");
  keepOutOfGit(root, file);

  // The row may now have to name something the cache has never heard of — a spec created
  // a second ago. Dropping the stamps makes the next render fetch the names instead of
  // falling back on `#42` for the three minutes the cache had left.
  try {
    for (const name of readdirSync(CACHE_DIR)) {
      if (name.endsWith(".stamp")) { try { unlinkSync(join(CACHE_DIR, name)); } catch { /* already due */ } }
    }
  } catch { /* no cache yet */ }
}

let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => { input += chunk; });
process.stdin.on("error", () => process.exit(0));
process.stdin.on("end", () => {
  try { main(JSON.parse(input)); } catch { /* a hook on the write path never breaks the write */ }
  process.exit(0);
});
