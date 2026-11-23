#!/usr/bin/env bun
/**
 * Verify a Data Sharing Agreement (DSA building block B3, bean `folio-assistant-2z1t`):
 *
 *   1. **Existing specifications only (owner, 2026-10-30):** every property in
 *      the ODRL 2.2 `Agreement` and DCAT 3 record belongs to W3C ODRL 2.2,
 *      W3C DCAT 3 (including its normative `spdx:checksum` in §6.8.12 and
 *      `adms:status` in §6.4.30), DCMI Metadata Terms (`dcterms:*`), or
 *      JSON-LD keywords (`@context`, `@id`, `@type`, `@graph`, `@value`,
 *      `@language`). Any invented or custom property is refused.
 *   2. **Citation integrity (`dcterms:source`):** the ODRL 2.2 `Agreement`'s
 *      `dcterms:source` names a `dcat:Distribution` present in the DCAT 3
 *      record (`@id` or `dcat:downloadURL`), and that same distribution is the
 *      one whose `spdx:checksum` is checked against the legal text bytes.
 *   3. **Cryptographic fixity (`spdx:checksum`):** the SHA-256 digest of the
 *      legal text bytes equals the `spdx:checksumValue` recorded on that
 *      distribution (with algorithm `spdx:checksumAlgorithm_sha256`). A
 *      one-byte change to the legal text fails verification.
 *   4. **Versioning:** each version in a multi-version DSA directory carries a
 *      distinct `dcat:version`, distinct immutable distribution URL, and
 *      distinct SHA-256 checksum, and links to the prior version via DCAT 3
 *      `dcat:previousVersion`.
 *
 * @module folio-assistant-core/scripts/check-dsa-hash
 * @covers dsa
 */
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

export const ODRL_NS = "http://www.w3.org/ns/odrl/2/" as const;
export const DCAT_NS = "http://www.w3.org/ns/dcat#" as const;
export const DCTERMS_NS = "http://purl.org/dc/terms/" as const;
export const SPDX_NS = "http://spdx.org/rdf/terms#" as const;
export const ADMS_NS = "http://www.w3.org/ns/adms#" as const;

export const ALLOWED_CONTEXT_IRIs: ReadonlySet<string> = new Set([
  "http://www.w3.org/ns/odrl.jsonld",
  "https://www.w3.org/ns/odrl.jsonld",
  ODRL_NS,
  DCAT_NS,
  DCTERMS_NS,
  SPDX_NS,
  ADMS_NS,
]);

export const JSONLD_KEYWORDS: ReadonlySet<string> = new Set([
  "@context",
  "@id",
  "@type",
  "@graph",
  "@value",
  "@language",
]);

export interface PinnedContextEntry {
  file: string;
  specification: string;
  sourceUrl: string;
  sha256: string;
  bytes: number;
  retrievedAt: string;
}

export const OFFICIAL_CONTEXTS_DIR = join(import.meta.dir, "test-fixtures", "dsa-contexts");

/**
 * Load and SHA-256-verify the vendored official W3C ODRL 2.2, W3C DCAT 3,
 * SPDX 2.2.2, and DCMI Metadata Terms context/vocabulary files, and extract
 * their defined terms. Never falls back to a hand-written list.
 */
export function loadPinnedContexts(contextsDir: string = OFFICIAL_CONTEXTS_DIR): {
  odrl22Terms: Set<string>;
  dcat3Terms: Set<string>;
  dctermsTerms: Set<string>;
  provenance: PinnedContextEntry[];
} {
  const provPath = join(contextsDir, "provenance.json");
  if (!existsSync(provPath)) {
    throw new Error(`Missing official context provenance manifest at ${provPath}`);
  }
  const provDoc = JSON.parse(readFileSync(provPath, "utf-8")) as {
    contexts?: PinnedContextEntry[];
  };
  if (!Array.isArray(provDoc.contexts) || provDoc.contexts.length === 0) {
    throw new Error(`Invalid official context provenance manifest at ${provPath}`);
  }

  const rawByFile = new Map<string, Buffer>();
  for (const entry of provDoc.contexts) {
    const filePath = join(contextsDir, entry.file);
    if (!existsSync(filePath)) {
      throw new Error(`Missing pinned official context file ${entry.file} (${entry.sourceUrl})`);
    }
    const bytes = readFileSync(filePath);
    const actualSha = createHash("sha256").update(bytes).digest("hex");
    if (actualSha !== entry.sha256) {
      throw new Error(
        `SHA-256 mismatch for official context ${entry.file} (${entry.sourceUrl}): expected ${entry.sha256}, got ${actualSha}`,
      );
    }
    rawByFile.set(entry.file, bytes);
  }

  const readJson = (file: string): Record<string, unknown> => {
    const buf = rawByFile.get(file);
    if (!buf) throw new Error(`Pinned context ${file} is not listed in provenance.json`);
    return JSON.parse(buf.toString("utf-8")) as Record<string, unknown>;
  };

  // 1. W3C ODRL 2.2 official JSON-LD context (https://www.w3.org/ns/odrl.jsonld)
  const odrlDoc = readJson("odrl-2.2.context.json");
  const odrlCtx = odrlDoc["@context"];
  if (!odrlCtx || typeof odrlCtx !== "object" || Array.isArray(odrlCtx)) {
    throw new Error("odrl-2.2.context.json is missing a JSON-LD @context object");
  }
  const odrl22Terms = new Set<string>();
  for (const [key, val] of Object.entries(odrlCtx as Record<string, unknown>)) {
    if (key.startsWith("@")) continue;
    if (typeof val === "string" && (val.endsWith("/") || val.endsWith("#"))) continue;
    odrl22Terms.add(key);
    odrl22Terms.add(`odrl:${key}`);
    if (val && typeof val === "object" && !Array.isArray(val)) {
      const mappedId = (val as Record<string, unknown>)["@id"];
      if (typeof mappedId === "string" && mappedId.startsWith("odrl:")) {
        odrl22Terms.add(mappedId);
        odrl22Terms.add(mappedId.slice("odrl:".length));
      }
    }
  }

  // 2. W3C DCAT 3 vocabulary & context (https://www.w3.org/ns/dcat3.jsonld),
  //    DCAT 3 external alignments (https://www.w3.org/ns/dcat3-external.jsonld),
  //    and SPDX 2.2.2 ontology context (referenced by DCAT 3 §6.8.12).
  const dcat3Terms = new Set<string>();
  const dcatDoc = readJson("dcat-3.vocab.json");
  const dcatGraph = Array.isArray(dcatDoc["@graph"]) ? dcatDoc["@graph"] : [];
  for (const node of dcatGraph) {
    if (node && typeof node === "object") {
      const id = (node as Record<string, unknown>)["@id"];
      if (typeof id === "string" && /^dcat:[A-Za-z0-9_]+$/.test(id)) {
        dcat3Terms.add(id);
      }
    }
  }

  const dcatExtDoc = readJson("dcat-3-external.vocab.json");
  const dcatExtGraph = Array.isArray(dcatExtDoc["@graph"]) ? dcatExtDoc["@graph"] : [];
  for (const node of dcatExtGraph) {
    if (node && typeof node === "object") {
      const id = (node as Record<string, unknown>)["@id"];
      if (typeof id === "string" && /^(adms|spdx):[A-Za-z0-9_]+$/.test(id)) {
        dcat3Terms.add(id);
      }
    }
  }

  const spdxDoc = readJson("spdx-ontology.context.json");
  const spdxCtx = spdxDoc["@context"];
  if (!spdxCtx || typeof spdxCtx !== "object" || Array.isArray(spdxCtx)) {
    throw new Error("spdx-ontology.context.json is missing a JSON-LD @context object");
  }
  for (const [key, val] of Object.entries(spdxCtx as Record<string, unknown>)) {
    if (key.startsWith("@")) continue;
    const targetIri =
      typeof val === "string"
        ? val
        : val && typeof val === "object" && !Array.isArray(val)
          ? ((val as Record<string, unknown>)["@id"] as string | undefined)
          : undefined;
    if (typeof targetIri === "string") {
      if (targetIri.startsWith("spdx:") && /^spdx:[A-Za-z0-9_]+$/.test(targetIri)) {
        dcat3Terms.add(targetIri);
      } else if (targetIri.startsWith(SPDX_NS) && targetIri.length > SPDX_NS.length) {
        const local = targetIri.slice(SPDX_NS.length);
        if (/^[A-Za-z0-9_]+$/.test(local)) {
          dcat3Terms.add(`spdx:${local}`);
        }
      }
    }
  }

  // 3. DCMI Metadata Terms Turtle vocabulary (http://purl.org/dc/terms/)
  const dctermsBuf = rawByFile.get("dublin_core_terms.ttl");
  if (!dctermsBuf) {
    throw new Error("Pinned context dublin_core_terms.ttl is not listed in provenance.json");
  }
  const dctermsTtl = dctermsBuf.toString("utf-8");
  const dctermsTerms = new Set<string>();
  for (const match of dctermsTtl.matchAll(/^dcterms:([A-Za-z0-9_]+)\b/gm)) {
    dctermsTerms.add(`dcterms:${match[1]}`);
  }

  return {
    odrl22Terms,
    dcat3Terms,
    dctermsTerms,
    provenance: provDoc.contexts,
  };
}

const LOADED_OFFICIAL_CONTEXTS = loadPinnedContexts();

/** W3C ODRL 2.2 terms parsed from the pinned official `https://www.w3.org/ns/odrl.jsonld` context. */
export const ODRL_22_TERMS: ReadonlySet<string> = LOADED_OFFICIAL_CONTEXTS.odrl22Terms;

/**
 * W3C DCAT 3 terms parsed from the pinned official `https://www.w3.org/ns/dcat3.jsonld`,
 * `https://www.w3.org/ns/dcat3-external.jsonld`, and SPDX 2.2.2 ontology context files.
 */
export const DCAT_3_TERMS: ReadonlySet<string> = LOADED_OFFICIAL_CONTEXTS.dcat3Terms;

/** DCMI Metadata Terms (`dcterms:*`) parsed from the pinned official DCMI Turtle vocabulary. */
export const DCTERMS_TERMS: ReadonlySet<string> = LOADED_OFFICIAL_CONTEXTS.dctermsTerms;

/** Provenance and SHA-256 pins of the official context/vocabulary files. */
export const OFFICIAL_CONTEXT_PROVENANCE: readonly PinnedContextEntry[] = LOADED_OFFICIAL_CONTEXTS.provenance;

export const ALLOWED_DSA_TERMS: ReadonlySet<string> = new Set([
  ...JSONLD_KEYWORDS,
  ...ODRL_22_TERMS,
  ...DCAT_3_TERMS,
  ...DCTERMS_TERMS,
]);

const ALLOWED_CONTEXT_PREFIXES: ReadonlyRecord<string, string> = {
  odrl: ODRL_NS,
  dcat: DCAT_NS,
  dcterms: DCTERMS_NS,
  spdx: SPDX_NS,
  adms: ADMS_NS,
};
type ReadonlyRecord<K extends string, V> = Readonly<Record<K, V>>;

const SHA256_ALGORITHM_IDS: ReadonlySet<string> = new Set([
  "spdx:checksumAlgorithm_sha256",
  `${SPDX_NS}checksumAlgorithm_sha256`,
]);

export interface DsaVersionCheckInput {
  /** Raw bytes or UTF-8 string of the legal text file. */
  legalText: Buffer | Uint8Array | string;
  /** Parsed DCAT 3 JSON-LD object (`dcat:Resource` with `dcat:distribution`). */
  dcat: unknown;
  /** Parsed ODRL 2.2 `Agreement` JSON-LD object (citing the distribution via `dcterms:source`). */
  agreement: unknown;
}

export interface DsaVersionCheckResult {
  ok: boolean;
  errors: string[];
  resourceId?: string;
  version?: string;
  previousVersion?: string;
  distributionId?: string;
  downloadURL?: string;
  computedSha256?: string;
  recordedSha256?: string;
}

export interface DsaDirectoryCheckResult {
  ok: boolean;
  errors: string[];
  versions: Record<string, DsaVersionCheckResult>;
}

/** Compute lowercase hex SHA-256 of legal text bytes. */
export function computeSha256Hex(content: Buffer | Uint8Array | string): string {
  const buf = typeof content === "string" ? Buffer.from(content, "utf-8") : Buffer.from(content);
  return createHash("sha256").update(buf).digest("hex");
}

function extractIri(val: unknown): string | undefined {
  if (typeof val === "string" && val.trim().length > 0) return val.trim();
  if (val !== null && typeof val === "object" && !Array.isArray(val)) {
    const id = (val as Record<string, unknown>)["@id"];
    if (typeof id === "string" && id.trim().length > 0) return id.trim();
  }
  return undefined;
}

function validateContext(ctx: unknown, docLabel: string, errors: string[]): void {
  if (ctx === undefined) {
    errors.push(`${docLabel}: missing @context`);
    return;
  }
  const items = Array.isArray(ctx) ? ctx : [ctx];
  for (const item of items) {
    if (typeof item === "string") {
      if (!ALLOWED_CONTEXT_IRIs.has(item)) {
        errors.push(`${docLabel}: @context IRI "${item}" is outside ODRL 2.2, DCAT 3 and DCMI Terms`);
      }
    } else if (item !== null && typeof item === "object" && !Array.isArray(item)) {
      for (const [prefix, iri] of Object.entries(item as Record<string, unknown>)) {
        if (prefix === "@vocab") {
          if (typeof iri !== "string" || !ALLOWED_CONTEXT_IRIs.has(iri)) {
            errors.push(`${docLabel}: @context @vocab "${String(iri)}" is outside ODRL 2.2, DCAT 3 and DCMI Terms`);
          }
          continue;
        }
        const expected = ALLOWED_CONTEXT_PREFIXES[prefix];
        if (!expected || iri !== expected) {
          errors.push(
            `${docLabel}: @context prefix "${prefix}" -> "${String(iri)}" is not an allowed ODRL 2.2, DCAT 3 or DCMI Terms namespace`,
          );
        }
      }
    } else {
      errors.push(`${docLabel}: invalid @context entry`);
    }
  }
}

/**
 * Recursively verify that every property key in `node` belongs to ODRL 2.2,
 * DCAT 3 (including SPDX checksum and ADMS status), DCMI Terms, or JSON-LD.
 */
export function validateExistingSpecsVocabulary(
  node: unknown,
  docLabel: string,
  errors: string[],
  path = docLabel,
): void {
  if (node === null || typeof node !== "object") return;
  if (Array.isArray(node)) {
    node.forEach((item, idx) => validateExistingSpecsVocabulary(item, docLabel, errors, `${path}[${idx}]`));
    return;
  }
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    if (key === "@context") {
      validateContext(value, docLabel, errors);
      continue;
    }
    if (!ALLOWED_DSA_TERMS.has(key)) {
      errors.push(`${path}: property "${key}" is not defined in ODRL 2.2, DCAT 3 or DCMI Terms`);
      continue;
    }
    validateExistingSpecsVocabulary(value, docLabel, errors, `${path}.${key}`);
  }
}

/**
 * Verify one DSA version: vocabulary conformance, ODRL `Agreement` -> DCAT
 * `dcat:Distribution` citation via `dcterms:source`, and SHA-256 fixity of the
 * legal text against `spdx:checksum`.
 */
export function verifyDsaVersion(input: DsaVersionCheckInput): DsaVersionCheckResult {
  const errors: string[] = [];

  if (input.dcat === null || typeof input.dcat !== "object" || Array.isArray(input.dcat)) {
    return { ok: false, errors: ["DCAT 3 record must be a JSON-LD object"] };
  }
  if (input.agreement === null || typeof input.agreement !== "object" || Array.isArray(input.agreement)) {
    return { ok: false, errors: ["ODRL 2.2 Agreement must be a JSON-LD object"] };
  }

  validateExistingSpecsVocabulary(input.dcat, "dcat", errors);
  validateExistingSpecsVocabulary(input.agreement, "agreement", errors);

  const dcatObj = input.dcat as Record<string, unknown>;
  const odrlObj = input.agreement as Record<string, unknown>;

  // 1. Validate ODRL 2.2 Agreement header and dcterms:source
  const odrlType = odrlObj["@type"];
  if (odrlType !== "Agreement" && odrlType !== "odrl:Agreement") {
    errors.push(`agreement: @type must be "Agreement" or "odrl:Agreement" (got ${JSON.stringify(odrlType)})`);
  }
  const assigner = extractIri(odrlObj["assigner"] ?? odrlObj["odrl:assigner"]);
  const assignee = extractIri(odrlObj["assignee"] ?? odrlObj["odrl:assignee"]);
  if (!assigner) errors.push("agreement: ODRL 2.2 Agreement requires assigner");
  if (!assignee) errors.push("agreement: ODRL 2.2 Agreement requires assignee");

  const dctermsSource = extractIri(odrlObj["dcterms:source"]);
  if (!dctermsSource) {
    errors.push("agreement: ODRL 2.2 Agreement must cite the legal text distribution via dcterms:source");
  }

  // 2. Validate DCAT 3 Resource and find the distribution named by dcterms:source
  const dcatType = dcatObj["@type"];
  if (dcatType !== "dcat:Resource" && dcatType !== "dcat:Dataset") {
    errors.push(`dcat: @type must be "dcat:Resource" or "dcat:Dataset" (got ${JSON.stringify(dcatType)})`);
  }
  const resourceId = extractIri(dcatObj["@id"]);
  if (!resourceId) {
    errors.push("dcat: dcat:Resource requires @id");
  }
  const version = typeof dcatObj["dcat:version"] === "string" ? dcatObj["dcat:version"] : undefined;
  if (!version) {
    errors.push("dcat: dcat:Resource requires dcat:version");
  }
  const previousVersion = extractIri(dcatObj["dcat:previousVersion"]);

  // Consent rule 2 (dsa-document-lifecycle.bpmn P2.1, P2.3): the ODRL policy
  // uid is the version's fixed-version URL, the dcat:Resource @id, which is
  // the URL a Consent cites; the record's odrl:hasPolicy names that policy.
  const policyUid = extractIri(odrlObj["uid"] ?? odrlObj["odrl:uid"]);
  if (!policyUid) {
    errors.push("agreement: ODRL 2.2 Agreement requires uid");
  } else if (resourceId && policyUid !== resourceId) {
    errors.push(`agreement: uid must be the version's fixed-version URL, the dcat:Resource @id ("${resourceId}"), got "${policyUid}"`);
  }
  const hasPolicy = extractIri(dcatObj["odrl:hasPolicy"]);
  if (hasPolicy !== undefined && policyUid && hasPolicy !== policyUid) {
    errors.push(`dcat: odrl:hasPolicy must name the Agreement's uid ("${policyUid}"), got "${hasPolicy}"`);
  }

  const rawDistributions = dcatObj["dcat:distribution"];
  const distributions = Array.isArray(rawDistributions)
    ? rawDistributions
    : rawDistributions !== undefined
      ? [rawDistributions]
      : [];
  if (distributions.length === 0) {
    errors.push("dcat: dcat:Resource must declare at least one dcat:Distribution in dcat:distribution");
  }

  // Find the distribution whose spdx:checksum is checked, and ensure the
  // Agreement's dcterms:source names that exact distribution.
  let matchedDist: Record<string, unknown> | undefined;
  for (const d of distributions) {
    if (d === null || typeof d !== "object" || Array.isArray(d)) continue;
    const distObj = d as Record<string, unknown>;
    const distId = extractIri(distObj["@id"]);
    const downloadUrl = extractIri(distObj["dcat:downloadURL"]);
    if (dctermsSource && (distId === dctermsSource || downloadUrl === dctermsSource)) {
      matchedDist = distObj;
      break;
    }
  }

  if (dctermsSource && !matchedDist) {
    errors.push(
      `agreement.dcterms:source ("${dctermsSource}") does not match any dcat:Distribution @id or dcat:downloadURL in the DCAT 3 record`,
    );
  }

  const targetDist =
    matchedDist ??
    (distributions.length === 1 && distributions[0] !== null && typeof distributions[0] === "object"
      ? (distributions[0] as Record<string, unknown>)
      : undefined);

  let distributionId: string | undefined;
  let downloadURL: string | undefined;
  let recordedSha256: string | undefined;
  const computedSha256 = computeSha256Hex(input.legalText);

  if (targetDist) {
    if (targetDist["@type"] !== "dcat:Distribution") {
      errors.push(
        `dcat.dcat:distribution: @type must be "dcat:Distribution" (got ${JSON.stringify(targetDist["@type"])})`,
      );
    }
    distributionId = extractIri(targetDist["@id"]);
    downloadURL = extractIri(targetDist["dcat:downloadURL"]);
    if (!downloadURL) {
      errors.push("dcat.dcat:distribution: missing dcat:downloadURL");
    }

    const checksum = targetDist["spdx:checksum"];
    if (checksum === null || typeof checksum !== "object" || Array.isArray(checksum)) {
      errors.push("dcat.dcat:distribution: missing spdx:checksum object");
    } else {
      const csObj = checksum as Record<string, unknown>;
      if (csObj["@type"] !== "spdx:Checksum") {
        errors.push(`spdx:checksum: @type must be "spdx:Checksum" (got ${JSON.stringify(csObj["@type"])})`);
      }
      const alg = extractIri(csObj["spdx:algorithm"]);
      if (!alg || !SHA256_ALGORITHM_IDS.has(alg)) {
        errors.push(
          `spdx:checksum: spdx:algorithm must be spdx:checksumAlgorithm_sha256 (got ${JSON.stringify(csObj["spdx:algorithm"])})`,
        );
      }
      const val = csObj["spdx:checksumValue"];
      if (typeof val !== "string" || !/^[0-9a-f]{64}$/.test(val)) {
        errors.push(`spdx:checksum: spdx:checksumValue must be a 64-character lowercase hex SHA-256 digest`);
      } else {
        recordedSha256 = val;
        if (computedSha256 !== recordedSha256) {
          errors.push(
            `SHA-256 mismatch on legal text distribution "${downloadURL ?? distributionId ?? "unknown"}": computed ${computedSha256}, spdx:checksumValue is ${recordedSha256}`,
          );
        }
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    resourceId,
    version,
    previousVersion,
    distributionId,
    downloadURL,
    computedSha256,
    recordedSha256,
  };
}

/**
 * Verify a versioned DSA directory containing version subdirectories (e.g. `v1/`, `v2/`),
 * or a single version directory holding `agreement.md`, `dcat.jsonld` and `agreement.jsonld`.
 */
export function verifyDsaDirectory(dir: string): DsaDirectoryCheckResult {
  const abs = resolve(dir);
  if (!existsSync(abs)) {
    return { ok: false, errors: [`DSA directory does not exist: ${abs}`], versions: {} };
  }

  const hasDirectFiles =
    existsSync(join(abs, "agreement.md")) &&
    existsSync(join(abs, "dcat.jsonld")) &&
    existsSync(join(abs, "agreement.jsonld"));

  const versionDirs = hasDirectFiles
    ? [{ name: ".", path: abs }]
    : readdirSync(abs)
        .sort()
        .map((name) => ({ name, path: join(abs, name) }))
        .filter((entry) => {
          try {
            return statSync(entry.path).isDirectory();
          } catch {
            return false;
          }
        });

  if (versionDirs.length === 0) {
    return { ok: false, errors: [`No DSA version directories found in ${abs}`], versions: {} };
  }

  const versions: Record<string, DsaVersionCheckResult> = {};
  const errors: string[] = [];
  const seenHashes = new Map<string, string>();
  const seenDownloadUrls = new Map<string, string>();
  const seenVersions = new Map<string, string>();
  let priorResourceId: string | undefined;
  let priorVersionName: string | undefined;

  for (const v of versionDirs) {
    const mdPath = join(v.path, "agreement.md");
    const dcatPath = join(v.path, "dcat.jsonld");
    const odrlPath = join(v.path, "agreement.jsonld");
    if (!existsSync(mdPath) || !existsSync(dcatPath) || !existsSync(odrlPath)) {
      errors.push(`${v.name}: missing agreement.md, dcat.jsonld, or agreement.jsonld`);
      continue;
    }
    const legalText = readFileSync(mdPath);
    const dcat = JSON.parse(readFileSync(dcatPath, "utf-8")) as unknown;
    const agreement = JSON.parse(readFileSync(odrlPath, "utf-8")) as unknown;

    const res = verifyDsaVersion({ legalText, dcat, agreement });
    versions[v.name] = res;
    for (const err of res.errors) {
      errors.push(`${v.name}: ${err}`);
    }

    if (res.computedSha256) {
      const prevHashOwner = seenHashes.get(res.computedSha256);
      if (prevHashOwner) {
        errors.push(
          `${v.name}: versioned DSA must get a new hash when amended, but ${v.name} has the same SHA-256 (${res.computedSha256}) as ${prevHashOwner}`,
        );
      } else {
        seenHashes.set(res.computedSha256, v.name);
      }
    }

    if (res.downloadURL) {
      const prevUrlOwner = seenDownloadUrls.get(res.downloadURL);
      if (prevUrlOwner) {
        errors.push(
          `${v.name}: each DSA version requires its own immutable dcat:downloadURL, but ${v.name} reuses "${res.downloadURL}" from ${prevUrlOwner}`,
        );
      } else {
        seenDownloadUrls.set(res.downloadURL, v.name);
      }
    }

    if (res.version) {
      const prevVerOwner = seenVersions.get(res.version);
      if (prevVerOwner) {
        errors.push(`${v.name}: duplicate dcat:version "${res.version}" (already used by ${prevVerOwner})`);
      } else {
        seenVersions.set(res.version, v.name);
      }
    }

    if (priorResourceId !== undefined) {
      if (res.previousVersion !== priorResourceId) {
        errors.push(
          `${v.name}: dcat:previousVersion must link to prior version ${priorVersionName} ("${priorResourceId}"), got ${JSON.stringify(res.previousVersion)}`,
        );
      }
    }
    priorResourceId = res.resourceId;
    priorVersionName = v.name;
  }

  return {
    ok: errors.length === 0,
    errors,
    versions,
  };
}

export const DEFAULT_DSA_FIXTURE_DIR = join(import.meta.dir, "test-fixtures", "dsa");

if (import.meta.main) {
  const targetDir = process.argv[2] ? resolve(process.argv[2]) : DEFAULT_DSA_FIXTURE_DIR;
  const result = verifyDsaDirectory(targetDir);
  if (!result.ok) {
    for (const err of result.errors) {
      console.error(`✗ ${err}`);
    }
    process.exit(1);
  }
  const versionNames = Object.keys(result.versions);
  for (const name of versionNames) {
    const v = result.versions[name]!;
    console.log(`✓ ${name} (dcat:version ${v.version}): ${v.downloadURL} sha256=${v.computedSha256}`);
  }
}
