#!/usr/bin/env node
// bgaly — cross-platform CLI for the Galy project-management API.
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
// WHY THE COMMAND IS CALLED `bgaly` AND NOT `bg`. Everything else in the kit is `bg`: the
// plugin, the MCP alias, the `mcp__bg__*` tools, the `.bg/` folder. None of those is ever
// typed into a shell. This is, and `bg` is a Bourne-shell BUILTIN — job control. A builtin
// always wins over PATH, so no shim of any kind can be reached under bash: `bg search x`
// answers `bg: no job control` and never enters this file. That failure wears the face of
// a broken CLI, and on some shells it does not even fail — the builtin's status is what the
// caller reads, so a script testing the exit code concludes the push worked. One name that
// cannot be shadowed beats two names of which one lies. `scripts/check-cli.mjs` holds it.
//
// Config resolution — THE SAME SHAPES THE STATUS LINE READS, in the same order. Two readers
// of one file that disagree on its shape is how "bg: No endpoint" was answered on a working
// copy whose status line was showing the workspace at that very moment. Change one, change
// the other: galy/statusline/bg-statusline.mjs, function workspace().
//
//   .bg/config.json { "mcp": "<server name>" }  -> that server in the nearest .mcp.json
//   env GALY_ENDPOINT / GALY_TOKEN
//   .bg/config.json { "endpoint", "token" }     (.galy/ is the folder's former name, read after)
//   the harness's own registration in ~/.claude.json, for a copy connected through it alone
//
// and the search climbs the ancestors of the working directory AND of the main checkout,
// because a git worktree is a directory of its own and neither the config file nor the
// harness registration follows it there.
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
//   bgaly search <query>
//   bgaly brief <id>
//   bgaly spec <id>
//   bgaly content pull <type> <id>        # type = feature-brief | feature-spec
//   bgaly content push <type> <id>

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

// The two kinds of body the REST content surface serves. It is not a shortlist of what the
// kit cares about: it is exactly what `PmContentController` routes, and the contract says the
// same (galy/contract/pm-v1.json, rest_api). Every other object carries its text as a plain
// tool argument, small enough to pass — so adding a type here would ship a command that 404s,
// and `elsewhere()` below routes the caller instead of leaving them to find out.
const TYPES = new Set(["feature-brief", "feature-spec"]);

// Where the text of an object that has no content buffer actually lives. A bare usage line
// left the caller to guess that an objective's description is not missing but simply passed
// as an argument; naming the verb is the difference between a refusal and a dead end.
const ELSEWHERE = {
  objective: "an objective's text is a tool argument: mcp__bg__strategy_create_objective(description_md) / mcp__bg__strategy_update_objective(objectiveId, description_md).",
  objectives: "an objective's text is a tool argument: mcp__bg__strategy_create_objective(description_md) / mcp__bg__strategy_update_objective(objectiveId, description_md).",
  idea: "an idea is a suggestion, and its text is a tool argument: mcp__bg__suggestion_create(title, bodyMd, technicalDetailMd).",
  ideas: "an idea is a suggestion, and its text is a tool argument: mcp__bg__suggestion_create(title, bodyMd, technicalDetailMd).",
  suggestion: "a suggestion's text is a tool argument: mcp__bg__suggestion_create(title, bodyMd, technicalDetailMd).",
  bug: "a ticket's text is a tool argument: mcp__bg__bug_create(title, descriptionMd, technicalDetailMd).",
  ticket: "a ticket's text is a tool argument: mcp__bg__bug_create(title, descriptionMd, technicalDetailMd).",
};

// ── Config ────────────────────────────────────────────────────────────────
// `.bg/` is the folder; `.galy/` is what it was called before the brand became B.Galy. A setup run
// before the rename left its token there, and a CLI that stopped reading it would answer "No token"
// on a workstation that has one — so the former name stays readable, after the new one, at each
// level of the walk up.
const CONFIG_DIRS = [".bg", ".galy"];
const CLAUDE_DIR = process.env.CLAUDE_CONFIG_DIR || join(homedir(), ".claude");

function readJson(path) {
  try { return JSON.parse(readFileSync(path, "utf8")); } catch { return null; }
}

// A git worktree is a directory of its own, and neither the config file nor the harness's
// registration follows it there: both were written where the repository was first connected.
function mainCheckout(dir) {
  try {
    const marker = readFileSync(join(dir, ".git"), "utf8");   // a directory here means we ARE the main checkout
    const gitdir = /^gitdir:\s*(.+)$/m.exec(marker)?.[1]?.trim();
    if (!gitdir || !/[\\/]worktrees[\\/]/.test(gitdir)) return null;
    const cut = gitdir.replace(/\\/g, "/").lastIndexOf("/.git/");
    return cut === -1 ? null : resolve(gitdir.replace(/\\/g, "/").slice(0, cut));
  } catch { return null; }
}

function searchPath(startDir) {
  const dirs = [];
  const climb = (from) => {
    let dir = resolve(from);
    for (;;) {
      if (!dirs.includes(dir)) dirs.push(dir);
      const parent = dirname(dir);
      if (parent === dir) return;
      dir = parent;
    }
  };
  const start = resolve(startDir || process.cwd());
  climb(start);
  const main = mainCheckout(start);
  if (main) climb(main);
  return dirs;
}

function fromConfigFile(dirs) {
  for (const dir of dirs) {
    for (const folder of CONFIG_DIRS) {
      const path = join(dir, folder, "config.json");
      if (!existsSync(path)) continue;
      const config = readJson(path);
      if (!config) die(`Cannot parse ${path}: it is not valid JSON.`);
      return { ...config, path };
    }
  }
  return {};
}

// `${VAR}` in a header is how `.mcp.json` keeps a secret out of the file; the harness
// expands it from the environment and so does this.
function expandEnv(value) {
  return String(value ?? "").replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)(?::-([^}]*))?\}/g, (_, name, fallback) => process.env[name] ?? fallback ?? "");
}

// A server that signs its users in rather than reading a token from the file leaves no
// Authorization header there: the harness holds the token it obtained, and we read it where
// the harness keeps it. Renewing it is the harness's job.
function harnessToken(name, url) {
  const store = readJson(join(CLAUDE_DIR, ".credentials.json"));
  const entries = Object.entries(store?.mcpOAuth || {})
    .map(([key, entry]) => ({ key, ...entry }))
    .filter((e) => e.accessToken && (e.serverName === name || e.serverUrl === url))
    .filter((e) => !e.expiresAt || e.expiresAt > Date.now())
    .sort((x, y) => (y.expiresAt || 0) - (x.expiresAt || 0));
  return entries[0]?.accessToken || null;
}

// A server named in the config is looked up in the nearest `.mcp.json` — the repository's own
// registration, the one the session already speaks through.
function fromRepositoryServer(dirs, name) {
  for (const dir of dirs) {
    const registry = readJson(join(dir, ".mcp.json"));
    const server = registry?.mcpServers?.[name];
    if (!server) continue;
    if (!server.url) return null;
    const url = expandEnv(server.url);
    const headers = {};
    for (const [key, value] of Object.entries(server.headers || {})) headers[key] = expandEnv(value);
    if (!Object.keys(headers).some((key) => key.toLowerCase() === "authorization")) {
      const token = harnessToken(name, url);
      if (token) headers.Authorization = `Bearer ${token}`;
    }
    return { url, headers };
  }
  return null;
}

// The harness records one MCP server per project. Only a project on our search path is ours:
// picking any other one would talk to a different workspace entirely.
function fromHarness(dirs) {
  const path = [join(CLAUDE_DIR, ".claude.json"), join(homedir(), ".claude.json")].find((p) => existsSync(p));
  const root = path && readJson(path);
  if (!root) return {};
  const pick = (servers) => {
    if (!servers) return null;
    for (const name of ["bg", "galy", ...Object.keys(servers)]) {
      const server = servers[name];
      const url = server?.url;
      const auth = server?.headers?.Authorization || server?.headers?.authorization;
      if (url && /\/mcp\/?$/i.test(url) && auth) {
        return { endpoint: url, token: String(auth).replace(/^Bearer\s+/i, "") };
      }
    }
    return null;
  };
  const projects = root.projects || {};
  for (const dir of dirs) {
    const entry = projects[dir] || projects[dir.replace(/\\/g, "/")];
    const found = pick(entry?.mcpServers);
    if (found) return found;
  }
  return pick(root.mcpServers) || {};
}

const base = (url) => url.replace(/\/+$/, "").replace(/\/mcp$/i, ""); // tolerate a pasted MCP url

// What a workspace is, to this CLI: where to send the request, and which headers open the
// door. The branches and their order mirror `workspace()` in bg-statusline.mjs exactly —
// including `mcp` being decided before the environment, which is the status line's order.
function loadConfig() {
  const dirs = searchPath(process.cwd());
  const file = fromConfigFile(dirs);

  if (file.mcp) {
    const server = fromRepositoryServer(dirs, file.mcp);
    if (!server) {
      die(`${file.path} names the MCP server '${file.mcp}', and no .mcp.json on the way up declares it with a url.`);
    }
    if (!Object.keys(server.headers).some((k) => k.toLowerCase() === "authorization")) {
      die(`the MCP server '${file.mcp}' carries no Authorization header, and the harness holds no live token for it. Sign in again, or run /bg:connect.`);
    }
    return { endpoint: base(server.url), headers: server.headers };
  }

  const harness = fromHarness(dirs);
  const endpoint = process.env.GALY_ENDPOINT || file.endpoint || harness.endpoint;
  const token = process.env.GALY_TOKEN || file.token || harness.token;
  if (!endpoint) {
    die("No endpoint. This looks at, in order: .bg/config.json { \"mcp\" } or { \"endpoint\", \"token\" }, GALY_ENDPOINT/GALY_TOKEN, and the MCP server the harness registered for this project — climbing out of a worktree to its main checkout too. None of them answered: run /bg:connect.");
  }
  if (!token) {
    die("No token. Set GALY_TOKEN or .bg/config.json { \"token\": ... }, or run /bg:connect. A token is minted on Connect my agent, in the top bar of any Galy screen.");
  }
  return { endpoint: base(endpoint), headers: { Authorization: `Bearer ${token}` } };
}

// ── HTTP ──────────────────────────────────────────────────────────────────
async function request(method, path, { json, raw } = {}) {
  const { endpoint, headers: auth } = loadConfig();
  const res = await fetch(`${endpoint}${path}`, {
    method,
    headers: {
      ...auth,
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
  if (!q) die("Usage: bgaly search <query>");
  print(await request("GET", `/api/pm/search?q=${encodeURIComponent(q)}`));
}

async function cmdBrief(args) {
  const id = args._[0];
  if (!id) die("Usage: bgaly brief <id>");
  print(await request("GET", `/api/pm/brief/${encodeURIComponent(id)}`));
}

async function cmdSpec(args) {
  const id = args._[0];
  if (!id) die("Usage: bgaly spec <id>");
  print(await request("GET", `/api/pm/spec/${encodeURIComponent(id)}`));
}

async function cmdContent(args) {
  const [action, type, id] = args._;
  if (!["pull", "push"].includes(action)) die("Usage: bgaly content pull|push <type> <id>   (type = feature-brief | feature-spec)");
  if (type && !TYPES.has(type)) {
    const elsewhere = ELSEWHERE[String(type).toLowerCase()];
    die(elsewhere
      ? `no content buffer for '${type}' — ${elsewhere}\n    The buffer exists only for feature-brief and feature-spec, whose bodies are too large to pass as arguments.`
      : `unknown type '${type}'. The content buffer serves feature-brief and feature-spec; every other object carries its text as a tool argument.`);
  }
  if (!type || !id) die("Usage: bgaly content pull|push <type> <id>   (type = feature-brief | feature-spec)");
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
  if (!existsSync(path)) die(`No buffer at ${path}. Run 'bgaly content pull ${type} ${id}' first.`);
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
function die(msg) { console.error(`bgaly: ${msg}`); process.exit(1); }

const HELP = `bgaly — Galy project-management CLI

  bgaly search <query>              # briefs + specs matching the query
  bgaly brief <id>                  # a brief with its user stories
  bgaly spec <id>                   # a spec with its phases, risks, acceptance tests
  bgaly content pull <type> <id>    # type = feature-brief | feature-spec
  bgaly content push <type> <id>
  bgaly bug-evaluation help         # local isolated bug-evaluation runner

The content buffer serves those two types and no other: every other object — an objective,
a suggestion, a ticket — carries its text as a plain tool argument, small enough to pass.

Config, in this order: .bg/config.json { "mcp": "<server name>" } resolved against the
nearest .mcp.json; GALY_ENDPOINT / GALY_TOKEN; .bg/config.json { "endpoint", "token" }; the
MCP server the harness registered for this project. /bg:connect writes one of them for you.

The command is \`bgaly\`, not \`bg\`: \`bg\` is a shell builtin and would never reach this file.
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
    default: die(`Unknown command '${cmd}'. Run 'bgaly help'.`);
  }
}

main().catch((e) => die(e.message));
