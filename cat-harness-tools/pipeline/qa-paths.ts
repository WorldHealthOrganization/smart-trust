#!/usr/bin/env bun
/**
 * Where a BLOCK's QA verdict lives — one answer, for every writer and reader.
 *
 * ## The convention this replaces, and what it cost to replace
 *
 * A block is a family of companion files sharing one path prefix: `block.root`
 * is the `.ts` manifest minus its extension, and `${root}.md`, `${root}.lean`
 * and `${root}.qa.json` are its siblings. The verdict was simply one member of
 * that family, which is why nine sites across this pipeline each composed its
 * path by hand rather than calling anything — it was not a lookup, it was a
 * convention every reader already knew.
 *
 * Moving it is the owner's decision (2026-09-19): an artefact generated
 * primarily as a QA reviewer belongs under `test/results/` as part of a QA
 * process, and placement follows provenance. This module is what makes that
 * survivable — nine hand-composed paths become one function, so the family is
 * broken in exactly one place instead of nine.
 *
 * ## The tree MIRRORS the block's directory
 *
 * `docs/source/process-evidence/overview.qa.json` becomes
 * `test/results/block-qa/docs/source/process-evidence/overview.qa.json`.
 *
 * Flat would collide: block stems repeat freely across chapters, far more than
 * the four collisions measured in the KG corpus. Mirroring also keeps the
 * chapter legible in the path, which is what a reader opening a verdict needs.
 *
 * ## Reading falls back; writing never does
 *
 * {@link blockQaReadPaths} returns the results-tree location FIRST and the
 * legacy sibling SECOND. That asymmetry is the whole compatibility story:
 *
 * - A downstream folio has its verdicts committed beside its blocks. If this
 *   platform only looked in the results tree, every one of those folios would
 *   report every block as unaudited the day it upgraded — a false pass at
 *   corpus scale, which is the failure direction this repository guards
 *   against everywhere else.
 * - Writing to the legacy location as well would create two verdicts for one
 *   block that can disagree, and nothing would say which is current.
 *
 * So: read both, prefer the new, write only the new. A folio migrates by
 * running its sweep once.
 *
 * @module pipeline/qa-paths
 */
import { basename, dirname, join, relative } from "node:path";
import { existsSync, statSync } from "node:fs";

import { findDeclarationFile } from "../schemas/kg/cat-harness.ts";
import { manifestPath } from "./json-manifest.ts";
import { overlayPath } from "../scripts/lib/layer-output.ts";

/** Where block verdicts live now, relative to the layer root. */
export const BLOCK_QA_RESULTS_DIR = join("test", "results", "block-qa");

/** The sidecar suffix. One spelling, so a scan and a compose cannot disagree. */
export const BLOCK_QA_SUFFIX = ".qa.json";

/**
 * The canonical write location for a block's verdict.
 *
 * @param repoRoot  absolute layer root
 * @param blockRoot absolute block path prefix — the `.ts` manifest without its
 *                  extension, i.e. `block.root`
 */
export function blockQaPath(repoRoot: string, blockRoot: string): string {
  // `relative` rather than string surgery, so two spellings of one directory
  // cannot land on two different results paths.
  return join(repoRoot, BLOCK_QA_RESULTS_DIR, relative(repoRoot, blockRoot) + BLOCK_QA_SUFFIX);
}

/** The legacy location: the verdict as a companion of the block. */
export function legacyBlockQaPath(blockRoot: string): string {
  return blockRoot + BLOCK_QA_SUFFIX;
}

/**
 * Every place a block's verdict might be, newest convention first.
 *
 * Callers that want "the one that counts" take the first entry that exists;
 * callers auditing for duplicates want the whole list.
 */
export function blockQaReadPaths(repoRoot: string, blockRoot: string): string[] {
  // The results-tree entry through the layer output overlay: a mounted
  // layer's verdict is under `build/layers/<instance>/` (bean `cat-tools-sm8r`, item 4).
  return [overlayPath(blockQaPath(repoRoot, blockRoot)), legacyBlockQaPath(blockRoot)];
}

/**
 * The verdict to READ for a block, or `undefined` when it has none.
 *
 * `undefined` means genuinely unaudited. It is never returned because the
 * caller looked in the wrong place — that is the point of the fallback.
 */
export function existingBlockQaPath(repoRoot: string, blockRoot: string): string | undefined {
  return blockQaReadPaths(repoRoot, blockRoot).find((p) => existsSync(p));
}

// ── Translation verdicts ────────────────────────────────────────

/**
 * Where a TRANSLATION verdict lives — one per (subject, locale).
 *
 * The same three properties as the block tree above, for the same reasons: the
 * results tree MIRRORS the subject's directory (stems repeat across chapters
 * and locales), reading falls back to the legacy sibling so a downstream folio
 * does not report every translation unaudited the day it upgrades, and writing
 * never falls back so one subject cannot end up with two verdicts that
 * disagree.
 *
 * **One reason here is not in the block case, and it is the stronger one.** A
 * translation subject may be a page under the Jekyll site — `docs/index.md` is
 * the one that prompted this (bean `pp93`) — and a sibling verdict there is not
 * merely untidy, it is PUBLISHED. `docs/index.fr.translation-qa.json` would be
 * copied into `_site` and served, an internal QA artefact on the public docs
 * site with no page linking to it. The results tree is outside the site, so the
 * question does not arise.
 */
export const TRANSLATION_QA_RESULTS_DIR = join("test", "results", "translation-qa");

/** The sidecar suffix, given a locale. One spelling, as above. */
export function translationQaSuffix(locale: string): string {
  return `.${locale}.translation-qa.json`;
}

/**
 * The canonical write location for one (subject, locale) translation verdict.
 *
 * @param repoRoot     absolute layer root
 * @param subjectRoot  absolute subject path prefix — the `.md` without its
 *                     extension, whether that is a block or a docs page
 */
export function translationQaPath(
  repoRoot: string,
  subjectRoot: string,
  locale: string,
): string {
  return join(
    repoRoot,
    TRANSLATION_QA_RESULTS_DIR,
    relative(repoRoot, subjectRoot) + translationQaSuffix(locale),
  );
}

/** The legacy location: the verdict as a companion of the subject. */
export function legacyTranslationQaPath(subjectRoot: string, locale: string): string {
  return subjectRoot + translationQaSuffix(locale);
}

/**
 * Every place a (subject, locale) verdict might be, newest convention first.
 */
export function translationQaReadPaths(
  repoRoot: string,
  subjectRoot: string,
  locale: string,
): string[] {
  return [
    overlayPath(translationQaPath(repoRoot, subjectRoot, locale)),
    legacyTranslationQaPath(subjectRoot, locale),
  ];
}

/**
 * The verdict to READ for one (subject, locale), or `undefined` when it has
 * none. `undefined` means genuinely unaudited, never "looked in the wrong
 * place".
 */
export function existingTranslationQaPath(
  repoRoot: string,
  subjectRoot: string,
  locale: string,
): string | undefined {
  return translationQaReadPaths(repoRoot, subjectRoot, locale).find((p) => existsSync(p));
}

/**
 * The block manifest a results-tree verdict belongs to.
 *
 * The inverse of {@link blockQaPath}, and it exists for one caller:
 * `no-orphan-sidecar` in `validate.ts`. That check asks whether a verdict's
 * `.ts` still exists, and it used to answer by looking in the same directory —
 * pure adjacency, which the move removes.
 *
 * **Keeping that check working is not optional.** It catches a block moving
 * between chapters and leaving a verdict behind, computed against content that
 * has since changed; measured in `qou`, 18 orphans, 5 of them from moves. A
 * relocation that quietly dropped it would trade a real safety property for a
 * tidier layout.
 *
 * Returns `undefined` for a path that is not under the results tree, so a
 * caller cannot accidentally map a legacy sibling onto itself.
 */
export function blockOfQaPath(repoRoot: string, qaPath: string): string | undefined {
  const base = join(repoRoot, BLOCK_QA_RESULTS_DIR);
  const rel = relative(base, qaPath);
  if (rel.startsWith("..") || !rel.endsWith(BLOCK_QA_SUFFIX)) return undefined;
  const root = join(repoRoot, rel.slice(0, -BLOCK_QA_SUFFIX.length));
  return manifestPath(dirname(root), basename(root));
}

// ── The sweep's anchor ───────────────────────────────────────────

/**
 * Root of the CONTENT repo that owns the swept blocks, discovered by
 * walking up from the sweep target until a directory containing `.git`
 * (a dir in a normal checkout, a file in a git worktree) or its own
 * layer declaration (`<name>.json`, `findDeclarationFile`) is found.
 *
 * Sidecar `paths` must be anchored HERE, not at the platform checkout:
 * anchoring there bakes the content
 * checkout's *directory name* into every recorded path
 * (`../qou/content/...`), which poisons sidecars when the sweep runs
 * against a git worktree (`../agent-<id>/content/...` — dangling once
 * the worktree is pruned; observed live in qou PR #3604). Paths
 * relative to the content repo root (`content/...`) are invariant
 * across checkout names, worktrees, and invocation cwd.
 *
 * `fallback` (the platform checkout, in the sweep) is returned only when
 * nothing above the target qualifies. The platform checkout remains the
 * right anchor for the *checker script* hashes and script sidecars, which
 * genuinely live there.
 */
export function findContentRepoRoot(startAbs: string, fallback: string): string {
  // The sweep target may be a block-path PREFIX (`.../<block>` with no
  // extension) rather than an existing file or directory — statSync on
  // it would throw ENOENT. Walk up from the nearest existing directory.
  let dir = existsSync(startAbs) && statSync(startAbs).isDirectory()
    ? startAbs
    : dirname(startAbs);
  while (true) {
    // THIS directory declares a layer, or holds `.git`. Not
    // `resolveHarnessConfigPath(dir)`: that climbs to ancestors itself, so it
    // succeeded at the very first directory tried whenever any ancestor had a
    // config, and a sweep of `folio/` anchored at `folio/`. Its verdicts then
    // landed at `folio/test/results/block-qa/…`, where `blockQaPath` (relative
    // to the layer root) never looks. Bean `s3p2`, owner ruling 2026-09-23.
    if (existsSync(join(dir, ".git")) || findDeclarationFile(dir) !== undefined) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      // Fell off the filesystem root: fall back to the legacy anchor so
      // the sweep still runs (paths then match the pre-fix behaviour).
      return fallback;
    }
    dir = parent;
  }
}
