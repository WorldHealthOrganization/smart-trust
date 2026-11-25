#!/usr/bin/env bun
/**
 * The node-kind index, written or checked, with a per-layer baseline of
 * unkinded families.
 *
 * @module scripts/check-node-kinds
 * @covers cat-harness, typologies — it resolves every declared family's validator, records which are node kinds, and holds each layer's unkinded families to that layer's own baseline
 *
 *   bun run cat node-kinds                       write every layer's baseline, and cat-harness/docs/_data/node-kinds.json
 *   bun run cat node-kinds:check                 fail on a NEW unkinded family, a stale or foreign baseline entry, or an id collision
 *   bun run cat node-kinds --accept-unkinded     write, admitting new unkinded families to their owners' baselines
 *
 * `kinds` is recomputed from the typologies every run (`nodeKindIndex`). The
 * baseline lists families that predate node kinds: a family unkinded now and
 * not in its owner's baseline is refused by BOTH modes; `--accept-unkinded`
 * is the deliberate override. A family that becomes a node kind leaves the
 * baseline at the next write, and `--check` fails until it is written.
 *
 * A family belongs to the layer that declares its typology
 * (`typologyOwner`). Each layer keeps its baseline in a declared asset of
 * role `unkinded-baseline` (none declared: empty) and is judged against it
 * (`ratchet`). The table `docs/_data/node-kinds.json` is still written for
 * the node-kind pages but is `builtAtPublish`, so `--check` does not compare
 * it. If cat-harness does not declare it built at publish, the committed
 * table is the baseline and `--check` compares its bytes.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

import { defaultGraphTypologies, readDeclaration, siteDirFor } from "../schemas/kg/cat-harness.js";
import { isBuiltAtPublish } from "../schemas/kg/built-at-publish.js";
import { lockedMountPaths } from "../schemas/kg/index-config.js";
import { layerRootsIn } from "../schemas/kg/instance-roots.js";
import {
  baselinePath,
  NodeKindIndexFileKind,
  newUnkinded,
  nodeKindIndex,
  ratchet,
  renderBaseline,
  typologyOwner,
  UnkindedBaselineKind,
  unkindedKey,
  type NodeKindIndex,
  type Unkinded,
} from "../schemas/kg/node-kind-index.js";
import { HARNESS_ROOT, REPO_ROOT } from "./lib/roots.ts";

const repoRoot = REPO_ROOT ?? join(HARNESS_ROOT, "..");
const INDEX_REL = join(siteDirFor(HARNESS_ROOT), "_data", "node-kinds.json");
export const INDEX_PATH = join(HARNESS_ROOT, INDEX_REL);

/**
 * The table, under a schema tag a reader can check. The tag is the kind's own,
 * read from `NodeKindIndexFileKind`, so a version bump there (1.1.0 added
 * `foundBy`, bean `ujiv`) cannot leave this writer stamping the old one.
 */
export interface NodeKindIndexFile extends NodeKindIndex {
  $schema: string;
}

export function render(index: NodeKindIndex): string {
  const file: NodeKindIndexFile = { $schema: NodeKindIndexFileKind.tag!, ...index };
  return JSON.stringify(file, null, 2) + "\n";
}

/** Whether cat-harness declares the table built at publish — the per-layer mode. */
export function tableBuiltAtPublish(harnessRoot = HARNESS_ROOT): boolean {
  return isBuiltAtPublish(readDeclaration(harnessRoot)?.builtAtPublish ?? [], INDEX_REL.split("\\").join("/"));
}

function committed(): NodeKindIndexFile | undefined {
  if (!existsSync(INDEX_PATH)) return undefined;
  try {
    return JSON.parse(readFileSync(INDEX_PATH, "utf-8")) as NodeKindIndexFile;
  } catch {
    return undefined;
  }
}

/** One layer's declared baseline: where, and what it admits; `error` when declared and unreadable. */
interface DeclaredBaseline {
  instance: string;
  path?: string;
  entries?: Pick<Unkinded, "typology" | "family">[];
  text?: string;
  error?: string;
  /** Laid down by a mount: its baseline is its own repository's to write and judge. */
  mounted?: boolean;
}

/** Every layer in the checkout, with its declared baseline read. */
export function readBaselines(root = repoRoot): DeclaredBaseline[] {
  const out: DeclaredBaseline[] = [];
  const mounts = new Set(lockedMountPaths(root).map((p) => resolve(root, p)));
  for (const r of layerRootsIn(root)) {
    const instance = readDeclaration(r)?.name;
    if (!instance) continue;
    const mounted = mounts.has(resolve(r));
    const path = baselinePath(r);
    if (path === undefined) {
      out.push({ instance, mounted });
      continue;
    }
    if (!existsSync(path)) {
      out.push({ instance, path, mounted, error: "is declared and missing" });
      continue;
    }
    const text = readFileSync(path, "utf-8");
    try {
      const parsed = UnkindedBaselineKind.schema.safeParse(JSON.parse(text));
      if (!parsed.success) out.push({ instance, path, text, mounted, error: `is not ${UnkindedBaselineKind.tag}: ${parsed.error.message}` });
      else out.push({ instance, path, text, mounted, entries: (parsed.data as { unkinded: Pick<Unkinded, "typology" | "family">[] }).unkinded });
    } catch (e) {
      out.push({ instance, path, text, mounted, error: `does not parse: ${(e as Error).message}` });
    }
  }
  return out;
}

function printKinds(index: NodeKindIndex): void {
  console.log(`${index.kinds.length} node kind(s) found through the typologies; ${index.unkinded.length} famil(ies) not yet a node kind`);
  for (const k of index.kinds) {
    const tree = [k.parents.length ? `extends ${k.parents.join(", ")}` : "", k.subclasses.length ? `subclasses ${k.subclasses.join(", ")}` : ""].filter(Boolean).join("; ");
    console.log(`  ✓ ${k.id}${k.declaredBy ? ` (${k.declaredBy})` : " (ancestor only)"}${tree ? ` — ${tree}` : ""}`);
  }
}

function writeTable(index: NodeKindIndex): void {
  mkdirSync(dirname(INDEX_PATH), { recursive: true });
  writeFileSync(INDEX_PATH, render(index));
  console.log(`wrote ${relative(repoRoot, INDEX_PATH)}`);
}

/** The per-layer gate and writer. */
function perLayer(index: NodeKindIndex, check: boolean, accept: boolean): number {
  let failed = index.collisions.length > 0;
  const declared = readBaselines();
  const byInstance = new Map(declared.map((d) => [d.instance, d] as const));
  for (const d of declared) {
    if (d.error) {
      console.log(`  ✗ ${d.instance}: its unkinded baseline ${relative(repoRoot, d.path!)} ${d.error}`);
      failed = true;
    }
  }
  const { layers, unattributed } = ratchet(
    index,
    (t) => typologyOwner(defaultGraphTypologies, t),
    new Map(declared.map((d) => [d.instance, d.entries ?? (d.path ? [] : undefined)] as const)),
    accept,
  );
  for (const u of unattributed) {
    console.log(`  ✗ ${unkindedKey(u)} has no node kind, and no instance can be named as its owner — declare its typology in a typologies/ graph`);
    failed = true;
  }
  const writes: Array<{ path: string; text: string }> = [];
  for (const l of layers) {
    const d = byInstance.get(l.instance);
    const at = d?.path ? relative(repoRoot, d.path) : `${l.instance} (no unkinded-baseline asset declared)`;
    if (l.fresh.length > 0 && !accept) {
      console.log(`\n✗ ${l.instance}: ${l.fresh.length} NEW famil(ies) with no node kind — declare a nodeKind() and point the family's validator node at it:`);
      for (const k of l.fresh) console.log(`    ${k}`);
      console.log(`  (or, deliberately, \`bun run cat node-kinds --accept-unkinded\` to baseline it in ${at})`);
      failed = true;
    }
    for (const k of l.foreign) {
      console.log(`  ✗ ${at} lists ${k}, which another instance owns — a baseline names only its own instance's families`);
      if (check) failed = true;
    }
    // A mounted layer's baseline is judged and written in its own repository,
    // at its own commit. Here a layer ABOVE it may kind one of its families,
    // so the entry looks stale, but it is not stale where the owner runs. And
    // `derive:publish` runs this writer after `subgraph:jsonld` has hashed the
    // mount's files, so rewriting the baseline would leave the published tree
    // without the payload the KG names (core#439, slice:sqlite:check).
    if (d?.mounted) {
      if (l.gone.length > 0) console.log(`  · ${at} is mounted: ${l.gone.length} famil(ies) it baselines are kinded in this checkout (${l.gone.join(", ")}); its own repository prunes them`);
      continue;
    }
    if (check && l.gone.length > 0) {
      console.log(`\n✗ ${at} is stale — ${l.gone.length} baselined famil(ies) became node kinds or are gone: ${l.gone.join(", ")}. Run \`bun run cat node-kinds\` and commit.`);
      failed = true;
    }
    const want = renderBaseline(l.keep);
    if (d?.path === undefined) {
      if (l.keep.length > 0) {
        console.log(`  ✗ ${l.instance} owns ${l.keep.length} unkinded famil(ies) to baseline and declares no asset of role \`unkinded-baseline\` to hold them`);
        failed = true;
      }
      continue;
    }
    if (d.text !== want) {
      if (check) {
        if (l.gone.length === 0 && l.foreign.length === 0) console.log(`\n✗ ${at} is not in its written form. Run \`bun run cat node-kinds\` and commit.`);
        failed = true;
      } else writes.push({ path: d.path, text: want });
    }
  }
  for (const id of index.collisions) console.log(`  ✗ two different node kinds are both named \`${id}\``);

  if (check) {
    if (!failed) {
      const n = layers.filter((l) => l.keep.length > 0).length;
      console.log(`\n✓ every instance's unkinded families are in its own baseline (${index.unkinded.length} across ${n} instance(s)), and no id collides. ${relative(repoRoot, INDEX_PATH)} is built at publish — nothing committed to compare.`);
    }
    return failed ? 1 : 0;
  }
  // The table is derived whatever the ratchet says, and `derive:publish` runs
  // this writer: a refused family must not also cost the site its node-kind
  // pages. The baselines are what a refusal holds back.
  writeTable(index);
  if (failed) return 1;
  for (const w of writes) {
    writeFileSync(w.path, w.text);
    console.log(`wrote ${relative(repoRoot, w.path)}`);
  }
  return 0;
}

/** The old gate: the committed table is the one baseline, and `--check` compares its bytes. */
function legacy(index: NodeKindIndex, check: boolean, accept: boolean): number {
  const prior = committed();
  const at = relative(repoRoot, INDEX_PATH);
  let failed = false;
  for (const id of index.collisions) {
    console.log(`  ✗ two different node kinds are both named \`${id}\``);
    failed = true;
  }
  // Without a committed file there is no baseline to compare against: the
  // first write establishes it, which is the one time accepting is implied.
  const fresh = prior === undefined ? [] : newUnkinded(index, prior);
  if (fresh.length > 0 && !accept) {
    console.log(`\n✗ ${fresh.length} NEW famil(ies) with no node kind — declare a nodeKind() and point the family's validator node at it:`);
    for (const k of fresh) console.log(`    ${k}`);
    console.log(`  (or, deliberately, \`bun run cat node-kinds --accept-unkinded\` to baseline it)`);
    failed = true;
  }
  const want = render(index);
  if (check) {
    if (prior === undefined || readFileSync(INDEX_PATH, "utf-8") !== want) {
      const gone = prior ? prior.unkinded.length - index.unkinded.filter((u) => !fresh.includes(unkindedKey(u))).length : 0;
      console.log(`\n✗ ${at} is stale${gone > 0 ? ` — ${gone} baselined famil(ies) became node kinds` : ""}. Run \`bun run cat node-kinds\` and commit.`);
      failed = true;
    }
    if (!failed) console.log(`\n✓ ${at} is current, no new family is unkinded, and no id collides.`);
    return failed ? 1 : 0;
  }
  if (failed) return 1;
  writeTable(index);
  return 0;
}

async function main(): Promise<number> {
  const check = process.argv.includes("--check");
  const accept = process.argv.includes("--accept-unkinded");
  const index = await nodeKindIndex(defaultGraphTypologies, HARNESS_ROOT, repoRoot);
  printKinds(index);
  return tableBuiltAtPublish() ? perLayer(index, check, accept) : legacy(index, check, accept);
}

if (import.meta.main) process.exit(await main());
