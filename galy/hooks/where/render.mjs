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
//
// A row that names something — an objective, the brief, a spec, a phase — is never cut:
// it carries its lead apart from its text, and the view draws the text after the lead so
// that a title longer than the pane wraps under its own first character rather than under
// the mark. A row that is pressed is a button, and a button is a label: it stays cut. The
// brief's row is framed the whole width of the body, and an empty row parts it from the
// chain above; the view draws the frame and the emptiness, and decides neither.

import {
  EMPTY_TEXT,
  IN_HAND_TEXT,
  INLINE_MAX_ROWS,
  LOADING_TEXT,
  MARK_COLUMNS,
  MARKS,
  OBJECTIVE_MARK,
  OUTSIDE_STRATEGY_TEXT,
  PHASE_ROW_MARKS,
  REFRESH_TEXT,
  SIBLINGS_SHOWN,
} from "./names.mjs";

/**
 * @typedef {{ text: string, bold?: boolean, dim?: boolean, strikethrough?: boolean, url?: string }} Segment
 * @typedef {{ indent: number, prefix: string, bold?: boolean }} Lead the columns before the text, drawn once, never wrapped
 * @typedef {{
 *   key: string,
 *   segments: Segment[],
 *   lead?: Lead,
 *   kind?: "blank",
 *   boxed?: boolean,
 *   press?: { kind: string, id?: number },
 * }} Row a line of the pane: empty when `kind` is blank, framed the whole width when `boxed`
 */

/** The mark a status is drawn with. */
export const markOf = (status) => MARKS[String(status ?? "")] ?? MARKS.other;

/** The mark a phase opens its own row with. */
export const phaseRowMarkOf = (status) => PHASE_ROW_MARKS[String(status ?? "")] ?? PHASE_ROW_MARKS.other;

// ── How wide a line really is ─────────────────────────────────────────────
//
// A terminal counts columns, not characters, and the two stopped agreeing the day an
// objective started being drawn with its own icon: an emoji is one character and two
// columns. Measured with `String.length` a row overflows its pane and wraps, which breaks
// the tree apart — the one thing this pane exists to avoid. So every cut and every
// arithmetic below goes through these two.

/** The ranges a terminal gives two columns: CJK, Hangul, and the emoji that need no selector. */
const WIDE = [
  [0x1100, 0x115f], [0x231a, 0x231b], [0x23e9, 0x23ec], [0x23f0, 0x23f0], [0x23f3, 0x23f3],
  [0x25fd, 0x25fe], [0x2614, 0x2615], [0x2648, 0x2653], [0x267f, 0x267f], [0x2693, 0x2693],
  [0x26a1, 0x26a1], [0x26aa, 0x26ab], [0x26bd, 0x26be], [0x26c4, 0x26c5], [0x26ce, 0x26ce],
  [0x26d4, 0x26d4], [0x26ea, 0x26ea], [0x26f2, 0x26f3], [0x26f5, 0x26f5], [0x26fa, 0x26fa],
  [0x26fd, 0x26fd], [0x2705, 0x2705], [0x270a, 0x270b], [0x2728, 0x2728], [0x274c, 0x274c],
  [0x274e, 0x274e], [0x2753, 0x2755], [0x2757, 0x2757], [0x2795, 0x2797], [0x27b0, 0x27b0],
  [0x27bf, 0x27bf], [0x2b1b, 0x2b1c], [0x2b50, 0x2b50], [0x2b55, 0x2b55], [0x2e80, 0x303e],
  [0x3041, 0x33ff], [0x3400, 0x4dbf], [0x4e00, 0x9fff], [0xa000, 0xa4cf], [0xac00, 0xd7a3],
  [0xf900, 0xfaff], [0xfe10, 0xfe19], [0xfe30, 0xfe6f], [0xff00, 0xff60], [0xffe0, 0xffe6],
  [0x1f000, 0x1faff], [0x20000, 0x3fffd],
];

/** The ranges that take none: combining marks, zero-width joiners, variation selectors. */
const BARE = [[0x0300, 0x036f], [0x200b, 0x200f], [0x2060, 0x206f], [0xfe00, 0xfe0f]];

const inRanges = (code, ranges) => ranges.some(([from, to]) => code >= from && code <= to);

/** The columns one code point takes. */
const charWidth = (code) => (inRanges(code, BARE) ? 0 : inRanges(code, WIDE) ? 2 : 1);

/** The variation selector that turns the character before it into a two-column emoji. */
const EMOJI_SELECTOR = 0xfe0f;

/**
 * The columns a string takes on a terminal.
 *
 * @param {unknown} text
 * @returns {number}
 */
export function displayWidth(text) {
  let width = 0;
  let previous = 0;
  for (const character of String(text ?? "")) {
    const code = character.codePointAt(0) ?? 0;
    if (code === EMOJI_SELECTOR) {
      width += previous === 1 ? 1 : 0;
      previous = 0;
      continue;
    }
    const own = charWidth(code);
    width += own;
    previous = own;
  }
  return width;
}

/** The longest beginning of `text` that fits in `columns`, cut between code points. */
function cutTo(text, columns) {
  let width = 0;
  let previous = 0;
  let kept = "";
  for (const character of String(text ?? "")) {
    const code = character.codePointAt(0) ?? 0;
    const own = code === EMOJI_SELECTOR ? (previous === 1 ? 1 : 0) : charWidth(code);
    if (width + own > columns) break;
    width += own;
    kept += character;
    previous = code === EMOJI_SELECTOR ? 0 : own;
  }
  return kept;
}

/**
 * The mark an objective is drawn with, and the space between it and the title: its own icon
 * where the workspace gave it one, else the pane's.
 *
 * The mark sits in a cell of a fixed width, so an icon on one node never shifts the node
 * under it; the separator is outside that cell, so an emoji never touches the title it
 * marks, and a terminal drawing that emoji narrow still leaves them apart.
 *
 * @param {string | null | undefined} icon
 * @returns {string}
 */
export function objectiveMark(icon) {
  const own = typeof icon === "string" ? icon.trim() : "";
  const kept = own === "" ? OBJECTIVE_MARK : cutTo(own, MARK_COLUMNS);
  const width = displayWidth(kept);
  const cell = width === 0 || width > MARK_COLUMNS
    ? `${OBJECTIVE_MARK} `
    : `${kept}${" ".repeat(MARK_COLUMNS - width)}`;

  return `${cell} `;
}

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
  if (displayWidth(text) <= width) return text;
  return `${cutTo(text, Math.max(1, width - 1)).trimEnd()}…`;
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
  while (figures.length > 1 && width - displayWidth(tail) < 12) {
    figures.splice(figures.length - 1, 1);
    tail = ` · ${figures.join(" ")}`;
  }
  if (width - displayWidth(tail) < 6) tail = "";

  const room = Math.max(4, width - displayWidth(tail));
  return { text: fitText(`${titleText(kr.title, room, "?")}${tail}`, width), dim: !measured };
}

/** A line cut to the room it has, with an ellipsis where something was dropped. */
export function fitText(text, width) {
  if (width <= 0) return "";
  return displayWidth(text) <= width ? text : `${cutTo(text, Math.max(1, width - 1)).trimEnd()}…`;
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
  if (displayWidth(named) + displayWidth(counter) <= width) return `${named}${counter}`;
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

/** A name as its row reads it: the title whole, or the number where there is none yet. */
const nameOf = (title, fallbackId) => {
  const whole = String(title ?? "").trim();
  return whole === "" ? (fallbackId === undefined ? "" : `#${fallbackId}`) : whole;
};

/**
 * One row of prefix, title and optional tails.
 *
 * A row that names something is drawn whole: the name and its tails wrap under the name's
 * first character, past the lead the view draws once. A row that can be pressed is a
 * Button, and a Button is a leaf on every surface — it carries a label, never an element —
 * so a sibling spec keeps the press that unfolds its phases, takes no address, and is cut
 * to the width it was given, its tails dropped before its name.
 *
 * @param {{ key: string, indent: number, prefix: string, title: string | null, id: number | string, bold?: boolean, tails?: string[], url?: string | null, press?: any }} row
 * @param {number} columns
 * @returns {Row}
 */
function namedRow(row, columns) {
  const tails = [...(row.tails ?? [])].filter((tail) => tail !== "");

  if (!row.press) {
    const href = hrefOf(row.url);
    /** @type {Segment[]} */
    const segments = [{ text: nameOf(row.title, row.id), bold: row.bold === true, ...(href === null ? {} : { url: href }) }];
    if (tails.length > 0) segments.push({ text: tails.join(""), dim: true });

    return { key: row.key, lead: { indent: row.indent, prefix: row.prefix }, segments };
  }

  const fixed = row.indent + displayWidth(row.prefix);
  while (tails.length > 0 && columns - fixed - displayWidth(tails.join("")) < TITLE_FLOOR) tails.shift();

  const suffix = tails.join("");
  const title = titleText(row.title, Math.max(1, columns - fixed - displayWidth(suffix)), row.id);
  /** @type {Segment[]} */
  const segments = [{ text: `${pad(row.indent)}${row.prefix}` }, { text: title, bold: row.bold === true }];
  if (suffix !== "") segments.push({ text: suffix, dim: true });

  return { key: row.key, segments, press: row.press };
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
    if (!isFirst) rows.push(blankRow(`spacer-${tree.key}`));
    const firstRowOfTree = rows.length;

    if (tree.periods.length > 0) {
      rows.push({ key: `${tree.key}-period`, segments: [{ text: tree.periods.join(" · "), dim: true }] });
    }

    tree.chain.forEach((node, level) => {
      rows.push(
        namedRow(
          {
            key: `${tree.key}-obj-${node.id}`,
            indent: level * 2,
            prefix: level === 0 ? objectiveMark(node.icon) : `└ ${objectiveMark(node.icon)}`,
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

    // The brief detaches from the chain it serves: an empty row closes the chain, and the
    // brief starts at the left margin, its name in a bordered box the whole width of the
    // body. What hangs under the brief is indented from the brief, never from the chain.
    if (tree.brief) {
      if (rows.length > firstRowOfTree) rows.push(blankRow(`${tree.key}-blank`));
      const href = hrefOf(tree.brief.url);
      /** @type {Segment[]} */
      const segments = [{ text: nameOf(tree.brief.title, tree.brief.id), bold: true, ...(href === null ? {} : { url: href }) }];
      if (tree.brief.status) segments.push({ text: `  [${tree.brief.status}]`, dim: true });
      rows.push({ key: `${tree.key}-brief`, boxed: true, segments });
    }

    // Every spec of this brief the copy has in hand, newest first, each with its phases on
    // rows of their own; then the brief's other specs, folded, their phases on rows of
    // their own once unfolded. A tree taller than the pane's body scrolls under the
    // engine's own window, so nothing here bounds it.
    for (const spec of tree.specs) {
      rows.push(...specRows(spec, SPEC_DEPTH, columns, { isInHand: true, key: `${tree.key}-spec-${spec.id}` }));
    }

    const shown = tree.siblings.slice(0, SIBLINGS_SHOWN);
    for (const sibling of shown) {
      rows.push(
        ...specRows(sibling, SPEC_DEPTH, columns, {
          isInHand: false,
          key: `${tree.key}-sib-${sibling.id}`,
          press: { kind: "sibling", id: sibling.id },
          isUnfolded: expanded[String(sibling.id)] === true,
        }),
      );
    }
    const rest = tree.siblings.length - shown.length;
    if (rest > 0) {
      rows.push({
        key: `${tree.key}-more`,
        segments: [{ text: `${pad(SPEC_DEPTH)}… et ${rest} de plus`, dim: true }],
      });
    }

    for (const gap of tree.gaps) {
      rows.push({
        key: `${tree.key}-gap-${gap}`,
        segments: [{ text: fitText(`${pad(SPEC_DEPTH)}? ${gap}`, columns), dim: true }],
      });
    }
  });

  for (const gap of model.gaps) {
    rows.push({ key: `gap-${gap}`, segments: [{ text: fitText(`? ${gap}`, columns), dim: true }] });
  }
  rows.push({ key: "refresh", segments: [{ text: REFRESH_TEXT, dim: true }], press: { kind: "refresh" } });
  return rows;
}

/** Where a spec sits under its brief's box, and how much deeper its phases sit under it. */
const SPEC_DEPTH = 2;
const PHASE_STEP = 4;

/** A row with nothing on it: what separates two trees, and the chain from its brief. */
const blankRow = (key) => ({ key, kind: "blank", segments: [] });

/**
 * A spec's own row and, when its phases are known and shown, a row per phase under it:
 * the one done is struck through, the one in progress points at itself in bold, the rest
 * wait in plain text. The count of phases done stays on the spec's row, beside its name.
 *
 * @param {any} spec
 * @param {number} depth
 * @param {number} columns
 * @param {{ isInHand: boolean, key: string, press?: { kind: string, id?: number }, isUnfolded?: boolean }} how
 * @returns {Row[]}
 */
function specRows(spec, depth, columns, how) {
  const { isInHand, key, press } = how;
  const known = Array.isArray(spec.phases) ? spec.phases : [];
  const done = known.filter((phase) => phase.status === "Done").length;
  const shown = isInHand || how.isUnfolded === true ? known : [];
  /** @type {Row[]} */
  const rows = [
    namedRow(
      {
        key,
        indent: depth,
        prefix: `${markOf(spec.status)} ${isInHand ? "Spec : " : ""}`,
        title: spec.title,
        id: spec.id,
        bold: isInHand,
        url: spec.url,
        // The status goes first when the pane is narrow: what a row is read for is the
        // name, and then whether it is the one in hand.
        tails: [
          known.length > 0 ? `  ${done}/${known.length}` : "",
          spec.status ? `  [${spec.status}]` : "",
          isInHand ? `  ${IN_HAND_TEXT}` : "",
        ],
        press,
      },
      columns,
    ),
  ];
  shown.forEach((phase, index) => {
    const isDone = phase.status === "Done";
    const isCurrent = phase.status === "InProgress";
    rows.push({
      key: `${key}-phase-${index}`,
      lead: { indent: depth + PHASE_STEP, prefix: `${phaseRowMarkOf(phase.status)} `, ...(isCurrent ? { bold: true } : {}) },
      segments: [
        {
          text: nameOf(phase.title, phase.id || undefined),
          ...(isDone ? { strikethrough: true } : {}),
          ...(isCurrent ? { bold: true } : {}),
        },
      ],
    });
  });
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
      const mark = objectiveMark(leaf.icon);
      rows.push({
        key: "inline-obj",
        segments: [
          { text: mark },
          { text: titleText(leaf.title, columns - displayWidth(mark), leaf.id), bold: true, ...linked(leaf.url) },
        ],
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
    for (const spec of first.specs) {
      const prefix = `    ${markOf(spec.status)} `;
      rows.push({
        key: `inline-spec-${spec.id}`,
        segments: [
          { text: prefix },
          { text: titleText(spec.title, columns - displayWidth(prefix), spec.id), bold: true, ...linked(spec.url) },
        ],
      });
      if (Array.isArray(spec.phases) && spec.phases.length > 0) {
        rows.push({
          key: `inline-phases-${spec.id}`,
          segments: [{ text: "      " }, { text: phaseLineText(spec.phases, columns - 6), dim: true }],
        });
      }
    }
  }

  for (const tree of model.trees.slice(1)) {
    const named = tree.specs[0] ?? tree.brief;
    if (!named) continue;
    const prefix = `${markOf(named.status)} `;
    rows.push({
      key: `inline-${tree.key}`,
      segments: [
        { text: prefix, dim: true },
        { text: titleText(named.title, columns - displayWidth(prefix), named.id), dim: true, ...linked(named.url) },
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
export const plainOf = (rows) =>
  rows.map((row) => `${leadText(row)}${row.segments.map((segment) => segment.text).join("")}`);

/** The lead of a row as its columns read: the indentation, then the prefix. */
export const leadText = (row) => (row.lead ? `${pad(row.lead.indent)}${row.lead.prefix}` : "");
