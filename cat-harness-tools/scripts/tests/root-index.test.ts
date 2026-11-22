/**
 * The root meta-skeleton — bean `4ak5` item 3.
 *
 * Over a REAL site layout built in a temporary directory: every declared
 * layer's export written where `exportIdentity` says, plus the committed
 * repository subgraph index. A stub of the declarations would assert the stub.
 *
 * @module scripts/tests/root-index
 */
import { afterAll, describe, expect, test } from "bun:test";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { overlayPath } from "../lib/layer-output.ts";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { buildRootIndex } from "../root-index.ts";
import { expandFindings, localLoader } from "../publish-verify.ts";
import { exportIdentity } from "../kg-export.ts";
import { instanceDocPath } from "../instance-exports.ts";
import { subgraphOutDir } from "../gen-subgraph-jsonld.ts";
import { layerRootsIn, readDeclaration, repoRootFor } from "../../schemas/kg/cat-harness.ts";
import { SUBGRAPH_INDEX_FILE } from "../../schemas/kg/subgraph-manifest.ts";
import { HARNESS_ROOT } from "../lib/roots.ts";
import { siteNotBuilt } from "../../test/support/checkout.ts";

const HARNESS = resolve(HARNESS_ROOT);
const REPO = repoRootFor(HARNESS);

const made: string[] = [];
afterAll(() => {
  for (const d of made) rmSync(d, { recursive: true, force: true });
});

const declared = layerRootsIn(REPO).filter((i) => readDeclaration(i) !== undefined);

// The repository subgraph index each site below carries is written at publish
// and gitignored (bean w1gy F18); not built, there is no real site to index.
const SUBGRAPH_INDEX = join(HARNESS, subgraphOutDir(HARNESS), SUBGRAPH_INDEX_FILE);
const NOT_BUILT = siteNotBuilt("the repository subgraph index `subgraph:jsonld` writes at publish (gitignored)", SUBGRAPH_INDEX);

/** A site with every declared layer's export, `skip` excepted. */
function site(skip: string[] = []): string {
  const dir = mkdtempSync(join(tmpdir(), "root-index-"));
  made.push(dir);
  mkdirSync(join(dir, "subgraph"), { recursive: true });
  copyFileSync(overlayPath(SUBGRAPH_INDEX), join(dir, "subgraph", SUBGRAPH_INDEX_FILE));
  for (const inst of declared) {
    if (skip.includes(readDeclaration(inst)!.name)) continue;
    // Where the deploy writes it: the host at its docPath, every other
    // layer at `<name>/<stub>.jsonld` (`instanceDocPath`).
    const id = exportIdentity({ instanceRoot: inst });
    const file = join(dir, id.foreignInstance ? instanceDocPath({ name: readDeclaration(inst)!.name, stub: id.stub }) : id.docPath);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify({ "@graph": [{ "@id": "a" }, { "@id": "b" }] }));
  }
  return dir;
}

describe.skipIf(NOT_BUILT)("the root index", () => {
  // `describe.skipIf` still runs this body, so nothing is built when it skips.
  const { doc, problems } = NOT_BUILT
    ? ({ doc: { hasHarness: [] }, problems: [] } as unknown as ReturnType<typeof buildRootIndex>)
    : buildRootIndex(site());
  const entries = doc.hasHarness as Array<Record<string, unknown>>;

  test("names every declared instance, once, and nothing else", () => {
    expect(problems).toEqual([]);
    expect(entries.map((e) => e.name).sort()).toEqual(declared.map((i) => readDeclaration(i)!.name).sort());
  });
  test("each entry's @id is the address its exporter mints, with counts and a digest of what is there", () => {
    for (const e of entries) {
      expect(String(e["@id"])).toMatch(/^https?:\/\/.+\.jsonld$/);
      expect(String(e.url)).toMatch(/^https:\/\/litlfred\.github\.io\/folio-assistant\/.+\.jsonld$/);
      expect({ name: e.name, nodes: e.nodes }).toEqual({ name: e.name, nodes: 2 });
      expect(String(e.sha256)).toMatch(/^[0-9a-f]{64}$/);
    }
  });
  test("depth 1 only: no graph node is inlined", () => {
    for (const e of entries) expect(Object.keys(e)).not.toContain("@graph");
  });
  test("`needs` becomes the dependencies' document IRIs", () => {
    const ids = new Set(entries.map((e) => String(e["@id"])));
    for (const e of entries) for (const d of (e.dependsOn as string[] | undefined) ?? []) expect(ids.has(d)).toBe(true);
  });
  test("a framed instance names its subgraph root; bootstrap names its own published site (t8c4)", () => {
    const by = new Map(entries.map((e) => [e.name, e]));
    expect(String(by.get("cat-harness")!.subgraph)).toMatch(/\/subgraph\/cat-harness\/$/);
    expect(String(by.get("bootstrap")!.subgraph)).toMatch(/\/bootstrap\/subgraph\/$/);
  });
  test("every key expands under the verifier the deploy runs — nothing is dropped as an undefined term", async () => {
    // publish:verify's jsonld-expand refused the first staged index: 110
    // `invalid property (id)`, one per declared directory, because a bare
    // `id` is no term of the context. The deploy's own check, run here.
    const dir = site();
    const built = buildRootIndex(dir);
    expect(await expandFindings(built.doc, localLoader(dir))).toEqual([]);
  });
  test("an instance with no export is a PROBLEM, never a shorter index", () => {
    // `bootstrap` is in cat-harness's own closure, so it is declared wherever
    // cat-harness runs — the aggregate or its own clone (bean `ho66`).
    const r = buildRootIndex(site(["bootstrap"]));
    expect(r.problems.some((p) => p.startsWith("bootstrap: no export"))).toBe(true);
  });
});
