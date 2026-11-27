/**
 * QA axes — what part of an instance a QA record is ABOUT, and one shared
 * vocabulary for its counts.
 *
 * Owner, 2026-11-24: *"build integrated page into platform"* — ONE QA page per
 * harness instance, integrating rendering, Lean, compute, the knowledge graph,
 * translations, block QA and the rest, drawn by the platform for every harness
 * rather than copied into each. Until then each QA file FORMAT had its own card
 * or page (`kg-qa/v1` on the per-layer page, block QA beside the folio site,
 * the FHIR IG's `qa.html`, a paper's `render-qa.json` read by nothing), and the
 * formats spelt their counts differently (`totals` against `counts`, `n/a`
 * against `na`). An **axis** is the grouping a reader asks about ("is the
 * Lean clean?"); a format is how one writer happens to record it.
 *
 * Three things live here, and nothing else should restate them:
 *
 * 1. {@link QA_AXES} — the closed list of axes, in page order.
 * 2. {@link QaCounts} and {@link normalizeCounts} — `pass / fail / warn /
 *    unknown / na`. `unknown` is never shown as zero, and a record whose counts
 *    cannot be read is `undefined`, not `{}`.
 * 3. {@link summarizeQaDoc} / {@link axisOf} — the axis and counts of one
 *    record, read from its `$schema` first and its path second.
 *
 * A layer DECLARES its writers and the axes it answers for in its own
 * `<instance>.json` (`qa`, {@link QaDeclarationSchema}); the reusable publish
 * workflow runs the declared writers and the page draws one section per axis.
 *
 * Pure: no filesystem, no network. The page script receives
 * {@link QA_FORMAT_RULES} as data, so the browser classifies exactly as the
 * publisher does without a second copy of the rules.
 *
 * @module schemas/sdlc/qa-axis
 */

import { z } from "zod";

/** The axes, in the order the page draws them. */
export const QA_AXES = [
  "rendering",
  "lean",
  "compute",
  "kg",
  "translations",
  "block-qa",
  "bibliography",
  "site-build",
  "domain",
] as const;
export type QaAxis = (typeof QA_AXES)[number];
export const QaAxisSchema = z.enum(QA_AXES);

/** What each axis is, for a reader who has only the page. */
export const QA_AXIS_TITLES: Record<QaAxis, { title: string; about: string }> = {
  rendering: { title: "Rendering", about: "What a reader of the rendered output (PDF, HTML) would trip on." },
  lean: { title: "Lean", about: "The formal layer: sorries, axioms, vacuous statements, build status." },
  compute: { title: "Compute", about: "Computation witnesses and the producers behind them." },
  kg: { title: "Knowledge graph", about: "The graph audit: dangling references, missing joins, coverage." },
  translations: { title: "Translations", about: "Per-locale translation verdicts." },
  "block-qa": { title: "Block QA", about: "Per-block review criteria of authored content." },
  bibliography: { title: "Bibliography", about: "References: resolution, duplicates, citation keys." },
  "site-build": { title: "Site build", about: "The published site: pages, links, node views." },
  domain: { title: "Domain", about: "Checks a content type adds of its own (an IG Publisher run, say)." },
};

/**
 * One shared vocabulary for counts. Every field optional: an absent field was
 * not counted, which is not the same as `0`.
 */
export interface QaCounts {
  pass?: number;
  fail?: number;
  warn?: number;
  unknown?: number;
  na?: number;
}
export const QA_COUNT_KEYS = ["pass", "fail", "warn", "unknown", "na"] as const;

/** Every spelling seen in a writer's counts, mapped onto the shared vocabulary. */
const COUNT_ALIASES: Record<string, keyof QaCounts> = {
  pass: "pass",
  passed: "pass",
  ok: "pass",
  fail: "fail",
  failed: "fail",
  failure: "fail",
  failures: "fail",
  error: "fail",
  errors: "fail",
  warn: "warn",
  warning: "warn",
  warnings: "warn",
  unknown: "unknown",
  "n/a": "na",
  na: "na",
  not_applicable: "na",
  "not-applicable": "na",
  skipped: "na",
};

/**
 * A counts-like object (`totals`, `counts`, `summary`) in the shared
 * vocabulary. Keys outside the vocabulary are dropped; `undefined` when no key
 * is recognised, so "unreadable" never becomes "all zero".
 */
export function normalizeCounts(raw: unknown): QaCounts | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const out: QaCounts = {};
  let any = false;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const key = COUNT_ALIASES[k.toLowerCase()];
    if (!key || typeof v !== "number" || !Number.isFinite(v) || v < 0) continue;
    out[key] = (out[key] ?? 0) + v;
    any = true;
  }
  return any ? out : undefined;
}

/** Add `b` into `a`, keeping "never counted" apart from zero. */
export function addCounts(a: QaCounts, b: QaCounts | undefined): QaCounts {
  if (!b) return a;
  const out: QaCounts = { ...a };
  for (const k of QA_COUNT_KEYS) if (b[k] !== undefined) out[k] = (out[k] ?? 0) + b[k]!;
  return out;
}

/**
 * How a record's format maps onto an axis: by `$schema` (exact, or a prefix
 * ending in `/`), else by a path suffix. Ordered; the first match wins. Data,
 * not code, so the page script can carry it verbatim.
 */
export interface QaFormatRule {
  axis: QaAxis;
  /** `$schema` values (exact) this rule claims. */
  schemas?: string[];
  /** Path suffixes or `/`-segments (`/block-qa/`) this rule claims when no `$schema` decides. */
  paths?: string[];
}

export const QA_FORMAT_RULES: readonly QaFormatRule[] = [
  { axis: "kg", schemas: ["kg-qa/v1", "kg-qa-manifest/v1"], paths: [".kg-qa.json", "kg-qa.manifest.json"] },
  { axis: "site-build", schemas: ["node-view-coverage/v1", "site-build-qa/v1", "viewer-nav-qa/v1"], paths: [".node-views.qa.json", "/site-qa/"] },
  { axis: "translations", schemas: ["translation-qa/v1", "folio-qa-translation-pages/v1"], paths: ["/translation-qa/"] },
  { axis: "block-qa", schemas: ["block-qa/v1", "folio-block-qa-summary/v1", "folio-qa-index/v1"], paths: ["/block-qa/", ".qa.json"] },
  { axis: "rendering", schemas: ["folio-paper-render-qa/v1", "preview-qa/v1"], paths: ["render-qa.json", "/rendering/"] },
  { axis: "lean", schemas: ["lean-qa/v1", "lean-vacuity-review/v1"], paths: ["/lean/", "lean-audit.json"] },
  { axis: "compute", schemas: ["compute-qa/v1", "qa-witness/v1"], paths: [".witness.json", "/compute/", "/witnesses/"] },
  { axis: "bibliography", schemas: ["bibliography-qa/v1"], paths: ["/bibliography/", "library-qa"] },
];

/**
 * The axis of one record: the writer's own declaration first (`declared`, the
 * `writes` globs of the instance's {@link QaWriterDecl}s), then its
 * `$schema`, then its path. `undefined` when nothing claims it: the page lists
 * it under "unclassified" rather than guessing.
 */
export function axisOf(path: string, schema?: string, declared: readonly { axis: QaAxis; writes: readonly string[] }[] = []): QaAxis | undefined {
  for (const w of declared) if (w.writes.some((g) => globMatch(g, path))) return w.axis;
  if (schema) for (const r of QA_FORMAT_RULES) if (r.schemas?.includes(schema)) return r.axis;
  const p = `/${path}`;
  for (const r of QA_FORMAT_RULES) if (r.paths?.some((s) => (s.endsWith("/") ? p.includes(s) : p.endsWith(s)))) return r.axis;
  return undefined;
}

/** `*` within a segment, `**` across segments; nothing else is special. */
export function globMatch(glob: string, path: string): boolean {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i]!;
    if (c === "*" && glob[i + 1] === "*") {
      re += ".*";
      i++;
      if (glob[i + 1] === "/") i++;
    } else if (c === "*") re += "[^/]*";
    else re += c.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${re}$`).test(path);
}

/** What the page needs of one record, without fetching it. */
export interface QaRecordSummary {
  /** Entry-relative path. */
  path: string;
  schema?: string;
  axis?: QaAxis;
  counts?: QaCounts;
  /** A short subject label (`kind:id`, a block label, a locale). */
  subject?: string;
}

/** The worst result among a block-qa criterion's reviewer entries, newest last. */
function latestResult(entries: unknown): string | undefined {
  if (!Array.isArray(entries) || entries.length === 0) return undefined;
  const last = entries[entries.length - 1] as { result?: unknown } | undefined;
  return typeof last?.result === "string" ? last.result : undefined;
}

/**
 * The summary of one record from its parsed JSON. Known formats are read by
 * their own shape; anything else by a top-level `counts` / `totals` /
 * `summary` in any spelling {@link normalizeCounts} knows. A record whose
 * counts cannot be read has none, and the page says "not counted".
 */
export function summarizeQaDoc(path: string, doc: unknown, declared: readonly { axis: QaAxis; writes: readonly string[] }[] = []): QaRecordSummary {
  const d = doc && typeof doc === "object" && !Array.isArray(doc) ? (doc as Record<string, unknown>) : undefined;
  const schema = typeof d?.$schema === "string" ? d.$schema : undefined;
  const out: QaRecordSummary = { path, ...(schema ? { schema } : {}) };
  const axis = axisOf(path, schema, declared);
  if (axis) out.axis = axis;
  if (!d) return out;
  const subj = d.subject as { kind?: unknown; id?: unknown } | undefined;
  if (subj && typeof subj.id === "string") out.subject = typeof subj.kind === "string" ? `${subj.kind}:${subj.id}` : subj.id;
  else if (typeof d.label === "string") out.subject = d.label;

  let counts: QaCounts | undefined;
  if ((schema === "block-qa/v1" || schema === "translation-qa/v1") && d.criteria && typeof d.criteria === "object") {
    counts = {};
    for (const entries of Object.values(d.criteria as Record<string, unknown>)) {
      const r = latestResult(entries);
      const k = r ? COUNT_ALIASES[r.toLowerCase()] : "unknown";
      counts[k ?? "unknown"] = (counts[k ?? "unknown"] ?? 0) + 1;
    }
  } else if (schema === "qa-results/v1" && d.families && typeof d.families === "object") {
    // Families of findings: a family holding findings fails, an empty one passes.
    counts = {};
    for (const f of Object.values(d.families as Record<string, { count?: unknown }>)) {
      const n = typeof f?.count === "number" ? f.count : undefined;
      const k: keyof QaCounts = n === undefined ? "unknown" : n > 0 ? "fail" : "pass";
      counts[k] = (counts[k] ?? 0) + 1;
    }
  } else if (schema === "site-build-qa/v1" && Array.isArray(d.findings)) {
    counts = { fail: d.findings.length };
  } else {
    counts = normalizeCounts(d.counts) ?? normalizeCounts(d.totals) ?? normalizeCounts(d.summary);
  }
  if (counts && Object.keys(counts).length > 0) out.counts = counts;
  return out;
}

/** A path the summary skips: not a JSON record, or bookkeeping of the store itself. */
export function isQaRecordPath(path: string): boolean {
  return path.endsWith(".json") && !/(^|\/)(manifest|index)\.json$/.test(path);
}

// ── What an instance declares ────────────────────────────────────────────────

/**
 * One QA writer an instance's publish runs. `run` is a shell command run from
 * the index checkout (as `layer-qa-publish.yml`'s `writers` input always was);
 * `writes` are globs relative to the instance's qa home, which is what lets
 * the page put the writer's files on its axis.
 */
export const QaWriterDeclSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9][a-z0-9:-]*$/, "a writer id: lower-case letters, digits, `-`, `:`"),
    axis: QaAxisSchema,
    run: z.string().min(1),
    writes: z.array(z.string().min(1)).nonempty(),
    title: z.string().min(1).optional(),
    because: z.string().min(1).optional(),
  })
  .strict();
export type QaWriterDecl = z.infer<typeof QaWriterDeclSchema>;

/**
 * An instance's QA declaration, `qa` in `<instance>.json`.
 *
 * - `writers` — run, in order, by the reusable publish workflow before it
 *   publishes the qa home. Absent: only the platform's own (the KG audit).
 * - `axes` — the axes this instance answers for. An axis listed here with no
 *   record is drawn as "nothing published — unknown", so a missing Lean
 *   report is visible instead of absent. Absent: the axes found in the entry.
 */
export const QaDeclarationSchema = z
  .object({
    writers: z.array(QaWriterDeclSchema).optional(),
    axes: z.array(QaAxisSchema).optional(),
  })
  .strict()
  .superRefine((q, ctx) => {
    const ids = new Set<string>();
    (q.writers ?? []).forEach((w, i) => {
      if (ids.has(w.id)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["writers", i, "id"], message: `qa writer \`${w.id}\` is declared twice` });
      ids.add(w.id);
    });
  });
export type QaDeclaration = z.infer<typeof QaDeclarationSchema>;
