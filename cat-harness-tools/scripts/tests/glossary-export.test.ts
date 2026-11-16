/**
 * The swimlane glossary says what the corpus says, and remembers what it dropped.
 *
 * @module scripts/tests/glossary-export.test
 *
 * Bean `lqo9` slice 2, issue #596. Three things have to hold for this to be a
 * glossary rather than an index with a glossary's name:
 *
 * 1. **A concept is a role**, so ten lane names for `build-pipeline` are ten
 *    `altLabel`s and not ten terms.
 * 2. **A scope note is verbatim and attributed**, so it has a `.pot` msgid and
 *    a reader can tell which process it came from.
 * 3. **A retired term stays**, because retirement and accident must not look
 *    alike.
 *
 * Every count is checked against ZERO before anything else. A suite asserting
 * "every concept has a definition" passes perfectly over a document with no
 * concepts — `6tkl`, which this repository has introduced more than once in
 * the tests written to prevent it.
 *
 * The tests of this file that read the whole checkout (reads roles another
 * layer (folio-assistant-core) draws) live in
 * `test/glossary-export-checkout.test.ts` (bean `7zz1`): standing alone,
 * cat-harness has none of it.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import {
  GLOSSARY_DIR,
  LEDGER_FILENAME,
  LEDGER_SCHEMA,
  buildFullGlossary,
  buildGlossary,
  glossaryIri,
  kindsDeclaredBy,
  ledgerNotOursReason,
  ledgerPath,
  liveLedgerEntry,
  pendingKind,
  readLanes,
  type Ledger,
} from "../glossary-export.ts";
import { DECLARED_BY, defaultGraphTypologies } from "../../schemas/kg/graph-typology-registry.ts";
import { LEDGER_KEY, LedgerSchema } from "../../schemas/library/glossary-ledger.ts";
import { placedOut } from "../lib/moved-document.ts";
import { HARNESS_ROOT } from "../lib/roots.ts";
import { dirname } from "node:path";
import { notApplicableAlone } from "../../test/support/checkout.js";

/**
 * The committed ledger is the retirement record of the CHECKOUT's roles: it is
 * written with the higher layers present, and standing alone their roles
 * (sci's Lean and compute agents, fhir-harness's fhir-modeller, ...) read as
 * newly retired. Only a composed checkout can say whether it is current.
 */
const NO_HIGHER_ROLES = notApplicableAlone(
  "the roles the higher instances declare (folio-assistant-sci, folio-assistant-core, fhir-harness), which the committed swimlane-glossary ledger records",
);

const REPO =
  [resolve(import.meta.dir, "..", "..", "..", "..", ".."), resolve(dirname(HARNESS_ROOT))].find((d) =>
    existsSync(join(d, "AGENTS.md")) || (existsSync(join(d, ".git")) && existsSync(join(d, "bootstrap"))),
  ) ?? resolve(dirname(HARNESS_ROOT));
const HARNESS = resolve(HARNESS_ROOT);
/**
 * A content root (an IG mounting cat-harness, cat-harness-tools#1701): the
 * ledger is the harness index's, and `glossary:check` reports not applicable
 * there, so the "is current" corpus assertions have nothing to assert.
 */
const LEDGER_NOT_OURS = ledgerNotOursReason(HARNESS, resolve(dirname(HARNESS_ROOT))) !== null;
const BOOTSTRAP = join(REPO, "bootstrap");

type Node = Record<string, unknown>;
const graphOf = (doc: Record<string, unknown>): Node[] => doc["@graph"] as Node[];
const concepts = (doc: Record<string, unknown>): Node[] =>
  graphOf(doc).filter((n) => n["@type"] === "skos:Concept");
const usages = (doc: Record<string, unknown>): Node[] =>
  graphOf(doc).filter((n) => typeof n["@type"] === "string" && String(n["@type"]).endsWith("/LaneUsage"));

describe("the corpus it is actually run against", () => {
  const { doc, report } = buildGlossary({ today: () => "2026-09-21" });

  test("there is a corpus at all", () => {
    // Everything below is vacuous over an empty document.
    expect(report.concepts).toBeGreaterThan(0);
    expect(report.usages).toBeGreaterThan(0);
    expect(concepts(doc).length).toBeGreaterThan(0);
  });

  test("the document IS its own concept scheme", () => {
    // Not a separate `…#scheme` IRI, which would name a set that already has
    // a name and would not dereference (`blv9`).
    expect(doc["@type"]).toBe("skos:ConceptScheme");
    for (const c of concepts(doc)) expect(c.inScheme).toBe(doc["@id"]);
  });

  test("the scheme's dcterms:title IS its skos:prefLabel — one source, two vocabularies (`sl9u`)", () => {
    // Owner, 2026-09-23: keep both, from one source. A reader of either
    // vocabulary gets the name, and the two can never say different things.
    expect(typeof doc.prefLabel).toBe("string");
    expect(doc.title).toBe(doc.prefLabel);
  });

  test("every live concept has a prefLabel, and no two share an @id", () => {
    const ids = concepts(doc).map((c) => c["@id"] as string);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of concepts(doc)) expect(typeof c.prefLabel).toBe("string");
  });

  test("a concept's @id is the one kg-export already mints for that role", () => {
    // The whole point of reusing `makeIri`: two names for one resource is the
    // drift this repository keeps paying for, and the glossary would not join
    // with the graph's `performedBy` links.
    const roleIds = concepts(doc)
      .map((c) => c["@id"] as string)
      .filter((i) => i.includes("/role/"));
    expect(roleIds.length).toBeGreaterThan(0);
    // A path, not a fragment of the instance document (#603).
    for (const i of roleIds) expect(i).toMatch(/^[^#]*\/role\/[^/#]+$/);
  });

  test("ten names for one pipeline are ten altLabels, not ten terms", () => {
    // The measurement that corrected the bean's recorded mapping: 85 distinct
    // lane names resolve to 36 roles, and `build-pipeline` alone is named ten
    // ways. A concept per lane name would have copied one definition onto ten.
    const bp = concepts(doc).find((c) => c["@id"]?.toString().endsWith("/role/build-pipeline"));
    expect(bp).toBeDefined();
    expect((bp!.altLabel as string[]).length).toBeGreaterThanOrEqual(5);
    // ...and the definition is authored once, in `roles.json`.
    expect(typeof bp!.definition).toBe("string");
  });

  test("notation is the CODE, and no two concepts share one", () => {
    // The owner's "coded" requirement. Unique WITHIN the scheme, which is
    // what a code is for — a duplicate code is a term you cannot cite.
    const ns = concepts(doc).map((c) => c.notation as string);
    expect(ns.length).toBeGreaterThan(0);
    for (const n of ns) expect(typeof n).toBe("string");
    expect(new Set(ns).size).toBe(ns.length);
  });

  test("a scope note is on the USAGE and never on the concept", () => {
    for (const c of concepts(doc)) expect(c.scopeNote).toBeUndefined();
    const withNote = usages(doc).filter((u) => typeof u.scopeNote === "string");
    expect(withNote.length).toBeGreaterThan(0);
  });

  test("every usage names the process and the concept it belongs to", () => {
    expect(usages(doc).length).toBeGreaterThan(0);
    const ids = new Set(concepts(doc).map((c) => c["@id"] as string));
    for (const u of usages(doc)) {
      expect(ids.has(u.ofConcept as string)).toBe(true);
      expect(String(u.inProcess)).toMatch(/^[^#]*\/process\/[^/#]+$/);
    }
  });

  test("a usage's scope note is VERBATIM, so it has a msgid", () => {
    // Wrapping it — `In "<process>": <note>` — reads well in English and
    // produces a string no catalogue contains, which breaks the per-locale
    // rendering (`jmpb`) before it is built. Checked against the diagrams.
    const lanes = readLanes(HARNESS, REPO).filter((l) => l.documentation !== null);
    expect(lanes.length).toBeGreaterThan(0);
    const notes = new Set(usages(doc).map((u) => u.scopeNote).filter((n): n is string => typeof n === "string"));
    for (const l of lanes.slice(0, 40)) expect(notes.has(l.documentation!)).toBe(true);
  });

  test("every `usage` link resolves to a node in this document", () => {
    const ids = new Set(graphOf(doc).map((n) => n["@id"] as string));
    let linked = 0;
    for (const c of concepts(doc)) {
      for (const u of (c.usage as string[] | undefined) ?? []) {
        expect(ids.has(u)).toBe(true);
        linked += 1;
      }
    }
    // A dangling-link assertion over zero links passes perfectly.
    expect(linked).toBeGreaterThan(0);
  });

  test("a declared role no swimlane draws is still a concept, and is reported", () => {
    // Omitting it would be `dh4f`: a glossary silently short of the vocabulary
    // it claims to index, reporting a clean run over what it never emitted.
    expect(report.undrawn.length).toBeGreaterThan(0);
    const ids = new Set(concepts(doc).map((c) => c["@id"] as string));
    for (const r of report.undrawn) {
      expect([...ids].some((i) => i.endsWith(`/role/${r}`))).toBe(true);
    }
  });

});

describe("bootstrap — the instance with the one varying performer", () => {
  const { doc, report } = buildGlossary({ instanceRoot: BOOTSTRAP, today: () => "2026-09-21" });

  test("it is bootstrap's own graph, not cat-harness's under bootstrap's name", () => {
    // `7u3g`: two earlier sessions widened a scan instead of running a second
    // pass, and published one layer's content under another's identity.
    expect(report.concepts).toBeGreaterThan(0);
    // ROLES, not every concept: since work item folio-assistant-dkqd the
    // glossary also defines bootstrap's own graph kinds, which are bootstrap's
    // and so belong here. What `7u3g` guards is the PERSONAS.
    expect(report.families.roles).toBeLessThan(10);
    expect(String(doc["@id"])).toContain("/bootstrap/");
  });

  test("the lane whose performer varies has a usage and NO definition", () => {
    // Bean `ug4r`. The absence is an assertion: the performer is whoever
    // called the sub-process, so there is no persona to define. Without
    // `laneBinding` this would be indistinguishable from a lane nobody bound.
    const actor = concepts(doc).find((c) => String(c["@id"]).includes("/process/Process_LogMessage/lane/Lane_Actor"));
    expect(actor).toBeDefined();
    expect(actor!.definition).toBeUndefined();
    expect(actor!.performerVaries).toBe(true);
    expect((actor!.usage as string[]).length).toBeGreaterThan(0);
  });

  test("no ordinary unbound lane is silently swallowed", () => {
    // The failure mode that would make the whole thing a way of hiding
    // defects: `variable` must not be how an unbound lane leaves the report.
    expect(report.problems).toEqual([]);
  });
});

// ── Retirement ──────────────────────────────────────────────────

/** A throwaway layer root carrying only a ledger, for the retirement path. */
function withLedger(concepts: Ledger["concepts"]): string {
  const dir = mkdtempSync(join(tmpdir(), "gloss-"));
  mkdirSync(join(dir, GLOSSARY_DIR), { recursive: true });
  writeFileSync(
    join(dir, GLOSSARY_DIR, LEDGER_FILENAME),
    JSON.stringify({ $schema: LEDGER_SCHEMA, instance: "cat-harness", concepts }, null, 2),
  );
  return dir;
}

describe("retirement — reported, never deleted", () => {
  test("a term the corpus no longer derives is KEPT, deprecated and dated", () => {
    // A layer that derives nothing, with a ledger that remembers two
    // terms. That is the extreme of the case the ruling is about: a derived
    // document has no memory, so without the ledger both would simply stop
    // appearing — which is what "never existed" also looks like.
    const dir = withLedger({
      "role/reviewer": { prefLabel: "Reviewer", firstSeen: "2026-01-01", retiredOn: null },
      "role/long-gone": { prefLabel: "Long gone", firstSeen: "2025-06-01", retiredOn: "2025-12-25" },
    });
    try {
      const { doc, ledger, report } = buildGlossary({ instanceRoot: dir, today: () => "2026-09-22" });

      // NEWLY retired carries today; an already-retired term keeps its own
      // date. Re-stamping would erase when the term actually went.
      expect(report.newlyRetired).toEqual(["role/reviewer"]);
      expect(ledger.concepts["role/reviewer"]!.retiredOn).toBe("2026-09-22");
      expect(ledger.concepts["role/long-gone"]!.retiredOn).toBe("2025-12-25");

      // NEVER DELETED — both are still in the ledger and both are still nodes.
      expect(Object.keys(ledger.concepts).sort()).toEqual(["role/long-gone", "role/reviewer"]);
      const nodes = concepts(doc);
      expect(nodes.length).toBe(2);
      for (const n of nodes) {
        expect(n.deprecated).toBe(true);
        expect(String(n.changeNote)).toMatch(/^Retired \d{4}-\d{2}-\d{2}: /);
        // The label is served from the ledger, because the corpus no longer
        // has one — a retired term with no label is unfindable.
        expect(typeof n.prefLabel).toBe("string");
      }
      expect(report.retired.sort()).toEqual(["role/long-gone", "role/reviewer"]);
      expect(report.ledgerStale).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("a retired term that comes BACK is un-retired and reported", () => {
    // The mirror of the defect above: leaving the flag on would report a live
    // term as gone for ever. Run against the REAL corpus, judged against a
    // ledger that has one of its own live terms planted as retired.
    const live = buildGlossary({ today: () => "2026-09-21" });
    // A live ROLE: a family this build derives, so the key is in the live set
    // and not merely carried over (as an unbuilt family's `node-kind/` is).
    const someLiveKey = Object.keys(live.ledger.concepts).find(
      (k) => k.startsWith("role/") && live.ledger.concepts[k]!.retiredOn === null,
    )!;
    expect(someLiveKey).toBeDefined();
    const planted: Ledger = {
      ...live.ledger,
      concepts: {
        ...live.ledger.concepts,
        [someLiveKey]: { ...live.ledger.concepts[someLiveKey]!, retiredOn: "2025-01-01" },
      },
    };
    const after = buildGlossary({ today: () => "2026-09-22", ledger: planted });
    // Un-retired: the key is live again, keeps its firstSeen, carries no date.
    expect(after.ledger.concepts[someLiveKey]!.retiredOn).toBeNull();
    expect(after.ledger.concepts[someLiveKey]!.firstSeen).toBe(live.ledger.concepts[someLiveKey]!.firstSeen);
    expect(after.report.retired).not.toContain(someLiveKey);
    // ...and reported: the planted key, and only it, is restored.
    expect(after.report.restored).toEqual([someLiveKey]);
    // The ledger the planted one was judged against is now stale — it said
    // the term was gone.
    expect(after.report.ledgerStale).toBe(true);
  });

  test("firstSeen is preserved across a rebuild — a term is not re-minted daily", () => {
    const a = buildGlossary({ today: () => "2026-09-21" });
    const b = buildGlossary({ today: () => "2030-01-01" });
    // Every key already on disk keeps the date the committed ledger gave it.
    // A key the ledger does not hold yet is minted on the day it is built, so
    // it differs between the two builds BY DESIGN; whether the committed
    // ledger is missing it is the staleness gate's question, below, not this
    // one's.
    const onDisk = (JSON.parse(readFileSync(ledgerPath(HARNESS_ROOT), "utf-8")) as Ledger).concepts;
    let checked = 0;
    for (const [k, v] of Object.entries(b.ledger.concepts)) {
      const prior = a.ledger.concepts[k];
      if (prior === undefined || onDisk[k] === undefined) continue;
      expect(v.firstSeen).toBe(prior.firstSeen);
      expect(v.firstSeen).toBe(onDisk[k]!.firstSeen);
      checked += 1;
    }
    expect(checked).toBeGreaterThan(0);
  });

  test.skipIf(NO_HIGHER_ROLES || LEDGER_NOT_OURS)("the committed ledger is CURRENT — this is the staleness gate", () => {
    expect(buildGlossary({ today: () => "2026-09-21" }).report.ledgerStale).toBe(false);
    expect(buildGlossary({ instanceRoot: BOOTSTRAP, today: () => "2026-09-21" }).report.ledgerStale).toBe(false);
  });

  test("the ledger keys on the LOCAL PART, never an absolute IRI", () => {
    // The publication base is a deploy-time variable, so a stored absolute
    // IRI would rot the day it moved and take the retirement records with it.
    for (const k of Object.keys(buildGlossary({ today: () => "2026-09-21" }).ledger.concepts)) {
      expect(k).not.toContain("http");
      expect(k).toMatch(LEDGER_KEY);
    }
  });

  test("a ledger with the wrong $schema is REFUSED, not overwritten", () => {
    const dir = mkdtempSync(join(tmpdir(), "gloss-bad-"));
    mkdirSync(join(dir, GLOSSARY_DIR), { recursive: true });
    writeFileSync(join(dir, GLOSSARY_DIR, LEDGER_FILENAME), JSON.stringify({ concepts: {} }));
    try {
      // Overwriting would delete every retirement record on the strength of a
      // parse this code got wrong — the one thing the file exists to keep.
      expect(() => buildGlossary({ instanceRoot: dir })).toThrow(/\$schema/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("glossaryIri", () => {
  test("it is derived from the document PATH, not rebuilt from the stub", () => {
    // Bean `dyd3`: a document's path decides it, wherever that is — the
    // host's root `<stub>.jsonld` until #603 decision 1b, and every layer's
    // `<name>/<stub>.jsonld` since. A caller that recomposes the path gets
    // one layer's answer for every layer.
    expect(glossaryIri("https://x.test", "cat-harness.jsonld")).toBe("https://x.test/cat-harness-glossary.jsonld");
    expect(glossaryIri("https://x.test/", "bootstrap/bootstrap.jsonld")).toBe(
      "https://x.test/bootstrap/bootstrap-glossary.jsonld",
    );
  });
});

// #603 decision 1b (owner, 2026-10-23): the host's glossary moved under
// `<site>/<name>/` with its graph document. Clean break (owner, 2026-11-02,
// cat-harness-tools#1378): nothing is written at the old root address.
describe("the host glossary's address", () => {
  const BASE = "https://x.test/site";
  test("is beside its graph document, and holds no forwarding node", () => {
    const { doc } = buildGlossary({ baseUrl: BASE });
    expect(String(doc["@id"])).toBe(`${BASE}/cat-harness/cat-harness-glossary.jsonld`);
    expect(graphOf(doc).filter((n) => n.deprecated === true && n["@type"] === undefined)).toEqual([]);
  });
});

describe("an old-layout --out names the same site (placedOut)", () => {
  test("the old root path is read as the site root; the new path and any other are kept", () => {
    const P = "cat-harness/cat-harness.jsonld";
    const L = "cat-harness.jsonld";
    expect(placedOut("./_site/cat-harness.jsonld", P, L)).toEqual({ out: "./_site/cat-harness/cat-harness.jsonld", moved: true });
    expect(placedOut("./_site/cat-harness/cat-harness.jsonld", P, L)).toEqual({ out: "./_site/cat-harness/cat-harness.jsonld", moved: false });
    expect(placedOut("/tmp/x/doc.jsonld", P, L)).toEqual({ out: "/tmp/x/doc.jsonld", moved: false });
    // A foreign layer has no old address: nothing is moved.
    expect(placedOut("./_site/cat-harness.jsonld", P, undefined)).toEqual({ out: "./_site/cat-harness.jsonld", moved: false });
  });
});

// ── Keys are the KG's identities, and a rename is a label (#1168 B10b) ─────

describe("ledger keys and renames", () => {
  test("a varying lane is keyed by its BPMN identity, as kg-export mints the Lane node", () => {
    const { ledger } = buildGlossary({ instanceRoot: BOOTSTRAP, today: () => "2026-09-21" });
    expect(Object.keys(ledger.concepts)).toContain("process/Process_LogMessage/lane/Lane_Actor");
    expect(Object.keys(ledger.concepts).filter((k) => k.startsWith("lane/"))).toEqual([]);
  });

  test("the schema refuses a key that is not a role or a lane identity", () => {
    const entry = { prefLabel: "X", firstSeen: "2026-01-01", retiredOn: null };
    const parse = (k: string) => LedgerSchema.safeParse({ $schema: LEDGER_SCHEMA, instance: "x", concepts: { [k]: entry } }).success;
    expect(parse("role/reviewer")).toBe(true);
    expect(parse("process/Process_A/lane/Lane_B")).toBe(true);
    expect(parse("lane/Actor")).toBe(false);
    expect(parse("Reviewer")).toBe(false);
  });

  test("a rename keeps the key and the old label becomes a former label", () => {
    const was = { prefLabel: "Caller", firstSeen: "2026-01-01", retiredOn: null };
    const next = liveLedgerEntry(was, "Actor", "2026-09-30");
    expect(next).toEqual({ prefLabel: "Actor", formerLabels: ["Caller"], firstSeen: "2026-01-01", retiredOn: null });
    // Renamed back: the label in between becomes former, and the current
    // label is never also a former one.
    expect(liveLedgerEntry(next, "Caller", "2026-10-01").formerLabels).toEqual(["Actor"]);
    // Unchanged: no former label invented.
    expect(liveLedgerEntry(was, "Caller", "2026-09-30").formerLabels).toBeUndefined();
  });

  test("every committed ledger parses, and every lane key names a lane a diagram declares", () => {
    const declared = new Set<string>();
    for (const rel of new Bun.Glob("**/*.bpmn").scanSync({ cwd: REPO })) {
      if (rel.includes("node_modules/") || rel.includes("/docs/")) continue;
      const x = readFileSync(join(REPO, rel), "utf-8");
      for (const p of x.matchAll(/<bpmn:process\b[^>]*\bid="([^"]+)"[\s\S]*?<\/bpmn:process>/g)) {
        for (const l of p[0].matchAll(/<bpmn:lane\b[^>]*\bid="([^"]+)"/g)) declared.add(`process/${p[1]}/lane/${l[1]}`);
      }
    }
    expect(declared.size).toBeGreaterThan(10);
    const ledgers = [...new Bun.Glob("**/glossary-ledger.json").scanSync({ cwd: REPO })].filter((r) => !r.includes("node_modules/"));
    expect(ledgers.length).toBeGreaterThan(0);
    const dangling: string[] = [];
    for (const rel of ledgers) {
      const l = LedgerSchema.parse(JSON.parse(readFileSync(join(REPO, rel), "utf-8")));
      for (const [k, e] of Object.entries(l.concepts)) {
        if (k.startsWith("process/") && e.retiredOn === null && !declared.has(k)) dangling.push(`${rel}: ${k}`);
      }
    }
    expect(dangling).toEqual([]);
  });
});

// Bean `k74z`: the predicates are declared in `vocab-mappings/` tables. A table
// row and the document's `@context` must agree, or the JSON key would be
// written as one predicate and read as another (the drift D2 found between
// kg-export and fsh-guts-export).
describe("the vocabulary-mapping tables agree with the document's @context", () => {
  test("every key a table writes expands, in the context, to the table's target + code", async () => {
    const { STANDARD_PREFIXES, expandCurie, vocabMapping } = await import("../../schemas/content/vocab-mapping.ts");
    const { ownPrefixTable } = await import("../../schemas/kg/graph-typology-registry.js");
    const prefixes = { ...STANDARD_PREFIXES, ...ownPrefixTable() };
    const ctx = buildGlossary({ today: () => "2026-09-21" }).doc["@context"] as Record<string, unknown>;
    const ctxPrefixes = Object.fromEntries(Object.entries(ctx).filter(([, v]) => typeof v === "string" && /[#/]$/.test(v as string))) as Record<string, string>;
    const ids = ["role-naming", "glossary-role-concept", "glossary-lane-usage", "glossary-variable-lane-concept", "glossary-retired-concept", "concept-scheme-naming", "glossary-concept-scheme"];
    let checked = 0;
    for (const id of ids) {
      for (const g of vocabMapping(HARNESS, id).group) {
        for (const e of g.element) {
          for (const t of e.target ?? []) {
            const key = t.key ?? t.code!;
            const bound = ctx[key];
            const iri = typeof bound === "string" ? bound : (bound as { "@id": string } | undefined)?.["@id"];
            expect([id, key, iri === undefined ? undefined : expandCurie(iri, ctxPrefixes)]).toEqual([id, key, expandCurie(`${g.target}${t.code}`, prefixes)]);
            checked += 1;
          }
        }
      }
    }
    // 27: `glossary-role-concept` lost its `actedUpon` row when the flag was
    // retired (owner, 2026-10-16; cat-harness `vocab-mappings/`).
    expect(checked).toBe(27);
  });
});

// ── Graph kinds, node kinds and the harness (work item folio-assistant-dkqd) ──

/** Whether the harness carries the newer families' tables: they are authored in cat-harness. */
const hasTable = (id: string): boolean => existsSync(join(HARNESS, "vocab-mappings", `${id}.json`));
const NO_KIND_TABLES = !hasTable("glossary-kind-concept") || !hasTable("glossary-harness-concept") || !hasTable("glossary-node-kind-concept");

describe("graph kinds, node kinds and the harness are glossary terms", () => {
  test("a graph kind belongs to the instance that declares it, never to every instance that sees it", () => {
    const own = kindsDeclaredBy(HARNESS);
    expect(own).toContain("bean-defs");
    expect(own).toContain("beans");
    // bootstrap's base kinds are bootstrap's.
    for (const k of kindsDeclaredBy(BOOTSTRAP)) expect(own).not.toContain(k);
    // A directory that declares no layer owns nothing.
    expect(kindsDeclaredBy(mkdtempSync(join(tmpdir(), "glossary-kinds-")))).toEqual([]);
  });

  test("the families with no table are REPORTED, not silently empty", () => {
    const { report } = buildGlossary({ today: () => "2026-09-21" });
    for (const id of ["glossary-kind-concept", "glossary-harness-concept", "glossary-node-kind-concept"]) {
      expect(report.notBuilt.includes(id)).toBe(!hasTable(id));
    }
  });

  test.skipIf(NO_KIND_TABLES)("Work item is a node kind, narrower than Memory record, and Bean still finds it", async () => {
    const { doc, report } = await buildFullGlossary({ today: () => "2026-09-21" });
    const all = concepts(doc);
    const item = all.find((c) => c.notation === "node-kind/bean");
    expect(item?.prefLabel).toBe("Work item");
    expect(item?.altLabel).toContain("Bean");
    expect(String(item?.definition)).toMatch(/memory record/);
    const core = all.find((c) => c.notation === "node-kind/memory-record-core");
    expect(core?.prefLabel).toBe("Memory record");
    expect(item?.broader).toEqual([core?.["@id"]]);
    // A node kind is a fragment of the glossary document, which holds it.
    expect(String(item?.["@id"]).startsWith(`${String(doc["@id"])}#`)).toBe(true);
    expect(report.families.nodeKinds).toBeGreaterThan(0);
  });

  test.skipIf(NO_KIND_TABLES)("a graph kind keeps the IRI it already has, and its title is its label", () => {
    const { doc } = buildGlossary({ today: () => "2026-09-21" });
    const defs = concepts(doc).find((c) => c.notation === "kind/bean-defs");
    expect(defs?.prefLabel).toBe("Work items");
    expect(String(defs?.["@id"])).toMatch(/\/graphTypology\/bean-defs$/);
  });

  test.skipIf(NO_KIND_TABLES)("the harness is one term, labelled by its title, at its own address", () => {
    const { doc, report } = buildGlossary({ today: () => "2026-09-21" });
    const h = concepts(doc).filter((c) => String(c.notation).startsWith("harness/"));
    expect(h.map((c) => c.notation)).toEqual(["harness/cat-harness"]);
    expect(h[0]!.prefLabel).toBe("C@T Harness");
    expect(h[0]!.altLabel).toContain("cat-harness");
    expect(report.families.harnesses).toBe(1);
  });

  test.skipIf(NO_KIND_TABLES)("no two live concepts share a label — SKOS allows one prefLabel per scheme", async () => {
    const { doc } = await buildFullGlossary({ today: () => "2026-09-21" });
    const labels = concepts(doc).filter((c) => c.deprecated !== true).map((c) => String(c.prefLabel).toLowerCase());
    const dupes = labels.filter((l, i) => labels.indexOf(l) !== i);
    expect([...new Set(dupes)]).toEqual([]);
  });

  test.skipIf(NO_KIND_TABLES || NO_HIGHER_ROLES || LEDGER_NOT_OURS)("the committed ledger is current with every family built", async () => {
    expect((await buildFullGlossary({ today: () => "2026-09-21" })).report.ledgerStale).toBe(false);
  });
});

// ── A kind the registry's code defines may LAG the ledger ───────

describe("pending — a graph kind defined in code, not yet in the ledger", () => {
  // The ledger is cat-harness's file; the registry that defines a base kind is
  // cat-harness-tools' code, a layer above, and each layer's PR is judged
  // against the other's main. Built from the layer's own ledger with ONE
  // entry taken out or changed, so each case differs from current by one fact.
  const today = () => "2026-09-21";
  const current = (): Ledger => buildGlossary({ today }).ledger;
  const without = (l: Ledger, key: string): Ledger => {
    const { [key]: _gone, ...rest } = l.concepts;
    return { ...l, concepts: rest };
  };
  const codeKind = (l: Ledger): string =>
    Object.keys(l.concepts).find((k) => k.startsWith("kind/") && pendingKind(defaultGraphTypologies.get(k.slice(5))))!;

  test.skipIf(NO_KIND_TABLES)("a code-defined kind's term MISSING from the ledger is pending, not stale, and is still written", () => {
    const l = current();
    const key = codeKind(l);
    expect(key).toBeDefined();
    const { ledger, report } = buildGlossary({ today, ledger: without(l, key) });
    expect(report.pending).toEqual([key]);
    expect(report.ledgerStale).toBe(false);
    // The writer records it, minted on the build day.
    expect(ledger.concepts[key]).toEqual({ prefLabel: l.concepts[key]!.prefLabel, firstSeen: "2026-09-21", retiredOn: null });
  });

  test.skipIf(NO_KIND_TABLES)("the same ledger, current, has nothing pending", () => {
    const { report } = buildGlossary({ today, ledger: current() });
    expect(report.pending).toEqual([]);
    expect(report.ledgerStale).toBe(false);
  });

  test.skipIf(NO_KIND_TABLES)("a recorded kind term whose label CHANGED is stale, never pending", () => {
    const l = current();
    const key = codeKind(l);
    const changed = { ...l, concepts: { ...l.concepts, [key]: { ...l.concepts[key]!, prefLabel: "Something else" } } };
    const { report } = buildGlossary({ today, ledger: changed });
    expect(report.pending).toEqual([]);
    expect(report.ledgerStale).toBe(true);
  });

  test.skipIf(NO_KIND_TABLES)("a kind term the ledger holds and the registry no longer defines is retired: stale", () => {
    const l = current();
    const extra = { ...l, concepts: { ...l.concepts, "kind/no-such-kind": { prefLabel: "No such kind", firstSeen: "2026-01-01", retiredOn: null } } };
    const { report } = buildGlossary({ today, ledger: extra });
    expect(report.newlyRetired).toEqual(["kind/no-such-kind"]);
    expect(report.ledgerStale).toBe(true);
  });

  test("a term of a family derived from the instance's OWN files missing is stale, never pending", () => {
    const l = current();
    const key = Object.keys(l.concepts).find((k) => k.startsWith("role/") && l.concepts[k]!.retiredOn === null)!;
    expect(key).toBeDefined();
    const { report } = buildGlossary({ today, ledger: without(l, key) });
    expect(report.pending).toEqual([]);
    expect(report.ledgerStale).toBe(true);
  });

  test("a kind a typologies/ node declares is the instance's own: never pending", () => {
    const def = defaultGraphTypologies.get("beans")!;
    expect(pendingKind(def)).toBe(true);
    expect(pendingKind({ ...def, [DECLARED_BY]: { prefix: "x", name: "x", root: "/x", namespace: "https://x/" } })).toBe(false);
    expect(pendingKind(undefined)).toBe(false);
  });
});

describe("a mounted layer's ledger, judged from a content root (cat-harness-tools#1701)", () => {
  const tree = (gatesWorkflow: boolean): string => {
    const root = mkdtempSync(join(tmpdir(), "glossary-na-"));
    mkdirSync(join(root, "cat-harness"));
    if (gatesWorkflow) {
      mkdirSync(join(root, ".github", "workflows"), { recursive: true });
      writeFileSync(join(root, ".github", "workflows", "code-quality-gates.yml"), "jobs: {}\n");
    }
    return root;
  };

  test("content root + a mounted layer's ledger: not applicable, with a reason", () => {
    const root = tree(false);
    try {
      expect(ledgerNotOursReason(join(root, "cat-harness"), root)).toContain("content root");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a content root's OWN ledger is still judged", () => {
    const root = tree(false);
    try {
      expect(ledgerNotOursReason(root, root)).toBeNull();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a harness root judges the mounted ledger as before", () => {
    const root = tree(true);
    try {
      expect(ledgerNotOursReason(join(root, "cat-harness"), root)).toBeNull();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
