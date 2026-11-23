#!/usr/bin/env bun
/**
 * Emit `foreshadows.json` — every block's forward pointers, derived from its
 * `.md` narrative and unioned with whatever the manifest declares.
 *
 * ## Why this is generated rather than authored
 *
 * A forward pointer already lives in the prose: *"see X"*, *"the remarks below
 * frame these regimes as ODEs"*. Writing it a second time into `foreshadows:`
 * duplicates authored content into metadata, and the copy goes stale the
 * moment the prose changes — the same drift class the witness and QA-sidecar
 * machinery already spends real effort policing.
 *
 * So this follows the pattern the corpus already uses for derived data:
 * `proof-objects.json` (formalization status, derived from Lean, never stored
 * on the block) and `glossary.json` (built from `defines`). Committed,
 * regenerated, never hand-edited.
 *
 * ## What stays in the manifest
 *
 * `foreshadows:` is NOT emptied by this. Derivation reaches exactly one of the
 * field's two cases:
 *
 *   - a pure forward pointer, not in `uses[]`  → DERIVED here
 *   - a real dependency the paper states later on purpose → DECLARED, and
 *     underivable: no rule separates it from a forward `uses[]` edge that is
 *     merely a defect. Only the author can.
 *
 * The union of the two is what every consumer should read.
 *
 * ## The checkers do not read this file
 *
 * `loadChapterGraph` runs the same derivation from source on every load, so a
 * stale or missing `foreshadows.json` can never change a verdict. This
 * artifact is an emission for humans, diffs, and other tools.
 *
 * Usage:
 *   bun run cat-harness-tools/pipeline/build-foreshadows.ts <paper-dir> [--check]
 *
 * `--check` regenerates in memory and exits 1 if the committed file differs,
 * naming the drifted blocks. That is the CI gate; it never rewrites.
 */
import { folioDirDeferred } from "../schemas/kg/cat-harness.js";
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  parseForeshadows,
  parseMdBlockRefs,
  parseManifestStringArray,
} from "./qa-checkers-extended";
import { findContentRepoRoot } from "./repo-root";

// The CONTENT repo's content/, not folio-assistant's. An import-relative path
// resolves to `folio-assistant/content` — which holds only `pipeline/` — so
// every paper lookup would miss and this would cheerfully emit an empty
// artifact. That exact mistake once left the whole detangler axis reporting
// `n/a` while looking healthy; see the note on folioDirOf() in
// qa-checkers-extended.ts.
const folioDirOf = folioDirDeferred(findContentRepoRoot(), import.meta.url);

interface BlockEntry {
  derived: string[];
  declared: string[];
  effective: string[];
}

export function buildForeshadows(paper: string): {
  schema: string;
  paper: string;
  generated_from: string;
  note: string;
  totals: { blocks: number; derived: number; declared: number; effective: number };
  blocks: Record<string, BlockEntry>;
} {
  const paperDir = join(folioDirOf(), paper);
  const paperTs = join(paperDir, `${paper}.ts`);
  if (!existsSync(paperTs)) throw new Error(`no paper manifest: ${paperTs}`);
  const dirs = [...readFileSync(paperTs, "utf-8").matchAll(/dir:\s*"([^"]+)"/g)].map(
    (m) => m[1],
  );

  const slugToLabel = new Map<string, string>();
  const uses = new Map<string, Set<string>>();
  const declared = new Map<string, string[]>();
  const mdRefs = new Map<string, string[]>();

  for (const dir of dirs) {
    const chDir = join(paperDir, dir);
    if (!existsSync(chDir)) continue;
    for (const f of readdirSync(chDir)) {
      if (!f.endsWith(".ts") || f === `${dir}.ts`) continue;
      const src = readFileSync(join(chDir, f), "utf-8");
      const m = src.match(/label:\s*"([^"]+)"/);
      if (!m) continue;
      const label = m[1];
      slugToLabel.set(f.slice(0, -3), label);
      uses.set(label, new Set(parseManifestStringArray(src, "uses")));
      declared.set(label, parseForeshadows(src));
      const md = join(chDir, `${f.slice(0, -3)}.md`);
      if (existsSync(md)) mdRefs.set(label, parseMdBlockRefs(readFileSync(md, "utf-8")));
    }
  }

  // Reading order, from each chapter manifest's ordered sections[].blocks[].
  const pos = new Map<string, number>();
  const STRIDE = 100_000;
  dirs.forEach((dir, ci) => {
    const mf = join(paperDir, dir, `${dir}.ts`);
    if (!existsSync(mf)) return;
    let within = 0;
    for (const bm of readFileSync(mf, "utf-8").matchAll(/blocks\s*:\s*\[([\s\S]*?)\]/g))
      for (const sm of bm[1].matchAll(/"([^"]+)"/g)) {
        const lb = slugToLabel.get(sm[1]);
        if (lb && !pos.has(lb)) pos.set(lb, ci * STRIDE + within++);
      }
  });

  const blocks: Record<string, BlockEntry> = {};
  let dTot = 0;
  let cTot = 0;
  let eTot = 0;
  for (const [label, refs] of [...mdRefs].sort(([a], [b]) => a.localeCompare(b))) {
    const myPos = pos.get(label);
    if (myPos === undefined) continue; // unlisted block: no reading order
    const u = uses.get(label) ?? new Set();
    const derived = refs
      .filter((t) => t !== label && !u.has(t) && pos.has(t) && (pos.get(t) as number) > myPos)
      .sort();
    const dec = (declared.get(label) ?? []).slice().sort();
    if (!derived.length && !dec.length) continue;
    const effective = [...new Set([...derived, ...dec])].sort();
    blocks[label] = { derived, declared: dec, effective };
    dTot += derived.length;
    cTot += dec.length;
    eTot += effective.length;
  }

  return {
    schema: "foreshadows/v1",
    paper,
    generated_from:
      "block .md narratives (](#kind:label) links + `kind:label` mentions), " +
      "filtered to labels later in reading order and absent from uses[], " +
      "unioned with the manifest's declared foreshadows[]",
    note:
      "GENERATED — do not hand-edit. Rebuild with " +
      "`bun run cat-harness-tools/pipeline/build-foreshadows.ts <paper>`. The QA " +
      "checkers derive the same data from source on every run and never read " +
      "this file, so it cannot go stale in a way that changes a verdict.",
    totals: { blocks: Object.keys(blocks).length, derived: dTot, declared: cTot, effective: eTot },
    blocks,
  };
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const check = args.includes("--check");
  const paper = args.find((a) => !a.startsWith("--"));
  if (!paper) {
    console.error("usage: build-foreshadows.ts <paper-dir> [--check]");
    process.exit(2);
  }
  const built = buildForeshadows(paper);
  const out = join(folioDirOf(), paper, "foreshadows.json");
  const text = `${JSON.stringify(built, null, 2)}\n`;

  if (check) {
    if (!existsSync(out)) {
      console.error(`foreshadows.json missing for ${paper} — run without --check`);
      process.exit(1);
    }
    const have = readFileSync(out, "utf-8");
    if (have === text) {
      console.log(`foreshadows.json up to date (${built.totals.blocks} blocks)`);
      process.exit(0);
    }
    // Name the drifted blocks rather than just reporting inequality.
    const prev = JSON.parse(have) as { blocks?: Record<string, BlockEntry> };
    const before = prev.blocks ?? {};
    const keys = [...new Set([...Object.keys(before), ...Object.keys(built.blocks)])].sort();
    const drift = keys.filter(
      (k) =>
        JSON.stringify(before[k]?.effective ?? null) !==
        JSON.stringify(built.blocks[k]?.effective ?? null),
    );
    console.error(`foreshadows.json is stale for ${paper}: ${drift.length} block(s) differ`);
    for (const k of drift.slice(0, 20)) {
      console.error(
        `  ${k}\n    committed: ${JSON.stringify(before[k]?.effective ?? [])}` +
          `\n    rebuilt  : ${JSON.stringify(built.blocks[k]?.effective ?? [])}`,
      );
    }
    if (drift.length > 20) console.error(`  … and ${drift.length - 20} more`);
    process.exit(1);
  }

  writeFileSync(out, text);
  const t = built.totals;
  console.log(
    `wrote ${out}\n  ${t.blocks} blocks | ${t.derived} derived + ${t.declared} declared -> ${t.effective} effective`,
  );
}
