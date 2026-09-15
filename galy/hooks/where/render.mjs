// The drawing, decided here and only here.
//
// Every visual rule of the pane — the indentation of the chain, the mark of a status, what
// a title is cut to at a given width, what the inline summary keeps when it has eight rows
// — is a pure function of the model and the width. The views turn the rows below into
// elements and nothing else, so what a person sees can be read back in a test instead of
// on a screenshot.
//
// Whether a row opens its own page is decided here too: a segment carries the address its
// workspace served once it is one the engine would take, and carries nothing otherwise.

import {
  EMPTY_TEXT,
  IN_HAND_TEXT,
  INLINE_MAX_ROWS,
  LOADING_TEXT,
  MARKS,
  OUTSIDE_STRATEGY_TEXT,
  REFRESH_TEXT,
  SIBLINGS_SHOWN,
} from "./names.mjs";

/**
 * @typedef {{ text: string, bold?: boolean, dim?: boolean, url?: string }} Segment
 * @typedef {{ key: string, segments: Segment[], press?: { kind: string, id?: number } }} Row
 */

/** The mark a status is drawn with. */
export const markOf = (status) => MARKS[String(status ?? "")] ?? MARKS.other;

/** An address longer than this is refused by the engine, and with it the whole tree. */
const HREF_MAX = 2048;

/**
 * The address a row may be opened at, or null where there is none the engine would take.
 *
 * The bound is the engine's, not ours: a `Link` whose `href` is not an `https:` URL (or
 * `http://localhost`) of at most 2048 printable ASCII characters, with no `user@host` part,
 * no raw `@`, no space and no non-ASCII letter, refuses THE WHOLE TREE it sits in. One
 * workspace answering one bad address would blank the pane, so an address is checked here
 * and a row that fails the check is drawn as the text it has always been.
 *
 * @param {unknown} value
 * @returns {string | null}
 */
export function hrefOf(value) {
  const text = typeof value === "string" ? value.trim() : "";
  if (text === "" || text.length > HREF_MAX) return null;

  let parsed;
  try {
    parsed = new URL(text);
  } catch {
    return null;
  }

  const isLocal = parsed.protocol === "http:" && parsed.hostname === "localhost";
  if (parsed.protocol !== "https:" && !isLocal) return null;
  if (parsed.username !== "" || parsed.password !== "") return null;

  // `new URL(href).href` is the spelling the engine wants, so it is the one measured:
  // an accented path comes back percent-encoded, and is then within bounds.
  const href = parsed.href;
  if (href.length > HREF_MAX) return null;
  if (!/^[\x21-\x7E]+$/.test(href) || href.includes("@")) return null;

  return href;
}

/**
 * A title cut to the room left for it. A title is written for a page; here there is room
 * for a name, so what comes before the first break is kept, and cut with an ellipsis when
 * even that does not fit.
 *
 * @param {string | null} title
 * @param {number} width
 * @param {number | string} [fallbackId]
 */
export function titleText(title, width, fallbackId) {
  const whole = String(title ?? "").trim();
  const text = whole === "" ? (fallbackId === undefined ? "" : `#${fallbackId}`) : whole;
  if (width <= 0) return "";
  if (text.length <= width) return text;
  return `${text.slice(0, Math.max(1, width - 1)).trimEnd()}…`;
}

/** A number as a row shows it: whole when it is whole, two decimals at most otherwise. */
export function numberText(value) {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  if (Number.isInteger(value)) return String(value);
  return String(Math.round(value * 100) / 100);
}

/**
 * One key result, as its row reads.
 *
 * @param {{ title: string | null, current: number | null, target: number | null, unit: string | null, progress: number | null }} kr
 * @param {number} width
 * @returns {{ text: string, dim: boolean }}
 */
export function keyResultText(kr, width) {
  const measured = kr.current !== null;
  const figures = [];
  const current = numberText(kr.current);
  const target = numberText(kr.target);
  if (current !== null && target !== null) figures.push(`${current} / ${target}`);
  else if (current !== null) figures.push(current);
  else if (target !== null) figures.push(`cible ${target}`);
  if (kr.unit && figures.length > 0) figures.push(kr.unit);

  const percent = measured ? percentOf(kr) : null;
  if (percent !== null) figures.push(`(${percent} %)`);

  // Narrow, the progress goes before the unit, and the unit before the figures: what a
  // key result is read for is its name and how far along it is.
  let tail = figures.length > 0 ? ` · ${figures.join(" ")}` : "";
  while (figures.length > 1 && width - tail.length < 12) {
    figures.splice(figures.length - 1, 1);
    tail = ` · ${figures.join(" ")}`;
  }
  if (width - tail.length < 6) tail = "";

  return { text: fitText(`${titleText(kr.title, Math.max(4, width - tail.length), "?")}${tail}`, width), dim: !measured };
}

/** A line cut to the room it has, with an ellipsis where something was dropped. */
export function fitText(text, width) {
  if (width <= 0) return "";
  return text.length <= width ? text : `${text.slice(0, Math.max(1, width - 1)).trimEnd()}…`;
}

/** The progress a key result reports, or the one its two figures imply. */
function percentOf(kr) {
  if (kr.progress !== null && Number.isFinite(kr.progress)) return Math.round(kr.progress);
  if (kr.target === null || kr.current === null || kr.target === 0) return null;
  return Math.round((kr.current / kr.target) * 100);
}

/**
 * The phases of one spec on a single row: their marks and their names while they fit,
 * their marks alone when they do not, and always the count of those that are done.
 *
 * @param {Array<{ title: string | null, status: string | null }>} phases
 * @param {number} width
 */
export function phaseLineText(phases, width) {
  if (phases.length === 0) return "";
  const done = phases.filter((phase) => phase.status === "Done").length;
  const counter = `  ${done}/${phases.length}`;
  const marks = phases.map((phase) => markOf(phase.status));
  const named = phases.map((phase, index) => `${marks[index]} ${String(phase.title ?? "").trim()}`).join(" · ");
  if (named.length + counter.length <= width) return `${named}${counter}`;
  return fitText(`${marks.join(" ")}${counter}`, width);
}

const pad = (depth) => " ".repeat(Math.max(0, depth));

/** What a segment carries of an address: nothing at all where there is none to take. */
const linked = (url) => {
  const href = hrefOf(url);
  return href === null ? {} : { url: href };
};

/** A title never gets less than this before a suffix is dropped instead. */
const TITLE_FLOOR = 8;

/**
 * One row of prefix, title and optional tails. A narrow pane drops the tails rather than
 * the name — a row is read for what it names — and never runs past the width it was given.
 *
 * @param {{ key: string, indent: string, prefix: string, title: string | null, id: number | string, bold?: boolean, tails?: string[], url?: string | null, press?: any }} row
 * @param {number} columns
 * @returns {Row}
 */
function namedRow(row, columns) {
  const tails = [...(row.tails ?? [])].filter((tail) => tail !== "");
  const fixed = row.indent.length + row.prefix.length;
  while (tails.length > 0 && columns - fixed - tails.join("").length < TITLE_FLOOR) tails.shift();

  const suffix = tails.join("");
  const title = titleText(row.title, Math.max(1, columns - fixed - suffix.length), row.id);
  // A row that can be pressed is a Button, and a Button is a leaf on every surface: it
  // carries a label, never an element. So a sibling spec keeps the press that unfolds its
  // phases, and takes no address; the choice is made here rather than in the view.
  const href = row.press ? null : hrefOf(row.url);
  /** @type {Segment[]} */
  const segments = [
    { text: `${row.indent}${row.prefix}` },
    { text: title, bold: row.bold === true, ...(href === null ? {} : { url: href }) },
  ];
  if (suffix !== "") segments.push({ text: suffix, dim: true });

  return { key: row.key, segments, ...(row.press ? { press: row.press } : {}) };
}

/**
 * The rows of the docked pane: the whole tree, one subtree per piece of work.
 *
 * @param {{ status: string, trees: any[], gaps: string[] }} model
 * @param {{ columns: number, expanded?: Record<string, boolean>, isLoading?: boolean }} view
 * @returns {Row[]}
 */
export function dockRows(model, view) {
  const columns = Math.max(20, view.columns);
  const expanded = view.expanded ?? {};
  /** @type {Row[]} */
  const rows = [];

  if (model.status === "empty") {
    rows.push({ key: "empty", segments: [{ text: view.isLoading ? LOADING_TEXT : EMPTY_TEXT, dim: true }] });
    for (const gap of model.gaps) rows.push({ key: `gap-${gap}`, segments: [{ text: `? ${gap}`, dim: true }] });
    return rows;
  }

  model.trees.forEach((tree, treeIndex) => {
    const isFirst = treeIndex === 0;
    if (!isFirst) rows.push({ key: `spacer-${tree.key}`, segments: [{ text: "" }] });

    if (tree.periods.length > 0) {
      rows.push({ key: `${tree.key}-period`, segments: [{ text: tree.periods.join(" · "), dim: true }] });
    }

    tree.chain.forEach((node, level) => {
      rows.push(
        namedRow(
          {
            key: `${tree.key}-obj-${node.id}`,
            indent: pad(level * 2),
            prefix: level === 0 ? "◆ " : "└ ◆ ",
            title: node.title,
            id: node.id,
            bold: level === tree.chain.length - 1,
            url: node.url,
          },
          columns,
        ),
      );
    });

    const leafDepth = Math.max(0, tree.chain.length - 1) * 2;

    tree.keyResults.forEach((kr, index) => {
      const indent = pad(leafDepth + 4);
      const { text, dim } = keyResultText(kr, columns - indent.length - 4);
      rows.push({
        key: `${tree.key}-kr-${index}`,
        segments: [{ text: `${indent}RC  `, dim: true }, { text, dim }],
      });
    });

    if (tree.outsideStrategy) {
      rows.push({ key: `${tree.key}-outside`, segments: [{ text: OUTSIDE_STRATEGY_TEXT, dim: true }] });
    }

    const briefDepth = tree.chain.length === 0 ? 0 : leafDepth + 2;
    if (tree.brief) {
      rows.push(
        namedRow(
          {
            key: `${tree.key}-brief`,
            indent: pad(briefDepth),
            prefix: "▸ Brief : ",
            title: tree.brief.title,
            id: tree.brief.id,
            url: tree.brief.url,
            tails: [tree.brief.status ? `  [${tree.brief.status}]` : ""],
          },
          columns,
        ),
      );
    }

    const specDepth = briefDepth + 4;
    if (tree.spec) {
      rows.push(...specRows(tree.spec, specDepth, columns, true, `${tree.key}-spec`));
    }

    const shown = tree.siblings.slice(0, SIBLINGS_SHOWN);
    for (const sibling of shown) {
      const key = `${tree.key}-sib-${sibling.id}`;
      rows.push(...specRows(sibling, specDepth, columns, false, key, { kind: "sibling", id: sibling.id }));
      if (expanded[String(sibling.id)] && Array.isArray(sibling.phases) && sibling.phases.length > 0) {
        const indent = pad(specDepth + 4);
        rows.push({
          key: `${key}-phases`,
          segments: [{ text: indent }, { text: phaseLineText(sibling.phases, columns - indent.length), dim: true }],
        });
      }
    }
    const rest = tree.siblings.length - shown.length;
    if (rest > 0) {
      rows.push({
        key: `${tree.key}-more`,
        segments: [{ text: `${pad(specDepth)}… et ${rest} de plus`, dim: true }],
      });
    }

    for (const gap of tree.gaps) {
      rows.push({
        key: `${tree.key}-gap-${gap}`,
        segments: [{ text: fitText(`${pad(specDepth)}? ${gap}`, columns), dim: true }],
      });
    }
  });

  for (const gap of model.gaps) {
    rows.push({ key: `gap-${gap}`, segments: [{ text: fitText(`? ${gap}`, columns), dim: true }] });
  }
  rows.push({ key: "refresh", segments: [{ text: REFRESH_TEXT, dim: true }], press: { kind: "refresh" } });
  return rows;
}

/** A spec's own row, and the phase row under it when it is the one in hand. */
function specRows(spec, depth, columns, isInHand, key, press) {
  /** @type {Row[]} */
  const rows = [
    namedRow(
      {
        key,
        indent: pad(depth),
        prefix: `${markOf(spec.status)} ${isInHand ? "Spec : " : ""}`,
        title: spec.title,
        id: spec.id,
        bold: isInHand,
        url: spec.url,
        // The status goes first when the pane is narrow: what a row is read for is the
        // name, and then whether it is the one in hand.
        tails: [spec.status ? `  [${spec.status}]` : "", isInHand ? `  ${IN_HAND_TEXT}` : ""],
        press,
      },
      columns,
    ),
  ];
  if (isInHand && Array.isArray(spec.phases) && spec.phases.length > 0) {
    const phaseIndent = pad(depth + 4);
    rows.push({
      key: `${key}-phases`,
      segments: [{ text: phaseIndent }, { text: phaseLineText(spec.phases, columns - phaseIndent.length), dim: true }],
    });
  }
  return rows;
}

/**
 * The inline summary, above the prompt: the leaf objective, the brief, the spec and its
 * phases, and one line for each other piece of work — eight rows at the very most.
 *
 * @param {{ status: string, trees: any[], gaps: string[] }} model
 * @param {{ columns: number, isLoading?: boolean }} view
 * @returns {Row[]}
 */
export function inlineRows(model, view) {
  const columns = Math.max(20, view.columns);
  if (model.status === "empty") {
    return [{ key: "empty", segments: [{ text: view.isLoading ? LOADING_TEXT : EMPTY_TEXT, dim: true }] }];
  }

  /** @type {Row[]} */
  const rows = [];
  const first = model.trees[0];
  if (first) {
    const leaf = first.chain[first.chain.length - 1];
    if (leaf) {
      rows.push({
        key: "inline-obj",
        segments: [{ text: "◆ " }, { text: titleText(leaf.title, columns - 2, leaf.id), bold: true, ...linked(leaf.url) }],
      });
    } else if (first.outsideStrategy) {
      rows.push({ key: "inline-outside", segments: [{ text: OUTSIDE_STRATEGY_TEXT, dim: true }] });
    }
    if (first.brief) {
      rows.push({
        key: "inline-brief",
        segments: [
          { text: "  ▸ " },
          { text: titleText(first.brief.title, columns - 4, first.brief.id), ...linked(first.brief.url) },
        ],
      });
    }
    if (first.spec) {
      const prefix = `    ${markOf(first.spec.status)} `;
      rows.push({
        key: "inline-spec",
        segments: [
          { text: prefix },
          { text: titleText(first.spec.title, columns - prefix.length, first.spec.id), bold: true, ...linked(first.spec.url) },
        ],
      });
      if (Array.isArray(first.spec.phases) && first.spec.phases.length > 0) {
        rows.push({
          key: "inline-phases",
          segments: [{ text: "      " }, { text: phaseLineText(first.spec.phases, columns - 6), dim: true }],
        });
      }
    }
  }

  for (const tree of model.trees.slice(1)) {
    const named = tree.spec ?? tree.brief;
    if (!named) continue;
    const prefix = `${markOf(named.status)} `;
    rows.push({
      key: `inline-${tree.key}`,
      segments: [
        { text: prefix, dim: true },
        { text: titleText(named.title, columns - prefix.length, named.id), dim: true, ...linked(named.url) },
      ],
    });
  }

  if (rows.length < INLINE_MAX_ROWS) {
    for (const gap of model.gaps) {
      if (rows.length >= INLINE_MAX_ROWS) break;
      rows.push({ key: `gap-${gap}`, segments: [{ text: `? ${gap}`, dim: true }] });
    }
  }
  return rows.slice(0, INLINE_MAX_ROWS);
}

/** The rows as plain text, one string a line — what a test reads instead of a screen. */
export const plainOf = (rows) => rows.map((row) => row.segments.map((segment) => segment.text).join(""));
