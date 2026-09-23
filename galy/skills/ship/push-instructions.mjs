#!/usr/bin/env node
// Ship instruction-only changes at once: commit them on a fresh branch off the default one, open the
// pull request and merge it without waiting for checks. In scope: any Markdown file, `.claude/`,
// `.github/instructions/`, `.agents/`. Anything else goes through the normal review and merge.
//
//   node push-instructions.mjs "<commit message>" [file ...]
//
// With no file named, every in-scope change of the working copy is shipped. The work happens in a
// throwaway worktree, so the caller's branch, index and unrelated edits are never touched.
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

const IN_SCOPE = /(\.md$)|^\.claude\/|^\.github\/instructions\/|^\.agents\//;

const run = (cmd, args, opts = {}) =>
  execFileSync(cmd, args, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], ...opts }).trim();
const tryRun = (cmd, args, opts) => {
  try { return { ok: true, out: run(cmd, args, opts) }; } catch (e) { return { ok: false, out: String(e.stderr || e.message) }; }
};

const [message, ...named] = process.argv.slice(2);
if (!message) {
  console.error('usage: push-instructions.mjs "<commit message>" [file ...]');
  process.exit(2);
}

const root = run('git', ['rev-parse', '--show-toplevel']);
const git = (args, cwd = root) => run('git', args, { cwd });

// Changed paths of the working copy, relative to the root: modified, deleted, untracked.
const changes = new Map();
const status = git(['status', '--porcelain=v1', '-z', '--untracked-files=all']).split('\0');
for (let i = 0; i < status.length; i++) {
  const entry = status[i];
  if (!entry) continue;
  const code = entry.slice(0, 2);
  changes.set(entry.slice(3), code);
  if (code[0] === 'R' || code[0] === 'C') i++; // the source path follows a rename
}

const files = named.length ? named.map((f) => f.replace(/\\/g, '/')) : [...changes.keys()].filter((f) => IN_SCOPE.test(f));
const outOfScope = files.filter((f) => !IN_SCOPE.test(f));
if (outOfScope.length) {
  console.error(`Not instruction files, ship them through review: ${outOfScope.join(', ')}`);
  process.exit(1);
}
const toShip = files.filter((f) => changes.has(f));
if (!toShip.length) {
  console.log('Nothing to ship.');
  process.exit(0);
}

const base = tryRun('git', ['symbolic-ref', '--short', 'refs/remotes/origin/HEAD'], { cwd: root });
const defaultBranch = base.ok
  ? base.out.replace(/^origin\//, '')
  : run('gh', ['repo', 'view', '--json', 'defaultBranchRef', '-q', '.defaultBranchRef.name'], { cwd: root });

const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
const branch = `chore/instr-${stamp}`;
const work = mkdtempSync(join(tmpdir(), 'push-instructions-'));
let merged = false;

try {
  git(['fetch', '--quiet', 'origin', defaultBranch]);
  git(['worktree', 'add', '--quiet', '-b', branch, work, `origin/${defaultBranch}`]);

  const tracked = toShip.filter((f) => changes.get(f) !== '??');
  if (tracked.length) {
    const patch = git(['diff', '--binary', 'HEAD', '--', ...tracked]) + '\n';
    const applied = tryRun('git', ['apply', '--3way', '--whitespace=nowarn'], { cwd: work, input: patch });
    if (!applied.ok) throw new Error(`The change does not apply on ${defaultBranch}: ${applied.out}`);
  }
  for (const f of toShip.filter((f) => changes.get(f) === '??')) {
    const target = join(work, f);
    if (existsSync(target)) throw new Error(`${f} already exists on ${defaultBranch}.`);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(join(root, f), target);
  }

  git(['add', '--all', '--', ...toShip], work);
  git(['commit', '--quiet', '-m', message], work);
  git(['push', '--quiet', '-u', 'origin', branch], work);

  const title = message.split('\n')[0];
  const url = run('gh', ['pr', 'create', '--base', defaultBranch, '--head', branch, '--title', title,
    '--body', 'Instruction-only change, merged without waiting for checks.'], { cwd: work });

  const now = tryRun('gh', ['pr', 'merge', url, '--squash', '--admin'], { cwd: work });
  if (now.ok) {
    merged = true;
    tryRun('git', ['push', '--quiet', 'origin', '--delete', branch], { cwd: work });
    console.log(`Merged ${url}`);
  } else {
    const auto = tryRun('gh', ['pr', 'merge', url, '--squash', '--auto', '--delete-branch'], { cwd: work });
    if (!auto.ok) throw new Error(`Opened ${url} but could not merge it: ${now.out} ${auto.out}`);
    console.log(`Queued ${url} — it merges as soon as the branch protection allows.`);
  }
} finally {
  tryRun('git', ['worktree', 'remove', '--force', work], { cwd: root });
  tryRun('git', ['branch', '-D', branch], { cwd: root });
  if (!merged) tryRun('git', ['worktree', 'prune'], { cwd: root });
}
