/**
 * The DTH terminology findings page: where the WHO Digital Transformation
 * Handbooks and the draft DPI-H Reference Architecture disagree, recorded as
 * ALTERNATIVES rather than resolved.
 *
 * Owner, 2026-10-03 (#1984, bean `5blc`): "contradictions -> alternative
 * approaches/definitions. use one DIIG seven phase figure as source. ... RA
 * Actor - give bigger explanation. explain changes to RA and/or F-A and/or SG.
 * make a docs page under smart-base showing the glossary/terms differences
 * findings".
 *
 * Two inputs, neither restated in the other:
 *
 * - the candidate list (`smart-base/findings/dth-candidates-2026-10-02.json`, copied from cat-harness `docs/proposals/` at 2bae4d1e so this layer reads only its own tree),
 *   whose glossary entries carry every conflicting definition with its source,
 *   severity and difference — the 40 terms are READ from it, not copied;
 * - `smart-base/findings/dth-term-alternatives.json`, the authored part: the
 *   one DIIG phase figure and what reproduces it, the approaches recorded as
 *   alternatives, and the explanation of "actor" with its per-layer proposals.
 *
 * Every quote in the authored file is checked against the section or file it
 * cites (whitespace-normalised, and with the RA draft's number-only line
 * markers removed), so a quote that drifts from its source fails `--check`
 * rather than shipping as a citation.
 *
 *   bun run smart-base/scripts/gen-dth-term-findings.ts [--check]
 *
 * @module smart-base/scripts/gen-dth-term-findings
 * @covers docs
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { z } from "zod";

const ROOT = resolve(import.meta.dir, "..", "..");
const DIR = resolve(import.meta.dir, "..", "findings");
const DATA = join(DIR, "dth-term-alternatives.json");
const OUT = join(DIR, "dth-terms.md");
const GENERATOR = "smart-base/scripts/gen-dth-term-findings.ts";

const QuoteSchema = z.union([
  z.object({
    libraryId: z.string().min(1),
    sectionId: z.string().min(1),
    locator: z.string().min(1),
    quote: z.string().min(1),
    relation: z.enum(["reproduces", "adapts"]).optional(),
    note: z.string().min(1).optional(),
  }).strict(),
  z.object({ path: z.string().min(1), locator: z.string().min(1), quote: z.string().min(1) }).strict(),
]);
export type Quote = z.infer<typeof QuoteSchema>;

export const TermFindingsSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  ruling: z.object({ date: z.string(), quote: z.string().min(1), issue: z.string().url(), bean: z.string().min(1) }).strict(),
  candidates: z.string().min(1),
  figure: z.object({
    title: z.string().min(1),
    svgBean: z.string().min(1),
    /** The rendered SVG, repo-relative; written by `pdf-vector-svg.py` (bean 70zt). */
    svg: z.string().min(1).optional(),
    canonical: z.array(QuoteSchema).min(1),
    phases: z.array(z.string().min(1)).length(7),
    reproductions: z.array(QuoteSchema).min(1),
  }).strict(),
  approaches: z.array(z.object({
    id: z.string().min(1),
    title: z.string().min(1),
    summary: z.string().min(1),
    alternatives: z.array(z.object({ id: z.string().min(1), label: z.string().min(1), sources: z.array(QuoteSchema).min(1) }).strict()).min(2),
    note: z.string().min(1).optional(),
  }).strict()),
  actor: z.object({
    summary: z.string().min(1),
    meanings: z.array(z.object({
      layer: z.enum(["RA", "SG", "F-A"]),
      id: z.string().min(1),
      label: z.string().min(1),
      meaning: z.string().min(1),
      sources: z.array(QuoteSchema).min(1),
    }).strict()).min(3),
    correspondence: z.array(z.object({ concept: z.string(), RA: z.string(), SG: z.string(), "F-A": z.string() }).strict()),
    /** Owner's ruling on the proposals, verbatim, when there is one. */
    proposalsRuling: z.object({ date: z.string(), quote: z.string().min(1) }).strict().optional(),
    proposals: z.array(z.object({
      layer: z.enum(["RA", "SG", "F-A"]),
      // `applied`: changed in this repository. `drafted`: the text is written for
      // the owner to send to the layer's owner, and nothing was sent.
      status: z.enum(["proposed", "applied", "drafted"]),
      change: z.string().min(1),
      outcome: z.string().min(1).optional(),
      artefacts: z.array(z.string().min(1)).optional(),
    }).strict()).length(3),
  }).strict(),
  sfp: z.object({
    libraryId: z.literal("9789240120747-eng"),
    title: z.string().min(1),
    summary: z.string().min(1),
    internalConflicts: z.array(z.object({
      id: z.string().min(1),
      term: z.string().min(1),
      summary: z.string().min(1),
      alternatives: z.array(QuoteSchema).min(2),
    }).strict()).min(1),
    raConflicts: z.array(z.object({
      term: z.string().min(1),
      kind: z.enum(["conflict", "truncation-match"]),
      raId: z.string().min(1),
      difference: z.string().min(1),
      sfpQuote: QuoteSchema,
    }).strict()).min(1),
    terms: z.array(z.object({
      term: z.string().min(1),
      cluster: z.string().min(1),
      status: z.string().min(1),
      comparison: z.string().min(1),
      quote: QuoteSchema,
    }).strict()).length(35),
  }).strict(),
}).strict();
export type TermFindings = z.infer<typeof TermFindingsSchema>;

/** The candidate list's glossary shape — only the fields this page reads. */
const CandidateSourceSchema = z.object({ libraryId: z.string(), sectionId: z.string().optional(), pages: z.string().optional(), quote: z.string().optional() }).passthrough();
const ConflictSchema = z.object({
  term: z.string(),
  definition: z.string(),
  severity: z.enum(["substantive", "internal", "wording"]),
  difference: z.string(),
  libraryId: z.string().optional(),
  sectionId: z.string().optional(),
  repository: z.string().optional(),
}).passthrough();
const GlossarySchema = z.object({
  term: z.string(),
  definition: z.string(),
  sources: z.array(CandidateSourceSchema).min(1),
  conflictsWith: z.array(ConflictSchema),
  kind: z.string(),
  definedIn: z.array(z.string()),
}).passthrough();
export type CandidateTerm = z.infer<typeof GlossarySchema>;

/** Short names the candidate list already uses for the sources. */
const SHORT: Record<string, string> = {
  "9789240093362-eng": "PHC",
  "9789240101197-eng": "SC",
  "9789240116191-eng": "PC",
  "9789240120747-eng": "SFP",
  "who-dpi-h-reference-architecture-draft-v1": "RA (draft)",
  "9789240010567-eng": "DIIG",
};
const SEVERITY_ORDER = ["substantive", "internal", "wording"] as const;

const norm = (s: string): string => s.replace(/\s+/g, " ").trim();

/** A section's text as a quote is matched against it: front matter dropped, the RA draft's number-only line markers removed. */
/** The findings page's sentence about the figure's SVG: a link once it exists, the bean until then. */
function svgSentence(fig: { svg?: string; svgBean: string }): string {
  if (!fig.svg) return `An SVG rendering from the DIIG's vector layer is bean \`${fig.svgBean}\`.`;
  return `Its SVG rendering is [\`${fig.svg.split("/").pop()}\`](${relative("smart-base/findings", fig.svg)}) (bean \`${fig.svgBean}\`). It is drawn from the DIIG PDF's own vector layer, never by hand, and records its source (the PDF's sha256, the page and the crop) in its \`<metadata>\`; \`bun run cat smart-base:diig-figure:check\` fails if the drawing is edited or the crop drifts.`;
}

export function sectionText(raw: string): string {
  const body = raw.replace(/^---\n[\s\S]*?\n---\n/, "");
  return norm(body.split("\n").filter((l) => !/^\s*\d+\s*$/.test(l)).join("\n"));
}

/**
 * The files this layer declares `builtAtPublish` (`smart-base.json`), as
 * checkout-relative paths: `smart-base/fhir-artifact-index/index.json` is
 * written by `ig-index:build` at publish (fhir-harness#124), so a checkout
 * that has not built it, a repository mounting this layer included, holds
 * none.
 */
export function builtAtPublishPaths(root = ROOT): Set<string> {
  try {
    const decl = JSON.parse(readFileSync(join(root, "smart-base", "smart-base.json"), "utf8")) as { builtAtPublish?: { path?: string }[] };
    return new Set((decl.builtAtPublish ?? []).flatMap((b) => (b.path ? [`smart-base/${b.path.replace(/^\.\//, "")}`] : [])));
  } catch {
    return new Set();
  }
}

/**
 * Why a quote cannot be checked HERE, or null when it can: it cites a file
 * built at publish that this checkout has not built. Said, not counted as a
 * match, and not a failure.
 */
export function quoteUnverifiable(q: Quote, root = ROOT, built = builtAtPublishPaths(root)): string | null {
  if (!("path" in q)) {
    const home = EXAMPLE_POINTERS[q.libraryId];
    if (home === undefined || LIBRARY_ROOTS.some((r) => existsSync(join(root, r, q.libraryId, "sections")))) return null;
    return `${q.libraryId}/${q.sectionId}: an example held by ${home}, not in this checkout — "${q.quote}" not checked here`;
  }
  if (existsSync(join(root, q.path)) || !built.has(q.path)) return null;
  return `${q.path}: built at publish and not built in this checkout — "${q.quote}" not checked`;
}

/**
 * Sources smart-base cites as EXAMPLES only, whose one copy lives in a folio
 * that builds on smart-base (owner, 2026-10-30: "one copy in smart-ra", and
 * "example is a mention"). The quote stays as a pointer; it is checked where
 * the copy is held, not here, and naming it is a mention, not a dependency.
 */
const EXAMPLE_POINTERS: Record<string, string> = {
  "who-dpi-h-reference-architecture-draft-v1": "litlfred/smart-ra (library/who-dpi-h-reference-architecture-draft-v1)",
};

/**
 * The library that holds a libraryId's sections. smart-base's own library comes first;
 * the IRIS publications it cites live in who-iris since 57aa.
 */
const LIBRARY_ROOTS = ["smart-base/library", "who-iris/library"] as const;
function libraryRootOf(libraryId: string, root = ROOT): string {
  const hit = LIBRARY_ROOTS.find((r) => existsSync(join(root, r, libraryId)));
  return join(root, hit ?? LIBRARY_ROOTS[0]!);
}

/** Why a quote does not match what it cites, or null when it does. */
export function quoteProblem(q: Quote, root = ROOT): string | null {
  const file = "path" in q ? join(root, q.path) : join(libraryRootOf(q.libraryId, root), q.libraryId, "sections", `${q.sectionId}.md`);
  const label = "path" in q ? q.path : `${q.libraryId}/${q.sectionId}`;
  if (!existsSync(file)) return `${label}: no such file`;
  const raw = readFileSync(file, "utf8");
  const hay = "path" in q ? norm(raw.replace(/\\"/g, '"')) : sectionText(raw);
  return hay.includes(norm(q.quote)) ? null : `${label}: quote not found — "${q.quote}"`;
}

export function allQuotes(f: TermFindings): Quote[] {
  return [
    ...f.figure.canonical,
    ...f.figure.reproductions,
    ...f.approaches.flatMap((a) => a.alternatives.flatMap((x) => x.sources)),
    ...f.actor.meanings.flatMap((m) => m.sources),
    ...f.sfp.internalConflicts.flatMap((c) => c.alternatives),
    ...f.sfp.raConflicts.map((c) => c.sfpQuote),
    ...f.sfp.terms.map((t) => t.quote),
  ];
}

export function conflictingTerms(candidates: unknown): CandidateTerm[] {
  const g = z.object({ glossary: z.array(GlossarySchema) }).passthrough().parse(candidates).glossary;
  return g.filter((t) => t.conflictsWith.length > 0);
}

const worst = (t: CandidateTerm): (typeof SEVERITY_ORDER)[number] =>
  SEVERITY_ORDER.find((s) => t.conflictsWith.some((c) => c.severity === s)) ?? "wording";

const cell = (s: string): string => s.replace(/\|/g, "\\|").replace(/\n+/g, " ");
/** A locator already names its source (`PHC §2.3, …`); the file it was checked against follows it. */
const src = (q: Quote): string => ("path" in q ? `\`${q.path}\`, ${q.locator}` : `${q.locator} (\`${q.libraryId}/${q.sectionId}\`)`);
const quoted = (q: Quote): string => `> "${q.quote}"<br>— ${src(q)}`;

function candidateSource(s: z.infer<typeof CandidateSourceSchema>): string {
  return `${SHORT[s.libraryId] ?? s.libraryId}${s.sectionId ? ` \`${s.sectionId}\`` : ""}${s.pages ? `, PDF p.${s.pages}` : ""}`;
}
function conflictSource(c: z.infer<typeof ConflictSchema>): string {
  if (c.repository) return `this repository: \`${c.repository}\``;
  return `${SHORT[c.libraryId ?? ""] ?? c.libraryId}${c.sectionId ? ` \`${c.sectionId}\`` : ""}`;
}

export function render(f: TermFindings, terms: CandidateTerm[]): string {
  const counts = Object.fromEntries(SEVERITY_ORDER.map((s) => [s, terms.filter((t) => worst(t) === s).length]));
  const L: string[] = [];
  L.push("---", `title: "${f.title.replace(/"/g, '\\"')}"`, `description: "Where the WHO Digital Transformation Handbooks and the draft DPI-H Reference Architecture define a term differently, each definition recorded as an alternative with its source."`, `rendered-by: ${GENERATOR}`, "---", "");
  L.push(`<!-- Generated by ${GENERATOR} from ${f.candidates} and smart-base/findings/dth-term-alternatives.json — do not edit; change those and regenerate. -->`, "");
  L.push(`# ${f.title}`, "");
  L.push(`Owner, ${f.ruling.date} ([#${f.ruling.issue.split("/").pop()}](${f.ruling.issue}), bean \`${f.ruling.bean}\`):`, "", `> "${f.ruling.quote}"`, "");
  L.push("**Where sources disagree, every version is recorded here as an alternative, with its source. None is chosen.** The only changes this page records beyond that are the three per-layer Actor proposals, and their status is shown with each one. No empirical claim from a handbook is turned into a formal statement here.", "");
  L.push("Sources: **PHC** is the DTH for primary health care (9789240093362), **SC** the DTH for health supply chain architecture (9789240101197), **PC** the DTH for health product catalogue (9789240116191), **SFP** the DTH for reporting substandard and falsified medical products (9789240120747), **RA (draft)** the Reference Architecture for DPI-H, DRAFT V1.0, and **DIIG** the Digital Implementation Investment Guide (9789240010567).", "");
  L.push("## Contents", "", "1. [One phase figure: DIIG Fig. 1.1.1](#one-phase-figure-diig-fig-111)", "2. [Approaches recorded as alternatives](#approaches-recorded-as-alternatives)", '3. [What "actor" means, and what each layer could change](#what-actor-means-and-what-each-layer-could-change)', `4. [Terms defined differently (${terms.length})](#terms-defined-differently)`, `5. [Substandard and falsified medical products DTH (SFP, ${f.sfp.terms.length} terms)](#substandard-and-falsified-medical-products-dth-sfp-${f.sfp.terms.length}-terms)`, "");

  L.push("## One phase figure: DIIG Fig. 1.1.1", "");
  L.push(`The seven phases of "${f.figure.title.split(":")[0].toLowerCase()}" have ONE source, the DIIG's own figure. The handbooks that print it are reproductions of it and cite it; they are not separate sources for it. ${svgSentence(f.figure)}`, "");
  for (const q of f.figure.canonical) L.push(quoted(q), "");
  L.push("The phases, in the DIIG's words:", "");
  f.figure.phases.forEach((p, i) => L.push(`${i + 1}. ${p}`));
  L.push("", "| relation | where | caption, verbatim |", "|---|---|---|");
  for (const q of f.figure.reproductions) {
    if ("path" in q) continue;
    L.push(`| ${q.relation ?? "reproduces"} | ${cell(src(q))} | ${cell(q.quote)}${q.note ? `<br>*${cell(q.note)}*` : ""} |`);
  }
  L.push("");

  L.push("## Approaches recorded as alternatives", "");
  for (const a of f.approaches) {
    L.push(`### ${a.title}`, "", a.summary, "");
    a.alternatives.forEach((x, i) => {
      L.push(`**Alternative ${String.fromCharCode(65 + i)}: ${x.label}.**`, "");
      for (const q of x.sources) L.push(quoted(q), "");
    });
    if (a.note) L.push(`*${a.note}*`, "");
  }

  L.push('## What "actor" means, and what each layer could change', "", f.actor.summary, "");
  for (const m of f.actor.meanings) {
    L.push(`### ${m.label}`, "", m.meaning, "");
    for (const q of m.sources) L.push(quoted(q), "");
  }
  L.push("### The same three ideas, side by side", "", "| idea | RA (draft) | SMART Guidelines / DAK | folio-assistant |", "|---|---|---|---|");
  for (const r of f.actor.correspondence) L.push(`| ${cell(r.concept)} | ${cell(r.RA)} | ${cell(r.SG)} | ${cell(r["F-A"])} |`);
  const pr = f.actor.proposalsRuling;
  L.push("", pr ? "### Changes, one per layer" : "### Proposed changes, one per layer (not applied)", "");
  if (pr) L.push(`Owner, ${pr.date}: "${pr.quote}"`, "");
  const LAYER = { RA: "Reference Architecture (draft)", "F-A": "folio-assistant", SG: "SMART Guidelines / SMART Base" } as const;
  const STATUS = { proposed: "proposed, not applied", applied: "applied in this repository", drafted: "drafted for the owner to send; not sent" } as const;
  for (const p of f.actor.proposals) {
    const links = (p.artefacts ?? []).map((a) => `[\`${a}\`](${a.startsWith("smart-base/findings/") ? a.slice("smart-base/findings/".length) : `../../${a}`})`).join(", ");
    L.push(`- **${LAYER[p.layer]}** (*${STATUS[p.status]}*): ${p.change}${p.outcome ? ` **Outcome:** ${p.outcome}` : ""}${links ? ` See ${links}.` : ""}`);
  }
  L.push("");

  L.push("## Terms defined differently", "");
  L.push(`${terms.length} terms carry more than one definition across the sources: ${counts.substantive} with a different meaning or an added claim (**substantive**), ${counts.internal} defined two ways inside one source (**internal**), and ${counts.wording} that differ only in wording. A term is listed under the most severe difference it has. In each table, row A is the first source in the order PHC, SC, PC, RA, SFP; that order is a reading order, not a ranking.`, "");
  for (const sev of SEVERITY_ORDER) {
    const group = terms.filter((t) => worst(t) === sev).sort((a, b) => a.term.localeCompare(b.term));
    if (group.length === 0) continue;
    L.push(`### ${sev[0].toUpperCase()}${sev.slice(1)} (${group.length})`, "");
    for (const t of group) {
      L.push(`#### ${t.term}`, "", "| | definition | source | how it differs |", "|---|---|---|---|");
      L.push(`| A | ${cell(t.definition)} | ${cell(candidateSource(t.sources[0]))} | — |`);
      t.conflictsWith.forEach((c, i) => L.push(`| ${String.fromCharCode(66 + i)} | ${cell(c.definition)} | ${cell(conflictSource(c))} | *${c.severity}*: ${cell(c.difference)} |`));
      L.push("");
    }
  }

  L.push(`## Substandard and falsified medical products DTH (SFP, ${f.sfp.terms.length} terms)`, "", f.sfp.summary, "");
  L.push("### Internal alternatives within SFP", "");
  for (const ic of f.sfp.internalConflicts) {
    L.push(`#### ${ic.term} (\`${ic.id}\`)`, "", ic.summary, "");
    ic.alternatives.forEach((q, idx) => {
      L.push(`**Alternative ${String.fromCharCode(65 + idx)}:**`, "", quoted(q), "");
    });
  }
  L.push("### Differences against the DPI-H Reference Architecture glossary (`smart-ra#139`)", "", "| term | relation | `smart-ra` concept | SFP definition (verbatim) | how it differs |", "|---|---|---|---|---|");
  for (const rc of f.sfp.raConflicts) {
    L.push(`| ${cell(rc.term)} | \`${rc.kind}\` | \`${rc.raId}\` | ${cell(rc.sfpQuote.quote)}<br>— ${cell(src(rc.sfpQuote))} | ${cell(rc.difference)} |`);
  }
  L.push("", "### All 35 SFP glossary terms (pp. vii–ix) by cluster and cross-DTH comparison", "", "| term | cluster | status | SFP glossary definition (verbatim) | cross-DTH comparison |", "|---|---|---|---|---|");
  for (const t of f.sfp.terms) {
    L.push(`| **${cell(t.term)}** | ${cell(t.cluster)} | ${cell(t.status)} | ${cell(t.quote.quote)}<br>— ${cell(src(t.quote))} | ${cell(t.comparison)} |`);
  }
  L.push("");

  return `${L.join("\n").trimEnd()}\n`;
}

function load(): { f: TermFindings; terms: CandidateTerm[] } {
  const f = TermFindingsSchema.parse(JSON.parse(readFileSync(DATA, "utf8")));
  const terms = conflictingTerms(JSON.parse(readFileSync(join(ROOT, f.candidates), "utf8")));
  return { f, terms };
}

if (import.meta.main) {
  const check = process.argv.includes("--check");
  const { f, terms } = load();
  const built = builtAtPublishPaths();
  const unverified = allQuotes(f).map((q) => quoteUnverifiable(q, ROOT, built)).filter((p): p is string => p !== null);
  for (const u of unverified) console.log(`? ${u}`);
  const problems = allQuotes(f).filter((q) => quoteUnverifiable(q, ROOT, built) === null).map((q) => quoteProblem(q)).filter((p): p is string => p !== null);
  if (problems.length > 0) {
    console.error(`✗ ${problems.length} quote(s) in ${DATA.slice(ROOT.length + 1)} do not match what they cite:`);
    for (const p of problems) console.error(`    ${p}`);
    process.exit(1);
  }
  const page = render(f, terms);
  if (check) {
    const have = existsSync(OUT) ? readFileSync(OUT, "utf8") : "";
    if (have !== page) {
      console.error(`✗ ${OUT.slice(ROOT.length + 1)} is stale — run: bun run cat smart-base:dth-terms`);
      process.exit(1);
    }
    console.log(`✓ ${OUT.slice(ROOT.length + 1)} current; ${terms.length} conflicting terms, ${allQuotes(f).length - unverified.length} quotes match their sources${unverified.length ? `, ${unverified.length} not checked here (built at publish, or an example held elsewhere)` : ""}`);
  } else {
    writeFileSync(OUT, page);
    console.log(`wrote ${OUT.slice(ROOT.length + 1)} (${terms.length} conflicting terms)`);
  }
}
