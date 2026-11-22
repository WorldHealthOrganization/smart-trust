#!/usr/bin/env bun
/**
 * Render each library entry's COVER — page 1 of its held PDF — into the
 * entry, as `cover.png` (`COVER_FILENAME`), where `avatarOf` takes it before
 * any figure. New ingests get a cover from `ingest-document`'s cover arm; this
 * backfills older entries.
 *
 * It can only render what this checkout HOLDS. Upload PDFs are pinned by
 * sha256 and not committed, so run it where the PDFs are (the checkout that
 * ingested them); an entry whose source is not on disk is listed and skipped,
 * never guessed at. An entry that already has a cover is left alone unless
 * `--force`. `--check` writes nothing and exits 1 when a held PDF lacks one.
 *
 *     bun run cat library:covers           # render the missing ones
 *     bun run cat library:covers --check   # report only
 *
 * @covers library
 */
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { repoRootFor } from "../schemas/kg/cat-harness.ts";
import { COVER_FILENAME, readLibraryGraph } from "./library-graph.ts";
import { sourceFileOf } from "./lib/library-source.ts";
import { HARNESS_ROOT } from "./lib/roots.ts";

/** What one entry needs: rendered, already has one, or nothing to render from. */
export type CoverState = "missing" | "present" | "not-held" | "not-pdf" | "withheld";

/** The cover state of one entry, and where its PDF and cover are (repo-relative). */
export function coverStateOf(
  repoRoot: string,
  e: Parameters<typeof sourceFileOf>[1] & { withheld?: unknown },
  uploads: Parameters<typeof sourceFileOf>[2],
): { state: CoverState; pdf?: string; cover: string } {
  const cover = join(e.dir, COVER_FILENAME);
  if (e.withheld) return { state: "withheld", cover };
  const pdf = sourceFileOf(repoRoot, e, uploads);
  if (!pdf) return { state: "not-held", cover };
  if (!/\.pdf$/i.test(pdf)) return { state: "not-pdf", pdf, cover };
  return { state: existsSync(join(repoRoot, cover)) ? "present" : "missing", pdf, cover };
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const check = argv.includes("--check");
  const force = argv.includes("--force");
  const root = join(HARNESS_ROOT);
  const repoRoot = repoRootFor(root);
  const g = readLibraryGraph([root, repoRoot]);
  if (g === null) {
    console.log("  · no library is declared — nothing to render");
    process.exit(0);
  }
  const helper = join(dirname(fileURLToPath(import.meta.url)), "pdf-cover.py");
  const tally: Record<CoverState | "rendered" | "failed", number> = {
    missing: 0, present: 0, "not-held": 0, "not-pdf": 0, withheld: 0, rendered: 0, failed: 0,
  };
  for (const e of g.entries) {
    const s = coverStateOf(repoRoot, e, g.uploads);
    const todo = s.state === "missing" || (force && s.state === "present");
    if (!todo || !s.pdf) {
      tally[s.state]++;
      if (s.state === "not-held") console.log(`  · ${e.instance}/${e.id}: source not held here — skipped`);
      continue;
    }
    if (check) {
      tally.missing++;
      console.log(`  ✗ ${e.instance}/${e.id}: no ${COVER_FILENAME}`);
      continue;
    }
    const r = Bun.spawnSync(["python3", helper, join(repoRoot, s.pdf), "-o", join(repoRoot, s.cover), "--width", "300"]);
    if (r.exitCode === 0) {
      tally.rendered++;
      console.log(`  ✓ ${s.cover}`);
    } else {
      tally.failed++;
      console.error(`  ✗ ${e.instance}/${e.id}: pdf-cover.py exited ${r.exitCode}: ${new TextDecoder().decode(r.stderr).trim()}`);
    }
  }
  console.log(
    `\n${tally.rendered} rendered, ${tally.present} already had one, ${tally.missing} missing, ` +
      `${tally["not-held"]} not held here, ${tally["not-pdf"]} not a PDF, ${tally.withheld} withheld, ${tally.failed} failed`,
  );
  process.exit(tally.failed > 0 || (check && tally.missing > 0) ? 1 : 0);
}
