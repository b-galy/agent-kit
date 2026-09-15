// What this working copy has in hand, read where it is written: `.bg/work.json`, beside
// the code, by `hooks/bg-work.mjs`.
//
// The pane never asks the workspace "what am I on?" — two worktrees of one repository share
// an account, a token and a queue, and differ only in this file. The climb therefore stops
// at the first `.git` (a FILE there, a worktree, counts as much as a folder) and goes no
// further: two copies share an address, they do not share a piece of work.
//
// No `node:path` here: a hooks module runs inside the engine, and both separators reach it
// on Windows — `C:\src\wt-10` from the session, `C:/src/wt-10` from a test.

import { HORIZON_MS } from "./names.mjs";

/**
 * Joins a directory and the segments beneath it, in the separator the directory uses.
 *
 * @param {string} dir
 * @param {...string} parts
 * @returns {string}
 */
export function joinPath(dir, ...parts) {
  const separator = dir.includes("\\") && !dir.includes("/") ? "\\" : "/";
  const base = dir.replace(/[\\/]+$/, "");
  return [base, ...parts].join(separator);
}

/**
 * The directory above `dir`, or null at the root of a drive or of the filesystem.
 *
 * @param {string} dir
 * @returns {string | null}
 */
export function parentOf(dir) {
  const cut = Math.max(dir.lastIndexOf("/"), dir.lastIndexOf("\\"));
  if (cut <= 0) return null;
  const parent = dir.slice(0, cut);
  // `C:` alone is not a directory; `C:\` is, and is where the climb stops.
  if (/^[A-Za-z]:$/.test(parent)) return `${parent}${dir[cut]}`;
  return parent === dir ? null : parent;
}

/**
 * The root of the working copy `cwd` belongs to: the first ancestor holding a `.git`.
 *
 * @param {string} cwd
 * @param {(path: string) => Promise<boolean>} exists
 * @returns {Promise<string | null>}
 */
export async function workingCopyRootOf(cwd, exists) {
  let dir = String(cwd || "").replace(/[\\/]+$/, "") || String(cwd || "");
  let guard = 64;
  while (dir && guard-- > 0) {
    if (await exists(joinPath(dir, ".git"))) return dir;
    const parent = parentOf(dir);
    if (parent === null || parent === dir) return null;
    dir = parent;
  }
  return null;
}

/**
 * The path of a working copy's work file.
 *
 * @param {string} root
 * @returns {string}
 */
export const workFileOf = (root) => joinPath(root, ".bg", "work.json");

/**
 * One entry as the pane reads it: the id, when it was taken, and the server it went
 * through. An entry written before that field existed keeps `server: null`, and the
 * reader resolves the server itself.
 *
 * @typedef {{ id: number, at: number, server: string | null }} HeldEntry
 */

/**
 * What the file says, filtered to what is still in hand and ordered newest first.
 *
 * A malformed file is nothing in hand, never an error: this runs on every redraw.
 *
 * @param {string} text the file's contents
 * @param {number} nowMs
 * @returns {{ specs: HeldEntry[], briefs: HeldEntry[] }}
 */
export function heldOf(text, nowMs) {
  const empty = { specs: [], briefs: [] };
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return empty;
  }
  if (!parsed || typeof parsed !== "object") return empty;

  const fresh = (entries) =>
    (Array.isArray(entries) ? entries : [])
      .map((entry) => {
        const id = Number(entry?.id);
        const at = Date.parse(entry?.at);
        if (!Number.isInteger(id) || id <= 0 || !Number.isFinite(at)) return null;
        if (nowMs - at >= HORIZON_MS) return null;
        const server = typeof entry?.server === "string" && entry.server ? entry.server : null;
        return { id, at, server };
      })
      .filter((entry) => entry !== null)
      .sort((a, b) => b.at - a.at);

  return { specs: fresh(parsed.specs), briefs: fresh(parsed.briefs) };
}

/**
 * Whether anything is in hand.
 *
 * @param {{ specs: HeldEntry[], briefs: HeldEntry[] }} held
 * @returns {boolean}
 */
export const holdsSomething = (held) => held.specs.length > 0 || held.briefs.length > 0;
