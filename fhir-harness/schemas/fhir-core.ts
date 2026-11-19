/**
 * fhir-core.ts — the FHIR core specification's StructureDefinitions, one graph
 * per STABLE FHIR release, keyed by canonical URL.
 *
 * Owner, 2026-11-14: *"fhir structured definitions and base resources etc should
 * be loaded in fhir-harness for stable fhir releases to represent it as a
 * harnessed KG."* Owner, 2026-11-15: *"i want to refer to HL7 offiically
 * published .json etc for their resources, just use fhir-harness to derived
 * stuff (e.g. UML) that is not part of core IG publisher"*; *"reference
 * published hl7. assets as authoratative"*.
 *
 * So HL7 is the authority and this layer holds three things, none of which
 * restates a definition:
 *
 * - `folio-fhir-core-pins/v2` (`fhir-core/pins.json`): HL7's own package for
 *   each release, at the URL HL7 publishes it
 *   (`https://hl7.org/fhir/<release>/hl7.fhir.<r>.core.tgz`), with the sha1
 *   and sha512 of HL7's bytes. A mirror (the FHIR package registry) may be
 *   listed with ITS hashes; it only ever fills the cache. Stable releases only.
 * - `folio-fhir-core-release/v2` (`fhir-core/<release>/manifest.json`): what
 *   was read from HL7's package, one entry per StructureDefinition chosen by
 *   {@link isCoreDefinition}, keyed by canonical URL, naming HL7's published
 *   JSON for it, the file in the package and the sha256 of that file's bytes.
 *   A release whose package could not be fetched or verified is `status:
 *   "unread"` with the reason, and has NO `definitions`: unread is not empty.
 * - `folio-fhir-core-class-model/v1` (`fhir-core/<release>/class-model.json`):
 *   the UML class model, which HL7 publishes only as pictures, derived from the
 *   package and citing the definition and element of every node.
 *
 * A local copy of the bodies (`fhir-core/<release>/cache/`) is a CACHE, labelled
 * as one in the directory itself: written by `fhir-core.ts materialise`, never
 * committed, each file held to the sha256 HL7's package gave it. `resolve`
 * answers with HL7's URL, and names the cached file only when asked.
 *
 * WHO-free: nothing here is an IG's, let alone WHO's.
 *
 * @graphNode schema
 */
import { nodeKind } from "@litlfred/cat-harness-tools/schemas/kg/node-kind.ts";
import { z } from "zod";

export const FHIR_CORE_PINS_TAG = "folio-fhir-core-pins/v2" as const;
export const FHIR_CORE_RELEASE_TAG = "folio-fhir-core-release/v2" as const;
export const FHIR_CORE_CLASS_MODEL_TAG = "folio-fhir-core-class-model/v1" as const;

/** The canonical base of every core StructureDefinition. */
export const CORE_SD_BASE = "http://hl7.org/fhir/StructureDefinition/" as const;

/** Where HL7 publishes the FHIR specification: the authority for every core definition. */
export const HL7_FHIR = "https://hl7.org/fhir" as const;

/** The stable releases, and the directory each is kept in. */
export const FhirReleaseSchema = z.enum(["R4", "R4B", "R5"]);
export type FhirRelease = z.infer<typeof FhirReleaseSchema>;

export const RELEASE_DIR: Record<FhirRelease, string> = { R4: "r4", R4B: "r4b", R5: "r5" };

/** HL7's published specification for a release: `https://hl7.org/fhir/R4/`. */
export function specUrl(release: FhirRelease): string {
  return `${HL7_FHIR}/${release}/`;
}

/** HL7's own core package for a release, as the specification's downloads page links it. */
export function hl7Tarball(release: FhirRelease): string {
  return `${specUrl(release)}hl7.fhir.${RELEASE_DIR[release]}.core.tgz`;
}

/**
 * HL7's published JSON of one core StructureDefinition: `https://hl7.org/fhir/R4/patient.profile.json`.
 * It carries the same definition as the package's file; HL7 renders its narrative
 * and `meta` for the page, so its bytes are not the package's and only the
 * package's bytes are hashed.
 */
export function publishedDefinition(release: FhirRelease, id: string): string {
  return `${specUrl(release)}${id.toLowerCase()}.profile.json`;
}

/** A stable FHIR version: three numbers, no ballot or snapshot suffix. */
const StableVersion = z.string().regex(/^\d+\.\d+\.\d+$/, "a stable release version (no ballot, snapshot or preview suffix)");

const Sha1Hex = z.string().regex(/^[0-9a-f]{40}$/, "a sha1, hex");
const Sha512Integrity = z.string().regex(/^sha512-[A-Za-z0-9+/]{86}==$/, "an npm sha512 integrity string");
const Sha256Hex = z.string().regex(/^[0-9a-f]{64}$/);

/** HL7's package for one release, at the URL HL7 publishes it, and what its bytes hash to. */
export const FhirCorePackageSchema = z
  .object({
    name: z.string().regex(/^hl7\.fhir\.r[0-9]+b?\.core$/, "an hl7.fhir.<release>.core package"),
    version: StableVersion,
    /** HL7's own URL for the package: `https://hl7.org/fhir/<release>/hl7.fhir.<r>.core.tgz`. */
    tarball: z.string().regex(/^https:\/\/hl7\.org\/fhir\/R[0-9]+B?\/hl7\.fhir\.r[0-9]+b?\.core\.tgz$/, "HL7's own published package URL on hl7.org"),
    /** sha1 of HL7's bytes, hex. */
    shasum: Sha1Hex,
    /** sha512 of HL7's bytes. */
    integrity: Sha512Integrity,
  })
  .strict();
export type FhirCorePackage = z.infer<typeof FhirCorePackageSchema>;

/**
 * A copy of the package served somewhere other than hl7.org (the FHIR package
 * registry). Never the authority: a mirror may only fill the local cache, and
 * then only file by file against the sha256 HL7's own package gave each
 * definition. Its own hashes are pinned because a mirror's tarball need not be
 * HL7's bytes (R4's is repacked: different tarball, identical definitions).
 */
export const FhirCoreMirrorSchema = z
  .object({
    tarball: z.string().regex(/^https:\/\/[a-z0-9.-]+\/\S+$/),
    shasum: Sha1Hex,
    integrity: Sha512Integrity,
    /** How this copy relates to HL7's bytes, as checked when the mirror was pinned. */
    note: z.string().min(1),
  })
  .strict();
export type FhirCoreMirror = z.infer<typeof FhirCoreMirrorSchema>;

export const FhirCorePinObject = z
  .object({
    release: FhirReleaseSchema,
    fhirVersion: StableVersion,
    /** HL7's published specification for this release. */
    spec: z.string().regex(/^https:\/\/hl7\.org\/fhir\/R[0-9]+B?\/$/),
    package: FhirCorePackageSchema,
    mirrors: z.array(FhirCoreMirrorSchema).optional(),
  })
  .strict();

/** A pin's version, spec and package all name its release. */
export function pinAgrees(p: z.infer<typeof FhirCorePinObject>, ctx: z.RefinementCtx, path: (string | number)[] = []): void {
  if (p.package.version !== p.fhirVersion) ctx.addIssue({ code: "custom", path: [...path, "package", "version"], message: "a core package's version is its FHIR version" });
  if (p.spec !== specUrl(p.release)) ctx.addIssue({ code: "custom", path: [...path, "spec"], message: `${p.release}'s specification is ${specUrl(p.release)}` });
  if (p.package.tarball !== hl7Tarball(p.release)) ctx.addIssue({ code: "custom", path: [...path, "package", "tarball"], message: `${p.release}'s package is HL7's ${hl7Tarball(p.release)}` });
  if (p.package.name !== `hl7.fhir.${RELEASE_DIR[p.release]}.core`) ctx.addIssue({ code: "custom", path: [...path, "package", "name"], message: `${p.release}'s package is hl7.fhir.${RELEASE_DIR[p.release]}.core` });
}

export const FhirCorePinSchema = FhirCorePinObject.superRefine((p, ctx) => pinAgrees(p, ctx));
export type FhirCorePin = z.infer<typeof FhirCorePinObject>;

export const FhirCorePinsObject = z
  .object({
    $schema: z.literal(FHIR_CORE_PINS_TAG),
    /** Whose publication the definitions are: HL7's, always. */
    authority: z.literal(HL7_FHIR),
    /** What a reviewer needs to re-check the pins by hand. */
    note: z.string().min(1),
    releases: z.array(FhirCorePinObject).min(1),
  })
  .strict();

/** No release is pinned twice, and each pin names its release's HL7 URLs. */
export function pinsAgree(d: z.infer<typeof FhirCorePinsObject>, ctx: z.RefinementCtx): void {
  const seen = new Set<string>();
  for (const [i, p] of d.releases.entries()) {
    if (seen.has(p.release)) ctx.addIssue({ code: "custom", path: ["releases", i, "release"], message: `${p.release} is pinned twice` });
    seen.add(p.release);
    pinAgrees(p, ctx, ["releases", i]);
  }
}

export const FhirCorePinsSchema = FhirCorePinsObject.superRefine(pinsAgree);

export const FhirCorePinsKind = nodeKind("folio-fhir-core-pins", [], FhirCorePinsObject.shape, {
  strict: true,
  refine: pinsAgree,
  term: "FHIR core pins",
  summary: "Which of HL7's published hl7.fhir.<release>.core packages each stable FHIR release is read from, at its hl7.org URL, by sha1 and sha512; any mirror is pinned separately and is never the authority.",
});
export type FhirCorePins = z.infer<typeof FhirCorePinsSchema>;

export const SdKindSchema = z.enum(["primitive-type", "complex-type", "resource"]);

/** One StructureDefinition read from HL7's package, keyed by its canonical URL. */
export const CoreDefinitionSchema = z
  .object({
    url: z.string().startsWith(CORE_SD_BASE),
    id: z.string().regex(/^[A-Za-z0-9\-.]{1,64}$/),
    name: z.string().min(1),
    /** The SD's own `version`, which is the release's FHIR version. */
    version: StableVersion,
    kind: SdKindSchema,
    type: z.string().min(1),
    abstract: z.boolean(),
    /** Absent on a root type: `Element` and `Resource` in R4/R4B, `Base` in R5. */
    derivation: z.literal("specialization").optional(),
    baseDefinition: z.string().startsWith(CORE_SD_BASE).optional(),
    /** HL7's published JSON of this definition ({@link publishedDefinition}): where a reader is sent. */
    published: z.string().regex(/^https:\/\/hl7\.org\/fhir\/R[0-9]+B?\/[a-z0-9\-.]+\.profile\.json$/),
    /** The file in HL7's package (under `package/`) the definition was read from; a cached copy has the same name. */
    file: z.string().regex(/^StructureDefinition-[A-Za-z0-9\-.]+\.json$/),
    /** sha256 of that file's bytes in HL7's package. */
    sha256: Sha256Hex,
  })
  .strict()
  .refine((e) => e.url === CORE_SD_BASE + e.id && e.file === `StructureDefinition-${e.id}.json`, {
    message: "a core definition's url and file are both its id's",
  });
export type CoreDefinition = z.infer<typeof CoreDefinitionSchema>;

export const CountsSchema = z
  .object({
    "primitive-type": z.number().int().nonnegative(),
    "complex-type": z.number().int().nonnegative(),
    resource: z.number().int().nonnegative(),
    /** StructureDefinitions in the package the selection left out (profiles, extensions, logical models). */
    excluded: z.number().int().nonnegative(),
  })
  .strict();

/**
 * One object rather than a discriminated union, so the node kind can be made
 * from its shape (`nodeKind` composes shapes); {@link releaseAgrees} holds the
 * two statuses apart, and {@link FhirCoreReleaseManifest} is the union a reader
 * narrows on `status`.
 */
export const FhirCoreReleaseObject = z
  .object({
    $schema: z.literal(FHIR_CORE_RELEASE_TAG),
    release: FhirReleaseSchema,
    fhirVersion: StableVersion,
    /** HL7's published specification for this release: the authority. */
    spec: z.string().regex(/^https:\/\/hl7\.org\/fhir\/R[0-9]+B?\/$/),
    /** HL7's package the manifest was read from: always HL7's own bytes, never a mirror's. */
    package: FhirCorePackageSchema,
    /** The rule {@link isCoreDefinition} applies, in words. */
    selection: z.string().min(1),
    status: z.enum(["read", "unread"]),
    /** `unread` only: why the package could not be read. */
    reason: z.string().min(1).optional(),
    /** `read` only. */
    counts: CountsSchema.optional(),
    /** `read` only, and never empty. An `unread` release has NO `definitions`: unread is not empty. */
    definitions: z.array(CoreDefinitionSchema).min(1).optional(),
  })
  .strict();

/** What no field's own schema can say: which fields each status carries, order, versions and counts. */
export function releaseAgrees(m: z.infer<typeof FhirCoreReleaseObject>, ctx: z.RefinementCtx): void {
  if (m.spec !== specUrl(m.release)) ctx.addIssue({ code: "custom", path: ["spec"], message: `${m.release}'s specification is ${specUrl(m.release)}` });
  if (m.status === "unread") {
    if (m.reason === undefined) ctx.addIssue({ code: "custom", path: ["reason"], message: "an unread release says why" });
    for (const k of ["counts", "definitions"] as const) {
      if (m[k] !== undefined) ctx.addIssue({ code: "custom", path: [k], message: `an unread release has no ${k}: unread is not empty` });
    }
    return;
  }
  if (m.reason !== undefined) ctx.addIssue({ code: "custom", path: ["reason"], message: "a read release has no reason" });
  if (m.counts === undefined || m.definitions === undefined) {
    ctx.addIssue({ code: "custom", path: ["definitions"], message: "a read release lists its counts and definitions" });
    return;
  }
  let prev = "";
  for (const [i, d] of m.definitions.entries()) {
    if (d.url <= prev) ctx.addIssue({ code: "custom", path: ["definitions", i, "url"], message: `${d.url} is out of order or repeated` });
    prev = d.url;
    if (d.published !== publishedDefinition(m.release, d.id)) ctx.addIssue({ code: "custom", path: ["definitions", i, "published"], message: `${d.id} is published at ${publishedDefinition(m.release, d.id)}` });
    if (d.version !== m.fhirVersion) ctx.addIssue({ code: "custom", path: ["definitions", i, "version"], message: `${d.id} is ${d.version}, not ${m.fhirVersion}` });
  }
  const counted = m.counts["primitive-type"] + m.counts["complex-type"] + m.counts.resource;
  if (counted !== m.definitions.length) ctx.addIssue({ code: "custom", path: ["counts"], message: `counts sum to ${counted}, ${m.definitions.length} definitions listed` });
}

export const FhirCoreReleaseSchema = FhirCoreReleaseObject.superRefine(releaseAgrees);

type ReleaseHead = Omit<z.infer<typeof FhirCoreReleaseObject>, "status" | "reason" | "counts" | "definitions">;
export type FhirCoreRead = ReleaseHead & { status: "read"; counts: z.infer<typeof CountsSchema>; definitions: CoreDefinition[] };
export type FhirCoreUnread = ReleaseHead & { status: "unread"; reason: string };
export type FhirCoreReleaseManifest = FhirCoreRead | FhirCoreUnread;

/** Parse a release manifest; the refinement guarantees the union's shape. */
export function parseRelease(value: unknown): FhirCoreReleaseManifest {
  return FhirCoreReleaseSchema.parse(value) as FhirCoreReleaseManifest;
}

export const FhirCoreReleaseKind = nodeKind("folio-fhir-core-release", [], FhirCoreReleaseObject.shape, {
  strict: true,
  refine: releaseAgrees,
  term: "FHIR core release",
  summary: "What was read from HL7's published core package for one stable FHIR release: its pin, and every type and resource StructureDefinition by canonical URL with HL7's published URL for it, or why it could not be read.",
});

export const SELECTION =
  "StructureDefinitions whose url is http://hl7.org/fhir/StructureDefinition/<id>, whose kind is primitive-type, complex-type or resource, and whose derivation is specialization or absent (the root types). Constraint profiles, extension definitions and logical models are left out and counted as excluded.";

/** Whether a package resource is one of the core definitions this graph holds. */
export function isCoreDefinition(sd: unknown): boolean {
  if (typeof sd !== "object" || sd === null) return false;
  const r = sd as Record<string, unknown>;
  return (
    r.resourceType === "StructureDefinition" &&
    typeof r.id === "string" &&
    r.url === CORE_SD_BASE + r.id &&
    (r.kind === "primitive-type" || r.kind === "complex-type" || r.kind === "resource") &&
    (r.derivation === undefined || r.derivation === "specialization")
  );
}

/*
 * The UML class model: what HL7 does NOT publish as data. HL7's specification
 * draws a UML diagram for each resource, as a picture; the class model below is
 * the same structure as a graph a reader can query, DERIVED from HL7's package
 * and citing it at every node. Nothing in it is authored here: each class names
 * the canonical URL and HL7's published JSON it came from, each attribute the
 * element id in that definition, and a finding against the model is a finding
 * against {@link FHIR_CORE_CLASS_MODEL_TAG}'s writer (`fhir-core.ts uml`).
 */

export const ClassStereotypeSchema = z.enum(["primitive-type", "complex-type", "resource", "backbone"]);

/** One element type, as HL7's `ElementDefinition.type` states it. */
export const AttributeTypeSchema = z
  .object({
    /** `type.code`, verbatim (a core type, or a FHIRPath system type URL on a primitive's value). */
    code: z.string().min(1),
    /** The classes a `Reference`/`canonical` may point to, from `type.targetProfile`, by core type name. */
    targets: z.array(z.string().min(1)).min(1).optional(),
  })
  .strict();

/** One attribute of a class: one element of HL7's differential, one level below the class's element. */
export const ClassAttributeSchema = z
  .object({
    name: z.string().min(1),
    /** The element's id in the definition the class cites: the attribute's source. */
    element: z.string().min(1),
    min: z.number().int().nonnegative(),
    max: z.string().regex(/^(\*|\d+)$/),
    /** Absent when the element re-uses another's structure ({@link contentReference}), or when it only prohibits an inherited element (`max` 0, as `xhtml.extension`). */
    types: z.array(AttributeTypeSchema).min(1).optional(),
    /** `ElementDefinition.contentReference`'s target, as a class name (`Questionnaire.item`). */
    contentReference: z.string().min(1).optional(),
    isModifier: z.literal(true).optional(),
    isSummary: z.literal(true).optional(),
  })
  .strict()
  .refine((a) => (a.types === undefined) !== (a.contentReference === undefined) || (a.types === undefined && a.contentReference === undefined && a.max === "0"), {
    message: "an attribute has either types or a contentReference, unless it is an inherited element HL7 prohibits (max 0)",
  });
export type ClassAttribute = z.infer<typeof ClassAttributeSchema>;

export const UmlClassSchema = z
  .object({
    /** The type's name, or `<Type>.<path>` for a backbone element's class. */
    name: z.string().min(1),
    stereotype: ClassStereotypeSchema,
    abstract: z.boolean(),
    /** The class it specialises: the base definition's type, or the backbone element's own type. Absent on a root type. */
    generalization: z.string().min(1).optional(),
    /** Backbone classes only: the class whose attribute this structure is. */
    owner: z.string().min(1).optional(),
    /** The canonical URL of the HL7 definition this class is read from. */
    definition: z.string().startsWith(CORE_SD_BASE),
    /** HL7's published JSON of that definition. */
    published: z.string().startsWith(`${HL7_FHIR}/`),
    /** The element id in that definition this class is: the type itself, or the backbone element. */
    element: z.string().min(1),
    attributes: z.array(ClassAttributeSchema),
  })
  .strict()
  .refine((c) => (c.stereotype === "backbone") === (c.owner !== undefined), { message: "a backbone class, and only one, names its owner" });
export type UmlClass = z.infer<typeof UmlClassSchema>;

export const FhirCoreClassModelObject = z
  .object({
    $schema: z.literal(FHIR_CORE_CLASS_MODEL_TAG),
    release: FhirReleaseSchema,
    fhirVersion: StableVersion,
    spec: z.string().regex(/^https:\/\/hl7\.org\/fhir\/R[0-9]+B?\/$/),
    /** HL7's package every class is read from, by URL and sha1. */
    derivedFrom: z.object({ tarball: FhirCorePackageSchema.shape.tarball, shasum: Sha1Hex }).strict(),
    /** The rule the writer applies, in words. */
    derivation: z.string().min(1),
    counts: z
      .object({
        classes: z.number().int().nonnegative(),
        backbones: z.number().int().nonnegative(),
        attributes: z.number().int().nonnegative(),
      })
      .strict(),
    classes: z.array(UmlClassSchema).min(1),
  })
  .strict();

/** Classes sorted and unique, every generalization and owner a class of the model, counts true. */
export function classModelAgrees(m: z.infer<typeof FhirCoreClassModelObject>, ctx: z.RefinementCtx): void {
  if (m.spec !== specUrl(m.release)) ctx.addIssue({ code: "custom", path: ["spec"], message: `${m.release}'s specification is ${specUrl(m.release)}` });
  const names = new Set(m.classes.map((c) => c.name));
  let prev = "";
  let backbones = 0;
  let attributes = 0;
  for (const [i, c] of m.classes.entries()) {
    if (c.name <= prev) ctx.addIssue({ code: "custom", path: ["classes", i, "name"], message: `${c.name} is out of order or repeated` });
    prev = c.name;
    for (const k of ["generalization", "owner"] as const) {
      const n = c[k];
      if (n !== undefined && !names.has(n)) ctx.addIssue({ code: "custom", path: ["classes", i, k], message: `${c.name}'s ${k} ${n} is not a class of the model` });
    }
    for (const [j, a] of c.attributes.entries()) {
      if (a.element !== `${c.element}.${a.name}`) ctx.addIssue({ code: "custom", path: ["classes", i, "attributes", j, "element"], message: `${a.element} is not an element of ${c.element}` });
      if (a.contentReference !== undefined && !names.has(a.contentReference)) ctx.addIssue({ code: "custom", path: ["classes", i, "attributes", j, "contentReference"], message: `${a.contentReference} is not a class of the model` });
    }
    if (c.stereotype === "backbone") backbones++;
    attributes += c.attributes.length;
  }
  const want = { classes: m.classes.length, backbones, attributes };
  if (JSON.stringify(m.counts) !== JSON.stringify(want)) ctx.addIssue({ code: "custom", path: ["counts"], message: `counts are ${JSON.stringify(want)}` });
}

export const FhirCoreClassModelSchema = FhirCoreClassModelObject.superRefine(classModelAgrees);
export type FhirCoreClassModel = z.infer<typeof FhirCoreClassModelSchema>;

export const FhirCoreClassModelKind = nodeKind("folio-fhir-core-class-model", [], FhirCoreClassModelObject.shape, {
  strict: true,
  refine: classModelAgrees,
  term: "FHIR core class model",
  summary: "The UML class model of one stable FHIR release, derived from HL7's published core package: a class per type, resource and backbone element, its generalization and attributes, each citing the HL7 definition and element it is read from.",
});

export const CLASS_MODEL_DERIVATION =
  "One class per core definition (its type's name; stereotype its kind; abstract as HL7 states; generalization the type its baseDefinition names) and one per backbone element (an element of the differential that has elements below it; named <Type>.<path>, owned by the class one level up, generalization the element's own type). A class's attributes are the differential's elements exactly one level below the class's element, with HL7's min, max, type codes (Reference and canonical targets by core type name), contentReference, isModifier and isSummary; an inherited element the differential only prohibits (max 0, as xhtml.extension) is kept as an attribute with no types. Inherited elements are not repeated: they are the generalization's. Constraints, bindings and descriptions are not copied: the cited definition holds them.";
