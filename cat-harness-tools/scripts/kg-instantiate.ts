#!/usr/bin/env bun
/**
 * INSTANTIATE a harness a subscription chose: write `<harness>.config.json` at
 * the instantiation root, and the state directories the harness declares, so
 * the harness reaches the navbar. The third verb after subscribe
 * (`kg-subscribe.ts`) and materialise.
 *
 * @module cat-harness/scripts/kg-instantiate
 * @covers cat-harness, substrate-snapshot
 *
 * ## What it reads, and why nothing is fetched
 *
 * The harness's declaration is the substrate snapshot `kg:subscribe` cached at
 * the subscription's pin, and nothing else: the pin was judged once and its
 * bytes carry a digest. A missing or edited snapshot is refused rather than
 * refetched.
 *
 * ## The refusals, each with its reason
 *
 * - **not chosen**: the harness is not in the subscription's `harnesses`.
 *   Choosing is the subscriber's act, recorded in the declaration.
 * - **not declared**: the snapshot does not list it among the substrate's
 *   harnesses at the pin.
 * - **a need unmet**: every name in the harness's `needs` must be a layer
 *   in this checkout, or a substrate some subscription here holds the snapshot
 *   of. The missing ones are named.
 * - **a name taken**: a local layer already carries the harness's name. Two
 *   declarations under one name is the ambiguity `disambiguate` reports, and
 *   the config file would bind to the wrong one.
 *
 * ## Three answers, never two
 *
 * `could-not-determine` is its own result and is never clean: a snapshot that
 * is absent or will not parse, an unreadable declaration in the checkout while
 * a need is still unresolved, or a directory whose graph typologies this registry
 * does not know, so whether it is a STATE directory cannot be said. The run
 * stops and names the kinds to register.
 *
 * ## Where the state directories go
 *
 * Under the subscriber's own `subscribed-harnesses` directory (graph typology
 * `subscribed-harnesses`, `holds: "state"`), at
 * `<state dir>/<subscription>/<harness>/`, at each directory's declared path,
 * with a `.gitkeep` so an empty directory survives a commit
 * (`harnessHomeOf` in `kg-parts.ts`). A subscriber that declares no such
 * directory is refused, with what to declare, as `kg:subscribe` refuses one
 * that declares no snapshot directory. Not the instantiation root (not a
 * declared directory, and it may hold a staged layer of the same name),
 * and not the snapshot directory (which stays read-only). The harness has no
 * local declaration (see `schemas/kg/substrate-snapshot.ts`).
 *
 * ## Idempotent, and the config is never overwritten
 *
 * State directories are written first and the config last, so a config on disk
 * means the directories were made. A run that finds the config reports it as
 * already instantiated and leaves it byte for byte; it still creates any state
 * directory that has gone missing.
 *
 * ## How it reaches the navbar
 *
 * `harness-tiles.ts` draws a tile for every chosen harness whose config sits
 * at the root and that no local layer names, from its snapshot
 * (`subscribedTile` in `subscribed-harnesses.ts`); `check-instance-config.ts` counts a chosen
 * harness's config as claimed rather than orphaned. Run `bun run
 * docs:harness` afterwards to regenerate `docs/_data/harness.json`.
 *
 * `check:instance-render` judges only layers with a local tree to render,
 * so it says nothing about a subscribed harness until its subgraphs are
 * materialised.
 *
 * Usage:
 *   bun run cat kg:instantiate <subscription-id> <harness> [--instance <dir>] [--dry-run]
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";

import {
  type CatHarnessDeclaration,
  findDeclarationFile,
  graphLayer,
  layerRootsIn,
  readDeclaration,
  repoRootFor,
} from "../schemas/kg/cat-harness.js";
import { layerConfigFilename } from "../schemas/kg/harness-config.js";
import { addIndexLayer, readIndexConfig } from "../schemas/kg/index-config.js";
import { harnessHomeOf } from "./kg-parts.js";
import { HARNESS_STATE_GRAPH_TYPOLOGY } from "../schemas/kg/substrate-snapshot.js";
import { type HarnessDeclaration, harnessDeclarationIn, harnessStateDirFor, readSnapshot } from "./subscribed-harnesses.js";
import { HARNESS_ROOT } from "./lib/roots.ts";

const INSTANCE = join(HARNESS_ROOT);

/** A declared path that may be created under the harness's home: relative, no `..`, no dot-prefixed segment. */
export function unsafePathReason(path: string): string | undefined {
  if (isAbsolute(path)) return "is absolute";
  const segs = path.split("/").filter((s) => s !== "" && s !== ".");
  if (segs.length === 0) return "names the harness's root rather than a directory under it";
  if (segs.includes("..")) return "climbs out of the harness's home";
  const dot = segs.find((s) => s.startsWith("."));
  if (dot) return `has the dot-prefixed segment \`${dot}\``;
  return undefined;
}

export type StateDirectories =
  | { state: "determined"; dirs: { id: string; path: string }[] }
  | { state: "could-not-determine"; reason: string };

/**
 * The directories a harness declares that hold STATE: any directory with a
 * kind whose layer is `state`. A directory none of whose kinds is state, and
 * at least one of whose kinds this registry does not know, is undetermined.
 */
export function stateDirectoriesOf(decl: HarnessDeclaration): StateDirectories {
  const dirs: { id: string; path: string }[] = [];
  const undetermined: string[] = [];
  for (const d of decl.directories) {
    const layers = d.graphTypologies.map((k) => graphLayer(k));
    if (layers.includes("state")) dirs.push({ id: d.id, path: d.path });
    else if (layers.includes(undefined)) {
      const unknown = d.graphTypologies.filter((k) => graphLayer(k) === undefined);
      undetermined.push(`\`${d.id}\` (${unknown.map((k) => `\`${k}\``).join(", ")})`);
    }
  }
  if (undetermined.length) {
    return {
      state: "could-not-determine",
      reason:
        `whether ${undetermined.length === 1 ? "this directory holds" : "these directories hold"} state cannot be said: ${undetermined.join("; ")} ` +
        `— no graph typology registered here names its layer. Register the kind (with its \`holds\`) and re-run`,
    };
  }
  return { state: "determined", dirs };
}

/**
 * Where a subscribed harness's local state lives:
 * `<state dir>/<subscription>/<harness>/`. `stateDir` is the subscriber's
 * declared `subscribed-harnesses` directory (bean `w1gy` finding 1).
 */
export function harnessHome(stateDir: string, subscription: string, harness: string): string {
  return harnessHomeOf(stateDir, subscription, harness);
}

export type InstantiateResult =
  | {
      ok: true;
      state: "instantiated" | "already-instantiated";
      configFile: string;
      stateDirs: string[];
      /** Every file or directory this run wrote (or would, on a dry run). Empty when nothing changed. */
      written: string[];
    }
  | { ok: false; state: "refused" | "could-not-determine"; reason: string };

export interface InstantiateOptions {
  subscription: string;
  harness: string;
  /** The subscribing layer's directory. Defaults to cat-harness. */
  instance?: string;
  /** The instantiation root, where `<harness>.config.json` goes. Defaults to the layer's repository root. */
  root?: string;
  dryRun?: boolean;
}

/** Each declaration in the checkout, or the reason one could not be read. */
function declarationsIn(root: string): { decls: { dir: string; decl: CatHarnessDeclaration }[]; unreadable: string[] } {
  const decls: { dir: string; decl: CatHarnessDeclaration }[] = [];
  const unreadable: string[] = [];
  for (const dir of layerRootsIn(root)) {
    try {
      const decl = readDeclaration(dir);
      if (decl) decls.push({ dir, decl });
    } catch (e) {
      unreadable.push(`${relative(root, dir) || "."}: ${e instanceof Error ? e.message.split("\n")[0] : String(e)}`);
    }
  }
  return { decls, unreadable };
}

export function instantiate(opts: InstantiateOptions): InstantiateResult {
  const instanceRoot = resolve(opts.instance ?? INSTANCE);
  const root = resolve(opts.root ?? repoRootFor(instanceRoot));
  const refuse = (reason: string): InstantiateResult => ({ ok: false, state: "refused", reason });
  const unknown = (reason: string): InstantiateResult => ({ ok: false, state: "could-not-determine", reason });

  if (!findDeclarationFile(instanceRoot)) return refuse(`${instanceRoot} carries no instance declaration`);
  let subscriber: CatHarnessDeclaration | undefined;
  try {
    subscriber = readDeclaration(instanceRoot);
  } catch (e) {
    return unknown(`the subscriber's declaration could not be read: ${e instanceof Error ? e.message.split("\n")[0] : String(e)}`);
  }
  if (!subscriber) return refuse(`${instanceRoot} carries no instance declaration`);

  const subs = subscriber.subscriptions ?? [];
  const sub = subs.find((s) => s.id === opts.subscription);
  if (!sub) {
    return refuse(
      `${subscriber.name} has no subscription \`${opts.subscription}\`` +
        (subs.length ? `; it subscribes to ${subs.map((s) => `\`${s.id}\``).join(", ")}` : "; it subscribes to nothing — run `bun run cat kg:subscribe` first"),
    );
  }
  if (sub.kind === "content") {
    return refuse(
      `subscription \`${sub.id}\` is to a CONTENT Knowledge Graph (owner, 2026-10-06): it declares Subgraphs and no harness, ` +
        `so it contributes no skills, processes or roles and there is nothing to instantiate. Its Subgraphs are materialised with \`kg:materialize\``,
    );
  }
  const chosen = sub.harnesses ?? [];
  if (!chosen.includes(opts.harness)) {
    return refuse(
      `subscription \`${sub.id}\` did not choose harness \`${opts.harness}\`` +
        (chosen.length ? ` (it chose ${chosen.map((h) => `\`${h}\``).join(", ")})` : " (it chose no harness)") +
        `. Choosing is recorded in the declaration: add it to the subscription's \`harnesses\` first`,
    );
  }

  const read = readSnapshot(instanceRoot, subscriber, sub);
  if (read.state === "mismatch") return refuse(read.reason);
  if (read.state !== "read") return unknown(read.reason);
  const snap = read.snapshot;
  if (!snap.summary.harnesses.includes(opts.harness)) {
    return refuse(
      `${sub.repository} at ${sub.ref.slice(0, 12)} does not declare harness \`${opts.harness}\`; ` +
        `it declares ${snap.summary.harnesses.map((h) => `\`${h}\``).join(", ")}`,
    );
  }
  const harness = harnessDeclarationIn(snap, opts.harness);
  if (!harness) return unknown(`the snapshot lists \`${opts.harness}\` but its bytes do not declare it — re-run \`bun run cat kg:subscribe:check\``);

  const { decls, unreadable } = declarationsIn(root);
  const local = new Set(decls.map((d) => d.decl.name));
  if (local.has(opts.harness)) {
    return refuse(
      `a local instance in this checkout is already named \`${opts.harness}\`; a config of that name binds to it, ` +
        `so a subscribed harness cannot be instantiated under the same name`,
    );
  }

  // NEEDS: local layers, or substrates whose snapshot some subscription here holds.
  const subscribed = new Set<string>();
  const snapshotGaps: string[] = [];
  for (const { dir, decl } of decls) {
    for (const s of decl.subscriptions ?? []) {
      const r = readSnapshot(dir, decl, s);
      if (r.state === "read") {
        subscribed.add(r.snapshot.summary.name);
        for (const h of r.snapshot.summary.harnesses) subscribed.add(h);
      } else snapshotGaps.push(`${decl.name}/${s.id}: ${r.reason}`);
    }
  }
  const missing = (harness.needs ?? []).filter((n) => !local.has(n) && !subscribed.has(n));
  if (missing.length) {
    const gaps = [...unreadable, ...snapshotGaps];
    if (gaps.length) {
      return unknown(
        `\`${opts.harness}\` needs ${missing.map((n) => `\`${n}\``).join(", ")}, found neither locally nor by a subscription — ` +
          `but ${gaps.length} source(s) could not be read, so the answer is not known: ${gaps.join("; ")}`,
      );
    }
    return refuse(
      `\`${opts.harness}\` needs ${missing.map((n) => `\`${n}\``).join(", ")}, which ${missing.length === 1 ? "is" : "are"} neither ` +
        `an instance in this checkout nor a substrate any subscription here holds. Subscribe to ${missing.length === 1 ? "it" : "them"} first`,
    );
  }

  const states = stateDirectoriesOf(harness);
  if (states.state === "could-not-determine") return unknown(states.reason);
  for (const d of states.dirs) {
    const why = unsafePathReason(d.path);
    if (why) return refuse(`state directory \`${d.id}\` (\`${d.path}\`) ${why}; nothing was written`);
  }

  const stateDir = harnessStateDirFor(instanceRoot, subscriber);
  if (!stateDir) {
    return refuse(
      `${subscriber.name} declares no \`${HARNESS_STATE_GRAPH_TYPOLOGY}\` directory, so an instantiated harness's state has nowhere to go. ` +
        `Declare one (e.g. \`{"id": "${HARNESS_STATE_GRAPH_TYPOLOGY}", "path": "${HARNESS_STATE_GRAPH_TYPOLOGY}/", "graphTypologies": ["${HARNESS_STATE_GRAPH_TYPOLOGY}"]}\`) ` +
        `and re-run; the snapshot directory is upstream's bytes and is never written here`,
    );
  }
  const home = harnessHome(stateDir, sub.id, opts.harness);
  const stateDirs = states.dirs.map((d) => join(home, d.path));
  const written: string[] = [];
  for (const dir of stateDirs) {
    const keep = join(dir, ".gitkeep");
    if (existsSync(dir)) continue;
    written.push(dir);
    if (!opts.dryRun) {
      mkdirSync(dir, { recursive: true });
      writeFileSync(keep, "");
    }
  }

  const config = {
    _comment:
      `${opts.harness.toUpperCase()}, INSTANTIATED from a KG subscription: \`${subscriber.name}\` subscribes to ${sub.repository} ` +
      `as \`${sub.id}\`, pinned at ${sub.ref}, and chose this harness. Its declaration is the cached snapshot, not a local ` +
      `\`${opts.harness}.json\`; its state directories live under \`${relative(root, home).split("\\").join("/")}/\`. Written by \`bun run cat kg:instantiate\`; ` +
      `re-running reports this entry rather than overwriting it.`,
    _subscription: { subscriber: subscriber.name, id: sub.id, repository: sub.repository, ref: sub.ref },
  };
  // With an `index.config.json` at the root, instantiation IS its entry, and
  // the config goes INLINE there (bean `ymvt`: the index is the one config; a
  // `<name>.config.json` beside it is legacy). Without an index, the root
  // config file is the instantiation, as before.
  const idx = readIndexConfig(root);
  if (idx.state === "unreadable") return refuse(`${idx.file} is ${idx.why}; nothing was written`);
  if (idx.state === "ok") {
    const configFile = idx.file;
    if (idx.config.instances.some((e) => e.name === opts.harness) || existsSync(join(root, layerConfigFilename(opts.harness)))) {
      return { ok: true, state: "already-instantiated", configFile, stateDirs, written };
    }
    written.push(configFile);
    if (!opts.dryRun) addIndexLayer(root, { name: opts.harness, ...config });
    return { ok: true, state: "instantiated", configFile, stateDirs, written };
  }

  const configFile = join(root, layerConfigFilename(opts.harness));
  if (existsSync(configFile)) return { ok: true, state: "already-instantiated", configFile, stateDirs, written };
  written.push(configFile);
  if (!opts.dryRun) writeFileSync(configFile, `${JSON.stringify(config, null, 2)}\n`);
  return { ok: true, state: "instantiated", configFile, stateDirs, written };
}

function flag(argv: string[], name: string): string | undefined {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const positional = argv.filter((a, i) => !a.startsWith("--") && argv[i - 1] !== "--instance");
  const [subscription, harness] = positional;
  if (!subscription || !harness) {
    console.error("usage: bun run cat kg:instantiate <subscription-id> <harness> [--instance <dir>] [--dry-run]");
    process.exit(2);
  }
  const dryRun = argv.includes("--dry-run");
  const r = instantiate({ subscription, harness, instance: flag(argv, "--instance"), dryRun });
  if (!r.ok) {
    console.error(`  ${r.state === "could-not-determine" ? "?" : "✗"} ${r.state}: ${r.reason}`);
    process.exit(r.state === "could-not-determine" ? 3 : 1);
  }
  const rel = (p: string) => relative(process.cwd(), p);
  if (r.state === "already-instantiated") console.log(`  ✓ ${harness} is already instantiated: ${rel(r.configFile)} exists and was left as it is`);
  else console.log(`  ✓ ${harness} ${dryRun ? "would be" : "is"} instantiated from \`${subscription}\``);
  for (const f of r.written) console.log(`  ${dryRun ? "would write" : "wrote"} ${rel(f)}`);
  if (r.state === "instantiated" && !dryRun) console.log("  next: `bun run cat docs:harness` to put it in the navbar's data");
}
