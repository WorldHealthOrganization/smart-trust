/**
 * The directories a SUBSCRIBED harness declares, resolved to the tree this
 * checkout holds for each — the seam through which a site build (or anything
 * else that walks declared directories) reads a layer that is not in the
 * tree.
 *
 * @module cat-harness/scripts/subscribed-trees
 *
 * ## Why it exists
 *
 * Walking the repository's TOP-LEVEL directories for declarations (as
 * `mount-instance-docs.ts` and `compose-docs.ts` publish) finds only staged
 * layers: one read back by subscription has no `<instance>/`, and would
 * silently stop being published. So the question is asked of the DECLARATION:
 * each subscription names a substrate at a pin and the subgraphs it CHOSE;
 * the substrate's own root declaration (cached by `kg:subscribe`) says what
 * each subgraph is; and `kg:materialize` says whether its bytes are held. A
 * directory read through here is an ordinary declared entry whose files live
 * under the part's `tree/` instead of under `<instance>/<path>`.
 *
 * ## Three states, never two
 *
 * - `held` — materialised, and the bytes still hash to the record.
 * - `referenced` — a DETERMINED absence: the subscriber's gates refused it, and
 *   the record says so. Nothing to publish, and that is an answer.
 * - `could-not-determine` — chosen but never materialised, a record that does
 *   not read, bytes that no longer match, or a snapshot that is missing or not
 *   the pin's. Never rendered as an empty pass: a caller that publishes pages
 *   reports these and fails.
 *
 * A subgraph the subscription did NOT choose is referenced by design and is
 * not listed at all — choosing is the subscriber's decision, not a gap.
 *
 * ## Shared, not per-consumer
 *
 * One function, so the site build and the navbar (`harness-tiles.ts`) cannot
 * disagree about which subscribed directories are held. A remote mount of a
 * declared directory pinned to a SHA lands at the same kind of place — a tree
 * for a declared entry — and reads through this seam.
 */
import { existsSync, mkdirSync, mkdtempSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import type { Subscription } from "../schemas/kg/cat-harness.js";
import { PART_RECORD_FILE, PART_TREE, partDirOf, viewOf } from "./kg-parts.js";
import { readSnapshot, snapshotDirFor } from "./subscribed-harnesses.js";
import { inputSiteReached } from "../schemas/sdlc/input-trace.ts";

/** A declared directory as the substrate's own declaration writes it — every field kept, so `instanceRoot`, `composed` and the rest read as they would in-tree. */
export type SubscribedEntry = { id: string; path: string; graphTypologies: string[] } & Record<string, unknown>;

export type SubscribedTreeState = "held" | "referenced" | "could-not-determine";

/** One chosen subgraph of one subscription, and what this checkout holds for it. */
export interface SubscribedTree {
  /** The subscribing layer's `name`. */
  subscriber: string;
  subscription: Subscription;
  /** The substrate's own layer name — what its routes and tiles are keyed on. Undefined only when the snapshot could not be read. */
  instance?: string;
  /** The subgraph id the subscription chose. */
  subgraph: string;
  /** The substrate's declaration of it; undefined when the snapshot does not declare it. */
  entry?: SubscribedEntry;
  state: SubscribedTreeState;
  /** The held bytes, absolute — set exactly when `state` is `held`. */
  tree?: string;
  /** Why it is not held. */
  reason?: string;
}

type DeclLike = {
  name: string;
  directories?: readonly { path: string; graphTypologies?: readonly string[] }[];
  subscriptions?: readonly Subscription[];
};

/**
 * Every subgraph some subscription in `decls` chose, resolved to its held
 * tree or to why there is none.
 *
 * @param decls each subscribing layer's root directory and declaration
 */
export function subscribedTrees(decls: readonly { dir: string; decl: DeclLike }[]): SubscribedTree[] {
  const out: SubscribedTree[] = [];
  for (const { dir, decl } of decls) {
    for (const s of decl.subscriptions ?? []) {
      const chosen = s.subgraphs ?? [];
      if (!chosen.length) continue;
      const base = { subscriber: decl.name, subscription: s };
      const read = readSnapshot(dir, decl, s);
      if (read.state !== "read") {
        for (const g of chosen) out.push({ ...base, subgraph: g, state: "could-not-determine", reason: read.reason });
        continue;
      }
      let raw: { name?: string; directories?: SubscribedEntry[] };
      try {
        raw = JSON.parse(read.snapshot.raw);
      } catch (e) {
        const reason = `the snapshot of \`${s.id}\` carries a root declaration that is not JSON: ${e instanceof Error ? e.message : String(e)}`;
        for (const g of chosen) out.push({ ...base, subgraph: g, state: "could-not-determine", reason });
        continue;
      }
      const instance = raw.name;
      const snapshotDir = snapshotDirFor(dir, decl)!; // readSnapshot read a file under it
      for (const g of chosen) {
        const entry = (raw.directories ?? []).find((d) => d.id === g);
        const at = { ...base, ...(instance ? { instance } : {}), subgraph: g };
        if (!entry) {
          out.push({ ...at, state: "could-not-determine", reason: `\`${s.id}\` chooses subgraph \`${g}\`, which ${s.repository}@${s.ref.slice(0, 12)} does not declare` });
          continue;
        }
        const partDir = partDirOf(snapshotDir, s.id, { kind: "subgraph", id: g });
        if (!existsSync(join(partDir, PART_RECORD_FILE))) {
          out.push({
            ...at,
            entry,
            state: "could-not-determine",
            reason: `subgraph \`${g}\` of \`${s.id}\` is chosen but not materialised — run \`bun run cat kg:materialize ${s.id} ${g}\``,
          });
          continue;
        }
        const view = viewOf(partDir, { kind: "subgraph", id: g });
        if (view.state === "referenced") {
          const why = view.purposeMissing
            ? "no purpose was stated"
            : [view.refused.length ? `refused: ${view.refused.join(", ")}` : "", view.unanswered.length ? `unanswered: ${view.unanswered.join(", ")}` : ""].filter(Boolean).join("; ");
          out.push({ ...at, entry, state: "referenced", reason: `subgraph \`${g}\` of \`${s.id}\` stayed referenced (${why || "by its record"})` });
        } else if (view.state === "unreadable") {
          out.push({ ...at, entry, state: "could-not-determine", reason: `the record of subgraph \`${g}\` of \`${s.id}\` is unreadable: ${view.why}` });
        } else if (view.ref !== undefined && view.ref !== s.ref) {
          out.push({ ...at, entry, state: "could-not-determine", reason: `subgraph \`${g}\` of \`${s.id}\` was materialised at ${view.ref.slice(0, 12)}, the subscription pins ${s.ref.slice(0, 12)} — re-materialise` });
        } else if (view.fixity !== "verified") {
          out.push({ ...at, entry, state: "could-not-determine", reason: `the held bytes of subgraph \`${g}\` of \`${s.id}\` do not match their record (fixity ${view.fixity})` });
        } else {
          out.push({ ...at, entry, state: "held", tree: join(partDir, PART_TREE) });
        }
      }
    }
  }
  return out;
}

/**
 * Each subscribed layer's HELD subgraphs laid out at their declared paths
 * under one root — the layer as it would look checked out, with only the
 * held directories present. Each directory is a symbolic link to its part's
 * `tree/`; nothing is copied.
 *
 * Why a root at all, rather than each tree on its own: a page in one
 * directory may embed a file from another of the same layer — a catalogue
 * replica in `site/` shows covers kept in `library/` — and a reference like
 * `../library/x.png` only resolves against the layer's own layout. With
 * the root, a consumer treats a subscribed layer exactly as an in-tree one.
 *
 * A consumer that COPIES a directory must copy its real path
 * (`realpathSync`), since copying the link copies a link.
 *
 * @param trees  {@link subscribedTrees}'s result; only `held` ones are laid out
 * @param into   where to make the roots; a fresh temporary directory by default
 * @returns      instance name → its root
 */
export function layoutSubscribedInstances(trees: readonly SubscribedTree[], into?: string): Map<string, string> {
  const roots = new Map<string, string>();
  let base = into;
  for (const t of trees) {
    if (t.state !== "held" || !t.instance || !t.entry || !t.tree) continue;
    // input-site: traced #18eba981 — subscribed trees are read from a store outside the checkout, laid out under a temp dir
    inputSiteReached("subscribed-trees: lays out subscribed instances");
    base ??= mkdtempSync(join(tmpdir(), "subscribed-instances-"));
    const root = join(base, t.instance);
    roots.set(t.instance, root);
    const at = join(root, ...t.entry.path.split("/").filter(Boolean));
    if (existsSync(at)) continue; // two subgraphs declared at one path is the substrate's finding, not a second link
    mkdirSync(dirname(at), { recursive: true });
    symlinkSync(t.tree, at, "dir");
  }
  return roots;
}
