#!/usr/bin/env bun
/**
 * Report on this layer's theme art — the intake check, run over what shipped.
 *
 * @module scripts/check-theme-art
 * @covers none — its subject is a layer's declared theme ART, read from
 * the declaration's `images` via `readDeclaration` and grouped by
 * `THEME_LAYOUTS`. It resolves NO `themes` directory; `check:instance-themes`
 * covers the graph.
 *
 * `schemas/library/theme-art-intake.ts` is the check itself and is pure. This
 * is its CLI face: it reads the layer's declaration, groups the declared
 * images by role, and runs intake over each group. A report is not an
 * action: it never repairs art.
 *
 * `--check` exits non-zero on a refusal (`bun run cat check:theme-art:check`
 * is the CI gate).
 *
 * Exit codes: 0 report only, or `--check` with no refusals · 1 `--check` with a
 * refusal.
 */
import { HARNESS_ROOT } from "./lib/roots.ts";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  readDeclaration,
  siteDirFor,
} from "../schemas/kg/cat-harness.js";
import { THEME_LAYOUTS, type ThemeLayout } from "../schemas/ui/theme.js";
import {
  formatIntakeReport,
  ingestThemeArt,
  type ArtCandidate,
  type ThemeArtIntakeResult,
} from "../schemas/library/theme-art-intake.js";

/** Roles whose images are theme backdrops, as opposed to icons or marks. */
export function backdropRoles(
  images: readonly { role?: string; layout?: string }[],
): string[] {
  const roles = new Set<string>();
  for (const img of images) {
    // A backdrop is an image declared WITH a layout: the layouts are what make
    // it a backdrop rather than a mark. Reading it off the declaration rather
    // than matching on a name prefix, because a role is a name an author chose
    // and `landing-` is a convention, not a contract.
    if (img.role && img.layout && THEME_LAYOUTS.some((l) => l === img.layout)) {
      roles.add(img.role);
    }
  }
  return [...roles].sort();
}

/** Run intake over one role's declared images, reading each file from disk. */
export function checkRole(
  root: string,
  role: string,
  images: readonly { role?: string; layout?: string; src?: string }[],
  declaredDirectories: readonly string[],
): { result: ThemeArtIntakeResult; unread: string[] } {
  const candidates: ArtCandidate[] = [];
  const unread: string[] = [];
  for (const img of images) {
    if (img.role !== role || !img.src || !img.layout) continue;
    try {
      candidates.push({
        layout: img.layout as ThemeLayout,
        sourcePath: img.src,
        bytes: new Uint8Array(readFileSync(join(root, img.src))),
      });
    } catch {
      // Reported separately, never folded into the intake result: "declared but
      // the file is not there" is a different fact from "the file is the wrong
      // shape", and a reader that cannot tell them apart will fix the wrong one.
      unread.push(img.src);
    }
  }
  const first = images.find((i) => i.role === role && i.src)?.src ?? "";
  const destinationDir = first.slice(0, Math.max(0, first.lastIndexOf("/"))) || ".";
  return {
    result: ingestThemeArt({ role, candidates, destinationDir, declaredDirectories }),
    unread,
  };
}

if (import.meta.main) {
  const check = process.argv.includes("--check");
  const root = HARNESS_ROOT;
  const decl = readDeclaration(root);
  const images = decl?.images ?? [];
  // Declared graph directories, PLUS the site directory — and the second half
  // is a correction the first run of this script forced. `docs/` is not a
  // declared directory and should not be: a declared entry names a GRAPH, and
  // the site is the render TARGET, resolved by `siteDirFor` rather than
  // declared. Without it every one of this layer's five backdrop roles was
  // refused for `undeclared-destination` — a check firing on all of its
  // subjects is a check that is wrong, not a repository that is.
  //
  // The constraint it came from is still right: the failure being caught is
  // art at the REPOSITORY ROOT, named by nothing at all. `docs/` is named by
  // the declaration's own site resolution. (Whether the site directory should
  // ALSO be a declared renderable graph is bean `x4a6`, and is a different
  // question from this one.)
  const dirs = [
    ...(decl?.directories ?? []).map((d) => d.path),
    siteDirFor(root),
  ];

  const roles = backdropRoles(images);
  let refused = 0;
  let missingFiles = 0;

  for (const role of roles) {
    const { result, unread } = checkRole(root, role, images, dirs);
    console.log(formatIntakeReport(result, role));
    for (const u of unread) {
      missingFiles += 1;
      console.log(`  ✗ [declared-but-absent] ${u}`);
      console.log(`      → the declaration names a file that is not on disk; add the file or remove the entry`);
    }
    console.log("");
    if (!result.ok) refused += 1;
  }

  console.log(
    `${roles.length} backdrop role(s); ${refused} refused, ${missingFiles} declared file(s) absent`,
  );

  if (check && (refused > 0 || missingFiles > 0)) {
    console.error(
      `theme art is not in order: ${refused} role(s) refused, ${missingFiles} file(s) declared but absent`,
    );
    process.exit(1);
  }
}
