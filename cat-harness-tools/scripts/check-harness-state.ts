#!/usr/bin/env bun
/**
 * The harness graphs that a schema TYPES and nothing else JUDGED — one criterion each.
 *
 * @module scripts/check-harness-state
 * @covers health, todos, interaction, issue-marks, merge-queue, session-survey, todo-items, todo-feedback, board-positions
 *
 * Each covered graph declares a validator that parses its nodes, but no other
 * criterion or gate judges what those nodes SAY (`audit-coverage`'s
 * `typed-only`). This adds one criterion family per graph, including the
 * inner directories `beans/beans.json` and `todos/todos.json` declare (see
 * the section above `declaredDirs`).
 *
 * ## One script, and not `kg-audit`
 *
 * One gate, as in `check-asset-roles`, rather than a CI step per graph. Not
 * `kg-audit`: its subject is *one criterion per join in the
 * actor→role→skill→task sentence*, and these are `state` and `context`
 * graphs, not joins in the role model.
 *
 * ## No second answer
 *
 * `health` and `todos` already have machinery (`bun run cat health`, the todo
 * pipeline), so each family asks something no existing gate asks; no other
 * gate declares `@covers health` or `@covers todos`.
 *
 * ## Determined empties are reported as such
 *
 * Over a small corpus "clean" says little, so **every family prints what it
 * examined**: an empty walk is not a clean one.
 *
 * Exit codes: 0 clean · 1 a finding (under `--check`) · 2 a graph could not be read,
 * or (under `--check`) an unknown flag. `--check` is the JUDGE form: it
 * computes, judges and writes nothing; the bare form writes the sidecar and
 * exits 0 on findings.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

import { directoriesForGraph, directoryEntriesForGraph, layerRootsIn, repoRootFor } from "../schemas/kg/cat-harness.js";
import { absenceAt } from "./branch-store.ts";
// The producer's OWN hash, not a re-derivation. See `healthProducerCurrent`.
import { checkerHash } from "../test/health/run.js";
import {
  againstOrUsage,
  buildQaResult,
  concludeJudgement,
  judgementOf,
  judgeUsage,
  judging,
  mayLeaveMain,
  writeQaResult,
  type Judgement,
  type QaResult,
} from "./qa-results.js";
import { readQaTree } from "./qa-store.js";
import { isDirectoryReadme } from "../schemas/kg/kg-node.ts";
import { HARNESS_ROOT, TOOLS_ROOT } from "./lib/roots.ts";
import { parse as parseYaml } from "yaml";
import { BOARD_POSITIONS_SCHEMA_TAG, BoardPositionsSchema, renderPositions } from "../schemas/ui/board-positions.ts";

const ROOT = HARNESS_ROOT;
const REPO = repoRootFor(ROOT);

/** One family's verdict. `examined` is the denominator, and it is never optional. */
export interface Family {
  id: string;
  /** What a FAILURE means, in one line. */
  summary: string;
  /** How many subjects were looked at. `0` is could-not-determine, not clean. */
  examined: number;
  findings: { where: string; detail: string }[];
  /**
   * The directories walked, when the family walks declared directories. With
   * `examined: 0` this is what makes the result a DETERMINED empty — the
   * declared directory exists and holds no node — rather than a blind one.
   */
  walked?: string[];
  /** Set when the graph could not be read at all. */
  unreadable?: string;
  /**
   * Set instead of `unreadable` when the graph that would hold this family's
   * nodes was DETERMINED absent from this checkout by `state:mount` (its
   * `.absent` record): platform state a mounted layer declares for every
   * checkout, which this root neither declares nor carries
   * (cat-harness-tools#1701). Neither a pass nor a blind spot, and not gated.
   */
  notApplicable?: string;
  /**
   * Set when the subject is a STORED record that is not here — the health
   * report once it leaves `main` for the `qa-reports` branch (bean `0dav`) —
   * and no `--against <ref>` was given, or the branch had no answer. Reported
   * UNKNOWN and never a pass, but not gated: proposal §2.3, an unwritten
   * baseline is not this change's defect. Distinct from `unreadable`, which
   * is a blind spot in the run itself and does fail (2).
   */
  stored?: string;
}

/**
 * Every file of a kind, across every layer that declares a directory for it.
 *
 * ## DEDUPED, and the duplicate is not hypothetical
 *
 * Two layer roots can resolve one kind to the SAME directory: measured
 * 2026-09-24, the repository root and `cat-harness` both resolve `todos` to
 * `./todos`, so a naive walk listed three todo items as six and reported one
 * planted defect twice. That is worse than a cosmetic double-count — it inflates
 * the denominator §1.2a exists to make trustworthy, and a doubled finding reads
 * as two subjects needing two repairs.
 *
 * Deduped on both levels because they fail independently: the directory set, so
 * one tree is walked once, and the file set, since two declared directories may
 * still overlap by nesting.
 */
/**
 * Every root whose declaration may name a directory: each layer, AND the
 * checkout root itself. Until the separation the checkout root WAS a layer
 * (folio-assistant.json), and it declared `beans/`; now the index checkout
 * declares nothing and `beans/` is declared `scope: "repository"` by
 * cat-harness, which only a lookup FROM the checkout resolves. Asking the
 * layers alone found no `merge-queue` or `session-survey` directory and
 * reported both families could-not-determine over a mounted store holding them.
 */
function declaringRoots(): string[] {
  return [...new Set([resolve(REPO), ...layerRootsIn(REPO).map((r) => resolve(r))])];
}

function nodesOf(kind: string, ext: string): string[] {
  const dirs = new Set<string>();
  for (const inst of declaringRoots()) for (const dir of directoriesForGraph(inst, kind)) dirs.add(resolve(dir));
  const out = new Set<string>();
  for (const dir of dirs) {
    const walk = (d: string): void => {
      let entries: string[];
      try {
        entries = readdirSync(d);
      } catch {
        return;
      }
      for (const e of entries) {
        if (e.startsWith(".")) continue;
        const p = join(d, e);
        if (statSync(p).isDirectory()) walk(p);
        else if (p.endsWith(ext) && !isDirectoryReadme(p)) out.add(resolve(p));
      }
    };
    walk(dir);
  }
  return [...out].sort();
}

/**
 * `health` — a committed result must come from the producer that exists NOW.
 *
 * ## The defect, measured rather than imagined
 *
 * 2026-09-24. `repository.health-report.json` recorded
 * `producer.script_hash: 760c506fd051`; `test/health/run.ts` hashed
 * `f04884b20163`. So the committed result was written by a version of the
 * producer that no longer exists — and the consequence is not abstract. That
 * result's staging finding still told a reader to *"have the owner add
 * `staging:cleanup` to the PRs whose previews are finished with"*, which bean
 * `7umv` had already PROVED cannot reach an orphaned preview: the cleanup job
 * fires on `pull_request: closed`, and being findable as an orphan requires the
 * pull request to be closed already.
 *
 * So a person reading the committed health report was being told to do
 * something this repository had established was impossible. **Not a staleness
 * nit: an action that cannot work, presented as the remedy.**
 *
 * ## Why the HASH and not the timestamp
 *
 * A result is allowed to be old — `bun run cat health` runs daily and a quiet day
 * changes nothing, which is the whole reason `writeQaResult` does not rewrite
 * an unchanged sidecar. What is not allowed is a result whose PRODUCER moved,
 * because then the advice inside it is the old code's advice. Age is a proxy;
 * the hash is the fact. Same discipline as bean `nytj`.
 *
 * ## It calls the producer's OWN hash function, and the first version did not
 *
 * This asks `checkerHash()` rather than hashing `producer.script`. The first
 * version recomputed `sha256(run.ts)` and could **never** have passed: that
 * field records `checkerHash`, which hashes THREE modules — `checks.ts`,
 * `probes.ts` and `run.ts` — because any of them changing can alter a verdict.
 * Re-running `bun run cat health` moved the recorded hash and the check stayed red,
 * which is how the mistake surfaced.
 *
 * So the general rule, and it is the one this file exists to obey rather than
 * to restate: **a staleness check calls the producer's own hash function; it
 * never re-derives one.** A re-derived hash makes a check that cannot pass, and
 * a check that cannot pass is indistinguishable from a corpus that cannot be
 * fixed — which is worse than no check, because somebody eventually deletes it.
 */
/**
 * How long a report written by an OLD producer is still accepted: one daily
 * `health` cycle plus slack. Owner, 2026-11-01 (Q-FAD-6 A): any edit to the
 * checker moved the hash for every stored report at once, so the re-pin that
 * brought the edit in was the PR this check blocked, and every repository had
 * to re-run before any could re-pin. The daily run rewrites the report at the
 * new producer within a day; past that, a mismatch is a real finding.
 */
export const HEALTH_PRODUCER_GRACE_HOURS = 26;

/**
 * Is a report under `root` this repository's OWN, rather than one a mounted
 * layer carries? Only the own report is judged here: each other report is
 * written at its repository's own tools pin and judged by that repository's
 * own CI, which is the only place its producer is known (Q-FAD-6 A).
 */
export function isOwnHealthReport(path: string, repo: string, instanceRoots: readonly string[]): boolean {
  const p = resolve(path);
  const r = resolve(repo);
  return !instanceRoots.some((root) => {
    const i = resolve(root);
    return i !== r && (p === i || p.startsWith(i + sep));
  });
}

/** The finding for one report, or `undefined` when it is current or still in its grace period. Pure. */
export function judgeHealthReport(
  text: string,
  accepted: readonly string[],
  now: Date,
): { detail: string } | undefined {
  let node: { producer?: { script?: string; script_hash?: string }; updated_at?: string };
  try {
    node = JSON.parse(text) as typeof node;
  } catch (e) {
    return { detail: `does not parse as JSON: ${String(e)}` };
  }
  const script = node.producer?.script;
  const recorded = node.producer?.script_hash;
  if (!script || !recorded) return { detail: "records no producer, so it cannot be told from a result nobody produced" };
  if (accepted.includes(recorded)) return undefined;
  const written = Date.parse(node.updated_at ?? "");
  const ageHours = (now.getTime() - written) / 3_600_000;
  if (!Number.isNaN(written) && ageHours >= 0 && ageHours <= HEALTH_PRODUCER_GRACE_HOURS) return undefined;
  return {
    detail:
      `written by \`${script}\` at ${recorded}${Number.isNaN(written) ? " (no readable updated_at)" : `, ${Math.round(ageHours)} h ago`}; ` +
      `the checker is now ${accepted[0]}. Past the ${HEALTH_PRODUCER_GRACE_HOURS} h grace the daily run should have rewritten it: ` +
      "re-run `bun run cat health`, or the remedies in it are the old producer's.",
  };
}

export function healthProducerCurrent(opts: { against?: string; now?: Date } = {}): Family {
  const f: Family = {
    id: "health-result-is-from-the-current-producer",
    summary:
      "A committed health result was written by a version of its producer that no longer exists, so " +
      "the remedies it states are the old code's remedies — which is how a reader is told to do " +
      "something the repository has since established cannot work (bean `7umv`).",
    examined: 0,
    findings: [],
  };
  const roots = layerRootsIn(REPO);
  const allLocal = nodesOf("health", ".json");
  // Mounted layers' reports are left to their own repositories (Q-FAD-6 A).
  const local = allLocal.filter((p) => isOwnHealthReport(p, REPO, roots));
  // ── Where the report is: here, or on the `qa-reports` branch (bean `0dav`) ──
  //
  // A result in the checkout is judged as it always was. With none here and a
  // declared `health` directory that may leave `main`, the report is a STORED
  // record: read through qa-store with `--against <ref>`, or reported UNKNOWN.
  // It is never "no results, so nothing is stale".
  let results: { where: string; text: () => string }[] = local.map((p) => ({
    where: relative(REPO, p),
    text: () => readFileSync(p, "utf-8"),
  }));
  if (results.length === 0) {
    const declared = new Set<string>();
    for (const inst of declaringRoots()) for (const dir of directoriesForGraph(inst, "health")) declared.add(resolve(dir));
    // `health` is a kind the arc moves off `main` (`OFF_MAIN_KINDS`), so a
    // declared directory that is not here is a stored record, not a blind spot.
    const leaves = mayLeaveMain({ graphTypologies: ["health"] });
    const movable = leaves ? [...declared].filter((d) => !existsSync(d)) : [];
    if (declared.size === 0 || movable.length === 0) {
      f.unreadable = "no instance declares a `health` directory holding a result — could not determine";
      return f;
    }
    if (opts.against === undefined) {
      f.stored =
        `no health report in this checkout (${movable.map((d) => relative(REPO, d)).join(", ")}) — it leaves \`main\` ` +
        "with the qa-reports arc. Pass --against <ref> to judge the stored one";
      return f;
    }
    const stored: { where: string; text: () => string }[] = [];
    for (const d of movable) {
      const t = readQaTree(opts.against, d);
      if (t.state !== "hit") {
        f.stored = `qa-reports:${opts.against} — ${t.state}: ${t.reason}`;
        return f;
      }
      for (const [path, text] of t.files) {
        if (path.endsWith(".json") && !isDirectoryReadme(path)) stored.push({ where: `qa-reports:${t.key}/${path}`, text: () => text });
      }
    }
    results = stored;
  }
  f.examined = results.length;
  const current = checkerHash();
  // Bean `8lcl` (#952) relocated `schemas/` into `cat-harness-tools/schemas/`,
  // changing `from "@litlfred/cat-harness/schemas/` to `from "../../schemas/`
  // in `test/health/{checks,probes,run}.ts` with zero change to health-checker
  // logic. Accept reports stamped immediately before that import-path move.
  const preRelocation = (() => {
    try {
      const h = createHash("sha256");
      for (const rel of ["test/health/checks.ts", "test/health/probes.ts", "test/health/run.ts"]) {
        const text = readFileSync(resolve(TOOLS_ROOT, rel), "utf-8").replaceAll(
          'from "../../schemas/',
          'from "@litlfred/cat-harness/schemas/',
        );
        h.update(text);
      }
      return h.digest("hex").slice(0, 12);
    } catch {
      return current;
    }
  })();
  if (results.length === 0) {
    f.stored = `qa-reports:${opts.against} holds no health report under the declared directories`;
    return f;
  }
  const now = opts.now ?? new Date();
  for (const r of results) {
    const finding = judgeHealthReport(r.text(), [current, preRelocation], now);
    if (finding) f.findings.push({ where: r.where, ...finding });
  }
  return f;
}

/**
 * `todos` — a `processes:` entry must name a BPMN process that exists.
 *
 * The `dh4f` shape at a different subject: a todo that routes a reader to a
 * process id nothing declares sends them looking for a diagram that is not
 * there, and the front matter still validates, because the schema's job is to
 * say what a valid value LOOKS like and `Process_Whatever` looks fine.
 *
 * A determined empty as of 2026-09-24 — two references across three items,
 * both resolving against 68 declared processes — and that is exactly why the
 * denominator is printed.
 */
export function todoProcessRefs(): Family {
  const f: Family = {
    id: "todo-process-references-resolve",
    summary:
      "A todo item's `processes:` entry names a BPMN process id that no diagram declares, so a reader " +
      "following it looks for a process that is not there. The schema cannot catch it: an id that " +
      "resolves to nothing is still a well-formed string.",
    examined: 0,
    findings: [],
  };
  const ids = new Set<string>();
  for (const p of nodesOf("processes", ".bpmn")) {
    try {
      for (const m of readFileSync(p, "utf-8").matchAll(/<bpmn:process[^>]*\bid="([^"]+)"/g)) ids.add(m[1]!);
    } catch {
      /* a malformed diagram is `xml-comment-check`'s finding, not this one */
    }
  }
  if (ids.size === 0) {
    f.unreadable = "no BPMN process ids were found, so every reference would fail — could not determine";
    return f;
  }
  const items = nodesOf("todos", ".md");
  f.examined = items.length;
  for (const p of items) {
    const text = readFileSync(p, "utf-8");
    const block = text.match(/^processes:\n((?:[ \t]+-[ \t]+.*\n)+)/m);
    if (!block) continue;
    for (const m of block[1]!.matchAll(/-[ \t]+(.+)/g)) {
      const ref = m[1]!.trim().replace(/^["']|["']$/g, "");
      if (!ids.has(ref)) {
        f.findings.push({ where: relative(REPO, p), detail: `names process \`${ref}\`, which no diagram declares` });
      }
    }
  }
  return f;
}

/**
 * `issue-marks` — a mark must account for EDITS, not just for ids.
 *
 * This is the hazard the kind was split to carry, in `issue-working`'s words: a
 * comment edited after being read **keeps its id**, so `lastCommentId` alone
 * would call it seen, and an edited requirement is a changed requirement. Two
 * ways a mark fails that:
 *
 * - it records an id and no `lastUpdatedAt`, so edits are unaccounted for;
 * - its `checkedAt` is EARLIER than its `lastUpdatedAt`, which claims the agent
 *   looked before the last edit it says it accounted for. That is not a
 *   tolerance question: it is internally inconsistent, and the mark is
 *   reporting more than it knows.
 *
 * A determined empty as of 2026-09-24 over two marks.
 */
export function issueMarkEdits(): Family {
  const f: Family = {
    id: "issue-mark-accounts-for-edits",
    summary:
      "A mark records how far an agent has read an issue. A comment EDITED after being read keeps its " +
      "id, so a mark with no `lastUpdatedAt` calls an edited requirement seen — and one whose " +
      "`checkedAt` precedes its `lastUpdatedAt` claims to have looked before the edit it accounts for.",
    examined: 0,
    findings: [],
  };
  const marks = nodesOf("issue-marks", ".json");
  f.examined = marks.length;
  if (marks.length === 0) {
    f.unreadable = "no instance declares an `issue-marks` directory holding a mark — could not determine";
    return f;
  }
  for (const p of marks) {
    let n: { lastCommentId?: number; lastUpdatedAt?: string; checkedAt?: string };
    try {
      n = JSON.parse(readFileSync(p, "utf-8")) as typeof n;
    } catch (e) {
      f.findings.push({ where: relative(REPO, p), detail: `does not parse as JSON: ${String(e)}` });
      continue;
    }
    const where = relative(REPO, p);
    if (n.lastCommentId !== undefined && n.lastUpdatedAt === undefined) {
      f.findings.push({ where, detail: "records `lastCommentId` and no `lastUpdatedAt`, so an edited comment reads as seen" });
    }
    if (n.lastUpdatedAt && n.checkedAt) {
      const edited = Date.parse(n.lastUpdatedAt);
      const checked = Date.parse(n.checkedAt);
      if (Number.isNaN(edited) || Number.isNaN(checked)) {
        f.findings.push({ where, detail: "carries a timestamp that does not parse, so the mark cannot be read at all" });
      } else if (checked < edited) {
        f.findings.push({
          where,
          detail: `checkedAt ${n.checkedAt} is BEFORE lastUpdatedAt ${n.lastUpdatedAt} — the mark claims to have looked before the edit it accounts for`,
        });
      }
    }
  }
  return f;
}

/**
 * `interaction` — a declared profile must be read by something.
 *
 * Straight `dh4f`: declared and read by nothing. A profile nobody consumes is
 * an accommodation the person has stated and no agent will honour, which is
 * the most expensive version of that defect in this repository — it fails
 * silently, at the one person it is about.
 *
 * A determined empty as of 2026-09-24: `low-dexterity` is named by 36 files.
 * The search is over PROSE AND CODE on purpose, because a profile is honoured
 * by an agent reading a skill at least as often as by a branch in a script.
 */
export function interactionProfilesRead(): Family {
  const f: Family = {
    id: "interaction-profile-is-read",
    summary:
      "A profile declared in the interaction graph that nothing in the corpus names. The person has " +
      "stated an accommodation and no skill or script will honour it — `dh4f` at the subject where " +
      "it costs the most, because it fails silently and at one person.",
    examined: 0,
    findings: [],
  };
  const nodes = nodesOf("interaction", ".json");
  if (nodes.length === 0) {
    f.unreadable = "no instance declares an `interaction` directory — could not determine";
    return f;
  }
  const profiles = new Map<string, string>();
  for (const p of nodes) {
    let n: { users?: Record<string, { profiles?: string[] }>; default?: { profiles?: string[] } };
    try {
      n = JSON.parse(readFileSync(p, "utf-8")) as typeof n;
    } catch (e) {
      f.findings.push({ where: relative(REPO, p), detail: `does not parse as JSON: ${String(e)}` });
      continue;
    }
    for (const u of Object.values(n.users ?? {})) for (const prof of u.profiles ?? []) profiles.set(prof, relative(REPO, p));
    for (const prof of n.default?.profiles ?? []) profiles.set(prof, relative(REPO, p));
  }
  f.examined = profiles.size;
  if (profiles.size === 0) return f;

  // Read the corpus once and test every profile against it, rather than
  // shelling out per profile: the answer is the same and one walk is honest
  // about what it covered.
  const haystack: string[] = [];
  const seen = new Set<string>();
  const walk = (d: string): void => {
    if (seen.has(d)) return;
    seen.add(d);
    let entries: string[];
    try {
      entries = readdirSync(d, { withFileTypes: true }).map((e) => e.name + (e.isDirectory() ? "/" : ""));
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.startsWith(".") || e.startsWith("node_modules") || e.replace(/\/$/, "") === "worktrees") continue;
      const p = join(d, e.replace(/\/$/, ""));
      if (e.endsWith("/")) walk(p);
      else if (/\.(ts|tsx|md|sh|json|ya?ml)$/.test(p) && !p.includes("/interaction/")) {
        try {
          haystack.push(readFileSync(p, "utf-8"));
        } catch {
          /* unreadable file: not this check's finding */
        }
      }
    }
  };
  // RESOLVED through the declaration, not listed. The first version walked
  // `skills`, `scripts`, `schemas` and `src` as literals, and
  // `check:declared-paths` caught two of them — which is the defect class this
  // very family is about, committed one function away from it: a hardcoded
  // directory is a declaration read from memory, and it goes stale the moment
  // anybody relocates one. It also under-searched: a literal list covers THIS
  // layer, while a profile may be honoured by a dependency's skill.
  for (const inst of declaringRoots()) {
    for (const kind of ["cat-harness", "skills", "code", "schemas"]) {
      for (const dir of directoriesForGraph(inst, kind)) walk(dir);
    }
  }
  // `.claude/` is a local convention rather than a declared graph — the same
  // exception `check-retired-front-matter` makes, and for the same reason.
  walk(join(REPO, ".claude"));

  for (const [prof, where] of profiles) {
    if (!haystack.some((t) => t.includes(prof))) {
      // The message says what was ACTUALLY walked, not a list written here. A
      // remedy naming directories the search may not have covered sends the
      // reader to the wrong place — the same defect as the hardcoded walk above,
      // one layer out, and the one `AGENTS.md` keeps paying for when prose
      // quotes a directory set instead of counting one.
      f.findings.push({
        where,
        detail: `declares profile \`${prof}\`, which none of the ${haystack.length} file(s) across ${seen.size} declared director(ies) names`,
      });
    }
  }
  return f;
}

// ── The five kinds the nested declarations surfaced (PR #2094) ────────────
//
// `beans/beans.json` and `todos/todos.json` declare their inner directories as
// kinds of their own. Once `resolveDirectories` admitted nested declarations,
// `audit-coverage` counted `merge-queue`, `session-survey`, `todo-items`,
// `todo-feedback` and `board-positions` separately — each TYPED by a declared
// validator and JUDGED by nothing. One family each below, in the shape of the
// four above: each asks something the schema structurally cannot (a fact
// about a file's NAME, or about another node), each was checked against the
// gates that already cover the parent kind, and each prints what it walked,
// because three of the five are determined empties or near it on this tree.

/**
 * The declared directories of one kind that exist, or `undefined` when no
 * layer declares one that does. A declared-but-absent directory is
 * `check:declared-dirs`'s finding; here it means there is nothing to walk, and
 * a family that walked nothing must say so rather than pass.
 */
function declaredDirs(kind: string): string[] | undefined {
  const dirs = new Set<string>();
  for (const inst of declaringRoots()) {
    for (const dir of directoriesForGraph(inst, kind)) if (existsSync(dir)) dirs.add(resolve(dir));
  }
  return dirs.size === 0 ? undefined : [...dirs].sort();
}

/** The files directly in `dirs` ending `ext` — not a recursive walk, since each kind here is declared per directory. */
function filesIn(dirs: readonly string[], ext: string): string[] {
  const out = new Set<string>();
  for (const d of dirs) {
    let entries: string[];
    try {
      entries = readdirSync(d);
    } catch {
      continue;
    }
    for (const e of entries) {
      const p = join(d, e);
      if (!e.startsWith(".") && e.endsWith(ext) && !isDirectoryReadme(p) && statSync(p).isFile()) out.add(resolve(p));
    }
  }
  return [...out].sort();
}

/** Where a family looked, for the line it prints — relative, so it reads the same in CI. */
function walkedLabel(dirs: readonly string[]): string {
  return dirs.map((d) => relative(REPO, d) || ".").join(", ");
}

/**
 * Every bean id in the store, read off the file names (`<id>--<slug>.md`, the
 * layout the `beans` CLI writes) across every declared `bean-defs` directory —
 * `defs` AND `defs/archive`, because bean `e8m3` made archiving a view: an
 * archived bean is still a bean, and a reference to one still resolves.
 */
export function beanIdsInStore(): Set<string> {
  const ids = new Set<string>();
  for (const p of nodesOf("bean-defs", ".md")) {
    const name = p.slice(p.lastIndexOf("/") + 1);
    const cut = name.indexOf("--");
    if (cut > 0) ids.add(name.slice(0, cut));
  }
  return ids;
}

/**
 * `merge-queue` — an entry is filed under the pull request it decides about,
 * and the beans it serves exist.
 *
 * `MergeQueueEntrySchema` documents the layout — *"one entry, one file:
 * `<merge-queue>/<owner>--<repo>--<pr>.json`"* — and cannot enforce it, because
 * a schema sees the document and never its path. An entry whose name and
 * content disagree is two answers to "which PR is this about": the steward
 * looks one up by NAME, so an entry named for #2075 carrying `pr: 2078` is a
 * decision about #2078 that nobody consulting #2078 will find, and a second
 * entry for #2078 can then sit beside it holding the opposite decision.
 *
 * And `beans[]` is a list of ids the schema can only check the SHAPE of: a
 * well-formed id that names no bean says this PR serves work that does not
 * exist — `dh4f` at one remove. Archived beans count as present (bean `e8m3`).
 *
 * No other gate reads `beans/queue/`: `merge-queue.ts` declares `@covers none`
 * and the steward reads entries without judging them. Measured 2026-10-04: 8
 * entries, 14 bean references, 0 findings.
 */
export function mergeQueueEntriesNamed(opts: { dirs?: string[]; beans?: ReadonlySet<string> } = {}): Family {
  const f: Family = {
    id: "merge-queue-entry-is-named-for-its-pr",
    summary:
      "A merge-queue entry is filed under a name that is not `<owner>--<repo>--<pr>.json` for the " +
      "repository and PR it records, so a steward looking the PR up by name finds nothing — or finds a " +
      "second entry with the opposite decision — or it names a bean the store does not hold.",
    examined: 0,
    findings: [],
  };
  const dirs = opts.dirs ?? declaredDirs("merge-queue");
  if (dirs === undefined) {
    f.unreadable = "no instance declares a `merge-queue` directory that exists — could not determine";
    return f;
  }
  f.walked = dirs;
  const beans = opts.beans ?? beanIdsInStore();
  const files = filesIn(dirs, ".json");
  for (const p of files) {
    const where = relative(REPO, p);
    let n: { $schema?: string; repository?: string; pr?: number; beans?: string[] };
    try {
      n = JSON.parse(readFileSync(p, "utf-8")) as typeof n;
    } catch (e) {
      f.findings.push({ where, detail: `does not parse as JSON: ${String(e)}` });
      f.examined++;
      continue;
    }
    // The file declares what it is; an untagged JSON here is not an entry.
    if (n.$schema !== "folio-merge-queue-entry/v1") continue;
    f.examined++;
    const [owner, repo] = (n.repository ?? "").split("/");
    const expected = `${owner}--${repo}--${n.pr}.json`;
    const name = p.slice(p.lastIndexOf("/") + 1);
    if (name !== expected) {
      f.findings.push({
        where,
        detail: `records ${n.repository}#${n.pr}, so it belongs at \`${expected}\` — under this name a steward looking up the PR will not find it`,
      });
    }
    if (beans.size === 0) continue; // no store to resolve against: reported once, below
    for (const b of n.beans ?? []) {
      if (!beans.has(b)) f.findings.push({ where, detail: `serves bean \`${b}\`, which no declared \`bean-defs\` directory holds` });
    }
  }
  if (beans.size === 0 && files.length > 0) {
    f.unreadable = "no bean ids were found in any declared `bean-defs` directory, so no reference could resolve — could not determine";
  }
  return f;
}

/**
 * `session-survey` — a survey is filed under its own upper edge, and its edges
 * agree with its commit count.
 *
 * `survey.ts` writes `<to[0..12]>.json`, and that name is the INDEX: `owed`
 * picks the survey whose `to` is furthest along, and a second survey of the
 * same window lands on the same path and replaces the first. A survey filed
 * under another name escapes both — it can sit beside the survey of its own
 * window, giving two answers to "what does this window still owe", and nothing
 * looking by name sees it.
 *
 * The edges are the second half. `from` is exclusive, so `from === to` is an
 * empty window and `commits > 0` over it is a survey claiming to have read
 * commits it could not contain; `from !== to` with `commits: 0` is the
 * converse. Either way the document contradicts itself, and the schema checks
 * each field alone.
 *
 * No other gate reads `beans/surveys/`. Measured 2026-10-04: 1 survey, 0 findings.
 */
export function surveysFiledByEdge(opts: { dirs?: string[] } = {}): Family {
  const f: Family = {
    id: "survey-is-filed-under-its-upper-edge",
    summary:
      "A session survey is not filed as `<to[0..12]>.json`, so it escapes the index `survey:owed` reads " +
      "and can sit beside a second survey of the same window — or its `from`/`to` edges contradict its " +
      "own `commits` count.",
    examined: 0,
    findings: [],
  };
  const dirs = opts.dirs ?? declaredDirs("session-survey");
  if (dirs === undefined) {
    f.unreadable = "no instance declares a `session-survey` directory that exists — could not determine";
    return f;
  }
  f.walked = dirs;
  for (const p of filesIn(dirs, ".json")) {
    const where = relative(REPO, p);
    let n: { $schema?: string; from?: string; to?: string; commits?: number };
    try {
      n = JSON.parse(readFileSync(p, "utf-8")) as typeof n;
    } catch (e) {
      f.findings.push({ where, detail: `does not parse as JSON: ${String(e)}` });
      f.examined++;
      continue;
    }
    if (n.$schema !== "folio-session-survey/v1") continue;
    f.examined++;
    const name = p.slice(p.lastIndexOf("/") + 1);
    if (typeof n.to !== "string" || name !== `${n.to.slice(0, 12)}.json`) {
      f.findings.push({ where, detail: `its upper edge is ${String(n.to)}, so it belongs at \`${String(n.to).slice(0, 12)}.json\`` });
    }
    if (n.from !== undefined && n.to !== undefined && typeof n.commits === "number") {
      if (n.from === n.to && n.commits > 0) {
        f.findings.push({ where, detail: `\`from\` equals \`to\` — an empty window — yet it records ${n.commits} commit(s)` });
      } else if (n.from !== n.to && n.commits === 0) {
        f.findings.push({ where, detail: "`from` and `to` differ, yet it records 0 commits — the window cannot be empty" });
      }
    }
  }
  return f;
}

/** The YAML front matter of a Markdown node, or `undefined` when it has none or it will not parse. */
function frontMatterOf(text: string): Record<string, unknown> | undefined {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return undefined;
  try {
    const v = parseYaml(m[1]!) as unknown;
    return v !== null && typeof v === "object" ? (v as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * `todo-items` — a todo's bean references resolve.
 *
 * A todo is a PERSON's item; a bean is the agent work plan. The bridge between
 * the two is `references: [{kind: bean, id}]`, and it is the only edge in the
 * todo node that points into the agent store. The schema types it as a string,
 * so a todo can say "tracked by `folio-assistant-h32d`" about a bean that was
 * never created, and a person following the link finds nothing — while the
 * agent half, looking from the bean, never knew the person was waiting.
 *
 * Asked of `todo-items` and not of `todos`: `todo-process-references-resolve`
 * already reads the same files for `processes:`, a different edge into a
 * different graph. Archived beans count as present (bean `e8m3`). Measured
 * 2026-10-04: 3 items, 4 bean references, 0 findings.
 */
export function todoBeanRefs(opts: { dirs?: string[]; beans?: ReadonlySet<string> } = {}): Family {
  const f: Family = {
    id: "todo-item-bean-references-resolve",
    summary:
      "A todo item's `references:` names a bean the store does not hold, so the one edge from a person's " +
      "item into the agent work plan points at nothing — and the schema cannot tell, because a missing " +
      "bean id is still a well-formed string.",
    examined: 0,
    findings: [],
  };
  const dirs = opts.dirs ?? declaredDirs("todo-items");
  if (dirs === undefined) {
    f.unreadable = "no instance declares a `todo-items` directory that exists — could not determine";
    return f;
  }
  f.walked = dirs;
  const beans = opts.beans ?? beanIdsInStore();
  if (beans.size === 0) {
    f.unreadable = "no bean ids were found in any declared `bean-defs` directory — could not determine";
    return f;
  }
  for (const p of filesIn(dirs, ".md")) {
    const fm = frontMatterOf(readFileSync(p, "utf-8"));
    if (fm?.["$schema"] !== "todo/1.0.0") continue;
    f.examined++;
    const refs = Array.isArray(fm["references"]) ? (fm["references"] as Array<{ kind?: unknown; id?: unknown }>) : [];
    for (const r of refs) {
      if (r?.kind !== "bean") continue;
      if (typeof r.id !== "string" || !beans.has(r.id)) {
        f.findings.push({ where: relative(REPO, p), detail: `references bean \`${String(r.id)}\`, which no declared \`bean-defs\` directory holds` });
      }
    }
  }
  return f;
}

/**
 * `todo-feedback` — every feedback file reads back as the list it was written as.
 *
 * `FeedbackStore.read` answers `[]` for a file that does not parse, and every
 * write path over it is read-modify-write of the whole file
 * (`src/core/feedback.ts`). So a feedback file that is not a JSON array is not
 * a parse error anybody sees: it reads as empty, and the next feedback raised
 * against that block OVERWRITES it — every item in it deleted, silently, by an
 * unrelated edit. A duplicate `id` is the quieter half: the routes find an item
 * by `findIndex`, so the second of two items sharing an id can never be updated
 * or resolved.
 *
 * The validator types one ITEM; nothing asks whether the FILE is readable as the
 * store reads it. A determined empty on this tree — the directory holds no
 * feedback yet — and printed as one.
 */
export function feedbackFilesReadable(opts: { dirs?: string[] } = {}): Family {
  const f: Family = {
    id: "feedback-file-reads-back-as-a-list",
    summary:
      "A feedback file the store would read as EMPTY (it is not a JSON array), so the next feedback on that " +
      "block overwrites every item in it — or two items share an id, so the second can never be updated.",
    examined: 0,
    findings: [],
  };
  const dirs = opts.dirs ?? declaredDirs("todo-feedback");
  if (dirs === undefined) {
    f.unreadable = "no instance declares a `todo-feedback` directory that exists — could not determine";
    return f;
  }
  f.walked = dirs;
  // `<feedbackDir>/<itemId>/<rootName>.json` — the store's own layout, one level down.
  const files = nodesUnder(dirs, ".json");
  for (const p of files) {
    f.examined++;
    const where = relative(REPO, p);
    let items: unknown;
    try {
      items = JSON.parse(readFileSync(p, "utf-8"));
    } catch (e) {
      f.findings.push({ where, detail: `does not parse as JSON (${String(e)}) — the store reads it as empty and the next write deletes it` });
      continue;
    }
    if (!Array.isArray(items)) {
      f.findings.push({ where, detail: "is not a JSON array — the store reads it as a list, and the next write replaces it" });
      continue;
    }
    const seen = new Set<string>();
    for (const it of items as Array<{ id?: unknown }>) {
      const id = typeof it?.id === "string" ? it.id : undefined;
      if (id === undefined) continue; // an id-less item is the validator's finding
      if (seen.has(id)) f.findings.push({ where, detail: `two items share id \`${id}\`, so the second can never be updated or resolved` });
      seen.add(id);
    }
  }
  return f;
}

/** Every file ending `ext` at any depth under `dirs`, minus directory READMEs. */
function nodesUnder(dirs: readonly string[], ext: string): string[] {
  const out = new Set<string>();
  const walk = (d: string): void => {
    let entries: string[];
    try {
      entries = readdirSync(d);
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.startsWith(".")) continue;
      const p = join(d, e);
      if (statSync(p).isDirectory()) walk(p);
      else if (p.endsWith(ext) && !isDirectoryReadme(p)) out.add(resolve(p));
    }
  };
  for (const d of dirs) walk(d);
  return [...out].sort();
}

/**
 * `board-positions` — the layout layer points at boards that exist, and is
 * written in the order that keeps it mergeable.
 *
 * The arrow is folio → board → position → note, and the layer may point only
 * forwards. A positions document keyed by a board id that no `folio-board/v1`
 * file declares is layout for a board that was deleted or renamed: an orphan
 * in the LAYER, which `board-diagram-interchange` says is swept from the layer
 * — and nothing reported one. `orphanPositions` asks the note half and has no
 * caller outside its tests; the board half was asked nowhere.
 *
 * Canonical order is the second half. `schemas/ui/board-positions.ts` calls it
 * *"the mergeability guarantee, not a tidiness pass"*: two sessions placing two
 * notes merge cleanly only while the line order is a function of the content.
 * A hand edit or a writer that skipped `renderPositions` breaks that, and the
 * schema parses the result happily.
 *
 * A determined empty on this tree: `todos/boards/` holds five boards and no
 * positions document yet — no note has been moved.
 */
export function boardPositionsPointAtBoards(opts: { dirs?: string[]; boardDirs?: string[] } = {}): Family {
  const f: Family = {
    id: "board-positions-point-at-declared-boards",
    summary:
      "A board-positions document lays out a board no `folio-board/v1` file declares — an orphan in the " +
      "layout layer — or is not written in canonical order, which breaks the guarantee that two sessions " +
      "moving two notes merge cleanly.",
    examined: 0,
    findings: [],
  };
  const dirs = opts.dirs ?? declaredDirs("board-positions");
  if (dirs === undefined) {
    f.unreadable = "no instance declares a `board-positions` directory that exists — could not determine";
    return f;
  }
  f.walked = dirs;
  const boardIds = new Set<string>();
  for (const p of filesIn(opts.boardDirs ?? declaredDirs("boards") ?? [], ".json")) {
    try {
      const b = JSON.parse(readFileSync(p, "utf-8")) as { $schema?: string; id?: string };
      if (b.$schema === "folio-board/v1" && typeof b.id === "string") boardIds.add(b.id);
    } catch {
      /* a malformed board is the validator's finding */
    }
  }
  for (const p of filesIn(dirs, ".json")) {
    const where = relative(REPO, p);
    const text = readFileSync(p, "utf-8");
    let doc: unknown;
    try {
      doc = JSON.parse(text);
    } catch {
      continue; // not parseable: not declaring itself a positions document; the validator's to report
    }
    if ((doc as { $schema?: string }).$schema !== BOARD_POSITIONS_SCHEMA_TAG) continue;
    f.examined++;
    const parsed = BoardPositionsSchema.safeParse(doc);
    if (!parsed.success) {
      f.findings.push({ where, detail: `does not parse as a positions document: ${parsed.error.issues[0]?.message ?? "invalid"}` });
      continue;
    }
    for (const board of Object.keys(parsed.data.boards).sort()) {
      if (!boardIds.has(board)) {
        f.findings.push({ where, detail: `lays out board \`${board}\`, which no \`folio-board/v1\` file declares — an orphan in the layer` });
      }
    }
    if (renderPositions(parsed.data) !== text) {
      f.findings.push({ where, detail: "is not in canonical order (`renderPositions`), so two sessions placing two notes no longer merge cleanly" });
    }
  }
  return f;
}

/**
 * Does this run write the committed QA sidecar?
 *
 * Never under `--check` (bean `r7v6`, the write-in-check half of reader-audit
 * rows R11/R21). The gate form CI runs judges and writes nothing. Measured
 * 2026-10-01, a `--check` run over an absent results tree RECREATED
 * `harness-state.qa-results.json`. A gate that writes the record it reports
 * into is the `ymsu` gate-tree-mutation defect. This mirrors `writesReport` in
 * `skill-register.ts` (bean `bo44`), so the two gates answer it the same way.
 */
export function writesSidecar(argv: readonly string[]): boolean {
  return !argv.includes("--check");
}

/** The sidecar document. Pure, so the judge and the writer render ONE computation. */
export function harnessStateDocument(families: readonly Family[]): QaResult {
  return buildQaResult({
    script: relative(REPO, import.meta.path),
    scriptAbsPath: import.meta.path,
    subject: {
      kind: "harness-state",
      id: "health+todos+interaction+issue-marks+merge-queue+session-survey+todo-items+todo-feedback+board-positions",
    },
    families: Object.fromEntries(
      families.map((f) => [
        f.id,
        {
          summary: f.unreadable
            ? `${f.summary} COULD NOT DETERMINE: ${f.unreadable}`
            : f.notApplicable
              ? `${f.summary} NOT APPLICABLE here: ${f.notApplicable}`
              : f.stored
              ? `${f.summary} UNKNOWN (stored record not here): ${f.stored}`
              : `${f.summary} Examined ${f.examined}${f.walked ? ` across ${walkedLabel(f.walked)}` : ""}.`,
          entries: f.findings,
        },
      ]),
    ),
  });
}

/**
 * Bean `bo44`'s four states. Any family that could not be read is `unknown`
 * and outranks a finding; under the gate form any finding fails. A family
 * whose stored record is not here (`stored`, bean `0dav`) is reported UNKNOWN
 * by the caller and decides nothing (proposal §2.3).
 */
export function judgeHarnessState(families: readonly Family[]): Judgement {
  return judgementOf({
    failing: families.reduce((a, f) => a + f.findings.length, 0),
    undetermined: families.some((f) => f.unreadable),
  });
}

/**
 * The graph each family's nodes live in, when that is not the family's own
 * kind: `merge-queue` and `session-survey` are declared from within `beans`,
 * and the three todo kinds from within `todos`. When that graph is absent from
 * this checkout, its nested declarations are too, so the kind resolves to no
 * directory for a reason that is known.
 */
export const FAMILY_CONTAINERS: Readonly<Record<string, readonly string[]>> = {
  "issue-mark-accounts-for-edits": ["issue-marks"],
  "merge-queue-entry-is-named-for-its-pr": ["beans"],
  "survey-is-filed-under-its-upper-edge": ["beans"],
  "todo-item-bean-references-resolve": ["todos"],
  "feedback-file-reads-back-as-a-list": ["todos"],
  "board-positions-point-at-declared-boards": ["todos"],
  "todo-process-references-resolve": ["todos"],
};

/**
 * Why `graphs` are not this checkout's, when `state:mount` recorded one of
 * them absent here; `undefined` when none was (so the family stays blind).
 * Matched by declared PATH only: an id several mounts share (`health`) must
 * not borrow another graph's record.
 */
export function absentContainer(graphs: readonly string[], repo: string = REPO, roots: readonly string[] = declaringRoots()): string | undefined {
  for (const root of roots) {
    for (const g of graphs) {
      for (const d of directoryEntriesForGraph(root, g)) {
        const rel = relative(repo, d.absPath).split(sep).join("/").replace(/\/+$/, "");
        if (rel.startsWith("..")) continue;
        const a = absenceAt(repo, rel);
        if (a) return `\`${g}\` (${rel}/) is absent from this checkout: ${a.reason}`;
      }
    }
  }
  return undefined;
}

/** A blind family whose container graph is determined absent becomes not applicable. */
export function excuseAbsent(families: Family[], why: (graphs: readonly string[]) => string | undefined = absentContainer): Family[] {
  for (const f of families) {
    const graphs = FAMILY_CONTAINERS[f.id];
    if (!f.unreadable || !graphs) continue;
    const reason = why(graphs);
    if (reason === undefined) continue;
    f.notApplicable = reason;
    delete f.unreadable;
  }
  return families;
}

function main(): number {
  const check = judging();
  if (check) {
    const usage = judgeUsage("check:harness-state", process.argv.slice(2), ["--against"]);
    if (usage !== undefined) return usage;
  }
  const { against, exit: badRef } = againstOrUsage("check:harness-state", process.argv.slice(2));
  if (badRef !== undefined) return badRef;
  const families = excuseAbsent([
    healthProducerCurrent({ against }),
    todoProcessRefs(),
    issueMarkEdits(),
    interactionProfilesRead(),
    mergeQueueEntriesNamed(),
    surveysFiledByEdge(),
    todoBeanRefs(),
    feedbackFilesReadable(),
    boardPositionsPointAtBoards(),
  ]);

  const unreadable = families.filter((f) => f.unreadable);
  const total = families.reduce((a, f) => a + f.findings.length, 0);

  console.log(
    `Harness state graphs  (${families.length} famil(ies) over health, todos, interaction, issue-marks, ` +
      "merge-queue, session-survey, todo-items, todo-feedback, board-positions)",
  );
  for (const f of families) {
    if (f.unreadable) {
      console.log(`  ⚠ ${f.id}: ${f.unreadable}`);
      continue;
    }
    if (f.stored) {
      console.log(`  ? ${f.id}: UNKNOWN — ${f.stored}`);
      continue;
    }
    if (f.notApplicable) {
      console.log(`  · ${f.id}: not applicable here — ${f.notApplicable}`);
      continue;
    }
    // The denominator, always — a family that examined nothing has not passed.
    // Where it walked declared directories it says which, so a determined
    // empty reads as one rather than as a clean pass over nothing.
    const across = f.walked ? ` across ${walkedLabel(f.walked)}` : "";
    console.log(
      f.findings.length === 0
        ? `  ✓ ${f.id}: ${f.examined} examined${across}, 0 findings${f.examined === 0 && f.walked ? " (determined empty: the declared directory holds no node of this kind)" : ""}`
        : `  ✗ ${f.id}: ${f.examined} examined${across}, ${f.findings.length} finding(s)`,
    );
    for (const x of f.findings) console.log(`      · ${x.where} — ${x.detail}`);
  }

  // The gate form (`--check`, wired in CI) judges and writes NOTHING — bean
  // `bo44`. Measured 2026-10-01 with every committed `qa-results/v1` sidecar
  // hand-staled: `check:harness-state:check` rewrote
  // `test/results/harness-state.qa-results.json`, so the gate was a writer of
  // the record it reports into. The bare form is the author's command.
  const doc = harnessStateDocument(families);
  if (!check) writeQaResult(ROOT, "harness-state", doc);
  else {
    return concludeJudgement({
      gate: "check:harness-state",
      judgement: judgeHarnessState(families),
      detail: `${total} finding(s), ${unreadable.length} famil(ies) could not be determined`,
      committed: { root: ROOT, stem: "harness-state", fresh: doc, writer: "check:harness-state" },
      unknowns: families.filter((f) => f.stored).map((f) => `${f.id}: ${f.stored}`),
    });
  }

  if (unreadable.length > 0) {
    // Could-not-determine outranks a finding: a sweep blind on one family has
    // not cleared the others. Same rule `bun run cat health` states for itself.
    console.log(`\n⚠ ${unreadable.length} famil(ies) could not be determined — this is NOT a clean run`);
    return 2;
  }
  if (total === 0) {
    console.log("\n✓ every family examined its corpus and found nothing");
    return 0;
  }
  console.log(`\n${check ? "✗" : "·"} ${total} finding(s) across ${families.filter((f) => f.findings.length).length} famil(ies)`);
  return check ? 1 : 0;
}

if (import.meta.main) process.exit(main());
