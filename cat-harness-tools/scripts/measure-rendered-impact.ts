#!/usr/bin/env bun
/**
 * Measure a staging build against its published before side, and check the
 * prediction.
 *
 * The renderers PREDICT which rendered files a change alters, from their
 * dependency cones (`rendered-impact.json`). This compares the site the
 * staging job just built with the one already published for the base, and
 * writes `rendered-measured/v1`: the build diff and, from
 * `comparePrediction`, the files the prediction MISSED. A missed page is one
 * a reviewer was never shown, so the coverage gate counts it.
 *
 * ## Only when the before side IS the base
 *
 * The before side is main's site at the publish root, built from whatever
 * commit last published it (`_main-site.json` records it). If main moved
 * since, the diff also holds main's own changes, which would read as missed
 * pages. So `status` is `known` only when that commit is the PR's base, and
 * `not-base` otherwise; the coverage gate counts missed pages only when it is
 * `known`. With no manifest there is no before side to measure against, and
 * nothing is written: no file is "not measured", never "nothing missed".
 *
 * ## What is compared
 *
 * Exactly the files main's publish wrote (the manifest's list) on the before
 * side, and, on the after side, every built file except the staging job's
 * own artefacts. The publish root also holds `branches/` and the render log,
 * which are other sites. Run it BEFORE the staging banner is injected: the
 * banner names the commit, so every page would differ.
 *
 * Usage:
 *   bun run cat-harness-tools/scripts/measure-rendered-impact.ts --before pages --after _site
 *     --predicted _site/rendered-impact.json --base <sha> --out _site/rendered-measured.json
 *
 * @module cat-harness/scripts/measure-rendered-impact
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  comparePrediction,
  diffBuiltSites,
  RENDERED_IMPACT_TAG,
  RENDERED_MEASURED_TAG,
  RenderedImpactSchema,
  RenderedMeasuredSchema,
  type RenderedImpact,
  type RenderedMeasured,
} from "../schemas/ui/rendered-impact.js";

/** The manifest main's publish writes at the publish root (`publish-main-site.ts`). */
export const MAIN_SITE_MANIFEST = "_main-site.json";

/** Files the staging job adds to a built site that main's publish never writes. */
export const STAGING_ARTEFACTS =
  /^(changeset\.json|changeset-text\.json|rendered-impact\.json|rendered-measured\.json|blocks\.json|block-qa\.json|review-comments\.json|visual-diff\.json|visual\/.*)$/;

/** Several renderers' predictions merged into one, so one check covers the site. */
export function mergePredictions(impacts: readonly RenderedImpact[]): RenderedImpact {
  const files = new Map<string, RenderedImpact["files"][number]>();
  for (const i of impacts) for (const f of i.files) if (!files.has(f.path)) files.set(f.path, f);
  return RenderedImpactSchema.parse({
    $schema: RENDERED_IMPACT_TAG,
    renderer: impacts.map((i) => i.renderer).join("+") || "none",
    method: "cone",
    files: [...files.values()],
  });
}

/**
 * The measurement, or `undefined` when the before side has no manifest
 * (never published, or a stacked PR's base preview, which records none).
 */
export function measure(o: { before: string; after: string; predicted: readonly RenderedImpact[]; base: string }): RenderedMeasured | undefined {
  const mf = join(o.before, MAIN_SITE_MANIFEST);
  if (!existsSync(mf)) return undefined;
  const manifest = JSON.parse(readFileSync(mf, "utf-8")) as { commit: string | null; files: string[] };
  const published = new Set(manifest.files);
  const keep = (p: string) => published.has(p) || (!STAGING_ARTEFACTS.test(p) && existsSync(join(o.after, p)));
  const measured = diffBuiltSites(o.before, o.after, { renderer: "build-diff", base: o.base, keep });
  const check = comparePrediction(mergePredictions(o.predicted), measured);
  return RenderedMeasuredSchema.parse({
    $schema: RENDERED_MEASURED_TAG,
    status: manifest.commit && manifest.commit === o.base ? "known" : "not-base",
    baseCommit: o.base,
    beforeCommit: manifest.commit,
    measured,
    check,
  });
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const arg = (k: string) => {
    const i = argv.indexOf(k);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const [before, after, predicted, base, out] = [arg("--before"), arg("--after"), arg("--predicted"), arg("--base"), arg("--out")];
  if (!before || !after || !predicted || !base || !out) {
    console.error("usage: measure-rendered-impact.ts --before <publish root> --after <built site> --predicted <rendered-impact.json> --base <sha> --out <file>");
    process.exit(2);
  }
  const raw = JSON.parse(readFileSync(predicted, "utf-8")) as unknown;
  const impacts = (Array.isArray(raw) ? raw : [raw]).map((r) => RenderedImpactSchema.parse(r));
  const m = measure({ before, after, predicted: impacts, base });
  if (!m) {
    console.error(`no ${MAIN_SITE_MANIFEST} under ${before}: nothing to measure against, so nothing written (not "nothing missed")`);
  } else {
    writeFileSync(out, JSON.stringify(m, null, 2) + "\n");
    const missed = m.check.missed.length;
    console.error(
      `measured ${m.measured.files.length} changed file(s); ${m.check.confirmed.length} predicted, ${missed} missed` +
        (m.status === "known" ? "" : ` — before side built from ${m.beforeCommit ?? "an unrecorded commit"}, not the base ${base}: missed pages are not counted`),
    );
    for (const p of m.check.missed.slice(0, 20)) console.error(`  · missed: ${p}`);
  }
}
