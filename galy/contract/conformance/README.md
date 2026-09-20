# Contract conformance

Verifies that a Galy MCP endpoint honours the `galy-pm-v1` contract — and, above all, the outward-only
guarantee: **no verb ever accepts source code, a diff, or file content.**

## Run

Static only (no network) — scans the contract file for forbidden fields:

```
node runner.mjs
```

Against a live endpoint — set `GALY_ENDPOINT` (the host) and `GALY_TOKEN`. The runner derives the MCP
url (`<endpoint>/mcp`) and the REST base from it, and exercises both surfaces:

```
GALY_ENDPOINT=https://<your-workspace>.galy.cloud GALY_TOKEN=<token> node runner.mjs
```

(You can pin the MCP url separately with `GALY_MCP_URL` if it differs.) Exit code `0` = all checks pass,
`1` = at least one failure.

## What it checks

**MCP layer** (the `mcp__bg__*` verbs):
1. **Forbidden fields** — neither the contract nor the live tool schemas declare a `code` / `diff` /
   `patch` / `file_content` / `source_code` parameter.
2. **Advertised verbs** — every verb in `pm-v1.json` is present in `tools/list`.
3. **Read envelopes** — read verbs return `{ success: true, ... }`.

**REST layer** (the routes the `bgaly` CLI uses — `PmContentController`):
4. `GET /api/pm/search?q=ping` returns `{ briefs:[], specs:[] }`.
5. The same call **without** a token is rejected (401/403) — the outward API requires the Bearer token.
6. The token looks like the expected 64-hex string.

Write verbs are validated by their live schema, not invoked — calling them would mutate the connected
workspace. Pass `--write` only against a disposable sandbox account.
