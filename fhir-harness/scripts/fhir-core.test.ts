import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

import { FhirCoreClassModelKind, FhirCorePinsKind, FhirCoreReleaseKind, FhirCoreReleaseSchema, isCoreDefinition } from "../schemas/fhir-core.ts";
import { sha512Integrity } from "./fhir-cache-seed-npm.ts";
import {
  checkCore,
  indexReleases,
  LAYER_ROOT,
  materialiseReleases,
  mermaidDiagram,
  readClassModel,
  readManifest,
  resolveCanonical,
  sha1Hex,
  tgzFiles,
  umlReleases,
} from "./fhir-core.ts";

const BASE = "http://hl7.org/fhir/StructureDefinition/";
const HL7_R4 = "https://hl7.org/fhir/R4/hl7.fhir.r4.core.tgz";
const MIRROR_R4 = "https://packages.fhir.org/hl7.fhir.r4.core/4.0.1";

function tarEntry(name: string, body: Buffer): Buffer {
  const h = Buffer.alloc(512);
  h.write(name, 0, "utf8");
  h.write("0000644\0", 100);
  h.write("0000000\0", 108);
  h.write("0000000\0", 116);
  h.write(`${body.length.toString(8).padStart(11, "0")}\0`, 124);
  h.write("00000000000\0", 136);
  h.write("        ", 148);
  h.write("0", 156);
  h.write("ustar\0", 257);
  h.write("00", 263);
  let sum = 0;
  for (const b of h) sum += b;
  h.write(`${sum.toString(8).padStart(6, "0")}\0 `, 148);
  return Buffer.concat([h, body, Buffer.alloc(Math.ceil(body.length / 512) * 512 - body.length)]);
}

function sd(id: string, kind: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { resourceType: "StructureDefinition", id, url: BASE + id, name: id, version: "4.0.1", kind, type: id, abstract: false, differential: { element: [{ id, path: id }] }, ...extra };
}

const el = (id: string, min: number, max: string, extra: Record<string, unknown> = {}) => ({ id, path: id, min, max, ...extra });

/** A tiny hl7.fhir.r4.core: two root types, their specialisations, a datatype, a resource with backbones, a profile, an extension and a logical model. */
function corePackage(marker = ""): Buffer {
  const patient = sd("Patient", "resource", {
    derivation: "specialization",
    baseDefinition: `${BASE}DomainResource`,
    differential: {
      element: [
        el("Patient", 0, "*"),
        el("Patient.active", 0, "1", { type: [{ code: "boolean" }], isModifier: true, isSummary: true }),
        el("Patient.contact", 0, "*", { type: [{ code: "BackboneElement" }] }),
        el("Patient.contact.name", 0, "1", { type: [{ code: "HumanName" }] }),
        el("Patient.contact.organization", 0, "1", { type: [{ code: "Reference", targetProfile: [`${BASE}Organization`] }] }),
        el("Patient.contact.contact", 0, "*", { contentReference: "#Patient.contact" }),
      ],
    },
  });
  const files: [string, unknown][] = [
    ["package/package.json", { name: "hl7.fhir.r4.core", version: "4.0.1", marker }],
    ["package/StructureDefinition-Element.json", sd("Element", "complex-type", { abstract: true })],
    ["package/StructureDefinition-Resource.json", sd("Resource", "resource", { abstract: true })],
    ["package/StructureDefinition-DomainResource.json", sd("DomainResource", "resource", { abstract: true, derivation: "specialization", baseDefinition: `${BASE}Resource` })],
    ["package/StructureDefinition-BackboneElement.json", sd("BackboneElement", "complex-type", { abstract: true, derivation: "specialization", baseDefinition: `${BASE}Element` })],
    [
      "package/StructureDefinition-Coding.json",
      sd("Coding", "complex-type", {
        derivation: "specialization",
        baseDefinition: `${BASE}Element`,
        differential: { element: [el("Coding", 0, "*"), el("Coding.code", 0, "1", { type: [{ code: "code" }] }), el("Coding.extension", 0, "0")] },
      }),
    ],
    ["package/StructureDefinition-Patient.json", patient],
    ["package/StructureDefinition-vitalsigns.json", sd("vitalsigns", "resource", { type: "Observation", derivation: "constraint", baseDefinition: `${BASE}Observation` })],
    ["package/StructureDefinition-patient-birthTime.json", sd("patient-birthTime", "complex-type", { type: "Extension", derivation: "constraint" })],
    ["package/StructureDefinition-Definition.json", sd("Definition", "logical")],
    ["package/ValueSet-x.json", { resourceType: "ValueSet", id: "x" }],
  ];
  return gzipSync(Buffer.concat([...files.map(([n, j]) => tarEntry(n, Buffer.from(JSON.stringify(j)))), Buffer.alloc(1024)]));
}

function writePins(root: string, tgz: Buffer, mirror?: Buffer): void {
  mkdirSync(join(root, "fhir-core"), { recursive: true });
  writeFileSync(
    join(root, "fhir-core", "pins.json"),
    JSON.stringify({
      $schema: "folio-fhir-core-pins/v2",
      authority: "https://hl7.org/fhir",
      note: "test",
      releases: [
        {
          release: "R4",
          fhirVersion: "4.0.1",
          spec: "https://hl7.org/fhir/R4/",
          package: { name: "hl7.fhir.r4.core", version: "4.0.1", tarball: HL7_R4, shasum: sha1Hex(tgz), integrity: sha512Integrity(tgz) },
          ...(mirror ? { mirrors: [{ tarball: MIRROR_R4, shasum: sha1Hex(mirror), integrity: sha512Integrity(mirror), note: "a repacked copy" }] } : {}),
        },
      ],
    }),
  );
}

const quiet = () => {};
const offline = async () => {
  throw new Error("connection refused");
};

describe("fhir-core", () => {
  let root: string;
  let tgz: Buffer;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "fhir-core-"));
    tgz = corePackage();
    writePins(root, tgz);
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  describe("selection", () => {
    test("keeps types, resources and root types, and leaves out profiles, extensions and logical models", () => {
      expect(isCoreDefinition(sd("Element", "complex-type"))).toBe(true);
      expect(isCoreDefinition(sd("Patient", "resource", { derivation: "specialization" }))).toBe(true);
      expect(isCoreDefinition(sd("string", "primitive-type", { derivation: "specialization" }))).toBe(true);
      expect(isCoreDefinition(sd("vitalsigns", "resource", { derivation: "constraint" }))).toBe(false);
      expect(isCoreDefinition(sd("Definition", "logical"))).toBe(false);
      expect(isCoreDefinition({ ...sd("Patient", "resource"), url: "http://example.org/Patient" })).toBe(false);
    });
  });

  describe("index", () => {
    test("reads HL7's package and writes a manifest keyed by canonical URL, naming HL7's published URL for each", async () => {
      const fetched: string[] = [];
      const unread = await indexReleases(root, { fetcher: async (u) => (fetched.push(u), tgz), log: quiet });
      expect(unread).toBe(0);
      expect(fetched).toEqual([HL7_R4]);
      const m = readManifest(root, "R4");
      if (m?.status !== "read") throw new Error("expected a read manifest");
      expect(m.spec).toBe("https://hl7.org/fhir/R4/");
      expect(m.definitions.map((d) => d.id)).toEqual(["BackboneElement", "Coding", "DomainResource", "Element", "Patient", "Resource"]);
      expect(m.counts).toEqual({ "primitive-type": 0, "complex-type": 3, resource: 3, excluded: 3 });
      const coding = m.definitions.find((d) => d.id === "Coding");
      expect(coding?.url).toBe(`${BASE}Coding`);
      expect(coding?.published).toBe("https://hl7.org/fhir/R4/coding.profile.json");
      expect(coding?.baseDefinition).toBe(`${BASE}Element`);
      expect(m.definitions.find((d) => d.id === "Element")?.derivation).toBeUndefined();
    });

    test("an unreachable HL7 package is recorded as unread with the reason, and a mirror is never read for it", async () => {
      const mirror = corePackage("repacked");
      writePins(root, tgz, mirror);
      const fetched: string[] = [];
      const unread = await indexReleases(root, {
        fetcher: async (u) => {
          fetched.push(u);
          if (u === MIRROR_R4) return mirror;
          throw new Error("connection refused");
        },
        log: quiet,
      });
      expect(unread).toBe(1);
      expect(fetched).toEqual([HL7_R4]);
      const raw = JSON.parse(readFileSync(join(root, "fhir-core", "r4", "manifest.json"), "utf8"));
      expect(raw.status).toBe("unread");
      expect(raw.reason).toContain("connection refused");
      expect("definitions" in raw).toBe(false);
    });

    test("bytes that differ from HL7's are refused and the release is unread", async () => {
      const other = gzipSync(Buffer.concat([tarEntry("package/package.json", Buffer.from("{}")), Buffer.alloc(1024)]));
      await indexReleases(root, { fetcher: async () => other, log: quiet });
      const m = readManifest(root, "R4");
      expect(m?.status).toBe("unread");
      expect(m?.status === "unread" && m.reason).toContain("sha1");
    });

    test("a copy of HL7's package in --tgz-dir is used, and still checked against HL7's hashes", async () => {
      const dir = join(root, "tgz");
      mkdirSync(dir);
      writeFileSync(join(dir, "hl7.fhir.r4.core.tgz"), tgz);
      expect(await indexReleases(root, { tgzDir: dir, fetcher: offline, log: quiet })).toBe(0);
      writeFileSync(join(dir, "hl7.fhir.r4.core.tgz"), corePackage("tampered"));
      expect(await indexReleases(root, { tgzDir: dir, fetcher: offline, log: quiet })).toBe(1);
    });
  });

  describe("uml", () => {
    test("derives a class per type and backbone element, each citing HL7's definition and element", async () => {
      expect(await umlReleases(root, { fetcher: async () => tgz, log: quiet })).toBe(0);
      const model = readClassModel(root, "R4");
      if (!model) throw new Error("expected a class model");
      expect(model.derivedFrom).toEqual({ tarball: HL7_R4, shasum: sha1Hex(tgz) });
      expect(model.classes.map((c) => c.name)).toEqual(["BackboneElement", "Coding", "DomainResource", "Element", "Patient", "Patient.contact", "Resource"]);
      const patient = model.classes.find((c) => c.name === "Patient");
      expect(patient?.generalization).toBe("DomainResource");
      expect(patient?.published).toBe("https://hl7.org/fhir/R4/patient.profile.json");
      expect(patient?.attributes.map((a) => a.element)).toEqual(["Patient.active", "Patient.contact"]);
      expect(patient?.attributes[0]).toMatchObject({ name: "active", min: 0, max: "1", types: [{ code: "boolean" }], isModifier: true, isSummary: true });
      const contact = model.classes.find((c) => c.name === "Patient.contact");
      expect(contact).toMatchObject({ stereotype: "backbone", owner: "Patient", generalization: "BackboneElement", definition: `${BASE}Patient`, element: "Patient.contact" });
      expect(contact?.attributes.find((a) => a.name === "organization")?.types).toEqual([{ code: "Reference", targets: ["Organization"] }]);
      expect(contact?.attributes.find((a) => a.name === "contact")?.contentReference).toBe("Patient.contact");
      expect(model.classes.find((c) => c.name === "Coding")?.attributes.find((a) => a.name === "extension")).toEqual({ name: "extension", element: "Coding.extension", min: 0, max: "0" });
      expect(model.classes.find((c) => c.name === "Element")?.generalization).toBeUndefined();
      expect(model.counts).toEqual({ classes: 7, backbones: 1, attributes: 7 });
      const diagram = mermaidDiagram(model, "Patient") ?? "";
      expect(diagram).toContain("contact : Patient.contact [0..*]");
      expect(diagram).toContain("Patient *-- Patient_contact");
      expect(diagram).toContain("source: https://hl7.org/fhir/R4/patient.profile.json");
      expect(mermaidDiagram(model, "Observation")).toBeNull();
    });

    test("a class model needs HL7's own bytes: without them it is not derived", async () => {
      expect(await umlReleases(root, { fetcher: offline, log: quiet })).toBe(1);
      expect(readClassModel(root, "R4")).toBeNull();
    });
  });

  describe("cache, check and resolve", () => {
    test("the cache is labelled, holds HL7's bytes, and resolve answers with HL7's URL", async () => {
      await indexReleases(root, { fetcher: async () => tgz, log: quiet });
      await umlReleases(root, { fetcher: async () => tgz, log: quiet });
      expect(checkCore(root).errors).toEqual([]);
      const before = resolveCanonical(root, `${BASE}Coding`, "R4");
      expect(before).toMatchObject({ status: "found", published: "https://hl7.org/fhir/R4/coding.profile.json" });
      expect(before.status === "found" && before.cached).toBeUndefined();
      expect(await materialiseReleases(root, { fetcher: async () => tgz, log: quiet })).toBe(0);
      const cache = join(root, "fhir-core", "r4", "cache");
      expect(readFileSync(join(cache, "CACHE.md"), "utf8")).toContain("not the authority");
      const body = readFileSync(join(cache, "StructureDefinition-Coding.json"));
      expect(body.equals(tgzFiles(tgz).get("package/StructureDefinition-Coding.json") ?? Buffer.alloc(0))).toBe(true);
      expect(checkCore(root).errors).toEqual([]);
      const r = resolveCanonical(root, `${BASE}Coding|4.0.1`, "R4");
      expect(r).toMatchObject({ status: "found", published: "https://hl7.org/fhir/R4/coding.profile.json", cached: join(cache, "StructureDefinition-Coding.json") });
      expect(resolveCanonical(root, `${BASE}Base`, "R4").status).toBe("absent");
      expect(existsSync(join(cache, "StructureDefinition-vitalsigns.json"))).toBe(false);
    });

    test("a pinned mirror may fill the cache when HL7 cannot be reached, file by file against HL7's sha256", async () => {
      const mirror = corePackage("repacked");
      await indexReleases(root, { fetcher: async () => tgz, log: quiet });
      writePins(root, tgz, mirror);
      const fetcher = async (u: string) => {
        if (u === MIRROR_R4) return mirror;
        throw new Error("connection refused");
      };
      expect(await materialiseReleases(root, { fetcher, log: quiet })).toBe(0);
      expect(readFileSync(join(root, "fhir-core", "r4", "cache", "CACHE.md"), "utf8")).toContain(MIRROR_R4);
      writePins(root, tgz);
      expect(await materialiseReleases(root, { fetcher, log: quiet })).toBe(1);
    });

    test("an edited body, a stray file or an unlabelled cache fails check", async () => {
      await indexReleases(root, { fetcher: async () => tgz, log: quiet });
      await umlReleases(root, { fetcher: async () => tgz, log: quiet });
      await materialiseReleases(root, { fetcher: async () => tgz, log: quiet });
      const cache = join(root, "fhir-core", "r4", "cache");
      writeFileSync(join(cache, "StructureDefinition-Coding.json"), "{}");
      writeFileSync(join(cache, "StructureDefinition-Extra.json"), "{}");
      rmSync(join(cache, "CACHE.md"));
      writeFileSync(join(root, "fhir-core", "r4", "StructureDefinition-Patient.json"), "{}");
      const errors = checkCore(root).errors.join("\n");
      expect(errors).toContain("StructureDefinition-Coding.json: bytes are not HL7's");
      expect(errors).toContain("StructureDefinition-Extra.json: no manifest entry names it");
      expect(errors).toContain("cache/: unlabelled");
      expect(errors).toContain("r4/StructureDefinition-Patient.json: not a manifest, class model or the cache");
    });

    test("an unread release cannot be materialised and resolves as undetermined", async () => {
      await indexReleases(root, { fetcher: async () => Buffer.alloc(0), log: quiet });
      expect(await materialiseReleases(root, { fetcher: async () => tgz, log: quiet })).toBe(1);
      expect(resolveCanonical(root, `${BASE}Coding`, "R4").status).toBe("undetermined");
    });

    test("a manifest or class model from a package other than the pin, or a missing class model, fails check", async () => {
      await indexReleases(root, { fetcher: async () => tgz, log: quiet });
      expect(checkCore(root).errors.join("\n")).toContain("class-model.json: missing");
      await umlReleases(root, { fetcher: async () => tgz, log: quiet });
      writePins(root, gzipSync(Buffer.from("different")));
      const errors = checkCore(root).errors.join("\n");
      expect(errors).toContain("manifest.json: names");
      expect(errors).toContain("class-model.json: derived from");
    });
  });

  describe("node kinds", () => {
    test("the kinds the validators name judge the files as the schemas do", async () => {
      await indexReleases(root, { fetcher: async () => tgz, log: quiet });
      await umlReleases(root, { fetcher: async () => tgz, log: quiet });
      const read = JSON.parse(readFileSync(join(root, "fhir-core", "r4", "manifest.json"), "utf8"));
      expect(FhirCoreReleaseKind.schema.safeParse(read).success).toBe(true);
      expect(FhirCoreReleaseKind.schema.safeParse({ ...read, extra: 1 }).success).toBe(false);
      expect(FhirCoreReleaseKind.schema.safeParse({ ...read, spec: "https://example.org/fhir/R4/" }).success).toBe(false);
      const unread = { ...read, status: "unread", reason: "x" };
      expect(FhirCoreReleaseKind.schema.safeParse(unread).success).toBe(false);
      const { counts: _c, definitions: _d, ...head } = unread;
      expect(FhirCoreReleaseKind.schema.safeParse(head).success).toBe(true);
      const pins = JSON.parse(readFileSync(join(root, "fhir-core", "pins.json"), "utf8"));
      expect(FhirCorePinsKind.schema.safeParse(pins).success).toBe(true);
      expect(FhirCorePinsKind.schema.safeParse({ ...pins, releases: [...pins.releases, ...pins.releases] }).success).toBe(false);
      const registry = { ...pins.releases[0], package: { ...pins.releases[0].package, tarball: MIRROR_R4 } };
      expect(FhirCorePinsKind.schema.safeParse({ ...pins, releases: [registry] }).success).toBe(false);
      const model = JSON.parse(readFileSync(join(root, "fhir-core", "r4", "class-model.json"), "utf8"));
      expect(FhirCoreClassModelKind.schema.safeParse(model).success).toBe(true);
      expect(FhirCoreClassModelKind.schema.safeParse({ ...model, counts: { ...model.counts, classes: 1 } }).success).toBe(false);
    });
  });

  describe("the committed graph", () => {
    test("the committed pins, manifests and class models check clean, one stable release each, all pointing at HL7", () => {
      expect(checkCore(LAYER_ROOT).errors).toEqual([]);
      for (const release of ["R4", "R4B", "R5"] as const) {
        const m = readManifest(LAYER_ROOT, release);
        expect(m).not.toBeNull();
        expect(FhirCoreReleaseSchema.safeParse(m).success).toBe(true);
        expect(m?.package.tarball.startsWith(`https://hl7.org/fhir/${release}/`)).toBe(true);
        if (m?.status === "read") {
          const ids = new Set(m.definitions.map((d) => d.id));
          for (const base of ["Element", "BackboneElement", "DomainResource", "Resource", "Coding", "Reference", "Patient", "string"]) {
            expect(ids.has(base)).toBe(true);
          }
          expect(ids.has("Base")).toBe(release === "R5");
          expect(m.definitions.every((d) => d.published.startsWith(`https://hl7.org/fhir/${release}/`))).toBe(true);
        }
        const model = readClassModel(LAYER_ROOT, release);
        expect(model?.classes.find((c) => c.name === "Patient")?.generalization).toBe("DomainResource");
        expect(model?.classes.find((c) => c.name === "Patient.contact")?.owner).toBe("Patient");
      }
    });
  });
});
