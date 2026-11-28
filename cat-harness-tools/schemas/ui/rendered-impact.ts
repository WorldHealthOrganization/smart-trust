/**
 * What a change does to a RENDERED site: the contract every renderer answers.
 * A Change Set's PR is reviewed against this list.
 *
 * ## The contract
 *
 * A renderer takes the input files a change touched and returns a
 * `rendered-impact/v1`: every rendered file the change alters, each with the
 * chain that reached it (`via`) and a `role`, plus every input it could NOT
 * place. Two methods produce one:
 *
 * - `cone`: predicted from the renderer's dependency cone, BEFORE a build.
 *   What a reviewer is shown while the build runs, and what an incremental
 *   build re-renders.
 * - `build-diff`: measured by comparing two built sites (`diffBuiltSites`).
 *   The check on a prediction: a file in the build diff that the cone did not
 *   name is a cone defect, and is reported as one (`comparePrediction`).
 *
 * ## Three rules
 *
 * 1. **Could-not-determine is never "no change".** An input the renderer cannot
 *    place goes in `undetermined` with its reason; an empty `files` with a
 *    non-empty `undetermined` means "not known", and a consumer must say so.
 * 2. **Index files are listed, and marked, not dropped.** A list for review
 *    filters on `role !== "index"`; a page that is an index for one renderer
 *    is content for another, so the renderer marks the role and the reader
 *    filters.
 * 3. **A page whose BYTES do not change can still change.** An AST artefact
 *    page loads its resource in the browser, so a changed resource changes
 *    what the page shows while its HTML stays identical. The cone names the
 *    page (`role: "content"`) AND the data file (`role: "data"`); a build diff
 *    sees only the data file. `comparePrediction` therefore never counts a
 *    predicted content page that is missing from the build diff as a defect.
 *
 * ## A PIN: what a review of a rendered file is a review OF
 *
 * The coverage gate counts a page as reviewed only against the version a
 * reviewer saw, as a block verdict is pinned to the block's hash. A page's
 * built bytes are no pin: a staging build injects a banner naming the commit,
 * so every page would reopen on every push. So `hash` pins a predicted file
 * to the git blobs of the changed inputs on its `via` ({@link pinImpact}),
 * and an undetermined input to its own blob. An edit after review moves the
 * pin of exactly the files and inputs it touched. A build diff pins a file to
 * its content hash, taken before the banner is added.
 *
 * @graphNode schema
 * @module cat-harness/schemas/rendered-impact
 */
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { z } from "zod";

export const RENDERED_IMPACT_TAG = "rendered-impact/v1" as const;

/** What a rendered file is FOR, so a review list can filter without knowing the renderer. */
export const RENDERED_ROLES = ["content", "data", "index"] as const;
export type RenderedRole = (typeof RENDERED_ROLES)[number];

export const RenderedFileSchema = z.object({
  /** Path in the BUILT site, relative to its root, e.g. `ast/artifact/PlanDefinition-X.html`. */
  path: z.string().min(1),
  change: z.enum(["changed", "added", "removed"]),
  role: z.enum(RENDERED_ROLES),
  /**
   * How the change reached this file: the changed input first, then each
   * node the cone went through, e.g. `["input/fsh/x.fsh", "IMMZD18SBCG",
   * "PlanDefinition/IMMZD18SBCG"]`. Empty for a build diff, which measures
   * that a file changed and cannot say why.
   */
  via: z.array(z.string()).default([]),
  /**
   * The fragment ids within `path` the change alters, for a page that
   * assembles many units (a document page with an anchor per block). A review
   * list links `path#anchor` for each. Absent when the whole file is the unit,
   * or when a build diff cannot say which part changed.
   */
  anchors: z.array(z.string().min(1)).optional(),
  /**
   * What a review of this file is pinned to (see "A PIN"): for a `cone` file,
   * a hash of the blobs of the changed inputs on `via`; for a `build-diff`
   * file, its content hash. Absent when nothing pinned it.
   */
  hash: z.string().min(1).optional(),
});
export type RenderedFile = z.infer<typeof RenderedFileSchema>;

export const UndeterminedSchema = z.object({
  input: z.string().min(1),
  reason: z.string().min(1),
  /** `all`: the input can re-render anything (a site config, a shared include). */
  scope: z.enum(["unknown", "all"]).default("unknown"),
  /** The input's blob at head, so a waiver of it is pinned to this version. */
  hash: z.string().min(1).optional(),
});

export const RenderedImpactSchema = z.object({
  $schema: z.literal(RENDERED_IMPACT_TAG),
  /** The renderer, by its Tool id or script, e.g. `fhir-ig-ast-pages`. */
  renderer: z.string().min(1),
  method: z.enum(["cone", "build-diff"]),
  /** The site the paths are relative to, as a reader finds it (a layer, a URL path). */
  site: z.string().optional(),
  base: z.string().optional(),
  head: z.string().optional(),
  /** The changed input files the renderer was given, relative to its source root. */
  inputs: z.array(z.string()).default([]),
  files: z.array(RenderedFileSchema),
  undetermined: z.array(UndeterminedSchema).default([]),
});
export type RenderedImpact = z.infer<typeof RenderedImpactSchema>;

/**
 * Pin every file and undetermined input of a prediction (see "A PIN").
 * `blob(input)` returns the input's blob id at head, or undefined when it is
 * absent there (a removed input pins as `absent`). Pure: the caller supplies
 * the lookup, so a renderer's CLI pins with git and a test with a table.
 */
export function pinImpact(impact: RenderedImpact, blob: (input: string) => string | undefined): RenderedImpact {
  const inputs = new Set(impact.inputs);
  const pinOf = (paths: string[]) =>
    createHash("sha256")
      .update(paths.sort().map((p) => `${p}\0${blob(p) ?? "absent"}`).join("\n"))
      .digest("hex");
  return {
    ...impact,
    files: impact.files.map((f) => {
      const on = [...new Set(f.via.filter((v) => inputs.has(v)))];
      return on.length ? { ...f, hash: pinOf(on) } : f;
    }),
    undetermined: impact.undetermined.map((u) => ({ ...u, hash: pinOf([u.input]) })),
  };
}

/** The files a reviewer should open: everything but indexes, in path order. */
export function reviewList(impact: RenderedImpact): RenderedFile[] {
  return impact.files.filter((f) => f.role !== "index").sort((a, b) => a.path.localeCompare(b.path));
}

/**
 * Files a static-site build writes for search and navigation rather than for
 * a reader: the default `isIndex` for a build diff, which cannot ask the
 * renderer. Matched on the path's tail, so a site under a baseurl matches too.
 */
const GENERIC_INDEX = [/(^|\/)assets\/js\/search-data\.json$/, /(^|\/)sitemap\.xml$/, /(^|\/)feed\.xml$/, /(^|\/)robots\.txt$/, /\.map$/];
export const isGenericIndex = (path: string): boolean => GENERIC_INDEX.some((re) => re.test(path));

/**
 * Build stamps: bytes a build writes that change on EVERY build and say
 * nothing about content. Two builds of one commit differ in them, so a diff
 * that keeps them reports every page as changed, and the prediction check then
 * calls every page "missed" (measured on this repository's docs site,
 * 2026-10-06: 826 of its files differed between two builds of one commit,
 * every one by a `?v=<build time>` cache-buster). They are blanked before
 * hashing, in text files only.
 */
export const BUILD_STAMPS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\?v=\d{9,}/g, "?v="],
  [/"generatedAt(?:Time)?":\s*"[^"]*"/g, '"generatedAt":""'],
  // Whether the checkout had uncommitted changes when it was built: a fact
  // about the machine, never about a page (a local build of an edit is dirty).
  [/"sourceTreeDirty":\s*(?:true|false)/g, '"sourceTreeDirty":null'],
];
const TEXTUAL = /\.(html?|css|js|json|jsonld|xml|txt|svg|md)$/i;

function contentHash(path: string): string {
  const bytes = readFileSync(path);
  if (!TEXTUAL.test(path)) return createHash("sha256").update(bytes).digest("hex");
  let text = bytes.toString("utf-8");
  for (const [re, blank] of BUILD_STAMPS) text = text.replace(re, blank);
  return createHash("sha256").update(text).digest("hex");
}

function walk(root: string): Map<string, string> {
  const out = new Map<string, string>();
  if (!existsSync(root)) return out;
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop()!;
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) stack.push(p);
      else out.set(relative(root, p), contentHash(p));
    }
  }
  return out;
}

/**
 * The measured half: every file that differs between two built sites, by
 * content hash. `isIndex` decides the role of each (default `isGenericIndex`);
 * anything else is `content` for `.html` and `data` otherwise.
 */
export function diffBuiltSites(
  before: string,
  after: string,
  opts: {
    renderer: string;
    site?: string;
    base?: string;
    head?: string;
    isIndex?: (path: string) => boolean;
    /** Only paths this keeps are compared, on both sides (a shared publish root holds other sites too). */
    keep?: (path: string) => boolean;
  } = { renderer: "build-diff" },
): RenderedImpact {
  const kept = (m: Map<string, string>) => (opts.keep ? new Map([...m].filter(([p]) => opts.keep!(p))) : m);
  const a = kept(walk(before));
  const b = kept(walk(after));
  const isIndex = opts.isIndex ?? isGenericIndex;
  const role = (p: string): RenderedRole => (isIndex(p) ? "index" : p.endsWith(".html") ? "content" : "data");
  const files: RenderedFile[] = [];
  for (const [p, h] of b) {
    const old = a.get(p);
    if (old === undefined) files.push({ path: p, change: "added", role: role(p), via: [], hash: h });
    else if (old !== h) files.push({ path: p, change: "changed", role: role(p), via: [], hash: h });
  }
  for (const p of a.keys()) if (!b.has(p)) files.push({ path: p, change: "removed", role: role(p), via: [] });
  files.sort((x, y) => x.path.localeCompare(y.path));
  return RenderedImpactSchema.parse({
    $schema: RENDERED_IMPACT_TAG,
    renderer: opts.renderer,
    method: "build-diff",
    ...(opts.site ? { site: opts.site } : {}),
    ...(opts.base ? { base: opts.base } : {}),
    ...(opts.head ? { head: opts.head } : {}),
    files,
  });
}

export interface PredictionCheck {
  /** Measured to change but not predicted: a cone defect, never a pass. */
  missed: string[];
  /** Predicted and measured. */
  confirmed: string[];
  /** Predicted, not measured: expected for content pages that load their data (rule 3), suspicious otherwise. */
  unconfirmed: { path: string; role: RenderedRole }[];
}

/** Check a `cone` prediction against a `build-diff` measurement. Index files are compared too. */
export function comparePrediction(predicted: RenderedImpact, measured: RenderedImpact): PredictionCheck {
  const want = new Map(predicted.files.map((f) => [f.path, f]));
  const got = new Set(measured.files.map((f) => f.path));
  return {
    missed: [...got].filter((p) => !want.has(p)).sort(),
    confirmed: [...got].filter((p) => want.has(p)).sort(),
    unconfirmed: [...want.values()].filter((f) => !got.has(f.path)).map((f) => ({ path: f.path, role: f.role })).sort((a, b) => a.path.localeCompare(b.path)),
  };
}

export const RENDERED_MEASURED_TAG = "rendered-measured/v1" as const;

/**
 * A staging build's measurement of a prediction: the build diff against the
 * published before side, and what the prediction missed. `status` says
 * whether the before side was built from the PR's BASE: when it was not
 * (`not-base`, main moved after it was published), the diff also holds
 * main's own changes, so `check.missed` is not a cone defect and the
 * coverage gate does not count it. No measurement at all is no file.
 */
export const RenderedMeasuredSchema = z.object({
  $schema: z.literal(RENDERED_MEASURED_TAG),
  status: z.enum(["known", "not-base"]),
  /** The commit the PR's change is measured against. */
  baseCommit: z.string().min(1),
  /** The commit the before side was built from, as its publish manifest records it. */
  beforeCommit: z.string().nullable(),
  measured: RenderedImpactSchema,
  check: z.object({
    missed: z.array(z.string()),
    confirmed: z.array(z.string()),
    unconfirmed: z.array(z.object({ path: z.string(), role: z.enum(RENDERED_ROLES) })),
  }),
});
export type RenderedMeasured = z.infer<typeof RenderedMeasuredSchema>;

/** Measured files the prediction missed, with their roles and content pins: what a reviewer still owes. */
export function missedFiles(m: RenderedMeasured): RenderedFile[] {
  const missed = new Set(m.check.missed);
  return m.measured.files.filter((f) => missed.has(f.path));
}
