/**
 * l1-transcription-verbatim — check authored L1 against the library entry it was read from,
 * when the entry has no usable text layer for `l1-recommendation-candidates` to check against.
 *
 * Some L1 sources print their recommendations only as pictures (a schedule poster, a slide
 * deck): `l1-recommendation-candidates` finds no normative sentence, so the L1 is authored
 * (`*.l1.yaml`, the measles pattern) from inspected transcriptions. This is the check those
 * authored files get instead (`recommendation-extraction`, *Declare every output directory*'s
 * sibling rule: a statement is verbatim or it is not L1). Written 2026-10-15 for the Uganda
 * adaptation, after the search `smart-base-tools` §*Adapting a DAK* asks for found none:
 * litlfred/test `tools/build_l1.py` checks text-layer pages of one measles paper only.
 *
 * For each `*.l1.yaml` in `--dir`:
 *   - a statement with `image: <id>` must be a verbatim substring of that image's narrative in
 *     the entry's `images.json` (the inspection transcription);
 *   - a statement with `from: <key>` must be a verbatim substring of that `transcription` block,
 *     and every word of every transcription block (digits aside) must occur in the entry's text
 *     layer (`sections/*.md`) after NFKC normalisation, unless the block lists it under
 *     `inspectionOnly.words` with its basis;
 *   - keys are unique.
 * The entry is `graph.source.entry`, relative to `--root` (default: the working directory).
 *
 * Usage: bun run smart-base/L1/scripts/l1-transcription-verbatim.ts --dir <dir of *.l1.yaml> [--root <repo>]
 * Exit 0 when everything holds; 1 with one FINDING line each otherwise; 2 when --dir holds no file.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";

import { narrativeFor } from "../../../cat-harness-tools/schemas/content/narrative.js";

export function norm(s: string): string {
  let t = s.normalize("NFKC");
  t = [...t].filter((c) => {
    const p = c.codePointAt(0) ?? 0;
    return !((p >= 0xe000 && p <= 0xf8ff) || (p >= 0x20d0 && p <= 0x20ff));
  }).join("");
  return t.replace(/\s+/g, " ").trim();
}

export function words(s: string): string[] {
  return (norm(s).match(/[A-Za-z][A-Za-z'-]*/g) ?? []).map((w) => w.toLowerCase());
}

type Statement = { key: string; statement?: string; definition?: string; image?: string; from?: string };
type Block = { key: string; text: string; inspectionOnly?: { words?: string[] } };
type L1Doc = {
  graph: { source: { entry: string } };
  transcription?: Block[];
  recommendations?: Statement[];
  indicators?: Statement[];
};

export function checkFile(file: string, root: string): { findings: string[]; summary: string } {
  const name = file.split("/").pop() ?? file;
  const doc = parseYaml(readFileSync(file, "utf-8")) as L1Doc;
  const entry = join(root, doc.graph.source.entry);
  const findings: string[] = [];
  const narratives = new Map<string, string>();
  const imagesJson = join(entry, "images.json");
  if (existsSync(imagesJson)) {
    for (const img of JSON.parse(readFileSync(imagesJson, "utf-8")).images ?? []) {
      // A narrative slot is one narrative or a list of them (cat-harness#396);
      // `narrativeFor` reads either, and with no locale asked, the first.
      narratives.set(img.id, norm(img.narrative ? narrativeFor(img.narrative).text : ""));
    }
  }
  const sectionsDir = join(entry, "sections");
  const layerText = existsSync(sectionsDir)
    ? readdirSync(sectionsDir).filter((f) => f.endsWith(".md")).map((f) => readFileSync(join(sectionsDir, f), "utf-8")).join(" ")
    : "";
  const layerWords = new Set(words(layerText));
  const blocks = new Map<string, string>();
  for (const b of doc.transcription ?? []) {
    blocks.set(b.key, norm(b.text));
    const allowed = new Set(b.inspectionOnly?.words ?? []);
    const missing = [...new Set(words(b.text))].filter((w) => !layerWords.has(w) && !allowed.has(w)).sort();
    if (missing.length > 0) findings.push(`${name} ${b.key}: words not in the text layer: ${missing.join(", ")}`);
  }
  const items: [string, Statement][] = [
    ...(doc.recommendations ?? []).map((r): [string, Statement] => ["recommendation", r]),
    ...(doc.indicators ?? []).map((r): [string, Statement] => ["indicator", r]),
  ];
  const seen = new Set<string>();
  for (const [kind, r] of items) {
    if (seen.has(r.key)) findings.push(`${name} ${r.key}: duplicate key`);
    seen.add(r.key);
    const text = norm(r.statement ?? r.definition ?? "");
    let hay: string | undefined;
    let where: string;
    if (r.image !== undefined) {
      hay = narratives.get(r.image);
      where = `narrative of ${r.image}`;
    } else if (r.from !== undefined) {
      hay = blocks.get(r.from);
      where = `transcription ${r.from}`;
    } else {
      findings.push(`${name} ${r.key}: names neither an image nor a transcription block`);
      continue;
    }
    if (hay === undefined) findings.push(`${name} ${r.key}: ${where} does not exist`);
    else if (!hay.includes(text)) findings.push(`${name} ${r.key}: ${kind} is not verbatim in the ${where}`);
  }
  return { findings, summary: `${name}: ${items.length} statement(s), ${blocks.size} transcription block(s)` };
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

if (import.meta.main) {
  const dir = arg("dir");
  if (!dir) {
    console.error("usage: l1-transcription-verbatim.ts --dir <dir of *.l1.yaml> [--root <repo>]");
    process.exit(2);
  }
  const root = resolve(arg("root") ?? ".");
  const files = readdirSync(resolve(root, dir)).filter((f) => f.endsWith(".l1.yaml")).sort().map((f) => join(resolve(root, dir), f));
  if (files.length === 0) {
    console.error(`no *.l1.yaml in ${dir}: nothing was checked, which is not a pass`);
    process.exit(2);
  }
  const all: string[] = [];
  for (const f of files) {
    const r = checkFile(f, root);
    console.log(r.summary);
    all.push(...r.findings);
  }
  for (const line of all) console.log(`FINDING ${line}`);
  process.exit(all.length > 0 ? 1 : 0);
}
