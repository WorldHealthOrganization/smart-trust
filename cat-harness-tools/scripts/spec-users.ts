/**
 * What in this repository uses each external specification — read from the
 * USERS, never from the specification's record.
 *
 * Each user declares the spec it conforms to (records under
 * `external-schemas/` list no dependents). Three direct forms, one per kind
 * of file, and one derived:
 *
 * | form | where | example |
 * |---|---|---|
 * | `tag` | a `@conformsTo <spec-id>` line in a TypeScript/JavaScript doc comment | `schemas/kg/jsonld.ts` |
 * | `front-matter` | a `conformsTo:` list in a markdown file's front matter | a skill |
 * | `xmlns` | an XML namespace binding to one of the spec's namespaces — the file's own declaration, in its own syntax | every `.bpmn` |
 * | `kind` | a graph typology (or one `$schema` family of it) whose validator or shape module declares the spec | `folio-dublin-core/v1` → `dublin-core.ts` |
 *
 * The last is not a second authored list: a `*.dc.json` record declares its
 * `$schema`, the registry says which module types that family, and that module
 * declares the specification.
 *
 * A declaration naming a spec id no record has is a finding — the same shape
 * as a dangling `@ref`.
 *
 * @module scripts/spec-users
 */
import { readFileSync } from "node:fs";
import { extname, join } from "node:path";

export type SpecUseForm = "tag" | "front-matter" | "xmlns" | "kind";

/** One user of one specification. */
export interface SpecUse {
  spec: string;
  /** A repository-relative file, or for `kind`, the graph typology / `$schema` family. */
  user: string;
  form: SpecUseForm;
  /** For `kind`: the module whose declaration it inherits. */
  via?: string;
}

export interface SpecUsers {
  uses: SpecUse[];
  /** Declarations naming a spec id no record has. */
  unknown: { user: string; spec: string }[];
}

/** The part of an external-schema record this needs. */
export interface SpecRef {
  id: string;
  namespaces: readonly string[];
}

/** The part of a graph typology this needs: its validator, and per-family refs. */
export interface KindRef {
  validator?: string;
  nodeSchemas?: Readonly<Record<string, { validator?: string; shape?: string }>>;
}

const TAG = /^\s*(?:\*|\/\/|\/\*\*?)\s*@conformsTo\s+([a-z0-9][a-z0-9.-]*)\s*$/gm;

/** Every spec id a source file's doc comments declare. */
export function taggedSpecs(source: string): string[] {
  return [...new Set([...source.matchAll(TAG)].map((m) => m[1]!))];
}

/** Every spec id a markdown file's front matter declares under `conformsTo:`. */
export function frontMatterSpecs(text: string): string[] {
  // The shared reader (`front-matter.ts`) takes scalars only, by design; a
  // list is YAML, parsed as `kg-audit` parses its front-matter lists.
  const block = /^---\n([\s\S]*?)\n---/.exec(text)?.[1];
  if (block === undefined || !/^conformsTo:/m.test(block)) return [];
  let parsed: unknown;
  try {
    parsed = Bun.YAML.parse(block);
  } catch {
    return [];
  }
  const v = (parsed as Record<string, unknown>)["conformsTo"];
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === "string") return v.split(/[\s,]+/).filter(Boolean);
  return [];
}

/** Every XML namespace IRI a file binds with `xmlns` / `xmlns:prefix`. */
export function boundNamespaces(xml: string): string[] {
  return [...new Set([...xml.matchAll(/\sxmlns(?::[\w.-]+)?="([^"]+)"/g)].map((m) => m[1]!))];
}

/**
 * The module file a registry ref names: `module#Export`, optionally prefixed
 * by the layer that holds it (`folio-assistant-core:schemas/x.ts#X`).
 * Unprefixed refs are relative to `defaultInstance`.
 */
export function refModule(ref: string, defaultInstance: string): string {
  const path = ref.split("#")[0]!;
  const colon = path.indexOf(":");
  return colon > 0 ? join(path.slice(0, colon), path.slice(colon + 1)) : join(defaultInstance, path);
}

/**
 * Every user of every spec.
 *
 * @param repo the repository root
 * @param files repository-relative files to read (the tracked set)
 * @param specs the external-schema records
 * @param kinds the graph-typology registry
 * @param kindsInstance the layer directory the registry's unprefixed refs are relative to
 */
export function specUsers(
  repo: string,
  files: readonly string[],
  specs: readonly SpecRef[],
  kinds: Readonly<Record<string, KindRef>>,
  kindsInstance: string,
): SpecUsers {
  const known = new Set(specs.map((s) => s.id));
  const byNamespace = new Map<string, string>();
  for (const s of specs) for (const n of s.namespaces) byNamespace.set(n, s.id);

  const uses: SpecUse[] = [];
  const unknown: { user: string; spec: string }[] = [];
  const declaredBy = new Map<string, string[]>();
  const record = (user: string, spec: string, form: SpecUseForm): void => {
    if (!known.has(spec)) {
      unknown.push({ user, spec });
      return;
    }
    uses.push({ spec, user, form });
    declaredBy.set(user, [...(declaredBy.get(user) ?? []), spec]);
  };

  for (const f of files) {
    const ext = extname(f);
    let text: string;
    try {
      text = readFileSync(join(repo, f), "utf-8");
    } catch {
      continue;
    }
    if ([".ts", ".js", ".mjs"].includes(ext)) for (const s of taggedSpecs(text)) record(f, s, "tag");
    else if (ext === ".md") for (const s of frontMatterSpecs(text)) record(f, s, "front-matter");
    else if (ext === ".bpmn" || ext === ".dmn") {
      for (const s of new Set(boundNamespaces(text).flatMap((n) => byNamespace.get(n) ?? []))) record(f, s, "xmlns");
    }
  }

  // A kind or family inherits the declaration of the module that types it.
  const inherit = (user: string, ref: string | undefined): void => {
    if (!ref) return;
    const mod = refModule(ref, kindsInstance);
    for (const spec of declaredBy.get(mod) ?? []) uses.push({ spec, user, form: "kind", via: mod });
  };
  for (const [kind, def] of Object.entries(kinds)) {
    inherit(`${kind} graph`, def.validator);
    for (const [family, ref] of Object.entries(def.nodeSchemas ?? {})) inherit(`${family} nodes`, ref.validator ?? ref.shape);
  }
  return { uses, unknown };
}
