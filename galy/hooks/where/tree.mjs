// From what the copy has in hand to the tree the pane draws.
//
// One subtree per piece of work, newest first: the objective chain the brief serves, the
// brief, the spec in hand with its phases, and the brief's other specs. A brief held on
// its own — one nobody has written a spec for yet — is a subtree of its own, stopping at
// the brief. A brief with no objective stops there too, and says so rather than drawing a
// chain it does not have.
//
// Every read is handed in, so this file never talks to anything: a failed read becomes a
// named gap in the tree, and the rest is still drawn.

/**
 * @typedef {import('./reader.mjs').Named} Named
 * @typedef {{
 *   key: string,
 *   chain: Array<{ id: number, title: string | null, period: string | null }>,
 *   periods: string[],
 *   keyResults: Array<{ title: string | null, current: number | null, target: number | null, unit: string | null, progress: number | null }>,
 *   outsideStrategy: boolean,
 *   brief: any,
 *   spec: any,
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
  const briefsDrawn = new Set();

  for (const entry of held.specs) {
    const server = serverFor(entry.server);
    if (server === null) {
      gaps.push("aucun espace de travail ne répond ici");
      continue;
    }
    /** @type {Tree} */
    const tree = {
      key: `spec-${entry.id}`,
      chain: [],
      periods: [],
      keyResults: [],
      outsideStrategy: false,
      brief: null,
      spec: { id: entry.id, title: null, status: null, phases: [] },
      siblings: [],
      gaps: [],
    };

    let spec = null;
    try {
      spec = await read(server, "spec", entry.id);
      tree.spec = { ...spec, id: spec.id || entry.id };
    } catch (error) {
      tree.gaps.push(`spec ${entry.id} : ${messageOf(error)}`);
    }

    if (spec?.briefId) {
      briefsDrawn.add(spec.briefId);
      await fillBrief(tree, server, spec.briefId, entry.id);
    }
    trees.push(tree);
  }

  for (const entry of held.briefs) {
    if (briefsDrawn.has(entry.id)) continue;
    const server = serverFor(entry.server);
    if (server === null) {
      gaps.push("aucun espace de travail ne répond ici");
      continue;
    }
    briefsDrawn.add(entry.id);
    /** @type {Tree} */
    const tree = {
      key: `brief-${entry.id}`,
      chain: [],
      periods: [],
      keyResults: [],
      outsideStrategy: false,
      brief: { id: entry.id, title: null, status: null },
      spec: null,
      siblings: [],
      gaps: [],
    };
    await fillBrief(tree, server, entry.id, null);
    trees.push(tree);
  }

  /**
   * The brief, its objective chain, the leaf's key results, and the brief's other specs.
   *
   * @param {Tree} tree
   * @param {string} server
   * @param {number} briefId
   * @param {number | null} specInHand
   */
  async function fillBrief(tree, server, briefId, specInHand) {
    let brief = null;
    try {
      brief = await read(server, "brief", briefId);
      tree.brief = { id: brief.id || briefId, title: brief.title, status: brief.status };
    } catch (error) {
      tree.brief = { id: briefId, title: null, status: null };
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
    tree.siblings = (siblings ?? []).filter((sibling) => sibling.id !== specInHand);

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
      tree.chain = [{ id: brief.objectiveId, title: brief.objectiveTitle, period: null }];
    }
    tree.periods = periodsOf(tree.chain);

    const leaf = tree.chain[tree.chain.length - 1];
    const objectiveId = leaf?.id || brief.objectiveId;
    const parent = tree.chain[tree.chain.length - 2];
    try {
      if (serves(server, "strategy_get_objective")) {
        tree.keyResults = await read(server, "objective", objectiveId);
      } else if (parent && serves(server, "strategy_navigate_children")) {
        tree.keyResults = await read(server, "children", parent.id, objectiveId);
      }
    } catch (error) {
      tree.gaps.push(`résultats clés ${objectiveId} : ${messageOf(error)}`);
    }
  }

  return { status: trees.length === 0 ? "empty" : "ready", trees, gaps };
}

/** @param {unknown} error */
function messageOf(error) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return message.trim() === "" ? "lecture refusée" : message.trim();
}
