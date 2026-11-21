/**
 * `node-kinds` and `node-kinds:check` on THIS checkout, since the owner's
 * ruling of 2026-10-15: each layer's unkinded families are held to that
 * layer's own baseline, and the cross-layer table is built at publish.
 *
 * The rules themselves (ownership, the ratchet, the baseline file) are pinned
 * on fixtures in cat-harness's `schemas/node-kind-index.test.ts`; this file
 * asks the real corpus what a migration has to keep true.
 *
 * Real-corpus tests: building the index imports every validator module every
 * layer names, which can pass 5 s on a cold CI runner, so each carries an explicit
 * 60 s timeout.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { defaultGraphTypologies, readDeclaration } from "../../schemas/kg/cat-harness.ts";
import { ignoreLineFor } from "../../schemas/kg/built-at-publish.ts";
import { NodeKindIndexFileKind, nodeKindIndex, ratchet, typologyOwner, unkindedKey, type NodeKindIndex } from "../../schemas/kg/node-kind-index.ts";
import { INDEX_PATH, readBaselines, render, tableBuiltAtPublish } from "../check-node-kinds.ts";
import { HARNESS_ROOT, REPO_ROOT } from "../lib/roots.ts";

const repoRoot = REPO_ROOT ?? join(HARNESS_ROOT, "..");
const SLOW = 60_000;

let built: NodeKindIndex | undefined;
const index = async () => (built ??= await nodeKindIndex(defaultGraphTypologies, HARNESS_ROOT, repoRoot));
const owner = (t: string) => typologyOwner(defaultGraphTypologies, t);
const baselines = () => new Map(readBaselines(repoRoot).map((d) => [d.instance, d.entries ?? (d.path ? [] : undefined)] as const));
// A mounted layer's baseline is its own repository's (#1171): this checkout may
// kind a family it lists, and only that repository prunes it. So, like the
// gate, these tests do not count such a family as gone.
const mounted = () => new Set(readBaselines(repoRoot).filter((d) => d.mounted).map((d) => d.instance));

describe("the table is built at publish", () => {
  test("cat-harness declares docs/_data/node-kinds.json builtAtPublish, written by node-kinds, and ignores it", () => {
    expect(tableBuiltAtPublish()).toBe(true);
    const entry = (readDeclaration(HARNESS_ROOT)?.builtAtPublish ?? []).find((e) => join(HARNESS_ROOT, e.path) === INDEX_PATH);
    expect(entry?.writer).toEqual(["node-kinds"]);
    expect(entry?.reads).toEqual(["typologies", "validators"]);
    const ignore = readFileSync(join(HARNESS_ROOT, ".gitignore"), "utf-8").split("\n");
    expect(ignore).toContain(ignoreLineFor(entry!));
  });

  test("the node-kind pages that render it are declared after it, so derive:publish writes it first", () => {
    const list = readDeclaration(HARNESS_ROOT)?.builtAtPublish ?? [];
    const table = list.findIndex((e) => e.writer.includes("node-kinds"));
    const pages = list.findIndex((e) => e.writer.includes("node-kind:pages"));
    expect(table).toBeGreaterThanOrEqual(0);
    expect(pages).toBeGreaterThan(table);
    expect(list.some((e) => e.path === "docs/en/cat-harness/node-kind-index/" && e.writer.includes("node-kind:pages"))).toBe(true);
  });

  test("the combined build is a node-kind-index whose unkinded families are exactly the instances' baselines", async () => {
    const file = JSON.parse(render(await index()));
    expect(NodeKindIndexFileKind.schema.safeParse(file).success).toBe(true);
    const built = (file.unkinded as { typology: string; family?: string }[]).map(unkindedKey).sort();
    const own = [...baselines()].filter(([i]) => !mounted().has(i)).flatMap(([, b]) => b ?? []).map(unkindedKey);
    const all = new Set([...baselines().values()].flatMap((b) => b ?? []).map(unkindedKey));
    // Every unkinded family is held by some baseline, and every family the
    // checkout's own layers hold is still unkinded.
    expect(built.filter((k) => !all.has(k))).toEqual([]);
    expect(own.filter((k) => !built.includes(k)).sort()).toEqual([]);
  }, SLOW);
});

describe("each instance's baseline, on this checkout", () => {
  test("every declared baseline parses, and every one names only its own instance's families", () => {
    const declared = readBaselines(repoRoot);
    expect(declared.filter((d) => d.error).map((d) => `${d.instance}: ${d.error}`)).toEqual([]);
    for (const d of declared) for (const e of d.entries ?? []) expect(`${owner(e.typology)} ${unkindedKey(e)}`).toBe(`${d.instance} ${unkindedKey(e)}`);
  });

  test("DAY ONE: the gate passes exactly as the shared baseline did — nothing new, gone, foreign or unattributed", async () => {
    const { layers, unattributed } = ratchet(await index(), owner, baselines());
    expect(unattributed.map(unkindedKey)).toEqual([]);
    const m = mounted();
    expect(layers.flatMap((l) => [...l.fresh, ...(m.has(l.instance) ? [] : l.gone), ...l.foreign].map((k) => `${l.instance} ${k}`))).toEqual([]);
  }, SLOW);

  test("a NEW unkinded family fails in the layer that declares its typology, and nowhere else", async () => {
    const real = await index();
    const victim = real.unkinded.find((u) => owner(u.typology) !== undefined && owner(u.typology) !== readDeclaration(HARNESS_ROOT)?.name) ?? real.unkinded[0]!;
    const added = { typology: victim.typology, family: "a-family-nobody-baselined/v1", reason: "zod-schema" as const };
    const { layers } = ratchet({ unkinded: [...real.unkinded, added] }, owner, baselines());
    const failing = layers.filter((l) => l.fresh.length > 0).map((l) => [l.instance, l.fresh]);
    expect(failing).toEqual([[owner(victim.typology)!, [unkindedKey(added)]]]);
  }, SLOW);
});

describe("a mounted layer's baseline is its own repository's", () => {
  test("readBaselines marks an instance a lock laid down as mounted, and the checkout's own as not", () => {
    const root = mkdtempSync(join(tmpdir(), "node-kinds-mounted-"));
    try {
      for (const name of ["lower", "own"]) {
        mkdirSync(join(root, name));
        writeFileSync(join(root, name, `${name}.json`), JSON.stringify({ name }));
      }
      writeFileSync(join(root, "index.lock.json"), JSON.stringify({ instances: [{ path: "lower/" }] }));
      const by = new Map(readBaselines(root).map((d) => [d.instance, d] as const));
      expect(by.get("lower")?.mounted).toBe(true);
      expect(by.get("own")?.mounted).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
