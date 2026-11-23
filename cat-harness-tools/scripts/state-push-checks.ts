/**
 * The text checks `state:push` runs on the files it is about to splice.
 *
 * @module scripts/state-push-checks
 * @graphNode none — the pre-splice half of `state-push.ts`
 * @covers none — it judges one push's own edits, never the corpus
 *
 * Bean `asq1`. On 2026-11-05 two failures reached every layer's CI from text,
 * not code: a work item on the state branch (`hd58`) linked to cat-harness's
 * old `skills/sdlc` path, which reddened the subgraph dangling-link test
 * everywhere, and a retired word in prose (cat-harness#1046). A state push
 * splices onto a shared branch with no CI of its own in front of it, so the
 * check has to run here, the way `pre-push-gates.ts` runs before a code push.
 *
 * ## Two checks, each the corpus check's own rule
 *
 * - **dangling links**: `check-subgraphs.ts`'s {@link danglingLinksIn}, the
 *   rule `scanSubgraphs().dangling` applies, judged over the same directory
 *   context the corpus sweep builds from the harness root;
 * - **retired words**: `retired-prose-words.ts`'s {@link findRetiredWords},
 *   with the words the harness declares in its `retired-prose-words` code
 *   list. The work plan is narrative text the harness declares (`beans/` is
 *   cat-harness's directory), and the corpus sweep never reached it only
 *   because it lives off `main`.
 *
 * Neither is reimplemented here: a second copy of "does this link resolve"
 * is free to disagree with the test that reddens CI.
 *
 * ## Only what THIS push introduces
 *
 * A finding is NEW when the file's text at the tip being spliced onto does
 * not already carry it. That text is the blob the mount recorded
 * (`Change.expect`): if the tip holds anything else, the splice is a conflict
 * and nothing is sent, so the comparison is always against what the push
 * would replace. Findings are counted per file and per key (a link target, a
 * retired word), and a key is new when this push raises its count. Failing on
 * any finding would let one old finding block every push to that file.
 *
 * When the tip's text cannot be read, nothing about that file is called new:
 * the file is listed as not compared, and the push goes ahead.
 */
import { join } from "node:path";

import { BranchStore, resolveMarkerInto, storeOptionsFor, type BranchStoreOptions, type Change, type MountMarker } from "./branch-store.js";
import { danglingLinksIn, linkContext } from "./check-subgraphs.ts";
import { findRetiredWords, retiredWordsOf } from "./retired-prose-words.ts";
import { HARNESS_ROOT } from "./lib/roots.ts";

/** One finding this push would introduce. `path` is the path on the branch. */
export interface TextFinding {
  check: "dangling-link" | "retired-word";
  path: string;
  /** What is wrong, ready to print. */
  detail: string;
}

/**
 * How the two checks judge one file's text. `dangling` returns `undefined`
 * when no declared directory would judge the file; `retired` is `undefined`
 * when no list is declared, which skips that check (and says so).
 */
export interface TextChecks {
  dangling?: (file: string, text: string) => string[] | undefined;
  retired?: ReadonlyMap<string, string>;
  /** Why a check could not be set up; printed, never read as clean. */
  notRun?: string[];
}

/** The checks over the harness's real corpus: the same root the CI test sweeps. */
export async function harnessChecks(root: string = HARNESS_ROOT): Promise<TextChecks> {
  const notRun: string[] = [];
  let dangling: TextChecks["dangling"];
  try {
    const ctx = linkContext(root);
    dangling = (file, text) => danglingLinksIn(ctx, file, text);
  } catch (e) {
    notRun.push(`dangling links: could not read the declared directories: ${(e as Error).message}`);
  }
  let retired: TextChecks["retired"];
  try {
    retired = await retiredWordsOf(root);
    if (retired === undefined) notRun.push("retired words: the harness declares no `retired-prose-words` code list");
  } catch (e) {
    notRun.push(`retired words: could not read the code list: ${(e as Error).message}`);
  }
  return { dangling, retired, notRun };
}

/** Each finding's key, with the lines it was found on. */
type Keyed = Map<string, { detail: (n: number) => string; lines: string[] }>;

function judge(checks: TextChecks, file: string, text: string): { links: Keyed; words: Keyed; owned: boolean } {
  const links: Keyed = new Map();
  const dangling = checks.dangling?.(file, text);
  for (const t of dangling ?? []) {
    const k = links.get(t) ?? { detail: () => `links to \`${t}\`, which does not exist`, lines: [] };
    k.lines.push(t);
    links.set(t, k);
  }
  const words: Keyed = new Map();
  if (checks.retired) {
    for (const h of findRetiredWords(text, checks.retired)) {
      const key = h.word.toLowerCase();
      const k = words.get(key) ?? { detail: (n) => `uses the retired word "${key}" (say "${h.instead}") ${n} more time(s)`, lines: [] };
      k.lines.push(`line ${h.line}: ${h.text.slice(0, 100)}`);
      words.set(key, k);
    }
  }
  return { links, words, owned: checks.dangling === undefined || dangling !== undefined };
}

/** The findings in `now` that `before` does not already carry, by count. */
function introduced(check: TextFinding["check"], path: string, now: Keyed, before: Keyed): TextFinding[] {
  const out: TextFinding[] = [];
  for (const [key, { detail, lines }] of now) {
    const had = before.get(key)?.lines.length ?? 0;
    if (lines.length <= had) continue;
    const extra = lines.length - had;
    out.push({ check, path, detail: check === "retired-word" ? `${detail(extra)} — ${lines.join("; ")}` : detail(extra) });
  }
  return out;
}

export interface FileText {
  /** The path on the branch. */
  path: string;
  /** Where the file sits on disk, which is where its links resolve from. */
  abs: string;
  now: string;
  /** The text at the tip; `null` for a file this push creates; `undefined` when it could not be read. */
  before: string | null | undefined;
}

/**
 * The new findings across `files`; the files that could not be compared; and
 * the files whose links were not judged because no declared directory owns
 * them (said, so a mis-resolved harness root is not read as clean).
 */
export function newFindings(
  checks: TextChecks,
  files: readonly FileText[],
): { findings: TextFinding[]; notCompared: string[]; notJudged: string[] } {
  const findings: TextFinding[] = [];
  const notCompared: string[] = [];
  const notJudged: string[] = [];
  for (const f of files) {
    if (f.before === undefined) {
      notCompared.push(f.path);
      continue;
    }
    const now = judge(checks, f.abs, f.now);
    if (!now.owned) notJudged.push(f.path);
    const before = f.before === null ? { links: new Map(), words: new Map() } : judge(checks, f.abs, f.before);
    findings.push(...introduced("dangling-link", f.path, now.links, before.links));
    findings.push(...introduced("retired-word", f.path, now.words, before.words));
  }
  return { findings, notCompared, notJudged };
}

/** Whether a change is a Markdown write these checks read. */
export function isJudgedChange(c: Change): boolean {
  return c.content !== null && c.path.endsWith(".md");
}

/**
 * The texts of a mount's Markdown writes, now and at the tip. The tip's text
 * is the `expect` blob, read from the branch store the push will use.
 */
export function mountTexts(repoRoot: string, m: MountMarker, changes: readonly Change[], store?: BranchStoreOptions): FileText[] {
  const judged = changes.filter(isJudgedChange);
  if (judged.length === 0) return [];
  const resolved = resolveMarkerInto(repoRoot, m);
  if (!resolved.ok) return [];
  const onBranch = m.branchPath ?? m.path;
  let bs: BranchStore | undefined;
  const before = (c: Change): string | null | undefined => {
    if (c.expect === null || c.expect === undefined) return null;
    try {
      bs ??= BranchStore.open(m.branch, { repoRoot, ...storeOptionsFor(m, repoRoot, store) });
      return bs.blobText(c.expect);
    } catch {
      return undefined;
    }
  };
  return judged.map((c) => ({
    path: c.path,
    abs: join(resolved.abs, c.path.slice(onBranch.length + 1)),
    now: Buffer.from(c.content!).toString("utf-8"),
    before: before(c),
  }));
}

/** The report lines for a refusal, and the bypass that overrides it. */
export function findingsReason(findings: readonly TextFinding[]): string {
  // A finding quotes its line, and the reason is printed in a table cell.
  const shown = findings.slice(0, 8).map((f) => `\`${f.path}\` ${f.detail}`.replaceAll("|", "\\|"));
  const more = findings.length > shown.length ? `; and ${findings.length - shown.length} more` : "";
  return (
    `this push would introduce ${findings.length} text finding(s) the CI of every layer fails on: ${shown.join("; ")}${more}. ` +
    `Fix them in the mount and push again, or say why it must land anyway (it is logged): ` +
    `\`CAT_GATES_BYPASS='<reason>' bun run cat state:push\``
  );
}
