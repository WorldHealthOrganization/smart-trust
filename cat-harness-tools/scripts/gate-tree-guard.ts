/**
 * Which gate CHANGED THE REPOSITORY while it was being judged.
 *
 * `bun run cat gates` runs `bun test` first, and somewhere in that suite the
 * detangle WRITER repairs `test/results/detangle/**.detangle.json`;
 * `kg:detangle:check`, near the end, then reads the repaired file:
 *
 *     bun run cat kg:detangle:check   alone      ->  exit 1, "STALE … — internal"
 *     bun run cat gates               same tree  ->  exit 0, "every gate passed"
 *
 * No gate can observe what another gate did; only the runner loop sees
 * between them, so the guard lives there and knows nothing about any one
 * gate.
 *
 * ## The predicate is a per-gate delta, not "the tree is dirty"
 *
 * Running `gates` on your own uncommitted work is the normal case. The
 * question is *"did a gate change a path it did not find changed when it
 * started?"*; your own edits are in the baseline and stay there. A generator
 * rewriting IDENTICAL BYTES does not show up in `git status`, so the guard
 * fires exactly when a gate's write changed a committed artefact. One
 * `git status --porcelain` per gate is nearly free against a run of minutes.
 *
 * ## Raw porcelain lines are the key
 *
 * To notice that a snapshot CHANGED, and to report it, the line git printed
 * is already the right key, so quoted paths and `R  old -> new` renames need
 * no parsing. The only field read out of it is the fixed-width two-char status
 * code.
 *
 * ## Known limitation: do not CHANGE the tree while the gates run, by any means
 *
 * Anything that moves a porcelain line during a run is attributed to
 * whichever gate was running — a finding that names an innocent gate. That
 * includes git operations (`git add` turns `??` into `A ` and ` M` into
 * `M `; a commit makes entries vanish) and an ordinary editor write to a
 * tracked file. It is documented rather than defended against: the only safe
 * defence is to void the run. Commit before the run or after it.
 *
 * The runner records when each gate ran, and each changed path's mtime is
 * checked against those windows: a write that landed while NO gate was
 * running is reported as an outside change rather than pinned on a gate, and
 * a write inside a parallel batch names only the gates running at that
 * instant. An outside write made DURING a gate still names the gate — see
 * {@link attributeWrite}.
 */

import { spawnSync } from "node:child_process";
import { statSync } from "node:fs";
import { join } from "node:path";

/**
 * One porcelain entry: `code` is the fixed-width two-character XY status, `key`
 * is the remainder of the line, used both as the identity of the entry and as
 * its display form. See the docblock on raw lines above for why `key` is not a
 * resolved filesystem path.
 */
export interface TreeEntry {
  readonly code: string;
  readonly key: string;
}

/** A reading of the working tree, or a stated reason there is none. */
export type TreeReading =
  | { readonly ok: true; readonly entries: ReadonlyMap<string, string> }
  | { readonly ok: false; readonly why: string };

/**
 * Parse `git status --porcelain` output into `key -> code`.
 *
 * Blank lines are skipped; a line shorter than the `XY ` prefix cannot be an
 * entry and is skipped too rather than producing a key of `""`, which would
 * collide with every other malformed line and make one defect look like many.
 */
export function parsePorcelain(text: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const raw of text.split("\n")) {
    const line = raw.replace(/\r$/, "");
    if (line.length < 4) continue;
    out.set(line.slice(3), line.slice(0, 2));
  }
  return out;
}

/**
 * True when this entry is an untracked file (`??`) rather than a change to
 * something git is already following.
 *
 * Both are reported and both fail, and the distinction is kept only so the
 * reader is told which they are looking at. An untracked file a gate creates is
 * not the lesser case: a NEW generated sidecar that nobody commits is the
 * `dh4f` shape — a consumer scans nothing and reports a clean run over it.
 * `.gitignore` already excludes the scratch files a gate is entitled to write,
 * because `git status` honours it, so what reaches here is a file the
 * repository has no opinion about yet.
 */
export function isUntracked(code: string): boolean {
  return code === "??";
}

/** Ask git for the working tree's state, or say why that could not be done. */
export function readTree(root: string): TreeReading {
  let r: ReturnType<typeof spawnSync>;
  try {
    // input-site: tree #e96df6b1 — git status --porcelain: the working tree against the index
    r = spawnSync("git", ["status", "--porcelain"], {
      cwd: root,
      encoding: "utf-8",
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (e) {
    return { ok: false, why: `could not run git: ${(e as Error).message}` };
  }
  if (r.error) return { ok: false, why: `could not run git: ${r.error.message}` };
  if (r.status !== 0) {
    const stderr = String(r.stderr ?? "").trim().split("\n")[0] ?? "";
    return { ok: false, why: `git status exited ${r.status}${stderr ? `: ${stderr}` : ""}` };
  }
  return { ok: true, entries: parsePorcelain(String(r.stdout ?? "")) };
}

/** One path whose porcelain status differs between two readings. */
export interface TreeChange {
  readonly key: string;
  /** Absent when the entry appeared. */
  readonly before?: string;
  /** Absent when the entry disappeared — a gate REVERTED a change. */
  readonly after?: string;
}

/**
 * Every entry whose status differs between two readings.
 *
 * Three directions, all of them counted:
 *
 *   appeared     a gate modified or created something
 *   changed      e.g. ` M` -> `MM`; the same path, a different state
 *   disappeared  a gate UNDID a change that was there
 *
 * The third is the one a "did anything get dirtier?" check misses, and it is
 * not the harmless direction: a gate that reverts an author's edit destroys
 * work, where a gate that writes one only wastes a commit. Keyed by entry, so
 * a status transition is ONE change rather than an add and a delete.
 *
 * Sorted, so two runs over the same defect produce the same report.
 */
export function diffReadings(
  before: ReadonlyMap<string, string>,
  after: ReadonlyMap<string, string>,
): TreeChange[] {
  const out: TreeChange[] = [];
  for (const [key, code] of after) {
    const was = before.get(key);
    if (was !== code) out.push(was === undefined ? { key, after: code } : { key, before: was, after: code });
  }
  for (const [key, code] of before) {
    if (!after.has(key)) out.push({ key, before: code });
  }
  return out.sort((a, b) => a.key.localeCompare(b.key));
}

/** What one gate did to the tree while it ran. */
export interface GateMutation {
  readonly gate: string;
  readonly changes: readonly TreeChange[];
  /** Per change key: who was running when the path was last written ({@link attributeChanges}). */
  readonly attribution?: ReadonlyMap<string, WriteAttribution>;
}

// ── Who was running when it was written (bean `v3nf`) ─────────────────────
//
// A read-only batch runs its gates in a pool, so a snapshot after the batch
// can only say "one of these N gates" — and N is most of the gate set. The
// path's own mtime narrows that: a gate can only have written the file while
// it was running, so the suspects are the gates whose [start, end] window
// contains the write. A write inside NO window happened while no gate was
// running — between gates, or before the first — which is an outside change
// (an editor, a `git add`) that the per-snapshot delta alone reports against
// an innocent gate.
//
// What it CANNOT do, stated rather than implied: a write made from outside
// WHILE a gate was running still names that gate, since nothing short of a
// sandbox tells two writers in the same instant apart. And the mtime is the
// LAST write, so a path written by one gate and rewritten by another names
// the second.

/** When one gate ran, in epoch milliseconds (the clock `statSync().mtimeMs` uses). */
export interface GateWindow {
  readonly gate: string;
  readonly start: number;
  readonly end: number;
}

/** Who could have written one changed path, judged by its mtime. */
export type WriteAttribution =
  | { readonly kind: "running"; readonly at: number; readonly gates: readonly string[] }
  | { readonly kind: "idle"; readonly at: number }
  | { readonly kind: "unknown"; readonly why: string };

/**
 * The repository-relative path a porcelain key names, or undefined when the
 * key is a shape this code will not parse — a quoted path or a rename. Those
 * are reported as "could not determine" rather than guessed at, which keeps
 * the raw-key rule above intact: the KEY is still never parsed for identity.
 */
export function pathOfKey(key: string): string | undefined {
  if (key.startsWith('"') || key.includes(" -> ")) return undefined;
  return key.endsWith("/") ? key.slice(0, -1) : key;
}

/**
 * The gates whose window contains `at`. `slackMs` absorbs timestamp
 * granularity only: a child cannot write before it was spawned or after it was
 * reaped, and both ends are taken around exactly that — but the kernel stamps
 * mtimes from a coarse clock that can read up to a tick (4–10 ms) behind
 * `Date.now()`, so a few ticks are allowed.
 */
export function attributeWrite(at: number, windows: readonly GateWindow[], slackMs = 20): WriteAttribution {
  const gates = windows.filter((w) => at >= w.start - slackMs && at <= w.end + slackMs).map((w) => w.gate);
  return gates.length > 0 ? { kind: "running", at, gates } : { kind: "idle", at };
}

/** {@link attributeWrite} for each change, reading each path's mtime under `root`. */
export function attributeChanges(
  root: string,
  changes: readonly TreeChange[],
  windows: readonly GateWindow[],
  mtimeOf: (abs: string) => number = (abs) => statSync(abs).mtimeMs,
): Map<string, WriteAttribution> {
  const out = new Map<string, WriteAttribution>();
  for (const c of changes) {
    const rel = pathOfKey(c.key);
    if (rel === undefined) {
      out.set(c.key, { kind: "unknown", why: "quoted or renamed path, not resolved" });
      continue;
    }
    let at: number;
    try {
      at = mtimeOf(join(root, rel));
    } catch {
      // A deleted path has no mtime; when it went is not recorded anywhere.
      out.set(c.key, { kind: "unknown", why: "path no longer exists" });
      continue;
    }
    out.set(c.key, attributeWrite(at, windows));
  }
  return out;
}

/** One attribution, as the suffix printed after its change line. */
export function formatAttribution(a: WriteAttribution): string {
  const t = (ms: number) => new Date(ms).toISOString().slice(11, 23);
  if (a.kind === "unknown") return `when written: could not determine (${a.why})`;
  if (a.kind === "idle") return `written ${t(a.at)}Z while NO gate was running — an outside change, not a gate's`;
  return `written ${t(a.at)}Z while running: ${a.gates.join(", ")}`;
}

/**
 * The report for a run in which at least one gate changed the repository.
 *
 * Returns [] for no mutations, so the caller has nothing to print and no
 * "✓ nothing happened" line to maintain. A clean run should be silent here:
 * this guard's whole subject is a thing that should never occur, and a tool
 * that congratulates itself once per run trains readers to skip its output.
 *
 * The cap exists for the same reason `salientFailures` has one — a gate that
 * rewrites 218 sidecars (bean `bqrg`'s neighbour) would otherwise bury the
 * finding under its own evidence — and the elision is STATED rather than
 * silent, because "5 of 218" and "5" are different claims.
 */
export function formatMutations(mutations: readonly GateMutation[], cap = 8): string[] {
  if (mutations.length === 0) return [];
  const lines: string[] = [];
  lines.push(`✗ ${mutations.length} gate(s) CHANGED THE REPOSITORY while the gates were running:`);
  for (const m of mutations) {
    const tracked = m.changes.filter((c) => !isUntracked(c.after ?? c.before ?? ""));
    const untracked = m.changes.length - tracked.length;
    const parts = [`${m.changes.length} path(s)`];
    if (untracked > 0) parts.push(`${untracked} of them previously untracked`);
    lines.push(`  · ${m.gate}   (${parts.join(", ")})`);
    for (const c of m.changes.slice(0, cap)) {
      const how =
        c.after === undefined
          ? `reverted  (was "${c.before}")`
          : c.before === undefined
            ? `wrote     ("${c.after}")`
            : `changed   ("${c.before}" -> "${c.after}")`;
      lines.push(`      ${how}  ${c.key}`);
      const a = m.attribution?.get(c.key);
      if (a !== undefined) lines.push(`                 ↳ ${formatAttribution(a)}`);
    }
    if (m.changes.length > cap) {
      lines.push(`      …and ${m.changes.length - cap} more path(s) not listed`);
    }
  }
  lines.push("");
  lines.push("  A gate that writes to the tree it is being judged on makes every LATER gate");
  lines.push("  read a repaired copy rather than the committed one. That is not a warning: it");
  lines.push("  is why `kg:detangle:check` cannot fail inside this runner, and why three stale");
  lines.push("  artefacts reached `main` green (bean `ymsu`).");
  lines.push("");
  lines.push("  Regenerate and COMMIT what is stale, then re-run — the changes above are the");
  lines.push("  diff you are missing. If a gate writes here as part of doing its job, that is");
  lines.push("  the defect to fix: compute into a temp directory, as the profile-conformance");
  lines.push("  tests already do, rather than into the tree under test.");
  lines.push("");
  // Printed because the docblock is not what anybody reads when a run goes red.
  // Measured 2026-09-27: an edit made during a background run was reported as
  // `bun test` writing, and read as a gate's defect before being checked.
  lines.push("  First rule out YOURSELF: this guard cannot tell a gate's write from any other");
  lines.push("  change to the tree during the run, so an edit, a `git add` or a commit made");
  lines.push("  while it was in flight is reported against whichever gate was running. If a");
  lines.push("  path above is one you touched, the gate named is innocent — commit, then re-run.");
  if (mutations.some((m) => m.attribution !== undefined)) {
    // Bean `v3nf`: the mtime line narrows that, in one direction only.
    lines.push("  A `↳` line saying NO gate was running settles it: that write was not a gate's.");
    lines.push("  One naming gates narrows a parallel batch to those running at that instant,");
    lines.push("  and cannot clear an edit you made during the same instant.");
  }
  return lines;
}

/**
 * The line to print when the tree could not be read.
 *
 * Deliberately NOT a failure, and deliberately not silence either.
 *
 * Not a failure, because `gates` must stay runnable where this question cannot
 * be asked — an exported source tree with no `.git`, a container with no `git`
 * binary. Failing there would make the guard the reason the gates cannot run.
 *
 * Not silence, because *"could not determine is never rendered as clean"* is
 * this repository's rule, and the way it gets broken is a check that quietly
 * skips itself and lets the run's final line imply it looked.
 */
export function formatUndetermined(why: string): string[] {
  return [
    `? could not tell whether any gate changed the repository — ${why}`,
    "  The gates' own verdict below stands; THIS question was not answered, and an",
    "  unanswered question is not a clean answer to it (bean `ymsu`).",
  ];
}
