/**
 * An ingested upload does not stay in the queue.
 *
 * @module cat-harness/scripts/check-uploads-retired
 *
 * Both graphs, because the finding is a RELATION between them.
 *
 * @covers uploads
 * @covers library
 *
 * Three stages, and `uploads/` is the only temporary one: **queued** in a
 * declared `uploads/`, **derived** into `library/<slug>/` (in any harness),
 * **archived** in `fsh-guts/uploads/` with a same-basename sidecar. The
 * reasoning is in `skills/library/library-core/library-ingestion.md` and its
 * detail `library-ingestion/uploads-retirement.md`.
 *
 * A queue file is RETIRED when its sha256 equals the `source_sha256` recorded
 * by some library entry's manifest, across every harness's `library/`. Hashes,
 * not filenames, because an archived source is normally renamed.
 *
 * It does not judge whether a queued file OUGHT to be ingested; an unread PDF
 * reports as `queued`. The finding is only ever the pair: derived AND still
 * in the queue.
 *
 * It reports rather than deletes (`deletion-requires-confirmation`): the
 * remedy names a `git mv`, or a `git rm` when the identical bytes are already
 * in the archive, and a person runs it.
 */
import { HARNESS_ROOT } from "./lib/roots.ts";
import { libraryEntryDirs } from "./lib/library-entry-graphs.ts";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";

import { directoriesForGraph } from "../schemas/kg/cat-harness.ts";
import { fshGutsDirectories } from "../schemas/kg/fsh-guts.ts";
import { exitUnlessMounted } from "./branch-store.ts";

const ROOT = resolve(import.meta.dir, "..", "..");

/**
 * The layer roots this repository's own run asks — **a pair, and neither
 * alone is the corpus.**
 *
 * `directoriesForGraph(ROOT, "library")` returns **zero** directories, because
 * the repository root is not a layer that declares a library. Measured
 * 2026-09-30, and it is why the first version of this file printed
 * "✓ 15 queue file(s), none already ingested" over a corpus it had not read —
 * `dh4f`, in the check written to stop `dh4f`.
 *
 * `cat-harness` declares one, and its declaration reaches all six
 * (`cat-harness`, `agent-skills`, and four content layers above this one: the
 * IRIS replica, the formal-math layer, the content core and a DAK base layer). The repository root declares
 * `uploads/`, which `cat-harness` does not. So both are asked.
 *
 * Exported, and passed as an ARGUMENT rather than closed over, so a fixture
 * root is genuinely isolated: a module-level constant leaks this repository
 * into every test, and the first version of the tests measured 42 ingested
 * hashes over a fixture holding two. The `readLibraryGraph(roots: string[])`
 * precedent, for the same reason.
 */
export const DEFAULT_ROOTS: readonly string[] = [ROOT, HARNESS_ROOT];

// declared-path-literal: `fsh-guts/uploads` is a SUB-directory of the declared
// `fsh-guts` graph rather than a declared directory of its own, so no
// declaration resolves it and there is nothing to ask. It is named in one
// place, here, and the remedy lines this script prints are composed from it.
// It is the owner's ruling of 2026-09-29 — *"archival … should be moved to
// fsh-guts"* — with the sub-directory chosen on 2026-09-30 and recorded in
// `library-ingestion/uploads-retirement.md` §"What happens to the upload after it is ingested".
/**
 * Where an archived upload lives: `uploads/` inside the DECLARED trashcan, one
 * place, named by the owner's ruling. Resolved through the `fsh-guts`
 * declaration rather than spelled (bean `gz47`): fsh-guts is moving to its own
 * branch (bean `9c7h`), and a spelled path keeps "finding" an empty directory
 * after the move. `undefined` when no trashcan is declared, which means nothing
 * can have been archived; two declared trashcans are a declaration defect and
 * throw.
 */
export function archiveDir(base: string): string | undefined {
  const all = fshGutsDirectories(base);
  if (all.length > 1) throw new Error(`the \`fsh-guts\` graph is declared ${all.length} times under ${base}`);
  return all[0] ? join(all[0].absPath, ARCHIVE_SUBDIR) : undefined;
}
const ARCHIVE_SUBDIR = "uploads";

export type QueueState = "queued" | "retired" | "duplicated" | "orphaned-companion";

/**
 * Whether the file is a bare drop in the queue or part of a structured intake.
 *
 * The IRIS replica keeps one DIRECTORY per source — the PDF beside an `intake.json`
 * and an `iris-capture/` — so the remedy the flat case prints (move the PDF,
 * write a sidecar) would leave an intake record pointing at a file that is no
 * longer there. Whether such a source retires as a file or as a directory is
 * that library's layout decision, and that layout is under revision in #1612.
 *
 * So the two are reported as separate families and only the flat one blocks.
 * Not an exemption: the structured findings are counted and printed on every
 * run, and the family carries the reason it is advisory rather than a
 * silence. A blocking family that is right for one queue and wrong for
 * another is a gate people learn to override.
 */
export type QueueShape = "flat" | "structured-intake";

/** What marks a per-source intake directory, rather than a bare drop. */
const INTAKE_RECORD = "intake.json";

export interface QueueFile {
  /** Repo-relative path of the file in a declared `uploads/` directory. */
  rel: string;
  sha256: string;
  state: QueueState;
  /** The library entry that derived from it, when one did. */
  entry?: string;
  /** The archive copy holding identical bytes, when one exists. */
  archived?: string;
  shape: QueueShape;
}

function sha(abs: string): string {
  return createHash("sha256").update(readFileSync(abs)).digest("hex");
}

/** Every declared library across {@link roots}. See {@link DEFAULT_ROOTS}. */
export function declaredLibraries(roots: readonly string[] = DEFAULT_ROOTS): Set<string> {
  const out = new Set<string>();
  for (const r of roots) {
    for (const d of directoriesForGraph(r, "library")) out.add(d);
  }
  return out;
}

/**
 * Every library entry's recorded `source_sha256`, across every declared
 * library in every layer — the measurement the 2026-09-30 sweep got wrong
 * by asking one of them.
 *
 * Walked rather than read from a fixed key path: a manifest is JSON-LD and the
 * field's nesting has moved. What cannot move is the field NAME, so that is
 * what is matched.
 */
export function ingestedSources(roots: readonly string[] = DEFAULT_ROOTS): Map<string, string> {
  const out = new Map<string, string>();
  const libs = declaredLibraries(roots);
  const base = roots[0] ?? ROOT;
  for (const lib of libs) {
    if (!existsSync(lib)) continue;
    // Flat or filed in a concern group (`library/<group>/<slug>/`, bean `6fez`).
    for (const { dir: entry } of libraryEntryDirs(lib)) {
      const m = join(entry, "manifest.jsonld");
      if (!existsSync(m)) continue;
      let doc: unknown;
      try {
        doc = JSON.parse(readFileSync(m, "utf-8"));
      } catch {
        continue;
      }
      const seen: string[] = [];
      const walk = (o: unknown): void => {
        if (Array.isArray(o)) {
          for (const v of o) walk(v);
        } else if (o !== null && typeof o === "object") {
          for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
            if (k === "source_sha256" && typeof v === "string") seen.push(v.toLowerCase());
            else walk(v);
          }
        }
      };
      walk(doc);
      for (const h of seen) out.set(h, relative(base, entry));
    }
  }
  return out;
}

/** The bytes already in the archive, by hash. */
export function archivedSources(roots: readonly string[] = DEFAULT_ROOTS): Map<string, string> {
  const out = new Map<string, string>();
  const base = roots[0] ?? ROOT;
  const dir = archiveDir(base);
  if (dir === undefined || !existsSync(dir)) return out;
  for (const f of readdirSync(dir)) {
    const abs = join(dir, f);
    // The sidecar describes the artefact; it is not one.
    if (f.endsWith(".md") || !statSync(abs).isFile()) continue;
    out.set(sha(abs), relative(base, abs));
  }
  return out;
}

/** Every file under a queue directory, relative to it, recursing into subdirectories. */
function queueFiles(dir: string, prefix = ""): string[] {
  const out: string[] = [];
  for (const f of readdirSync(dir).sort()) {
    const abs = join(dir, f);
    if (statSync(abs).isDirectory()) out.push(...queueFiles(abs, join(prefix, f)));
    else out.push(join(prefix, f));
  }
  return out;
}

/** Every file sitting in a declared `uploads/`, with its state. */
/**
 * The `uploads/` directories the declarations actually RESOLVE TO, existing or
 * not. Separated from {@link queueState} so a caller can tell apart the two
 * states that an empty file list conflates:
 *
 *   · **none resolved** — the declarations could not be read, so nothing was
 *     looked at. `dh4f`: never a pass.
 *   · **resolved, and empty** — every queue was read and held nothing. That is
 *     a DETERMINED empty, and the end state this rule is driving towards once
 *     every source has been ingested and retired.
 *
 * Collapsing those made a fully-retired repository fail permanently, which a
 * review bot caught on #1633. The distinction is this repository's own, stated
 * for README sections as "an empty directory is still a determined empty".
 */
export function resolvedQueues(roots: readonly string[] = DEFAULT_ROOTS): string[] {
  const queues = new Set<string>();
  for (const r of roots) {
    for (const d of directoriesForGraph(r, "uploads")) queues.add(d);
  }
  // A layer that declares a library declares its own queue, and that
  // declaration does not always reach the root's own resolution — measured in
  // `library-graph.ts` on 2026-09-20 for the IRIS replica. Asking each library's
  // layer is what makes this total rather than nearly so.
  for (const lib of declaredLibraries(roots)) {
    for (const d of directoriesForGraph(resolve(lib, ".."), "uploads")) queues.add(d);
  }
  return [...queues].sort();
}

export function queueState(roots: readonly string[] = DEFAULT_ROOTS): QueueFile[] {
  const base = roots[0] ?? ROOT;
  const ingested = ingestedSources(roots);
  const archived = archivedSources(roots);

  const queues = new Set(resolvedQueues(roots));

  const out: QueueFile[] = [];
  for (const q of [...queues].sort()) {
    if (!existsSync(q)) continue;
    // The archive lives under a declared directory too; it is the destination,
    // not a queue.
    const archive = archiveDir(base);
    if (archive !== undefined && resolve(q) === resolve(archive)) continue;
    // A queue may hold a DIRECTORY per source — the IRIS replica's `uploads/` keeps
    // `9789241548960-eng/` and three siblings that way. Listing only the top
    // level would report those four queues as empty, which is the same
    // could-not-see-it-so-it-is-clean shape this file exists to stop.
    for (const f of queueFiles(q)) {
      const abs = join(q, f);
      if (basename(f) === "README.md") continue;
      const h = sha(abs);
      const entry = ingested.get(h);
      const arch = archived.get(h);
      // Read from the filesystem rather than from the file's depth: a queue
      // may nest for other reasons, and it is the intake RECORD that makes
      // the remedy different.
      const shape: QueueShape = existsSync(join(dirname(abs), INTAKE_RECORD)) ? "structured-intake" : "flat";
      out.push({
        rel: relative(base, abs),
        sha256: h,
        state: entry === undefined ? "queued" : arch === undefined ? "retired" : "duplicated",
        ...(entry === undefined ? {} : { entry }),
        ...(arch === undefined ? {} : { archived: arch }),
        shape,
      });
    }
  }
  return withCompanions(out, archivedBasenames(roots));
}

/** `X.pdf` from `X.pdf.extraction.json`; undefined when the name is not one. */
export function companionSource(rel: string): string | undefined {
  const m = /^(.+)\.extraction\.(?:json|md)$/.exec(basename(rel));
  return m?.[1];
}

/**
 * Mark the companions whose source has already retired.
 *
 * `library-ingestion/uploads-retirement.md` §"Swept 2026-09-30" requires that an ingested
 * source's `*.pdf.extraction.json` companion move WITH it, being a derived
 * artefact of the same ingest rather than a queue item. Nothing enforced that:
 * every other judgement here is made on a file's own sha256 against the
 * ingested set, and a companion's bytes match no `source_sha256`, so it could
 * never become a finding and sat in the queue for ever. A review bot found it
 * on #1633 — against the rule THIS BRANCH wrote.
 *
 * **Matched by name, and that is not a lapse from the hash rule — it is the
 * only relation a companion has.** A companion is *defined* as `<source>` plus
 * a suffix; there is no hash tying it to its source, because its bytes are the
 * extraction, not the source. So the name is the evidence here, while the
 * source's own retirement is still decided by hash. Keeping the two rules
 * straight is why this is a separate pass rather than a clause inside the
 * loop.
 *
 * A companion is a finding ONLY when its source is gone from the queue and
 * present in the archive — that is, the source retired and left it behind.
 * A companion sitting beside a source still in the queue is as queued as the
 * source is, which is the live case in
 * the IRIS replica's `uploads/wpr-rdo-2020-003-eng/iris-capture/`.
 */
export function withCompanions(files: QueueFile[], archivedNames: ReadonlySet<string>): QueueFile[] {
  const present = new Set(files.map((f) => f.rel));
  return files.map((f) => {
    if (f.state !== "queued") return f;
    const src = companionSource(f.rel);
    if (src === undefined) return f;
    const beside = join(dirname(f.rel), src);
    // Source still queued beside it → the pair is queued together.
    if (present.has(beside)) return f;
    // Source gone and archived → it retired without its companion.
    if (!archivedNames.has(src)) return f;
    return { ...f, state: "orphaned-companion" as const, archived: src };
  });
}

/** Basenames present in the archive, for the companion relation only. */
export function archivedBasenames(roots: readonly string[] = DEFAULT_ROOTS): Set<string> {
  const out = new Set<string>();
  for (const r of roots) {
    const dir = archiveDir(r);
    if (dir === undefined || !existsSync(dir)) continue;
    for (const e of readdirSync(dir)) out.add(e);
  }
  return out;
}

/**
 * The findings: a queue file that has been ingested.
 *
 * `retired` here means "derived and NOT yet archived" — it must move.
 * `duplicated` means the identical bytes are already archived, so the queue
 * copy is redundant and the remedy is a removal rather than a move. The two
 * are separated because the remedy differs and conflating them is how the
 * 2026-09-30 sweep produced eight files in two places.
 */
export function findings(files: QueueFile[]): QueueFile[] {
  return files.filter((f) => f.state !== "queued");
}

if (import.meta.main) {
  exitUnlessMounted("fsh-guts", "check-uploads-retired", ROOT);
  // The denominator BEFORE the verdict. Every finding here is "this file's
  // hash is in the ingested set", so an empty ingested set makes every file
  // read as queued and the check pass over everything. That is not a
  // hypothetical: the first version of this file resolved libraries from the
  // repository root, got zero, and printed a green line.
  const ingested = ingestedSources();
  if (ingested.size === 0) {
    console.error("✗ no library entry records a `source_sha256`.");
    console.error("  Every queue file would read as not-yet-ingested, so this check");
    console.error(`  would pass vacuously. Declared libraries: ${String(declaredLibraries().size)}.`);
    process.exit(1);
  }

  const files = queueState();
  const queues = resolvedQueues();
  if (queues.length === 0) {
    // `dh4f`, and the ONLY vacuity that is still a failure: nothing resolved,
    // so nothing was looked at. The first version of this guard also failed on
    // a resolved-but-empty queue, which made a fully-retired repository red
    // for ever — the opposite error, caught by a review bot on #1633.
    console.error("✗ no `uploads/` directory could be resolved from any declaration.");
    console.error("  That is not a pass: nothing was read, so nothing was checked.");
    console.error("  An empty queue that RESOLVED is a different answer, and passes.");
    process.exit(1);
  }
  if (files.length === 0) {
    // Determined empty: every declared queue was read and held nothing. That
    // is the end state the retirement rule drives towards, not a defect.
    console.log(`✓ ${queues.length} declared queue(s) resolved and all are empty — every source retired.`);
    process.exit(0);
  }

  const bad = findings(files);
  const flat = bad.filter((f) => f.shape === "flat");
  const structured = bad.filter((f) => f.shape === "structured-intake");
  const queued = files.length - bad.length;

  const archive = archiveDir(ROOT);
  const archiveRel = archive === undefined ? "<no `fsh-guts` directory is declared: declare one first>" : relative(ROOT, archive);
  const remedy = (f: QueueFile): string =>
    f.state === "duplicated"
      ? `git rm "${f.rel}"  (identical bytes already at ${String(f.archived)})`
      : f.state === "orphaned-companion"
        ? `git mv "${f.rel}" "${archiveRel}/${basename(f.rel)}"  (its source ${String(f.archived)} already retired; no sidecar — the source's covers it)`
        : `git mv "${f.rel}" "${archiveRel}/${basename(f.rel)}"  + a same-basename .md sidecar`;

  console.log(
    `Queue retirement — ${String(files.length)} file(s) across ${String(new Set(files.map((f) => dirname(f.rel))).size)} director(y/ies),` +
      ` against ${String(ingested.size)} ingested source hash(es)\n`,
  );

  // Advisory first, so a reader does not take the blocking family's count as
  // the whole answer. The share is reported and not graded.
  if (structured.length > 0) {
    console.log(`· ${String(structured.length)} already-ingested file(s) inside a per-source intake directory — ADVISORY:`);
    for (const f of structured) {
      console.log(`    ${f.rel}`);
      console.log(`      derived to ${String(f.entry)}`);
    }
    console.log("  Each sits beside an `intake.json`, so moving the PDF alone would leave");
    console.log("  that record naming a file that is not there. Whether such a source");
    console.log("  retires as a FILE or as a DIRECTORY is that library's layout decision, and");
    console.log("  that layout is being reworked in #1612. Reported every run, and the");
    console.log("  count is the point: this is not a clean family.\n");
  }

  if (flat.length === 0) {
    console.log(
      `✓ ${String(queued)} queue file(s) genuinely queued, 0 already-ingested bare drop(s)` +
        `${structured.length > 0 ? `, ${String(structured.length)} advisory` : ""}.`,
    );
    process.exit(0);
  }

  console.error(`✗ ${String(flat.length)} of ${String(files.length)} queue file(s) have already been ingested:\n`);
  for (const f of flat) {
    console.error(`  ✗ ${f.rel}`);
    console.error(`      derived to  ${String(f.entry)}`);
    console.error(`      remedy: ${remedy(f)}`);
  }
  console.error(`\n  ${String(queued)} file(s) are genuinely queued and are not findings.`);
  console.error("  The rule is in skills/library/library-core/library-ingestion/uploads-retirement.md");
  console.error('  §"What happens to the upload after it is ingested". Bean q7ey.');
  console.error("\n  Nothing is moved or removed here — deletion-requires-confirmation.");
  process.exit(1);
}
