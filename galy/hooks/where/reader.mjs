// Reading the workspace through the session's own MCP connection.
//
// Two workspaces speak the `pm-v1` contract with two spellings, at the outward end as at
// the inward one. Arguments: Galy expects `id` and `feature_brief_id`; the Green Acres
// back office expects `specId`, `briefId`, `objectiveId` — the contract's own spelling.
// Answers: Galy writes `snake_case` everywhere, the back office writes PascalCase on its
// feature verbs and `snake_case` on its strategy verbs.
//
// So a field is read BY NAME, every spelling of the field it means and never one that
// means something else — `feature_brief_id` on a spec is the brief it belongs to, and
// `briefId` on `feature_spec_update` is the brief it MOVES to. And an argument spelling is
// tried, then the other, and the one a server accepted is remembered for that server.
//
// Nothing here talks: `call` is handed in. That is what makes the whole file testable
// against the two workspaces' real answers without a network.

import { NAMES_TTL_MS } from "./names.mjs";

/**
 * The first of `names` the record carries with a value.
 *
 * @param {any} record
 * @param {...string} names
 * @returns {any}
 */
export function fieldOf(record, ...names) {
  if (!record || typeof record !== "object") return undefined;
  for (const name of names) {
    const value = record[name];
    if (value !== undefined && value !== null) return value;
  }
  return undefined;
}

/** A whole number, or null. */
const idOf = (value) => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
};

/** A string, trimmed, or null. */
const textOf = (value) => {
  const text = typeof value === "string" ? value.trim() : value === undefined || value === null ? "" : String(value);
  return text === "" ? null : text;
};

/** A finite number, or null — the two workspaces answer decimals as numbers and as strings. */
const numberOf = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

/**
 * The payload of an MCP result: the text block's JSON, or the structured content.
 *
 * @param {{ content?: Array<{ type?: string, text?: string }>, isError?: boolean, structuredContent?: unknown }} result
 * @returns {any}
 */
export function payloadOf(result) {
  const blocks = Array.isArray(result?.content) ? result.content : [];
  const text = blocks.find((block) => typeof block?.text === "string")?.text;
  let body;
  if (typeof text === "string") {
    try {
      body = JSON.parse(text);
    } catch {
      body = { message: text };
    }
  }
  if (body === undefined) body = result?.structuredContent;
  if (result?.isError === true) {
    throw new Error(textOf(fieldOf(body, "message", "error")) ?? textOf(text) ?? "refusé");
  }
  if (body && typeof body === "object" && body.success === false) {
    throw new Error(textOf(fieldOf(body, "message", "error")) ?? "refusé");
  }
  return body && typeof body === "object" ? body : {};
}

// ── What each answer means ────────────────────────────────────────────────

/**
 * @typedef {{ id: number, title: string | null, status: string | null }} Named
 * @typedef {Named & { briefId: number | null, phases: Named[] }} SpecRecord
 * @typedef {Named & { objectiveId: number | null, objectiveTitle: string | null, specs: Named[] | null }} BriefRecord
 * @typedef {{ id: number, title: string | null, period: string | null }} ChainNode
 * @typedef {{ title: string | null, current: number | null, target: number | null, unit: string | null, progress: number | null }} KeyResult
 */

/** @param {any} node @returns {Named} */
const namedOf = (node) => ({
  id: idOf(fieldOf(node, "id", "Id")) ?? 0,
  title: textOf(fieldOf(node, "title", "Title")),
  status: textOf(fieldOf(node, "status", "Status")),
});

/**
 * A spec, from either workspace's `feature_spec_get`.
 *
 * @param {any} answer
 * @returns {SpecRecord}
 */
export function specOf(answer) {
  const record = fieldOf(answer, "spec", "Spec") ?? answer;
  const phases = fieldOf(record, "phases", "Phases") ?? fieldOf(answer, "phases", "Phases") ?? [];
  return {
    ...namedOf(record),
    briefId: idOf(fieldOf(record, "feature_brief_id", "FeatureBriefId")),
    phases: (Array.isArray(phases) ? phases : []).map(namedOf),
  };
}

/**
 * A brief, from either workspace's `feature_brief_get`. `specs` is null where the answer
 * carries no children at all — Galy's does not, and they are listed separately.
 *
 * @param {any} answer
 * @returns {BriefRecord}
 */
export function briefOf(answer) {
  const record = fieldOf(answer, "brief", "Brief") ?? answer;
  const children = fieldOf(record, "child_specs", "ChildSpecs", "specs", "Specs") ?? fieldOf(answer, "specs", "Specs");
  return {
    ...namedOf(record),
    objectiveId: idOf(fieldOf(record, "objective_id", "ObjectiveId")),
    objectiveTitle: textOf(fieldOf(record, "objective_title", "ObjectiveTitle")),
    specs: Array.isArray(children) ? children.map(namedOf) : null,
  };
}

/**
 * The specs of one brief, from `feature_spec_list`.
 *
 * @param {any} answer
 * @returns {Named[]}
 */
export function specListOf(answer) {
  const listed = fieldOf(answer, "specs", "Specs", "items", "Items") ?? [];
  return (Array.isArray(listed) ? listed : []).map(namedOf);
}

/**
 * The objective chain, root first, from `strategy_get_objective_breadcrumb`.
 *
 * @param {any} answer
 * @returns {ChainNode[]}
 */
export function chainOf(answer) {
  const chain = fieldOf(answer, "chain", "Chain", "breadcrumb", "Breadcrumb") ?? [];
  return (Array.isArray(chain) ? chain : []).map((node) => ({
    id: idOf(fieldOf(node, "id", "Id")) ?? 0,
    title: textOf(fieldOf(node, "title", "Title")),
    period: textOf(fieldOf(node, "period_name", "PeriodName", "period", "Period")),
  }));
}

/** @param {any} node @returns {KeyResult} */
const keyResultOf = (node) => ({
  title: textOf(fieldOf(node, "title", "Title")),
  current: numberOf(fieldOf(node, "current_value", "CurrentValue")),
  target: numberOf(fieldOf(node, "target_value", "TargetValue")),
  unit: textOf(fieldOf(node, "unit", "Unit")),
  progress: numberOf(fieldOf(node, "progress", "Progress", "computed_progress", "ComputedProgress")),
});

/**
 * The key results of one objective, whichever verb answered: `strategy_get_objective`
 * (the objective itself), or `strategy_navigate_children` under its parent, where the
 * objective is one row among its siblings and the two workspaces nest it differently.
 *
 * @param {any} answer
 * @param {number} objectiveId
 * @returns {KeyResult[]}
 */
export function keyResultsOf(answer, objectiveId) {
  const direct = fieldOf(fieldOf(answer, "objective", "Objective") ?? answer, "key_results", "KeyResults");
  if (Array.isArray(direct) && direct.length > 0) return direct.map(keyResultOf);

  const rows = fieldOf(answer, "items", "Items", "objectives", "Objectives") ?? [];
  for (const row of Array.isArray(rows) ? rows : []) {
    const node = fieldOf(row, "objective", "Objective") ?? row;
    if (idOf(fieldOf(node, "id", "Id")) !== objectiveId) continue;
    const listed = fieldOf(row, "key_results", "KeyResults") ?? fieldOf(node, "key_results", "KeyResults") ?? [];
    return (Array.isArray(listed) ? listed : []).map(keyResultOf);
  }
  return [];
}

// ── The two argument spellings ────────────────────────────────────────────

/**
 * Every read the pane makes, in the contract's spelling then Galy's. The order matters:
 * the contract's is tried first, and a server that refuses it is asked again the other
 * way, once, and remembered.
 */
export const READS = {
  spec: {
    tool: "feature_spec_get",
    args: { contract: (id) => ({ specId: id }), galy: (id) => ({ id }) },
    read: specOf,
  },
  brief: {
    tool: "feature_brief_get",
    args: { contract: (id) => ({ briefId: id }), galy: (id) => ({ id }) },
    read: briefOf,
  },
  chain: {
    tool: "strategy_get_objective_breadcrumb",
    args: { contract: (id) => ({ objectiveId: id }), galy: (id) => ({ objective_id: id }) },
    read: chainOf,
  },
  objective: {
    tool: "strategy_get_objective",
    args: { contract: (id) => ({ objectiveId: id }), galy: (id) => ({ id }) },
    read: (answer, id) => keyResultsOf(answer, id),
  },
  children: {
    tool: "strategy_navigate_children",
    args: {
      contract: (id) => ({ objectiveId: id, includeKrs: true, depth: 1 }),
      galy: (id) => ({ parent_objective_id: id }),
    },
    read: (answer, id, wanted) => keyResultsOf(answer, wanted ?? id),
  },
  briefSpecs: {
    tool: "feature_spec_list",
    args: { contract: (id) => ({ briefId: id }), galy: (id) => ({ feature_brief_id: id }) },
    read: specListOf,
  },
};

/** The spellings, in the order they are tried. */
export const SPELLINGS = ["contract", "galy"];

// ── The reader ────────────────────────────────────────────────────────────

/**
 * Builds the reader the pane uses: one read per entity, cached across every session of
 * the machine, one call in flight per key, and the argument spelling settled per server.
 *
 * @param {{
 *   call: (server: string, tool: string, args: Record<string, unknown>) => Promise<any>,
 *   storeGet: (key: string) => Promise<unknown>,
 *   storeSet: (key: string, value: unknown) => Promise<void>,
 *   now: () => Promise<number>,
 *   has?: (server: string, tool: string) => boolean,
 *   ttlMs?: number,
 * }} host
 */
export function readerOf(host) {
  const ttl = host.ttlMs ?? NAMES_TTL_MS;
  /** @type {Map<string, Promise<any>>} */
  const inFlight = new Map();
  /** @type {Map<string, string>} */
  const spellings = new Map();

  const cacheKeyOf = (server, kind, id) => `names/${server}/${kind}/${id}`;
  const spellingKeyOf = (server) => `spelling/${server}`;

  async function spellingFor(server) {
    const known = spellings.get(server);
    if (known) return known;
    const stored = await host.storeGet(spellingKeyOf(server)).catch(() => undefined);
    const spelling = SPELLINGS.includes(String(stored)) ? String(stored) : SPELLINGS[0];
    spellings.set(server, spelling);
    return spelling;
  }

  async function rememberSpelling(server, spelling) {
    if (spellings.get(server) === spelling) return;
    spellings.set(server, spelling);
    await host.storeSet(spellingKeyOf(server), spelling).catch(() => undefined);
  }

  /** Calls one verb, trying the remembered spelling first and the other once. */
  async function ask(server, kind, id) {
    const plan = READS[kind];
    const first = await spellingFor(server);
    const order = [first, ...SPELLINGS.filter((name) => name !== first)];
    let failure = null;
    for (const spelling of order) {
      const build = plan.args[spelling];
      if (!build) continue;
      try {
        const answer = await host.call(server, plan.tool, build(id));
        await rememberSpelling(server, spelling);
        return answer;
      } catch (error) {
        failure = error;
      }
    }
    throw failure ?? new Error(`${plan.tool} n'a pas répondu`);
  }

  /**
   * One entity, normalised, from the cache when it is fresh.
   *
   * @param {string} server
   * @param {string} kind one of `READS`
   * @param {number} id
   * @param {number} [wanted] the objective a `children` read is looking for
   */
  async function read(server, kind, id, wanted) {
    if (!READS[kind]) throw new Error(`lecture inconnue : ${kind}`);
    const key = cacheKeyOf(server, kind, wanted ?? id);
    const pending = inFlight.get(key);
    if (pending) return pending;

    const load = (async () => {
      const at = await host.now();
      const cached = await host.storeGet(key).catch(() => undefined);
      if (cached && typeof cached === "object" && at - Number(cached.at) < ttl) return cached.value;

      const answer = await ask(server, kind, id);
      const value = READS[kind].read(answer, id, wanted);
      await host.storeSet(key, { at, value }).catch(() => undefined);
      return value;
    })().finally(() => inFlight.delete(key));

    inFlight.set(key, load);
    return load;
  }

  /** Whether that server serves that verb, when the tool list is known. */
  const serves = (server, tool) => (host.has ? host.has(server, tool) : true);

  /** Forgets every name read for this copy, so the next draw asks again. */
  async function forget(keys) {
    for (const key of keys) await host.storeSet(key, undefined).catch(() => undefined);
    spellings.clear();
    inFlight.clear();
  }

  return { read, serves, forget, cacheKeyOf };
}

/**
 * The server an entry goes through: the one it was written with, else the only server
 * serving `feature_spec_get`, else the first of them.
 *
 * @param {string | null} named
 * @param {Array<{ name: string }>} tools the session's tools, as `$.tool.list()` gives them
 * @returns {string | null}
 */
export function serverOf(named, tools) {
  if (named) return named;
  const servers = [];
  for (const tool of tools ?? []) {
    const match = /^mcp__(.+?)__feature_spec_get$/.exec(String(tool?.name ?? ""));
    if (match && match[1] && !servers.includes(match[1])) servers.push(match[1]);
  }
  return servers[0] ?? null;
}

/**
 * Every server of the session that serves the workspace contract.
 *
 * @param {Array<{ name: string }>} tools
 * @returns {string[]}
 */
export function serversOf(tools) {
  const servers = [];
  for (const tool of tools ?? []) {
    const match = /^mcp__(.+?)__feature_spec_get$/.exec(String(tool?.name ?? ""));
    if (match && match[1] && !servers.includes(match[1])) servers.push(match[1]);
  }
  return servers;
}
