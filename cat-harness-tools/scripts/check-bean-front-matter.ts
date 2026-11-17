#!/usr/bin/env bun
/**
 * Every bean's front matter parses as YAML — the check `beans` cannot provide.
 *
 * The `beans` CLI loads the store as a unit, so one malformed bean makes
 * `list`, `roadmap` and `prime` all fail: every agent starting after it gets
 * no work plan from `beans prime`, the first command of the cold start.
 *
 * ## Why `check-bean-bodies` does not already catch it
 *
 * It examines front matter **by regex** (e.g. `isFoldedTitle`), and a regex
 * over a broken document does not notice the document is broken.
 *
 * ## Why this parses when `bean-store-read` deliberately does not
 *
 * `bean-store-read.ts` keeps front matter VERBATIM on purpose — a YAML loader
 * resolves the very folds `isFoldedTitle` exists to see. That module asks
 * *what does this front matter say*; this one asks *is it front matter at
 * all*, so it parses a COPY of the same raw block.
 *
 * ## TWO conditions
 *
 * The `yaml` package rejects a duplicate map key; the Go loader inside `beans`
 * accepts it and takes one of the values. The discriminator is whether a
 * TOLERANT parse (`uniqueKeys: false`) still refuses it:
 *
 * | condition | tolerant parse | what it costs |
 * |---|---|---|
 * | `unparseable` | refuses | the whole store, for every reader, now |
 * | `duplicate-key` | accepts | the file says two things and the winner is the reader's parser |
 *
 * Only the first takes the store down; gating the repository on the second
 * would stop unrelated work.
 *
 * ## No sidecar, and a baseline only for the second
 *
 * No sidecar: `unparseable` must never last long enough to need a history,
 * and it is NEVER baselined (that would ship a store nobody can load).
 *
 * `duplicate-key` IS baselined at the ones the store already carries, so a
 * NEW one fails while the existing ones are listed rather than demanded:
 * outstanding defects are repaired by the bean's OWNER, as in
 * `check-bean-bodies`.
 *
 * ## A third condition across files: `duplicate-id`
 *
 * Two files declaring the same bean id are each valid alone, and the
 * id-keyed readers build `Map`s by id, so the collision would be resolved by
 * overwrite rather than reported. Checked here because this gate sees every
 * file in `defs/` and `archive/` exactly once.
 *
 * Exit: 0 every bean parses (or no store), 1 one does not, 2 could not check.
 *
 * @module folio-assistant/scripts/check-bean-front-matter
 * @covers bean-defs, beans
 */

import { join } from "node:path";

import { parse as parseYaml } from "yaml";

import { repoRootFor } from "../schemas/kg/cat-harness.js";
import { BeanStatusSchema } from "../schemas/tools/tool-types.ts";
import {
  beanDefsDir,
  readBeanStore,
  type BeanStore,
  type SkippedFile,
} from "./bean-store-read.ts";
// The HARNESS, not this layer: these scripts moved up in 70lx B2b and read cat-harness.
import { HARNESS_ROOT } from "./lib/roots.ts";
import { BeanStoreAbsentError, exitIfBeanStoreAbsent } from "./lib/bean-store-absent.ts";

/**
 * The two beans whose front matter carries a duplicate key today.
 *
 * Both are botched conflict resolutions by earlier sessions: `1hvo` has two
 * `title:` lines (a merge whose own message says it "kept both halves"), and
 * `7u3g` has two `updated_at:` lines — which its own body confesses to,
 * having fixed the duplicated BLOCK and left the duplicated key.
 *
 * Listed rather than repaired here, and listed rather than demanded: each is
 * its owner's to fix, and repairing one means CHOOSING which value was meant,
 * which is a judgement about their work. Remove an id from this set when its
 * bean is repaired — the check says so when an entry no longer matches, so a
 * stale baseline cannot quietly excuse a fresh defect under the same id.
 */
// `7u3g` left this set 2026-09-27: its duplicate was `updated_at`, which the
// FIELD settles rather than the owner (bean `kfkh` — see `classifyDuplicate`),
// so it was collapsed to the later write. `1hvo` remains: two authored titles,
// and choosing between them is an editorial act nobody else can make.
const DUPLICATE_KEY_BASELINE = new Set(["folio-assistant-1hvo"]);

/**
 * Ids already declared by more than one file when the `duplicate-id` check
 * landed (bean `4vg7`, 2026-10-03), other than the one that bean repaired.
 *
 * Empty since 2026-10-03: the one entry, `yt7j` (one bean in two divergent
 * files), was repaired by the owner's ruling "keep archive, drop stale" — the
 * completed archive copy keeps the bean, the stale `defs/` copy was removed.
 * A new entry needs the same: a reason, and an owner to choose which file is
 * the bean.
 */
const DUPLICATE_ID_BASELINE = new Set<string>([]);

/** What a loader objected to, and how much it costs. */
export type DefectKind =
  /** Even a tolerant parse refuses it: the store is down for everybody. */
  | "unparseable"
  /** Parses under `beans`' own loader, but a key is given twice. */
  | "duplicate-key"
  /**
   * No parseable `---` fences at all, so no reader here ever sees it.
   *
   * Bean `t6s7`, and the QUIET sibling of `unparseable`. That one takes the
   * store down and announces itself; this one is silent in both directions —
   * every check skips the file, while `beans` loads it as a ghost row with the
   * id taken from the FILENAME, status `?` and no title. Measured: one planted
   * file moved `beans list` 626 -> 627 and left this gate's count at 629, `no
   * NEW defect`, exit 0.
   */
  | "unfenced"
  /**
   * Two or more files declare the same `# <id>` line.
   *
   * Bean `4vg7`, found 2026-10-03 by the `q8ar` SQLite slice builder: two
   * files both declared `folio-assistant-t3n8` for eleven days. Every file
   * parsed, so every per-file check here passed — the defect is a property
   * of the STORE, not of any one file. Every id-keyed reader (`beans`,
   * `claim-bean`, `check-bean-parents`' `byId` map, the dashboard index)
   * resolves one and drops the other without a word, and every commit or
   * issue citing the id is ambiguous. Baselined only at what the store held
   * when this landed ({@link DUPLICATE_ID_BASELINE}), so a NEW one fails.
   */
  | "duplicate-id"
  /**
   * `status:` is missing or not in {@link BeanStatusSchema} (`draft`, `todo`,
   * `in-progress`, `completed`, `scrapped`).
   *
   * `cat-tools-g7ls` was committed with `status: done` (#1089): valid YAML, so
   * `parseYaml` accepted it, while `beans` refuses it, neither `OPEN_STATUSES`
   * nor `CLOSED_STATUSES` contains it, and `milestoneRollup` counts it as
   * `unclassified`.
   */
  | "invalid-status";

/**
 * Which duplicated keys have an answer that is NOT the owner's to give.
 *
 * `updated_at` is written by `beans` on every change, so two values are two
 * writes and the LATER one is the current state. `created_at` is immutable once
 * set, so two values are one truth and a re-statement, and the EARLIER one is
 * it. Neither is a preference, which is what makes them mechanical.
 *
 * Nothing else goes here. `title`, `status`, `type`, `priority` and `parent` are
 * authored: two differing values are two intentions and choosing between them is
 * an editorial act.
 */
export const MECHANICAL_KEYS: Readonly<Record<string, "later" | "earlier">> = {
  updated_at: "later",
  created_at: "earlier",
};

/** What can be done about a duplicated front-matter key, and by whom. */
export type DuplicateResolution =
  /** Both values agree — collapsing loses nothing, so anyone who meets it may. */
  | "collapsible"
  /** The values differ but the FIELD decides which is right (see {@link MECHANICAL_KEYS}). */
  | "mechanical"
  /** The values differ and choosing is an editorial act — the owner's. */
  | "authored";

/**
 * Classify one duplicated key.
 *
 * ## Why three states and not the two bean `kfkh` proposed
 *
 * It proposed *identical-value → collapsible* and *differing-value → the
 * owner's call*. Measured over the two duplicates the store actually carries,
 * 2026-09-27, that split puts both in the owner's lap and one of them does not
 * belong there:
 *
 * | bean | key | values | by the two-way split | actually |
 * |---|---|---|---|---|
 * | `1hvo` | `title` | `…cat-harness/theming/ subgraph…` vs `…cat-harness theming subgraph…` | owner | owner — two authored titles |
 * | `7u3g` | `updated_at` | `15:26:13Z` vs `15:32:27Z` | owner | **mechanical** — the later write is the state |
 *
 * "Repairing one means choosing which value was meant" is true of a title and
 * false of a monotonic timestamp: `beans update` bumps `updated_at` on every
 * change, so there is nothing to choose. Keeping it in the owner's queue is a
 * question nobody needs to answer, sitting in a report that is read for the
 * questions that do.
 */
export function classifyDuplicate(key: string, values: readonly string[]): DuplicateResolution {
  if (new Set(values).size === 1) return "collapsible";
  return key in MECHANICAL_KEYS ? "mechanical" : "authored";
}

/**
 * The value a `mechanical` duplicate collapses to, or `undefined` if the key is
 * not mechanical. Lexicographic comparison is exact for the RFC3339 `Z` stamps
 * `beans` writes, and no other shape is accepted by the front-matter schema.
 */
export function mechanicalWinner(key: string, values: readonly string[]): string | undefined {
  const rule = MECHANICAL_KEYS[key];
  if (rule === undefined) return undefined;
  const sorted = [...values].sort();
  return rule === "later" ? sorted[sorted.length - 1] : sorted[0];
}

/**
 * Every top-level key repeated in a raw front-matter block, with its values.
 *
 * Deliberately a line scan rather than a YAML parse: the block does not parse,
 * which is how we got here. Indented lines and list items are continuations of
 * the key above, so only column-0 `key: value` lines count.
 */
export function duplicatedKeys(frontMatter: string): Array<{ key: string; values: string[] }> {
  const seen = new Map<string, string[]>();
  for (const line of frontMatter.split(/\r?\n/)) {
    if (/^[ \t#-]/.test(line) || !line.includes(":")) continue;
    const [k, ...rest] = line.split(":");
    seen.set(k!.trim(), [...(seen.get(k!.trim()) ?? []), rest.join(":").trim()]);
  }
  return [...seen.entries()].filter(([, v]) => v.length > 1).map(([key, values]) => ({ key, values }));
}

/**
 * Every id declared by more than one bean file, with the files declaring it.
 *
 * Keyed on the `# <id>` line `readBeanStore` already extracts — the id
 * `beans` itself loads by — and spanning `defs/` AND `archive/`, because an
 * archived bean is still resolved by id and archiving one does not free its id.
 * Paths are archive-qualified so the two files can be told apart.
 */
export function duplicateBeanIds(
  beans: ReadonlyArray<{ id: string; file: string; archived: boolean }>,
): Map<string, string[]> {
  const byId = new Map<string, string[]>();
  for (const b of beans) {
    const where = b.archived ? join("archive", b.file) : b.file;
    byId.set(b.id, [...(byId.get(b.id) ?? []), where]);
  }
  return new Map([...byId].filter(([, files]) => files.length > 1));
}

/** One bean whose front matter is defective, or whose id another file also declares. */
export interface FrontMatterDefect {
  readonly kind: DefectKind;
  /** The bean's id, as its `# <id>` line gives it. */
  readonly id: string;
  /** Basename, which is what `beans` itself names in its error. */
  readonly file: string;
  /**
   * 1-based line IN THE FILE, not in the front-matter block.
   *
   * The parser counts from the first line of the block it was handed, and the
   * block starts one line after the opening `---`. Verified against the real
   * `sqtq` failure: the parser said line 7, `beans` said line 8, and line 8 of
   * the file is where the `\1` was. Reporting the parser's number would send a
   * reader to the wrong line of the file they are about to open.
   */
  readonly line: number | null;
  /** The loader's own first line of complaint. */
  readonly message: string;
  /** True for a `duplicate-key` already in {@link DUPLICATE_KEY_BASELINE}. */
  readonly baselined: boolean;
  /**
   * For a `duplicate-key`: the repeated keys, their values, and who can settle
   * each. Absent for every other kind. Reported so a reader can tell a question
   * that needs them from one the field already answers (bean `kfkh`).
   */
  readonly duplicates?: ReadonlyArray<{
    readonly key: string;
    readonly values: readonly string[];
    readonly resolution: DuplicateResolution;
    /** The value a `mechanical` duplicate collapses to. */
    readonly winner?: string;
  }>;
}

export interface FrontMatterReport {
  /** `null` when there is no store at all — not the same as an empty one. */
  readonly beans: number | null;
  readonly defects: FrontMatterDefect[];
  /** Baseline ids that matched nothing — repaired, so the entry should go. */
  readonly staleBaseline: string[];
  /**
   * WHICH absence, when {@link beans} is `null`.
   *
   * `absent` is a layer that legitimately has no bean store and is a pass;
   * `declared-but-absent` is one whose declaration names a directory that is
   * not there, which is `dh4f` and is not. Both were `null` until `t6s7`, and
   * both printed *"no store in this repository, nothing to check"*, exit 0.
   */
  readonly storeState: BeanStore["state"];
  /**
   * Every `.md` the reader could not fence, INCLUDING the expected ones.
   *
   * Carried rather than filtered so the reconciliation below can account for
   * each file exactly once. A `README.md` is `expected` and not a defect; it
   * still has to be somewhere in the arithmetic.
   */
  readonly skipped: SkippedFile[];
  /** Every `.md` in the directory — `beans + skipped` must equal it. */
  readonly filesSeen: number;
}

/**
 * Does every `.md` in the directory appear exactly once in the report?
 *
 * Returns `null` when it does, and the complaint when it does not. A FUNCTION
 * rather than an inline comparison because the read path cannot currently
 * produce a mismatch — every file goes into `beans` or `skipped` — so the only
 * way to feed this guard the condition it exists for is to hand it the numbers
 * directly. A guard whose failing branch has never been executed is the thing
 * bean `t6s7` is about.
 *
 * What it actually protects: a future `continue` in `readBeanStore`'s loop
 * that forgets to record what it dropped. `filesSeen` is counted by a separate
 * traversal, so such an edit makes the two disagree instead of silently
 * undercounting — which is precisely how a bean went missing from every check
 * while the total held steady.
 */
export function reconcile(beans: number, skipped: number, filesSeen: number): string | null {
  const accounted = beans + skipped;
  if (accounted === filesSeen) return null;
  return (
    `${filesSeen} .md file(s) in the store, but ${beans} bean(s) + ${skipped} skipped = ` +
    `${accounted}. A file is unaccounted for, so every count in this report is unreliable`
  );
}

/** `linePos` is the `yaml` package's; every field is optional in its types. */
function lineOf(err: unknown): number | null {
  const pos = (err as { linePos?: { line?: number }[] } | null)?.linePos;
  const line = Array.isArray(pos) ? pos[0]?.line : undefined;
  // +1 for the opening `---`, which is not part of the parsed block.
  return typeof line === "number" ? line + 1 : null;
}

function firstLine(err: unknown): string {
  return (err instanceof Error ? err.message : String(err)).split("\n")[0]!;
}

export function checkBeanFrontMatter(root: string): FrontMatterReport {
  const store = readBeanStore(root);
  if (store.state !== "read") {
    return {
      beans: null,
      defects: [],
      staleBaseline: [],
      storeState: store.state,
      skipped: [],
      filesSeen: 0,
    };
  }
  const files = store.beans;

  const defects: FrontMatterDefect[] = [];
  // FIRST, because a file the reader could not fence never reaches the loop
  // below — that is the defect, not an ordering preference. `id` is the
  // filename stem, which is exactly what `beans` falls back to when the front
  // matter yields nothing, so the gate names the row a person will see.
  for (const sk of store.skipped) {
    if (sk.expected) continue;
    defects.push({
      kind: "unfenced",
      id: sk.file.replace(/\.md$/, ""),
      file: sk.archived ? join("archive", sk.file) : sk.file,
      line: null,
      message:
        "no parseable `---` front-matter fences, so every check here skips the " +
        "file while `beans` loads it as a titleless ghost row",
      baselined: false,
    });
  }
  const seen = new Set<string>();
  for (const b of files) {
    try {
      parseYaml(b.frontMatter);
      if (!BeanStatusSchema.safeParse(b.status).success) {
        const lines = b.frontMatter.split(/\r?\n/);
        const idx = lines.findIndex((l) => /^status:[ \t]*/.test(l));
        defects.push({
          kind: "invalid-status",
          id: b.id,
          file: b.archived ? join("archive", b.file) : b.file,
          line: idx >= 0 ? idx + 2 : null,
          message: b.status
            ? `status ${JSON.stringify(b.status)} is not in BeanStatusSchema (${BeanStatusSchema.options.join(", ")})`
            : `missing status (must be one of ${BeanStatusSchema.options.join(", ")})`,
          baselined: false,
        });
      }
      continue;
    } catch (strict) {
      // The discriminator: would the loader `beans` itself uses accept this?
      // `uniqueKeys: false` is that loader's tolerance for a repeated key, and
      // nothing else — genuinely broken YAML still throws.
      try {
        parseYaml(b.frontMatter, { uniqueKeys: false });
        seen.add(b.id);
        defects.push({
          kind: "duplicate-key",
          id: b.id,
          file: b.file,
          line: lineOf(strict),
          message: firstLine(strict),
          baselined: DUPLICATE_KEY_BASELINE.has(b.id),
          duplicates: duplicatedKeys(b.frontMatter).map(({ key, values }) => {
            const resolution = classifyDuplicate(key, values);
            const winner = resolution === "mechanical" ? mechanicalWinner(key, values) : undefined;
            return { key, values, resolution, ...(winner === undefined ? {} : { winner }) };
          }),
        });
      } catch (tolerant) {
        defects.push({
          kind: "unparseable",
          id: b.id,
          file: b.file,
          line: lineOf(tolerant),
          message: firstLine(tolerant),
          baselined: false,
        });
      }
    }
  }

  // ACROSS files, after the per-file pass: every file can parse cleanly and the
  // store still be wrong. One defect per file, each naming the others, so the
  // report says which files collide without choosing which one is re-id'd.
  const dupIds = duplicateBeanIds(files);
  for (const [id, where] of dupIds) {
    for (const file of where) {
      defects.push({
        kind: "duplicate-id",
        id,
        file,
        line: null,
        message: `id also declared by ${where.filter((f) => f !== file).join(", ")}`,
        baselined: DUPLICATE_ID_BASELINE.has(id),
      });
    }
  }

  const staleBaseline = [
    ...[...DUPLICATE_KEY_BASELINE].filter((id) => !seen.has(id)),
    ...[...DUPLICATE_ID_BASELINE].filter((id) => !dupIds.has(id)),
  ].sort();
  return {
    beans: files.length,
    defects,
    staleBaseline,
    storeState: store.state,
    skipped: store.skipped,
    filesSeen: store.filesSeen,
  };
}

function main(): void {
  // ANCHORED ON THIS MODULE, never on the CWD — `check-bean-bodies` does the
  // same and the reason is `a6kl`. Written as `repoRootFor(process.cwd())`
  // first, it answered `/home/user`, found no store, and exited 0 with "no
  // store in this repository" over a repository holding 198 beans. A gate
  // that reports clean because it looked in the wrong place is the `dh4f`
  // defect, and this one would have shipped wearing its own fix's clothes.
  const root = repoRootFor(HARNESS_ROOT);
  let report: FrontMatterReport;
  try {
    report = checkBeanFrontMatter(root);
  } catch (err) {
    exitIfBeanStoreAbsent("check:bean-front-matter", err);
    // COULD NOT CHECK is its own exit, never a pass. An unreadable store is
    // exactly the condition this gate exists for, so reporting it as clean
    // would be the defect wearing the fix's clothes.
    console.error(`::error::check-bean-front-matter: could not read the store — ${String(err)}`);
    process.exit(2);
  }

  // TWO ABSENCES, TWO EXITS. Bean `t6s7`: these were one branch, and the
  // fallback in `resolveBeanDefs` hands back a plausible `beans/defs` for a
  // repository that never mentioned one — so a folio whose store had been
  // moved or deleted reported exactly like a folio that never had one, as
  // `nothing to check`, exit 0.
  if (report.storeState === "declared-but-absent") {
    console.error(
      `::error::check-bean-front-matter: the bean graph declares ${beanDefsDir(root) ?? "(unresolved)"} ` +
        "and it is not there. NOT a pass — nothing scanned it, so nothing here was checked",
    );
    process.exit(2);
  }
  // THREE absences now, three exits. `unreachable` (bean `9ofm` row D) would
  // otherwise fall into the `beans === null` branch below and print "no store
  // in this repository", exit 0 — the `t6s7` defect restored by the cutover,
  // and with a message that sends the reader to look for a store that is
  // exactly where its declaration says.
  if (report.storeState === "unreachable") {
    const store = readBeanStore(root);
    if (store.state === "unreachable" && store.absent) exitIfBeanStoreAbsent("check:bean-front-matter", new BeanStoreAbsentError(store.reason));
    console.error(
      "::error::check-bean-front-matter: the bean store is kept on its branch and is not mounted here, " +
        "so nothing scanned it and nothing here was checked. Run `bun run cat state:mount`. NOT a pass",
    );
    process.exit(2);
  }
  if (report.beans === null) {
    console.log("Bean front matter — no store in this repository, nothing to check");
    process.exit(0);
  }

  // ZERO BEANS IS A FINDING. A store that exists and yields nothing makes the
  // count below vacuous, and a vacuous pass reads exactly like a real one
  // (`6tkl`). `readBeanFiles` skips a file with no front matter, so an empty
  // result over a non-empty directory means every file failed to look like a
  // bean — which is worse than one that fails to parse.
  if (report.beans === 0) {
    console.error(
      `::error::check-bean-front-matter: the store at ${beanDefsDir(root) ?? "(unresolved)"} ` +
        "yielded no beans — every count here would be vacuous",
    );
    process.exit(1);
  }

  console.log(`Bean front matter (${report.beans} bean(s), including the archive)`);

  // RECONCILE, rather than print. Every `.md` in the directory is a bean or a
  // skipped file, and if that arithmetic does not close then a file went
  // somewhere this report cannot see — which is `t6s7`'s defect returning by
  // another route. Checked rather than assumed, because the whole finding was
  // that a count can stay perfectly steady while a file disappears.
  const mismatch = reconcile(report.beans, report.skipped.length, report.filesSeen);
  if (mismatch !== null) {
    console.error(`::error::check-bean-front-matter: ${mismatch}`);
    process.exit(2);
  }

  const unfenced = report.defects.filter((d) => d.kind === "unfenced");
  const expected = report.skipped.filter((sk) => sk.expected);
  const unparseable = report.defects.filter((d) => d.kind === "unparseable");
  const newDuplicates = report.defects.filter((d) => d.kind === "duplicate-key" && !d.baselined);
  const outstanding = report.defects.filter((d) => d.kind === "duplicate-key" && d.baselined);
  const duplicateIds = report.defects.filter((d) => d.kind === "duplicate-id" && !d.baselined);
  const outstandingIds = report.defects.filter((d) => d.kind === "duplicate-id" && d.baselined);
  const invalidStatuses = report.defects.filter((d) => d.kind === "invalid-status");

  const at = (d: FrontMatterDefect): string => (d.line === null ? "" : `:${d.line}`);

  const failing =
    unparseable.length > 0 ||
    newDuplicates.length > 0 ||
    unfenced.length > 0 ||
    duplicateIds.length > 0 ||
    invalidStatuses.length > 0;
  if (!failing) {
    console.log(
      "  ✓ no NEW defect — every bean's front matter loads, so `beans list`, `roadmap` " +
        "and `prime` can read the store",
    );
  }

  for (const d of unfenced) {
    console.error(`  ✗ ${d.file} [${d.id}] UNFENCED: ${d.message}`);
  }
  for (const sk of expected) {
    console.log(`  · ${sk.file} is not a bean and is not expected to be (NOT_BEANS)`);
  }
  for (const d of unparseable) {
    console.error(`  ✗ ${d.file}${at(d)} [${d.id}] UNPARSEABLE: ${d.message}`);
  }
  for (const d of invalidStatuses) {
    console.error(`  ✗ ${d.file}${at(d)} [${d.id}] INVALID STATUS: ${d.message}`);
  }
  for (const d of duplicateIds) {
    console.error(`  ✗ ${d.file} [${d.id}] DUPLICATE ID: ${d.message}`);
  }
  for (const d of outstandingIds) {
    console.log(`  · outstanding ${d.id} [duplicate-id]: ${d.file} — ${d.message}`);
  }
  for (const d of newDuplicates) {
    console.error(`  ✗ ${d.file}${at(d)} [${d.id}] duplicate key: ${d.message}`);
    // The same per-key detail the outstanding loop prints. It was missing here
    // until 2026-09-27, which is backwards: a NEW duplicate is the one somebody
    // is about to act on, and the outstanding ones are already triaged. Found by
    // producing one — a bean-conflict resolution duplicated `updated_at` in the
    // `kfkh` bean itself, and the report named the file without saying that the
    // FIELD settled it.
    for (const dup of d.duplicates ?? []) {
      if (dup.resolution === "collapsible") {
        console.error(`      \`${dup.key}\` x${dup.values.length}, SAME value — collapse it, nothing is lost`);
      } else if (dup.resolution === "mechanical") {
        console.error(
          `      \`${dup.key}\` x${dup.values.length}, and the FIELD settles it: keep ` +
            `${JSON.stringify(dup.winner)} (${MECHANICAL_KEYS[dup.key]} wins). No decision needed.`,
        );
      } else {
        console.error(`      \`${dup.key}\` x${dup.values.length}, values DIFFER — this one needs a choice:`);
        for (const v of dup.values) console.error(`        ${JSON.stringify(v)}`);
      }
    }
  }
  for (const d of outstanding) {
    console.log(`  · outstanding ${d.id} [duplicate-key]: ${d.message} — ${d.file}${at(d)}`);
    // WHO can settle it, per key. A mechanical duplicate is not a question for
    // anybody — the field decides — and printing it as though it were puts a
    // non-question in a list read for the real ones (bean `kfkh`).
    for (const dup of d.duplicates ?? []) {
      if (dup.resolution === "collapsible") {
        console.log(`      \`${dup.key}\` x${dup.values.length}, SAME value — collapsible by whoever meets it`);
      } else if (dup.resolution === "mechanical") {
        console.log(
          `      \`${dup.key}\` x${dup.values.length}, and the FIELD settles it: keep ` +
            `${JSON.stringify(dup.winner)} (${MECHANICAL_KEYS[dup.key]} wins). Not an owner decision.`,
        );
      } else {
        console.log(`      \`${dup.key}\` x${dup.values.length}, values DIFFER — the owner chooses:`);
        for (const v of dup.values) console.log(`        ${JSON.stringify(v)}`);
      }
    }
  }
  for (const id of report.staleBaseline) {
    console.log(
      `  · baseline entry ${id} no longer matches — repaired; remove it from ` +
        "DUPLICATE_KEY_BASELINE or DUPLICATE_ID_BASELINE in this file",
    );
  }

  if (unfenced.length > 0) {
    console.error(
      `\n${unfenced.length} file(s) in the bean directory carry no parseable \`---\` fences. ` +
        "This is the QUIET half of `t7ao`: the store still loads, so nothing announces it, " +
        "and every check here skips the file — while `beans` loads it as a row with the id " +
        "taken from the FILENAME, status `?` and NO TITLE. Restore the fences, or add the " +
        "name to NOT_BEANS in bean-store-read.ts if it is genuinely not a bean.",
    );
  }
  if (unparseable.length > 0) {
    console.error(
      `\n${unparseable.length} bean(s) NO loader will read. \`beans\` loads the store as a ` +
        "unit, so until this is fixed `list`, `roadmap` and `prime` return NOTHING for " +
        "every reader — including the cold start named in the first line of AGENTS.md.",
    );
  }
  if (newDuplicates.length > 0) {
    console.error(
      `\n${newDuplicates.length} bean(s) give a key twice. The store still loads, but the ` +
        "file says two things and which one wins is the reader's parser. Fix the file, or " +
        "add its id to DUPLICATE_KEY_BASELINE with the reason.",
    );
  }
  if (outstanding.length > 0) {
    console.log(
      "\n  An `authored` duplicate is repaired by the bean's OWNER, not by this check and " +
        "not by whoever ran it — repairing one means choosing which value was meant.\n" +
        "  A `collapsible` or `mechanical` one is NOT that: the values agree, or the field " +
        "decides.\n  Those want repairing by whoever meets them, and then removing from " +
        "DUPLICATE_KEY_BASELINE in this file.",
    );
  }

  if (duplicateIds.length > 0) {
    console.error(
      `\n${new Set(duplicateIds.map((d) => d.id)).size} id(s) declared by more than one file. ` +
        "Every id-keyed reader (`beans`, `beans:claim`, `check-bean-parents`, the dashboard " +
        "index) resolves ONE and silently drops the rest. Give one of them a fresh id by " +
        "renaming its file and `# <id>` line, and update the references that mean it " +
        "(bean `4vg7`). Never delete either.",
    );
  }

  process.exit(failing ? 1 : 0);
}

if (import.meta.main) main();
