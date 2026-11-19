/**
 * The on-disk LAYOUT of a subscription's materialised parts, and a structural
 * reader of one part's record — shared by the writer (`kg:materialize`, core),
 * the subscriptions viewer, and the site build's reader of held trees
 * (`subscribed-trees.ts`, harness). `kg-subscribe.ts` re-exports everything
 * here.
 *
 * @module cat-harness/scripts/kg-parts
 */
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { KG_PART_RECORD_SCHEMA } from "../schemas/kg/substrate-snapshot.js";

/**
 * Slices 5 and 6 copy a CHOSEN subgraph, or one asset, of a subscribed
 * substrate into the subscriber. The writer is `kg:materialize`, and it
 * lives in the content layer rather than here for one reason: its record embeds core's
 * `MaterializationSchema`, and this layer needs only bootstrap, so a
 * writer here would import up the dependency arrow (`check:partition`).
 *
 * What lives HERE is what the readers below core need without importing up:
 * where a part's bytes and record sit, how a tree is digested, and a
 * STRUCTURAL view of a record that the subscriptions page draws from. One
 * layout, stated once, read by the writer, its `--check`, that page and
 * `check:materialized-fixity`.
 *
 * ## The layout
 *
 * Under the subscriber's own `substrate-snapshot` directory — the same place
 * the snapshot is cached, because a materialised part is the same layer:
 * somebody else's bytes at the pin, written by a command, never by hand.
 *
 * ```text
 * <snapshot dir>/<subscription>/subgraphs/<subgraph id>/materialization.json
 * <snapshot dir>/<subscription>/subgraphs/<subgraph id>/tree/…      the upstream directory's contents
 * <snapshot dir>/<subscription>/assets/<upstream path>/materialization.json
 * <snapshot dir>/<subscription>/assets/<upstream path>/tree/<file>
 * <snapshot dir>/<subscription>/nested/<subgraph path>/materialization.json
 * <snapshot dir>/<subscription>/nested/<subgraph path>/tree/…   a NESTED subgraph's contents
 * <snapshot dir>/<subscription>/nodes/<subgraph path>/nodes.json
 * <snapshot dir>/<subscription>/nodes/<subgraph path>/index.hydrated.jsonld
 * ```
 *
 * An INSTANTIATED harness's state is NOT here. `kg:instantiate` (slice 7)
 * writes it to the subscriber's `subscribed-harnesses` directory instead, at
 * `<state dir>/<subscription>/<harness>/` ({@link harnessHomeOf}). It sat here
 * under `<subscription>/harnesses/` for a few hours (arc gap G11), which made
 * this directory both upstream's read-only bytes and the subscriber's working
 * state, so it could not answer `readOnly` (owner, 2026-10-30, bean `w1gy`
 * finding 1, option C: "split the directory"). A `harnesses/` found here now
 * is a stray, which is how the old layout is reported rather than read.
 *
 * `nested/` is the byte copy of a subgraph declared FROM WITHIN another
 * (`skills/voices`, declared in `skills/skills.json`). Owner, 2026-10-24
 * (cat-harness-tools#744, ruling 4): it is CHOSEN by its parent's id — the
 * snapshot holds the root declaration only, so a nested id cannot be checked
 * offline — and materialised by its PATH. Its record says so (`nested: true`,
 * the parent's `id`, its own `path`), and it sits apart from the parent's
 * part, keyed by path like an asset, because re-materialising the parent
 * replaces the parent's directory whole and must never take a child with it.
 *
 * `nodes/` is the METADATA mode (`kg:materialize --nodes`, bean `c1m4`): the
 * subgraph's published `index.hydrated.jsonld` and a `nodes.json` record with
 * its sha256 — graph metadata, no bytes of the subgraph itself. No `tree/`,
 * because the part is one file and the record never hashes itself; and the
 * directory nests (`nodes/skills/` may hold `nodes/skills/sdlc/`), because a
 * subgraph path is a path, so a fetch of a parent never disturbs a child.
 *
 * The bytes sit under `tree/`, apart from the record, so a digest over the
 * tree never has to exclude the record that carries it, and so a scanner can
 * be told "do not read upstream's own files as ours" with one directory name
 * (`check:materialized-fixity` honours it: upstream's materialization records
 * describe upstream's checkout, not this one).
 */
export const PART_RECORD_FILE = "materialization.json";
export const PART_TREE = "tree";

/** `nested: true`: a subgraph declared within its parent `id`, held by `path` under {@link NESTED_DIR}. */
export type KgPart = { kind: "subgraph"; id: string; path: string; nested?: true } | { kind: "asset"; path: string };

/** Where nested subgraphs' byte copies live, keyed by path (module note). */
export const NESTED_DIR = "nested";

/** The metadata-mode record beside a fetched `index.hydrated.jsonld`. */
export const NODES_RECORD_FILE = "nodes.json";
export const NODES_DIR = "nodes";

/**
 * Where a subscribed harness's local state lives: `<state dir>/<subscription>/<harness>/`.
 * `stateDir` is the subscriber's declared `subscribed-harnesses` directory
 * (`harnessStateDirFor` in `subscribed-harnesses.ts`), never the snapshot
 * directory. Keyed by subscription first, so two subscriptions can never write
 * into one home.
 */
export function harnessHomeOf(stateDir: string, subscription: string, harness: string): string {
  return join(stateDir, subscription, harness);
}

/** Where one subgraph's metadata-mode record and `index.hydrated.jsonld` live. */
export function nodesDirOf(snapshotDir: string, subscription: string, subgraphPath: string): string {
  return join(snapshotDir, subscription, NODES_DIR, ...subgraphPath.split("/").filter(Boolean));
}

/** Where a part's record and `tree/` live. */
export function partDirOf(
  snapshotDir: string,
  subscription: string,
  part: { kind: "subgraph"; id: string; path?: string; nested?: true } | { kind: "asset"; path: string },
): string {
  if (part.kind === "subgraph" && part.nested) return join(snapshotDir, subscription, NESTED_DIR, ...(part.path ?? part.id).split("/"));
  return part.kind === "subgraph"
    ? join(snapshotDir, subscription, "subgraphs", part.id)
    : join(snapshotDir, subscription, "assets", ...part.path.split("/"));
}

/**
 * A repository-relative POSIX path that stays where it is joined, or why not.
 * No absolute path, no `..`, no empty or dot-prefixed segment — the last is
 * the dot-prefix guard every declared path here already meets.
 */
export function safeRelPath(p: string): { ok: true; path: string } | { ok: false; why: string } {
  const path = p.replace(/\/+$/, "");
  if (!path) return { ok: false, why: "an empty path names the whole repository, not a part of it" };
  if (path.startsWith("/") || path.includes("\\") || /^[A-Za-z]:/.test(path)) {
    return { ok: false, why: `\`${p}\` is not a repository-relative POSIX path` };
  }
  for (const s of path.split("/")) {
    if (s === "" || s === "." || s === "..") return { ok: false, why: `\`${p}\` has a \`${s || "//"}\` segment` };
    if (s.startsWith(".")) return { ok: false, why: `\`${p}\` has a dot-prefixed segment \`${s}\`` };
  }
  return { ok: true, path };
}

/** Every file under `dir`, relative and sorted; symbolic links reported apart, never followed. */
export function treeEntries(dir: string): { files: string[]; links: string[] } {
  const files: string[] = [];
  const links: string[] = [];
  const walk = (d: string): void => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      const rel = relative(dir, p).split("\\").join("/");
      if (e.isSymbolicLink()) links.push(rel);
      else if (e.isDirectory()) walk(p);
      else if (e.isFile()) files.push(rel);
    }
  };
  if (existsSync(dir)) walk(dir);
  return { files: files.sort(), links: links.sort() };
}

export const sha256File = (p: string): string => createHash("sha256").update(readFileSync(p)).digest("hex");

/**
 * One digest over a whole tree: sha256 of the `sha256sum` listing of its
 * files — `<digest>  <relative path>\n`, sorted by path. It moves when a byte
 * changes and when a file is added, removed or renamed, which is what lets a
 * single `fixity` on a directory record mean something. Empty directories are
 * not content (git holds none).
 */
export function treeDigest(dir: string, files: readonly string[] = treeEntries(dir).files): string {
  const listing = files.map((f) => `${sha256File(join(dir, f))}  ${f}\n`).join("");
  return createHash("sha256").update(listing).digest("hex");
}

/**
 * A STRUCTURAL view of one part record — enough to draw it, and to say
 * whether its bytes still hash to what it records. It reads fields and parses
 * nothing against core's schema; that is the writer's `--check`. A record it
 * cannot read is `unreadable`, never skipped.
 */
export interface PartView {
  /** The part's directory, absolute. */
  dir: string;
  /**
   * Which part the LAYOUT says this directory holds. Known even when the
   * record is unreadable, so a broken record is drawn on its part's row
   * instead of falling off the page.
   */
  slot: { kind: "subgraph"; id: string } | { kind: "nested"; path: string } | { kind: "asset"; path: string };
  /** Which part the RECORD says it is; the writer's `--check` holds the two equal. */
  part?: KgPart;
  ref?: string;
  state: "materialized" | "referenced" | "unreadable";
  /** Why it is unreadable. */
  why?: string;
  /** For a part that stayed referenced: the gates that came back `refused`, and those not answered. */
  refused: string[];
  unanswered: string[];
  /** For a part that stayed referenced: no purpose was stated, so no gate could be judged. */
  purposeMissing?: boolean;
  purpose?: string;
  bytes?: number;
  fileCount?: number;
  /** A held part only: whether the bytes under `tree/` still hash to the record. */
  fixity?: "verified" | "mismatch" | "absent";
}

/** One part directory's record, read structurally — {@link PartView}. Exported for `subscribed-trees.ts`. */
export function viewOf(dir: string, slot: PartView["slot"]): PartView {
  const base: PartView = { dir, slot, state: "unreadable", refused: [], unanswered: [] };
  let r: Record<string, unknown>;
  try {
    r = JSON.parse(readFileSync(join(dir, PART_RECORD_FILE), "utf8")) as Record<string, unknown>;
  } catch (e) {
    return { ...base, why: `not readable as JSON: ${e instanceof Error ? e.message : String(e)}` };
  }
  if (r["$schema"] !== KG_PART_RECORD_SCHEMA) return { ...base, why: `not a \`${KG_PART_RECORD_SCHEMA}\` record` };
  const m = (r["materialization"] ?? {}) as Record<string, unknown>;
  const part = r["part"] as KgPart | undefined;
  const view: PartView = {
    ...base,
    ...(part ? { part } : {}),
    ...(typeof r["ref"] === "string" ? { ref: r["ref"] } : {}),
    ...(typeof m["purpose"] === "string" ? { purpose: m["purpose"] } : {}),
    ...(typeof m["bytes"] === "number" ? { bytes: m["bytes"] } : {}),
  };
  if (m["state"] === "referenced") {
    const refusal = (r["refusal"] ?? {}) as Record<string, unknown>;
    const gates = (refusal["gates"] ?? {}) as Record<string, { verdict?: string }>;
    return {
      ...view,
      state: "referenced",
      ...(refusal["purposeMissing"] === true ? { purposeMissing: true } : {}),
      refused: Object.keys(gates).filter((k) => gates[k]?.verdict === "refused").sort(),
      unanswered: Object.keys(gates).filter((k) => gates[k]?.verdict !== "refused" && gates[k]?.verdict !== "permitted").sort(),
    };
  }
  if (m["state"] !== "materialized") return { ...view, why: `state \`${String(m["state"])}\` is neither held nor referenced` };
  const tree = join(dir, PART_TREE);
  const { files } = treeEntries(tree);
  const want = ((m["fixity"] ?? {}) as { digest?: unknown }).digest;
  let fixity: PartView["fixity"];
  if (files.length === 0) fixity = "absent";
  else if (part?.kind === "asset") fixity = files.length === 1 && sha256File(join(tree, files[0]!)) === want ? "verified" : "mismatch";
  else fixity = treeDigest(tree, files) === want ? "verified" : "mismatch";
  return { ...view, state: "materialized", fileCount: files.length, fixity };
}
