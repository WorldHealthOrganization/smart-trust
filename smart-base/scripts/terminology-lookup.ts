#!/usr/bin/env bun
/**
 * Reuse-first terminology and code-list lookup across the four precedence rungs
 * of the `terminology-coding` methodology (`folio-assistant-4nfs`).
 *
 * Implements the `terminology-lookup` Tool contract (`satisfies:
 * ["classify-and-code-content"]`):
 *
 *   1. Rung 1 (`rung-1-target-guide`): target guide's own personas and business
 *      processes (`l1-scenario-vocabulary/v1`, passed via `--vocabulary`).
 *   2. Rung 2 (`rung-2-smart-base`): `smart-base` generic personas
 *      (`DAK.Persona.*`), GRADE `folio-code-list/v1` lists (`code-lists/*.json`),
 *      and `guideline-domain` (`folio-glossary/v1`).
 *   3. Rung 3 (`rung-3-external-standard`): WHO-FIC / ILO / HL7 standards
 *      materialised in FSH CodeSystems (`ISCO08`, `CDHIv2`, `CDHIv1`, `CDSCv2`,
 *      `KGTerminologySystem`) and curated baseline terms.
 *   4. Rung 4 (`rung-4-local-candidate`): when Rungs 1–3 return `none`, prepares
 *      either a `glossary-terms` candidate entry (`status: "candidate"`,
 *      `source: "extracted"`) or `could-not-determine` for `business-process`,
 *      with its greppable `WARNING` line.
 *
 *   bun run smart-base/scripts/terminology-lookup.ts \
 *     --slot <slot> --query <query> \
 *     [--vocabulary <guide.json>] [--generic <generic.json>] \
 *     [--scheme <scheme>] [--out <out.json>]
 *
 * @module smart-base/scripts/terminology-lookup
 * @covers code-list, scenarios, l1-extraction
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

import { ownDeclaredDirectories } from "../platform/schema.js";
import { slug, VocabularySchema, type Vocabulary } from "./l1-scenario-vocabulary.ts";
import { HARNESS_PAGES_ROOT, stagingSite } from "../schemas/site-roots.ts";

export const SLOTS = [
  "condition",
  "intervention",
  "persona",
  "medicine",
  "domain",
  "business-process",
  "recommendation-strength",
  "recommendation-direction",
  "evidence-certainty",
] as const;

export type TerminologySlot = (typeof SLOTS)[number];

export type ReuseRung =
  | "rung-1-target-guide"
  | "rung-2-smart-base"
  | "rung-3-external-standard"
  | "rung-4-local-candidate";

export type MatchKind = "exactMatch" | "closeMatch";

export interface TerminologyMatch {
  rung: Exclude<ReuseRung, "rung-4-local-candidate">;
  scheme: string;
  code: string;
  label: string;
  definition?: string;
  matchKind: MatchKind;
  uri?: string;
  sourcePath: string;
}

export interface AuthoritySchemeInfo {
  id: string;
  title: string;
  uri: string;
  localSources?: string[];
}

export interface CandidateToMint {
  action: "mint-glossary-candidate" | "could-not-determine";
  status: "candidate" | "could-not-determine";
  term?: {
    id: string;
    prefLabel: string;
    status: "candidate";
    source: "extracted";
  };
  warning: string;
}

export interface TerminologyLookupResult {
  slot: TerminologySlot;
  query: string;
  authorityScheme: AuthoritySchemeInfo;
  bestMatchKind: MatchKind | "none";
  selectedRung: ReuseRung;
  matches: TerminologyMatch[];
  candidateToMint?: CandidateToMint;
}

export interface LookupOptions {
  slot: TerminologySlot;
  query: string;
  vocabularyPath?: string;
  genericPath?: string;
  schemeFilter?: string;
  repoRoot?: string;
}

const HERE = resolve(import.meta.dir, "..");
// declared-path-literal: a provenance label shown beside each guideline-domain match, naming the scheme's home in folio-assistant-core; this script never reads it from disk
const GUIDELINE_DOMAIN_SOURCE = "folio-assistant-core/glossary/guideline-domain.glossary.json";

const DEFAULT_GENERIC_PERSONAS = join(
  HERE,
  "scripts",
  "fixtures",
  "l1-recommendation-scenarios",
  "smart-base-generic-personas.json",
);

export const AUTHORITY_SCHEMES: Record<TerminologySlot, AuthoritySchemeInfo> = {
  condition: {
    id: "ICD-11",
    title: "WHO International Classification of Diseases, 11th Revision (ICD-11)",
    uri: "http://id.who.int/icd/release/11/mms",
    localSources: ["input/fsh/codesystems/KGTerminologySystem.fsh"],
  },
  intervention: {
    id: "ICHI-CDHI",
    title: "WHO ICHI and Classification of Digital Health Interventions (CDISAH / CDHI v2.0)",
    uri: "http://smart.who.int/base/CodeSystem/CDHIv2",
    localSources: [
      "input/fsh/codesystems/CDHIv2.fsh",
      "input/fsh/codesystems/CDHIv1.fsh",
      "input/fsh/codesystems/CDSCv2.fsh",
      "input/fsh/codesystems/KGTerminologySystem.fsh",
    ],
  },
  persona: {
    id: "ISCO-08",
    title: "ILO International Standard Classification of Occupations (ISCO-08) & WHO SMART Generic Personas",
    uri: "http://www.ilo.org/public/english/bureau/stat/isco/isco08/",
    localSources: [
      "smart-base/scripts/fixtures/l1-recommendation-scenarios/smart-base-generic-personas.json",
      "input/fsh/codesystems/ISCO08.fsh",
    ],
  },
  medicine: {
    id: "ATC",
    title: "WHO Anatomical Therapeutic Chemical (ATC) Classification",
    uri: "http://www.whocc.no/atc",
    localSources: ["input/fsh/codesystems/KGTerminologySystem.fsh"],
  },
  domain: {
    id: "guideline-domain",
    title: "WHO SMART Guideline Domain Scheme",
    uri: `${HARNESS_PAGES_ROOT}/folio-assistant-core/glossary/guideline-domain`,
    localSources: [GUIDELINE_DOMAIN_SOURCE],
  },
  "business-process": {
    id: "dak-business-process",
    title: "WHO SMART Guidelines DAK Component 4 Business Process Catalogue",
    uri: "http://smart.who.int/base/BusinessProcess",
    localSources: [],
  },
  "recommendation-strength": {
    id: "grade-recommendation-strength",
    title: "GRADE Recommendation Strength",
    uri: `${stagingSite("smart-base")}code-lists/grade-recommendation-strength`,
    localSources: ["smart-base/code-lists/grade-recommendation-strength.json"],
  },
  "recommendation-direction": {
    id: "grade-recommendation-direction",
    title: "GRADE Recommendation Direction",
    uri: `${stagingSite("smart-base")}code-lists/grade-recommendation-direction`,
    localSources: ["smart-base/code-lists/grade-recommendation-direction.json"],
  },
  "evidence-certainty": {
    id: "grade-certainty",
    title: "GRADE Certainty of Evidence",
    uri: `${stagingSite("smart-base")}code-lists/grade-certainty`,
    localSources: ["smart-base/code-lists/grade-certainty.json"],
  },
};

interface RawEntry {
  rung: Exclude<ReuseRung, "rung-4-local-candidate">;
  scheme: string;
  code: string;
  label: string;
  altLabels?: string[];
  definition?: string;
  uri?: string;
  sourcePath: string;
}

const BUILTIN_DOMAIN_TERMS: RawEntry[] = [
  {
    rung: "rung-2-smart-base",
    scheme: "guideline-domain",
    code: "clinical",
    label: "clinical",
    altLabels: ["clinical guideline", "clinical health"],
    definition:
      "A guideline whose recommendations address the care of individual patients by health workers: assessment, diagnosis, treatment and management of a condition in a person.",
    uri: `${HARNESS_PAGES_ROOT}/folio-assistant-core/glossary/guideline-domain#clinical`,
    sourcePath: GUIDELINE_DOMAIN_SOURCE,
  },
  {
    rung: "rung-2-smart-base",
    scheme: "guideline-domain",
    code: "public-health",
    label: "public health",
    altLabels: ["public health guideline", "public-health"],
    definition:
      "A guideline whose recommendations address the health of populations rather than of an individual patient: prevention, health promotion, immunization and screening programmes, surveillance, and policy or environmental measures.",
    uri: `${HARNESS_PAGES_ROOT}/folio-assistant-core/glossary/guideline-domain#public-health`,
    sourcePath: GUIDELINE_DOMAIN_SOURCE,
  },
  {
    rung: "rung-2-smart-base",
    scheme: "guideline-domain",
    code: "health-system-strengthening",
    label: "health system strengthening",
    altLabels: ["health systems strengthening", "HSS", "health-system-strengthening"],
    definition:
      "A guideline whose recommendations address how the health system itself is organised and resourced — service delivery, health workforce, health information systems, access to medical products, financing, and leadership and governance.",
    uri: `${HARNESS_PAGES_ROOT}/folio-assistant-core/glossary/guideline-domain#health-system-strengthening`,
    sourcePath: GUIDELINE_DOMAIN_SOURCE,
  },
];

const BUILTIN_EXTERNAL_TERMS: Record<TerminologySlot, RawEntry[]> = {
  condition: [
    {
      rung: "rung-3-external-standard",
      scheme: "ICD-11",
      code: "1F03",
      label: "Measles",
      definition: "A disease of the respiratory system, caused by an infection with Morbillivirus (ICD-11 MMS 1F03).",
      uri: "http://id.who.int/icd/release/11/mms/1F03",
      sourcePath: "input/fsh/codesystems/KGTerminologySystem.fsh",
    },
    {
      rung: "rung-3-external-standard",
      scheme: "KGTerminologySystem",
      code: "ICD-11",
      label: "ICD 11",
      definition: "ICD-11.",
      uri: "http://id.who.int/icd/release/11/mms",
      sourcePath: "input/fsh/codesystems/KGTerminologySystem.fsh",
    },
  ],
  intervention: [
    {
      rung: "rung-3-external-standard",
      scheme: "CDHIv2",
      code: "1.1.3",
      label: "Transmit targeted alerts and reminders to person(s)",
      definition: "CDISAH v2.0 category 1.1.3 under Targeted communication to Persons.",
      uri: "http://smart.who.int/base/CodeSystem/CDHIv2#1.1.3",
      sourcePath: "input/fsh/codesystems/CDHIv2.fsh",
    },
    {
      rung: "rung-3-external-standard",
      scheme: "CDHIv2",
      code: "2.3.1",
      label: "Provide prompts and alerts based according to protocol",
      definition: "CDISAH v2.0 category 2.3.1 under Healthcare provider decision support.",
      uri: "http://smart.who.int/base/CodeSystem/CDHIv2#2.3.1",
      sourcePath: "input/fsh/codesystems/CDHIv2.fsh",
    },
    {
      rung: "rung-3-external-standard",
      scheme: "CDHIv2",
      code: "2.2.1",
      label: "Longitudinal tracking of person's health status and services",
      definition: "CDISAH v2.0 category 2.2.1 under Person-centred health records.",
      uri: "http://smart.who.int/base/CodeSystem/CDHIv2#2.2.1",
      sourcePath: "input/fsh/codesystems/CDHIv2.fsh",
    },
    {
      rung: "rung-3-external-standard",
      scheme: "CDHIv2",
      code: "3.2",
      label: "Supply chain management",
      definition: "CDISAH v2.0 category 3.2 under Health management and support personnel.",
      uri: "http://smart.who.int/base/CodeSystem/CDHIv2#3.2",
      sourcePath: "input/fsh/codesystems/CDHIv2.fsh",
    },
    {
      rung: "rung-3-external-standard",
      scheme: "KGTerminologySystem",
      code: "ICHI",
      label: "ICHI",
      definition: "International Classification of Health Interventions.",
      uri: "http://id.who.int/icd/release/11/ichi",
      sourcePath: "input/fsh/codesystems/KGTerminologySystem.fsh",
    },
  ],
  persona: [
    {
      rung: "rung-3-external-standard",
      scheme: "ISCO08",
      code: "22",
      label: "Health Professionals",
      definition:
        "Health professionals conduct research, improve or develop concepts, theories and operational methods, and apply knowledge of medicine, nursing, dentistry, pharmacy and health promotion.",
      uri: "http://www.ilo.org/public/english/bureau/stat/isco/isco08/#22",
      sourcePath: "input/fsh/codesystems/ISCO08.fsh",
    },
    {
      rung: "rung-3-external-standard",
      scheme: "ISCO08",
      code: "2211",
      label: "Generalist Medical Practitioners",
      definition: "Generalist medical practitioners diagnose, treat and prevent illness, disease, injury and other physical and mental impairments.",
      uri: "http://www.ilo.org/public/english/bureau/stat/isco/isco08/#2211",
      sourcePath: "input/fsh/codesystems/ISCO08.fsh",
    },
    {
      rung: "rung-3-external-standard",
      scheme: "ISCO08",
      code: "2221",
      label: "Nursing Professionals",
      definition: "Nursing professionals provide treatment, support and care services for people who are in need of nursing care.",
      uri: "http://www.ilo.org/public/english/bureau/stat/isco/isco08/#2221",
      sourcePath: "input/fsh/codesystems/ISCO08.fsh",
    },
    {
      rung: "rung-3-external-standard",
      scheme: "ISCO08",
      code: "3253",
      label: "Community Health Workers",
      definition: "Community health workers provide health education, referral and follow-up, case management, and basic preventive health care and home visiting services to specific communities.",
      uri: "http://www.ilo.org/public/english/bureau/stat/isco/isco08/#3253",
      sourcePath: "input/fsh/codesystems/ISCO08.fsh",
    },
  ],
  medicine: [
    {
      rung: "rung-3-external-standard",
      scheme: "ATC",
      code: "J07BD01",
      label: "measles, live attenuated",
      altLabels: ["MCV", "measles vaccine"],
      definition: "WHO ATC code J07BD01 for live attenuated measles vaccine.",
      uri: "http://www.whocc.no/atc#J07BD01",
      sourcePath: "input/fsh/codesystems/KGTerminologySystem.fsh",
    },
    {
      rung: "rung-3-external-standard",
      scheme: "KGTerminologySystem",
      code: "ATC",
      label: "ATC",
      definition: "Anatomical Therapeutic Chemical classification.",
      uri: "http://www.whocc.no/atc",
      sourcePath: "input/fsh/codesystems/KGTerminologySystem.fsh",
    },
  ],
  domain: [],
  "business-process": [],
  "recommendation-strength": [],
  "recommendation-direction": [],
  "evidence-certainty": [],
};

const normToken = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[_./:-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function scoreEntry(query: string, entry: RawEntry): MatchKind | null {
  const qRaw = query.trim().toLowerCase();
  const qNorm = normToken(query);
  if (!qNorm) return null;

  const codeRaw = entry.code.trim().toLowerCase();
  const codeNorm = normToken(entry.code);
  const labelRaw = entry.label.trim().toLowerCase();
  const labelNorm = normToken(entry.label);
  const alts = (entry.altLabels ?? []).map((a) => normToken(a));

  if (
    qRaw === codeRaw ||
    qRaw === labelRaw ||
    qNorm === codeNorm ||
    qNorm === labelNorm ||
    alts.includes(qNorm)
  ) {
    return "exactMatch";
  }

  // Strip common prefix like DAK.Persona. for exact stem check on generic personas
  const strippedCode = codeRaw.replace(/^dak\.persona\./, "");
  if (qRaw === strippedCode || qNorm === normToken(strippedCode)) {
    return "exactMatch";
  }

  const hay = `${codeNorm} ${labelNorm} ${alts.join(" ")} ${normToken(entry.definition ?? "")}`;
  const tokens = qNorm.split(" ").filter((t) => t.length >= 2);
  if (
    codeNorm.includes(qNorm) ||
    labelNorm.includes(qNorm) ||
    (tokens.length > 0 && tokens.every((t) => hay.includes(t)))
  ) {
    return "closeMatch";
  }
  return null;
}

function loadVocabularyEntries(
  vocabPath: string,
  rung: "rung-1-target-guide" | "rung-2-smart-base",
  slot: TerminologySlot,
  repoRoot: string,
): RawEntry[] {
  if (!existsSync(vocabPath)) return [];
  const parsed = VocabularySchema.parse(JSON.parse(readFileSync(vocabPath, "utf-8"))) as Vocabulary;
  const rel = relative(repoRoot, vocabPath) || vocabPath;
  const out: RawEntry[] = [];
  if (slot === "persona") {
    for (const p of parsed.personas) {
      out.push({
        rung,
        scheme: `${parsed.guide}-personas`,
        code: p.id,
        label: p.title,
        altLabels: p.iscoCode,
        definition: p.description,
        uri: `${parsed.namespace.replace(/\/$/, "")}/ActorDefinition/${p.id}`,
        sourcePath: rel,
      });
    }
  } else if (slot === "business-process") {
    for (const pr of parsed.processes ?? []) {
      out.push({
        rung,
        scheme: `${parsed.guide}-processes`,
        code: pr.id,
        label: pr.name,
        definition: pr.description,
        uri: `${parsed.namespace.replace(/\/$/, "")}/BusinessProcess/${pr.id}`,
        sourcePath: rel,
      });
    }
  }
  return out;
}

function loadCodeListEntries(repoRoot: string): RawEntry[] {
  // declared-path-literal: the convention fallback when ownDeclaredDirectories returns none
  const dirs = ownDeclaredDirectories(HERE, "code-list");
  const codeListDirs = dirs.length > 0 ? dirs : [join(HERE, "code-lists")];
  const out: RawEntry[] = [];
  for (const dir of codeListDirs) {
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir).filter((x) => x.endsWith(".json")).sort()) {
      const abs = join(dir, f);
      const raw = JSON.parse(readFileSync(abs, "utf-8")) as {
        $schema?: string;
        id?: string;
        codes?: Array<{ code: string; label: string; definition?: string }>;
      };
      if (raw.$schema !== "folio-code-list/v1" || !raw.id || !Array.isArray(raw.codes)) continue;
      const rel = relative(repoRoot, abs) || abs;
      for (const c of raw.codes) {
        out.push({
          rung: "rung-2-smart-base",
          scheme: raw.id,
          code: c.code,
          label: c.label,
          definition: c.definition,
          uri: `${stagingSite("smart-base")}code-lists/${raw.id}#${c.code}`,
          sourcePath: rel,
        });
      }
    }
  }
  return out;
}

function parseFshCodeSystem(absPath: string, repoRoot: string): RawEntry[] {
  if (!existsSync(absPath)) return [];
  const text = readFileSync(absPath, "utf-8");
  const csMatch = /^CodeSystem:\s*(\S+)/m.exec(text);
  if (!csMatch) return [];
  const scheme = csMatch[1]!;
  const urlMatch = /^\*\s*\^url\s*=\s*"([^"]+)"/m.exec(text);
  const baseUri = urlMatch?.[1] ?? `http://smart.who.int/base/CodeSystem/${scheme}`;
  const rel = relative(repoRoot, absPath) || absPath;
  const out: RawEntry[] = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const m = /^\*\s*#([^\s"]+)\s+"([^"]+)"(?:\s+"([^"]+)")?/.exec(line);
    if (!m) continue;
    const code = m[1]!;
    const label = m[2]!;
    let definition = m[3];
    if (!definition && i + 2 < lines.length) {
      const defLine = /^\s*\*\s*\^property\[=\]\.valueString\s*=\s*"([^"]+)"/.exec(lines[i + 2]!);
      if (defLine) definition = defLine[1];
    }
    out.push({
      rung: "rung-3-external-standard",
      scheme,
      code,
      label,
      definition,
      uri: `${baseUri.replace(/\/$/, "")}#${code}`,
      sourcePath: rel,
    });
  }
  return out;
}

function loadFshEntriesForSlot(slot: TerminologySlot, repoRoot: string): RawEntry[] {
  const fshRoots = [
    join(resolve(HERE, ".."), "input", "fsh", "codesystems"),
    join(repoRoot, "input", "fsh", "codesystems"),
  ];
  const fshDir = fshRoots.find((d) => existsSync(d));
  const filesBySlot: Partial<Record<TerminologySlot, string[]>> = {
    persona: ["ISCO08.fsh"],
    intervention: ["CDHIv2.fsh", "CDHIv1.fsh", "CDSCv2.fsh", "KGTerminologySystem.fsh"],
    condition: ["KGTerminologySystem.fsh"],
    medicine: ["KGTerminologySystem.fsh"],
  };
  const wanted = filesBySlot[slot] ?? [];
  const out: RawEntry[] = [];
  if (fshDir) {
    for (const f of wanted) {
      out.push(...parseFshCodeSystem(join(fshDir, f), repoRoot));
    }
  }
  // Merge builtin external fallback entries without duplicating (scheme, code)
  const seen = new Set(out.map((e) => `${e.scheme}::${e.code}`));
  for (const b of BUILTIN_EXTERNAL_TERMS[slot] ?? []) {
    if (!seen.has(`${b.scheme}::${b.code}`)) {
      out.push(b);
      seen.add(`${b.scheme}::${b.code}`);
    }
  }
  return out;
}

export function lookupTerminology(opts: LookupOptions): TerminologyLookupResult {
  const repoRoot = opts.repoRoot ?? resolve(HERE, "..");
  const { slot, query, vocabularyPath, genericPath, schemeFilter } = opts;
  if (!SLOTS.includes(slot)) {
    throw new Error(`Unknown slot "${slot}". Expected one of: ${SLOTS.join(", ")}`);
  }

  const candidates: RawEntry[] = [];

  // Rung 1: target guide vocabulary
  if (vocabularyPath) {
    candidates.push(...loadVocabularyEntries(resolve(repoRoot, vocabularyPath), "rung-1-target-guide", slot, repoRoot));
  }

  // Rung 2: smart-base generic personas, code-lists, and domain glossary
  if (slot === "persona") {
    const genPath = genericPath ? resolve(repoRoot, genericPath) : DEFAULT_GENERIC_PERSONAS;
    candidates.push(...loadVocabularyEntries(genPath, "rung-2-smart-base", "persona", repoRoot));
  }
  if (slot === "domain") {
    candidates.push(...BUILTIN_DOMAIN_TERMS);
  }
  if (
    slot === "recommendation-strength" ||
    slot === "recommendation-direction" ||
    slot === "evidence-certainty"
  ) {
    const expectedScheme = AUTHORITY_SCHEMES[slot].id;
    candidates.push(
      ...loadCodeListEntries(repoRoot).filter((e) => e.scheme === expectedScheme),
    );
  }

  // Rung 3: external standard CodeSystems (ISCO08, CDHIv2, ICD-11, ICHI, ATC)
  candidates.push(...loadFshEntriesForSlot(slot, repoRoot));

  const filtered = schemeFilter
    ? candidates.filter((c) => c.scheme.toLowerCase() === schemeFilter.toLowerCase())
    : candidates;

  const matches: TerminologyMatch[] = [];
  for (const entry of filtered) {
    const matchKind = scoreEntry(query, entry);
    if (!matchKind) continue;
    matches.push({
      rung: entry.rung,
      scheme: entry.scheme,
      code: entry.code,
      label: entry.label,
      ...(entry.definition ? { definition: entry.definition } : {}),
      matchKind,
      ...(entry.uri ? { uri: entry.uri } : {}),
      sourcePath: entry.sourcePath,
    });
  }

  const rungOrder: Record<Exclude<ReuseRung, "rung-4-local-candidate">, number> = {
    "rung-1-target-guide": 1,
    "rung-2-smart-base": 2,
    "rung-3-external-standard": 3,
  };
  const matchOrder: Record<MatchKind, number> = {
    exactMatch: 1,
    closeMatch: 2,
  };

  matches.sort((a, b) => {
    const rDiff = rungOrder[a.rung] - rungOrder[b.rung];
    if (rDiff !== 0) return rDiff;
    const mDiff = matchOrder[a.matchKind] - matchOrder[b.matchKind];
    if (mDiff !== 0) return mDiff;
    return a.code.localeCompare(b.code);
  });

  if (matches.length > 0) {
    const top = matches[0]!;
    return {
      slot,
      query,
      authorityScheme: AUTHORITY_SCHEMES[slot],
      bestMatchKind: top.matchKind,
      selectedRung: top.rung,
      matches,
    };
  }

  // Rung 4: no match in Rungs 1–3 -> candidate or could-not-determine
  if (slot === "business-process") {
    return {
      slot,
      query,
      authorityScheme: AUTHORITY_SCHEMES[slot],
      bestMatchKind: "none",
      selectedRung: "rung-4-local-candidate",
      matches: [],
      candidateToMint: {
        action: "could-not-determine",
        status: "could-not-determine",
        warning: `WARNING process-not-determined ${query}: no target guide business process realises this; domain process catalogue absent.`,
      },
    };
  }

  const candidateId = slug(query) || "candidate-term";
  return {
    slot,
    query,
    authorityScheme: AUTHORITY_SCHEMES[slot],
    bestMatchKind: "none",
    selectedRung: "rung-4-local-candidate",
    matches: [],
    candidateToMint: {
      action: "mint-glossary-candidate",
      status: "candidate",
      term: {
        id: candidateId,
        prefLabel: query,
        status: "candidate",
        source: "extracted",
      },
      warning: `WARNING ${slot}-glossary-candidate ${candidateId}: ${slot} "${query}" is a glossary candidate (status: "candidate") pending terminologist review.`,
    },
  };
}

function parseArgs(argv: readonly string[]): LookupOptions & { outPath?: string } {
  const get = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i >= 0 && i + 1 < argv.length ? argv[i + 1] : undefined;
  };
  const slot = get("--slot") as TerminologySlot | undefined;
  const query = get("--query");
  if (!slot || !SLOTS.includes(slot) || !query) {
    console.error(
      `Usage: bun run smart-base/scripts/terminology-lookup.ts --slot <${SLOTS.join("|")}> --query <query> [--vocabulary <guide.json>] [--generic <generic.json>] [--scheme <scheme>] [--out <out.json>]`,
    );
    process.exit(2);
  }
  return {
    slot,
    query,
    vocabularyPath: get("--vocabulary"),
    genericPath: get("--generic"),
    schemeFilter: get("--scheme"),
    outPath: get("--out"),
  };
}

if (import.meta.main) {
  const parsed = parseArgs(process.argv.slice(2));
  const result = lookupTerminology(parsed);
  const json = `${JSON.stringify(result, null, 2)}\n`;
  if (parsed.outPath) {
    const absOut = resolve(process.cwd(), parsed.outPath);
    mkdirSync(dirname(absOut), { recursive: true });
    writeFileSync(absOut, json, "utf-8");
  }
  process.stdout.write(json);
}
