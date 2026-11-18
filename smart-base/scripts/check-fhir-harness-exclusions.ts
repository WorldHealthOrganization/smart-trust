#!/usr/bin/env bun
/**
 * check-fhir-harness-exclusions.ts — `fhir-harness` knows nothing about WHO.
 *
 * Bean `wm63`: *"'Generic' is a claim; a list is checkable."* `ig-build-pipeline`
 * states what the bare FHIR IG layer refuses to know about — `dak.config.json`,
 * `smart.who.int` canonicals, the DAK API surface, the DAK pre/post steps, the
 * `authoring-who-smart-guidelines` package. A breach of that list fails nothing
 * by itself: the build stays green and the layer quietly stops being usable for
 * the non-WHO IG it exists for. This makes the list a gate.
 *
 * ## Why it lives HERE, in smart-base, and not in fhir-harness
 *
 * The list names WHO things. A copy of it inside `fhir-harness` would be the
 * first entry on it — the code-shaped form of `audit-coverage`'s *"a docblock
 * that documents a tag necessarily contains the tag"*. `smart-base` OWNS those
 * names and `needs` `fhir-harness`, so the arrow from here to there points the
 * way references are allowed to point. It also lets the DAK step names be read
 * from smart-base's own `dak-preprocessing` / `dak-postprocessing` tables
 * rather than restated: a step added to either table is excluded without an
 * edit here.
 *
 * ## A MENTION is not a DEPENDENCY
 *
 * A comment, a docblock, a markdown page or a JSON `_comment`/`description`
 * that names an excluded thing is counted and printed, never graded — the
 * layer has to be able to say what it refuses. What is graded is everything
 * else: code (with string literals KEPT, because `\`schemas/${stem}.displays.json\``
 * is a dependency however it is spelled), JSON values, BPMN outside
 * `<documentation>` and XML comments.
 *
 * ## Ratchet, with a committed baseline
 *
 * On 2026-10-03 the layer was NOT clean — the hits are in
 * {@link ./fhir-harness-exclusions.baseline.ts}, each with its reason. Owner
 * ruling the same day: gate now, baseline the existing hits, clear them in a
 * second stream. So:
 *
 * - a graded hit above its baseline count (or with no entry) — **fails**;
 * - a graded count BELOW its baseline — **fails too**, as a stale baseline.
 *   Otherwise a cleared hit leaves head-room a later regression walks into
 *   unseen. `--shrink` lowers counts and drops cleared entries; it never
 *   raises one, so a regression cannot be blessed with it.
 *
 * Scope: every git-tracked file under `fhir-harness/` except `library/`
 * (quoted L1 sources, whose bytes are the source's) and `test/results/`
 * (machine-written verdicts about the files that ARE scanned).
 *
 * ```sh
 * bun run cat check:fhir-harness-exclusions            # report + gate
 * bun run cat check:fhir-harness-exclusions --shrink   # lower the baseline after a fix
 * ```
 *
 * Tested with planted violations in `check-fhir-harness-exclusions.test.ts`.
 *
 * @module smart-base/scripts/check-fhir-harness-exclusions
 * @covers code
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import { mountScopeFor } from "../../cat-harness-tools/schemas/kg/remote-mount.ts";
import { exitNotApplicable } from "../../cat-harness-tools/scripts/lib/not-applicable.ts";

import { BASELINE, type BaselineEntry } from "./fhir-harness-exclusions.baseline.ts";

export const LAYER = "fhir-harness";

/**
 * Post-processing steps 1–5 sit in smart-base's table but came DOWN into
 * fhir-harness (`ig-build-pipeline` §"Five steps that came DOWN"), so they are
 * the part of that table the layer may name. The two Library strippers came
 * down first. The three schema/vocabulary transforms followed on the owner's
 * ruling of 2026-10-03: *"it is only transforming existing (meta)data, not
 * adding any new constraints or profiles … it is generic."*
 */
export const MOVED_DOWN = new Set([
  "strip_library_binaries.py",
  "strip_library_content.py",
  "generate_logical_model_schemas.py",
  "generate_valueset_schemas.py",
  "generate_jsonld_vocabularies.py",
]);

export interface Rule {
  id: string;
  /** What `ig-build-pipeline`'s refusal list calls it. */
  refuses: string;
  pattern: RegExp;
}

const STEP_TABLES = [
  "smart-base/L3/skills/smart-l3/dak-preprocessing.md",
  "smart-base/L3/skills/smart-l3/dak-postprocessing.md",
];

/** Script names from the step tables (`| n | \`x.py\` ...`), minus {@link MOVED_DOWN}. */
export function dakStepNames(root: string): string[] {
  const names = new Set<string>();
  for (const rel of STEP_TABLES) {
    const text = readFileSync(join(root, rel), "utf-8");
    for (const row of text.matchAll(/^\|\s*\d+\s*\|([^|]*)\|/gm)) {
      for (const m of row[1]!.matchAll(/`([\w.-]+\.py)`/g)) if (!MOVED_DOWN.has(m[1]!)) names.add(m[1]!);
    }
  }
  if (names.size === 0) throw new Error(`no DAK step names read from ${STEP_TABLES.join(", ")} — the table shape changed`);
  return [...names].sort();
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** DAK labels and names: `dak-api(.html)`, "DAK API", `dak-views`/`dakViews`, "DAK view(s)". */
export const DAK_NAMING = /\bdak-api(?:\.html)?\b|\bDAK[ -]API\b|\bdak[-_]?views?\b|\bdakViews?\b|\bDAK views?\b/g;

export function rules(root: string): Rule[] {
  return [
    {
      id: "dak-config",
      refuses: "the DAK declaration: index.config.json contentTypes.dak, or the legacy dak.config.json / dak.json",
      // contentTypes.dak, contentTypes["dak"], contentTypes?.dak and dak_index(.py), since 2026-10-24 (bean cz17).
      pattern: /\bdak(?:\.config)?\.json\b|\bcontentTypes\??\.dak\b|\bcontentTypes\[\s*["']dak["']\s*\]|\bdak_index\b/gi,
    },
    { id: "who-canonical", refuses: "smart.who.int canonicals", pattern: /\bsmart\.who\.int\b/gi },
    {
      id: "dak-naming",
      refuses: "DAK labels and names (the IG API itself is the generic FHIR IG API)",
      // Owner, 2026-10-03: the per-artefact `.schema.json` / `.displays.json` /
      // `.openapi.json` sidecars and their hub "should be FHIR-IG-API, no DAK
      // label/names". So the API SURFACE belongs here; only its DAK naming does
      // not. A file NAME counts too — see {@link pathHits}.
      pattern: DAK_NAMING,
    },
    { id: "dak-step", refuses: "the DAK pre/post-processing steps", pattern: new RegExp(dakStepNames(root).map(esc).join("|"), "g") },
    { id: "who-package", refuses: "the authoring-who-smart-guidelines package", pattern: /\bauthoring-who-smart-guidelines\b/g },
    { id: "who-layer-path", refuses: "a path into the WHO layer", pattern: /(?:^|[^\w-])smart-base\//g },
  ];
}

/**
 * Code with comments blanked and string literals KEPT — unlike bootstrap-tools'
 * `stripComments`, which blanks strings too because it is after specifiers.
 * `hashLines` adds `#` line comments for Python/shell/YAML.
 */
/**
 * Whether a `/` at this point opens a regex literal rather than dividing: the
 * standard heuristic, from the last significant character already emitted.
 */
function regexCanStart(before: string): boolean {
  const t = before.trimEnd();
  if (t === "") return true;
  if (/[(,=:[!&|?{};+\-*%<>~^]$/.test(t)) return true;
  return /\b(return|typeof|case|in|of|delete|void|throw|new|yield|await)$/.test(t);
}

export function codeOf(src: string, hashLines = false): string {
  let out = "";
  let i = 0;
  const blank = (t: string) => t.replace(/[^\n]/g, " ");
  while (i < src.length) {
    const c = src[i]!;
    const n = src[i + 1];
    const lineComment = (!hashLines && c === "/" && n === "/") || (hashLines && c === "#");
    if (!hashLines && c === "/" && n === "*") {
      const end = src.indexOf("*/", i + 2);
      const stop = end < 0 ? src.length : end + 2;
      out += blank(src.slice(i, stop));
      i = stop;
    } else if (lineComment) {
      const end = src.indexOf("\n", i);
      const stop = end < 0 ? src.length : end;
      out += blank(src.slice(i, stop));
      i = stop;
    } else if (!hashLines && c === "/" && regexCanStart(out)) {
      // A regex literal is code, but its quotes are not string delimiters:
      // `/href="([^"]+)"/g` has three, and reading the first as an opening
      // quote flipped code and prose for the rest of the file (bean izx8).
      let j = i + 1;
      let inClass = false;
      while (j < src.length && src[j] !== "\n" && (inClass || src[j] !== "/")) {
        if (src[j] === "\\") j++;
        else if (src[j] === "[") inClass = true;
        else if (src[j] === "]") inClass = false;
        j++;
      }
      out += src.slice(i, Math.min(j + 1, src.length));
      i = j + 1;
    } else if (c === '"' || c === "'" || c === "`") {
      let j = i + 1;
      while (j < src.length && src[j] !== c) j += src[j] === "\\" ? 2 : 1;
      out += src.slice(i, Math.min(j + 1, src.length));
      i = j + 1;
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

/** BPMN/XML with comments and `<…documentation>` bodies blanked. */
export function xmlCodeOf(src: string): string {
  const blank = (t: string) => t.replace(/[^\n]/g, " ");
  return src.replace(/<!--[\s\S]*?-->/g, blank).replace(/<([\w-]+:)?documentation\b[\s\S]*?<\/([\w-]+:)?documentation>/g, blank);
}

const PROSE_KEYS = /^_|_comment$|^(description|title|summary)$/;

/** JSON string values that are not prose, one per line. */
export function jsonCodeOf(src: string): string {
  const out: string[] = [];
  const walk = (v: unknown, key: string) => {
    if (typeof v === "string") {
      if (!PROSE_KEYS.test(key)) out.push(v);
    } else if (Array.isArray(v)) v.forEach((x) => walk(x, key));
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) walk(x, k);
  };
  walk(JSON.parse(src), "");
  return out.join("\n");
}

export type Kind = "code" | "prose";

/** The graded text of a file, or `undefined` when the whole file is prose. */
export function gradedText(path: string, src: string): string | undefined {
  if (/\.(md|txt)$/i.test(path)) return undefined;
  if (/\.(ts|tsx|js|mjs|cjs)$/.test(path)) return codeOf(src);
  if (/\.(py|sh|ya?ml|toml)$/.test(path)) return codeOf(src, true);
  if (/\.(bpmn|dmn|xml|svg|html)$/.test(path)) return xmlCodeOf(src);
  if (/\.json$/.test(path)) {
    try {
      return jsonCodeOf(src);
    } catch {
      return src;
    }
  }
  return src;
}

export interface Hit {
  file: string;
  rule: string;
  count: number;
}

const count = (re: RegExp, s: string) => (s.match(new RegExp(re.source, re.flags)) ?? []).length;

/** Graded hits and the prose-mention total for a set of `{path, text}` files. */
export function scan(files: readonly { path: string; text: string }[], rs: readonly Rule[]): { graded: Hit[]; mentions: number } {
  const graded: Hit[] = [];
  let mentions = 0;
  for (const { path, text } of files) {
    const code = gradedText(path, text);
    for (const r of rs) {
      const all = count(r.pattern, text);
      const g = code === undefined ? 0 : count(r.pattern, code);
      mentions += all - g;
      if (g > 0) graded.push({ file: path, rule: r.id, count: g });
    }
  }
  return { graded, mentions };
}

/**
 * A tracked file whose PATH carries a DAK name is one `dak-naming` hit: the
 * owner's ruling is "no DAK label/names", and `templates/ig-pages/dak-api.liquid`
 * is a name whatever its contents say.
 */
export function pathHits(paths: readonly string[]): Hit[] {
  return paths
    .filter((p) => p.split("/").some((seg) => /^dak[-_.]|[-_]dak[-_.]|^dak$/i.test(seg)))
    .map((file) => ({ file: `${file}#path`, rule: "dak-naming", count: 1 }));
}

export interface Verdict {
  regressions: (Hit & { allowed: number })[];
  stale: (BaselineEntry & { now: number })[];
}

export function judge(graded: readonly Hit[], baseline: readonly BaselineEntry[]): Verdict {
  const key = (f: string, r: string) => `${f}\u0000${r}`;
  const base = new Map(baseline.map((b) => [key(b.file, b.rule), b]));
  const now = new Map(graded.map((h) => [key(h.file, h.rule), h.count]));
  const regressions = graded
    .map((h) => ({ ...h, allowed: base.get(key(h.file, h.rule))?.count ?? 0 }))
    .filter((h) => h.count > h.allowed);
  const stale = baseline.map((b) => ({ ...b, now: now.get(key(b.file, b.rule)) ?? 0 })).filter((b) => b.now < b.count);
  return { regressions, stale };
}

/**
 * The layer's files. Since the cutover (#2474) `fhir-harness/` is a REMOTE
 * MOUNT, which git does not track here, so `ls-files` returned nothing and the
 * gate passed over zero files while reporting its baseline stale. A mounted
 * layer is read from disk instead: the replay verified it against the lock's
 * tree digest, so the files on disk are exactly the pinned tree.
 */
export function layerFiles(root: string): string[] {
  const dir = join(root, LAYER);
  const all =
    mountScopeFor(dir) !== undefined
      ? walk(dir).map((f) => relative(root, f).split("\\").join("/"))
      : execFileSync("git", ["ls-files", "-z", "--", `${LAYER}/`], { cwd: root, encoding: "utf-8" }).split("\0");
  return all
    .filter((f) => f && !f.startsWith(`${LAYER}/library/`) && !f.startsWith(`${LAYER}/test/results/`))
    .filter((f) => !/\.(png|jpe?g|gif|webp|ico|pdf|tgz|zip|woff2?)$/i.test(f));
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === ".git" || e.name === "node_modules") continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (e.isFile()) out.push(p);
  }
  return out;
}

function writeShrunk(path: string, baseline: readonly BaselineEntry[], graded: readonly Hit[]): number {
  const now = new Map(graded.map((h) => [`${h.file}\u0000${h.rule}`, h.count]));
  const kept = baseline
    .map((b) => ({ ...b, count: Math.min(b.count, now.get(`${b.file}\u0000${b.rule}`) ?? 0) }))
    .filter((b) => b.count > 0);
  const src = readFileSync(path, "utf-8");
  const head = src.slice(0, src.indexOf("export const BASELINE"));
  writeFileSync(path, `${head}export const BASELINE: readonly BaselineEntry[] = ${JSON.stringify(kept, null, 2)};\n`);
  return baseline.length - kept.length;
}

if (import.meta.main) {
  const root = resolve(import.meta.dir, "..", "..");
  // The DAK step names are read from L3's tables, and L3 is an opt-in group
  // (`smart-base.smart-base-L3`): a downstream that switched on only L1 has no
  // L3/ on disk. That root cannot judge this list, so it says so (exit 78)
  // rather than crash on the missing file or pass over nothing.
  const missing = STEP_TABLES.filter((rel) => !existsSync(join(root, rel)));
  if (missing.length > 0) {
    exitNotApplicable(
      "check:fhir-harness-exclusions",
      `the DAK step tables are not mounted (${missing.join(", ")}): switch on smart-base.smart-base-L3 to run this check`,
    );
  }
  const rs = rules(root);
  const files = layerFiles(root).map((path) => ({ path, text: readFileSync(join(root, path), "utf-8") }));
  // A scan over nothing is not a clean scan: an absent or unmounted layer
  // could not be judged, and `--shrink` over it would empty the baseline.
  if (files.length === 0) {
    console.error(`fhir-harness exclusions: could not determine — no files under ${LAYER}/ (not tracked, not mounted). Run \`bun run cat mount:lock\`.`);
    process.exit(2);
  }
  const text = scan(files, rs);
  const graded = [...text.graded, ...pathHits(files.map((f) => f.path))];
  const mentions = text.mentions;
  const { regressions, stale } = judge(graded, BASELINE);

  console.log(`fhir-harness exclusions — ${files.length} files, ${rs.length} rules`);
  console.log(`  graded hits: ${graded.reduce((a, h) => a + h.count, 0)} in ${graded.length} file×rule pairs (baseline ${BASELINE.length})`);
  console.log(`  prose mentions (reported, not graded): ${mentions}`);

  if (process.argv.includes("--shrink")) {
    if (regressions.length > 0) console.log("  --shrink never raises a count; regressions below still fail.");
    const dropped = writeShrunk(join(import.meta.dir, "fhir-harness-exclusions.baseline.ts"), BASELINE, graded);
    console.log(`  baseline shrunk: ${stale.length} entr(ies) lowered, ${dropped} dropped`);
  } else {
    for (const s of stale) console.log(`  STALE BASELINE  ${s.file} [${s.rule}] ${s.count} → ${s.now} — run with --shrink`);
  }
  for (const r of regressions) {
    const rule = rs.find((x) => x.id === r.rule)!;
    console.log(`  NEW  ${r.file} [${r.rule}: ${rule.refuses}] ${r.count} (allowed ${r.allowed})`);
  }
  const failed = regressions.length > 0 || (!process.argv.includes("--shrink") && stale.length > 0);
  if (failed) {
    console.log("\nfhir-harness must stay WHO-free (ig-build-pipeline §\"What this layer refuses to know about\").");
    console.log("Move the WHO-specific part into smart-base as an overlay, or pass it in from there as a parameter.");
  } else console.log("  ✓ no hit above baseline, and the baseline is tight");
  process.exit(failed ? 1 : 0);
}
