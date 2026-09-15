#!/usr/bin/env node
// check-where — the pane beside the transcript draws the right tree, from either workspace.
//
// `claude plugin test` does not exist in the installed Claude Code (2.1.272), so the kit
// `claude-code/testing` is out of reach here: everything the pane decides therefore lives
// in plain functions, and this is where they are played. What is left in `register.ts` is
// the binding itself — the hooks, the timers, the open and the close — and that half is
// proved by a session and a screenshot, not here.
//
//   node scripts/check-where.mjs
//
// No network, no Claude Code, no filesystem: the workspaces are the real answers captured
// in `where-fixtures.mjs`, and the store is a Map.

import {
  backOfficeBrief,
  backOfficeChain,
  backOfficeObjective,
  backOfficeSpec,
  galyBrief,
  galyChain,
  galyChildren,
  galyShapedBrief,
  galyShapedChain,
  galyShapedObjective,
  galyShapedSpec,
  galyShapedSpecList,
  galySpec,
  galySpecList,
} from "./where-fixtures.mjs";

import { HORIZON_MS, MARKS, TOO_LARGE_TEXT } from "../galy/hooks/where/names.mjs";
import { heldOf, holdsSomething, joinPath, parentOf, workingCopyRootOf } from "../galy/hooks/where/work-file.mjs";
import { payloadOf, readerOf, serverOf, serversOf } from "../galy/hooks/where/reader.mjs";
import { buildModel, namesToForget } from "../galy/hooks/where/tree.mjs";
import { dockRows, hrefOf, inlineRows, phaseLineText, plainOf, titleText } from "../galy/hooks/where/render.mjs";

let failed = 0;
function check(what, condition, detail) {
  if (condition) return;
  console.error(`✗ ${what}${detail === undefined ? "" : `\n    ${detail}`}`);
  failed += 1;
}

const NOW = Date.parse("2026-09-15T12:00:00Z");
const justNow = (minutesAgo = 0) => new Date(NOW - minutesAgo * 60_000).toISOString();

// ── The two spellings, as each workspace really wants them ────────────────
const WANTS = {
  contract: {
    feature_spec_get: "specId",
    feature_brief_get: "briefId",
    feature_spec_list: "briefId",
    strategy_get_objective_breadcrumb: "objectiveId",
    strategy_get_objective: "objectiveId",
    strategy_navigate_children: "objectiveId",
  },
  galy: {
    feature_spec_get: "id",
    feature_brief_get: "id",
    feature_spec_list: "feature_brief_id",
    strategy_get_objective_breadcrumb: "objective_id",
    strategy_get_objective: "id",
    strategy_navigate_children: "parent_objective_id",
  },
};

/**
 * A workspace on the bench: it answers the verbs it serves, in the spelling it wants, and
 * refuses every other spelling the way a server refuses an argument it does not declare.
 */
function workspace({ spelling, answers, fail = {} }) {
  const calls = [];
  const store = new Map();
  const host = {
    call: async (server, tool, args) => {
      calls.push({ server, tool, args });
      if (fail[tool]) throw new Error(fail[tool]);
      const wanted = WANTS[spelling][tool];
      if (wanted === undefined || !(wanted in args)) {
        throw new Error(`${tool} n'accepte pas ${Object.keys(args).join(", ")}`);
      }
      const answer = answers[tool];
      if (answer === undefined) throw new Error(`${tool} : outil inconnu`);
      return answer;
    },
    storeGet: async (key) => store.get(key),
    // A JSON store, as the engine's is: a value it cannot write is a key it leaves alone.
    storeSet: async (key, value) => void (value === undefined ? undefined : store.set(key, value)),
    storeDelete: async (key) => void store.delete(key),
    now: async () => NOW,
    has: (_server, tool) => answers[tool] !== undefined,
  };
  return { calls, store, reader: readerOf(host) };
}

const modelOf = async (bench, held, server = "ws") =>
  buildModel({
    held,
    read: (name, kind, id, wanted) => bench.reader.read(name, kind, id, wanted),
    serves: (name, tool) => bench.reader.serves(name, tool),
    serverFor: (named) => named ?? server,
  });

const BACK_OFFICE = {
  feature_spec_get: backOfficeSpec,
  feature_brief_get: backOfficeBrief,
  strategy_get_objective_breadcrumb: backOfficeChain,
  strategy_get_objective: backOfficeObjective,
};
const GALY_SHAPED = {
  feature_spec_get: galyShapedSpec,
  feature_brief_get: galyShapedBrief,
  feature_spec_list: galyShapedSpecList,
  strategy_get_objective_breadcrumb: galyShapedChain,
  strategy_navigate_children: galyShapedObjective,
};

const held1109 = { specs: [{ id: 1109, at: NOW - 60_000, server: "back-office" }], briefs: [] };

// ── 1. What the copy has in hand, read from its own file ──────────────────
{
  const file = JSON.stringify({
    specs: [
      { id: 11, at: justNow(30), server: "back-office" },
      { id: 9, at: justNow(5), server: "bg" },
      { id: 7, at: new Date(NOW - HORIZON_MS - 1000).toISOString() },
    ],
    briefs: [{ id: 32, at: justNow(2) }],
  });
  const held = heldOf(file, NOW);
  check("the newest claim comes first", held.specs.map((entry) => entry.id).join() === "9,11");
  check("work older than the horizon is no longer in hand", !held.specs.some((entry) => entry.id === 7));
  check("the server a claim went through is read back", held.specs[0].server === "bg");
  check("an entry written without one reads as no server", held.briefs[0].server === null);
  check("a malformed file is nothing in hand, never an error", !holdsSomething(heldOf("{ not json", NOW)));
  check("and so is an empty one", !holdsSomething(heldOf(JSON.stringify({ specs: [], briefs: [] }), NOW)));
}

// ── 2. The root of a working copy, worktree and Windows included (P2/T11) ─
{
  const roots = new Set(["C:\\VisualStudioOnline\\wt-10\\.git", "/home/dev/repo/.git"]);
  const exists = async (path) => roots.has(path);
  check("a worktree under Windows is found by its .git file",
    (await workingCopyRootOf("C:\\VisualStudioOnline\\wt-10\\galy\\hooks", exists)) === "C:\\VisualStudioOnline\\wt-10");
  check("and a checkout under a POSIX path too",
    (await workingCopyRootOf("/home/dev/repo/src/deep", exists)) === "/home/dev/repo");
  check("outside any repository the climb answers nothing",
    (await workingCopyRootOf("C:\\elsewhere\\here", exists)) === null);
  check("the climb stops at the drive rather than spinning",
    parentOf("C:\\") === null || parentOf("C:\\") === "C:\\");
  check("a path is joined in the separator it already uses",
    joinPath("C:\\wt", ".bg", "work.json") === "C:\\wt\\.bg\\work.json");
}

// ── 3. An MCP answer, and a refusal that says why ─────────────────────────
{
  const envelope = { content: [{ type: "text", text: JSON.stringify({ success: true, spec: { id: 4 } }) }], isError: false };
  check("the payload is the text block's JSON", payloadOf(envelope).spec.id === 4);
  let refusal = null;
  try {
    payloadOf({ content: [{ type: "text", text: JSON.stringify({ success: false, error: "spec_not_found" }) }], isError: false });
  } catch (error) {
    refusal = error.message;
  }
  check("a refused read is an error naming the refusal", refusal === "spec_not_found", refusal);
  let broken = null;
  try {
    payloadOf({ content: [{ type: "text", text: "boom" }], isError: true });
  } catch (error) {
    broken = error.message;
  }
  check("and an errored call is an error too", broken === "boom", broken);

  // The failure this one exists for: an answer that is not JSON — a message where an
  // object was expected, or a large one the harness cut on the way. Read as an empty
  // record it draws a branch with a number, no name and no reason; so it is an error.
  let unreadable = null;
  try {
    payloadOf({ content: [{ type: "text", text: '{"success":true,"spec":{"Id":2055,"Title":"Poser l' }], isError: false });
  } catch (error) {
    unreadable = error.message;
  }
  check("an answer that does not parse is an error naming what came back",
    unreadable !== null && unreadable.startsWith("réponse illisible : {\"success\":true"), unreadable);

  let empty = null;
  try {
    payloadOf({ content: [], isError: false });
  } catch (error) {
    empty = error.message;
  }
  check("and an answer with nothing in it is one too", empty === "réponse vide", empty);

  // Claude Code caps what an MCP call may answer and replaces a longer result with a
  // notice of its own. Measured on the back office's spec 2055, whose body runs to some
  // sixty thousand characters. It is neither the workspace's fault nor the pane's, and it
  // is named as itself rather than pasted into the middle of a strategy tree.
  let capped = null;
  try {
    payloadOf({
      content: [{ type: "text", text: "Error: result (61 872 characters across 1 line) exceeds maximum allowed tokens. Output has been saved to …" }],
      isError: false,
    });
  } catch (error) {
    capped = error.message;
  }
  check("an answer the harness capped is named as what it is", capped === TOO_LARGE_TEXT, capped);
}

// ── 4. The same tree from both spellings (P2/T2) ──────────────────────────
let backOfficeRows;
{
  const backOffice = workspace({ spelling: "contract", answers: BACK_OFFICE });
  const galyStyle = workspace({ spelling: "galy", answers: GALY_SHAPED });

  const one = await modelOf(backOffice, held1109);
  const two = await modelOf(galyStyle, held1109);

  backOfficeRows = plainOf(dockRows(one, { columns: 96 }));
  const otherRows = plainOf(dockRows(two, { columns: 96 }));
  check("the two workspaces draw the same tree", backOfficeRows.join("\n") === otherRows.join("\n"),
    `${backOfficeRows.join("\n")}\n---\n${otherRows.join("\n")}`);

  const text = backOfficeRows.join("\n");
  check("the period opens the tree", backOfficeRows[0] === "T2 2026 · 2026", backOfficeRows[0]);
  check("the chain runs from the root to the leaf", text.includes("◆ Susciter le désir pour la marque") && text.includes("└ ◆ Le MMM arbitre les enchères entre les canaux"));
  check("the brief is named under its objective", text.includes("▸ Brief : MMM — moteur d'allocation & application des recos  [InProgress]"));
  check("the spec in hand is marked, its status and its mark on the same row",
    text.includes("● Spec : Split canal × pays dans le fit Meridian — priors…  [InProgress]  ← en main"), text);
  check("its phases are counted", text.includes("1/2"));
  check("three sibling specs are drawn and the rest counted",
    text.includes("… et 2 de plus") && text.split("\n").filter((row) => row.includes("MCP gel/dégel")).length === 1, text);
  check("a refresh button closes the pane", backOfficeRows[backOfficeRows.length - 1] === "rafraîchir");
}

// ── 5. A refused spelling is tried the other way, once (P2/T2b) ───────────
{
  const galyStyle = workspace({ spelling: "galy", answers: GALY_SHAPED });
  await modelOf(galyStyle, held1109);
  const specCalls = galyStyle.calls.filter((call) => call.tool === "feature_spec_get");
  check("the contract's spelling is tried first, then the workspace's",
    specCalls.length === 2 && "specId" in specCalls[0].args && "id" in specCalls[1].args,
    JSON.stringify(specCalls.map((call) => call.args)));
  const briefCalls = galyStyle.calls.filter((call) => call.tool === "feature_brief_get");
  check("once a server has answered, the rest of the reads use its spelling",
    briefCalls.length === 1 && "id" in briefCalls[0].args, JSON.stringify(briefCalls.map((call) => call.args)));
  check("and the spelling is kept for the next session", galyStyle.store.get("spelling/back-office") === "galy");
}

// ── 6. A brief that serves no objective (P2/T3) ───────────────────────────
{
  const galyReal = workspace({
    spelling: "galy",
    answers: {
      feature_spec_get: galySpec,
      feature_brief_get: galyBrief,
      feature_spec_list: galySpecList,
      strategy_get_objective_breadcrumb: galyChain,
      strategy_navigate_children: galyChildren,
    },
  });
  const model = await modelOf(galyReal, { specs: [{ id: 54, at: NOW, server: "bg" }], briefs: [] });
  const rows = plainOf(dockRows(model, { columns: 96 }));
  check("a brief outside the strategy says so rather than drawing a chain",
    rows.includes("brief hors stratégie"), rows.join("\n"));
  check("the tree still names the brief and the spec in hand",
    rows.some((row) => row.includes("▸ Brief : La ligne sous le prompt dit sur quoi cette copie travaille")) &&
      rows.some((row) => row.includes("Spec : Le panneau à droite")), rows.join("\n"));
  check("its three phases are counted", rows.some((row) => row.includes("0/3")), rows.join("\n"));
  check("nothing is reported as a gap", model.trees[0].gaps.length === 0, JSON.stringify(model.trees[0].gaps));
  check("a spec listed apart is not drawn as its own sibling", model.trees[0].siblings.length === 0);
}

// ── 7. A read that fails leaves a gap, and the rest is drawn (P2/T4) ──────
{
  const partial = workspace({
    spelling: "contract",
    answers: BACK_OFFICE,
    fail: { strategy_get_objective_breadcrumb: "objective_not_found" },
  });
  const model = await modelOf(partial, held1109);
  const rows = plainOf(dockRows(model, { columns: 96 }));
  check("the failed read is named where it failed",
    rows.some((row) => row.includes("? objectif 178 : objective_not_found")), rows.join("\n"));
  check("the brief and the spec are still drawn",
    rows.some((row) => row.includes("▸ Brief :")) && rows.some((row) => row.includes("← en main")), rows.join("\n"));
}

// ── 8. Ten drawings, one read per entity (P2/T7) ──────────────────────────
{
  const bench = workspace({ spelling: "contract", answers: BACK_OFFICE });
  for (let turn = 0; turn < 10; turn += 1) await modelOf(bench, held1109);
  const reads = bench.calls.filter((call) => call.tool === "feature_spec_get").length;
  check("a spec is read once however often the pane is drawn", reads === 1, `${reads} reads`);
  check("and so is everything else", bench.calls.length === 4, JSON.stringify(bench.calls.map((call) => call.tool)));

  const together = workspace({ spelling: "contract", answers: BACK_OFFICE });
  await Promise.all([modelOf(together, held1109), modelOf(together, held1109), modelOf(together, held1109)]);
  check("three drawings at once make one read each",
    together.calls.filter((call) => call.tool === "feature_spec_get").length === 1,
    JSON.stringify(together.calls.map((call) => call.tool)));
}

// ── 9. The key results of the leaf objective (P3/T1) ──────────────────────
{
  const bench = workspace({ spelling: "contract", answers: BACK_OFFICE });
  const model = await modelOf(bench, held1109);
  const rows = dockRows(model, { columns: 96 });
  const krRows = rows.filter((row) => row.key.includes("-kr-"));
  check("both key results are drawn", krRows.length === 2, JSON.stringify(plainOf(krRows)));
  const measured = plainOf([krRows[0]])[0];
  const unmeasured = plainOf([krRows[1]])[0];
  check("a measured one shows its figures and its progress",
    measured.includes("200 reprises presse · 141 / 200 par an (71 %)"), measured);
  check("one nobody has measured shows no progress",
    !unmeasured.includes("%") && unmeasured.includes("cible 6"), unmeasured);
  check("and it is drawn dim", krRows[1].segments.some((segment) => segment.dim && segment.text.includes("Contrôles MMM")));
}

// ── 10. Phases: their names while they fit, their marks when they do not (P3/T2)
{
  const five = [
    { title: "Le socle du moteur d'allocation par cellule", status: "Done" },
    { title: "La bascule sur le worker de production", status: "Done" },
    { title: "La fenêtre du lundi et son ordonnancement", status: "InProgress" },
    { title: "Le verdict d'acceptance contre l'expérience", status: "NotStarted" },
    { title: "Le nettoyage du code laissé derrière", status: null },
  ];
  check("narrow, the phases are marks and a count", phaseLineText(five, 40) === "✓ ✓ ● ○ ○  2/5", phaseLineText(five, 40));
  check("wide, they carry their names", phaseLineText(five, 300).startsWith("✓ Le socle du moteur"), phaseLineText(five, 300));
  check("no phase, no row", phaseLineText([], 80) === "");
  check("an unknown status is drawn as still to do", MARKS.other === "○");
}

// ── 11. A sibling unfolds, and folds again (P3/T3) ────────────────────────
{
  const bench = workspace({ spelling: "contract", answers: BACK_OFFICE });
  const model = await modelOf(bench, held1109);
  const folded = plainOf(dockRows(model, { columns: 96 }));
  const sibling = model.trees[0].siblings[0];
  sibling.phases = [{ title: "Le gel manuel", status: "Done" }];
  const unfolded = plainOf(dockRows(model, { columns: 96, expanded: { [sibling.id]: true } }));
  check("folded, a sibling is one row", !folded.some((row) => row.includes("Le gel manuel")));
  check("unfolded, its phases appear under it",
    unfolded.some((row) => row.includes("Le gel manuel")) && unfolded.length === folded.length + 1, unfolded.join("\n"));
  check("a sibling row can be pressed",
    dockRows(model, { columns: 96 }).some((row) => row.press?.kind === "sibling" && row.press.id === sibling.id));
}

// ── 12. Several specs in hand, the newest first (P3/T4) ───────────────────
{
  const bench = workspace({
    spelling: "galy",
    answers: {
      feature_spec_get: galySpec,
      feature_brief_get: galyBrief,
      feature_spec_list: galySpecList,
    },
  });
  const model = await modelOf(bench, {
    specs: [
      { id: 54, at: NOW - 1000, server: "bg" },
      { id: 53, at: NOW - 900_000, server: "bg" },
    ],
    briefs: [],
  });
  check("one subtree per spec in hand", model.trees.length === 2, String(model.trees.length));
  check("the newest is drawn first", model.trees[0].key === "spec-54", model.trees[0].key);
  const rows = plainOf(dockRows(model, { columns: 96 }));
  check("a blank row separates them", rows.some((row) => row === ""), rows.join("\n"));
}

// ── 13. Nothing in hand (P2/T5) ───────────────────────────────────────────
{
  const bench = workspace({ spelling: "contract", answers: BACK_OFFICE });
  const model = await modelOf(bench, { specs: [], briefs: [] });
  check("nothing in hand reads as empty", model.status === "empty");
  check("nothing was asked of the workspace", bench.calls.length === 0);
  const rows = plainOf(dockRows(model, { columns: 96 }));
  check("and the pane says what would fill it",
    rows.length === 1 && rows[0] === "Rien en main. Réclamer ou créer une spec la fera apparaître ici.", rows.join("\n"));
  const loading = plainOf(dockRows(model, { columns: 96, isLoading: true }));
  check("while it reads, it says that instead", loading[0] === "Lecture de l'espace de travail…", loading[0]);
}

// ── 14. The inline summary, eight rows at the very most (P2/T9) ───────────
{
  const bench = workspace({ spelling: "contract", answers: BACK_OFFICE });
  const model = await modelOf(bench, {
    specs: [
      { id: 1109, at: NOW - 1000, server: "back-office" },
      { id: 1107, at: NOW - 2000, server: "back-office" },
      { id: 1105, at: NOW - 3000, server: "back-office" },
      { id: 1141, at: NOW - 4000, server: "back-office" },
      { id: 1149, at: NOW - 5000, server: "back-office" },
      { id: 1151, at: NOW - 6000, server: "back-office" },
    ],
    briefs: [],
  });
  const rows = inlineRows(model, { columns: 80 });
  check("the inline summary never runs past eight rows", rows.length <= 8, String(rows.length));
  const text = plainOf(rows).join("\n");
  check("it opens on the leaf objective", text.startsWith("◆ Le MMM arbitre les enchères entre les canaux"), text);
  check("then the brief, the spec and its phases",
    text.includes("▸ MMM — moteur") && text.includes("Split canal") && text.includes("1/2"), text);
  check("nothing in hand says so inline too",
    plainOf(inlineRows({ status: "empty", trees: [], gaps: [] }, { columns: 80 }))[0].startsWith("Rien en main"));
}

// ── 15. A title is cut, never wrapped ─────────────────────────────────────
{
  check("a title longer than the room left is cut with an ellipsis",
    titleText("Le panneau à droite du plein écran", 12) === "Le panneau…", titleText("Le panneau à droite du plein écran", 12));
  check("a title that fits is left alone", titleText("Le socle", 20) === "Le socle");
  check("a spec with no name yet is its number", titleText(null, 20, 41) === "#41");

  const bench = workspace({ spelling: "contract", answers: BACK_OFFICE });
  const model = await modelOf(bench, held1109);
  for (const columns of [40, 60, 110, 200]) {
    const rows = plainOf(dockRows(model, { columns }));
    const widest = Math.max(...rows.map((row) => [...row].length));
    check(`no row runs past the ${columns} columns it was given`, widest <= columns, `${widest} > ${columns}`);
  }
}

// ── 16. The first refusal is the one reported ─────────────────────────────
{
  // A server that wants the other spelling refuses the first attempt for a reason of its
  // own; a server that wants THIS one refuses for the real reason, and the fallback then
  // complains about a missing argument. Reporting the last one hides the first every time.
  const store = new Map();
  const reader = readerOf({
    call: async (_server, _tool, args) => {
      if ("specId" in args) throw new Error(TOO_LARGE_TEXT);
      throw new Error("The arguments dictionary is missing a value for the required parameter 'specId'.");
    },
    storeGet: async (key) => store.get(key),
    storeSet: async (key, value) => void store.set(key, value),
    now: async () => NOW,
  });
  let reported = null;
  try {
    await reader.read("back-office", "spec", 2055);
  } catch (error) {
    reported = error.message;
  }
  check("the failure reported is the first one, not the fallback's complaint",
    reported === TOO_LARGE_TEXT, reported);
}

// ── 17. A read that never comes back is a gap, not a wait ─────────────────
{
  const store = new Map();
  const timers = [];
  const slow = readerOf({
    call: () => new Promise(() => {}),
    storeGet: async (key) => store.get(key),
    storeSet: async (key, value) => void store.set(key, value),
    now: async () => NOW,
    after: (ms, fn) => {
      const handle = setTimeout(fn, ms);
      timers.push(handle);
      return { cancel: () => clearTimeout(handle) };
    },
    deadlineMs: 20,
  });
  let refused = null;
  try {
    await slow.read("ws", "spec", 2055);
  } catch (error) {
    refused = error.message;
  }
  for (const handle of timers) clearTimeout(handle);
  check("a call that never answers becomes a named gap rather than a pane stuck on reading",
    refused === "lecture trop longue", refused);
}

// ── 18. Which server a claim is asked of ──────────────────────────────────
{
  const tools = [
    { name: "Read", mcp: false },
    { name: "mcp__back-office__feature_spec_get", mcp: true },
    { name: "mcp__back-office__feature_brief_get", mcp: true },
  ];
  check("a claim that names its server is asked of that one", serverOf("bg", tools) === "bg");
  check("one that names none falls back on the workspace that serves the contract",
    serverOf(null, tools) === "back-office");
  check("and where nothing serves it, on nothing at all", serverOf(null, [{ name: "Read", mcp: false }]) === null);
  check("every workspace of the session is known", serversOf(tools).join() === "back-office");
}

// ── 19. A write forgets what it touched (P1/T1) ───────────────────────────
{
  // Measured on 15 September 2026: `feature_brief_update(61, objective_id: 9)` during a
  // session, and the pane went on drawing `brief hors stratégie` for the three minutes a
  // name is kept — until somebody pressed « rafraîchir ». The write forgets the names the
  // drawn trees were built from, and the refresh that follows reads them again; the button
  // forgets the same list, because it is the same list.
  const answers = {
    feature_spec_get: galySpec,
    feature_brief_get: galyBrief,
    feature_spec_list: galySpecList,
    strategy_get_objective_breadcrumb: galyChain,
    strategy_navigate_children: galyChildren,
  };
  const bench = workspace({ spelling: "galy", answers });
  const held = { specs: [{ id: 54, at: NOW, server: "bg" }], briefs: [] };

  const before = plainOf(dockRows(await modelOf(bench, held), { columns: 96 }));
  check("a brief attached to nothing reads as outside the strategy", before.includes("brief hors stratégie"));

  // The write itself: the brief now serves objective 8.
  answers.feature_brief_get = { ...galyBrief, brief: { ...galyBrief.brief, objective_id: 8 } };

  const stale = plainOf(dockRows(await modelOf(bench, held), { columns: 96 }));
  check("a drawing that forgets nothing keeps the answer from before the write",
    stale.includes("brief hors stratégie"), stale.join("\n"));

  const drawn = await modelOf(bench, held);
  await bench.reader.forget(namesToForget(drawn.trees, (kind, id) => bench.reader.cacheKeyOf("bg", kind, id)));

  const after = plainOf(dockRows(await modelOf(bench, held), { columns: 96 }));
  check("once the write has forgotten its names, the objective is drawn with nothing pressed",
    !after.includes("brief hors stratégie") && after.some((row) => row.includes("Recette du poste")), after.join("\n"));
}

// ── 20. An address the engine would refuse is drawn as text (P3/T1) ───────
{
  const GALY = "https://benoit.galy.cloud/specs/56";
  check("an https address is kept as the engine spells it", hrefOf(GALY) === GALY, String(hrefOf(GALY)));
  check("and so is the back office's",
    hrefOf("https://back.green-acres.com/fr/Product/FeatureSpec/Detail/1109") ===
      "https://back.green-acres.com/fr/Product/FeatureSpec/Detail/1109");
  check("a workspace served from this machine is an address too",
    hrefOf("http://localhost:5173/specs/56") === "http://localhost:5173/specs/56");
  check("no address at all is no link", hrefOf(undefined) === null && hrefOf("") === null && hrefOf(12) === null);
  check("plain http elsewhere is refused", hrefOf("http://back.green-acres.com/specs/56") === null);
  check("and so is a scheme that is not the web", hrefOf("javascript:alert(1)") === null);
  check("a host with a user in front of it is refused", hrefOf("https://user@galy.cloud/specs/56") === null);
  check("a raw @ anywhere is refused", hrefOf("https://galy.cloud/specs/@56") === null);
  check("something that is not an address at all is refused", hrefOf("back.green-acres.com/specs/56") === null);
  check("past 2048 characters it is refused", hrefOf(`https://galy.cloud/${"a".repeat(2100)}`) === null);
  // The engine's own declaration says to encode a space and a non-ASCII letter rather than
  // refuse them, and `new URL(href).href` is the spelling it asks for: so they become an
  // address a person can click, not a row that lost its link on the way.
  check("an accent is encoded rather than dropped",
    hrefOf("https://galy.cloud/specs/été") === "https://galy.cloud/specs/%C3%A9t%C3%A9", String(hrefOf("https://galy.cloud/specs/été")));
  check("and so is a space", hrefOf("https://galy.cloud/specs/56 bis") === "https://galy.cloud/specs/56%20bis");
}

// ── 21. The rows of a workspace that serves its addresses (P3/T2) ─────────
{
  // No workspace serves `url` yet, so this is the answer one is about to serve: the back
  // office's own, PascalCase on the feature verbs and snake_case on the strategy ones, with
  // an address on the spec, on the brief, on the objectives — and a broken one on the root,
  // which must cost that row its link and nothing else.
  const BO = "https://back.green-acres.com";
  const withUrl = {
    feature_spec_get: { success: true, spec: { ...backOfficeSpec.spec, Url: `${BO}/fr/Product/FeatureSpec/Detail/1109` } },
    feature_brief_get: {
      success: true,
      brief: {
        ...backOfficeBrief.brief,
        Url: `${BO}/fr/Product/FeatureBrief/Detail/135`,
        Specs: backOfficeBrief.brief.Specs.map((spec) => ({ ...spec, Url: `${BO}/fr/Product/FeatureSpec/Detail/${spec.Id}` })),
      },
    },
    strategy_get_objective_breadcrumb: {
      success: true,
      objective_id: 178,
      // The root's address is one the engine would refuse; the leaf's is served by the
      // objective itself rather than by the chain.
      chain: backOfficeChain.chain.map((node, index) => ({
        ...node,
        url: index === 0 ? "http://back.green-acres.com/fr/Strategy/Objective/Detail/5" : `${BO}/fr/Strategy/Objective/Detail/${node.id}`,
        ...(index === backOfficeChain.chain.length - 1 ? { url: undefined } : {}),
      })),
    },
    strategy_get_objective: {
      success: true,
      objective: { ...backOfficeObjective.objective, url: `${BO}/fr/Strategy/Objective/Detail/178` },
    },
  };

  const bench = workspace({ spelling: "contract", answers: withUrl });
  const model = await modelOf(bench, held1109);
  const rows = dockRows(model, { columns: 96 });
  const linkOf = (key) => rows.find((row) => row.key.includes(key))?.segments.find((segment) => segment.url)?.url;

  check("the spec in hand opens its own page",
    linkOf("-spec") === `${BO}/fr/Product/FeatureSpec/Detail/1109`, String(linkOf("-spec")));
  check("the brief opens its own", linkOf("-brief") === `${BO}/fr/Product/FeatureBrief/Detail/135`, String(linkOf("-brief")));
  check("an objective of the chain opens its own", linkOf("-obj-9") === `${BO}/fr/Strategy/Objective/Detail/9`, String(linkOf("-obj-9")));
  check("the leaf takes the address the objective itself served",
    linkOf("-obj-178") === `${BO}/fr/Strategy/Objective/Detail/178`, String(linkOf("-obj-178")));
  check("a row whose address the engine would refuse keeps its text and loses its link",
    linkOf("-obj-5") === undefined && plainOf(rows).some((row) => row.includes("◆ Susciter le désir pour la marque")),
    String(linkOf("-obj-5")));
  check("a key result has no page of its own to open", linkOf("-kr-0") === undefined);

  // A sibling is a Button, and a Button is a leaf on every surface: no element goes inside
  // it. It keeps the press that unfolds its phases and takes no link.
  const sibling = rows.find((row) => row.press?.kind === "sibling");
  check("a sibling keeps its press and takes no link",
    sibling !== undefined && sibling.segments.every((segment) => segment.url === undefined),
    JSON.stringify(sibling?.segments));

  const inline = inlineRows(model, { columns: 96 });
  check("the summary above the prompt is linked the same way",
    inline.find((row) => row.key === "inline-spec")?.segments.some((segment) => segment.url === `${BO}/fr/Product/FeatureSpec/Detail/1109`),
    JSON.stringify(inline.find((row) => row.key === "inline-spec")?.segments));

  // The same tree from a workspace serving no address: the rows are what they always were.
  const plain = workspace({ spelling: "contract", answers: BACK_OFFICE });
  const plainRows = dockRows(await modelOf(plain, held1109), { columns: 96 });
  check("a workspace that serves none draws exactly the rows it drew before",
    plainRows.every((row) => row.segments.every((segment) => segment.url === undefined)) &&
      plainOf(plainRows).join("\n") === backOfficeRows.join("\n"), plainOf(plainRows).join("\n"));
}

// ── 22. Forgetting a name is its own verb ─────────────────────────────────
{
  // The store holds JSON, so `set(key, undefined)` writes nothing and leaves the key
  // exactly where it was. Read back, the pane served the name it had just been told to
  // forget — which is what made a write invisible for the three minutes a name is kept,
  // and « rafraîchir » a button that redrew the same thing.
  const jsonStore = new Map();
  let answered = 0;
  const reader = readerOf({
    call: async () => {
      answered += 1;
      return { success: true, spec: { id: 54, title: `lecture ${answered}` } };
    },
    storeGet: async (key) => jsonStore.get(key),
    storeSet: async (key, value) => void (value === undefined ? undefined : jsonStore.set(key, value)),
    storeDelete: async (key) => void jsonStore.delete(key),
    now: async () => NOW,
  });

  const first = await reader.read("ws", "spec", 54);
  check("a name is kept after the first read", jsonStore.size === 1, String(jsonStore.size));

  await reader.forget([reader.cacheKeyOf("ws", "spec", 54)]);
  check("forgetting drops the key rather than writing over it", jsonStore.size === 0,
    JSON.stringify([...jsonStore.keys()]));

  const second = await reader.read("ws", "spec", 54);
  check("so the next read asks the workspace again",
    first.title === "lecture 1" && second.title === "lecture 2", `${first.title}, then ${second.title}`);
}

if (failed) {
  console.error(`\n${failed} check(s) failed.`);
  process.exit(1);
}
console.log("✓ the pane draws this copy's own strategy tree — both workspaces, both spellings, one read per name.");
