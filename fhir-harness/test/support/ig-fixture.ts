/**
 * A non-WHO implementation guide to test fhir-harness against.
 *
 * ## Why this exists
 *
 * `ig-build-pipeline.md` §"What this layer refuses to know about" says
 * fhir-harness names no WHO IG, and `check:fhir-harness-exclusions` enforces
 * it. This layer's tests used to borrow the committed `smart-base` and
 * `smart-trust` layers as sample data, so the layer's own suite was the
 * place it knew most about WHO (#1963). The assertions are kept. Only the
 * subject changes: the IG here is shaped like HL7's International Patient
 * Summary. The checks that were really about the COMMITTED WHO pages moved to
 * `smart-base/scripts/ig-pages-committed.test.ts`, which is allowed to know
 * them.
 *
 * ## What the values are
 *
 * The package id, canonical, FHIR version and profile id are IPS's real
 * public identifiers (`hl7.fhir.uv.ips`, `http://hl7.org/fhir/uv/ips`, R4,
 * `Composition-uv-ips`). Nothing else is a transcription: the version, the
 * build time and the artefact list were made up for the test, and so is the
 * "Example Template" chrome. Do not read any of it as a statement about the
 * published IPS.
 *
 * @module fhir-harness/test/support/ig-fixture
 */
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { IG_CHROME_SCHEMA_TAG, type IgChrome } from "../../schemas/ig-chrome";

export const IPS = {
  packageId: "hl7.fhir.uv.ips",
  canonical: "http://hl7.org/fhir/uv/ips",
  version: "2.0.0",
  fhirVersion: ["4.0.1"],
  published: "https://hl7.org/fhir/uv/ips",
} as const;

/** A second, unrelated IG: the one whose banner must not borrow IPS's identity. */
export const IPA = {
  packageId: "hl7.fhir.uv.ipa",
  canonical: "http://hl7.org/fhir/uv/ipa",
  version: "1.0.0",
  fhirVersion: ["4.0.1"],
  published: "https://hl7.org/fhir/uv/ipa",
} as const;

type Ig = typeof IPS | typeof IPA;

/** A `folio-fhir-artifact-index/v2` with one referenced profile. */
/** `status` is the IG's own ImplementationGuide status, as the index records it; `active` is what makes a watermark class appear. */
export function artifactIndex(ig: Ig, id: string, status?: string): Record<string, unknown> {
  const page = `${ig.published}/StructureDefinition-Composition-uv-ips`;
  return {
    $schema: "folio-fhir-artifact-index/v2",
    id,
    title: `${ig.packageId} — artefact index`,
    packageId: ig.packageId,
    version: ig.version,
    ...(status ? { status } : {}),
    fhirVersion: [...ig.fhirVersion],
    canonicalBase: ig.canonical,
    builtAt: "20260101000000",
    source: { kind: "gh-pages", of: ig.published, readAt: "2026-10-03" },
    provenance: {
      packageManifest: "package.manifest.json",
      canonicals: "canonicals.json",
      packageIndex: "package.tgz!package/.index.json",
      artifactsHtml: "artifacts.html",
    },
    sidecarApi: "absent",
    count: 1,
    artifacts: [
      {
        key: "StructureDefinition/Composition-uv-ips",
        resourceType: "StructureDefinition",
        id: "Composition-uv-ips",
        published: { json: { url: `${page}.json` }, html: { url: `${page}.html` } },
        materialization: { state: "referenced", provenance: { upstream: `${page}.html` } },
        canonical: `${ig.canonical}/StructureDefinition/Composition-uv-ips`,
        version: ig.version,
        name: "CompositionUvIps",
        category: "Structures: Resource Profiles",
        title: "Composition (IPS)",
        description: "A fixture profile.",
      },
    ],
  };
}

/** A template chrome naming no publisher, with the one token the banner reads. */
export const NEUTRAL_CHROME: IgChrome = {
  $schema: IG_CHROME_SCHEMA_TAG,
  id: "example.template",
  version: "0.1.0",
  layers: [
    {
      package: "fhir.base.template",
      version: "1.0.0",
      of: "https://github.com/HL7/ig-template-base",
      ref: "0000000000000000000000000000000000000000",
      path: "content/assets/css/project.css",
      readAt: "2026-10-03",
    },
  ],
  tokens: [{ name: "--navbar-bg-color", value: "#205081", from: "fhir.base.template", overrides: [] }],
  rules: [],
  conflicts: [],
};

export interface ScratchInstance {
  /** The layer root: its basename is the layer name. */
  dir: string;
  index: Record<string, unknown>;
}

/**
 * A scratch repository holding the named IG layers and one chrome owner
 * named `chrome-owner`, each a direct child of the repository root, as
 * `repoRootFor` requires. Returns the root; the caller removes it.
 */
export function scratchRepo(instances: Record<string, Omit<ScratchInstance, "dir">>): string {
  // input-site: inert #262fa049 — a scratch repository under the temp dir, removed by the caller; its name never reaches an answer
  const root = mkdtempSync(join(tmpdir(), "fhir-harness-ig-"));
  for (const [name, inst] of Object.entries(instances)) {
    const ix = join(root, name, "fhir-artifact-index");
    mkdirSync(ix, { recursive: true });
    // Declared, because the index is found through the declaration's
    // `fhir-artifact-index` graph rather than at a composed path.
    writeFileSync(
      join(root, name, `${name}.json`),
      JSON.stringify({
        name,
        version: "0.0.0",
        description: `Scratch IG instance ${name} for fhir-harness tests.`,
        directories: [{ id: `${name}-index`, path: "fhir-artifact-index/", graphTypologies: ["fhir-artifact-index"] }],
      }),
    );
    writeFileSync(join(ix, "index.json"), JSON.stringify(inst.index, null, 2));
  }
  const owner = join(root, "chrome-owner");
  mkdirSync(join(owner, "themes"), { recursive: true });
  writeFileSync(
    join(owner, "chrome-owner.json"),
    JSON.stringify({
      name: "chrome-owner",
      version: "0.0.0",
      description: "Scratch chrome owner for fhir-harness tests.",
      directories: [{ id: "themes", path: "themes/", graphTypologies: ["themes"] }],
    }),
  );
  writeFileSync(join(owner, "themes", "chrome.json"), JSON.stringify(NEUTRAL_CHROME, null, 2));
  return root;
}
