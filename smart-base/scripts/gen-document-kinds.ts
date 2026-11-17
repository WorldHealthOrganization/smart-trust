/**
 * smart-base's document kinds that are GENERATED rather than authored.
 *
 * `dak.json` — the DAK as a document kind: a fixed structure of the ten
 * components, one section each, built from `DAK_COMPONENTS` (the list) and
 * `DAK_CARDS` (each component's title and description). Both already state the
 * components; restating them by hand in a JSON file would give the repository a
 * third copy free to drift. `--check` regenerates in memory and fails on a
 * difference, which is what makes a hand edit visibly a defect.
 *
 * `dak.coverage.<ig>.json` — the DAK view of each ingested IG's artefact
 * index, written into the `document-kinds` directory that IG's OWN layer
 * declares ({@link coverageDirFor}); only this layer's own coverage is
 * written here.
 *
 * `l1.json` and `dth.json` are authored, not generated: their sections are
 * read from publications (owner, 2026-10-01: the SMART Guidelines paper, the
 * WHO guideline-development handbook and the DTHs), not from code.
 *
 *   bun run smart-base/scripts/gen-document-kinds.ts [--check]
 *
 * Stage D5 of the smart-* separation, #1767, bean `qvxh`.
 *
 * @module smart-base/scripts/gen-document-kinds
 * @covers document-kinds
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

import { DAK_COMPONENTS, DAK_UNFORMALIZED_COMPONENTS } from "../schemas/dak-kinds.ts";
import {
  DOCUMENT_KIND_COVERAGE_SCHEMA_TAG,
  DOCUMENT_KIND_SCHEMA_TAG,
  DocumentKindCoverageSchema,
  DocumentKindSchema,
  type DocumentKind,
  type DocumentKindCoverage,
} from "../platform/index.js";
import { directoriesForGraph, instanceDirectoryForGraph, layerRootsIn, isBuiltAtPublish, overlayPath, readDeclaration, repoRootFor } from "../platform/index.js";
import { DAK_CARDS } from "./gen-dak-components-figure.ts";
import { kgClasses } from "./kg-classes.ts";

const OUT = resolve(import.meta.dir, "..", "document-kinds");
const GENERATOR = "smart-base/scripts/gen-document-kinds.ts";

/**
 * Every file this writes says so itself, in a top-level `_generated` key — the
 * self-declaration the harness's reference-direction check reads
 * (`declaresGenerated`), in the form `sync-docs-harness.ts` writes it. The
 * coverage reports name the layers they classify, and without it each of
 * those names read as authored text in this layer naming a layer above it.
 *
 * Added at serialisation, after the schema parse: the node kinds strip a key
 * they do not declare, so readers that parse these files are unaffected.
 * `generatedBy` stays — it is a field of the kind; `_generated` is the file's.
 */
export function serialise(node: Record<string, unknown>): string {
  return `${JSON.stringify({ _generated: `${GENERATOR} — do not hand-edit; rerun it`, ...node }, null, 2)}\n`;
}

/**
 * What is wrong with the kinds in this directory TAKEN TOGETHER — the joins a
 * per-file schema cannot see (bean `pebe`):
 *
 * - `extends` names a kind that is here, and the chain does not loop;
 * - a child does not redeclare a section id its parent already has — "extends"
 *   would otherwise mean two sections answering to one id;
 * - every `modelledBy` term is in smart-base's KG class lists
 *   (`code-lists/sgkg-l*-classes.json`), so a section cannot claim an
 *   undeclared class.
 */
export function kindSetProblems(kinds: readonly DocumentKind[], pinned: ReadonlySet<string>): string[] {
  const byId = new Map(kinds.map((k) => [k.id, k]));
  const out: string[] = [];
  for (const k of kinds) {
    const seen = new Set<string>([k.id]);
    let parent = k.extends;
    const inherited = new Set<string>();
    while (parent !== undefined) {
      const p = byId.get(parent);
      if (!p) { out.push(`${k.id}: extends "${parent}", which is not a kind here`); break; }
      if (seen.has(p.id)) { out.push(`${k.id}: its extends chain loops at "${p.id}"`); break; }
      seen.add(p.id);
      for (const s of p.sections) inherited.add(s.id);
      parent = p.extends;
    }
    for (const s of k.sections) {
      if (inherited.has(s.id)) out.push(`${k.id}: section "${s.id}" is already its parent's — extend it, do not redeclare it`);
      for (const t of s.modelledBy ?? []) {
        if (!pinned.has(t)) out.push(`${k.id}: section "${s.id}" is modelledBy "${t}", which the KG class lists do not declare`);
      }
    }
  }
  return out;
}

/** Every document kind in the directory, generated or authored. */
function kindsIn(dir: string): DocumentKind[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => JSON.parse(readFileSync(join(dir, f), "utf-8")) as { $schema?: string })
    .filter((d) => d.$schema === DOCUMENT_KIND_SCHEMA_TAG)
    .map((d) => DocumentKindSchema.parse(d));
}

/** The DAK as a fixed-structure document kind, one section per component. */
export function dakKind(): DocumentKind {
  const kind: DocumentKind = {
    $schema: DOCUMENT_KIND_SCHEMA_TAG,
    id: "dak",
    title: "Digital Adaptation Kit (DAK)",
    description:
      "The L2 layer of a WHO SMART Guideline: the ten components that make a guideline's " +
      "recommendations operational, ahead of the L3 FHIR IG that implements them. Fixed: a " +
      "DAK has exactly these components, in this order.",
    structure: "fixed",
    sections: DAK_COMPONENTS.map((c) => ({
      id: c,
      title: DAK_CARDS[c].title,
      required: true,
      description:
        DAK_CARDS[c].bullets.join(" ") +
        ((DAK_UNFORMALIZED_COMPONENTS as readonly string[]).includes(c)
          ? " Not yet a field of its own in WHO's DAK logical model."
          : ""),
    })),
    sources: [
      { ref: "https://www.who.int/publications/i/item/9789240099456", note: "WHO DAK guidance" },
      { ref: "https://www.who.int/publications/i/item/9789240085138", note: "WHO DAK guidance" },
      { ref: "https://github.com/litlfred/folio-assistant/issues/1614", note: "owner ruling 2026-09-30: ten components" },
    ],
    generatedBy: GENERATOR,
  };
  return DocumentKindSchema.parse(kind);
}

/**
 * Which DAK component an ingested IG artefact realises — the owner's answer to
 * Q2 (2026-10-01): computed from its FHIR resource type, and, for a
 * StructureDefinition, from the category the IG's OWN `artifacts.html` files it
 * under. WHO knowledge, so it lives here rather than in fhir-harness.
 *
 * Five rules and no more: each is a placement the WHO SMART L3 conventions make
 * unambiguous. Everything else — value sets, profiles, examples, a trust
 * network's endpoints — is reported as unplaced rather than forced into a
 * component it only arguably belongs to.
 */
export const DAK_RULES: readonly { component: string; resourceType: string; category?: string }[] = [
  { component: "generic-personas", resourceType: "ActorDefinition" },
  { component: "functional-and-non-functional-requirements", resourceType: "Requirements" },
  { component: "core-data-elements", resourceType: "StructureDefinition", category: "Structures: Logical Models" },
  { component: "decision-support-logic", resourceType: "PlanDefinition" },
  { component: "decision-support-logic", resourceType: "Library" },
  { component: "programme-indicators", resourceType: "Measure" },
];

const METHOD =
  "Computed from each artefact's FHIR resource type (owner, 2026-10-01): ActorDefinition → personas; " +
  "Requirements → requirements; a StructureDefinition the IG files under 'Structures: Logical Models' → " +
  "core data elements; PlanDefinition and Library → decision-support logic; Measure → indicators. " +
  "Anything else is listed as unplaced.";

interface IndexArtifact { key: string; resourceType: string; id: string; title?: string; name?: string; category?: string }

/** The DAK view of one ingested IG's artefact index. */
export function dakCoverage(subject: string, from: string, artifacts: readonly IndexArtifact[]): DocumentKindCoverage {
  const sections = DAK_COMPONENTS.map((c) => ({ id: c as string, members: [] as { key: string; label: string }[] }));
  const unplaced = new Map<string, number>();
  for (const a of artifacts) {
    const rule = DAK_RULES.find((r) => r.resourceType === a.resourceType && (r.category === undefined || r.category === a.category));
    if (rule === undefined) {
      unplaced.set(a.resourceType, (unplaced.get(a.resourceType) ?? 0) + 1);
      continue;
    }
    sections.find((s) => s.id === rule.component)!.members.push({ key: a.key, label: a.title ?? a.name ?? a.id });
  }
  for (const s of sections) s.members.sort((x, y) => x.key.localeCompare(y.key));
  return DocumentKindCoverageSchema.parse({
    $schema: DOCUMENT_KIND_COVERAGE_SCHEMA_TAG,
    kind: "dak",
    subject,
    from,
    method: METHOD,
    total: artifacts.length,
    sections,
    unplaced: [...unplaced].map(([group, count]) => ({ group, count })).sort((x, y) => y.count - x.count || x.group.localeCompare(y.group)),
    generatedBy: GENERATOR,
  });
}

/** One layer holding a fhir-artifact-index: whose it is, where its index is, and its artefacts. */
interface IngestedIg {
  subject: string;
  /** The layer's root, where its own `document-kinds` directory is declared. */
  root: string;
  /** Repo-relative path of the index. */
  from: string;
  artifacts: IndexArtifact[];
}

/** Every layer holding a fhir-artifact-index. */
function ingestedIgs(repoRoot: string): IngestedIg[] {
  const out: IngestedIg[] = [];
  for (const root of layerRootsIn(repoRoot)) {
    const subject = readDeclaration(root)?.name;
    if (!subject) continue;
    for (const dir of directoriesForGraph(root, "fhir-artifact-index")) {
      const path = join(dir, "index.json");
      // Read through the layer output overlay: ig-index:build writes a mounted
      // layer's index at the output root (fhir-harness a58233b, sm8r), so the
      // path under the mount is only the name. Read there, an index checkout
      // found no IG and wrote no coverage report (folio-assistant#3124).
      const at = overlayPath(path, repoRoot);
      if (!existsSync(at)) continue;
      const ix = JSON.parse(readFileSync(at, "utf-8")) as { artifacts?: IndexArtifact[] };
      out.push({ subject, root, from: relative(repoRoot, path).split("\\").join("/"), artifacts: ix.artifacts ?? [] });
    }
  }
  return out.sort((a, b) => a.subject.localeCompare(b.subject));
}

/**
 * Where an IG's DAK coverage report is written: the `document-kinds` directory
 * the IG's OWN layer declares — never this one (wrong-direction move M13).
 * A coverage report is data about one IG, so it lives in that IG's layer, which
 * depends on this one; written here, it was this layer holding a file about a
 * layer above it. This layer's own coverage stays in {@link OUT}.
 *
 * `undefined` when the IG's layer declares no such directory: the caller
 * reports it rather than falling back here, which is the move this undoes.
 */
export function coverageDirFor(ig: { subject: string; root: string }, ownName: string): string | undefined {
  if (ig.subject === ownName) return OUT;
  return instanceDirectoryForGraph(ig.root, "document-kinds");
}

if (import.meta.main) {
  const check = process.argv.includes("--check");
  const repoRoot = repoRootFor(resolve(import.meta.dir, ".."));
  const files = new Map<string, string>([[join(OUT, "dak.json"), serialise(dakKind())]]);
  const ownName = readDeclaration(resolve(import.meta.dir, ".."))?.name ?? "smart-base";
  const homeless: string[] = [];
  // A coverage report is a view of its IG's artefact index. Where the IG's
  // layer builds that index at publish, it builds the report at publish
  // too (`builtAtPublish`, writer `smart-base:document-kinds`), so --check
  // has no committed copy to compare (fhir-harness#124).
  const builtAtPublish = new Set<string>();
  for (const ig of ingestedIgs(repoRoot)) {
    const dir = coverageDirFor(ig, ownName);
    if (dir === undefined) {
      homeless.push(`${ig.subject} holds an artefact index (${ig.from}) but declares no document-kinds directory for its DAK coverage`);
      continue;
    }
    const target = join(dir, `dak.coverage.${ig.subject}.json`);
    files.set(target, serialise(dakCoverage(ig.subject, ig.from, ig.artifacts)));
    const rel = relative(ig.root, target).split("\\").join("/");
    if (isBuiltAtPublish(readDeclaration(ig.root)?.builtAtPublish ?? [], rel)) builtAtPublish.add(target);
  }
  for (const h of homeless) console.log(`✗ ${h}`);
  if (check) {
    let bad = 0;
    for (const target of builtAtPublish) console.log(`✓ ${relative(process.cwd(), target)} is built at publish (builtAtPublish), not committed — nothing to compare`);
    for (const [target, body] of files) {
      if (builtAtPublish.has(target)) continue;
      const ok = existsSync(target) && readFileSync(target, "utf-8") === body;
      if (!ok) { console.log(`✗ ${relative(process.cwd(), target)} is stale — run without --check`); bad++; }
    }
    if (bad === 0) console.log(`✓ ${files.size} document-kind file(s) current`);
    const problems = kindSetProblems(kindsIn(OUT), kgClasses());
    for (const p of problems) console.log(`✗ ${p}`);
    if (problems.length === 0) console.log(`✓ kinds resolve: every extends names a kind here, every modelledBy is in the KG class lists`);
    process.exit(bad === 0 && problems.length === 0 && homeless.length === 0 ? 0 : 1);
  }
  for (const [target, body] of files) {
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, body);
    console.log(`${relative(process.cwd(), target)} written`);
  }
  const problems = kindSetProblems(kindsIn(OUT), kgClasses());
  for (const p of problems) console.log(`✗ ${p}`);
  if (problems.length > 0 || homeless.length > 0) process.exit(1);
}
