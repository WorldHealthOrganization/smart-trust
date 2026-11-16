/**
 * Validation pipeline for content objects.
 *
 * Runs three levels of validation:
 *   1. Zod schema validation (shape + types)
 *   2. Constraint rules (file existence, cross-refs, and each vocabulary
 *      module's own rules over the context it contributes)
 *   3. AST validation (rendered LaTeX parses cleanly)
 *
 * Supports two modes:
 *   - Paper directory: detects paper manifest, recurses into chapter dirs
 *   - Flat directory: validates all .ts files as blocks (legacy)
 *
 * Usage:
 *   bun run cat-harness-tools/pipeline/validate.ts [paper-dir-or-objects-dir]
 *
 * @module pipeline/validate
 */

import { folioDir } from "../schemas/kg/cat-harness.js";
import { readdirSync, readFileSync, existsSync } from "fs";
import { resolve, join, basename, dirname, relative, isAbsolute } from "path";
import {
  PaperSchema,
  ChapterSchema,
  type ConstraintContext,
} from "../schemas/constraints.ts";
// A block is parsed by the schema its kind is typed by: a vocabulary module's
// (a layer above cat-harness typing its own kinds), else BlockSchema.
import { allConstraintContextContributors, allConstraintRules, parseBlock } from "../schemas/content/vocabulary-modules.ts";
import type { Block, Paper, Chapter, Section, ValidationIssue, ValidationResult } from "../schemas/types.ts";
import { resolveRenderTarget } from "./render-discovery";
import { readDeclaredFolioProfile } from "./profile-check";
import { validateDefterms } from "./validate-defterm";
import { validateValueDirectives } from "./validate-value";
import { validateSimulatorAssets } from "./validate-simulator";
import { findContentRepoRoot, findPapers } from "./repo-root";
import { blockQaPath, blockOfQaPath, BLOCK_QA_SUFFIX } from "./qa-paths";
import { referenceRegistryConfigured, getReferenceRegistry } from "./references-registry-di";
import { referenceEntryIds } from "./reference-entries";

/**
 * Union of reference IDs from the configured DI registry and on-disk Reference
 * nodes (`references/<key>.json` / `.jsonld` / `schema/references.ts`), or
 * `undefined` when neither is present.
 */
export function resolveAllReferenceIds(repoRoot: string = findContentRepoRoot()): Set<string> | undefined {
  const refsConfigured = referenceRegistryConfigured();
  const nodeIds = referenceEntryIds(repoRoot);
  if (!refsConfigured && nodeIds.size === 0) return undefined;
  return new Set([
    ...(refsConfigured ? getReferenceRegistry().referenceMap.keys() : []),
    ...nodeIds,
  ]);
}

// ── File discovery ───────────────────────────────────────────────

/**
 * Is this `*.qa.json` a **block** sidecar, as opposed to a paper-level audit
 * artefact that merely shares the extension?
 *
 * Block sidecars declare `"$schema": "block-qa/v1"`. Paper-level outputs such
 * as `section-title-audit.qa.json` are keyed by paper and chapter and carry no
 * `$schema` at all — they have no `.ts` by design and must not be read as
 * orphaned blocks.
 *
 * Unreadable or unparseable returns `true` on purpose: a corrupt sidecar
 * should be reported, not silently reclassified as "not a block's".
 */
function isBlockSidecar(path: string): boolean {
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
    if (typeof parsed !== "object" || parsed === null) return true;
    return (parsed as { $schema?: unknown }).$schema === "block-qa/v1";
  } catch {
    return true;
  }
}

/** Find all .ts manifest files in a directory (excluding index, pipeline). */
function discoverManifests(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter(f => f.endsWith(".ts") && !f.startsWith("index") && !f.startsWith("_"))
    .map(f => basename(f, ".ts"));
}

/**
 * Detect what kind of manifest a directory's eponymous .ts file is.
 * Returns "paper", "chapter", or null if no manifest exists.
 *
 * Detection is authoritative: imports the .ts module, then validates the
 * exported object against PaperSchema and ChapterSchema. The data itself
 * determines the type — no source-text heuristics.
 */
// Discriminated on `kind`: `data` is the manifest each branch just validated,
// so callers get `Paper` or `Chapter` rather than re-asserting it.
type ManifestDetection =
  | { kind: "paper"; path: string; data: Paper }
  | { kind: "chapter"; path: string; data: Chapter }
  | { kind: null; path: null; data?: undefined };

async function detectManifestKind(dir: string): Promise<ManifestDetection> {
  const dirName = basename(dir);
  const manifestPath = join(dir, `${dirName}.ts`);
  if (!existsSync(manifestPath)) return { kind: null, path: null };
  try {
    const mod = await import(manifestPath);
    const obj = mod.default;
    const asPaper = PaperSchema.safeParse(obj);
    if (asPaper.success) return { kind: "paper", path: manifestPath, data: obj as Paper };
    const asChapter = ChapterSchema.safeParse(obj);
    if (asChapter.success) return { kind: "chapter", path: manifestPath, data: obj as Chapter };
  } catch { /* import error — not a valid manifest */ }
  return { kind: null, path: null };
}

// ── Validation ───────────────────────────────────────────────────

/**
 * Validate a single directory of block .ts files.
 * Returns blocks map and issues; caller aggregates labels across chapters.
 */
async function loadBlocksFromDir(
  dir: string,
  blockNames: string[] | null,
  issues: ValidationIssue[],
): Promise<Map<string, Block>> {
  const blocks = new Map<string, Block>();
  const names = blockNames ?? discoverManifests(dir);

  // ── no-orphan-sidecar ────────────────────────────────────────
  //
  // A `<block>.qa.json` whose `.ts` manifest is gone is an audit report about
  // a block that does not exist. It can never be refreshed — no sweep will
  // ever visit it — and it silently inflates every corpus census taken over
  // `**/*.qa.json`, which is how QA state is normally counted.
  //
  // Same principle as `no-orphan-lean`: a `.lean` file is never standalone,
  // and neither is a QA report. These accumulate when a block MOVES between
  // chapters — the block picks up a fresh verdict at its new path while the
  // old file stays behind, holding verdicts computed against content that has
  // since changed. Found live in qou: 18 orphans, 5 of them from moves.
  //
  // ## The move from adjacency to correspondence (2026-09-19)
  //
  // This check USED to be pure adjacency: scan `dir`, and flag any
  // `<base>.qa.json` with no `<base>.ts` beside it. Verdicts now live under
  // `test/results/block-qa/`, so adjacency finds nothing — measured on this
  // repo's own corpus, with a verdict planted in the results tree for a block
  // that does not exist, the unmodified check reported ZERO orphans. It had
  // become a silent no-op: the exact false-clean this file refuses everywhere
  // else.
  //
  // What rescues it is that the results tree MIRRORS the block's directory
  // (`qa-paths.ts`). One block directory therefore still corresponds to
  // exactly one verdict directory, so the check stays per-directory,
  // non-recursive, and O(entries) — adjacency becomes correspondence, and
  // nothing about its shape or its cost changes. A whole-tree walk was the
  // obvious alternative and is wrong twice over: it would report the entire
  // repo's orphans when you asked to validate one chapter, and it would
  // report each of them once per chapter loaded.
  //
  // BOTH locations are scanned, because a folio that has not migrated still
  // has its verdicts beside its blocks. Scanning only the results tree would
  // pass every such folio clean; flagging a legacy verdict merely for BEING
  // legacy would bury it in false findings. The rule is the same in both
  // places and it is about the `.ts`, not about the location: a verdict whose
  // block manifest is absent is an orphan, wherever the verdict sits.
  //
  // Runs on every directory load, including chapter mode where `blockNames`
  // restricts which manifests are validated. That restriction is irrelevant
  // here: orphanhood asks whether the `.ts` exists ON DISK, not whether the
  // caller asked for it — a verdict whose manifest exists but was not
  // requested still finds its `.ts` and is not flagged. Gating on
  // `blockNames === null` made this a silent no-op for every real paper,
  // since only legacy flat mode passes null.
  //
  // Non-recursive on both sides, matching `discoverManifests`: verdicts for
  // nested dirs are caught when those dirs are themselves scanned.
  //
  // KNOWN GAP, introduced by the move and not closed here: if a block
  // directory is deleted OUTRIGHT, its mirror directory survives in the
  // results tree and nothing ever visits it, because the only thing that
  // reaches a mirror directory is a load of the block directory it mirrors.
  // Under adjacency that case could not arise — the verdicts were inside the
  // directory and went with it. Closing it needs a sweep over the results
  // tree that knows the whole corpus, which is not something a per-directory
  // load can answer; it is a separate check, not a widening of this one.
  if (existsSync(dir)) {
    /**
     * Report the verdict at `qaPath` as an orphan when `tsPath` is absent.
     *
     * One body for both locations so the two cannot drift apart — the
     * `$schema` carve-out and the fail-toward-reporting behaviour are
     * properties of the CHECK, not of where the file happens to live.
     *
     * @param where human-readable location, for a message that now has to say
     *              which of the two homes the offending file is in
     */
    const reportIfOrphan = (qaPath: string, tsPath: string, where: string) => {
      const f = basename(qaPath);
      const base = f.slice(0, -BLOCK_QA_SUFFIX.length);
      if (existsSync(tsPath)) return;
      // Not every `*.qa.json` is a BLOCK verdict, and the ones that are not
      // have no `.ts` by design. `qa-section-title-audit.ts` writes
      // `content/<paper>/section-title-audit.qa.json` — keyed by paper and
      // chapter, never by block — and four of those sit in the qou corpus
      // (bean `qou-efzm`, which had them recorded as orphans left behind by a
      // deleted block; the file shape says they were never blocks at all).
      // Deleting them would destroy live audit state that the producing tool
      // would simply rewrite.
      //
      // That producer still writes to the paper root, which the legacy scan
      // below reaches, so the carve-out is load-bearing today. It is applied
      // to the results tree as well rather than only where it currently
      // fires: the discriminator is "does this file say it is a block
      // verdict", and answering that differently in two directories is how a
      // future non-block artefact under `test/results/` becomes a false
      // orphan.
      //
      // Discriminate on the block verdict's own `$schema`. A file that fails
      // to parse is deliberately NOT skipped: a corrupt verdict is worth
      // reporting, and treating unreadable as "not a block verdict" would let
      // a real orphan hide behind a truncated write.
      if (!isBlockSidecar(qaPath)) return;
      issues.push({
        level: "error",
        block: base,
        // BOTH full paths, which the adjacency version did not need: it said
        // "has no sibling <base>.ts" and the one directory in play made that
        // unambiguous. With two possible homes for a verdict, a bare stem no
        // longer tells the reader WHICH file to delete — and deleting the
        // wrong one destroys the verdict that is current. The `.qa.json`
        // basename is still in the string, because that is what consumers
        // grep for.
        message:
          `orphan QA sidecar: ${qaPath} (${where}) has no block manifest at ` +
          `${tsPath}. The block was deleted or moved; delete the verdict ` +
          `(git history keeps it) or restore the manifest.`,
        file: f,
      });
    };

    const entries = readdirSync(dir);

    // ── legacy location: the verdict as a companion of the block ──
    // Unchanged from the adjacency era, deliberately. This IS the
    // compatibility half; rewriting it would be rewriting the thing that
    // still works.
    for (const f of entries) {
      if (!f.endsWith(BLOCK_QA_SUFFIX)) continue;
      const base = f.slice(0, -BLOCK_QA_SUFFIX.length);
      reportIfOrphan(join(dir, f), join(dir, `${base}.ts`), "beside the block");
    }

    // ── results tree: test/results/block-qa/<mirror of dir>/ ──
    const repoRoot = findContentRepoRoot();
    const relToRoot = relative(repoRoot, dir);
    const dirUnderRoot = relToRoot === "" || (!relToRoot.startsWith("..") && !isAbsolute(relToRoot));
    if (!dirUnderRoot) {
      // THIRD STATE. `findContentRepoRoot` always returns a path — it falls
      // back to an import-relative guess — so "no root" is not something it
      // can report. What IS detectable is that the root it returned does not
      // contain `dir`, and in that case the mirror path is not merely unknown
      // but unrepresentable: `blockOfQaPath` refuses to invert it (the
      // relative path escapes the results base), which is the contract itself
      // saying it cannot answer.
      //
      // This is not a hypothetical. `repo-root.ts` documents the failure it
      // guards against — the walk-up landing in the PLATFORM tree instead of
      // the folio — and that failure presents exactly as a chapter directory
      // outside the resolved root. Reporting it as a clean results tree would
      // turn a misresolved root into "every block is audited and nothing is
      // orphaned".
      //
      // A warning, not an error: the legacy half above DID run and is
      // authoritative for what it covers, so this says which half is missing
      // rather than failing a build over a resolver's reach.
      //
      // Suppressed on an EMPTY directory, and that guard is load-bearing
      // rather than tidiness. `validateObjects` decides "this run validated
      // nothing, refuse to report success" on `issues.length === 0`, so ANY
      // issue raised here — including a warning about a check that could not
      // run — disarms it and turns `valid: false` into `valid: true`. Caught
      // by `validate-roots.test.ts` on the first run of this change. An empty
      // directory also has nothing to be uncertain ABOUT: no manifests and no
      // verdicts, and the empty-corpus error says so far more loudly than
      // this would.
      if (entries.length > 0) {
        issues.push({
          level: "warning",
          block: "(none)",
          // Deliberately NOT phrased as "orphan QA sidecar …". That string
          // is what every consumer greps to count findings — the existing
          // tests do — so a status line wearing it would inflate the orphan
          // census, which is the exact defect this check exists to prevent.
          // A check that cannot run says so under its own id.
          message:
            `check "no-orphan-sidecar" could not read the results tree for ` +
            `${dir}: it is outside the resolved instance root ${repoRoot}, ` +
            `so the mirrored verdict directory cannot be located. Verdicts ` +
            `sitting beside the blocks were still checked; verdicts under ` +
            `test/results/block-qa/ were NOT.`,
        });
      }
    } else {
      // Ask the WRITER's own function where a block in this directory would
      // be recorded, then take the parent. Composing
      // `join(repoRoot, BLOCK_QA_RESULTS_DIR, relToRoot)` by hand here would
      // be a tenth hand-composed verdict path — precisely what `qa-paths.ts`
      // exists to end — and it would go silently wrong the day the mirroring
      // scheme changes. The probe name never touches the filesystem.
      const mirrorDir = dirname(blockQaPath(repoRoot, join(dir, "__probe__")));
      // The results tree's ROOT, asked of the same writer function: the
      // mirror of the layer root itself.
      const resultsRoot = dirname(blockQaPath(repoRoot, join(repoRoot, "__probe__")));
      // TWO absences, and they are different facts (bean `c8uq`, defect C7).
      //
      // - The results tree EXISTS and this directory has no mirror in it: no
      //   verdict was ever written for this directory. A determined zero, and
      //   no finding — the normal state of a chapter nobody has swept.
      // - The results tree ITSELF is absent: this checkout does not hold the
      //   derived QA corpus at all. Once derived QA moved to the `qa-reports`
      //   branch that is every unfetched checkout, and calling it "no orphans"
      //   is the false-clean this check exists to refuse. It used to be a
      //   determined zero "by design"; it is now an UNKNOWN, said once per
      //   run under the check's own id.
      //
      // Only when the directory has entries, for the reason the third state
      // above gives: any issue disarms the empty-corpus refusal.
      if (!existsSync(resultsRoot)) {
        const notice =
          `check "no-orphan-sidecar" could not determine orphans in the results ` +
          `tree: ${resultsRoot} is absent from this checkout, so verdicts under ` +
          `test/results/block-qa/ were NOT checked (verdicts beside the blocks ` +
          `were). The derived QA corpus lives on the \`qa-reports\` branch — run ` +
          `\`bun run cat qa:fetch --ref main\` (or \`--ref pr/<n>\`) and validate again.`;
        if (entries.length > 0 && !issues.some((i) => i.message === notice)) {
          issues.push({ level: "warning", block: "(none)", message: notice });
        }
      } else if (existsSync(mirrorDir)) {
        for (const f of readdirSync(mirrorDir)) {
          if (!f.endsWith(BLOCK_QA_SUFFIX)) continue;
          // `blockOfQaPath` rather than re-deriving `join(dir, base + ".ts")`:
          // it is the declared inverse of the path the sweep wrote, so writer
          // and reader cannot disagree about which manifest a verdict claims.
          // `undefined` means the path is not a results-tree verdict at all —
          // skip rather than guess, which is what keeps a symlink or an odd
          // nesting from being mapped onto an arbitrary `.ts`.
          const qaPath = join(mirrorDir, f);
          const tsPath = blockOfQaPath(repoRoot, qaPath);
          if (!tsPath) continue;
          reportIfOrphan(qaPath, tsPath, "in the results tree");
        }
      }
    }
  }

  for (const name of names) {
    const tsPath = join(dir, `${name}.ts`);
    if (!existsSync(tsPath)) {
      issues.push({
        level: "error",
        block: name,
        message: `Block manifest not found: ${tsPath}`,
        file: `${name}.ts`,
      });
      continue;
    }

    try {
      const mod = await import(tsPath);
      const block: Block = mod.default;

      const result = parseBlock(block);
      if (!result.success) {
        for (const err of result.error.issues) {
          issues.push({
            level: "error",
            block: name,
            message: `Schema: ${err.path.join(".")}: ${err.message}`,
            file: `${name}.ts`,
          });
        }
        continue;
      }

      // A key the schema does not declare is SILENTLY STRIPPED — the Zod
      // block schemas are non-strict, so a misspelt field name produces no
      // error and the data it carried never reaches the graph. Comparing the
      // raw object's keys against the parsed result's is exactly that signal,
      // without changing what validates.
      //
      // Real cases: two proof blocks declare their parent as `proofOf`, where
      // the canonical field is `of`, so those parent links are absent from the
      // dependency graph entirely. Three more carry `is_mathematics`. The same
      // class bit this schema once before — `of` itself was declared on the TS
      // type and missing from the Zod object, and was stripped until noticed.
      //
      // No casts here: `Object.keys` takes `object` and `in` takes any object
      // type, so both operands work as they stand. The `as Record<string,
      // unknown>` this first carried was not merely redundant — it does not
      // typecheck, because `TableBlock` has no index signature and `Block` is a
      // union containing it. That is what took `tsc` red on main.
      for (const key of Object.keys(block)) {
        if (key in result.data) continue;
        issues.push({
          level: "warning",
          block: name,
          message:
            `Unknown field "${key}" — no schema declares it, so it was silently ` +
            `dropped and carries no meaning. Check for a misspelling of a real field.`,
          file: `${name}.ts`,
        });
      }

      blocks.set(name, block);

      // Math-link detection: scan the sibling .md (if any) for
      // [text](#anchor) inside math blocks. The remark renderer treats
      // math as opaque; links leak through and break pdflatex.
      const mdPath = join(dir, `${name}.md`);
      if (existsSync(mdPath)) {
        const mdContent = readFileSync(mdPath, "utf-8");
        checkMathLinks(name, mdContent, mdPath, issues);
      }
    } catch (e) {
      issues.push({
        level: "error",
        block: name,
        message: `Import error: ${e instanceof Error ? e.message : String(e)}`,
        file: `${name}.ts`,
      });
    }
  }

  return blocks;
}

/**
 * Check that a chapter's section manifests don't list the same block
 * twice — either within one `section.blocks[]` array or across
 * sibling sections in the same chapter.
 *
 * Each duplicate produces multiple `\label{}` calls in the rendered
 * `.tex`, which surface as pdflatex "multiply defined" warnings and
 * break `\ref{}` cross-references (LaTeX picks the LAST definition,
 * silently re-pointing earlier readers to wrong content).
 *
 * History: CI build run 26736170013 failed with 14 multiply-defined
 * labels traced to 7 duplicated block entries (g-action-on-substrate
 * + 3 table-data siblings + braid-fluid + atom-mass + neutron).
 */
function checkSectionDedupes(
  chapter: Chapter,
  chapterFile: string,
  issues: ValidationIssue[],
): void {
  // Per-chapter aggregate: block → first section seen
  const blockOrigin = new Map<string, string>();
  for (const sec of chapter.sections) {
    if (!("blocks" in sec)) continue;
    // Within-section dupes
    const seenInSection = new Set<string>();
    for (const ref of (sec as Section).blocks) {
      if (seenInSection.has(ref)) {
        issues.push({
          level: "error",
          block: ref,
          file: chapterFile,
          message: `[section-block-dedupe] block "${ref}" listed twice in section "${(sec as Section).label ?? "(unnamed)"}" — each entry emits a \\label{}, producing pdflatex "multiply defined" errors`,
        });
      }
      seenInSection.add(ref);
      // Across-section dupes
      const prev = blockOrigin.get(ref);
      if (prev !== undefined && prev !== (sec as Section).label) {
        issues.push({
          level: "error",
          block: ref,
          file: chapterFile,
          message: `[chapter-block-dedupe] block "${ref}" listed in both section "${prev}" and section "${(sec as Section).label ?? "(unnamed)"}" — each entry emits a \\label{}, producing pdflatex "multiply defined" errors`,
        });
      } else {
        blockOrigin.set(ref, (sec as Section).label ?? "(unnamed)");
      }
    }
  }
}

/**
 * no-unlisted-block — a block manifest in the chapter directory that no
 * section of the chapter lists.
 *
 * Bean `eqly`. Such a block renders nowhere: no section emits it, so it is in
 * no page, no PDF and no index, while its `.md`, `.ts` and QA verdict go on
 * looking like live content to every census taken over the directory. The qou
 * orphaned-content census of 2026-10-04 (issue #2106) found 3 of 3,676 block
 * manifests in that state, each with a QA sidecar.
 *
 * The OTHER direction — listed in a section, absent from disk — is not here
 * because it is already an error: `loadBlocksFromDir` reports
 * `Block manifest not found` for every listed name with no `.ts`.
 *
 * Only manifests that PARSE AS A BLOCK are reported. A chapter directory also
 * holds its own manifest (`<dir>.ts`) and may hold helper modules; a file that
 * is not a block cannot be an unlisted one, and flagging it would be noise
 * that teaches readers to ignore the finding. Only the candidates are
 * imported — the listed blocks are imported anyway by the load that follows.
 *
 * A chapter with a section REFERENCE (`{ name }`, no `blocks`) keeps part of
 * its membership somewhere this function does not read, so "listed in no
 * section" cannot be determined. That is said once, as `info`, rather than
 * reported as a set of orphans that might be listed after all.
 *
 * A warning rather than an error: it marks content that renders nowhere, not
 * a build that will fail, and a folio decides whether the block is dead
 * (move it to `fsh-guts`) or simply unplaced (list it).
 */
async function checkUnlistedBlocks(
  chapter: Chapter,
  dir: string,
  chapterFile: string,
  listed: readonly string[],
  issues: ValidationIssue[],
): Promise<void> {
  const isRef = (sec: object): boolean => !("blocks" in sec);
  const hasRef = chapter.sections.some(
    (sec) => isRef(sec) || ((sec as Section).subsections ?? []).some(isRef),
  );
  if (hasRef) {
    issues.push({
      level: "info",
      block: "(chapter)",
      file: chapterFile,
      message:
        `check "no-unlisted-block" could not determine unlisted blocks in ${dir}: ` +
        `the chapter lists a section by reference, so its membership is not all in this manifest.`,
    });
    return;
  }
  const own = basename(dir);
  const listedSet = new Set(listed);
  for (const name of discoverManifests(dir)) {
    if (name === own || listedSet.has(name)) continue;
    let block: unknown;
    try {
      block = (await import(join(dir, `${name}.ts`))).default;
    } catch {
      continue; // not loadable, so not demonstrably a block; other checks own import errors
    }
    if (!parseBlock(block).success) continue;
    issues.push({
      level: "warning",
      block: name,
      file: `${name}.ts`,
      message:
        `[unlisted-block] block "${name}" is in ${dir} but no section of ${basename(chapterFile)} lists it, ` +
        `so it renders nowhere. List it in a section, or move it out of the chapter.`,
    });
  }
}

/**
 * Scan a block's `.md` content for Markdown link syntax inside a math
 * block. The remark renderer doesn't recurse into `$$…$$` or `\[…\]`
 * content (math is a leaf node), so `[text](#anchor)` leaks through
 * literally. The `escapeLatex` pass then turns `#` into `\#`, which —
 * when followed by `\text{…}` — puts `#` in restricted horizontal
 * mode and trips the pdflatex "macro parameter character `#'" error.
 *
 * History: CI build run 26736170013 had three such patterns
 * (reeb-u1-chart-swap, phi-q-wkb-greens-function, higgs-t28). Catching
 * them at authoring time prevents the same class of failure.
 */
function checkMathLinks(
  blockName: string,
  mdContent: string,
  mdFile: string,
  issues: ValidationIssue[],
): void {
  // Match $$…$$ (multi-line) and \[…\] math blocks.
  const mathBlockRegex = /\$\$([\s\S]*?)\$\$|\\\[([\s\S]*?)\\\]/g;
  // Markdown link with internal anchor: [text](#anchor) or [text](\#anchor).
  const mdLinkRegex = /\[[^\]]+\]\(\\?#[^)]+\)/;
  let m: RegExpExecArray | null;
  while ((m = mathBlockRegex.exec(mdContent)) !== null) {
    const body = m[1] ?? m[2] ?? "";
    const linkMatch = body.match(mdLinkRegex);
    if (linkMatch) {
      const lineNum = mdContent.slice(0, m.index).split("\n").length;
      issues.push({
        level: "error",
        block: blockName,
        file: mdFile,
        message: `[math-link-detected] Markdown link "${linkMatch[0]}" appears inside a math block (line ${lineNum}) — math content is not parsed for Markdown links, so this leaks through as literal LaTeX and produces a "macro parameter character #'" error. Move the cross-reference outside the math block, or use \\hyperref[anchor]{text} directly.`,
      });
    }
  }
}

/**
 * Validate all content objects in a paper or flat directory.
 *
 * If the directory contains a paper manifest (same name as dir),
 * loads chapters and validates blocks within each chapter directory.
 * Otherwise falls back to flat-directory validation.
 *
 * @param objectsDir - Paper directory or flat directory with .ts + .md + .lean files
 * @returns Validation result with issues
 */
/**
 * Every section label in a chapter, at every depth. A section's
 * `subsections` hold sections in their own right, so a cross-reference
 * may name a nested one; collecting only the top level reported a
 * resolvable `#sec:` link as undefined.
 */
export function sectionLabels(sections: Chapter["sections"]): string[] {
  const out: string[] = [];
  for (const sec of sections) {
    if (!("label" in sec)) continue;
    if (sec.label) out.push(sec.label);
    const subs = (sec as Section).subsections;
    if (subs?.length) out.push(...sectionLabels(subs));
  }
  return out;
}

export async function validateObjects(
  objectsDir: string,
  opts: { strict?: boolean } = {},
): Promise<ValidationResult> {
  const issues: ValidationIssue[] = [];

  // Detect manifest type by importing and validating against schemas
  const { kind: manifestKind, path: manifestPath, data: manifestData } =
    await detectManifestKind(objectsDir);

  // Collect all blocks across all chapter directories (or flat dir)
  const allBlocks = new Map<string, { block: Block; dir: string }>();
  const allLabels = new Set<string>();

  if (manifestKind === "chapter" && manifestPath && manifestData) {
    // ── Chapter mode: manifest already validated by detectManifestKind ──
    const chapter: Chapter = manifestData;

    // Dedupe check: block listed twice in one section or across sibling
    // sections produces multiply-defined \label errors at pdflatex.
    checkSectionDedupes(chapter, manifestPath, issues);

    // Collect block names from sections
    const blockNames: string[] = [];
    for (const sec of chapter.sections) {
      if ("blocks" in sec) {
        blockNames.push(...(sec as Section).blocks);
        // Subsection blocks (one structural level deeper) are part of
        // the document too (structural-framework.md P1–P6).
        for (const sub of (sec as Section).subsections ?? []) {
          if ("blocks" in sub) blockNames.push(...(sub as Section).blocks);
        }
      }
    }

    await checkUnlistedBlocks(chapter, objectsDir, manifestPath, blockNames, issues);
    const chBlocks = await loadBlocksFromDir(objectsDir, blockNames, issues);
    for (const [name, block] of chBlocks) {
      allBlocks.set(name, { block, dir: objectsDir });
      if ("label" in block && block.label) {
        allLabels.add(block.label);
      }
    }
    // PR #565: also register the chapter's own label and the
    // labels of every section, so md-crossref-resolve recognises
    // [chap:foo](#chap:foo) and [sec:bar](#sec:bar) references.
    // Chapter-label collision is a real bug (warn); section-label
    // collision with an intro-block's label is an intentional
    // aliasing convention in this paper, so silently skip-add.
    if (chapter.label) {
      if (allLabels.has(chapter.label)) {
        issues.push({
          level: "warning",
          block: "(chapter)",
          message: `[chapter-label-collision] chapter label ${chapter.label!} shadows an existing block label`,
        });
      } else {
        allLabels.add(chapter.label);
      }
    }
    // Every section label, subsections included: a `[text](#sec:…)` link may
    // target a nested section, and the blocks loop above already descends.
    for (const label of sectionLabels(chapter.sections)) {
      // Intentional aliasing with intro-block labels — skip-add only.
      allLabels.add(label);
    }
  } else if (manifestKind === "paper" && manifestPath && manifestData) {
    // ── Paper mode: manifest already validated by detectManifestKind ──
    const paper: Paper = manifestData;

    // Validate each chapter
    for (const chRef of paper.chapters) {
      const chDir = join(objectsDir, chRef.dir);
      const chPath = join(chDir, `${chRef.dir}.ts`);

      if (!existsSync(chPath)) {
        issues.push({
          level: "error",
          block: chRef.dir,
          message: `Chapter manifest not found: ${chPath}`,
        });
        continue;
      }

      try {
        const chMod = await import(chPath);
        const chapter: Chapter = chMod.default;

        const chResult = ChapterSchema.safeParse(chapter);
        if (!chResult.success) {
          for (const err of chResult.error.issues) {
            issues.push({
              level: "error",
              block: chRef.dir,
              message: `Chapter schema: ${err.path.join(".")}: ${err.message}`,
              file: `${chRef.dir}.ts`,
            });
          }
          continue;
        }

        // Dedupe check: block listed twice in one section or across sibling
        // sections produces multiply-defined \label errors at pdflatex.
        checkSectionDedupes(chapter, chPath, issues);

        // Collect block names from sections
        const blockNames: string[] = [];
        for (const sec of chapter.sections) {
          if ("blocks" in sec) {
            blockNames.push(...(sec as Section).blocks);
            for (const sub of (sec as Section).subsections ?? []) {
              if ("blocks" in sub) blockNames.push(...(sub as Section).blocks);
            }
          }
        }

        // Load and validate blocks in this chapter dir
        await checkUnlistedBlocks(chapter, chDir, chPath, blockNames, issues);
        const chBlocks = await loadBlocksFromDir(chDir, blockNames, issues);
        for (const [name, block] of chBlocks) {
          allBlocks.set(name, { block, dir: chDir });
          if ("label" in block && block.label) {
            allLabels.add(block.label);
          }
        }
        // PR #565: register chapter + section labels (paper mode).
        // Chapter-label collision is a real bug (warn). Section-label
        // collision is the intentional intro-block alias pattern in
        // this paper, so silently skip-add.
        if (chapter.label) {
          if (allLabels.has(chapter.label)) {
            issues.push({
              level: "warning",
              block: chRef.dir,
              message: `[chapter-label-collision] chapter label ${chapter.label} shadows an existing block label`,
            });
          } else {
            allLabels.add(chapter.label);
          }
        }
        for (const label of sectionLabels(chapter.sections)) allLabels.add(label);
      } catch (e) {
        issues.push({
          level: "error",
          block: chRef.dir,
          message: `Chapter import error: ${e instanceof Error ? e.message : String(e)}`,
        });
      }
    }
  } else {
    // ── Flat mode: validate all .ts files as blocks (legacy) ──
    const blocks = await loadBlocksFromDir(objectsDir, null, issues);
    for (const [name, block] of blocks) {
      allBlocks.set(name, { block, dir: objectsDir });
      if ("label" in block && block.label) {
        allLabels.add(block.label);
      }
    }

    if (allBlocks.size === 0 && issues.length === 0) {
      // A run that validates NOTHING is a broken run, not a clean one. This
      // was a `warning` returning `valid: true`, so the CLI printed
      // "✓ Valid — 1 issue(s)" and exited 0 over an empty corpus — which is
      // exactly what the default `objectsDir` produced when the pipeline ran
      // from a folio, since it pointed into the platform's own tree.
      issues.push({
        level: "error",
        block: "(none)",
        message:
          `No content manifests found in ${objectsDir} — refusing to report ` +
          `success. Expected a paper directory (<dir>/<dir>.ts) or a chapter ` +
          `directory. Run from the content repo, or pass the path explicitly.`,
      });
      return { valid: false, issues };
    }
  }

  // Pre-load all .md content once — avoids redundant filesystem reads
  // across Phase 2 (constraint rules) and Phase 3 (AST validation).
  // Store undefined for missing files to preserve the distinction from empty files.
  const mdCache = new Map<string, string | undefined>();
  for (const [name, { dir }] of allBlocks) {
    const mdPath = join(dir, `${name}.md`);
    mdCache.set(name, existsSync(mdPath) ? readFileSync(mdPath, "utf-8") : undefined);
  }

  // PR #565: harvest \label{eq:foo} declarations from .md content
  // into allLabels so [eq:foo](#eq:foo) cross-references resolve.
  // Don't strip fenced ```tex``` blocks — those are LaTeX render
  // targets and contain the actual equation labels. Collision-detect:
  // warn (don't error) if a \label{X} duplicates an existing label.
  const labelDecl = /\\label\{([^}]+)\}/g;
  for (const [, md] of mdCache) {
    if (!md) continue;
    for (const m of md.matchAll(labelDecl)) {
      const lbl = m[1];
      if (allLabels.has(lbl)) {
        // Intentional aliasing is common (a section label reuses
        // its anchor block's label). Skip the warning unless the
        // duplicate is between two distinct \label{} declarations
        // — those genuinely mask each other in cross-refs. We
        // can't distinguish here cheaply, so silently skip-add.
        continue;
      }
      allLabels.add(lbl);
    }
  }

  // A vocabulary module's rules may read what only its own layer can supply
  // (the science layer's sibling `.lean` and Lake-tree lookup, bean `saqd`):
  // each module that contributes context is set up once per run, against the
  // folio's content root, and asked per block below.
  const REPO_ROOT = findContentRepoRoot();
  const contextContributors = allConstraintContextContributors().map((c) => c({ repoRoot: REPO_ROOT }));

  // Phase 2: Constraint rules
  // `dir` comes from the MAP ENTRY, not from the enclosing scope. Every
  // `allBlocks.set` stores the directory the block was loaded from, and in
  // paper mode that is the block's CHAPTER dir — `objectsDir` is the paper
  // root, where none of the companion `.md` files live. The destructuring
  // dropped it, leaving a bare `dir` that resolved to nothing:
  // `ReferenceError: dir is not defined` on any run reaching a single block.
  // Restoring the binding is the fix; substituting `objectsDir` would silence
  // the crash and make `md-exists` fail for every block in the paper.
  // `cites-resolve` opens with `if (… || !ctx.allRefIds) return null`, and
  // this context never supplied `allRefIds` — so the only rule that
  // validates a block's `cites[]` against the bibliography could not fire
  // for any block, ever. `bib-qa` does not cover it either: it scans
  // `.tex` and `.md` for `\cite{}`, never the `.ts` manifest field.
  //
  // A folio with no bibliography is legitimate, so an absent registry is
  // not an error — but it must not read as "citations checked" either.
  const allRefIds = resolveAllReferenceIds(REPO_ROOT);
  if (!allRefIds) {
    issues.push({
      level: "info",
      block: "(bibliography)",
      message:
        "no reference registry configured and no reference nodes found — cites-resolve did not run, so " +
        "cites[] entries were NOT validated against references",
    });
  }

  for (const [name, { block, dir }] of allBlocks) {
    const mdContent = mdCache.get(name);
    const ctx: ConstraintContext = {
      ...Object.assign({}, ...contextContributors.map((perBlock) => perBlock({ rootName: name, dir }))),
      rootName: name,
      dir,
      allLabels,
      allRefIds,
      fileExists: (p: string) => existsSync(p),
      mdContent,
    };

    for (const rule of allConstraintRules()) {
      if (!rule.appliesTo.includes(block.kind)) continue;
      const msg = rule.check(block, ctx);
      if (msg) {
        const isWarning = msg.startsWith("[warning]");
        issues.push({
          level: isWarning ? "warning" : "error",
          block: name,
          message: isWarning ? msg.slice(10) : msg,
        });
      }
    }
  }

  // Phase 3: AST validation (render → parse)
  //
  // The render target comes from the folio's declared PROFILE, not from this
  // file. It used to render every block to LaTeX unconditionally, which on a
  // document folio raises `LaTeX AST:` errors against output that folio never
  // produces — its render path goes through pandoc and deliberately never
  // falls back to `latexmk`. See `schemas/ui/render-targets.ts`.
  const declaredProfile = readDeclaredFolioProfile(REPO_ROOT);
  const lookup = await resolveRenderTarget(declaredProfile.profile);
  if (lookup.miss) {
    // NOT a pass. A `warning` so a folio that has not declared a profile is
    // not blocked, and so the gap is visible rather than inferred from an
    // absence of LaTeX errors.
    issues.push({
      level: "warning",
      block: "(folio)",
      message:
        `Render/AST validation not performed: ${lookup.miss.detail} ` +
        `(${declaredProfile.declaredBy}).`,
    });
  } else {
    const { render, validate, format } = lookup.target;
    for (const [name, { block }] of allBlocks) {
      const mdContent = mdCache.get(name) ?? "";

      try {
        const rendered = render(block, mdContent);
        // A target with no `validate` renders but has no structural invariant
        // to check. Reported once below, not per block, and never as a pass.
        if (!validate) continue;
        const astResult = validate(rendered);
        if (!astResult.valid) {
          for (const err of astResult.errors) {
            issues.push({
              level: "error",
              block: name,
              message: `${format} AST: ${err}`,
              file: `${name}.md`,
            });
          }
        }
      } catch (e) {
        issues.push({
          level: "error",
          block: name,
          message: `Render error: ${e instanceof Error ? e.message : String(e)}`,
        });
      }
    }
    if (!validate && allBlocks.size > 0) {
      issues.push({
        level: "warning",
        block: "(folio)",
        message:
          `Blocks render to ${format}, which has no structural check — ` +
          `rendering succeeded, well-formedness was not verified.`,
      });
    }
  }

  // Phase 4: Glossary-term validation (defterm/refterm rules)
  const defBlocks = new Map<string, { block: Block; md: string | undefined }>();
  for (const [name, { block }] of allBlocks) {
    defBlocks.set(name, { block, md: mdCache.get(name) });
  }
  issues.push(...validateDefterms(defBlocks, { strict: opts.strict }));

  // Phase 5: Witnessed-value directive validation (:val[name] rules)
  issues.push(...validateValueDirectives(defBlocks, { strict: opts.strict }));

  // Phase 6: Simulator assets — does the declared `html:` exist on disk?
  //
  // Bean `023p`. Until this phase existed, `validate.ts` contained no mention
  // of `simulator` or `.html`, so a block declaring a dead path validated
  // clean: measured on qou, two of eleven targets were in neither repository
  // and `run-validate` exited 0 without naming either. `SimulatorBlock`'s own
  // doc comment claimed the pipeline checked this; it did not.
  //
  // Three states, and `undetermined` (a remote target, or a path outside the
  // folio) is reported rather than passed — the same rule as everywhere else
  // here: not having looked must never render as having looked and found
  // nothing wrong.
  {
    const sim = validateSimulatorAssets(
      [...allBlocks].map(([name, { block }]) => ({ name, block })),
      REPO_ROOT,
    );
    issues.push(...sim.issues);
  }

  const hasErrors = issues.some(i => i.level === "error");
  return { valid: !hasErrors, issues };
}

// ── CLI entry point ──────────────────────────────────────────────

if (import.meta.main) {
  const args = process.argv.slice(2);
  const strict = args.includes("--strict");
  const positional = args.filter(a => !a.startsWith("--"));

  // With no explicit path, validate every paper in the FOLIO. The default used
  // to be `join(HARNESS_ROOT, "content", "objects")` — an import-relative path, so
  // running the pipeline from a content repo pointed it at
  // `<folio-assistant>/content/objects`, which does not exist. It found no
  // manifests, called that a warning, and printed "✓ Valid" with exit 0. The
  // content validator has been validating nothing.
  const repoRoot = findContentRepoRoot();
  const targets = positional.length > 0
    ? positional.map(p => resolve(p))
    : findPapers(repoRoot).map(p => join(folioDir(repoRoot),  p));

  if (targets.length === 0) {
    console.error(
      `✗ No paper found under ${folioDir(repoRoot)} — expected at least ` +
      `one <paper>/<paper>.ts manifest.\n` +
      `  folio-assistant is the PLATFORM; run this from a folio checkout, or ` +
      `pass a paper/chapter directory explicitly.`,
    );
    process.exit(2);
  }

  let allValid = true;
  let total = 0;
  for (const dir of targets) {
    console.log(`Validating content objects in: ${dir}${strict ? " [strict]" : ""}\n`);
    const result = await validateObjects(dir, { strict });

    for (const issue of result.issues) {
      const icon = issue.level === "error" ? "✗" : issue.level === "warning" ? "⚠" : "ℹ";
      const file = issue.file ? ` (${issue.file})` : "";
      console.log(`  ${icon} [${issue.block}]${file}: ${issue.message}`);
    }

    console.log(`\n${result.valid ? "✓ Valid" : "✗ Invalid"} — ${result.issues.length} issue(s)\n`);
    allValid &&= result.valid;
    total += result.issues.length;
  }

  if (targets.length > 1) {
    console.log(`${allValid ? "✓ Valid" : "✗ Invalid"} — ${targets.length} papers, ${total} issue(s)`);
  }
  process.exit(allValid ? 0 : 1);
}
