#!/usr/bin/env node
// check-cli — the kit's CLI is reachable, tells the truth when it fails, and finds the
// workspace every way the status line does.
//
// Three measured defects are replayed here, and each one is the kind that goes unnoticed
// because nothing about it is loud:
//
//   THE COMMAND WAS NOT A COMMAND. `<plugin>/bin` is on PATH and held one file, `bg.mjs`,
//   which is a command nowhere: PowerShell resolved nothing, and under bash `bg` is the job-
//   control BUILTIN — resolved before PATH, by every shell that has one. `bg search x`
//   therefore answered `bg: no job control` and never entered the CLI, and the status the
//   caller read was the builtin's. On some shells that status is 0, so a script testing the
//   exit code was told a push had succeeded. The fix a shell cannot undo is the name, so the
//   name is what this asserts — including, deliberately, that `bg` IS still a builtin: the
//   reason for the rename is a fact about the shell, and a fact belongs in a test rather than
//   in anybody's memory.
//
//   THE TWO READERS OF ONE FILE DISAGREED. `.bg/config.json` has four shapes in the wild and
//   the CLI read one of them, so `bgaly search` answered `No endpoint` on a working copy
//   whose status line was naming the workspace at that very second. Both readers are replayed
//   here on the same fixtures, so the next person to add a shape to one is told about the other.
//
//   A REFUSAL THAT ROUTED NOBODY. The content buffer serves two types, which is exactly what
//   the REST surface routes — but asking it for an objective printed a usage line, leaving the
//   caller to guess whether the text was missing or simply lives somewhere else. It lives
//   somewhere else, and the refusal now says where.
//
//   node scripts/check-cli.mjs
//
// It speaks to no network beyond 127.0.0.1: the workspace is a throwaway HTTP server in this
// process, and every copy lives in a scratch folder with HOME pointed at it, so no developer's
// own config, token or status line is ever read or touched.

import { execFile, execFileSync, spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BIN = join(ROOT, "galy", "bin");
const CLI = join(BIN, "bg.mjs");
const SHIM = join(BIN, "bgaly");
const SHIM_CMD = join(BIN, "bgaly.cmd");

const BENCH = mkdtempSync(join(tmpdir(), "bg-cli-check-"));
const CONFIG_DIR = join(BENCH, "config");
mkdirSync(CONFIG_DIR, { recursive: true });

let failures = 0;
function check(what, condition, detail) {
  if (condition) { console.log(`  [PASS] ${what}`); return; }
  failures++;
  console.log(`  [FAIL] ${what}${detail ? ` — ${detail}` : ""}`);
}

// A copy of the product's own environment minus everything personal: no inherited token, no
// inherited endpoint, HOME and the harness's config directory both inside the bench.
function env(extra = {}) {
  const base = { ...process.env, HOME: BENCH, USERPROFILE: BENCH, CLAUDE_CONFIG_DIR: CONFIG_DIR };
  delete base.GALY_ENDPOINT;
  delete base.GALY_TOKEN;
  return { ...base, ...extra };
}

// ASYNCHRONOUS ON PURPOSE. The workspace these calls speak to is an HTTP server in THIS
// process, and a synchronous spawn blocks the event loop that would have answered it — the
// run deadlocks, looking for all the world like a CLI that hangs. Every call that may reach
// the bench server is awaited; only the shell probes below, which reach nothing, stay
// synchronous.
function run(args, { cwd = BENCH, extraEnv = {} } = {}) {
  return new Promise((resolve) => {
    execFile(process.execPath, [CLI, ...args], { cwd, env: env(extraEnv), encoding: "utf8" },
      (error, stdout, stderr) => resolve({
        code: error ? (typeof error.code === "number" ? error.code : 1) : 0,
        text: `${stdout || ""}${stderr || ""}`,
      }));
  });
}

function dir(...parts) {
  const path = join(BENCH, ...parts);
  mkdirSync(path, { recursive: true });
  return path;
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2), "utf8");
}

// ── The workspace every shape below points at ──────────────────────────────
// It records what reached it, so a shape is proven by the request that arrived rather than by
// the CLI agreeing with itself about what it resolved.
const seen = [];
const server = createServer((req, res) => {
  seen.push({ url: req.url, auth: req.headers.authorization || null });
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ briefs: [], specs: [] }));
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const PORT = server.address().port;
const BASE = `http://127.0.0.1:${PORT}`;

async function reached(where, { extraEnv = {} } = {}) {
  seen.length = 0;
  const { code, text } = await run(["search", "ping"], { cwd: where, extraEnv });
  return { ok: code === 0 && seen.length === 1 && seen[0].url === "/api/pm/search?q=ping", code, text, request: seen[0] };
}

// ─────────────────────────────────────────────────── (d) the command is a command
console.log("\nThe command is reachable, and says so with its exit code:");

// Read rather than stat, and never throw: a missing shim IS the defect, and a check that
// crashes on it reports one failure instead of all of them.
const slurp = (path) => { try { return readFileSync(path, "utf8"); } catch { return null; } };

const shimText = slurp(SHIM);
check("the POSIX shim ships", shimText !== null, `nothing at ${SHIM}`);
check("the Windows shim ships", slurp(SHIM_CMD) !== null, `nothing at ${SHIM_CMD}`);
check("the POSIX shim keeps LF endings", shimText !== null && !shimText.slice(0, 200).includes("\r"),
  "a CRLF shebang is read as part of the interpreter's name: `/bin/sh^M: bad interpreter`");

try {
  const mode = execFileSync("git", ["ls-files", "-s", "galy/bin/bgaly"], { cwd: ROOT, encoding: "utf8" }).trim().split(/\s+/)[0];
  check("the POSIX shim is executable in the index", mode === "100755", `git records mode ${mode || "(nothing)"}`);
} catch {
  console.log("  [SKIP] the POSIX shim's index mode — git did not answer here");
}

// PATH resolution, through a real shell, because that is where the defect lived.
const shellPath = (p) => (process.platform === "win32"
  ? p.replace(/^([A-Za-z]):/, (_, d) => `/${d.toLowerCase()}`).replace(/\\/g, "/")
  : p);

const bash = spawnSync("bash", ["-c", "command -v bash >/dev/null && echo yes"], { encoding: "utf8" });
if (bash.status !== 0) {
  console.log("  [SKIP] shell resolution — no bash on this machine");
} else {
  const inShell = (script) => spawnSync("bash", ["-c", script], {
    cwd: BENCH,
    env: env({ PATH: `${shellPath(BIN)}:${process.env.PATH}` }),
    encoding: "utf8",
  });

  const kindOfBgaly = inShell("type -t bgaly").stdout.trim();
  check("`bgaly` resolves to a file on PATH, not to a builtin", kindOfBgaly === "file",
    `the shell calls it a ${kindOfBgaly || "nothing"}`);

  const kindOfBg = inShell("type -t bg").stdout.trim();
  check("`bg` is still the shell's builtin — the reason the file is not called that", kindOfBg === "builtin",
    `the shell calls it a ${kindOfBg || "nothing"}`);

  // THE ASSERTION THIS WHOLE FILE EXISTS FOR. A failed call must fail, and must have been ours.
  const failed = inShell("bgaly search ping");
  const said = `${failed.stdout || ""}${failed.stderr || ""}`;
  check("a call with no workspace anywhere exits non-zero", failed.status !== 0,
    `exit code ${failed.status}`);
  check("and the message comes from the CLI itself", said.includes("bgaly:"),
    `the shell said: ${said.trim().split("\n")[0] || "(nothing)"}`);

  // The control. It holds before and after the rename, and naming it here is what keeps the
  // reason for the rename from being re-litigated by somebody who did not measure it.
  const shadowed = inShell("bg search ping");
  const shadowedSaid = `${shadowed.stdout || ""}${shadowed.stderr || ""}`;
  check("`bg` never reaches the CLI, whatever is on PATH", !shadowedSaid.includes("bgaly:"),
    `it answered: ${shadowedSaid.trim().split("\n")[0] || "(nothing)"}`);
}

// ────────────────────────────────── (c) every shape the status line reads
console.log("\nThe workspace is found every way the status line finds it:");

{
  const copy = dir("shape-endpoint", "repo");
  writeJson(join(BENCH, "shape-endpoint", ".bg", "config.json"), { endpoint: BASE, token: "tok-endpoint" });
  const got = await reached(copy);
  check("`.bg/config.json` { endpoint, token }, found by climbing out of the copy",
    got.ok && got.request?.auth === "Bearer tok-endpoint", got.text.trim() || `auth was ${got.request?.auth}`);
}

{
  const copy = dir("shape-former", "repo");
  writeJson(join(BENCH, "shape-former", ".galy", "config.json"), { endpoint: BASE, token: "tok-former" });
  const got = await reached(copy);
  check("`.galy/config.json`, the folder's name before the rename, still answers",
    got.ok && got.request?.auth === "Bearer tok-former", got.text.trim() || `auth was ${got.request?.auth}`);
}

{
  const copy = dir("shape-mcp");
  writeJson(join(copy, ".bg", "config.json"), { mcp: "bg", links: { spec: "/s/{id}" } });
  writeJson(join(copy, ".mcp.json"), { mcpServers: { bg: { url: `${BASE}/mcp`, headers: { Authorization: "Bearer tok-mcp" } } } });
  const got = await reached(copy);
  check("`.bg/config.json` { mcp } resolved against the nearest `.mcp.json`",
    got.ok && got.request?.auth === "Bearer tok-mcp", got.text.trim() || `auth was ${got.request?.auth}`);
}

{
  const copy = dir("shape-mcp-env");
  writeJson(join(copy, ".bg", "config.json"), { mcp: "bg" });
  writeJson(join(copy, ".mcp.json"), { mcpServers: { bg: { url: `${BASE}/mcp`, headers: { Authorization: "Bearer ${CHECK_CLI_TOKEN}" } } } });
  const got = await reached(copy, { extraEnv: { CHECK_CLI_TOKEN: "tok-expanded" } });
  check("a `${VAR}` header in `.mcp.json` is expanded, as the harness expands it",
    got.ok && got.request?.auth === "Bearer tok-expanded", got.text.trim() || `auth was ${got.request?.auth}`);
}

{
  const copy = dir("shape-harness");
  writeJson(join(CONFIG_DIR, ".claude.json"), {
    projects: {
      [copy.replace(/\\/g, "/")]: { mcpServers: { bg: { url: `${BASE}/mcp`, headers: { Authorization: "Bearer tok-harness" } } } },
    },
  });
  const got = await reached(copy);
  check("the MCP server the harness registered, for a copy connected through it alone",
    got.ok && got.request?.auth === "Bearer tok-harness", got.text.trim() || `auth was ${got.request?.auth}`);
}

{
  // A git worktree is a directory of its own, and the registration was written against the main
  // checkout. Answering here is the difference between a CLI that works in a pool of worktrees
  // and one that works only in the copy somebody happened to connect.
  const main = dir("shape-worktree", "main");
  const tree = dir("shape-worktree", "wt-1");
  mkdirSync(join(main, ".git", "worktrees", "wt-1"), { recursive: true });
  writeFileSync(join(tree, ".git"), `gitdir: ${main.replace(/\\/g, "/")}/.git/worktrees/wt-1\n`, "utf8");
  writeJson(join(CONFIG_DIR, ".claude.json"), {
    projects: {
      [main.replace(/\\/g, "/")]: { mcpServers: { bg: { url: `${BASE}/mcp`, headers: { Authorization: "Bearer tok-worktree" } } } },
    },
  });
  const got = await reached(tree);
  check("a worktree climbs to its main checkout to find that registration",
    got.ok && got.request?.auth === "Bearer tok-worktree", got.text.trim() || `auth was ${got.request?.auth}`);
}

{
  const nowhere = dir("shape-none");
  writeJson(join(CONFIG_DIR, ".claude.json"), { projects: {} });
  const { code, text } = await run(["search", "ping"], { cwd: nowhere });
  check("nothing configured anywhere is refused, non-zero, naming every place looked at",
    code !== 0 && /mcp/i.test(text) && /GALY_ENDPOINT/.test(text) && /connect/i.test(text), text.trim());
}

// ───────────────────────────────────── (e) a refusal that routes the caller
console.log("\nA body the buffer does not serve is refused by name, not by a usage line:");

for (const [type, verb] of [["objective", "strategy_update_objective"], ["idea", "suggestion_create"]]) {
  const { code, text } = await run(["content", "pull", type, "5"], { cwd: dir("elsewhere") });
  check(`\`content pull ${type}\` names where that text really lives`,
    code !== 0 && text.includes(verb), text.trim());
}

{
  const { code, text } = await run(["content", "pull", "feature-brief"], { cwd: dir("elsewhere") });
  check("a missing id is still a usage error, not a routing lecture",
    code !== 0 && text.includes("Usage:"), text.trim());
}

server.close();
console.log(failures === 0 ? "\n✓ the CLI is reachable, honest and finds its workspace." : `\n✗ ${failures} problem(s).`);
process.exit(failures === 0 ? 0 : 1);
