/**
 * `schemas/types.ts` declares the `Block` union; `schemas/constraints.ts`
 * declares the Zod schemas that actually validate content. They had drifted,
 * in both directions:
 *
 *     kind        in TS not Zod     in Zod not TS
 *     diagram     title, uses       —
 *     prose       title, uses       —
 *     equation    —                 tags
 *
 * plus `equation` carrying no `uses` on either side — the only member of the
 * union with neither `uses` nor a base supplying it, while its three
 * standalone siblings (`prose`, `diagram`, `table`) all declare it.
 *
 * The Zod objects are neither `.strict()` nor `.passthrough()`, so the default
 * applies: an unknown key is **stripped, silently, and the parse succeeds**.
 * Verified — a prose block carrying `uses: ["def:a"]` parsed clean and came
 * back with `uses === undefined`. On the qou corpus that is 25 prose and 4
 * diagram blocks whose editorial edges vanished at the validation boundary,
 * and 106 blocks whose `title` did. AGENTS.md calls `uses[]` the relation
 * "every ordering metric is computed from".
 *
 * A field-name comparison is crude — it does not check types — but it is
 * exactly the class of drift that occurred, and it is cheap and total.
 */
import { describe, test, expect } from "bun:test";
import { readFileSync } from "fs";
import {
  ProseSchema,
  EquationSchema,
  DiagramSchema,
  TableSchema,
} from "../../schemas/constraints.ts";
import { join } from "path";
import { TOOLS_ROOT } from "../lib/roots.ts";

// Both files are this layer's own: `schemas/types.ts` moved here from the
// harness in `8lcl`, beside the `constraints.ts` imported above.
const ROOT = join(TOOLS_ROOT);
const tsSrc = readFileSync(join(ROOT, "schemas", "types.ts"), "utf-8");
const zodSrc = readFileSync(join(ROOT, "schemas", "constraints.ts"), "utf-8");

/** Field names declared directly in an interface/object body. */
function fieldNames(body: string, indent = 2): Set<string> {
  return new Set(
    [...body.matchAll(new RegExp(`^\\s{${indent}}(\\w+)\\??:`, "gm"))].map((m) => m[1]),
  );
}

/** `interface X extends Y { … }` bodies, keyed by name. */
function interfaces(src: string): Map<string, { ext?: string; fields: Set<string> }> {
  const out = new Map<string, { ext?: string; fields: Set<string> }>();
  for (const m of src.matchAll(
    /(?:export )?interface (\w+)\s*(?:extends (\w+))?\s*\{([\s\S]*?)\n\}/g,
  )) {
    out.set(m[1], { ext: m[2], fields: fieldNames(m[3]) });
  }
  return out;
}

const ifaces = interfaces(tsSrc);

/**
 * `type X = Omit<Y, "a" | "b">;` aliases, keyed by name.
 *
 * `prose`, `equation`, `diagram` and `table` extend `BlockBase` through one of
 * these, because their `label` is optional where the base's is required and
 * TS rejects a direct `extends` that loosens a property. Without following the
 * alias, `tsFields` returns only each interface's OWN four or five fields and
 * every inherited field reads as "in Zod, not in TS" — i.e. this test would
 * fail on a tree where the drift it exists to catch had just been fixed.
 * That is what it did.
 */
function omitAliases(src: string): Map<string, { from: string; omit: Set<string> }> {
  const out = new Map<string, { from: string; omit: Set<string> }>();
  for (const m of src.matchAll(/type (\w+) = Omit<(\w+),\s*([^>]*)>;/g)) {
    const omit = new Set([...m[3].matchAll(/"(\w+)"/g)].map((k) => k[1]));
    out.set(m[1], { from: m[2], omit });
  }
  return out;
}

const aliases = omitAliases(tsSrc);

/** A block interface's fields, including everything it inherits. */
function tsFields(name: string): Set<string> {
  const alias = aliases.get(name);
  if (alias) {
    const inner = tsFields(alias.from);
    return new Set([...inner].filter((f) => !alias.omit.has(f)));
  }
  const entry = ifaces.get(name);
  if (!entry) return new Set();
  const inherited = entry.ext ? tsFields(entry.ext) : new Set<string>();
  return new Set([...entry.fields, ...inherited]);
}

/**
 * Zod block schemas, keyed by the `kind` literal they pin.
 *
 * Most are `SomeBaseSchema.extend({ … })`, so the base's fields have to be
 * followed the same way TS `extends` is. Only the four standalone kinds
 * (`prose`, `equation`, `diagram`, `table`) are flat `z.object({ … })` — and
 * those are exactly the four where drift was possible, and where it happened.
 *
 * Bodies are taken by brace counting rather than a non-greedy regex: several
 * schemas nest `z.object({ … })` inside a field, and a lazy `\n\}` stops at
 * the first inner brace.
 */
function zodSchemaBodies(): Map<string, { base?: string; fields: Set<string> }> {
  const out = new Map<string, { base?: string; fields: Set<string> }>();
  // The two base schemas are declared WITHOUT `export`, so requiring it
  // silently produced empty field sets for every kind that extends them.
  const re = /(?:export )?const (\w+Schema) = (?:(\w+Schema)\.extend\(|z\.object\()\{/g;
  for (const m of zodSrc.matchAll(re)) {
    const open = m.index! + m[0].length - 1;
    let depth = 0, i = open;
    for (; i < zodSrc.length; i++) {
      if (zodSrc[i] === "{") depth++;
      else if (zodSrc[i] === "}" && --depth === 0) break;
    }
    out.set(m[1], { base: m[2], fields: fieldNames(zodSrc.slice(open + 1, i)) });
  }
  return out;
}

const zodSchemas = zodSchemaBodies();

/** A Zod schema's fields, including everything it extends. */
function zodFields(name: string): Set<string> {
  const e = zodSchemas.get(name);
  if (!e) return new Set();
  return new Set([...e.fields, ...(e.base ? zodFields(e.base) : [])]);
}

function zodBlockSchemas(): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const [name] of zodSchemas) {
    const all = zodFields(name);
    if (!all.has("kind")) continue;
    // Read the literal off this schema's OWN body, not an inherited one.
    const body = zodSchemas.get(name)!;
    void body;
    const km = new RegExp(
      `(?:export )?const ${name} = (?:\\w+Schema\\.extend\\(|z\\.object\\()\\{[\\s\\S]*?kind: z\\.literal\\("(\\w+)"\\)`,
    ).exec(zodSrc);
    if (km) out.set(km[1], all);
  }
  return out;
}

const zodByKind = zodBlockSchemas();

/** `kind` literal → TS interface name, read off each interface's own body. */
function tsBlockByKind(): Map<string, string> {
  const out = new Map<string, string>();
  for (const [name, { fields }] of ifaces) {
    if (!name.endsWith("Block") || !fields.has("kind")) continue;
    const body = /interface ${name}/.source; // placeholder, resolved below
    void body;
    const m = new RegExp(`interface ${name}\\s*(?:extends \\w+)?\\s*\\{[\\s\\S]*?kind: "(\\w+)"`).exec(
      tsSrc,
    );
    if (m) out.set(m[1], name);
  }
  return out;
}

const tsByKind = tsBlockByKind();

describe("schema parity: TS interfaces vs Zod schemas", () => {
  test("both sides describe the same block kinds", () => {
    expect([...tsByKind.keys()].sort()).toEqual([...zodByKind.keys()].sort());
  });

  test.each([...tsByKind].sort())("%s: field sets agree", (kind, ifaceName) => {
    const ts = tsFields(ifaceName);
    const zod = zodByKind.get(kind) ?? new Set<string>();
    // `md` is a filesystem companion, not a manifest field; `$schema` and
    // refinement-only keys never appear in the TS interface.
    const ignore = new Set(["md"]);
    const onlyTs = [...ts].filter((f) => !zod.has(f) && !ignore.has(f)).sort();
    const onlyZod = [...zod].filter((f) => !ts.has(f) && !ignore.has(f)).sort();
    // A field present in TS but absent from Zod is the dangerous direction:
    // authors can write it, it type-checks, and Zod silently strips it.
    expect({ onlyTs, onlyZod }).toEqual({ onlyTs: [], onlyZod: [] });
  });
});

describe("every block kind carries the editorial relation", () => {
  test("`uses` is declared on all of them", () => {
    // `equation` was the sole exception, in both TS and Zod.
    const missing = [...tsByKind].filter(([, n]) => !tsFields(n).has("uses")).map(([k]) => k);
    expect(missing).toEqual([]);
  });
});

describe("every block kind carries `authorNotes`", () => {
  /**
   * PARITY COULD NOT CATCH THIS ONE, which is why it needs its own test.
   * `authorNotes` was absent from `prose`, `equation`, `diagram` and `table`
   * on BOTH sides, so the TS-vs-Zod comparison above was perfectly happy: the
   * two agreed, and they agreed on being wrong. A test that only compares two
   * implementations of the same idea is blind to a field neither implements.
   *
   * The cost was silent. The Zod objects are non-strict, so a block declaring
   * `authorNotes` had the key stripped and the parse succeeded — the note was
   * neither rendered, nor validated, nor reported, and nothing told the
   * author. qou #5115 found five real notes being discarded that way and
   * deliberately left them, because deleting the key destroys authored prose.
   * Granted 2026-08-24, bean `folio-assistant-5nle`.
   */
  test("`authorNotes` is declared on every kind, in TS", () => {
    const missing = [...tsByKind]
      .filter(([, n]) => !tsFields(n).has("authorNotes"))
      .map(([k]) => k)
      .sort();
    expect(missing).toEqual([]);
  });

  test("`authorNotes` is declared on every kind, in Zod", () => {
    const missing = [...zodByKind]
      .filter(([, fields]) => !fields.has("authorNotes"))
      .map(([k]) => k)
      .sort();
    expect(missing).toEqual([]);
  });
});

describe("`authorNotes` survives validation, not just declaration", () => {
  /**
   * The source-text tests above prove the field is DECLARED. This proves it
   * is KEPT — which is the property that was actually broken, and the one a
   * reader of the schema cannot verify by eye. A non-strict `z.object` that
   * omits a key strips it and still returns success, so "the parse passed"
   * was never evidence the note was there.
   */
  const note = { kind: "status" as const, date: "2026-06-08", body: "kept" };
  const cases: [string, { safeParse: (v: unknown) => { success: boolean; data?: unknown } }, Record<string, unknown>][] = [
    ["prose", ProseSchema, { kind: "prose", label: "x" }],
    ["equation", EquationSchema, { kind: "equation" }],
    ["diagram", DiagramSchema, { kind: "diagram" }],
    ["table", TableSchema, { kind: "table" }],
  ];
  test.each(cases)("%s: an authorNote round-trips", (_name, schema, base) => {
    const r = schema.safeParse({ ...base, authorNotes: [note] });
    expect(r.success).toBe(true);
    expect((r.data as { authorNotes?: unknown[] }).authorNotes).toEqual([note]);
  });

  test("granting the field did not weaken validation", () => {
    // An unknown `kind` must still be rejected -- otherwise the grant would
    // have traded a silent strip for a silent accept.
    const r = ProseSchema.safeParse({
      kind: "prose",
      authorNotes: [{ kind: "nonsense", body: "x" }],
    });
    expect(r.success).toBe(false);
  });
});
