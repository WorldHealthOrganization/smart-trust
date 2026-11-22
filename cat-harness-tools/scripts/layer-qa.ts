/**
 * A MOUNTED layer's QA results, read from that layer's OWN store at the
 * commit the index pins.
 *
 * Every layer declares its `qa` directory with
 * `storage: { branch: "cat/cat-harness/qa-reports", keyedBy: "commit" }`: the
 * results are computed, never committed, and kept on that branch of the
 * layer's own repository, keyed by the layer's commit; a layer's QA is that
 * repository's to write.
 *
 * The layer publishes with the reusable workflow
 * `.github/workflows/layer-qa-publish.yml`; this module is the reading half.
 * It never falls back to the index's store: a layer that has not published
 * the pinned commit is a `miss` that names the commit, so a reader reports
 * it rather than judging an older or another repository's copy as current.
 *
 * @module scripts/layer-qa
 * @graphNode none — a reader over the qa-reports store
 * @covers none — it judges nothing; its callers do
 */
import { spawnSync } from "node:child_process";
import { join, relative, resolve } from "node:path";

import { lockFilesIn } from "../schemas/kg/instance-roots.ts";
import { readMountLock } from "../schemas/kg/remote-mount.ts";
import { type QaStoreOptions, type QaTreeRead, readQaTreeAtCommit } from "./qa-store.ts";
import { inputSiteReached } from "../schemas/sdlc/input-trace.ts";

/** Where a mounted layer came from: the lock's repository and pinned commit. */
export interface LayerQaSource {
  instance: string;
  repository: string;
  sha: string;
}

/**
 * The lock entry that put `instanceRoot` where it is, read from the lock at
 * `repoRoot`. `undefined` for a layer no lock mounted (the index's own
 * layers, a sibling clone) — its QA is the index's to read.
 */
export function layerQaSource(repoRoot: string, instanceRoot: string): LayerQaSource | undefined {
  const at = resolve(instanceRoot);
  for (const name of lockFilesIn(resolve(repoRoot)).files) {
    const lock = readMountLock(join(repoRoot, name));
    if (!lock.ok) continue;
    for (const inst of lock.lock.instances) {
      if (inst.hydrated) continue;
      if (resolve(repoRoot, inst.path) === at) return { instance: inst.instance, repository: inst.repository, sha: inst.sha };
    }
  }
  return undefined;
}

/**
 * The remote a repository name is read from. `owner/name` is a GitHub
 * repository; anything else (a URL, a `file://` path) is used as given, which
 * is how the tests stand a store up locally. `QA_LAYER_REMOTE_<INSTANCE>`
 * (upper case, `-` as `_`) overrides one layer.
 */
export function layerQaRemote(source: LayerQaSource, vars?: Record<string, string | undefined>): string {
  let env = vars;
  if (env === undefined) {
    // input-site: traced #5c5cd616 — an override named after the layer, so no `env` verdict can list it: a run that reaches it records no hash; the tests pass their own variables
    inputSiteReached("layer-qa: QA_LAYER_REMOTE_<INSTANCE>");
    env = process.env;
  }
  const override = env[`QA_LAYER_REMOTE_${source.instance.toUpperCase().replace(/-/g, "_")}`];
  if (override) return override;
  return /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(source.repository) ? `https://github.com/${source.repository}.git` : source.repository;
}

/** The private store a layer is read through: one per layer, beside the index's own. */
function layerStoreDir(repoRoot: string, instance: string): string {
  // input-site: env QA_STORE_DIR #96246ebf — a directory the layer stores are kept under instead of the checkout's git directory
  const base = process.env.QA_STORE_DIR;
  if (base) return `${base}-${instance}`;
  // input-site: store #f48bd6b7 — configures a layer's qa-store read: where its private store lives; the store's reads are reported by its snapshot
  const c = spawnSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { cwd: repoRoot, encoding: "utf-8" });
  return join(c.status === 0 ? c.stdout.trim() : join(repoRoot, ".git"), `qa-store-${instance}.git`);
}

/** What {@link readLayerQaTree} answers: the read, and the source it was asked of. */
export type LayerQaRead = { source: LayerQaSource; read: QaTreeRead } | { source: undefined; read: undefined };

/**
 * A mounted layer's QA tree under `prefix` (repository-relative, as the layer
 * published it from the index checkout: `<instance>/test/results/…`), from
 * that layer's own store at the pinned commit.
 */
export function readLayerQaTree(repoRoot: string, instanceRoot: string, prefix = "", opts: Partial<QaStoreOptions> = {}): LayerQaRead {
  const source = layerQaSource(repoRoot, instanceRoot);
  if (source === undefined) return { source: undefined, read: undefined };
  const rel = prefix || relative(resolve(repoRoot), resolve(instanceRoot)).split("\\").join("/");
  const read = readQaTreeAtCommit(source.sha, rel, {
    repoRoot,
    remote: layerQaRemote(source),
    storeDir: layerStoreDir(repoRoot, source.instance),
    log: () => {},
    ...opts,
  });
  return { source, read };
}
