#!/usr/bin/env node
// bg — cross-platform CLI for the Galy project-management API.
//
// Talks REST to /api/pm/* on your Galy endpoint. Mirrors the read side of the MCP
// verbs your agent uses, but is shell-friendly: search work items, read
// compact JSON cards, and pull/push the large markdown body of a brief or spec as
// a local file so you never shove a whole body through a tool argument.
//
// Strictly outward: this CLI reads strategy/briefs/specs and writes back their
// text (bodies). It never sends your source code — there is no verb that reads a
// repository file.
//
// Config resolution (first hit wins per field):
//   env GALY_ENDPOINT / GALY_TOKEN
//   .bg/config.json    ({ "endpoint": "...", "token": "..." }) searched upward from cwd;
//   .galy/config.json  is the folder's former name, still read after it so a token written
//                      before the rename keeps working
//
// Content buffer: .tmp/galy-content/<type>/<id>.md — raw markdown whose sections are
//   delimited by <!-- @field <name> -->. The server composes/parses it; the CLI
//   round-trips the document verbatim.
//
// Routes (galy PmContentController):
//   GET  /api/pm/search?q=<q>              -> { briefs, specs }
//   GET  /api/pm/brief/<id>                -> { brief, user_stories }
//   GET  /api/pm/spec/<id>                 -> { spec, phases, risks, acceptance_tests }
//   GET  /api/pm/content/<type>/<id>/body  -> text/markdown
//   PUT  /api/pm/content/<type>/<id>/body  <- { "Body": "<markdown>" }
//
// Commands:
//   bg search <query>
//   bg brief <id>
//   bg spec <id>
//   bg content pull <type> <id>        # type = feature-brief | feature-spec
//   bg content push <type> <id>

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const TYPES = new Set(["feature-brief", "feature-spec"]);

// ── Config ────────────────────────────────────────────────────────────────
// `.bg/` is the folder; `.galy/` is what it was called before the brand became B.Galy. A setup run
// before the rename left its token there, and a CLI that stopped reading it would answer "No token"
// on a workstation that has one — so the former name stays readable, after the new one, at each
// level of the walk up.
const CONFIG_DIRS = [".bg", ".galy"];

function findConfig(startDir) {
  let dir = resolve(startDir);
  for (;;) {
    for (const folder of CONFIG_DIRS) {
      const candidate = join(dir, folder, "config.json");
      if (existsSync(candidate)) return candidate;
    }
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function loadConfig() {
  let fromFile = {};
  const path = findConfig(process.cwd());
  if (path) {
    try { fromFile = JSON.parse(readFileSync(path, "utf8")); }
    catch (e) { die(`Cannot parse ${path}: ${e.message}`); }
  }
  let endpoint = process.env.GALY_ENDPOINT || fromFile.endpoint;
  const token = process.env.GALY_TOKEN || fromFile.token;
  if (!endpoint) die("No endpoint. Set GALY_ENDPOINT or .bg/config.json { \"endpoint\": ... }.");
  if (!token) die("No token. Set GALY_TOKEN or .bg/config.json { \"token\": ... }. Get one from galy.io → Settings → Connect your assistant.");
  endpoint = endpoint.replace(/\/+$/, "").replace(/\/mcp$/i, ""); // tolerate a pasted MCP url
  return { endpoint, token };
}

// ── HTTP ──────────────────────────────────────────────────────────────────
async function request(method, path, { json, raw } = {}) {
  const { endpoint, token } = loadConfig();
  const res = await fetch(`${endpoint}${path}`, {
    method,
    headers: {
      "Authorization": `Bearer ${token}`,
      "Accept": raw ? "text/markdown, text/plain, */*" : "application/json",
      ...(json ? { "Content-Type": "application/json" } : {}),
    },
    body: json ? JSON.stringify(json) : undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    let msg = text.slice(0, 300);
    try { msg = JSON.parse(text).error || msg; } catch { /* keep raw */ }
    if (res.status === 401) msg = "unauthorized — check your token (galy.io → Settings → Connect your assistant)";
    die(`${method} ${path} → HTTP ${res.status}: ${msg}`);
  }
  return raw ? text : (text ? JSON.parse(text) : {});
}

// ── Content buffer ──────────────────────────────────────────────────────────
function bufferPath(type, id) {
  return join(process.cwd(), ".tmp", "galy-content", type, `${id}.md`);
}

// ── Commands ──────────────────────────────────────────────────────────────
async function cmdSearch(args) {
  const q = args._[0];
  if (!q) die("Usage: bg search <query>");
  print(await request("GET", `/api/pm/search?q=${encodeURIComponent(q)}`));
}

async function cmdBrief(args) {
  const id = args._[0];
  if (!id) die("Usage: bg brief <id>");
  print(await request("GET", `/api/pm/brief/${encodeURIComponent(id)}`));
}

async function cmdSpec(args) {
  const id = args._[0];
  if (!id) die("Usage: bg spec <id>");
  print(await request("GET", `/api/pm/spec/${encodeURIComponent(id)}`));
}

async function cmdContent(args) {
  const [action, type, id] = args._;
  if (!["pull", "push"].includes(action) || !TYPES.has(type) || !id) {
    die("Usage: bg content pull|push <type> <id>   (type = feature-brief | feature-spec)");
  }
  const path = bufferPath(type, id);
  const route = `/api/pm/content/${type}/${encodeURIComponent(id)}/body`;

  if (action === "pull") {
    const body = await request("GET", route, { raw: true });
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, body, "utf8");
    console.log(`Pulled ${type} ${id} → ${path}`);
    return;
  }

  // push — send the buffer verbatim; the server parses the <!-- @field --> sections.
  if (!existsSync(path)) die(`No buffer at ${path}. Run 'bg content pull ${type} ${id}' first.`);
  const body = readFileSync(path, "utf8");
  await request("PUT", route, { json: { Body: body }, raw: true });
  console.log(`Pushed ${type} ${id}`);
}

// ── arg parsing / output ────────────────────────────────────────────────────
function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) out[key] = true;
      else { out[key] = next; i++; }
    } else out._.push(a);
  }
  return out;
}

function print(obj) { console.log(JSON.stringify(obj, null, 2)); }
function die(msg) { console.error(`bg: ${msg}`); process.exit(1); }

const HELP = `bg — Galy project-management CLI

  bg search <query>                 # briefs + specs matching the query
  bg brief <id>                     # a brief with its user stories
  bg spec <id>                      # a spec with its phases, risks, acceptance tests
  bg content pull <type> <id>       # type = feature-brief | feature-spec
  bg content push <type> <id>
  bg bug-evaluation help              # local isolated bug-evaluation runner

Config: env GALY_ENDPOINT / GALY_TOKEN, or .bg/config.json { "endpoint", "token" }.
Galy never sees your code — this CLI only carries work items and their text.`;

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === "bug-evaluation") {
    const runner = await import("./bug-evaluation-runner.mjs");
    return runner.runCli(rest);
  }
  const args = parseArgs(rest);
  switch (cmd) {
    case "search": return cmdSearch(args);
    case "brief": return cmdBrief(args);
    case "spec": return cmdSpec(args);
    case "content": return cmdContent(args);
    case undefined:
    case "-h":
    case "--help":
    case "help": return console.log(HELP);
    default: die(`Unknown command '${cmd}'. Run 'bg help'.`);
  }
}

main().catch((e) => die(e.message));
