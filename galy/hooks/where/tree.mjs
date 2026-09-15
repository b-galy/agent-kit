// From what the copy has in hand to the tree the pane draws.
//
// One subtree per BRIEF, newest first: the objective chain the brief serves, the brief,
// every spec of it this copy has in hand with its phases, and the brief's other specs. A
// brief held on its own — one nobody has written a spec for yet — is a subtree of its own,
// stopping at the brief. A brief with no objective stops there too, and says so rather than
// drawing a chain it does not have.
//
// Per brief, not per spec: two specs of one brief in hand drew the same chain and the same
// brief twice, each copy naming the other spec as a sibling, and nothing on screen said the
// two halves were one piece of work.
//
// Every read is handed in, so this file never talks to anything: a failed read becomes a
// named gap in the tree, and the rest is still drawn.

import { objectiveViewOf } from "./reader.mjs";

/**
 * @typedef {import('./reader.mjs').Named} Named
 * @typedef {{
 *   key: string,
 *   chain: Array<{ id: number, title: string | null, period: string | null, url: string | null, icon: string | null }>,
 *   periods: string[],
 *   keyResults: Array<import('./reader.mjs').KeyResult>,
 *   outsideStrategy: boolean,
 *   brief: any,
 *   specs: any[],
 *   siblings: any[],
 *   gaps: string[],
 * }} Tree
 */

/** The distinct periods of a chain, leaf first, at most two. */
function periodsOf(chain) {
  const seen = [];
  for (let index = chain.length - 1; index >= 0; index -= 1) {
    const period = chain[index]?.period;
    if (period && !seen.includes(period)) seen.push(period);
  }
  return seen.slice(0, 2);
}

/**
 * Builds the model the views draw.
 *
 * @param {{
 *   held: { specs: Array<{ id: number, at: number, server: string | null }>, briefs: Array<{ id: number, at: number, server: string | null }> },
 *   read: (server: string, kind: string, id: number, wanted?: number) => Promise<any>,
 *   serves?: (server: string, tool: string) => boolean,
 *   serverFor: (named: string | null) => string | null,
 * }} input
 * @returns {Promise<{ status: 'empty' | 'ready', trees: Tree[], gaps: string[] }>}
 */
export async function buildModel(input) {
  const { held, read, serverFor } = input;
  const serves = input.serves ?? (() => true);

  /** @type {Tree[]} */
  const trees = [];
  /** @type {string[]} */
  const gaps = [];
  /** @type {Map<number, Tree>} */
  const briefsDrawn = new Map();

  /** @param {string} key @returns {Tree} */
  const emptyTree = (key) => ({
    key,
    chain: [],
    periods: [],
    keyResults: [],
    outsideStrategy: false,
    brief: null,
    specs: [],
    siblings: [],
    gaps: [],
  });

  for (const entry of held.specs) {
    const server = serverFor(entry.server);
    if (server === null) {
      gaps.push("aucun espace de travail ne répond ici");
      continue;
    }

    let spec = null;
    let failure = null;
    try {
      spec = await read(server, "spec", entry.id);
    } catch (error) {
      failure = messageOf(error);
    }
    const inHand = spec === null
      ? { id: entry.id, title: null, status: null, url: null, phases: [] }
      : { ...spec, id: spec.id || entry.id };
    const briefId = spec?.briefId ?? null;

    // A second spec of a brief already drawn joins that brief's subtree: one chain, one
    // brief, both specs marked as in hand.
    const drawn = briefId === null ? undefined : briefsDrawn.get(briefId);
    if (drawn !== undefined) {
      drawn.specs.push(inHand);
      if (failure !== null) drawn.gaps.push(`spec ${entry.id} : ${failure}`);
      continue;
    }

    const tree = emptyTree(briefId === null ? `spec-${entry.id}` : `brief-${briefId}`);
    tree.specs.push(inHand);
    if (failure !== null) tree.gaps.push(`spec ${entry.id} : ${failure}`);
    trees.push(tree);

    if (briefId !== null) {
      briefsDrawn.set(briefId, tree);
      await fillBrief(tree, server, briefId);
    }
  }

  for (const entry of held.briefs) {
    if (briefsDrawn.has(entry.id)) continue;
    const server = serverFor(entry.server);
    if (server === null) {
      gaps.push("aucun espace de travail ne répond ici");
      continue;
    }
    const tree = emptyTree(`brief-${entry.id}`);
    tree.brief = { id: entry.id, title: null, status: null, url: null };
    briefsDrawn.set(entry.id, tree);
    trees.push(tree);
    await fillBrief(tree, server, entry.id);
  }

  // The brief's own specs are listed once the whole of what is in hand is known: a spec
  // that joined its brief's subtree after the list was read is in hand, never a sibling.
  for (const tree of trees) {
    const inHand = new Set(tree.specs.map((spec) => spec.id));
    tree.siblings = tree.siblings.filter((sibling) => !inHand.has(sibling.id));
  }

  /**
   * The brief, its objective chain, the leaf's key results, and the brief's other specs.
   *
   * @param {Tree} tree
   * @param {string} server
   * @param {number} briefId
   */
  async function fillBrief(tree, server, briefId) {
    let brief = null;
    try {
      brief = await read(server, "brief", briefId);
      tree.brief = { id: brief.id || briefId, title: brief.title, status: brief.status, url: brief.url };
    } catch (error) {
      tree.brief = { id: briefId, title: null, status: null, url: null };
      tree.gaps.push(`brief ${briefId} : ${messageOf(error)}`);
      return;
    }

    let siblings = brief.specs;
    if (siblings === null && serves(server, "feature_spec_list")) {
      try {
        siblings = await read(server, "briefSpecs", briefId);
      } catch (error) {
        tree.gaps.push(`specs du brief ${briefId} : ${messageOf(error)}`);
      }
    }
    tree.siblings = siblings ?? [];

    if (!brief.objectiveId) {
      tree.outsideStrategy = true;
      return;
    }

    try {
      tree.chain = await read(server, "chain", brief.objectiveId);
    } catch (error) {
      tree.gaps.push(`objectif ${brief.objectiveId} : ${messageOf(error)}`);
    }
    if (tree.chain.length === 0 && brief.objectiveTitle) {
      tree.chain = [{ id: brief.objectiveId, title: brief.objectiveTitle, period: null, url: null, icon: null }];
    }
    tree.periods = periodsOf(tree.chain);

    const leaf = tree.chain[tree.chain.length - 1];
    const objectiveId = leaf?.id || brief.objectiveId;
    const parent = tree.chain[tree.chain.length - 2];
    try {
      let objective = null;
      if (serves(server, "strategy_get_objective")) {
        objective = objectiveViewOf(await read(server, "objective", objectiveId));
      } else if (parent && serves(server, "strategy_navigate_children")) {
        objective = objectiveViewOf(await read(server, "children", parent.id, objectiveId));
      }
      if (objective !== null) {
        tree.keyResults = objective.keyResults;
        // An objective's address and its mark are read from the chain, where every node
        // carries its own. The objective's own answer fills the leaf in for a workspace
        // whose breadcrumb serves neither — and for the leaf built from the brief's
        // objective title alone.
        if (leaf && leaf.url === null && objective.url !== null) leaf.url = objective.url;
        if (leaf && leaf.icon === null && objective.icon !== null) leaf.icon = objective.icon;
      }
    } catch (error) {
      tree.gaps.push(`résultats clés ${objectiveId} : ${messageOf(error)}`);
    }
  }

  return { status: trees.length === 0 ? "empty" : "ready", trees, gaps };
}

/**
 * Every name the drawn trees were built from, as cache keys.
 *
 * A write to the workspace makes the names on screen the ones from before it: the brief
 * attached to an objective goes on reading `brief hors stratégie` until the cache lets go.
 * So the write forgets exactly what it may have moved — and the button that forgets
 * everything forgets the same list, because it is the same list.
 *
 * @param {Tree[]} trees
 * @param {(kind: string, id: number) => string} keyOf
 * @returns {string[]}
 */
export function namesToForget(trees, keyOf) {
  /** @type {string[]} */
  const keys = [];
  for (const tree of trees) {
    for (const spec of tree.specs) keys.push(keyOf("spec", spec.id));
    if (tree.brief) {
      keys.push(keyOf("brief", tree.brief.id));
      keys.push(keyOf("briefSpecs", tree.brief.id));
    }
    for (const node of tree.chain) {
      keys.push(keyOf("chain", node.id));
      keys.push(keyOf("objective", node.id));
      keys.push(keyOf("children", node.id));
    }
  }
  return keys;
}

/**
 * The names ONE write may have moved, as cache keys.
 *
 * A write is not a reason to read the whole tree again. An agent writing twenty times in a
 * row would re-read every objective, every brief and every spec twenty times for changes
 * it made to one of them. So a write forgets the entity its own arguments name, and that
 * entity alone: a brief drops its list of specs with it, an objective its chain and its key
 * results. A write that names nothing this copy is drawing forgets nothing at all.
 *
 * A write on a child names its parent. A phase is found among the phases drawn, and names
 * the spec that holds it; a key result among the key results drawn, and names the leaf
 * objective they hang from. A child that cannot be found — a phase of a spec whose phases
 * were never read, a risk or an acceptance test, which the pane draws nowhere — costs what
 * is in hand and nothing more: every held spec, or every leaf objective.
 *
 * @param {Tree[]} trees
 * @param {{ kind: string, id: number } | null} touched
 * @param {(kind: string, id: number) => string} keyOf
 * @returns {string[]}
 */
export function namesTouched(trees, touched, keyOf) {
  if (touched === null) return [];
  const { kind, id } = touched;

  /** The keys of every spec this copy holds: what an unresolved child of a spec costs. */
  const heldSpecs = () => trees.flatMap((tree) => tree.specs.map((spec) => keyOf("spec", spec.id)));

  /** The keys of the leaf an objective's key results are read under. */
  const leafOf = (tree) => {
    const leaf = tree.chain[tree.chain.length - 1];
    return leaf ? [keyOf("objective", leaf.id), keyOf("children", leaf.id)] : [];
  };

  if (kind === "spec") {
    const drawn = trees.some(
      (tree) => tree.specs.some((spec) => spec.id === id) || tree.siblings.some((sibling) => sibling.id === id),
    );
    return drawn ? [keyOf("spec", id)] : [];
  }

  // The id names the phase, never the spec that holds it: the one to forget is the spec the
  // phase was drawn under, and it is found by looking rather than by guessing.
  if (kind === "phase") {
    for (const tree of trees) {
      for (const spec of [...tree.specs, ...tree.siblings]) {
        const phases = Array.isArray(spec.phases) ? spec.phases : [];
        if (phases.some((phase) => phase.id === id)) return [keyOf("spec", spec.id)];
      }
    }
    return heldSpecs();
  }

  // A risk or an acceptance test is a child of a spec the pane never draws, so nothing on
  // screen says which spec: the held ones are the only candidates worth a read.
  if (kind === "risk" || kind === "test") return heldSpecs();

  if (kind === "brief") {
    const drawn = trees.some((tree) => tree.brief?.id === id);
    return drawn ? [keyOf("brief", id), keyOf("briefSpecs", id)] : [];
  }

  // A chain is read under its leaf, whichever node of it moved: a renamed or re-parented
  // objective halfway up forgets the chain of every tree it is drawn in.
  if (kind === "objective") {
    const keys = new Set();
    for (const tree of trees) {
      if (!tree.chain.some((node) => node.id === id)) continue;
      keys.add(keyOf("chain", tree.chain[tree.chain.length - 1].id));
      keys.add(keyOf("objective", id));
      keys.add(keyOf("children", id));
    }
    return [...keys];
  }

  // The id names the key result, never its objective: the one to forget is the leaf it was
  // drawn under, and where none drew it, every leaf — a check-in is what a key result is
  // read for, and it must show.
  if (kind === "keyResult") {
    const drawnUnder = trees.filter((tree) => tree.keyResults.some((kr) => kr.id === id));
    const owners = drawnUnder.length > 0 ? drawnUnder : trees;
    return [...new Set(owners.flatMap(leafOf))];
  }

  return [];
}

/** @param {unknown} error */
function messageOf(error) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return message.trim() === "" ? "lecture refusée" : message.trim();
}
