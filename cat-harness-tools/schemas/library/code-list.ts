/**
 * A code list: a closed set of codes, each with a label, a plain-language
 * definition and a source — authored as a node, published as SKOS.
 *
 * @module schemas/code-list
 *
 * A code list replaces a bare string in an attribute (`codes="stands withdrawn"`)
 * or a constant in a `.ts` file (`WORKFLOWS_NS`), which name a value and say
 * nothing about it. It is one JSON file a person can read, extend and cite,
 * and the code that needs the values reads them from it.
 *
 * ## SKOS predicates
 *
 * A code list IS a `skos:ConceptScheme` and each code a `skos:Concept`:
 * `notation` for the code, `prefLabel`, `definition`, `dcterms:source`, and
 * `owl:deprecated` for a retired code — the predicates the swimlane glossary
 * already emits (`scripts/glossary-export.ts`), which writes this document in
 * the same run.
 *
 * ## Retired, never removed
 *
 * A code a recorded outcome carries must stay resolvable after it stops being
 * offered. So a code is `retired`, and only `active` codes count as the
 * list's values.
 *
 * @graphNode none — the node shape; the nodes are `code-lists/*.json`
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { z } from "zod";

export const CODE_LIST_SCHEMA = "folio-code-list/v1";

/** Where a code, or a whole list, came from: a link, a ruling, or both. */
export const CodeSourceSchema = z
  .object({
    href: z.string().min(1).optional(),
    note: z.string().min(1).optional(),
  })
  .strict()
  .refine((s) => s.href !== undefined || s.note !== undefined, {
    message: "a source names a link or says what it is — an empty source is not a source",
  });

export const CodeSchema = z
  .object({
    /** The token a record carries. Never renamed once used — retire it instead. */
    code: z.string().regex(/^[a-z0-9][a-z0-9-]*$/, "a code is lower-case kebab"),
    label: z.string().min(1),
    /** What the code MEANS, in a sentence a reader can act on. */
    definition: z.string().min(10),
    source: CodeSourceSchema.optional(),
    /**
     * The value the code stands for, when it stands for one — a namespace
     * IRI, for instance. Absent on a code that is its own value.
     */
    value: z.string().min(1).optional(),
    status: z.enum(["active", "retired"]).default("active"),
  })
  .strict();

export const CodeListSchema = z
  .object({
    $schema: z.literal(CODE_LIST_SCHEMA),
    /** Stable id; what a diagram's `list="…"` names. */
    id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
    title: z.string().min(1),
    /** What question the list answers, or what set it enumerates. */
    description: z.string().min(10),
    source: CodeSourceSchema,
    codes: z.array(CodeSchema).min(1),
  })
  .strict()
  .superRefine((l, ctx) => {
    const seen = new Set<string>();
    for (const c of l.codes) {
      if (seen.has(c.code)) ctx.addIssue({ code: "custom", message: `code "${c.code}" appears twice` });
      seen.add(c.code);
    }
  });

export type CodeList = z.infer<typeof CodeListSchema>;
export type Code = z.infer<typeof CodeSchema>;

/** The codes a list currently offers — retired ones stay resolvable but are not values. */
export function activeCodes(list: CodeList): string[] {
  return list.codes.filter((c) => c.status !== "retired").map((c) => c.code);
}

/** A code's `value`, refusing a code that is absent, retired, or carries none. */
export function valueOf(list: CodeList, code: string): string {
  const c = list.codes.find((x) => x.code === code);
  if (!c) throw new Error(`code list "${list.id}" has no code "${code}"`);
  if (c.value === undefined) throw new Error(`code list "${list.id}": "${code}" carries no value`);
  return c.value;
}

/** Parse one file, naming it in the error — a malformed list fails where it lives. */
export function parseCodeList(file: string): CodeList {
  const raw = JSON.parse(readFileSync(file, "utf-8")) as unknown;
  const r = CodeListSchema.safeParse(raw);
  if (!r.success) {
    throw new Error(`${file}: not a ${CODE_LIST_SCHEMA} code list — ${r.error.issues.map((i) => i.message).join("; ")}`);
  }
  return r.data;
}

/**
 * Every code list in the given directories, keyed by id.
 *
 * Later directories win on an id collision, which is overlay order — deepest
 * dependency first, the instance itself last — so an instance may extend or
 * replace a list it inherits. Files that do not declare the code-list schema
 * are skipped: a directory is a place to look, and the files say what they are.
 */
export function loadCodeLists(dirs: readonly string[]): Map<string, CodeList> {
  const out = new Map<string, CodeList>();
  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
      const p = join(dir, f);
      const head = JSON.parse(readFileSync(p, "utf-8")) as { $schema?: unknown };
      if (head.$schema !== CODE_LIST_SCHEMA) continue;
      const list = parseCodeList(p);
      out.set(list.id, list);
    }
  }
  return out;
}

/**
 * The code-list directories an instance can see, in overlay order.
 *
 * Resolved from DECLARATIONS — the `code-list` graph typology in each instance's
 * `<instance>.json` — never from a literal, and including every dependency,
 * the way `resolveSkillDirs` reaches a dependency's skills.
 */
export async function codeListDirs(instanceRoot: string): Promise<string[]> {
  // Imported lazily: `harness-config` pulls in the whole declaration machinery,
  // which a caller holding a list already has no need of.
  const { orderedDependencies } = await import("../kg/harness-config.js");
  const { ownDirectories } = await import("../kg/cat-harness.js");
  const dirs: string[] = [];
  const add = (name: string, root: string, own: boolean) => {
    for (const d of ownDirectories({ name, root, own })) {
      if (d.graphTypologies.includes("code-list")) dirs.push(d.absPath);
    }
  };
  for (const dep of orderedDependencies(instanceRoot)) add(dep.dependency.name, dep.rootPath, false);
  add("(root)", resolve(instanceRoot), true);
  return [...new Set(dirs)];
}

/**
 * A code list as SKOS: the scheme and one concept per code.
 *
 * `base` is the document IRI; each scheme is `<base>/<id>` and each concept
 * `<base>/<id>/<code>`, so a code is addressable and two lists may share a
 * code without sharing a concept. Slashes, never `#`, so each scheme can have
 * its own page (#1379).
 */
export function codeListToSkos(list: CodeList, base: string): Record<string, unknown>[] {
  const scheme = `${base}/${list.id}`;
  const src = (s?: { href?: string; note?: string }) =>
    s === undefined ? undefined : s.href !== undefined ? { "@id": s.href } : s.note;
  return [
    {
      "@id": scheme,
      "@type": "skos:ConceptScheme",
      notation: list.id,
      prefLabel: list.title,
      definition: list.description,
      ...(src(list.source) !== undefined ? { source: src(list.source) } : {}),
      ...(list.source.href && list.source.note ? { changeNote: list.source.note } : {}),
    },
    ...list.codes.map((c) => ({
      "@id": `${scheme}/${c.code}`,
      "@type": "skos:Concept",
      inScheme: scheme,
      notation: c.code,
      prefLabel: c.label,
      definition: c.definition,
      ...(c.value !== undefined ? { "rdf:value": c.value } : {}),
      ...(src(c.source) !== undefined ? { source: src(c.source) } : {}),
      ...(c.status === "retired" ? { deprecated: true } : {}),
    })),
  ];
}
