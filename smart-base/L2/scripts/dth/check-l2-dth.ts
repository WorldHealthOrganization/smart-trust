#!/usr/bin/env bun
/**
 * Reusable L2 Digital Transformation Handbook (DTH) validator and QA checker
 * (`smart-base#242`).
 *
 * Generalises `dth-hrh` (#47) and `dth-sc` (#2) `check:dth-glossary` into a
 * platform validator in `smart-base` that checks:
 *
 * 1. **Cross-layer SKOS glossary links**: validates all `.glossary.json`
 *    files in `glossary/` against `GlossarySchema`, and resolves `broader`,
 *    `narrower`, `related`, `exactMatch`, `closeMatch`, `broadMatch`, and
 *    `narrowMatch` IRIs (as well as block `meta.glossary` / `meta.glossaryTerms`
 *    links) against the folio's own glossary scheme AND any mounted upstream
 *    layers (`dpi-h-ra` / `smart-ra`, `dth-sc`, `dth-pc`, `dth-hrh`,
 *    `dth-phc`, `dth-sfp`).
 * 2. **ArchiMate-link QA check**: verifies that every ArchiMate element, view,
 *    or figure-view mapping in a block's `meta.archimate` resolves against the
 *    mounted `dpi-h-ra` ArchiMate model, and checks that narrative blocks
 *    naming expected architecture elements link to their `smart-ra` IRIs.
 * 3. **Persona linkage QA check**: verifies that every `persona` block links to
 *    at least one BPMN 2.0 swimlane (`meta.bpmnLanes` with matching
 *    `partitionElementRef`), a `smart-ra` ArchiMate role/actor/component IRI
 *    (`meta.archimate.elements`), and a glossary concept IRI
 *    (`meta.glossaryTerms` or `meta.glossary`), and that every `<bpmn:lane>` in
 *    a `business-process` `.bpmn` companion binds `partitionElementRef` to a
 *    declared persona or actor-definition.
 * 4. **DTH DMN decision-table QA check**: verifies that every `decision-table`
 *    block has a valid `.dmn` companion (`dak-dmn-has-decision-table`), loads
 *    via `loadDecisionTable` with zero `unreadableExpressions`, and cites the
 *    source handbook passage it came from.
 * 5. **L1 coverage for anchored BPMN tasks and DMN tables**: counts a normative
 *    sentence anchored to a BPMN task or DMN decision table as `captured` in
 *    `l1-coverage`.
 *
 * Usage:
 *   bun run smart-base/L2/scripts/dth/check-l2-dth.ts [--root <dir>] [--instance <file.json>] [--folio <folio/slug>]
 *
 * @module smart-base/L2/scripts/dth/check-l2-dth
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { readArchimate } from "../../../../cat-harness-tools/archimate/schemas/archimate.ts";
import {
  loadDecisionTable,
  unreadableExpressions,
} from "../../../../cat-harness-tools/src/workflow/decision-table.ts";
import { GlossarySchema } from "../../../../folio-assistant-core/schemas/glossary.ts";
import { instanceNs } from "../../../../folio-assistant-core/scripts/glossary-page.ts";
import {
  coverage,
  type Captured,
  type Exclusion,
  type Page,
  type Report,
} from "../../../../folio-assistant-core/scripts/l1-coverage.ts";
import {
  checkDakBpmnHasProcess,
  checkDakCompanionPresent,
  checkDakDmnHasDecisionTable,
} from "../../../pipeline/qa-checkers-dak.ts";
import { stagingSite } from "../../../schemas/site-roots.ts";

export const SKOS_MATCH_FIELDS = [
  "exactMatch",
  "closeMatch",
  "broadMatch",
  "narrowMatch",
] as const;

export const SKOS_RELATION_FIELDS = [
  "broader",
  "narrower",
  "related",
  ...SKOS_MATCH_FIELDS,
] as const;

export const KNOWN_UPSTREAM_INSTANCES = [
  { dir: "dpi-h-ra", file: "dpi-h-ra.json" },
  { dir: "dth-sc", file: "dth-sc.json" },
  { dir: "dth-pc", file: "dth-pc.json" },
  { dir: "dth-hrh", file: "dth-hrh.json" },
  { dir: "dth-phc", file: "dth-phc.json" },
  { dir: "dth-sfp", file: "dth-sfp.json" },
] as const;

export interface DthInstanceInfo {
  name: string;
  ns: string;
  root: string;
}

export interface GlossaryIndex {
  knownIris: Set<string>;
  bareIds: Set<string>;
  docs: Array<{ file: string; glossary: ReturnType<typeof GlossarySchema.parse> }>;
}

export interface ArchimateModelIndex {
  models: Map<string, { elements: Set<string>; views: Set<string> }>;
}

export interface L2DthValidationOptions {
  rootDir: string;
  instanceFile?: string;
  folioDir?: string;
  mountedDirs?: Array<{ dir: string; file: string }>;
  requireCapitalizedPrefLabel?: boolean;
}

export interface L2DthValidationSummary {
  ok: boolean;
  errors: string[];
  counts: {
    glossarySchemes: number;
    glossaryTerms: number;
    matchedTerms: number;
    blockGlossaryLinks: number;
    archimateBlocks: number;
    archimateLinks: number;
    archimateFigures: number;
    personas: number;
    businessProcesses: number;
    bpmnLanes: number;
    decisionTables: number;
    decisionRules: number;
  };
}

/** Load a layer declaration and compute its canonical namespace URI. */
export function loadInstanceInfo(root: string, file: string): DthInstanceInfo {
  const decl = JSON.parse(readFileSync(join(root, file), "utf-8"));
  return {
    name: decl.name,
    ns: instanceNs(decl.name, decl.stub, decl),
    root,
  };
}

/** Auto-discover the primary `<dth>.json` declaration in `rootDir`. */
export function discoverSelfInstanceFile(rootDir: string): string | undefined {
  const candidates = readdirSync(rootDir).filter(
    (f) =>
      f.endsWith(".json") &&
      !f.endsWith(".config.json") &&
      !f.endsWith(".lock.json") &&
      f !== "package.json" &&
      f !== "tsconfig.json",
  );
  for (const f of candidates.sort()) {
    try {
      const raw = JSON.parse(readFileSync(join(rootDir, f), "utf-8"));
      if (typeof raw?.name === "string" && Array.isArray(raw?.directories)) {
        return f;
      }
    } catch {
      // ignore non-declaration JSON files
    }
  }
  return undefined;
}

/** Index every term IRI, scheme IRI, and bare term ID in a layer's `glossary/` directory. */
export function indexInstanceGlossary(inst: DthInstanceInfo): GlossaryIndex {
  const dir = join(inst.root, "glossary");
  const knownIris = new Set<string>();
  const bareIds = new Set<string>();
  const docs: Array<{ file: string; glossary: ReturnType<typeof GlossarySchema.parse> }> = [];
  if (!existsSync(dir)) return { knownIris, bareIds, docs };
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".glossary.json")).sort()) {
    const g = GlossarySchema.parse(JSON.parse(readFileSync(join(dir, f), "utf-8")));
    knownIris.add(`${inst.ns}glossary/${g.id}`);
    for (const t of g.terms) {
      bareIds.add(t.id);
      knownIris.add(t.iri ?? `${inst.ns}glossary/${g.id}/${t.id}`);
    }
    docs.push({ file: f, glossary: g });
  }
  return { knownIris, bareIds, docs };
}

/** Load the ArchiMate element and view IDs from a mounted `dpi-h-ra` layer. */
export function loadArchimateModelIndex(raRoot: string): ArchimateModelIndex {
  const models = new Map<string, { elements: Set<string>; views: Set<string> }>();
  const cfgPath = join(raRoot, "archimate", "cat-archimate.config.json");
  if (!existsSync(cfgPath)) return { models };
  const cfg = JSON.parse(readFileSync(cfgPath, "utf-8")) as {
    models?: Array<{ id: string; file: string }>;
  };
  for (const cm of cfg.models ?? []) {
    const p = join(raRoot, "archimate", cm.file);
    if (!existsSync(p)) continue;
    const model = readArchimate(readFileSync(p));
    models.set(cm.id, {
      elements: new Set(model.elements.map((e: { id: string }) => e.id)),
      views: new Set(model.views.map((v: { id: string }) => v.id)),
    });
  }
  return { models };
}

const ARCHIMATE_IRI_RE = /\/archimate\/([^/]+)\/(elements|views)\/([^/]+)\.jsonld$/;

/**
 * Check a block's `meta.archimate` links (`elements`, `views`, `figures`) against
 * the loaded `dpi-h-ra` ArchiMate model index.
 */
export function checkBlockArchimateLinks(
  fileLabel: string,
  archimateMeta: {
    elements?: Array<{ iri: string; name?: string }>;
    views?: Array<{ iri: string; name?: string }>;
    figures?: Array<{ figure: string; model: string; view: string }>;
  },
  archIndex: ArchimateModelIndex,
  expectedBasePrefix = stagingSite("smart-ra"),
): { errors: string[]; linkCount: number; figureCount: number } {
  const errors: string[] = [];
  let linkCount = 0;
  let figureCount = 0;

  for (const entry of [
    ...(archimateMeta.elements ?? []),
    ...(archimateMeta.views ?? []),
  ]) {
    linkCount++;
    const iri = String(entry.iri ?? "");
    const hit = iri.match(ARCHIMATE_IRI_RE);
    const kind = hit?.[2] as "elements" | "views" | undefined;
    const ok =
      Boolean(hit) &&
      iri.startsWith(expectedBasePrefix) &&
      Boolean(kind && archIndex.models.get(hit![1]!)?.[kind].has(hit![3]!));
    if (!ok) {
      errors.push(
        `${fileLabel}: ${iri}${entry.name ? ` (${entry.name})` : ""} is not in the mounted dpi-h-ra ArchiMate model`,
      );
    }
  }

  for (const fm of archimateMeta.figures ?? []) {
    figureCount++;
    const ok = archIndex.models.get(String(fm.model))?.views.has(String(fm.view));
    if (!ok) {
      errors.push(
        `${fileLabel}: figure ${fm.figure} view ${fm.view} is not in dpi-h-ra ArchiMate model ${fm.model}`,
      );
    }
  }

  return { errors, linkCount, figureCount };
}

/**
 * Check that a narrative block whose prose names known architecture elements
 * links to each mentioned element's `smart-ra` IRI in `meta.archimate.elements`.
 */
export function checkNarrativeArchimateMentions(
  fileLabel: string,
  markdownText: string,
  archimateMeta:
    | { elements?: Array<{ iri: string; name?: string }> }
    | undefined,
  expectedElements: ReadonlyArray<{ name: string; iri: string }>,
): string[] {
  const errors: string[] = [];
  const lowerText = markdownText.toLowerCase();
  const linkedIris = new Set(
    (archimateMeta?.elements ?? []).map((e) => e.iri),
  );
  for (const expected of expectedElements) {
    if (lowerText.includes(expected.name.toLowerCase()) && !linkedIris.has(expected.iri)) {
      errors.push(
        `${fileLabel}: narrative mentions architecture element "${expected.name}" but does not link to ${expected.iri} in meta.archimate.elements`,
      );
    }
  }
  return errors;
}

/**
 * Check whether a `decision-table` block (or its `.md` / `.dmn` companions)
 * cites the source handbook passage it was extracted from (`smart-base#242`).
 */
export function hasDecisionTableSourceCitation(
  tsSource: string,
  meta: Record<string, unknown> | undefined,
  mdSource?: string,
  dmnSource?: string,
): boolean {
  if (meta) {
    const src = meta.source as Record<string, unknown> | string | undefined;
    if (typeof src === "string" && src.trim().length > 0) return true;
    if (
      src &&
      typeof src === "object" &&
      (typeof src.section === "string" ||
        typeof src.sectionId === "string" ||
        typeof src.locator === "string" ||
        typeof src.page === "number" ||
        typeof src.pdfPage === "number" ||
        Array.isArray(src.pdfPages))
    ) {
      return true;
    }
    if (typeof meta.sourcePassage === "string" && meta.sourcePassage.trim().length > 0) {
      return true;
    }
    if (typeof meta.l1Section === "string" && meta.l1Section.trim().length > 0) {
      return true;
    }
    if (Array.isArray(meta.sources) && meta.sources.length > 0) {
      return true;
    }
  }
  // Check `uses: [...]` in the TypeScript manifest
  if (/uses\s*:\s*\[\s*["'][^"']+["']/.test(tsSource)) return true;
  // Check markdown companion for explicit source citation
  if (
    mdSource &&
    /(?:Source\s*:|page-\d+|Section\s+\d|Chapter\s+\d|Fig(?:ure|\.)\s*\d|Table\s+\d)/i.test(
      mdSource,
    )
  ) {
    return true;
  }
  // Check DMN description for explicit source citation
  if (
    dmnSource &&
    /<(?:\w+:)?description>[\s\S]*?(?:Source|Section|Chapter|Fig|Table|page-\d+)[\s\S]*?<\/(?:\w+:)?description>/i.test(
      dmnSource,
    )
  ) {
    return true;
  }
  return false;
}

function parseMetaFromBlockTs(
  file: string,
  src: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- parsed block meta JSON, read loosely by the checks below
): { meta?: Record<string, any>; parseError?: string } {
  const singleLine = src.match(/meta:\s*(\{.*\}),\r?\n/);
  if (singleLine) {
    try {
      return { meta: JSON.parse(singleLine[1]!) };
    } catch (e) {
      return { parseError: `${file}: failed to parse single-line meta JSON: ${(e as Error).message}` };
    }
  }
  const multiLine = src.match(/meta:\s*(\{"[\s\S]*?\}),\r?\n/);
  if (multiLine) {
    try {
      return { meta: JSON.parse(multiLine[1]!) };
    } catch (e) {
      return { parseError: `${file}: failed to parse meta JSON: ${(e as Error).message}` };
    }
  }
  return {};
}

function walkTsFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? walkTsFiles(join(dir, e.name))
      : e.name.endsWith(".ts")
        ? [join(dir, e.name)]
        : [],
  );
}

/**
 * Validate an L2 DTH folio's glossaries, cross-layer SKOS matches, ArchiMate
 * links, persona links, BPMN swimlanes, and DMN decision tables.
 */
export async function validateL2DthFolio(
  opts: L2DthValidationOptions,
): Promise<L2DthValidationSummary> {
  const rootDir = resolve(opts.rootDir);
  const errors: string[] = [];
  const counts = {
    glossarySchemes: 0,
    glossaryTerms: 0,
    matchedTerms: 0,
    blockGlossaryLinks: 0,
    archimateBlocks: 0,
    archimateLinks: 0,
    archimateFigures: 0,
    personas: 0,
    businessProcesses: 0,
    bpmnLanes: 0,
    decisionTables: 0,
    decisionRules: 0,
  };

  const selfFile = opts.instanceFile ?? discoverSelfInstanceFile(rootDir);
  if (!selfFile || !existsSync(join(rootDir, selfFile))) {
    errors.push(`No instance declaration found in ${rootDir}`);
    return { ok: false, errors, counts };
  }

  const self = loadInstanceInfo(rootDir, selfFile);
  const mountedSpecs = opts.mountedDirs ?? [...KNOWN_UPSTREAM_INSTANCES];
  const mounted: DthInstanceInfo[] = [];
  for (const spec of mountedSpecs) {
    const mRoot = join(rootDir, spec.dir);
    if (existsSync(join(mRoot, spec.file))) {
      mounted.push(loadInstanceInfo(mRoot, spec.file));
    }
  }

  const here = indexInstanceGlossary(self);
  const there = new Map<DthInstanceInfo, GlossaryIndex>(
    mounted.map((m) => [m, indexInstanceGlossary(m)]),
  );

  const checkTermRef = (ctx: string, ref: string): boolean => {
    if (!ref.includes("://")) {
      if (!here.bareIds.has(ref)) {
        errors.push(`${ctx}: bare id "${ref}" is not a term in ${self.name}`);
        return false;
      }
      return true;
    }
    if (ref.startsWith(self.ns)) {
      if (!here.knownIris.has(ref)) {
        errors.push(`${ctx}: ${ref} is not a term in ${self.name}`);
        return false;
      }
      return true;
    }
    const targetInst = mounted.find((x) => ref.startsWith(x.ns));
    if (targetInst) {
      if (!there.get(targetInst)!.knownIris.has(ref)) {
        errors.push(`${ctx}: ${ref} is not a term in mounted instance ${targetInst.name}`);
        return false;
      }
      return true;
    }
    return true;
  };

  // 1. Validate glossary schemes and cross-layer SKOS links
  const requireCap = opts.requireCapitalizedPrefLabel ?? true;
  for (const { file, glossary } of here.docs) {
    counts.glossarySchemes++;
    for (const t of glossary.terms) {
      counts.glossaryTerms++;
      if (requireCap && !/^[A-Z]/.test(t.prefLabel)) {
        errors.push(
          `${file}: ${t.id} prefLabel "${t.prefLabel}" is not capitalized`,
        );
      }
      for (const relField of SKOS_RELATION_FIELDS) {
        const vals = (t as Record<string, unknown>)[relField] as string[] | undefined;
        for (const target of vals ?? []) {
          checkTermRef(`${file}: ${t.id} ${relField}`, target);
        }
      }
      if (SKOS_MATCH_FIELDS.some((m) => (t[m]?.length ?? 0) > 0)) {
        counts.matchedTerms++;
      }
    }
  }

  // Locate folio directory
  const folioDir = opts.folioDir
    ? resolve(rootDir, opts.folioDir)
    : existsSync(join(rootDir, "folio", self.name))
      ? join(rootDir, "folio", self.name)
      : join(rootDir, "folio");

  const allTsFiles = walkTsFiles(folioDir);

  // 2. ArchiMate and block-level glossary links
  const ra = mounted.find((m) => m.name === "dpi-h-ra");
  const archIndex = ra ? loadArchimateModelIndex(ra.root) : undefined;

  for (const file of allTsFiles) {
    const relFile = file.startsWith(`${rootDir}/`) ? file.slice(rootDir.length + 1) : file;
    const src = readFileSync(file, "utf-8");
    const { meta, parseError } = parseMetaFromBlockTs(relFile, src);
    if (parseError) {
      if (
        src.includes('"archimate"') ||
        src.includes('"glossary"') ||
        src.includes('"glossaryTerms"')
      ) {
        errors.push(parseError);
      }
      continue;
    }

    if (Array.isArray(meta?.glossary)) {
      for (const gEntry of meta.glossary) {
        counts.blockGlossaryLinks++;
        checkTermRef(`${relFile} meta.glossary`, String(gEntry.iri));
      }
    }
    if (Array.isArray(meta?.glossaryTerms)) {
      for (const iri of meta.glossaryTerms) {
        counts.blockGlossaryLinks++;
        checkTermRef(`${relFile} meta.glossaryTerms`, String(iri));
      }
    }

    if (meta?.archimate && archIndex && archIndex.models.size > 0) {
      counts.archimateBlocks++;
      const res = checkBlockArchimateLinks(relFile, meta.archimate, archIndex);
      counts.archimateLinks += res.linkCount;
      counts.archimateFigures += res.figureCount;
      errors.push(...res.errors);
    }
  }

  // 3. Persona blocks (`block-kinds/persona.json`)
  const personaLabels = new Set<string>();
  for (const file of allTsFiles) {
    const relFile = file.startsWith(`${rootDir}/`) ? file.slice(rootDir.length + 1) : file;
    const src = readFileSync(file, "utf-8");
    if (
      !src.includes("export default persona(") &&
      !src.includes("export default actorDefinition(")
    ) {
      continue;
    }
    const label = src.match(/label:\s*["']([^"']+)["']/)?.[1];
    if (label) personaLabels.add(label);

    if (!src.includes("export default persona(")) continue;
    counts.personas++;
    const { meta } = parseMetaFromBlockTs(relFile, src);

    if (!meta?.roleId || !Array.isArray(meta?.bpmnLanes) || meta.bpmnLanes.length === 0) {
      errors.push(`${relFile}: persona is missing meta.roleId or meta.bpmnLanes`);
    }
    if (!Array.isArray(meta?.archimate?.elements) || meta.archimate.elements.length === 0) {
      errors.push(`${relFile}: persona is missing meta.archimate.elements (smart-ra role/actor/component link)`);
    }
    const hasGlossary =
      (Array.isArray(meta?.glossaryTerms) && meta.glossaryTerms.length > 0) ||
      (Array.isArray(meta?.glossary) && meta.glossary.length > 0);
    if (!hasGlossary) {
      errors.push(`${relFile}: persona is missing glossary link (meta.glossaryTerms or meta.glossary)`);
    }

    for (const lane of meta?.bpmnLanes ?? []) {
      const bpmnFile = resolve(rootDir, String(lane.bpmnFile ?? ""));
      if (!existsSync(bpmnFile)) {
        errors.push(`${relFile}: bpmnFile ${lane.bpmnFile} does not exist`);
        continue;
      }
      const bpmnXml = readFileSync(bpmnFile, "utf-8");
      if (
        !bpmnXml.includes(`id="${lane.laneId}"`) ||
        (label && !bpmnXml.includes(`partitionElementRef="${label}"`))
      ) {
        errors.push(
          `${relFile}: lane ${lane.laneId} with partitionElementRef="${label}" not found in ${lane.bpmnFile}`,
        );
      }
    }
  }

  // 4. Business-process blocks (`.bpmn` companions + role-bound lanes) and DMN decision-table blocks
  for (const file of allTsFiles) {
    const relFile = file.startsWith(`${rootDir}/`) ? file.slice(rootDir.length + 1) : file;
    const src = readFileSync(file, "utf-8");
    const { meta } = parseMetaFromBlockTs(relFile, src);

    if (src.includes("export default businessProcess(")) {
      counts.businessProcesses++;
      const bpmnPath = file.replace(/\.ts$/, ".bpmn");
      const c1 = checkDakCompanionPresent({
        ts: file,
        bpmn: existsSync(bpmnPath) ? bpmnPath : undefined,
      });
      const c2 = checkDakBpmnHasProcess({
        ts: file,
        bpmn: existsSync(bpmnPath) ? bpmnPath : undefined,
      });
      for (const [cid, c] of [
        ["dak-companion-present", c1],
        ["dak-bpmn-has-process", c2],
      ] as const) {
        if (c.result === "fail") {
          errors.push(`${relFile} (${cid}): ${c.hits.map((h) => h.text).join("; ")}`);
        }
      }
      if (existsSync(bpmnPath)) {
        const bpmnXml = readFileSync(bpmnPath, "utf-8");
        const lanes = [...bpmnXml.matchAll(/<(?:\w+:)?lane\s+([^>]+)>/g)];
        if (lanes.length === 0) {
          errors.push(`${relFile}: companion .bpmn has no <bpmn:lane> elements`);
        }
        for (const l of lanes) {
          counts.bpmnLanes++;
          const roleRef = l[1]!.match(/partitionElementRef="([^"]+)"/)?.[1];
          if (!roleRef || (personaLabels.size > 0 && !personaLabels.has(roleRef))) {
            errors.push(
              `${relFile}: BPMN lane missing partitionElementRef or persona "${roleRef ?? ""}" not declared in folio`,
            );
          }
        }
      }
    }

    if (src.includes("export default decisionTable(")) {
      counts.decisionTables++;
      const dmnPath = file.replace(/\.ts$/, ".dmn");
      const mdPath = file.replace(/\.ts$/, ".md");
      const c1 = checkDakCompanionPresent({
        ts: file,
        dmn: existsSync(dmnPath) ? dmnPath : undefined,
      });
      const c2 = checkDakDmnHasDecisionTable({
        ts: file,
        dmn: existsSync(dmnPath) ? dmnPath : undefined,
      });
      for (const [cid, c] of [
        ["dak-companion-present", c1],
        ["dak-dmn-has-decision-table", c2],
      ] as const) {
        if (c.result === "fail") {
          errors.push(`${relFile} (${cid}): ${c.hits.map((h) => h.text).join("; ")}`);
        }
      }

      if (!existsSync(dmnPath)) {
        errors.push(`${relFile}: decision-table block is missing .dmn companion`);
        continue;
      }

      const mdSrc = existsSync(mdPath) ? readFileSync(mdPath, "utf-8") : undefined;
      const dmnSrc = readFileSync(dmnPath, "utf-8");
      if (!hasDecisionTableSourceCitation(src, meta, mdSrc, dmnSrc)) {
        errors.push(
          `${relFile}: DMN decision-table block does not cite the source handbook passage it came from (in meta.source, meta.sourcePassage, uses, .md or .dmn)`,
        );
      }

      const decisionId = src.match(/decisionId:\s*["']([^"']+)["']/)?.[1];
      if (!decisionId) {
        errors.push(`${relFile}: decision-table block is missing decisionId`);
      } else {
        try {
          const table = await loadDecisionTable(dmnPath, decisionId);
          counts.decisionRules += table.rules.length;
          const unreadable = unreadableExpressions(table);
          if (unreadable.length > 0) {
            errors.push(
              `${relFile}: DMN table ${decisionId} has ${unreadable.length} unreadable FEEL expression(s)`,
            );
          }
        } catch (e) {
          errors.push(
            `${relFile}: failed to load DMN decision table "${decisionId}": ${(e as Error).message}`,
          );
        }
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    counts,
  };
}

/**
 * An L1 normative statement anchored to a BPMN task or a DMN decision table
 * in an L2 DTH folio (`smart-base#242`: "l1-coverage counts a BPMN task or
 * DMN table anchored to a block as captured").
 */
export interface DthArtefactAnchor {
  /** ID of the BPMN task (e.g. `bp:hrh-bp-02#Task_VerifyCredentials`) or DMN decision table (`dt:hrh-dt-01`). */
  artefactId: string;
  /** Kind of L2 artefact anchoring the statement. */
  artefactKind: "bpmn-task" | "dmn-table" | "block";
  /** ID or label of the narrative/structured block the artefact is anchored to. */
  anchoredBlockId: string;
  /** Verbatim L1 normative sentence or passage captured by this anchored artefact. */
  verbatimText: string;
}

/**
 * Compute L1 normative coverage for an L2 DTH folio where BPMN tasks and DMN
 * decision tables anchored to a block count as `captured` alongside prose/table
 * blocks (`smart-base#242`).
 */
export function dthCoverageWithAnchoredArtefacts(
  pages: Page[],
  capturedBlocks: Captured[],
  anchoredArtefacts: readonly DthArtefactAnchor[],
  exclusions: Exclusion[] = [],
): Report {
  const combinedCaptured: Captured[] = [
    ...capturedBlocks,
    ...anchoredArtefacts
      .filter((a) => a.anchoredBlockId.trim().length > 0 && a.verbatimText.trim().length > 0)
      .map((a) => ({
        id: `${a.anchoredBlockId}::${a.artefactKind}:${a.artefactId}`,
        text: a.verbatimText,
      })),
  ];
  return coverage(pages, combinedCaptured, exclusions);
}

function getArg(argv: string[], flag: string): string | undefined {
  const idx = argv.indexOf(flag);
  return idx >= 0 ? argv[idx + 1] : undefined;
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const rootDir = getArg(argv, "--root") ?? ".";
  const instanceFile = getArg(argv, "--instance");
  const folioDir = getArg(argv, "--folio");

  const summary = await validateL2DthFolio({
    rootDir,
    instanceFile,
    folioDir,
  });

  if (!summary.ok) {
    for (const err of summary.errors) console.error(`✗ ${err}`);
    process.exit(1);
  }

  const c = summary.counts;
  console.log(
    `✓ Glossary: ${c.glossarySchemes} scheme(s), ${c.glossaryTerms} term(s) (${c.matchedTerms} cross-matched), ${c.blockGlossaryLinks} block link(s)`,
  );
  console.log(
    `✓ ArchiMate: ${c.archimateLinks} element/view link(s) and ${c.archimateFigures} figure mapping(s) across ${c.archimateBlocks} block(s)`,
  );
  console.log(
    `✓ Personas & BPMN: ${c.personas} persona(s), ${c.businessProcesses} BPMN process(es) with ${c.bpmnLanes} role-bound lane(s)`,
  );
  console.log(
    `✓ DMN decision tables: ${c.decisionTables} table(s) with ${c.decisionRules} rule(s) citing source passages`,
  );
}
