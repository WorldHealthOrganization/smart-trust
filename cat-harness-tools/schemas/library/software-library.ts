/**
 * Software libraries — one outside library a layer's code IMPORTS, at the
 * version that layer's lockfile pins, with its licence, who imports it, and
 * the type shim that types it. **Never the bytes.**
 *
 * @module schemas/software-library
 * @graphNode schema
 *
 * A node answers "which licence does this library carry, which files import
 * it, and which shim types it" (e.g. `types/bpmn-moddle.d.ts`).
 *
 * ## The core, extended
 *
 * A library is {@link module:schemas/outside-software | `outside-software`}'s
 * core — name, version, digest, source, SPDX licence and `licenceSource` —
 * plus what only an imported library has:
 *
 * - `range` — the version range the layer's `package.json` asks for;
 * - `dev` — whether it is a `devDependencies` entry;
 * - `usedBy` — the layer's files that import it, layer-relative and sorted;
 * - `shim` — the `types/*.d.ts` that declares it, when one exists;
 * - `vendored` (1.1.0) — the directory its bytes are kept in, for a bundle the
 *   layer keeps rather than installs, which then has no `range` and no `dev`.
 *
 * It is a NODE KIND (`nodeKind()`) whose one parent is the core's mixin,
 * {@link OutsideSoftwareKind}. Two core fields are narrowed. `name` is an npm
 * package name, which may be scoped (`@scope/pkg`), so its ref splits at the
 * LAST `@`. `source` is a URL: a library comes from a registry tarball, never
 * an OCI image. The digest is the core's own, so it may be sha512 — what
 * `bun.lock` records.
 *
 * ## Generated, never hand-written
 *
 * A node is DERIVED from three inputs of the layer that imports it: its
 * `package.json` (range, dev), its `bun.lock` (version, integrity, tarball)
 * and the installed package's own `package.json` (licence). The writer is
 * `libraries:derive` and the gate `libraries:check`, both in the tools layer.
 *
 * ## One node per layer per library
 *
 * Each layer keeps its own `libraries/`, declared in its own `<name>.json`,
 * because each layer pins its own version in its own lockfile. A library two
 * layers share has two nodes, one in each, which may disagree on the version.
 *
 * ## The file name is not the `name`
 *
 * A node is `<file-stem>.library.json` ({@link libraryFileName}), so its stem
 * never equals its `name` field — the rule `findDeclarationFile` uses to
 * recognise an instance declaration (`directory-conventions`, §"Every other
 * marker"). The version is not in the file name, so a bump rewrites one file
 * rather than renaming it.
 *
 * ## A vendored bundle (1.1.0)
 *
 * Some layers keep a library's prebuilt bytes in the repository rather than
 * installing them — e.g. `scripts/assets/vendor/<name>/<version>/`, so a page
 * makes no request to a CDN. The imports INSIDE those bytes are not imports
 * the layer must declare.
 *
 * A vendored node has `vendored: { path }` — the bundle's directory,
 * layer-relative — and the same core: the name and version the bundle was
 * taken at, the registry tarball, its digest, and its licence with where that
 * was read. It has no `range` and no `dev`; every other node has both, so a
 * missing `range` is never silently "vendored". A vendored node is stamped
 * 1.1.0 (one stamped 1.0.0 is refused); a layer's own installed nodes are
 * stamped 1.0.0 ({@link librarySchemaTag}). Both families are listed in
 * the typology.
 *
 * Its file is {@link vendoredLibraryFileName} — the version IS in the name,
 * because a layer may keep two versions of one bundle side by side; a new
 * version is a new directory.
 *
 * ## A layer below the kind is held by the writer's layer (1.2.0)
 *
 * A layer below this kind's layer (bootstrap-tools needs only bootstrap) may
 * not name it, so it cannot declare a `libraries/`. Its nodes are held by the
 * layer that owns the writer, under `libraries/held/<layer>/`.
 *
 * A held node names the layer it describes in `layer` (the instance name, as
 * `needs` names it); pages place the node under that layer. `usedBy` and
 * `shim` stay relative to that layer, not to the holder. `layer` is present
 * exactly on a held node, which is stamped 1.2.0 ({@link librarySchemaTag}).
 */
import { z } from "zod";

import { nodeKind, parseSchemaTag } from "../kg/node-kind";
import { OutsideSoftwareKind, SoftwareUrlSourceSchema, outsideSoftwareLicenceProblem } from "./outside-software";
import type { SpdxLicenseList } from "./spdx-license-expression";

/**
 * The tag a library node carries, so it is identified by declaration. A short
 * SemVer name, the owner's convention for node kinds since 2026-10-05
 * (`schemas/kg/node-kind.ts`): the name is the kind, the version lives in the tag.
 *
 * Still 1.0.0, and on purpose: it is the tag a node of a `package.json`
 * dependency is stamped with, and every such node uses only 1.0.0 fields
 * ({@link librarySchemaTag}). A writer built before 1.1.0 stamps this constant,
 * so keeping its value is what lets the kind gain a version without making
 * every existing node read as stale, in whichever order the layers merge.
 */
export const SOFTWARE_LIBRARY_SCHEMA_TAG = "software-library/1.0.0";

/**
 * 1.1.0, which added `vendored`: what a vendored bundle's node is stamped
 * with. The kind's current version is {@link SOFTWARE_LIBRARY_HELD_TAG}.
 */
export const SOFTWARE_LIBRARY_VENDORED_TAG = "software-library/1.1.0";

/**
 * 1.2.0, which added `layer`: what a node held for a layer below the kind is
 * stamped with (§"A layer below the kind is held by the writer's layer").
 */
export const SOFTWARE_LIBRARY_HELD_TAG = "software-library/1.2.0";

/** Where the writer's layer keeps the nodes it holds for a layer below the kind: `libraries/held/<layer>/`. */
export const HELD_DIR = "held";

/** The suffix a vendored bundle's node file ends in, before {@link LIBRARY_FILE_SUFFIX}. */
export const VENDORED_INFIX = ".vendored";

/** The suffix every library node's file name ends in. */
export const LIBRARY_FILE_SUFFIX = ".library.json";

/**
 * An npm package name: lowercase, optionally scoped. `zod`, `@types/mdast`,
 * `typescript7` (an alias: the name the layer imports it by).
 */
export const LibraryNameSchema = z
  .string()
  .regex(
    /^(@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/,
    "an npm package name: lowercase letters, digits, `.`, `_` and `-`, optionally scoped as `@scope/name`",
  );

/** An instance name, as `needs` names it (`bootstrap-tools`). */
export const LayerNameSchema = z.string().regex(/^[a-z0-9][a-z0-9-]*$/, "an instance name, as `needs` names it");

/** A layer-relative POSIX path, never absolute and never above the layer. */
const LayerPathSchema = z
  .string()
  .min(1)
  .refine((p) => !p.startsWith("/") && !p.includes("\\") && !p.split("/").includes(".."), "layer-relative and POSIX, never above the layer");

/**
 * Where a vendored bundle's bytes are kept: its directory, layer-relative.
 * Strict, so a second field is added by a version bump, not by a writer.
 */
export const VendoredSchema = z
  .object({
    /** The bundle's directory, layer-relative (`scripts/assets/vendor/jquery/3.6.0`). */
    path: LayerPathSchema,
  })
  .strict();
export type Vendored = z.infer<typeof VendoredSchema>;

/**
 * One library a layer imports, as a `software-library/1.2.0` node kind: a
 * SUBCLASS of the {@link OutsideSoftwareKind} mixin, narrowing `name` and
 * `source` (declared in `overrides`, so neither shadows the core by accident)
 * and adding what only an imported library has. Strict, because its writer
 * emits exactly these keys and an extra one is a defect.
 */
export const SoftwareLibraryKind = nodeKind(
  SOFTWARE_LIBRARY_HELD_TAG,
  [OutsideSoftwareKind],
  {
    /** Narrowed from the core: an npm package name, as the layer's `package.json` names it. */
    name: LibraryNameSchema,
    /** Narrowed from the core: the registry tarball the lockfile resolved. */
    source: SoftwareUrlSourceSchema,
    /** The range the layer's `package.json` asks for (`^10.2.0`, `npm:typescript@^7.0.2`). Absent exactly when `vendored`. */
    range: z
      .string()
      .min(1)
      .refine((r) => !/[\r\n]/.test(r), "a range is one line")
      .optional(),
    /** A `devDependencies` entry rather than a `dependencies` one. Absent exactly when `vendored`. */
    dev: z.boolean().optional(),
    /** 1.1.0: the library's bytes are kept in the layer, at this directory, rather than installed. */
    vendored: VendoredSchema.optional(),
    /** 1.2.0: the layer this node describes, when it is held by another layer's `libraries/held/<layer>/`. Absent on a layer's own nodes. */
    layer: LayerNameSchema.optional(),
    /** The layer's files that import it, layer-relative, sorted and unique. Empty for a library reached another way (a CLI, a `types` entry). */
    usedBy: z.array(LayerPathSchema),
    /** The ambient declaration that types it, when the package ships none of its own. */
    shim: LayerPathSchema.refine((p) => /^types\/[^/]+\.d\.ts$/.test(p), "a shim is a `types/*.d.ts` file").optional(),
  },
  {
    overrides: ["name", "source"],
    strict: true,
    refine: (l, ctx) => {
      const sorted = [...new Set(l.usedBy)].sort();
      if (sorted.length !== l.usedBy.length || sorted.some((p, i) => p !== l.usedBy[i])) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["usedBy"], message: "`usedBy` is sorted and names each file once, so a regeneration diffs cleanly" });
      }
      if (l.layer !== undefined) {
        const t = parseSchemaTag(String(l.$schema));
        if (t && t.major === 1 && t.minor < 2) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["$schema"], message: "`layer` is a 1.2.0 field, so a held node is stamped `software-library/1.2.0` or newer" });
        }
      }
      if (l.vendored) {
        for (const k of ["range", "dev"] as const) {
          if (l[k] !== undefined) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [k], message: `a vendored bundle has no \`${k}\`: no package.json asks for it` });
        }
        const t = parseSchemaTag(String(l.$schema));
        if (t && t.major === 1 && t.minor < 1) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["$schema"], message: "`vendored` is a 1.1.0 field, so a vendored node is stamped `software-library/1.1.0` or newer" });
        }
      } else {
        for (const k of ["range", "dev"] as const) {
          if (l[k] === undefined) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [k], message: `\`${k}\` is required unless the library is \`vendored\`` });
        }
      }
    },
  },
);

/** The schema a `software-library/1.x` file is parsed with. */
export const SoftwareLibrarySchema = SoftwareLibraryKind.schema;
export type SoftwareLibrary = z.infer<typeof SoftwareLibrarySchema>;

/**
 * The file a library's node is kept in: `zod.library.json`,
 * `types__mdast.library.json` for `@types/mdast`.
 *
 * The scope's `@` is dropped and its `/` becomes `__`. Two libraries share a
 * file only if a layer depends on both `@a/b` and an unscoped package named
 * `a__b`; the writer refuses that rather than letting one overwrite the other.
 */
export function libraryFileName(name: string): string {
  const stem = name.startsWith("@") ? name.slice(1).replace("/", "__") : name;
  return `${stem}${LIBRARY_FILE_SUFFIX}`;
}

/**
 * The file a vendored bundle's node is kept in: `jquery-3.6.0.vendored.library.json`,
 * `lhncbc__ucum-lhc-8.0.0.vendored.library.json` for `@lhncbc/ucum-lhc` 8.0.0.
 *
 * The version is in the name, unlike {@link libraryFileName}, because a layer
 * may keep two versions of one bundle; and the `.vendored` infix keeps it
 * apart from the node of a `package.json` dependency of the same name.
 */
export function vendoredLibraryFileName(name: string, version: string): string {
  return libraryFileName(name).replace(LIBRARY_FILE_SUFFIX, `-${version}${VENDORED_INFIX}${LIBRARY_FILE_SUFFIX}`);
}

/**
 * The tag a node is stamped with: the OLDEST version that has every field it
 * uses. `software-library/1.2.0` for a held node (it has `layer`), 1.1.0 for
 * a vendored one, `software-library/1.0.0` for any other, so gaining a field
 * rewrites none of a layer's existing nodes.
 */
export function librarySchemaTag(l: { vendored?: unknown; layer?: unknown }): string {
  if (l.layer !== undefined) return SOFTWARE_LIBRARY_HELD_TAG;
  return l.vendored !== undefined ? SOFTWARE_LIBRARY_VENDORED_TAG : SOFTWARE_LIBRARY_SCHEMA_TAG;
}

/**
 * Is the library's licence a valid expression over the pinned SPDX License
 * List? The core's check, so a library and a tool release are judged by the
 * one parser `check:source-licence` uses.
 */
export function libraryLicenceProblem(l: Pick<SoftwareLibrary, "licence">, list: SpdxLicenseList): string | undefined {
  return outsideSoftwareLicenceProblem(l, list);
}
