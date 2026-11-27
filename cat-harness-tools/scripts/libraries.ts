#!/usr/bin/env bun
/**
 * Software libraries — write each layer's `libraries/` from its lockfile, or
 * check that it is current.
 *
 * @module scripts/libraries
 * @covers software-library — it derives every node of each declared `libraries/` directory, vendored bundles included, and fails on a stale node, an import no node names, a shim no node names, and a vendored bundle whose bytes or manifest it cannot vouch for
 *
 * The kind is cat-harness's (`schemas/library/software-library.ts`, a node kind on the
 * `outside-software` core it shares with `tool-release`); this is its writer
 * and its gate.
 *
 *   bun run cat libraries:derive                       write every layer that declares a software-library directory
 *   bun run cat libraries:derive --instance <name>     write one (a held layer too: `--instance bootstrap-tools`)
 *   bun run cat libraries:check                        fail on anything `libraries:derive` would change, and on what it cannot place
 *
 * Exit 0 clean · 1 a finding · 2 nothing to judge (no layer declares a
 * `software-library` directory, which is `could not determine`, never a pass).
 *
 * ## Where each field comes from
 *
 * | field | from |
 * |---|---|
 * | `name`, `range`, `dev` | the layer's `package.json`: `dependencies` and `devDependencies` |
 * | `version`, `digest`, `source` | the layer's `bun.lock`: the package's resolved `name@version`, its `sha512-` integrity (re-spelled in hex), and its registry tarball |
 * | `licence` | the INSTALLED package's own `package.json` — `license`, or the old `licenses` array — found the way Node resolves it, from the layer upwards; when it says `SEE LICENSE IN <file>`, that file, read as a vendored bundle's is (a listed licence's text is its id, any other `LicenseRef-<name>`) |
 * | `usedBy` | every code file of the layer whose imports name the package (parsed with the TypeScript compiler, so an import inside a comment or a string is not one) |
 * | `shim` | the `types/*.d.ts` whose `declare module "<name>"` declares it |
 *
 * An import of `x` that no dependency declares is satisfied by a node for
 * `@types/x` (scoped: `@types/scope__x`), which is how a types-only package
 * is imported. The platform's own layers (`@litlfred/*`, and every workspace
 * of the lockfile) are not outside software, so they get no node and their
 * imports are not findings.
 *
 * The lockfile carries no licence, so it is read from the installed package.
 * In an index checkout that install is the index's, so its version can differ
 * from the one the layer locks; the node keeps the LOCKED version and the
 * difference is printed, never refused.
 *
 * ## What `--check` refuses
 *
 * 1. **A stale node** — one whose file differs from what `libraries:derive`
 *    would write, a dependency with no node, and a node with no dependency.
 * 2. **An import that names no node** — a file importing a package the layer
 *    does not declare. It works only because something else installed it.
 * 3. **A shim that names no node** — a `types/*.d.ts` declaring a module the
 *    layer does not depend on, so it types nothing that is installed.
 * 4. A node that does not parse, or whose licence is not a valid expression
 *    over the PINNED SPDX License List (`check:source-licence`'s parser).
 * 5. Anything the writer could not determine — no `bun.lock`, a dependency
 *    the lockfile does not resolve from a registry, a package that is not
 *    installed, or one that states no licence. Each is a finding, never a
 *    quietly skipped node.
 * 6. A vendored bundle with no manifest, a manifest that does not parse or
 *    disagrees with its directory, a kept file whose bytes are not the sha256
 *    its manifest records (the node's digest vouches for the tarball, so the
 *    bytes must be the tarball's), or no licence to read.
 *
 * ## A vendored bundle is a node too
 *
 * A layer may keep a library's prebuilt bytes rather than install them: one
 * directory per bundle, `vendor/<name>/<version>/`, anywhere in the layer,
 * holding the bytes, the package's own licence file and a `vendored.json`
 * manifest ({@link VendoredManifestSchema}: the npm `package`, `version`,
 * `tarball`, `integrity`, and a sha256 per kept file). Each bundle gets ONE
 * node, `software-library/1.1.0` with `vendored: { path }` and no `range` or `dev`:
 *
 * | field | from |
 * |---|---|
 * | `name`, `version` | the manifest's `package` and `version` (the directory's `<version>` must agree) |
 * | `digest`, `source` | the manifest's `integrity` (re-spelled in hex) and `tarball` |
 * | `licence`, `licenceSource` | the bundle's own `package.json` when it kept one; else its licence file (`LICENSE`, `COPYING`, or a font's `OFL.txt`) — a text recognised as a listed licence ({@link recogniseLicenceText}: MIT, or the SIL OFL 1.1 under a font's notice) is that id, and any other is `LicenseRef-<name>`, SPDX's own name for a licence the list does not carry, whose text is that file |
 *
 * A bundle's files are not read for imports (they are what the bundle was
 * built from, not this layer's imports), and `usedBy` is empty: what loads a
 * bundle is a page or a path string, never an import.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { builtinModules } from "node:module";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import ts from "typescript";
import { z } from "zod";

import { defaultGraphTypologies, ownDirectories } from "../schemas/kg/cat-harness.js";
import { layerRootsIn } from "../schemas/kg/instance-roots.ts";
import {
  HELD_DIR,
  LIBRARY_FILE_SUFFIX,
  SoftwareLibrarySchema,
  libraryFileName,
  libraryLicenceProblem,
  librarySchemaTag,
  vendoredLibraryFileName,
  type SoftwareLibrary,
} from "../schemas/library/software-library.ts";
import { parseOutsideSoftwareRef } from "../schemas/library/outside-software.ts";
import { loadSpdxLicenseList } from "../schemas/library/spdx-license-expression.ts";

import { gateOwnInstances, nothingOwnLine } from "./lib/gate-own.ts";
import { reaches } from "./lib/needs-reach.ts";

/** The graph typology a `libraries/` directory is declared with. */
export const LIBRARY_KIND = "software-library";

/** Where an npm registry entry with no registry of its own (`""` in `bun.lock`) is fetched from. */
export const DEFAULT_REGISTRY = "https://registry.npmjs.org";

/** What `licenceSource` says for a node whose licence is read from the installed package's own manifest. */
export const LICENCE_SOURCE = "the installed package's own package.json (`license`)";

/** What `licenceSource` says when the installed package's own package.json names a licence file (`SEE LICENSE IN LICENSE`). */
export const SEE_LICENCE_SOURCE = "the licence file the installed package's own package.json names";

/** A code file whose imports are read. `.d.ts` included: a declaration file may import a package too. */
const CODE_FILE = /\.(?:[cm]?[jt]sx?)$/;

/** Directories never walked for imports: installs, VCS and hidden state, and build output. */
const SKIP_DIRS = new Set(["node_modules", "dist", "build", "_site", "_kg"]);

/** A bare specifier that could name a package (not a URL, a path or a placeholder). */
const PACKAGE_SPECIFIER = /^(@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*(\/.*)?$/i;

const BUILTINS = new Set(builtinModules);

/** The directory a layer keeps vendored bundles under, one per `<name>/<version>/`. */
export const VENDOR_DIR = "vendor";

/** The manifest every vendored bundle carries beside its bytes. */
export const VENDORED_MANIFEST = "vendored.json";

/**
 * What `libraries:derive` reads from a bundle's {@link VENDORED_MANIFEST}. Only
 * these keys; a manifest may carry more (a `_comment`, a `from`, a free-text
 * `licence`), which are its author's and not read.
 */
export const VendoredManifestSchema = z
  .object({
    /** The npm package the bytes were taken from. */
    package: z.string().min(1),
    version: z.string().min(1),
    /** The registry tarball they were taken from. */
    tarball: z.string().min(1),
    /** That tarball's `sha512-<base64>` integrity, as the registry gives it. */
    integrity: z.string().min(1),
    /** Each kept file, bundle-relative, with the sha256 of its bytes. */
    files: z.array(z.object({ path: z.string().min(1), sha256: z.string().regex(/^[0-9a-f]{64}$/) }).passthrough()).optional(),
  })
  .passthrough();

/** A bundle's licence file: `LICENSE`, `LICENCE.md`, `COPYING.txt`, or a font's `OFL.txt`. */
const LICENCE_FILE = /^(?:licen[cs]e|copying|ofl)(?:\.[a-z]+)?$/i;

/**
 * Licence texts recognised by their words, each with its SPDX id. Matched
 * WHOLE after {@link normaliseLicenceText} drops copyright lines, a title and
 * whitespace — a text with one more term is not this licence, and becomes a
 * `LicenseRef-`.
 */
const KNOWN_LICENCE_TEXTS: readonly { id: string; text: string }[] = [
  {
    id: "MIT",
    text: `Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.`,
  },
];

/** A licence text with its copyright lines and title dropped, lowercased, whitespace collapsed. */
export function normaliseLicenceText(text: string): string {
  return text
    .split(/\r?\n/)
    .filter((l) => !/^\s*(?:copyright\b|\(c\)|©|(?:the\s+)?mit\s+licen[cs]e\s*$)/i.test(l))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * The SIL Open Font License 1.1, from its heading to its disclaimer, as SIL
 * publishes it. A font project puts its copyright line and a standard notice
 * above it ({@link OFL_NOTICE}); nothing else may stand there.
 */
const OFL_11_BODY = `SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007
-----------------------------------------------------------

PREAMBLE
The goals of the Open Font License (OFL) are to stimulate worldwide
development of collaborative font projects, to support the font creation
efforts of academic and linguistic communities, and to provide a free and
open framework in which fonts may be shared and improved in partnership
with others.

The OFL allows the licensed fonts to be used, studied, modified and
redistributed freely as long as they are not sold by themselves. The
fonts, including any derivative works, can be bundled, embedded,
redistributed and/or sold with any software provided that any reserved
names are not used by derivative works. The fonts and derivatives,
however, cannot be released under any other type of license. The
requirement for fonts to remain under this license does not apply
to any document created using the fonts or their derivatives.

DEFINITIONS
"Font Software" refers to the set of files released by the Copyright
Holder(s) under this license and clearly marked as such. This may
include source files, build scripts and documentation.

"Reserved Font Name" refers to any names specified as such after the
copyright statement(s).

"Original Version" refers to the collection of Font Software components as
distributed by the Copyright Holder(s).

"Modified Version" refers to any derivative made by adding to, deleting,
or substituting -- in part or in whole -- any of the components of the
Original Version, by changing formats or by porting the Font Software to a
new environment.

"Author" refers to any designer, engineer, programmer, technical
writer or other person who contributed to the Font Software.

PERMISSION & CONDITIONS
Permission is hereby granted, free of charge, to any person obtaining
a copy of the Font Software, to use, study, copy, merge, embed, modify,
redistribute, and sell modified and unmodified copies of the Font
Software, subject to the following conditions:

1) Neither the Font Software nor any of its individual components,
in Original or Modified Versions, may be sold by itself.

2) Original or Modified Versions of the Font Software may be bundled,
redistributed and/or sold with any software, provided that each copy
contains the above copyright notice and this license. These can be
included either as stand-alone text files, human-readable headers or
in the appropriate machine-readable metadata fields within text or
binary files as long as those fields can be easily viewed by the user.

3) No Modified Version of the Font Software may use the Reserved Font
Name(s) unless explicit written permission is granted by the corresponding
Copyright Holder. This restriction only applies to the primary font name as
presented to the users.

4) The name(s) of the Copyright Holder(s) or the Author(s) of the Font
Software shall not be used to promote, endorse or advertise any
Modified Version, except to acknowledge the contribution(s) of the
Copyright Holder(s) and the Author(s) or with their explicit written
permission.

5) The Font Software, modified or unmodified, in part or in whole,
must be distributed entirely under this license, and must not be
distributed under any other license. The requirement for fonts to
remain under this license does not apply to any document created
using the Font Software.

TERMINATION
This license becomes null and void if any of the above conditions are
not met.

DISCLAIMER
THE FONT SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO ANY WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT
OF COPYRIGHT, PATENT, TRADEMARK, OR OTHER RIGHT. IN NO EVENT SHALL THE
COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
INCLUDING ANY GENERAL, SPECIAL, INDIRECT, INCIDENTAL, OR CONSEQUENTIAL
DAMAGES, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF THE USE OR INABILITY TO USE THE FONT SOFTWARE OR FROM
OTHER DEALINGS IN THE FONT SOFTWARE.`;

/** The OFL's heading, normalised: where the licence proper starts. */
const OFL_HEAD = "sil open font license version 1.1 - 26 february 2007";

/** The notice a font project puts above the OFL, normalised; the FAQ address varies. */
const OFL_NOTICE = /^this font software is licensed under the sil open font license, version 1\.1\. this license is copied below, and is also available with a faq at: \S+(?: \(or \S+\))?$/;

/** Whitespace collapsed, lowercased, the `-----` rules dropped: the OFL body is compared WHOLE, its copyright words included. */
const oflText = (text: string): string =>
  text
    .replace(/^\s*-{3,}\s*$/gm, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

/** `OFL-1.1` when the text is the OFL 1.1, whole, under nothing but copyright lines and the standard notice. */
function recogniseOfl(text: string): string | undefined {
  const t = oflText(text);
  const at = t.indexOf(OFL_HEAD);
  if (at < 0 || t.slice(at) !== oflText(OFL_11_BODY)) return undefined;
  const lines = text.split(/\r?\n/);
  const head = lines.findIndex((l) => l.trim().toLowerCase().startsWith("sil open font license version 1.1"));
  const notice = normaliseLicenceText(lines.slice(0, head).filter((l) => !/^\s*-{3,}\s*$/.test(l)).join("\n"));
  return notice === "" || OFL_NOTICE.test(notice) ? "OFL-1.1" : undefined;
}

/** The SPDX id of a licence text recognised whole, or `undefined`. */
export function recogniseLicenceText(text: string): string | undefined {
  const t = normaliseLicenceText(text);
  return KNOWN_LICENCE_TEXTS.find((k) => normaliseLicenceText(k.text) === t)?.id ?? recogniseOfl(text);
}

/** `LicenseRef-<name>`: the package name in SPDX idstring characters (`@lhncbc/ucum-lhc` → `LicenseRef-lhncbc-ucum-lhc`). */
export function licenseRefFor(name: string): string {
  return `LicenseRef-${name.replace(/^@/, "").replace(/[^A-Za-z0-9.-]+/g, "-")}`;
}

/** One layer the check judges: its root and the `libraries/` directory it declares. */
export interface LibraryLayer {
  name: string;
  root: string;
  dir: string;
  /** Set on a layer below the kind: the layer whose `libraries/held/<name>/` holds its nodes. */
  heldBy?: LibraryLayer;
}

/** What deriving one layer produced. */
export interface DerivedLayer {
  /** File name → node, for every dependency the writer could place. */
  nodes: Map<string, SoftwareLibrary>;
  /** Imports no node names: package → the files that import it. */
  unknownImports: Map<string, string[]>;
  /** Shims declaring a module no node names: module → shim file. */
  unknownShims: Map<string, string>;
  /** What could not be determined, each a finding. */
  problems: string[];
  /** Printed, never a finding. */
  notes: string[];
}

interface LockFile {
  workspaces?: Record<string, { name?: string }>;
  packages?: Record<string, unknown[]>;
}

/** Parse `bun.lock`, which is JSON with trailing commas. */
export function parseBunLock(text: string): LockFile {
  const jsonc = (Bun as unknown as { JSONC?: { parse(s: string): unknown } }).JSONC;
  if (jsonc) return jsonc.parse(text) as LockFile;
  return JSON.parse(text.replace(/,(\s*[}\]])/g, "$1")) as LockFile;
}

/** `sha512-<base64>` → 128 lowercase hex characters; `undefined` for anything else. */
export function sha512Hex(integrity: unknown): string | undefined {
  if (typeof integrity !== "string" || !integrity.startsWith("sha512-")) return undefined;
  const hex = Buffer.from(integrity.slice("sha512-".length), "base64").toString("hex");
  return /^[0-9a-f]{128}$/.test(hex) ? hex : undefined;
}

/** The package a bare specifier names: `@scope/pkg/sub` → `@scope/pkg`, `pkg/sub` → `pkg`. */
export function packageOf(specifier: string): string {
  const parts = specifier.split("/");
  return specifier.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0]!;
}

/** The `@types/` package that types `pkg`: `@types/pkg`, or `@types/scope__pkg` for `@scope/pkg`. */
export function typesPackageFor(pkg: string): string {
  return `@types/${pkg.startsWith("@") ? pkg.slice(1).replace("/", "__") : pkg}`;
}

/** The registry tarball npm serves a package version from. */
export function tarballUrl(registry: string, name: string, version: string): string {
  const base = (registry || DEFAULT_REGISTRY).replace(/\/+$/, "");
  const file = name.startsWith("@") ? name.split("/")[1]! : name;
  return `${base}/${name}/-/${file}-${version}.tgz`;
}

/** A package manifest's licence as one SPDX-ish string, or `undefined` when it states none. */
export function licenceOf(manifest: Record<string, unknown>): string | undefined {
  const one = (v: unknown): string | undefined =>
    typeof v === "string" ? v : typeof v === "object" && v !== null && typeof (v as { type?: unknown }).type === "string" ? (v as { type: string }).type : undefined;
  const l = one(manifest.license);
  if (l) return l.trim();
  if (Array.isArray(manifest.licenses)) {
    const all = manifest.licenses.map(one).filter((x): x is string => !!x);
    if (all.length === 1) return all[0];
    if (all.length > 1) return `(${all.join(" OR ")})`;
  }
  return undefined;
}

/** The installed manifest of `name`, resolved from `from` upwards the way Node does. */
export function installedManifest(from: string, name: string): { path: string; manifest: Record<string, unknown> } | undefined {
  let dir = resolve(from);
  for (;;) {
    const p = join(dir, "node_modules", name, "package.json");
    if (existsSync(p)) return { path: p, manifest: JSON.parse(readFileSync(p, "utf-8")) as Record<string, unknown> };
    const up = dirname(dir);
    if (up === dir) return undefined;
    dir = up;
  }
}

/** Every directory under `root` the import walk enters, layer-relative and POSIX (`""` for the root). */
/** The lockfiles that make a directory with a package.json its own package. */
const NESTED_LOCKFILES = ["bun.lock", "bun.lockb", "package-lock.json", "yarn.lock", "pnpm-lock.yaml"];

/**
 * Is `file` a layer declaration, rather than another JSON named like one?
 * A file that names a `$schema` other than `cat-harness-declaration/…` is not
 * (a concern-groups file); one naming none still is (bootstrap's declarations
 * carry no `$schema`).
 */
function isInstanceDeclarationFile(file: string): boolean {
  if (!existsSync(file)) return false;
  try {
    const schema = (JSON.parse(readFileSync(file, "utf-8")) as { $schema?: unknown }).$schema;
    return typeof schema !== "string" || schema.startsWith("cat-harness-declaration");
  } catch {
    // Unreadable: keep the old reading, so a broken declaration still bounds the walk.
    return true;
  }
}

function walkDirs(root: string, visit: (rel: string, abs: string) => boolean | void): void {
  const walk = (dir: string): void => {
    if (visit(relative(root, dir).split(sep).join("/"), dir) === false) return;
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (!e.isDirectory() || e.name.startsWith(".") || SKIP_DIRS.has(e.name)) continue;
      const p = join(dir, e.name);
      // Another layer nested inside this one is its own layer. Its
      // `<name>.json` must BE a layer declaration: a grouped graph's
      // from-within file has the same shape of name (`schemas/schemas.json`,
      // `concern-groups/v1`, bean `f8wp`) and its directory is still ours.
      if (isInstanceDeclarationFile(join(p, `${e.name}.json`)) && existsSync(join(p, "package.json"))) continue;
      // So is a nested package with its own lockfile (cat-harness's
      // `schemas/block-qa-schema`): it pins its own dependencies, and its
      // imports are judged against its own package.json, not the layer's.
      if (existsSync(join(p, "package.json")) && NESTED_LOCKFILES.some((f) => existsSync(join(p, f)))) continue;
      walk(p);
    }
  };
  walk(root);
}

/**
 * Every vendored bundle under `root`: each `<name>/<version>/` directory of a
 * directory named {@link VENDOR_DIR}, layer-relative and POSIX, sorted.
 */
export function vendoredBundles(root: string): string[] {
  const out: string[] = [];
  walkDirs(root, (rel, abs) => {
    if (basename(abs) !== VENDOR_DIR || rel === "") return;
    for (const n of readdirSync(abs, { withFileTypes: true })) {
      if (!n.isDirectory() || n.name.startsWith(".")) continue;
      for (const v of readdirSync(join(abs, n.name), { withFileTypes: true })) {
        if (v.isDirectory() && !v.name.startsWith(".")) out.push(`${rel}/${n.name}/${v.name}`);
      }
    }
  });
  return out.sort();
}

/** Every code file under `root`, layer-relative and POSIX, sorted — never one inside a directory of `skip` (a vendored bundle). */
export function codeFiles(root: string, skip: ReadonlySet<string> = new Set()): string[] {
  const out: string[] = [];
  walkDirs(root, (rel, abs) => {
    if (skip.has(rel)) return false;
    for (const e of readdirSync(abs, { withFileTypes: true })) {
      if (e.isFile() && CODE_FILE.test(e.name)) out.push(relative(root, join(abs, e.name)).split(sep).join("/"));
    }
  });
  return out.sort();
}

/** The sha256 of a file's bytes, as 64 lowercase hex characters. */
function sha256Of(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

/**
 * One vendored bundle's node, from its manifest and its own licence file, or
 * the problems that kept it from being written. Never throws for a problem in
 * the inputs.
 */
export function deriveVendored(root: string, bundle: string): { node?: SoftwareLibrary; problems: string[] } {
  const dir = join(root, bundle);
  const manifestPath = join(dir, VENDORED_MANIFEST);
  if (!existsSync(manifestPath)) {
    return { problems: [`${bundle}: a vendored bundle with no ${VENDORED_MANIFEST} — could not determine where its bytes came from`] };
  }
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(manifestPath, "utf-8"));
  } catch (e) {
    return { problems: [`${bundle}/${VENDORED_MANIFEST}: not JSON — ${(e as Error).message}`] };
  }
  const parsed = VendoredManifestSchema.safeParse(raw);
  if (!parsed.success) {
    return { problems: [`${bundle}/${VENDORED_MANIFEST}: ${parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ")}`] };
  }
  const m = parsed.data;
  const problems: string[] = [];
  if (basename(bundle) !== m.version) problems.push(`${bundle}: the directory says version ${basename(bundle)}, its ${VENDORED_MANIFEST} says ${m.version}`);
  const digest = sha512Hex(m.integrity);
  if (!digest) problems.push(`${bundle}/${VENDORED_MANIFEST}: \`integrity\` is not a sha512 integrity`);
  for (const f of m.files ?? []) {
    const p = join(dir, f.path);
    if (!existsSync(p) || !statSync(p).isFile()) problems.push(`${bundle}/${f.path}: named by ${VENDORED_MANIFEST}, and not there`);
    else if (sha256Of(p) !== f.sha256) problems.push(`${bundle}/${f.path}: its bytes are not the sha256 ${VENDORED_MANIFEST} records — a vendored file is kept unmodified`);
  }
  // The licence: the bundle's own package.json, else its own licence file.
  let licence: string | undefined;
  let licenceSource: string | undefined;
  const ownPkg = join(dir, "package.json");
  if (existsSync(ownPkg)) {
    try {
      licence = licenceOf(JSON.parse(readFileSync(ownPkg, "utf-8")) as Record<string, unknown>);
      if (licence) licenceSource = `${bundle}/package.json`;
    } catch {
      // not JSON: fall through to the licence file
    }
  }
  if (!licence) {
    const file = readdirSync(dir).filter((f) => LICENCE_FILE.test(f)).sort()[0];
    if (file) {
      licence = recogniseLicenceText(readFileSync(join(dir, file), "utf-8")) ?? licenseRefFor(m.package);
      licenceSource = `${bundle}/${file}`;
    }
  }
  if (!licence || !licenceSource) problems.push(`${bundle}: no package.json licence and no licence file — could not determine its licence`);
  if (problems.length > 0 || !digest || !licence || !licenceSource) return { problems };
  const node = {
    $schema: librarySchemaTag({ vendored: true }),
    name: m.package,
    version: m.version,
    digest: { algorithm: "sha512", digest },
    source: { type: "url", url: m.tarball },
    licence,
    licenceSource,
    vendored: { path: bundle },
    usedBy: [],
  } as SoftwareLibrary;
  const check = SoftwareLibrarySchema.safeParse(node);
  if (!check.success) {
    return { problems: [`${bundle}: ${check.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`] };
  }
  return { node, problems: [] };
}

/** The module specifiers a file imports, and the modules it declares ambiently. */
export function readModuleRefs(fileName: string, text: string): { imports: string[]; ambient: string[]; typeRefs: string[] } {
  const sf = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, false);
  const imports: string[] = [];
  const ambient: string[] = [];
  const lit = (n: ts.Node | undefined): string | undefined =>
    n && (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) ? n.text : undefined;
  const visit = (n: ts.Node): void => {
    if ((ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) && n.moduleSpecifier) {
      const s = lit(n.moduleSpecifier);
      if (s) imports.push(s);
    } else if (ts.isImportEqualsDeclaration(n) && ts.isExternalModuleReference(n.moduleReference)) {
      const s = lit(n.moduleReference.expression);
      if (s) imports.push(s);
    } else if (ts.isCallExpression(n)) {
      const callee = n.expression;
      if (callee.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(callee) && callee.text === "require") ||
          (ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.expression) && callee.expression.text === "require" && callee.name.text === "resolve")) {
        const s = lit(n.arguments[0]);
        if (s) imports.push(s);
      }
    } else if (ts.isImportTypeNode(n) && ts.isLiteralTypeNode(n.argument)) {
      const s = lit(n.argument.literal);
      if (s) imports.push(s);
    } else if (ts.isModuleDeclaration(n) && ts.isStringLiteral(n.name)) {
      ambient.push(n.name.text);
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return { imports, ambient, typeRefs: sf.typeReferenceDirectives.map((r) => r.fileName) };
}

/** Is a specifier one no node is owed for: relative, absolute, a builtin, or a runtime's own module? */
function isOwnOrBuiltin(spec: string): boolean {
  if (spec.startsWith(".") || spec.startsWith("/") || spec.startsWith("node:") || spec.startsWith("bun:") || spec === "bun") return true;
  return BUILTINS.has(spec) || BUILTINS.has(packageOf(spec));
}

/**
 * ## A layer below the kind is held here
 *
 * Owner, 2026-10-30 (bootstrap-tools#44, "A. Holder records, keyed by
 * layer"). A layer that does not reach the kind's own layer through `needs`
 * (bootstrap-tools needs only bootstrap) may not name `software-library`, so
 * it declares no `libraries/`. This layer, which owns the writer and the gate,
 * holds its nodes instead, under `libraries/held/<layer>/`, each stamped
 * `software-library/1.2.0` with `layer: "<layer>"`. It is the glossary's rule
 * (bean `q3n9`: core holds the schemes of the layers below its typology, keyed
 * by their owning layer), applied to libraries.
 *
 * The held set is DERIVED, never listed: every layer in the checkout that
 * has a `package.json`, declares no `software-library` directory, is not
 * {@link KIND_OWNER}, and does not reach it through `needs`. A layer that does
 * reach it declares its own `libraries/` instead, and is never held. The nodes
 * are derived at the holder's pins, so they move with a re-pin of the layer
 * they describe, in the same PR.
 */

/** The layer that owns the `software-library` kind. A layer that reaches it through `needs` declares its own `libraries/`. */
export const KIND_OWNER = "cat-harness";

/** The layer that holds the nodes of the layers below the kind: this script's own. */
export const HOLDER = basename(resolve(import.meta.dir, ".."));

/** `needs` as each layer in the checkout declares it, by layer name. */
function needsByInstance(repoRoot: string): Map<string, { root: string; needs: string[] }> {
  const out = new Map<string, { root: string; needs: string[] }>();
  for (const root of layerRootsIn(repoRoot)) {
    const name = basename(root);
    const decl = join(root, `${name}.json`);
    let needs: string[] = [];
    try {
      const d = JSON.parse(readFileSync(decl, "utf-8")) as { needs?: unknown };
      if (Array.isArray(d.needs)) needs = d.needs.filter((n): n is string => typeof n === "string");
    } catch {
      // No readable declaration: no `needs` to follow. The layer is still listed.
    }
    out.set(name, { root, needs });
  }
  return out;
}

/**
 * The layers the holder records, each as a {@link LibraryLayer} whose `dir`
 * is `<holder libraries>/held/<layer>/` (§"A layer below the kind is held
 * here"). `own` is the holder's own entry from {@link libraryLayers}; with no
 * holder in the checkout nothing is held.
 */
export function heldLayers(repoRoot: string, own: readonly LibraryLayer[], holder: string = HOLDER): LibraryLayer[] {
  const holderLayer = own.find((l) => l.name === holder && !l.heldBy);
  if (!holderLayer) return [];
  const declaring = new Set(own.map((l) => l.name));
  const graph = needsByInstance(repoRoot);
  const needsOf = new Map([...graph].map(([n, { needs }]) => [n, needs] as const));
  const out: LibraryLayer[] = [];
  for (const [name, { root }] of [...graph.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    if (declaring.has(name) || name === KIND_OWNER || reaches(needsOf, name, KIND_OWNER)) continue;
    if (!existsSync(join(root, "package.json"))) continue;
    out.push({ name, root, dir: join(holderLayer.dir, HELD_DIR, name), heldBy: holderLayer });
  }
  return out;
}

/** The held directories on disk that no held layer in the checkout accounts for. */
export function strayHeldDirs(holder: LibraryLayer, held: readonly LibraryLayer[]): string[] {
  const dir = join(holder.dir, HELD_DIR);
  if (!existsSync(dir)) return [];
  const known = new Set(held.map((l) => l.name));
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !known.has(e.name))
    .map((e) => e.name)
    .sort();
}

/**
 * A held layer's nodes: each says which layer it describes and is stamped the
 * version that has `layer`. `usedBy` and `shim` stay relative to that layer.
 */
export function asHeld(derived: DerivedLayer, layer: string): DerivedLayer {
  const nodes = new Map<string, SoftwareLibrary>();
  for (const [f, n] of derived.nodes) {
    const { $schema: _s, ...rest } = n;
    const node = { $schema: librarySchemaTag({ ...rest, layer }), layer, ...rest } as SoftwareLibrary;
    nodes.set(f, node);
  }
  return { ...derived, nodes };
}

/**
 * Derive one layer's nodes from its `package.json`, `bun.lock`, installed
 * packages and code. Never throws for a problem in the inputs: each is a
 * `problems` entry.
 */
export function deriveLayer(root: string): DerivedLayer {
  const out: DerivedLayer = { nodes: new Map(), unknownImports: new Map(), unknownShims: new Map(), problems: [], notes: [] };
  const pkgPath = join(root, "package.json");
  const lockPath = join(root, "bun.lock");
  if (!existsSync(pkgPath)) {
    out.problems.push("no package.json — could not determine what this layer imports");
    return out;
  }
  if (!existsSync(lockPath)) {
    out.problems.push("no bun.lock — could not determine the versions this layer pins");
    return out;
  }
  const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
  let lock: LockFile;
  try {
    lock = parseBunLock(readFileSync(lockPath, "utf-8"));
  } catch (e) {
    out.problems.push(`bun.lock does not parse — ${(e as Error).message}`);
    return out;
  }
  const workspaces = new Set(Object.values(lock.workspaces ?? {}).map((w) => w.name).filter((n): n is string => !!n));
  const ours = (name: string): boolean => workspaces.has(name) || name.startsWith("@litlfred/");

  // The dependencies, runtime first so a name in both is a runtime one.
  const deps = new Map<string, { range: string; dev: boolean }>();
  for (const [name, range] of Object.entries(pkg.devDependencies ?? {})) deps.set(name, { range, dev: true });
  for (const [name, range] of Object.entries(pkg.dependencies ?? {})) deps.set(name, { range, dev: false });
  for (const name of [...deps.keys()]) if (ours(name)) deps.delete(name);

  // Who imports what, and which shim declares what.
  const usedBy = new Map<string, Set<string>>();
  const shims = new Map<string, string>();
  const nodeFor = (spec: string): string | undefined => {
    const p = packageOf(spec);
    if (deps.has(p)) return p;
    const t = typesPackageFor(p);
    return deps.has(t) ? t : undefined;
  };
  const bundles = vendoredBundles(root);
  for (const file of codeFiles(root, new Set(bundles))) {
    const refs = readModuleRefs(file, readFileSync(join(root, file), "utf-8"));
    const isShim = /^types\/[^/]+\.d\.ts$/.test(file);
    for (const m of refs.ambient) {
      if (!isShim || !PACKAGE_SPECIFIER.test(m)) continue;
      if (deps.has(packageOf(m))) shims.set(packageOf(m), file);
      else out.unknownShims.set(m, file);
    }
    for (const spec of [...refs.imports, ...refs.typeRefs]) {
      if (isOwnOrBuiltin(spec) || !PACKAGE_SPECIFIER.test(spec) || ours(packageOf(spec))) continue;
      const node = nodeFor(spec);
      if (node) {
        const s = usedBy.get(node) ?? new Set<string>();
        s.add(file);
        usedBy.set(node, s);
      } else {
        const p = packageOf(spec);
        out.unknownImports.set(p, [...new Set([...(out.unknownImports.get(p) ?? []), file])].sort());
      }
    }
  }

  const fileOf = new Map<string, string>();
  for (const [name, { range, dev }] of [...deps.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const entry = lock.packages?.[name];
    if (!Array.isArray(entry) || typeof entry[0] !== "string") {
      out.problems.push(`${name}: bun.lock does not resolve it — run \`bun install\` in the layer`);
      continue;
    }
    const resolved = parseOutsideSoftwareRef(entry[0]);
    if (!resolved || /[:/#]/.test(resolved.version)) {
      out.problems.push(`${name}: bun.lock resolves it to \`${entry[0]}\`, which is not a registry release — a library node needs a registry tarball`);
      continue;
    }
    const digest = sha512Hex(entry[3]);
    if (!digest) {
      out.problems.push(`${name}: bun.lock records no sha512 integrity for \`${entry[0]}\``);
      continue;
    }
    const installed = installedManifest(root, name);
    if (!installed) {
      out.problems.push(`${name}: not installed, so its licence could not be read — run \`bun install\``);
      continue;
    }
    let licence = licenceOf(installed.manifest);
    let licenceSource = LICENCE_SOURCE;
    if (!licence) {
      out.problems.push(`${name}: its installed package.json states no licence`);
      continue;
    }
    // npm's "SEE LICENSE IN <file>" names a licence file instead of an id: read
    // that file, as a vendored bundle's is (a listed licence's text is its id,
    // any other is `LicenseRef-<name>`).
    const see = /^SEE LICEN[CS]E IN (\S+)$/i.exec(licence);
    if (see) {
      const file = join(dirname(installed.path), see[1]);
      if (!existsSync(file)) {
        out.problems.push(`${name}: its package.json says \`${licence}\`, and the installed package has no such file`);
        continue;
      }
      licence = recogniseLicenceText(readFileSync(file, "utf-8")) ?? licenseRefFor(name);
      licenceSource = `${SEE_LICENCE_SOURCE} (\`${see[1]}\`)`;
    }
    if (installed.manifest.version !== resolved.version) {
      out.notes.push(`${name}: licence read from the installed ${String(installed.manifest.version)}; the layer locks ${resolved.version}`);
    }
    const file = libraryFileName(name);
    const clash = fileOf.get(file);
    if (clash) {
      out.problems.push(`${name}: its file \`${file}\` is already ${clash}'s — rename one dependency`);
      continue;
    }
    fileOf.set(file, name);
    const shim = shims.get(name);
    out.nodes.set(file, {
      $schema: librarySchemaTag({}),
      name,
      version: resolved.version,
      range,
      dev,
      digest: { algorithm: "sha512", digest },
      source: { type: "url", url: tarballUrl(typeof entry[1] === "string" ? entry[1] : "", resolved.name, resolved.version) },
      licence,
      licenceSource,
      ...(shim ? { shim } : {}),
      usedBy: [...(usedBy.get(name) ?? [])].sort(),
    } as SoftwareLibrary);
  }

  // The vendored bundles: one node each, from the bundle's own manifest.
  for (const bundle of bundles) {
    const v = deriveVendored(root, bundle);
    out.problems.push(...v.problems);
    if (!v.node) continue;
    const file = vendoredLibraryFileName(v.node.name, v.node.version);
    const clash = fileOf.get(file);
    if (clash) {
      out.problems.push(`${bundle}: its file \`${file}\` is already ${clash}'s`);
      continue;
    }
    fileOf.set(file, bundle);
    out.nodes.set(file, v.node);
  }
  return out;
}

/** A node as the writer writes it: two-space JSON and a final newline. */
export function renderNode(node: SoftwareLibrary): string {
  return `${JSON.stringify(node, null, 2)}\n`;
}

/** Every layer in the checkout that declares a `software-library` directory of its own. */
export function libraryLayers(repoRoot: string): LibraryLayer[] {
  const out: LibraryLayer[] = [];
  for (const root of layerRootsIn(repoRoot)) {
    const name = basename(root);
    let dirs;
    try {
      dirs = ownDirectories({ name, root, own: true }, defaultGraphTypologies);
    } catch {
      continue;
    }
    for (const d of dirs) {
      if (d.graphTypologies.includes(LIBRARY_KIND) && d.declaredBy !== "(default)") out.push({ name, root, dir: d.absPath });
    }
  }
  return out;
}

/** The node files a directory holds now. */
function existingNodeFiles(dir: string): string[] {
  return existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(LIBRARY_FILE_SUFFIX)).sort() : [];
}

/**
 * Everything `--check` refuses for one layer, given what deriving it produced.
 * Pure over the directory's current files, so a test can call it.
 */
export function layerFindings(layer: LibraryLayer, derived: DerivedLayer, spdx: Parameters<typeof libraryLicenceProblem>[1] | string): string[] {
  const base = layer.heldBy ?? layer;
  const label = base.name;
  const where = (f: string): string => relative(base.root, join(layer.dir, f)).split(sep).join("/");
  const findings = derived.problems.map((p) => `${layer.name}: ${p}`);
  const onDisk = existingNodeFiles(layer.dir);
  for (const f of onDisk) {
    const text = readFileSync(join(layer.dir, f), "utf-8");
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch (e) {
      findings.push(`${label}/${where(f)}: not JSON — ${(e as Error).message}`);
      continue;
    }
    const parsed = SoftwareLibrarySchema.safeParse(raw);
    if (!parsed.success) {
      findings.push(`${label}/${where(f)}: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
    } else if (typeof spdx !== "string") {
      const problem = libraryLicenceProblem(parsed.data, spdx);
      if (problem) findings.push(`${label}/${where(f)}: licence \`${parsed.data.licence}\` — ${problem}`);
    }
    const want = derived.nodes.get(f);
    if (!want) findings.push(`${label}/${where(f)}: stale — no dependency of the layer is this library; run \`bun run cat libraries:derive\``);
    else if (renderNode(want) !== text) findings.push(`${label}/${where(f)}: stale — \`libraries:derive\` would rewrite it`);
  }
  for (const f of derived.nodes.keys()) {
    if (!onDisk.includes(f)) findings.push(`${label}/${where(f)}: missing — \`${derived.nodes.get(f)!.name}\` is a dependency with no node; run \`bun run cat libraries:derive\``);
  }
  if (typeof spdx === "string") findings.push(`${layer.name}: licences could not be checked — ${spdx}`);
  for (const [p, files] of derived.unknownImports) {
    findings.push(`${layer.name}: \`${p}\` is imported by ${files.slice(0, 3).join(", ")}${files.length > 3 ? ` and ${files.length - 3} more` : ""}, and no node names it — declare it in package.json`);
  }
  for (const [m, file] of derived.unknownShims) {
    findings.push(`${layer.name}/${file}: declares \`${m}\`, and no node names it — the layer does not depend on what this shim types`);
  }
  return findings;
}

/** Write one layer's nodes: rewrite what differs, add what is missing, remove what no dependency names. */
export function writeLayer(layer: LibraryLayer, derived: DerivedLayer): { written: number; removed: number } {
  mkdirSync(layer.dir, { recursive: true });
  let written = 0;
  let removed = 0;
  for (const [f, node] of derived.nodes) {
    const p = join(layer.dir, f);
    const text = renderNode(node);
    if (!existsSync(p) || readFileSync(p, "utf-8") !== text) {
      writeFileSync(p, text);
      written++;
    }
  }
  for (const f of existingNodeFiles(layer.dir)) {
    if (!derived.nodes.has(f)) {
      rmSync(join(layer.dir, f));
      removed++;
    }
  }
  return { written, removed };
}

export function main(argv: readonly string[], repoRoot = resolve(import.meta.dir, "..", "..")): number {
  const check = argv.includes("--check");
  const only = argv.includes("--instance") ? argv[argv.indexOf("--instance") + 1] : undefined;
  const ownScope = check && !only ? gateOwnInstances() : undefined;
  const own = libraryLayers(repoRoot);
  const held = heldLayers(repoRoot, own);
  let layers = [...own, ...held];
  if (only) layers = layers.filter((l) => l.name === only || resolve(l.root) === resolve(only));
  if (ownScope) {
    layers = layers.filter((l) => ownScope.has((l.heldBy ?? l).name));
    if (layers.length === 0) {
      console.log(nothingOwnLine("libraries:check", "software-library directory", ownScope));
      return 0;
    }
  }
  if (layers.length === 0) {
    console.error(
      only
        ? `No layer named \`${only}\` declares a \`${LIBRARY_KIND}\` directory — could not determine, not a pass.`
        : `No layer declares a \`${LIBRARY_KIND}\` directory — could not determine, not a pass.`,
    );
    return 2;
  }
  const spdx = loadSpdxLicenseList(repoRoot);
  const findings: string[] = [];
  for (const layer of layers) {
    const derived = layer.heldBy ? asHeld(deriveLayer(layer.root), layer.name) : deriveLayer(layer.root);
    for (const n of derived.notes) console.log(`  · ${layer.name}: ${n}`);
    if (!check) {
      const { written, removed } = writeLayer(layer, derived);
      console.log(`${layer.name}: ${derived.nodes.size} librar${derived.nodes.size === 1 ? "y" : "ies"} in ${relative(repoRoot, layer.dir)}/ — ${written} written, ${removed} removed`);
    } else {
      console.log(`${layer.name}: ${derived.nodes.size} librar${derived.nodes.size === 1 ? "y" : "ies"} derived for ${relative(repoRoot, layer.dir)}/`);
    }
    findings.push(...layerFindings(layer, derived, spdx));
  }
  // A held directory for a layer the checkout does not hold: could not
  // determine whether it is current, never a pass, and never deleted here.
  const holder = own.find((l) => l.name === HOLDER);
  if (holder && !only && (!ownScope || ownScope.has(holder.name))) {
    for (const d of strayHeldDirs(holder, held)) {
      findings.push(`${HOLDER}/${relative(holder.root, join(holder.dir, HELD_DIR, d)).split(sep).join("/")}: no layer named \`${d}\` below the kind is in this checkout — could not determine whether its nodes are current`);
    }
  }
  if (findings.length > 0) {
    console.error(`\n✗ ${findings.length} finding(s):`);
    for (const f of findings) console.error(`    ${f}`);
    return 1;
  }
  console.log(
    check
      ? "\n✓ every library node is current, every import names a node, every shim names a node, and every licence is on the pinned SPDX list"
      : "\n✓ written; nothing left that `libraries:check` would refuse",
  );
  return 0;
}

if (import.meta.main) process.exit(main(process.argv.slice(2)));
