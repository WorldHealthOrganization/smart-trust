/**
 * Named subgraphs (bean `c1m4`): one IRI, two files, framed from one graph.
 *
 * The oracle for "exactly the sdlc nodes" is computed here from kg-export's
 * graph by source path, NOT from the generator's own plan — a test that reads
 * the membership back from the thing that decided it can only agree with it.
 */
import { subjectPathOf } from "../lib/subject-iri.ts";
import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, extname, join, relative, resolve, sep } from "node:path";
import { overlayPath } from "../lib/layer-output.ts";
import {
  SUBGRAPH_CONTEXT_PATH,
  auditPayloadTree,
  generateSubgraphs,
  planPayloads,
  planSubgraphs,
  prefixesInScope,
  renderPayloadFiles,
  subgraphContext,
  type PayloadPlan,
  type SubgraphPlan,
} from "../gen-subgraph-jsonld.js";
import { termIri } from "../../schemas/kg/namespaces.js";
import { ownPrefixTable } from "../../schemas/kg/graph-typology-registry.js";
import jsonld from "jsonld";
import { exportIdentity } from "../kg-export.js";
import { expandFindings, type localLoader } from "../publish-verify.js";
import { inAggregate } from "../../test/support/checkout.js";
import {
  PAYLOAD_MEDIA_TYPES,
  PAYLOAD_PATH,
  PAYLOAD_SIDECAR_SUFFIX,
  PayloadLinkSchema,
  PayloadSidecarSchema,
  SUBGRAPH_HYDRATED_FILE,
  SUBGRAPH_INDEX_FILE,
  SubgraphHydratedSchema,
  SubgraphIndexSchema,
  type PayloadLink,
} from "../../schemas/kg/subgraph-manifest.js";
import { optInDirectoriesForGraph } from "../../schemas/kg/cat-harness.ts";
import { harnessLayout } from "../lib/harness-layout.ts";
import { HARNESS_ROOT } from "../lib/roots.ts";
import { toolsOf } from "../../tools/discover.js";
import { toolIri } from "../../schemas/tools/tool-folders.js";

const ROOT = resolve(HARNESS_ROOT);
/** This layer's published document: its own nodes are fragments of it. */
const HOST_DOC = exportIdentity().docIri;

let plan: SubgraphPlan;
let files: Map<string, string>;
let harness: string;
let outDir: string;

let payloadPlan: PayloadPlan;
let payloadFiles: Map<string, Buffer | string>;
let payloadDir: string;

beforeAll(async () => {
  ({ plan, files, harness, outDir, payloadPlan, payloadFiles, payloadDir } = await generateSubgraphs());
}, 120_000);

const fileFor = (rel: string, name: string): string => join(outDir, harness, rel, name);
const read = (rel: string, name: string): Record<string, unknown> => {
  const t = files.get(fileFor(rel, name));
  if (t === undefined) throw new Error(`not generated: ${fileFor(rel, name)}`);
  return JSON.parse(t) as Record<string, unknown>;
};
const iriOf = (rel: string): string => `${plan.rootIri}${rel}`;

// TRANSITIONAL (cat-harness#991 step 23; remove after cat-harness#1014 merges):
// the sdlc skills are the `sdlc` sub-graph's `sdlc/skills/` in the new layout,
// and the `sdlc` topic `skills/sdlc/` in the legacy one; the work-plan Tools
// sit in `work-plan/tools/` only in the new one. Expectations follow the
// layout the harness checkout has (scripts/lib/harness-layout.ts).
const SUBGRAPHS = harnessLayout(ROOT) === "subgraphs";
// declared-path-literal: subgraph-relative publication paths of the two layouts, not files read.
const SDLC_SKILLS = SUBGRAPHS ? "sdlc/skills/" : "skills/sdlc/";
const SDLC_PARENT = SUBGRAPHS ? "sdlc/" : "skills/";

/**
 * The sdlc nodes, by source path — independent of the generator's placement.
 * THIS layer's nodes only: since bean `4ak5` item 2 a stacked layer's
 * paths are relative to that layer, so its own `skills/sdlc/` is not ours.
 * Since cat-harness#991 step 23.2 the sdlc skills are the `sdlc` sub-graph's
 * `sdlc/skills/`, a from-within graph of the named sub-graph `sdlc/`.
 */
function expectedSdlc(): Set<string> {
  const out = new Set<string>();
  for (const n of plan.nodes.values()) {
    if (subjectPathOf(n["@id"], HOST_DOC) === undefined) continue;
    for (const k of ["instructionsPath", "module", "sourcePath", "path"]) {
      const v = n[k];
      if (typeof v !== "string" || v.length === 0) continue;
      if (`${v.replace(/\/$/, "")}/`.startsWith(SDLC_SKILLS)) out.add(n["@id"]);
      break;
    }
  }
  return out;
}

/** Follow index files down through `hasSubgraph`, collecting member IRIs. */
function indexMembers(rel: string): Set<string> {
  const doc = read(rel, SUBGRAPH_INDEX_FILE);
  const out = new Set<string>();
  for (const m of (doc.hasMember ?? []) as Array<{ "@id": string }>) out.add(m["@id"]);
  for (const c of (doc.hasSubgraph ?? []) as string[]) {
    for (const id of indexMembers(c.slice(plan.rootIri.length))) out.add(id);
  }
  return out;
}

function hydratedMembers(node: Record<string, unknown>): Set<string> {
  const out = new Set<string>();
  for (const m of (node.hasMember ?? []) as Array<{ "@id": string }>) out.add(m["@id"]);
  for (const c of (node.hasSubgraph ?? []) as Array<Record<string, unknown>>) {
    for (const id of hydratedMembers(c)) out.add(id);
  }
  return out;
}

describe("gen-subgraph-jsonld", () => {
  test("the run is clean: every node placed, nothing refused", () => {
    expect(plan.problems).toEqual([]);
  });

  test("the sdlc skills: index (followed down) and hydrated hold exactly the sdlc nodes", () => {
    const expected = [...expectedSdlc()].sort();
    expect(expected.length).toBeGreaterThan(0);
    expect([...indexMembers(SDLC_SKILLS)].sort()).toEqual(expected);
    const hydrated = read(SDLC_SKILLS, SUBGRAPH_HYDRATED_FILE);
    expect([...hydratedMembers(hydrated)].sort()).toEqual(expected);
  });

  test("tools/ is a named subgraph: every Tool of this instance, one fetch, each in its own folder (bean mo75 G1)", () => {
    // The oracle is discovery's own list, not the plan: which Tools this
    // layer defines, and the IRI kg-export gives each.
    // The Tools of every OPT-IN sub-graph sit in that sub-graph's own tools
    // graph — `work-plan/tools/` (cat-harness#991 step 23.2), and since owner
    // card Q-CORE-SKILLS A (2026-11-12) `sdlc/tools/`, `integrations/tools/`,
    // `kg-ops/tools/` and the rest — so each is checked below against its own
    // index, not against `tools/`. The set is the declaration's, read the way
    // discovery reads it, so a sub-graph added later needs no edit here.
    const optIn = optInDirectoriesForGraph(ROOT, "tools").map((dir) => ({
      subgraph: `${relative(ROOT, dir).split(sep).join("/")}/`,
      ids: new Set(readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name)),
    }));
    expect(optIn.some((o) => o.subgraph === "work-plan/tools/")).toBe(SUBGRAPHS);
    const optInToolIds = new Set(optIn.flatMap((o) => [...o.ids]));
    for (const o of optIn) {
      expect(o.ids.size > 0, `${o.subgraph} holds no Tool`).toBe(true);
      const want = toolsOf(ROOT).filter((t) => o.ids.has(t.id)).map((t) => toolIri(HOST_DOC, t.id)).sort();
      expect(want.length).toBe(o.ids.size);
      if (SUBGRAPHS) expect([...indexMembers(o.subgraph)].filter((id) => want.includes(id)).sort()).toEqual(want);
    }
    const expected = toolsOf(ROOT).filter((t) => !optInToolIds.has(t.id)).map((t) => toolIri(HOST_DOC, t.id)).sort();
    expect(expected.length).toBeGreaterThan(0);
    expect(read("", SUBGRAPH_INDEX_FILE).hasSubgraph).toContain(iriOf("tools/"));
    const tools = read("tools/", SUBGRAPH_INDEX_FILE);
    expect(tools["@id"]).toBe(iriOf("tools/"));
    expect(tools.holdsGraph).toEqual([expect.stringMatching(/graphTypology\/tools$/)]);
    const hydrated = read("tools/", SUBGRAPH_HYDRATED_FILE);
    const whole = [...hydratedMembers(hydrated)].filter((id) => expected.includes(id)).sort();
    expect(whole).toEqual(expected);
    expect([...indexMembers("tools/")].filter((id) => expected.includes(id)).sort()).toEqual(expected);
    // No Tool is left at the root, which has no hydrated file.
    const rootIds = ((read("", SUBGRAPH_INDEX_FILE).hasMember ?? []) as Array<{ "@id": string }>).map((m) => m["@id"]);
    expect(rootIds.filter((id) => expected.includes(id))).toEqual([]);
    // `<tools dir>/<id>/<id>.ts`: the folder is the Tool's own subgraph.
    const [first] = toolsOf(ROOT).filter((t) => !optInToolIds.has(t.id));
    const own = read(`tools/${first!.id}/`, SUBGRAPH_HYDRATED_FILE);
    expect((own.hasMember as Array<Record<string, unknown>>).map((m) => m["@id"])).toContain(toolIri(HOST_DOC, first!.id));
    expect((own.hasMember as Array<Record<string, unknown>>).find((m) => m.name === first!.id)?.invoke).toBeDefined();
  });

  test("the hydrated file carries whole nodes; the index carries pointers", () => {
    const hydrated = read(SDLC_SKILLS, SUBGRAPH_HYDRATED_FILE);
    const core = (hydrated.hasSubgraph as Array<Record<string, unknown>>).find(
      (c) => c["@id"] === iriOf(`${SDLC_SKILLS}sdlc-core/`),
    )!;
    const skill = (core.hasMember as Array<Record<string, unknown>>).find((m) => "instructionsPath" in m);
    expect(skill).toBeDefined();
    const index = read(`${SDLC_SKILLS}sdlc-core/`, SUBGRAPH_INDEX_FILE);
    for (const m of index.hasMember as Array<Record<string, unknown>>) {
      expect(Object.keys(m).every((k) => ["@id", "@type", "name", "title", "payload"].includes(k))).toBe(true);
    }
  });

  test("the parent index lists the sdlc skills as a child IRI", () => {
    const parent = read(SDLC_PARENT, SUBGRAPH_INDEX_FILE);
    expect(parent["@id"]).toBe(iriOf(SDLC_PARENT));
    expect(parent.hasSubgraph).toContain(iriOf(SDLC_SKILLS));
    expect(read(SDLC_SKILLS, SUBGRAPH_INDEX_FILE)["@id"]).toBe(iriOf(SDLC_SKILLS));
  });

  test("the root has index.jsonld and no hydrated file", () => {
    expect(files.has(fileFor("", SUBGRAPH_INDEX_FILE))).toBe(true);
    expect(files.has(fileFor("", SUBGRAPH_HYDRATED_FILE))).toBe(false);
    expect(plan.rootIri).toMatch(new RegExp(`/subgraph/${harness}/$`));
    expect(read("", SUBGRAPH_INDEX_FILE).hasSubgraph).toContain(iriOf("skills/"));
  });

  test("no file inlines its @context — every one names the shared context URL", () => {
    expect(plan.contextUrl.endsWith(SUBGRAPH_CONTEXT_PATH)).toBe(true);
    for (const [p, t] of files) {
      if (p === SUBGRAPH_CONTEXT_PATH) continue;
      expect(JSON.parse(t)["@context"]).toBe(plan.contextUrl);
    }
    const ctx = JSON.parse(files.get(SUBGRAPH_CONTEXT_PATH)!)["@context"];
    expect(typeof ctx).toBe("object");
    expect(ctx.hasMember).toBeDefined();
    expect(ctx.id).toBeUndefined(); // no keyword alias, so files say `@id`
  });

  test("every file expands under its context with no warning — publish-verify's `jsonld-expand`", async () => {
    // folio-assistant#2545: a top-level `_generated` the context did not map
    // was an `invalid property` on all 372 subgraph files, and the staging
    // build failed after the site was built. The same expansion, here.
    const ctxDoc = JSON.parse(files.get(SUBGRAPH_CONTEXT_PATH)!);
    const loader = (async (url: string) => {
      if (url !== plan.contextUrl) throw new Error(`refused to fetch ${url}`);
      return { contextUrl: null, documentUrl: url, document: ctxDoc };
    }) as unknown as ReturnType<typeof localLoader>;
    const findings: string[] = [];
    let checked = 0;
    for (const [p, t] of files) {
      if (p === SUBGRAPH_CONTEXT_PATH) continue;
      const doc = JSON.parse(t) as Record<string, unknown>;
      if (checked === 0) expect(doc._generated).toBeDefined();
      checked += 1;
      for (const f of await expandFindings(doc, loader)) findings.push(`${p}: ${f}`);
    }
    expect(checked).toBeGreaterThan(0);
    expect(findings).toEqual([]);
    // …because the note is a declared term, not because it went away.
    expect(ctxDoc["@context"]._generated).toEqual({ "@id": expect.any(String), "@type": "@json" });
  }, 120_000);

  test("subgraph membership and structural containment stay two properties (bean 3f5f)", () => {
    const ctx = JSON.parse(files.get(SUBGRAPH_CONTEXT_PATH)!)["@context"];
    expect(ctx.inSubgraph["@id"]).not.toBe(ctx.partOf["@id"]);
    // A ProcessNode is part of its diagram AND in the processes subgraph;
    // compaction must keep both, not fold one into the other.
    let both = 0;
    const walk = (o: unknown): void => {
      if (Array.isArray(o)) return o.forEach(walk);
      if (o === null || typeof o !== "object") return;
      const r = o as Record<string, unknown>;
      if ("partOf" in r && "inSubgraph" in r) both += 1;
      Object.values(r).forEach(walk);
    };
    walk(read("processes/", SUBGRAPH_HYDRATED_FILE));
    expect(both).toBeGreaterThan(0);
  });

  test("round trip: every file parses back through its schema", () => {
    let n = 0;
    for (const [p, t] of files) {
      if (p.endsWith(`/${SUBGRAPH_INDEX_FILE}`)) {
        expect(SubgraphIndexSchema.safeParse(JSON.parse(t)).success).toBe(true);
        n += 1;
      } else if (p.endsWith(`/${SUBGRAPH_HYDRATED_FILE}`)) {
        expect(SubgraphHydratedSchema.safeParse(JSON.parse(t)).success).toBe(true);
        n += 1;
      }
    }
    expect(n).toBe(files.size - 1);
    // …and the schema refuses an inline context.
    const doc = read(SDLC_SKILLS, SUBGRAPH_INDEX_FILE);
    expect(SubgraphIndexSchema.safeParse({ ...doc, "@context": { x: "http://x/" } }).success).toBe(false);
  });

  // Its witness is folio-assistant-core, a layer only the aggregate holds;
  // cat-harness run as its own clone has no overlay to head (bean `ho66`).
  test.skipIf(!inAggregate())("an overlaid instance heads its own tree, and the repository index lists every root (bean ax6r)", () => {
    const repo = JSON.parse(files.get(join(outDir, SUBGRAPH_INDEX_FILE))!) as Record<string, unknown>;
    expect(repo["@id"]).toBe(plan.repoIri);
    expect(SubgraphIndexSchema.safeParse(repo).success).toBe(true);
    expect(repo.hasSubgraph).toEqual(plan.harnessRoots);
    expect(plan.harnessRoots[0]).toBe(plan.rootIri);
    // folio-assistant-core's processes are framed in that layer's tree —
    // not in this root — under the `@id`s ITS document gives them.
    const core = `${plan.repoIri}folio-assistant-core/`;
    expect(plan.harnessRoots).toContain(core);
    const hyd = JSON.parse(files.get(join(outDir, "folio-assistant-core", "processes", SUBGRAPH_HYDRATED_FILE))!) as Record<string, unknown>;
    const members = hydratedMembers(hyd);
    // `folio-review-publish.bpmn` stays in core's always-on `processes/`; the
    // processes that run on the work plan moved to its opt-in `collab/`
    // (owner, 2026-11-13).
    const lifecycle = [...plan.nodes.values()].find((n) => String(n.sourcePath ?? "").endsWith("folio-review-publish.bpmn"))!;
    expect(members.has(lifecycle["@id"])).toBe(true);
    expect(lifecycle["@id"].startsWith(`${HOST_DOC}#`)).toBe(false);
    const root = read("", SUBGRAPH_INDEX_FILE);
    expect(((root.hasMember ?? []) as Array<{ "@id": string }>).some((m) => m["@id"] === lifecycle["@id"])).toBe(false);
    // No tree for bootstrap: pve3 keeps its processes out of this graph.
    expect(plan.harnessRoots.some((r) => /\/subgraph\/bootstrap(-tools)?\/$/.test(r))).toBe(false);
  });

  test("each instance is framed from its OWN export: no tree names this document for a node that left it (bean 4ak5 item 2)", () => {
    // `cat-harness.jsonld#…` for a stacked layer's node is a TOMBSTONE in
    // the published document now; framing it would publish the forwarding
    // address as if it were the node.
    const own = `${HOST_DOC}#`;
    const foreign = [...files].filter(([p]) => p.startsWith(join(outDir, "")) && !p.startsWith(join(outDir, harness, "")));
    expect(foreign.length).toBeGreaterThan(0);
    for (const [p, t] of foreign) {
      const ids = [...t.matchAll(/"@id":\s*"([^"]+)"/g)].map((m) => m[1]!);
      expect({ p, hostIds: ids.filter((id) => id.startsWith(own)) }).toEqual({ p, hostIds: [] });
    }
    // And no tombstone is framed anywhere, this tree included.
    for (const n of plan.nodes.values()) expect(n.deprecated).toBeUndefined();
  });

  test("an unplaceable node is a problem, never silently dropped", () => {
    const p = planSubgraphs(
      [
        { "@id": "https://x.test/doc#skill/ghost", "@type": "https://x.test/ns#Skill", instructionsPath: "skills/sdlc/no-such-skill.md" },
        { "@id": "https://x.test/doc#node/orphan", "@type": "https://x.test/ns#ProcessNode", partOf: "https://x.test/doc#process/missing" },
      ],
      { root: ROOT, harness, baseUrl: "https://x.test" },
    );
    expect(p.problems.some((s) => s.includes("#skill/ghost"))).toBe(true);
    expect(p.problems.some((s) => s.includes("#node/orphan"))).toBe(true);
  });
});

/**
 * Bean `folio-assistant-63q4`: a subgraph file belongs to the layer whose
 * `docs/` it is written under, and `jsonld:contexts` resolves its prefixes
 * through THAT layer's flattened table (its own plus what it `needs`). An
 * own-namespace prefix of a layer above it must not be compacted to.
 */
describe("own-namespace prefixes stay inside the writing instance's reach", () => {
  const ALL = Object.keys(ownPrefixTable());

  test("an out-of-scope prefix is not bound, and no term is defined through it", () => {
    const [kept, ...rest] = ALL;
    const ctx = subgraphContext(new Set([kept]));
    expect(ctx[kept]).toBe((ownPrefixTable() as Record<string, string>)[kept]);
    const text = JSON.stringify(ctx);
    for (const p of rest) {
      expect(ctx[p]).toBeUndefined();
      expect(text.includes(`"${p}:`)).toBe(false);
    }
    // No narrowing without a scope: every own prefix is bound, as before.
    const full = subgraphContext();
    for (const p of ALL) expect(full[p]).toBe((ownPrefixTable() as Record<string, string>)[p]);
  });

  test("a foreign IRI is spelt in full, and the triples are the ones the CURIE gave", async () => {
    const foreign = ALL[ALL.length - 1];
    const ns = (ownPrefixTable() as Record<string, string>)[foreign];
    const narrow = subgraphContext(new Set(ALL.filter((p) => p !== foreign)));
    const full = subgraphContext();
    const node = { "@id": "https://x.test/subgraph/h/", "@type": termIri("Subgraph"), holdsGraph: [`${ns}graphTypology/library`] };
    const compact = async (ctx: Record<string, unknown>) =>
      (await jsonld.compact({ "@context": full, ...node } as never, ctx as never)) as Record<string, unknown>;
    const a = await compact(full);
    const b = await compact(narrow);
    expect(JSON.stringify(a)).toContain(`"${foreign}:graphTypology/library"`);
    expect(JSON.stringify(b)).not.toContain(`"${foreign}:`);
    expect(JSON.stringify(b)).toContain(`"${ns}graphTypology/library"`);
    const nq = async (d: Record<string, unknown>) => jsonld.toRDF(d as never, { format: "application/n-quads" } as never);
    expect(await nq(b)).toBe(await nq(a));
  });

  test("this instance's reach includes itself, and every generated file keeps to it", () => {
    const scope = prefixesInScope(ROOT);
    expect(scope).toBeDefined();
    expect(plan.prefixesInScope).toEqual(scope);
    const outOfScope = ALL.filter((p) => !scope!.has(p));
    const offenders: string[] = [];
    for (const [p, t] of files) {
      for (const pre of outOfScope) if (t.includes(`"${pre}:`)) offenders.push(`${p}: ${pre}:`);
    }
    expect(offenders).toEqual([]);
  });
});

/**
 * Payloads (bean `f233`): heavy content by content address. The digest oracle
 * is computed here from the source file, not read back from the plan.
 */
describe("payloads", () => {
  const hex = (b: Buffer | string): string => createHash("sha256").update(b).digest("hex");
  const SKILL = "https://x.test/ns#Skill";

  test("a skill node links to its payload in the index and the hydrated file, by its body's digest", () => {
    const index = read("skills/kg/kg-core/", SUBGRAPH_INDEX_FILE);
    const pointer = (index.hasMember as Array<Record<string, unknown>>).find((m) => m.name === "kg-export")!;
    const node = plan.nodes.get(String(pointer["@id"]))!;
    const body = readFileSync(join(ROOT, String(node.instructionsPath)));
    const link = pointer.payload as PayloadLink;
    expect(PayloadLinkSchema.safeParse(link).success).toBe(true);
    expect(link.sha256).toBe(hex(body));
    expect(link.bytes).toBe(body.length);
    expect(link["@id"]).toBe(`${plan.rootIri.replace(/\/subgraph\/.*$/, "")}/${PAYLOAD_PATH}/${hex(body)}`);

    const hydrated = read("skills/kg/kg-core/", SUBGRAPH_HYDRATED_FILE);
    const whole = (hydrated.hasMember as Array<Record<string, unknown>>).find((m) => m["@id"] === pointer["@id"])!;
    expect(whole.payload).toEqual(link);
  });

  test("the hydrated file does not inline a body — it carries the link instead", () => {
    const text = files.get(fileFor("skills/kg/kg-core/", SUBGRAPH_HYDRATED_FILE))!;
    // declared-path-literal: this test's subject is one named skill file, whose distinctive heading it asserts below.
    const body = readFileSync(join(ROOT, "skills/kg/kg-core/kg-export.md"), "utf-8");
    const distinctive = "## Named subgraphs — one IRI, two files, framed from one graph";
    expect(body).toContain(distinctive);
    expect(text).not.toContain(distinctive);
    expect(text).toContain(`/${PAYLOAD_PATH}/${hex(body)}`);
  });

  test("each payload file's sha256 matches its bytes, and its sidecar names the media type", () => {
    expect(payloadPlan.problems).toEqual([]);
    expect(payloadPlan.payloads.size).toBeGreaterThan(0);
    for (const [p, b] of payloadFiles) {
      const name = basename(p);
      if (name.endsWith(PAYLOAD_SIDECAR_SUFFIX)) {
        const s = PayloadSidecarSchema.parse(JSON.parse(String(b)));
        expect(s.sha256).toBe(name.slice(0, -PAYLOAD_SIDECAR_SUFFIX.length));
        // The media type follows the SOURCE file's extension, read here from
        // the node that references the payload — not from the plan's own
        // answer. Every payload was a skill body (markdown) until npm
        // packaging made `package.json` an Asset (application/json).
        const by = String(payloadPlan.payloads.get(s.sha256)?.referencedBy[0]);
        const node = plan.nodes.get(by) as Record<string, unknown> | undefined;
        const source = String(node?.instructionsPath ?? node?.path ?? "");
        expect(source.length, `no source path for ${by}`).toBeGreaterThan(0);
        expect(s.mediaType).toBe(PAYLOAD_MEDIA_TYPES[extname(source).slice(1).toLowerCase()]!);
      } else {
        expect(hex(b)).toBe(name);
      }
    }
  });

  // The committed tree is generated in the AGGREGATE, where kg-export's graph
  // also carries the higher layers' nodes; cat-harness run as its own clone
  // exports fewer, so their payloads read as orphans there. Skipped, not
  // passed, until the outputs are self-contained (bean `vj2p`; `ho66`).
  test.skipIf(!inAggregate())("the committed payload tree is that set, with no orphan either way", () => {
    // The tree is built at publish and gitignored, so it is at the layer
    // output root (bean cat-tools-sm8r), not in the mount.
    expect(auditPayloadTree(overlayPath(join(ROOT, payloadDir)), payloadPlan.links)).toEqual([]);
  });

  describe("synthetic", () => {
    let dir: string;
    beforeAll(() => {
      dir = mkdtempSync(join(tmpdir(), "payload-"));
      mkdirSync(join(dir, "skills"), { recursive: true });
      writeFileSync(join(dir, "skills", "a.md"), "# same body\n");
      writeFileSync(join(dir, "skills", "b.md"), "# same body\n");
      writeFileSync(join(dir, "skills", "c.md"), "# another\n");
    });
    afterAll(() => rmSync(dir, { recursive: true, force: true }));

    const graph = () => [
      { "@id": "https://x.test/doc#skill/a", "@type": termIri("Skill"), instructionsPath: "skills/a.md" },
      { "@id": "https://x.test/doc#skill/b", "@type": termIri("Skill"), instructionsPath: "skills/b.md" },
      { "@id": "https://x.test/doc#skill/c", "@type": termIri("Skill"), instructionsPath: "skills/c.md" },
      { "@id": "https://x.test/doc#role/r", "@type": SKILL.replace("Skill", "Role"), instructionsPath: "skills/c.md" },
    ];

    test("identical bodies are one payload, linked from both nodes", () => {
      const pp = planPayloads(graph(), { root: dir, baseUrl: "https://x.test/" });
      expect(pp.problems).toEqual([]);
      expect(pp.payloads.size).toBe(2);
      expect(pp.links.size).toBe(3); // the Role is not a heavy class
      const a = pp.links.get("https://x.test/doc#skill/a")!;
      expect(pp.links.get("https://x.test/doc#skill/b")).toEqual(a);
      expect(a["@id"]).toBe(`https://x.test/${PAYLOAD_PATH}/${hex("# same body\n")}`);
      expect(pp.payloads.get(a.sha256)!.referencedBy).toEqual(["https://x.test/doc#skill/a", "https://x.test/doc#skill/b"]);
      expect(renderPayloadFiles(pp, "out").size).toBe(4); // two bodies, two sidecars
    });

    test("generation is deterministic", () => {
      const once = renderPayloadFiles(planPayloads(graph(), { root: dir, baseUrl: "https://x.test" }), "out");
      const twice = renderPayloadFiles(planPayloads(graph().reverse(), { root: dir, baseUrl: "https://x.test" }), "out");
      expect([...once.keys()]).toEqual([...twice.keys()]);
      for (const [k, v] of once) expect(Buffer.from(v).equals(Buffer.from(twice.get(k)!))).toBe(true);
    });

    const writeTree = (out: string, pp: PayloadPlan): void => {
      mkdirSync(out, { recursive: true });
      for (const [p, b] of renderPayloadFiles(pp, out)) writeFileSync(p, b);
    };

    test("orphan detection, both ways — and a payload that is not what it says", () => {
      const pp = planPayloads(graph(), { root: dir, baseUrl: "https://x.test" });
      const out = join(dir, "tree");
      writeTree(out, pp);
      expect(auditPayloadTree(out, pp.links)).toEqual([]);

      // A payload no node references.
      const stray = Buffer.from("nobody links here\n");
      writeFileSync(join(out, hex(stray)), stray);
      // A node that references a payload that is not there.
      const links = new Map(pp.links);
      const ghost = hex("never written\n");
      links.set("https://x.test/doc#skill/ghost", { "@id": `https://x.test/${PAYLOAD_PATH}/${ghost}`, sha256: ghost, bytes: 14 });
      const problems = auditPayloadTree(out, links);
      expect(problems.some((p) => p.startsWith(`orphan payload ${hex(stray)}`))).toBe(true);
      expect(problems.some((p) => p.includes("#skill/ghost") && p.includes("missing"))).toBe(true);

      // Bytes that do not hash to their name.
      const c = pp.links.get("https://x.test/doc#skill/c")!;
      writeFileSync(join(out, c.sha256), "# tampered\n");
      expect(auditPayloadTree(out, pp.links).some((p) => p.includes(`payload ${c.sha256}: its bytes hash to`))).toBe(true);
    });

    test("an undeclared media type is a problem, never a guess", () => {
      writeFileSync(join(dir, "skills", "d.xyz"), "?");
      const pp = planPayloads(
        [{ "@id": "https://x.test/doc#skill/d", "@type": termIri("Skill"), instructionsPath: "skills/d.xyz" }],
        { root: dir, baseUrl: "https://x.test" },
      );
      expect(pp.links.size).toBe(0);
      expect(pp.problems.some((p) => p.includes(".xyz"))).toBe(true);
    });
  });
});
