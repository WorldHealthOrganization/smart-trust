#!/usr/bin/env bun
/**
 * A BLIND second annotation of the crdm-detect corpus.
 *
 * The corpus's labels sit beside the text in
 * `scripts/eval/crdm-detect-corpus.json`, and the skill itself names two items
 * and their labels, so the second annotator is a fresh agent given only a
 * blinded packet.
 *
 * Two commands:
 *
 *   pack <out-dir>
 *     Writes the ONLY things the annotator is handed:
 *     - `items.json` — opaque ids (`b01`…), title and text. No issue number,
 *       so nothing in any other file can be matched back to an item.
 *     - `skill.md` — `crdm-detect.md` with every paragraph that names a CORPUS
 *       issue removed (it states two items' labels).
 *     - `labels.template.json` — the shape to fill in.
 *     And, separately and NOT for the annotator, `key.json` (id → number).
 *
 *   agree <out-dir> <labels.json>
 *     Joins the second labels to the first through the key and reports raw
 *     agreement, Cohen's kappa, and each disagreement with both reasons.
 *
 * Usage:
 *   bun run cat-harness-tools/scripts/eval-crdm-detect-blind.ts pack /tmp/blind
 *   bun run cat-harness-tools/scripts/eval-crdm-detect-blind.ts agree /tmp/blind /tmp/blind/labels.json
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { ownDirectoryById } from "../schemas/kg/cat-harness.ts";
import { HARNESS_ROOT, TOOLS_ROOT } from "./lib/roots.ts";
import { harnessRel } from "./lib/harness-layout.ts";

const INSTANCE = join(HARNESS_ROOT);
const CORPUS = join(TOOLS_ROOT, "scripts", "eval", "crdm-detect-corpus.json");
// The skill is found through the DECLARED knowledge graph, not a spelled
// `skills/` — the declared-path rule, and a relocation-proof lookup.
// declared-path-literal: the fallback only — the directory is read by its declared id `sdlc-skills`; the literal is the convention when the `sdlc` sub-graph is not declared, at the call site so the choice is visible.
const SKILL = join(ownDirectoryById(INSTANCE, "sdlc-skills", harnessRel("sdlc/skills", INSTANCE)), "crdm", "crdm-detect.md");

export interface Item { number: number; title: string; isFeature: boolean; why: string; text: string }
export interface SecondLabel { id: string; isFeature: boolean; why: string }

/**
 * Drop every paragraph that names an issue IN THE CORPUS — that is where a
 * label leaks (the skill states #187's and #199's). A paragraph citing some
 * other issue is guidance, and removing it would hand the annotator a thinner
 * skill than the detector reads.
 */
export function redact(markdown: string, corpusNumbers: readonly number[]): string {
  const named = new Set(corpusNumbers);
  return markdown
    .split(/\n{2,}/)
    .filter((p) => ![...p.matchAll(/#(\d{2,4})\b/g)].some((m) => named.has(Number(m[1]))))
    .join("\n\n");
}

export function pack(items: Item[]): { blinded: { id: string; title: string; text: string }[]; key: Record<string, number> } {
  const key: Record<string, number> = {};
  const blinded = items.map((it, i) => {
    const id = `b${String(i + 1).padStart(2, "0")}`;
    key[id] = it.number;
    return { id, title: it.title, text: it.text };
  });
  return { blinded, key };
}

/** Cohen's kappa for two binary raters. */
export function kappa(pairs: [boolean, boolean][]): number {
  const n = pairs.length;
  if (n === 0) return NaN;
  const agree = pairs.filter(([a, b]) => a === b).length / n;
  const pa = pairs.filter(([a]) => a).length / n;
  const pb = pairs.filter(([, b]) => b).length / n;
  const chance = pa * pb + (1 - pa) * (1 - pb);
  return chance === 1 ? 1 : (agree - chance) / (1 - chance);
}

if (import.meta.main) {
  const [cmd, dir, labelsPath] = process.argv.slice(2);
  const items = JSON.parse(readFileSync(CORPUS, "utf8")) as Item[];
  if (cmd === "pack" && dir) {
    mkdirSync(dir, { recursive: true });
    const { blinded, key } = pack(items);
    writeFileSync(join(dir, "items.json"), `${JSON.stringify(blinded, null, 2)}\n`);
    writeFileSync(join(dir, "skill.md"), redact(readFileSync(SKILL, "utf8"), items.map((i) => i.number)));
    writeFileSync(join(dir, "labels.template.json"),
      `${JSON.stringify(blinded.map((b) => ({ id: b.id, isFeature: null, why: "" })), null, 2)}\n`);
    writeFileSync(join(dir, "key.json"), `${JSON.stringify(key, null, 2)}\n`);
    console.log(`packed ${blinded.length} item(s) into ${dir} — hand the annotator items.json, skill.md and labels.template.json ONLY`);
  } else if (cmd === "agree" && dir && labelsPath) {
    const key = JSON.parse(readFileSync(join(dir, "key.json"), "utf8")) as Record<string, number>;
    const second = JSON.parse(readFileSync(labelsPath, "utf8")) as SecondLabel[];
    const byNumber = new Map(items.map((i) => [i.number, i]));
    const pairs: [boolean, boolean][] = [];
    const disagreements: string[] = [];
    for (const s of second) {
      const first = byNumber.get(key[s.id]!);
      if (!first || typeof s.isFeature !== "boolean") continue;
      pairs.push([first.isFeature, s.isFeature]);
      if (first.isFeature !== s.isFeature) {
        disagreements.push(`#${first.number} ${first.title}\n    first:  ${first.isFeature} — ${first.why}\n    second: ${s.isFeature} — ${s.why}`);
      }
    }
    const raw = pairs.filter(([a, b]) => a === b).length;
    console.log(`${pairs.length} labelled by both — raw agreement ${raw}/${pairs.length}, Cohen's kappa ${kappa(pairs).toFixed(2)}`);
    for (const d of disagreements) console.log(`  ✗ ${d}`);
    if (pairs.length !== items.length) console.log(`  ! ${items.length - pairs.length} item(s) not labelled by the second annotator`);
  } else {
    console.error("usage: pack <out-dir> | agree <out-dir> <labels.json>");
    process.exit(1);
  }
}
