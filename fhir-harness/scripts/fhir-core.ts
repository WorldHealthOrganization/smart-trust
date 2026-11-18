#!/usr/bin/env bun
/**
 * fhir-core.ts — the FHIR core definitions of each stable release, read from
 * HL7's own published packages, and the UML class model derived from them
 * (`fhir-core/`, typology `fhir-core-definitions`; schema `schemas/fhir-core.ts`).
 *
 * HL7 is the authority. Every definition is referred to at HL7's published URL;
 * this layer keeps only the manifest of what HL7's package holds, the class
 * model derived from it, and, on request, a labelled local cache.
 *
 * Usage (from the checkout root, or `--root` the layer):
 *   bun run fhir-harness/scripts/fhir-core.ts index       [--root DIR] [--release R4] [--tgz-dir DIR]
 *   bun run fhir-harness/scripts/fhir-core.ts uml         [--root DIR] [--release R4] [--tgz-dir DIR]
 *   bun run fhir-harness/scripts/fhir-core.ts materialise [--root DIR] [--release R4] [--tgz-dir DIR]
 *   bun run fhir-harness/scripts/fhir-core.ts check       [--root DIR]
 *   bun run fhir-harness/scripts/fhir-core.ts resolve <canonical-url> [--root DIR] [--release R4] [--cache]
 *   bun run fhir-harness/scripts/fhir-core.ts diagram <Type> [--root DIR] [--release R4]
 *
 * `index` reads HL7's package for each release (from `--tgz-dir` when it holds
 * a copy, else from its hl7.org URL), refuses bytes whose sha1 or sha512 is not
 * HL7's, and writes the release's manifest. A mirror is never read for this: a
 * package that cannot be had from HL7 writes an `unread` manifest naming why,
 * and the command exits 1.
 *
 * `uml` derives the release's class model from the same verified bytes and
 * writes `class-model.json`.
 *
 * `materialise` fills the local cache (`<release>/cache/`), labelled as a cache
 * in its own `CACHE.md`. It may read a pinned mirror, because each file is held
 * to the sha256 HL7's package gave it; it refuses an `unread` release.
 *
 * `check` is offline: the pins, manifests and class models parse, each names
 * its pin's HL7 package, and every cached body matches its entry. An empty
 * cache is reported and is not a failure.
 *
 * `resolve` prints HL7's published URL for a canonical (with `--cache`, the
 * cached file instead), or exits 1 when the release holds no such definition
 * and 2 when the release is unread (or, with `--cache`, not cached).
 *
 * `diagram` prints a Mermaid class diagram of one type and its backbone
 * classes from the committed class model.
 *
 * Exit codes: 0 ok, 1 a failure, 2 usage or could not determine.
 *
 * @module fhir-harness/scripts/fhir-core
 * @covers fhir-core-definitions
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

import {
  CLASS_MODEL_DERIVATION,
  type ClassAttribute,
  CORE_SD_BASE,
  type CoreDefinition,
  FHIR_CORE_CLASS_MODEL_TAG,
  FHIR_CORE_RELEASE_TAG,
  type FhirCoreClassModel,
  FhirCoreClassModelSchema,
  type FhirCorePin,
  FhirCorePinsSchema,
  type FhirCoreReleaseManifest,
  type FhirRelease,
  FhirReleaseSchema,
  isCoreDefinition,
  parseRelease,
  publishedDefinition,
  RELEASE_DIR,
  SELECTION,
  type UmlClass,
} from "../schemas/fhir-core.ts";
import { sha512Integrity } from "./fhir-cache-seed-npm.ts";

/** The layer root this script belongs to. */
export const LAYER_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const CORE_DIR = "fhir-core";
export const PINS_FILE = "pins.json";
export const MANIFEST_FILE = "manifest.json";
export const CLASS_MODEL_FILE = "class-model.json";
/** The local cache of HL7's bodies, inside each release directory. */
export const CACHE_DIR = "cache";
/** The cache's own label: what it is a copy of, and that it is not the authority. */
export const CACHE_LABEL = "CACHE.md";

export function sha1Hex(data: Buffer): string {
  return createHash("sha1").update(data).digest("hex");
}
export function sha256Hex(data: Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

/** Every regular file in a .tgz, by its path inside the archive (`package/...`). In memory; nothing is written. */
export function tgzFiles(tgz: Buffer): Map<string, Buffer> {
  const buf = gunzipSync(tgz);
  const out = new Map<string, Buffer>();
  let off = 0;
  let longName: string | undefined;
  while (off + 512 <= buf.length) {
    const header = buf.subarray(off, off + 512);
    let name = header.toString("utf8", 0, 100).replace(/\0.*$/s, "");
    if (!name) break;
    if (header.toString("utf8", 257, 262) === "ustar") {
      const prefix = header.toString("utf8", 345, 500).replace(/\0.*$/s, "");
      if (prefix) name = `${prefix}/${name}`;
    }
    const type = String.fromCharCode(header[156] ?? 0);
    const size = parseInt(header.toString("utf8", 124, 136).replace(/\0.*$/s, "").trim(), 8) || 0;
    const body = buf.subarray(off + 512, off + 512 + size);
    if (type === "L") longName = body.toString("utf8").replace(/\0.*$/s, "");
    else {
      if (type === "0" || type === "\0") out.set((longName ?? name).replace(/^\.\//, ""), Buffer.from(body));
      longName = undefined;
    }
    off += 512 + Math.ceil(size / 512) * 512;
  }
  return out;
}

/** Why `data` is not the tarball `want` pins, or null when both hashes match. */
export function hashMismatch(want: { shasum: string; integrity: string }, data: Buffer): string | null {
  const sha1 = sha1Hex(data);
  if (sha1 !== want.shasum) return `sha1 ${sha1} is not the pinned ${want.shasum}`;
  const integrity = sha512Integrity(data);
  if (integrity !== want.integrity) return `sha512 ${integrity} is not the pinned ${want.integrity}`;
  return null;
}

/** Why `data` is not HL7's package for the pin, or null when it is. */
export function pinMismatch(pin: FhirCorePin, data: Buffer): string | null {
  return hashMismatch(pin.package, data);
}

export function readPins(root: string): FhirCorePin[] {
  const path = join(root, CORE_DIR, PINS_FILE);
  return FhirCorePinsSchema.parse(JSON.parse(readFileSync(path, "utf8"))).releases;
}

export function releaseDir(root: string, release: FhirRelease): string {
  return join(root, CORE_DIR, RELEASE_DIR[release]);
}
export function manifestPath(root: string, release: FhirRelease): string {
  return join(releaseDir(root, release), MANIFEST_FILE);
}
export function classModelPath(root: string, release: FhirRelease): string {
  return join(releaseDir(root, release), CLASS_MODEL_FILE);
}
export function cacheDir(root: string, release: FhirRelease): string {
  return join(releaseDir(root, release), CACHE_DIR);
}

export function readManifest(root: string, release: FhirRelease): FhirCoreReleaseManifest | null {
  const p = manifestPath(root, release);
  return existsSync(p) ? parseRelease(JSON.parse(readFileSync(p, "utf8"))) : null;
}

export function readClassModel(root: string, release: FhirRelease): FhirCoreClassModel | null {
  const p = classModelPath(root, release);
  return existsSync(p) ? FhirCoreClassModelSchema.parse(JSON.parse(readFileSync(p, "utf8"))) : null;
}

type Sd = Record<string, unknown>;

/** The chosen definitions in a package, each with its bytes and parsed body, sorted by canonical URL. */
export function selectDefinitions(
  pin: FhirCorePin,
  files: Map<string, Buffer>,
): { definitions: { entry: CoreDefinition; bytes: Buffer; sd: Sd }[]; excluded: number } {
  const chosen: { entry: CoreDefinition; bytes: Buffer; sd: Sd }[] = [];
  let excluded = 0;
  for (const [path, bytes] of files) {
    if (!/^package\/StructureDefinition-[^/]+\.json$/.test(path)) continue;
    const sd = JSON.parse(bytes.toString("utf8")) as Sd;
    if (sd.resourceType !== "StructureDefinition") continue;
    if (!isCoreDefinition(sd)) {
      excluded++;
      continue;
    }
    const id = sd.id as string;
    const entry: CoreDefinition = {
      url: CORE_SD_BASE + id,
      id,
      name: String(sd.name),
      version: String(sd.version ?? sd.fhirVersion),
      kind: sd.kind as CoreDefinition["kind"],
      type: String(sd.type),
      abstract: sd.abstract === true,
      ...(sd.derivation === "specialization" ? { derivation: "specialization" as const } : {}),
      ...(typeof sd.baseDefinition === "string" ? { baseDefinition: sd.baseDefinition } : {}),
      published: publishedDefinition(pin.release, id),
      file: `StructureDefinition-${id}.json`,
      sha256: sha256Hex(bytes),
    };
    if (path !== `package/${entry.file}`) throw new Error(`${path} holds ${entry.url}, not the file its id names`);
    chosen.push({ entry, bytes, sd });
  }
  chosen.sort((a, b) => (a.entry.url < b.entry.url ? -1 : a.entry.url > b.entry.url ? 1 : 0));
  return { definitions: chosen, excluded };
}

function releaseHead(pin: FhirCorePin) {
  return { $schema: FHIR_CORE_RELEASE_TAG, release: pin.release, fhirVersion: pin.fhirVersion, spec: pin.spec, package: pin.package, selection: SELECTION };
}

export function readManifestFromPackage(pin: FhirCorePin, tgz: Buffer): FhirCoreReleaseManifest {
  const { definitions, excluded } = selectDefinitions(pin, tgzFiles(tgz));
  const count = (k: CoreDefinition["kind"]) => definitions.filter((d) => d.entry.kind === k).length;
  return parseRelease({
    ...releaseHead(pin),
    status: "read",
    counts: { "primitive-type": count("primitive-type"), "complex-type": count("complex-type"), resource: count("resource"), excluded },
    definitions: definitions.map((d) => d.entry),
  });
}

export function unreadManifest(pin: FhirCorePin, reason: string): FhirCoreReleaseManifest {
  return parseRelease({ ...releaseHead(pin), status: "unread", reason });
}

/** The core type a canonical names (`.../StructureDefinition/Patient` → `Patient`), or the canonical itself when it is not a core one. */
function coreTypeName(canonical: string): string {
  const c = canonical.split("|")[0] ?? canonical;
  return c.startsWith(CORE_SD_BASE) ? c.slice(CORE_SD_BASE.length) : c;
}

/** An element's types as HL7 states them: each code, and any Reference/canonical targets by core type name. */
function typesOf(e: Sd): { code: string; targets?: string[] }[] {
  return ((e.type as Sd[] | undefined) ?? []).map((t) => {
    const targets = ((t.targetProfile as string[] | undefined) ?? []).map(coreTypeName);
    return { code: String(t.code), ...(targets.length ? { targets } : {}) };
  });
}

/** The UML classes one core definition yields: the type's own class, and one per backbone element of its differential. */
export function classesOf(entry: CoreDefinition, sd: Sd): UmlClass[] {
  const diff = ((sd.differential as { element?: Sd[] } | undefined)?.element ?? []) as Sd[];
  const rootId = String(diff[0]?.id ?? entry.type);
  const parentOf = (id: string) => id.slice(0, id.lastIndexOf("."));
  const hasChildren = new Set(diff.map((e) => String(e.id)).filter((id) => id.includes(".")).map(parentOf));
  const className = (elementId: string) => (elementId === rootId ? entry.type : elementId);
  const classes = new Map<string, UmlClass>();
  const base = { definition: entry.url, published: entry.published };
  classes.set(rootId, {
    name: entry.type,
    stereotype: entry.kind,
    abstract: entry.abstract,
    ...(entry.baseDefinition ? { generalization: coreTypeName(entry.baseDefinition) } : {}),
    ...base,
    element: rootId,
    attributes: [],
  });
  for (const e of diff.slice(1)) {
    const id = String(e.id);
    const types = typesOf(e);
    if (hasChildren.has(id)) {
      const own = types[0]?.code;
      classes.set(id, {
        name: id,
        stereotype: "backbone",
        abstract: false,
        ...(own ? { generalization: own } : {}),
        owner: className(parentOf(id)),
        ...base,
        element: id,
        attributes: [],
      });
    }
  }
  for (const e of diff.slice(1)) {
    const id = String(e.id);
    const parent = classes.get(parentOf(id));
    if (!parent) throw new Error(`${entry.url}: ${id} sits under ${parentOf(id)}, which the differential does not hold`);
    const types = typesOf(e);
    const ref = typeof e.contentReference === "string" ? e.contentReference.replace(/^.*#/, "") : undefined;
    const attr: ClassAttribute = {
      name: id.slice(parentOf(id).length + 1),
      element: id,
      min: Number(e.min ?? 0),
      max: String(e.max ?? "*"),
      ...(types.length ? { types } : {}),
      ...(ref !== undefined ? { contentReference: className(ref) } : {}),
      ...(e.isModifier === true ? { isModifier: true as const } : {}),
      ...(e.isSummary === true ? { isSummary: true as const } : {}),
    };
    parent.attributes.push(attr);
  }
  return [...classes.values()];
}

/** The release's UML class model, derived from HL7's verified package. */
export function classModelFromPackage(pin: FhirCorePin, tgz: Buffer): FhirCoreClassModel {
  const { definitions } = selectDefinitions(pin, tgzFiles(tgz));
  const classes = definitions.flatMap((d) => classesOf(d.entry, d.sd)).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  return FhirCoreClassModelSchema.parse({
    $schema: FHIR_CORE_CLASS_MODEL_TAG,
    release: pin.release,
    fhirVersion: pin.fhirVersion,
    spec: pin.spec,
    derivedFrom: { tarball: pin.package.tarball, shasum: pin.package.shasum },
    derivation: CLASS_MODEL_DERIVATION,
    counts: {
      classes: classes.length,
      backbones: classes.filter((c) => c.stereotype === "backbone").length,
      attributes: classes.reduce((n, c) => n + c.attributes.length, 0),
    },
    classes,
  });
}

export type Fetcher = (url: string) => Promise<Buffer>;

export const httpFetch: Fetcher = async (url) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status} from ${url}`);
  return Buffer.from(await r.arrayBuffer());
};

/** Where a package's bytes came from. */
export type Obtained = { bytes: Buffer; from: string; authority: boolean };

/**
 * HL7's package for the pin, verified against HL7's hashes; with `mirrors`, a
 * pinned mirror's copy (verified against ITS hashes) when HL7's cannot be had.
 * A `--tgz-dir` copy is accepted under either name, against the same hashes.
 */
export async function obtain(pin: FhirCorePin, tgzDir: string | undefined, fetcher: Fetcher, opts: { mirrors?: boolean } = {}): Promise<Obtained | string> {
  const reasons: string[] = [];
  const mirrors = opts.mirrors ? (pin.mirrors ?? []) : [];
  const accept = (data: Buffer, from: string): Obtained | null => {
    const bad = pinMismatch(pin, data);
    if (!bad) return { bytes: data, from, authority: true };
    for (const m of mirrors) if (!hashMismatch(m, data)) return { bytes: data, from: `${from} (a copy of mirror ${m.tarball})`, authority: false };
    reasons.push(`${from}: ${bad}`);
    return null;
  };
  if (tgzDir) {
    for (const name of [`${pin.package.name}-${pin.package.version}.tgz`, `${pin.package.name}.tgz`]) {
      const local = join(tgzDir, name);
      if (!existsSync(local)) continue;
      const got = accept(readFileSync(local), local);
      if (got) return got;
    }
  }
  try {
    const got = accept(await fetcher(pin.package.tarball), pin.package.tarball);
    if (got) return got;
  } catch (e) {
    reasons.push(`could not fetch ${pin.package.tarball}: ${(e as Error).message}`);
  }
  for (const m of mirrors) {
    try {
      const data = await fetcher(m.tarball);
      const bad = hashMismatch(m, data);
      if (!bad) return { bytes: data, from: m.tarball, authority: false };
      reasons.push(`${m.tarball}: ${bad}`);
    } catch (e) {
      reasons.push(`could not fetch ${m.tarball}: ${(e as Error).message}`);
    }
  }
  return `${pin.package.name}#${pin.package.version}: ${reasons.join("; ")}`;
}

export function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

/**
 * The class model as JSON with one class per line: 1 MB a release rather than 2,
 * and a re-derivation's diff names the classes that changed.
 */
export function writeClassModel(path: string, model: FhirCoreClassModel): void {
  const { classes, ...head } = model;
  const top = JSON.stringify(head, null, 2).replace(/\n}$/, "");
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${top},\n  "classes": [\n${classes.map((c) => `    ${JSON.stringify(c)}`).join(",\n")}\n  ]\n}\n`);
}

type RunOpts = { release?: FhirRelease; tgzDir?: string; fetcher?: Fetcher; log?: (s: string) => void };

function pinsFor(root: string, opts: RunOpts): FhirCorePin[] {
  return readPins(root).filter((p) => !opts.release || p.release === opts.release);
}

/** Read HL7's package for each release and write its manifest. Returns the number of releases left unread. */
export async function indexReleases(root: string, opts: RunOpts): Promise<number> {
  const log = opts.log ?? console.log;
  let unread = 0;
  for (const pin of pinsFor(root, opts)) {
    const got = await obtain(pin, opts.tgzDir, opts.fetcher ?? httpFetch);
    let m: FhirCoreReleaseManifest;
    if (typeof got === "string") m = unreadManifest(pin, got);
    else {
      try {
        m = readManifestFromPackage(pin, got.bytes);
      } catch (e) {
        m = unreadManifest(pin, `${pin.package.name}#${pin.package.version} could not be read: ${(e as Error).message}`);
      }
    }
    writeJson(manifestPath(root, pin.release), m);
    if (m.status === "unread") {
      unread++;
      log(`${pin.release}: UNREAD — ${m.reason}`);
    } else log(`${pin.release}: ${m.definitions.length} definitions (${m.counts.excluded} excluded) from HL7's ${pin.package.tarball}`);
  }
  return unread;
}

/** Derive each release's class model from HL7's package. Returns the number of releases that could not be. */
export async function umlReleases(root: string, opts: RunOpts): Promise<number> {
  const log = opts.log ?? console.log;
  let failed = 0;
  for (const pin of pinsFor(root, opts)) {
    const got = await obtain(pin, opts.tgzDir, opts.fetcher ?? httpFetch);
    if (typeof got === "string") {
      failed++;
      log(`${pin.release}: could not determine — ${got}`);
      continue;
    }
    const model = classModelFromPackage(pin, got.bytes);
    writeClassModel(classModelPath(root, pin.release), model);
    log(`${pin.release}: ${model.counts.classes} classes (${model.counts.backbones} backbone), ${model.counts.attributes} attributes, derived from HL7's ${pin.package.tarball}`);
  }
  return failed;
}

export function cacheLabel(pin: FhirCorePin, from: string): string {
  return [
    `# Local cache of HL7's FHIR ${pin.release} core definitions — not the authority`,
    "",
    `These files are copies of the StructureDefinitions in HL7's published package for FHIR ${pin.release}`,
    `(${pin.fhirVersion}): ${pin.package.tarball}. HL7's publication is the authority:`,
    `refer to ${pin.spec} and to each definition's \`published\` URL in ../${MANIFEST_FILE}.`,
    "",
    `Each file is held to the sha256 HL7's own package gave it (../${MANIFEST_FILE}), so its bytes are HL7's.`,
    `Written by \`fhir-harness/scripts/fhir-core.ts materialise\` from ${from}. Never committed; delete it freely.`,
    "",
  ].join("\n");
}

/** Fill each read release's cache, file by file against the manifest. Returns the number of releases that could not be. */
export async function materialiseReleases(root: string, opts: RunOpts): Promise<number> {
  const log = opts.log ?? console.log;
  let failed = 0;
  for (const pin of pinsFor(root, opts)) {
    const m = readManifest(root, pin.release);
    if (!m || m.status === "unread") {
      failed++;
      log(`${pin.release}: could not determine — ${m ? `unread: ${m.reason}` : "no manifest; run `index` first"}`);
      continue;
    }
    const got = await obtain(pin, opts.tgzDir, opts.fetcher ?? httpFetch, { mirrors: true });
    if (typeof got === "string") {
      failed++;
      log(`${pin.release}: could not determine — ${got}`);
      continue;
    }
    const files = tgzFiles(got.bytes);
    const dir = cacheDir(root, pin.release);
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, CACHE_LABEL), cacheLabel(pin, got.from));
    let bad = 0;
    for (const d of m.definitions) {
      const bytes = files.get(`package/${d.file}`);
      if (!bytes || sha256Hex(bytes) !== d.sha256) {
        bad++;
        log(`${pin.release}: ${d.url} — ${bytes ? "bytes differ from HL7's" : "not in the package"} (${got.from})`);
        continue;
      }
      writeFileSync(join(dir, d.file), bytes);
    }
    if (bad) failed++;
    log(`${pin.release}: ${m.definitions.length - bad} of ${m.definitions.length} cached from ${got.from}${got.authority ? "" : " (a mirror, checked file by file against HL7's)"}`);
  }
  return failed;
}

export interface CheckReport {
  errors: string[];
  notes: string[];
}

/** Offline: pins, manifests and class models parse and agree, and every cached body is the one its entry names. */
export function checkCore(root: string): CheckReport {
  const errors: string[] = [];
  const notes: string[] = [];
  let pins: FhirCorePin[];
  try {
    pins = readPins(root);
  } catch (e) {
    return { errors: [`${CORE_DIR}/${PINS_FILE}: ${(e as Error).message}`], notes };
  }
  const releaseDirs = new Set(pins.map((p) => RELEASE_DIR[p.release]));
  for (const ent of readdirSync(join(root, CORE_DIR), { withFileTypes: true })) {
    if (ent.isDirectory() && !releaseDirs.has(ent.name)) errors.push(`${CORE_DIR}/${ent.name}/: no pin names this release`);
  }
  for (const pin of pins) {
    const relDir = `${CORE_DIR}/${RELEASE_DIR[pin.release]}`;
    let m: FhirCoreReleaseManifest | null;
    try {
      m = readManifest(root, pin.release);
    } catch (e) {
      errors.push(`${relDir}/${MANIFEST_FILE}: ${(e as Error).message}`);
      continue;
    }
    if (!m) {
      errors.push(`${relDir}/${MANIFEST_FILE}: missing — run \`fhir-core.ts index --release ${pin.release}\` (an unreachable package writes an unread manifest, never none)`);
      continue;
    }
    if (m.release !== pin.release || m.fhirVersion !== pin.fhirVersion || m.spec !== pin.spec || JSON.stringify(m.package) !== JSON.stringify(pin.package)) {
      errors.push(`${relDir}/${MANIFEST_FILE}: names ${m.package.tarball} (${m.package.shasum}), not the pin's ${pin.package.tarball} (${pin.package.shasum}); re-run index`);
    }
    if (m.status === "unread") {
      notes.push(`${pin.release}: unread — ${m.reason}`);
      continue;
    }
    const known = new Set(m.definitions.map((d) => d.url));
    let model: FhirCoreClassModel | null = null;
    try {
      model = readClassModel(root, pin.release);
    } catch (e) {
      errors.push(`${relDir}/${CLASS_MODEL_FILE}: ${(e as Error).message}`);
    }
    if (model) {
      if (model.derivedFrom.tarball !== pin.package.tarball || model.derivedFrom.shasum !== pin.package.shasum) {
        errors.push(`${relDir}/${CLASS_MODEL_FILE}: derived from ${model.derivedFrom.tarball} (${model.derivedFrom.shasum}), not the pin's; re-run uml`);
      }
      const cited = new Set(model.classes.map((c) => c.definition));
      for (const u of cited) if (!known.has(u)) errors.push(`${relDir}/${CLASS_MODEL_FILE}: cites ${u}, which the manifest does not hold`);
      for (const u of known) if (!cited.has(u)) errors.push(`${relDir}/${CLASS_MODEL_FILE}: has no class for ${u}; re-run uml`);
    } else if (!existsSync(classModelPath(root, pin.release))) {
      errors.push(`${relDir}/${CLASS_MODEL_FILE}: missing — run \`fhir-core.ts uml --release ${pin.release}\``);
    }
    for (const f of readdirSync(releaseDir(root, pin.release))) {
      if (f !== MANIFEST_FILE && f !== CLASS_MODEL_FILE && f !== CACHE_DIR) errors.push(`${relDir}/${f}: not a manifest, class model or the cache`);
    }
    const dir = cacheDir(root, pin.release);
    let cached = 0;
    if (existsSync(dir)) {
      if (!existsSync(join(dir, CACHE_LABEL))) errors.push(`${relDir}/${CACHE_DIR}/: unlabelled — a cache says what it is a copy of (${CACHE_LABEL}); re-run materialise`);
      const listed = new Map(m.definitions.map((d) => [d.file, d]));
      for (const f of readdirSync(dir)) {
        if (f === CACHE_LABEL) continue;
        const d = listed.get(f);
        if (!d) {
          errors.push(`${relDir}/${CACHE_DIR}/${f}: no manifest entry names it`);
          continue;
        }
        cached++;
        if (sha256Hex(readFileSync(join(dir, f))) !== d.sha256) errors.push(`${relDir}/${CACHE_DIR}/${f}: bytes are not HL7's (sha256 differs from the manifest)`);
      }
    }
    notes.push(`${pin.release}: ${m.definitions.length} definitions at ${pin.spec}${model ? `, ${model.counts.classes} classes` : ""}, ${cached} cached`);
  }
  return { errors, notes };
}

export type Resolution =
  | { status: "found"; release: FhirRelease; published: string; cached?: string; definition: CoreDefinition }
  | { status: "absent"; release: FhirRelease }
  | { status: "undetermined"; release: FhirRelease; reason: string };

/** HL7's published URL for a canonical in one release, and the cached copy when there is one. */
export function resolveCanonical(root: string, url: string, release: FhirRelease): Resolution {
  const canonical = url.split("|")[0] ?? url;
  let m: FhirCoreReleaseManifest | null;
  try {
    m = readManifest(root, release);
  } catch (e) {
    return { status: "undetermined", release, reason: (e as Error).message };
  }
  if (!m) return { status: "undetermined", release, reason: "no manifest" };
  if (m.status === "unread") return { status: "undetermined", release, reason: `unread: ${m.reason}` };
  const d = m.definitions.find((x) => x.url === canonical);
  if (!d) return { status: "absent", release };
  const path = join(cacheDir(root, release), d.file);
  return { status: "found", release, published: d.published, ...(existsSync(path) ? { cached: path } : {}), definition: d };
}

/** A Mermaid class diagram of one class and the backbone classes it owns, from the class model. */
export function mermaidDiagram(model: FhirCoreClassModel, type: string): string | null {
  const byName = new Map(model.classes.map((c) => [c.name, c]));
  const root = byName.get(type);
  if (!root) return null;
  const shown = model.classes.filter((c) => c === root || c.name.startsWith(`${type}.`));
  const id = (n: string) => n.replace(/[^A-Za-z0-9_]/g, "_");
  const typeOf = (a: ClassAttribute) =>
    (byName.has(a.element) ? a.element : (a.contentReference ?? (a.types ?? []).map((t) => (t.targets ? `${t.code}(${t.targets.join("|")})` : t.code)).join("|"))).replace(/[<>]/g, "");
  const lines = ["classDiagram", `  %% FHIR ${model.release} ${type}, derived from ${model.derivedFrom.tarball}; source: ${root.published}`];
  for (const c of shown) {
    lines.push(`  class ${id(c.name)}["${c.name}"] {`);
    lines.push(`    <<${c.abstract ? "abstract " : ""}${c.stereotype}>>`);
    for (const a of c.attributes) lines.push(`    ${a.name.replace(/\[x\]$/, "_x_")} : ${typeOf(a)} [${a.min}..${a.max}]`);
    lines.push("  }");
  }
  for (const c of shown) {
    if (c.generalization) lines.push(`  ${id(c.generalization)} <|-- ${id(c.name)}`);
    if (c.owner) lines.push(`  ${id(c.owner)} *-- ${id(c.name)}`);
  }
  return `${lines.join("\n")}\n`;
}

function arg(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}

export async function main(argv: string[]): Promise<number> {
  const [cmd, ...rest] = argv;
  const root = resolve(arg(rest, "--root") ?? LAYER_ROOT);
  const relArg = arg(rest, "--release");
  const parsedRelease = relArg === undefined ? undefined : FhirReleaseSchema.safeParse(relArg.toUpperCase());
  if (parsedRelease && !parsedRelease.success) {
    console.error(`--release must be one of ${FhirReleaseSchema.options.join(", ")}`);
    return 2;
  }
  const release = parsedRelease?.data;
  const tgzDir = arg(rest, "--tgz-dir");
  const positional = rest.find((a, i) => !a.startsWith("--") && !["--root", "--release", "--tgz-dir"].includes(rest[i - 1] ?? ""));
  switch (cmd) {
    case "index":
      return (await indexReleases(root, { release, tgzDir })) ? 1 : 0;
    case "uml":
      return (await umlReleases(root, { release, tgzDir })) ? 2 : 0;
    case "materialise":
      return (await materialiseReleases(root, { release, tgzDir })) ? 2 : 0;
    case "check": {
      const r = checkCore(root);
      for (const n of r.notes) console.log(n);
      for (const e of r.errors) console.error(`error: ${e}`);
      return r.errors.length ? 1 : 0;
    }
    case "resolve": {
      if (!positional) {
        console.error("resolve needs a canonical URL");
        return 2;
      }
      const r = resolveCanonical(root, positional, release ?? "R4");
      if (r.status !== "found") {
        console.error(r.status === "absent" ? `${r.release} holds no ${positional}` : `could not determine: ${r.reason}`);
        return r.status === "absent" ? 1 : 2;
      }
      if (!rest.includes("--cache")) {
        console.log(r.published);
        return 0;
      }
      if (!r.cached) {
        console.error(`could not determine: ${r.definition.file} is not cached; run \`fhir-core.ts materialise --release ${r.release}\` (HL7's copy: ${r.published})`);
        return 2;
      }
      console.log(r.cached);
      return 0;
    }
    case "diagram": {
      if (!positional) {
        console.error("diagram needs a type name");
        return 2;
      }
      const model = readClassModel(root, release ?? "R4");
      if (!model) {
        console.error(`could not determine: no class model for ${release ?? "R4"}; run \`fhir-core.ts uml\``);
        return 2;
      }
      const out = mermaidDiagram(model, positional);
      if (!out) {
        console.error(`${model.release} has no class ${positional}`);
        return 1;
      }
      process.stdout.write(out);
      return 0;
    }
    default:
      console.error("usage: fhir-core.ts index|uml|materialise|check|resolve <url> [--cache]|diagram <Type> [--root DIR] [--release R4|R4B|R5] [--tgz-dir DIR]");
      return 2;
  }
}

if (import.meta.main) process.exit(await main(process.argv.slice(2)));
