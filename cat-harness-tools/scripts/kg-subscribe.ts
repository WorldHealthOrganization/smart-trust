#!/usr/bin/env bun
/**
 * SUBSCRIBE a layer to an external Knowledge Graph — a **substrate** — at a
 * pinned commit: fetch ONLY the substrate's declaration (at its root, or one
 * directory down — `upstreamPath`), judge it, and on
 * success record the subscription and a cached snapshot of what was judged.
 * It writes the choice and the pin, and nothing else arrives (materialise and
 * instantiate are the other verbs).
 *
 * @module cat-harness/scripts/kg-subscribe
 * @covers cat-harness, substrate-snapshot, subscribed-harnesses
 *
 * ## What a substrate is
 *
 * A repository is a substrate at a commit when **both** hold:
 *
 * 1. **It carries a bootstrap declaration — at the root, or in ONE directory
 *    named for it.** The declaration is found by bootstrap's own rule
 *    (`declarationFileIn`: the `<stem>.json` whose `name` equals `<stem>`, and
 *    exactly one of them) — where to look is the section after next — and it parses as
 *    bootstrap's `KnowledgeGraphDeclarationSchema`. Nothing of this harness's
 *    schema is asked of it: a substrate need not be built on cat-harness, and
 *    every field bootstrap does not define is an Extension it may carry.
 * 2. **It declares at least one harness.** Bootstrap defines the term: *"A
 *    Knowledge Graph whose Subgraphs hold Skills, Roles or Processes."* And
 *    bootstrap names the Graph Typology for each: `skills` holds Skills,
 *    `scenarios` holds Roles, `processes` holds Processes
 *    (`BOOTSTRAP_GRAPH_TYPOLOGIES`). So a declaration IS a harness when at least
 *    one of its `directories` lists one of those three kinds in `graphTypologies`
 *    — {@link HARNESS_GRAPH_TYPOLOGIES}, {@link harnessesOf}.
 *
 * Not "has a `<name>.config.json`" (that says a harness is INSTANTIATED here,
 * which a substrate offers to the subscriber), and not this harness's own
 * graph typologies (the substrate meets BOOTSTRAP's requirements, whoever
 * asks).
 *
 * ### Where the declaration is looked for — `upstreamPath`
 *
 * A fork that left a monorepo often keeps its layer one directory down
 * (e.g. `shared/<name>.json`, the directory not named for the layer). So
 * the search is, in order ({@link judgeTree}):
 *
 * 1. **`--upstream-path <dir>`, or the one the subscription already records.**
 *    Only that directory is read, and it must hold exactly one declaration
 *    (the one named `--name`, when given). This is the spelling to use
 *    whenever the fallback below would have to choose.
 * 2. **The root**, by bootstrap's rule.
 * 3. **Exactly one level down**: every top-level directory's `<stem>.json`
 *    whose `name` is `<stem>` — the rule `findInstance` in
 *    `scripts/remote-mount.ts` applies to a remote tree, and
 *    `findDeclarationFile` applies on disk. With `--name`, or the name a
 *    recorded snapshot carries, only a file of that name counts. ONE
 *    candidate is accepted and its directory recorded as the subscription's
 *    `upstreamPath`; TWO OR MORE are refused by name, never guessed between
 *    (`ambiguous`) — pick one with `--upstream-path` or `--name`.
 *
 * `upstreamPath` has the same name and shape as on the remote subgraph source.
 * Deeper than one level is reached only by naming it. A harness nested
 * elsewhere in the same repository is not seen, and the zero-harness reason
 * says so.
 *
 * ### A content Knowledge Graph is a SECOND kind
 *
 * A declaration with Subgraphs and NO harness — a FHIR implementation guide,
 * a document corpus — is accepted, as kind **`content`**,
 * not as a substrate. Bootstrap's definition above is unchanged; this is a
 * separate classification, written explicitly wherever it is recorded: the
 * subscription carries `kind: "content"`, the snapshot carries `kind:
 * "content"` and an empty `harnesses`, and the verdict's `state` is
 * `"content"` (`AcceptedVerdict`), so no reader can take one for the other.
 * A content subscription contributes NO skills, processes or roles: it may
 * choose no harness (the schema refuses one), `kg:instantiate` refuses it,
 * and its Subgraphs are referenced or materialised like any other. A
 * declaration with no harness and no Subgraph is still not-a-substrate, and
 * a tree with no declaration keeps every reason it had.
 *
 * ## The verdicts
 *
 * - **substrate** — both points hold; the harness names are listed.
 * - **content** — the declaration holds and declares Subgraphs but no harness.
 * - **not-a-substrate(reason)** — the bytes were read and one point fails.
 * - **ambiguous(reason, candidates)** — the bytes were read and more than one
 *   directory one level down holds a declaration. `subscribe` reports it as
 *   REFUSED, with every candidate: the fix is a choice somebody makes, not a
 *   verdict on the repository.
 * - **could-not-determine(reason)** — the bytes were NOT read: the network,
 *   the forge, a SHA the remote does not serve. Never collapsed into either
 *   other answer.
 *
 * An unpinned ref is refused BEFORE anything is fetched, with
 * `sync-remote-skills`' {@link pinnedRef}: the same reason, the same words.
 *
 * ## What is written, and where
 *
 * - The subscriber's `<instance>.json` gains (or keeps) a `subscriptions`
 *   entry: `id`, `repository`, `ref`, and NOTHING CHOSEN — every subgraph,
 *   asset and harness starts referenced. A re-subscribe at the same pin keeps
 *   whatever the subscriber has chosen since and changes no byte.
 * - A {@link SubstrateSnapshotSchema} node, `<id>.substrate.json`, in the
 *   subscriber's OWN directory declared with graph typology `substrate-snapshot`.
 *   Found through the declaration, never by a path literal; a layer that
 *   declares none is refused with what to declare. Why a wrapper rather than a
 *   copy of `<name>.json` is on the schema.
 *
 * Moving the pin of a subscription that has CHOSEN parts is refused: that is
 * `refresh-materialized`, because the chosen parts' materialisation records
 * are pinned to the old commit.
 *
 * ## `--check` — the gate over what was written
 *
 * Offline, over every layer in the checkout: each subscription has its
 * snapshot at its pin, each snapshot's digest is over its bytes and its
 * summary is what re-judging those bytes gives, every chosen part is one the
 * substrate offers, and no snapshot is orphaned ({@link checkSubscriptions}).
 * It is what JUDGES the `substrate-snapshot` kind rather than merely typing it,
 * and the `subscribed-harnesses` kind too: every home there belongs to a
 * subscription that chose that harness, and none is left in the snapshot
 * directory's old `harnesses/` layout ({@link checkHarnessHomes}).
 *
 * Usage:
 *   bun run cat kg:subscribe <owner/repo>@<40-char-sha> [--upstream-path <dir>] [--name <instance>]
 *                        [--instance <dir>] [--id <id>] [--dry-run]
 *   bun run cat kg:subscribe:check
 */
import { createHash } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve } from "node:path";

import { declarationFileIn } from "@litlfred/bootstrap-tools/schemas/declaration.ts";
import { KnowledgeGraphDeclarationSchema } from "@litlfred/bootstrap-tools/schemas/graph.ts";
import {
  CatHarnessDeclarationSchema,
  KG_CONTENT_GRAPH_TYPOLOGIES,
  KG_GRAPH_TYPOLOGY,
  type Subscription,
  findDeclarationFile,
  layerRootsIn,
  repoRootFor,
  siblingScopeFor,
  rootForScope,
} from "../schemas/kg/cat-harness.js";
import { RepoFullNameSchema } from "../schemas/kg/repo-full-name.js";
import {
  HARNESS_STATE_GRAPH_TYPOLOGY,
  SNAPSHOT_GRAPH_TYPOLOGY,
  SNAPSHOT_SUFFIX,
  SUBSTRATE_SNAPSHOT_SCHEMA,
  SubstrateSnapshotSchema,
  type SubscriptionKind,
  type SubstrateSnapshot,
  subscriptionKindOf,
} from "../schemas/kg/substrate-snapshot.js";
import { NESTED_DIR, NODES_DIR, NODES_RECORD_FILE, PART_RECORD_FILE, type PartView, safeRelPath, viewOf } from "./kg-parts.js";
import { git, pinnedRef, shallowFetch } from "./sync-remote-skills.js";
import { HARNESS_ROOT } from "./lib/roots.ts";
import { inputSiteReached } from "../schemas/sdlc/input-trace.ts";

const INSTANCE = join(HARNESS_ROOT);

/** The graph typology of the directory a snapshot is written to, and a snapshot's filename suffix: defined beside the schema. */
export { SNAPSHOT_GRAPH_TYPOLOGY, SNAPSHOT_SUFFIX };

/**
 * Bootstrap's Graph Typologies whose Subgraphs hold what makes a Knowledge Graph a
 * Harness: Skills, Roles (`scenarios`) and Processes. Read against
 * `BOOTSTRAP_GRAPH_TYPOLOGIES`' own sentences; a test holds the two together.
 */
// The kinds split out of the `cat-harness` umbrella: knowledge-graph content
// (`kgContent`, sod4 #5) other than the umbrella itself.
export const HARNESS_GRAPH_TYPOLOGIES: readonly string[] = KG_CONTENT_GRAPH_TYPOLOGIES.filter((k) => k !== KG_GRAPH_TYPOLOGY);

/**
 * A judgement that ACCEPTS: a harness substrate, or — a distinct kind, never
 * folded into it — a content Knowledge Graph (owner, 2026-10-06). The `state`
 * IS the subscription kind, so every reader must say which it handles.
 */
export type AcceptedVerdict = { [K in SubscriptionKind]: AcceptedAs<K> }[SubscriptionKind];
type AcceptedAs<K extends SubscriptionKind> = {
  state: K;
  /** Repository-relative: `<name>.json`, or `<upstreamPath>/<name>.json`. */
  file: string;
  /** The directory the declaration was found in; absent at the root. */
  upstreamPath?: string;
  raw: string;
  /** `harnesses` is non-empty for `substrate` and empty for `content`. */
  summary: SubstrateSnapshot["summary"];
};

export type SubstrateVerdict =
  | AcceptedVerdict
  | { state: "not-a-substrate"; reason: string }
  | { state: "ambiguous"; reason: string; candidates: string[] }
  | { state: "could-not-determine"; reason: string };

/** Where {@link judgeTree} looks, and which layer it accepts. */
export interface LocateOptions {
  /** Read only this repository-relative directory. `"."` or `""` names the root. */
  upstreamPath?: string;
  /** The layer name the declaration must carry (`--name`, or the one a recorded snapshot names). */
  name?: string;
}

/**
 * Put the substrate's `.json` files at `ref` into a directory, at their
 * repository-relative paths, and return it: the root's and those directly in
 * each top-level directory — or, given `upstreamPath`, only those directly in
 * it. Throwing means the bytes were not read: could-not-determine. Injectable,
 * so the judgement is tested against fixtures with no network; a fixture may
 * serve more than asked, because {@link judgeTree} reads only where it looks.
 */
export type RootFetcher = (repository: string, ref: string, opts?: { upstreamPath?: string }) => string | Promise<string>;

/** `owner/repo@sha`, or why not. The pin is checked with `pinnedRef`. */
export function parseTarget(arg: string): { ok: true; repository: string; ref: string } | { ok: false; why: string } {
  const at = arg.lastIndexOf("@");
  if (at <= 0) return { ok: false, why: `\`${arg}\` is not \`<owner/repo>@<40-char-sha>\`` };
  const repository = arg.slice(0, at);
  const ref = arg.slice(at + 1);
  const repo = RepoFullNameSchema.safeParse(repository);
  if (!repo.success) return { ok: false, why: `\`${repository}\`: ${repo.error.issues[0]?.message ?? "not owner/repo"}` };
  const pin = pinnedRef(ref);
  if (!pin.ok) return { ok: false, why: pin.why };
  return { ok: true, repository, ref };
}

/** The harnesses a bootstrap declaration declares, by the rule in the module docblock. */
export function harnessesOf(decl: { name: string; directories?: { graphTypologies: readonly string[] }[] }): string[] {
  const isHarness = (decl.directories ?? []).some((d) => d.graphTypologies.some((k) => HARNESS_GRAPH_TYPOLOGIES.includes(k)));
  return isHarness ? [decl.name] : [];
}

/**
 * A repository-relative directory, normalised: no trailing slash, and `""` or
 * `"."` for the root (returned with no `path`). Refused with
 * {@link safeRelPath}'s reason otherwise — no `..`, no dot-prefixed segment.
 */
export function normalizeUpstreamPath(p: string | undefined): { ok: true; path?: string } | { ok: false; why: string } {
  if (p === undefined) return { ok: true };
  const trimmed = p.replace(/\/+$/, "");
  if (trimmed === "" || trimmed === ".") return { ok: true };
  const safe = safeRelPath(trimmed);
  return safe.ok ? { ok: true, path: safe.path } : { ok: false, why: `upstreamPath ${safe.why}` };
}

/**
 * Every `<stem>.json` directly in `dir` whose `name` is `<stem>` — bootstrap's
 * `declarationFileIn` rule without its throw on two, so a caller can name every
 * candidate rather than the first. Sorted; `[]` for a missing directory.
 */
function declarationsIn(dir: string): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }
  return entries
    .filter((entry) => {
      if (!entry.endsWith(".json") || entry === ".json") return false;
      try {
        return (JSON.parse(readFileSync(join(dir, entry), "utf8")) as { name?: unknown }).name === entry.slice(0, -5);
      } catch {
        return false;
      }
    })
    .sort();
}

/** The top-level directories of a fetched tree that may hold a layer: not dot-prefixed, sorted. */
function topLevelDirs(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith("."))
    .map((e) => e.name)
    .sort();
}

const quoted = (xs: readonly string[]): string => xs.map((x) => `\`${x}\``).join(", ");

/**
 * Find and judge the declaration among the `.json` files a fetcher left in
 * `dir`, by the search in the module docblock: the named `upstreamPath`
 * alone; else the root; else exactly one directory one level down. Pure over
 * the directory.
 */
export function judgeTree(dir: string, opts: LocateOptions = {}): SubstrateVerdict {
  const up = normalizeUpstreamPath(opts.upstreamPath);
  if (!up.ok) return { state: "not-a-substrate", reason: up.why };
  const want = opts.name;
  const wanted = want ? ` named \`${want}\`` : "";
  const named = (f: string): boolean => !want || basename(f) === `${want}.json`;
  const read = (rel: string): SubstrateVerdict => judgeDeclaration(rel, readFileSync(join(dir, rel), "utf8"));

  if (up.path !== undefined) {
    const found = declarationsIn(join(dir, up.path));
    const matching = found.filter(named);
    if (matching.length === 1) return read(`${up.path}/${matching[0]}`);
    if (matching.length > 1) {
      return {
        state: "not-a-substrate",
        reason: `\`${up.path}/\` carries ${matching.length} declarations (${quoted(matching)}); a directory is one Knowledge Graph`,
      };
    }
    return {
      state: "not-a-substrate",
      reason:
        `\`${up.path}/\` carries no Knowledge Graph declaration${wanted} — no \`<name>.json\` whose \`name\` is \`<name>\`` +
        (found.length ? ` (it carries ${quoted(found)})` : ""),
    };
  }

  let rootFile: string | undefined;
  try {
    rootFile = declarationFileIn(dir);
  } catch (e) {
    return { state: "not-a-substrate", reason: e instanceof Error ? e.message.replace(dir, "the root") : String(e) };
  }
  if (rootFile && named(rootFile)) return read(relative(dir, rootFile));

  // One level down: every top-level directory's declarations, so an
  // ambiguity is reported whole rather than settled by readdir order.
  const nested = topLevelDirs(dir).flatMap((d) => declarationsIn(join(dir, d)).map((f) => `${d}/${f}`));
  const matching = nested.filter(named);
  if (matching.length === 1) return read(matching[0]!);
  if (matching.length > 1) {
    return {
      state: "ambiguous",
      candidates: matching,
      reason:
        `the root carries no Knowledge Graph declaration${wanted}, and ${matching.length} directories one level down do ` +
        `(${quoted(matching)}). Not guessing: name one with \`--upstream-path <dir>\`${want ? "" : " or `--name <instance>`"}`,
    };
  }
  const seen = [...(rootFile ? [relative(dir, rootFile)] : []), ...nested];
  return {
    state: "not-a-substrate",
    reason:
      `the root carries no Knowledge Graph declaration${wanted} — no \`<name>.json\` whose \`name\` is \`<name>\` — ` +
      `and neither does any directory one level down` +
      (seen.length ? ` (found ${quoted(seen)})` : "") +
      `. A declaration deeper than that is reached with \`--upstream-path <dir>\``,
  };
}

/** {@link judgeTree} with nothing named: the search a first subscribe makes. Kept for its callers. */
export function judgeRoot(dir: string): SubstrateVerdict {
  return judgeTree(dir);
}

/**
 * Judge one root declaration's bytes — the half of {@link judgeRoot} after
 * the file is found. `--check` re-runs it over a snapshot's `raw`, so the
 * committed summary is held to the same code that wrote it.
 */
export function judgeDeclaration(name: string, raw: string): SubstrateVerdict {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (e) {
    return { state: "not-a-substrate", reason: `\`${name}\` is not JSON: ${e instanceof Error ? e.message : String(e)}` };
  }
  const parsed = KnowledgeGraphDeclarationSchema.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      state: "not-a-substrate",
      reason: `\`${name}\` does not meet bootstrap's declaration schema: ${issue?.path.join(".") || "(root)"}: ${issue?.message ?? parsed.error.message}`,
    };
  }
  const decl = parsed.data;
  const harnesses = harnessesOf(decl);
  const subgraphCount = (decl.directories ?? []).length;
  // No harness AND no Subgraph: nothing to subscribe to of either kind. No
  // harness but at least one Subgraph: a CONTENT Knowledge Graph (owner,
  // 2026-10-06) — accepted as its own kind, never as a substrate.
  if (harnesses.length === 0 && subgraphCount === 0) {
    return {
      state: "not-a-substrate",
      reason:
        `\`${name}\` declares no harness: none of its ${subgraphCount} Subgraph(s) holds ` +
        `${HARNESS_GRAPH_TYPOLOGIES.map((k) => `\`${k}\``).join(", ")} — bootstrap's kinds for Skills, Roles and Processes — ` +
        `and no Subgraph at all, so it is not a content Knowledge Graph either. ` +
        `Only this one declaration is read; harnesses declared by other nested instances are not seen`,
    };
  }
  const at = dirname(name);
  return {
    state: harnesses.length > 0 ? "substrate" : "content",
    file: name,
    ...(at !== "." ? { upstreamPath: at } : {}),
    raw,
    summary: {
      name: decl.name,
      ...(decl.title !== undefined ? { title: decl.title } : {}),
      ...(decl.version !== undefined ? { version: decl.version } : {}),
      subgraphs: (decl.directories ?? []).map((d) => ({ id: d.id, graphTypologies: d.graphTypologies.map(String) })),
      harnesses,
    },
  };
}

/** Fetch, then judge. A fetch that throws is could-not-determine, never any verdict. */
export async function judgeSubstrate(repository: string, ref: string, fetch: RootFetcher, opts: LocateOptions = {}): Promise<SubstrateVerdict> {
  const up = normalizeUpstreamPath(opts.upstreamPath);
  if (!up.ok) return { state: "not-a-substrate", reason: up.why };
  let dir: string;
  try {
    // input-site: traced #56af338f — fetches the subscribed repository over the network: a run that reaches it records no hash
    inputSiteReached("kg-subscribe: fetch");
    dir = await fetch(repository, ref, up.path !== undefined ? { upstreamPath: up.path } : {});
  } catch (e) {
    return {
      state: "could-not-determine",
      reason: `the declaration of ${repository} at ${ref.slice(0, 12)}${up.path ? ` under \`${up.path}/\`` : ""} was not read: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
  try {
    return judgeTree(dir, opts);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * The real fetcher, from any URL: a shallow, BLOBLESS fetch of the one commit,
 * then only the `.json` blobs {@link judgeTree} can read — the root's and each
 * top-level directory's, or, given `upstreamPath`, that directory's alone. The
 * trees arrive with the fetch, so listing them is local; a blob is fetched
 * when it is read. No checkout, so a large substrate costs its trees and a
 * few small files. `urlFor` is injectable so a test serves a bare repository
 * from disk through the same git path.
 */
export function gitDeclarationFetcher(urlFor: (repository: string) => string = (r) => `https://github.com/${r}.git`): RootFetcher {
  return (repository, ref, opts = {}) => {
    const repo = shallowFetch(urlFor(repository), ref, { blobless: true, prefix: "kg-subscribe-" });
    try {
      const head = git(["rev-parse", "FETCH_HEAD"], repo).trim();
      if (head !== ref) throw new Error(`the remote served ${head} for ${ref}`);
      // `<mode> <type> <oid>\t<path>`, NUL-separated. A submodule is a
      // `commit` entry and holds nothing to read.
      const entries = (args: string[]): { type: string; path: string }[] =>
        git(["ls-tree", "-z", "FETCH_HEAD", ...args], repo)
          .split("\0")
          .filter(Boolean)
          .map((l) => {
            const tab = l.indexOf("\t");
            return { type: l.slice(0, tab).split(" ")[1] ?? "", path: l.slice(tab + 1) };
          });
      const blobs = (es: { type: string; path: string }[]): string[] => es.filter((e) => e.type === "blob").map((e) => e.path);
      const up = opts.upstreamPath?.replace(/\/+$/, "");
      let names: string[];
      if (up) names = blobs(entries(["--", `${up}/`]));
      else {
        const root = entries([]);
        const dirs = root.filter((e) => e.type === "tree" && !e.path.startsWith(".")).map((e) => `${e.path}/`);
        names = [...blobs(root), ...(dirs.length ? blobs(entries(["--", ...dirs])) : [])];
      }
      // input-site: inert #09ad4eda — the scratch root a subscribed graph is staged in
      const out = mkdtempSync(join(tmpdir(), "kg-subscribe-root-"));
      for (const n of names.filter((x) => x.endsWith(".json"))) {
        mkdirSync(dirname(join(out, n)), { recursive: true });
        writeFileSync(join(out, n), git(["show", `FETCH_HEAD:${n}`], repo));
      }
      return out;
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  };
}

/** {@link gitDeclarationFetcher} against github.com. */
export const gitRootFetcher: RootFetcher = gitDeclarationFetcher();

// ── Writing the subscriber's declaration without reformatting it ─────────────

/**
 * The span of each TOP-LEVEL key's value in a JSON object's text. A splice
 * rather than a re-serialisation, because declarations here carry hand-chosen
 * one-line objects (`livesAt`) that `JSON.stringify` would expand, and a
 * subscribe must not rewrite lines it did not mean to touch.
 */
function topLevelValueSpans(text: string): Map<string, { start: number; end: number }> {
  const spans = new Map<string, { start: number; end: number }>();
  const ws = (ch: string | undefined): boolean => ch !== undefined && /\s/.test(ch);
  let depth = 0;
  let key: string | undefined;
  let start = -1;
  // A value ends at the comma after it at depth 1, or at the object's own closer.
  const close = (at: number): void => {
    let end = at;
    while (ws(text[end - 1])) end--;
    if (key !== undefined) spans.set(key, { start, end });
    key = undefined;
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      let j = i + 1;
      while (text[j] !== '"') j += text[j] === "\\" ? 2 : 1;
      if (depth === 1 && key === undefined) {
        let k = j + 1;
        while (ws(text[k])) k++;
        if (text[k] === ":") {
          key = JSON.parse(text.slice(i, j + 1)) as string;
          let v = k + 1;
          while (ws(text[v])) v++;
          start = v;
          i = v - 1;
          continue;
        }
      }
      i = j;
    } else if (c === "{" || c === "[") depth++;
    else if (c === "}" || c === "]") {
      depth--;
      if (depth === 0) close(i);
    } else if (c === "," && depth === 1) close(i);
  }
  return spans;
}

/** Set a top-level key's value in a JSON object's text, 2-space indented; append the key if absent. */
export function setTopLevelKey(text: string, key: string, value: unknown): string {
  const rendered = JSON.stringify(value, null, 2).replace(/\n/g, "\n  ");
  const span = topLevelValueSpans(text).get(key);
  if (span) return text.slice(0, span.start) + rendered + text.slice(span.end);
  const close = text.lastIndexOf("}");
  let before = close;
  while (/\s/.test(text[before - 1] ?? "")) before--;
  return `${text.slice(0, before)},\n  ${JSON.stringify(key)}: ${rendered}\n${text.slice(close)}`;
}

// ── Subscribe ────────────────────────────────────────────────────────────────

export type SubscribeResult =
  | { ok: true; verdict: AcceptedVerdict; entry: Subscription; changed: string[]; declarationFile: string; snapshotFile: string }
  | { ok: false; state: "refused" | "not-a-substrate" | "could-not-determine"; reason: string };

export interface SubscribeOptions {
  target: string;
  instance?: string;
  id?: string;
  /** The directory holding the declaration (`--upstream-path`); `"."` names the root. Absent: the recorded one, else the search. */
  upstreamPath?: string;
  /** The layer name the declaration must carry (`--name`). Absent: the name the recorded snapshot carries, if any. */
  name?: string;
  dryRun?: boolean;
  fetch?: RootFetcher;
}

/** The layer name a subscription's committed snapshot records, when it has a readable one. */
function recordedName(snapshotDir: string, id: string): string | undefined {
  try {
    const snap = SubstrateSnapshotSchema.safeParse(JSON.parse(readFileSync(join(snapshotDir, `${id}${SNAPSHOT_SUFFIX}`), "utf8")));
    return snap.success ? snap.data.summary.name : undefined;
  } catch {
    return undefined;
  }
}

/** The layer's declared `substrate-snapshot` directory, resolved; `undefined` when it declares none. */
export function snapshotDirOf(instanceRoot: string, raw: Record<string, unknown>): string | undefined {
  return declaredDirOf(instanceRoot, raw, SNAPSHOT_GRAPH_TYPOLOGY);
}

function declaredDirOf(instanceRoot: string, raw: Record<string, unknown>, typology: string): string | undefined {
  const dirs = (raw["directories"] ?? []) as { path: string; graphTypologies?: string[]; scope?: "repository" }[];
  const d = dirs.find((x) => (x.graphTypologies ?? []).includes(typology));
  return d ? resolve(rootForScope(instanceRoot, d.scope), d.path) : undefined;
}

export async function subscribe(opts: SubscribeOptions): Promise<SubscribeResult> {
  const t = parseTarget(opts.target);
  if (!t.ok) return { ok: false, state: "refused", reason: t.why };

  const instanceRoot = resolve(opts.instance ?? INSTANCE);
  const declName = findDeclarationFile(instanceRoot);
  if (!declName) return { ok: false, state: "refused", reason: `${instanceRoot} carries no instance declaration to subscribe` };
  const declarationFile = join(instanceRoot, declName);
  const text = readFileSync(declarationFile, "utf8");
  const raw = JSON.parse(text) as Record<string, unknown>;

  const snapshotDir = snapshotDirOf(instanceRoot, raw);
  if (!snapshotDir) {
    return {
      ok: false,
      state: "refused",
      reason:
        `${declName} declares no directory of graph typology \`${SNAPSHOT_GRAPH_TYPOLOGY}\` to cache the substrate's declaration in. ` +
        `Declare one (cat-harness's \`subscriptions\` entry is the pattern) and re-run`,
    };
  }

  const requested = normalizeUpstreamPath(opts.upstreamPath);
  if (!requested.ok) return { ok: false, state: "refused", reason: requested.why };

  const existing = ((raw["subscriptions"] ?? []) as Subscription[]).slice();
  // What was recorded the last time this repository was subscribed: the
  // directory, and the layer its snapshot names. A re-subscribe judges the
  // SAME subtree for the SAME layer unless it is told otherwise.
  const sameRepo = existing.filter((s) => s.repository === t.repository);
  const recorded = opts.id ? sameRepo.find((s) => s.id === opts.id) : sameRepo.length === 1 ? sameRepo[0] : undefined;
  const locate: LocateOptions = {};
  const upstreamPath = opts.upstreamPath !== undefined ? (requested.path ?? ".") : recorded?.upstreamPath;
  if (upstreamPath !== undefined) locate.upstreamPath = upstreamPath;
  const name = opts.name ?? (recorded ? recordedName(snapshotDir, recorded.id) : undefined);
  if (name !== undefined) locate.name = name;

  const verdict = await judgeSubstrate(t.repository, t.ref, opts.fetch ?? gitRootFetcher, locate);
  if (verdict.state === "ambiguous") return { ok: false, state: "refused", reason: verdict.reason };
  if (verdict.state !== "substrate" && verdict.state !== "content") return { ok: false, state: verdict.state, reason: verdict.reason };

  const id = opts.id ?? verdict.summary.name;
  const at = existing.findIndex((s) => s.id === id);
  const prior = at >= 0 ? existing[at] : undefined;
  if (prior && prior.repository !== t.repository) {
    return {
      ok: false,
      state: "refused",
      reason: `subscription \`${id}\` already names ${prior.repository}; pass \`--id\` to subscribe ${t.repository} under another name`,
    };
  }
  const chosen = Boolean(prior && (prior.subgraphs?.length || prior.harnesses?.length || (prior.assets && prior.assets.policy !== "none")));
  if (prior && chosen && prior.ref !== t.ref) {
    return {
      ok: false,
      state: "refused",
      reason:
        `subscription \`${id}\` is pinned at ${prior.ref.slice(0, 12)} and has chosen parts, whose materialisation records are pinned there too. ` +
        `Moving the pin is \`refresh-materialized\`, not a re-subscribe`,
    };
  }
  const priorPath = prior ? normalizeUpstreamPath(prior.upstreamPath) : undefined;
  if (prior && chosen && priorPath?.ok && priorPath.path !== verdict.upstreamPath) {
    return {
      ok: false,
      state: "refused",
      reason:
        `subscription \`${id}\` was judged from ${priorPath.path ? `\`${priorPath.path}/\`` : "the root"} and has chosen parts; ` +
        `this declaration is ${verdict.upstreamPath ? `under \`${verdict.upstreamPath}/\`` : "at the root"}. ` +
        `A different declaration is a different subscription — pass \`--id\``,
    };
  }
  // Nothing chosen on a first subscribe; a re-subscribe keeps every choice.
  // `upstreamPath` is what was judged THIS time, so the record names exactly that.
  // So is `kind`: written only for `content`, absent for a substrate.
  const { upstreamPath: _judgedBefore, kind: _kindBefore, ...kept } = prior ?? { id, repository: t.repository, ref: t.ref };
  void _judgedBefore;
  void _kindBefore;
  const entry: Subscription = {
    ...kept,
    ref: t.ref,
    ...(verdict.upstreamPath !== undefined ? { upstreamPath: verdict.upstreamPath } : {}),
    ...(verdict.state === "content" ? { kind: "content" as const } : {}),
  };
  if (at >= 0) existing[at] = entry;
  else existing.push(entry);

  const nextRaw = { ...raw, subscriptions: existing };
  const check = CatHarnessDeclarationSchema.safeParse(
    Object.fromEntries(Object.entries(nextRaw).filter(([k]) => !k.startsWith("@"))),
  );
  if (!check.success) {
    const issue = check.error.issues[0];
    return { ok: false, state: "refused", reason: `the declaration would not parse: ${issue?.path.join(".")}: ${issue?.message}` };
  }

  const snapshot: SubstrateSnapshot = SubstrateSnapshotSchema.parse({
    $schema: SUBSTRATE_SNAPSHOT_SCHEMA,
    subscription: id,
    ...(verdict.state === "content" ? { kind: "content" } : {}),
    repository: t.repository,
    ref: t.ref,
    file: verdict.file,
    raw: verdict.raw,
    fixity: { algorithm: "sha256", digest: createHash("sha256").update(verdict.raw).digest("hex") },
    summary: verdict.summary,
    note: "Somebody else's bytes, pinned. Do not edit: re-run `bun run cat kg:subscribe` at the pin, or refresh.",
  });
  const snapshotFile = join(snapshotDir, `${id}.substrate.json`);
  const snapshotText = `${JSON.stringify(snapshot, null, 2)}\n`;
  const nextText = prior && JSON.stringify(prior) === JSON.stringify(entry) ? text : setTopLevelKey(text, "subscriptions", existing);

  const changed: string[] = [];
  if (nextText !== text) changed.push(declarationFile);
  if (!existsSync(snapshotFile) || readFileSync(snapshotFile, "utf8") !== snapshotText) changed.push(snapshotFile);
  if (!opts.dryRun) {
    if (nextText !== text) writeFileSync(declarationFile, nextText);
    if (changed.includes(snapshotFile)) {
      mkdirSync(snapshotDir, { recursive: true });
      writeFileSync(snapshotFile, snapshotText);
    }
  }
  return { ok: true, verdict, entry, changed, declarationFile, snapshotFile };
}

// ── --check: offline, every subscription has a snapshot that still holds ────


/**
 * Offline judgement of one layer's subscriptions and snapshots. Findings,
 * each a sentence; `[]` is clean. What it holds:
 *
 * - every `subscriptions` entry has its snapshot, at the entry's repository
 *   and pin, and the layer declares somewhere to keep it;
 * - each snapshot parses, its digest is over its `raw`, and re-judging `raw`
 *   gives the committed `summary` — so a hand edit to either is caught;
 * - every CHOSEN subgraph and harness is one the substrate offers;
 * - no snapshot is orphaned: each belongs to a subscription.
 */
export function checkSubscriptions(instanceRoot: string): string[] {
  const declName = findDeclarationFile(instanceRoot);
  if (!declName) return [];
  const raw = JSON.parse(readFileSync(join(instanceRoot, declName), "utf8")) as Record<string, unknown>;
  const subs = (raw["subscriptions"] ?? []) as Subscription[];
  const dir = snapshotDirOf(instanceRoot, raw);
  const out: string[] = [];
  if (!dir) {
    if (subs.length) out.push(`${declName}: ${subs.length} subscription(s) and no \`${SNAPSHOT_GRAPH_TYPOLOGY}\` directory to hold their snapshots`);
    return out;
  }
  const seen = new Set<string>();
  for (const s of subs) {
    const file = join(dir, `${s.id}${SNAPSHOT_SUFFIX}`);
    seen.add(`${s.id}${SNAPSHOT_SUFFIX}`);
    if (!existsSync(file)) {
      const flags = `${s.upstreamPath ? ` --upstream-path ${s.upstreamPath}` : ""}${s.id !== s.repository.split("/")[1] ? ` --id ${s.id}` : ""}`;
      out.push(`${s.id}: no snapshot at ${relative(instanceRoot, file)} — run \`bun run cat kg:subscribe ${s.repository}@${s.ref}${flags}\``);
      continue;
    }
    const parsed = SubstrateSnapshotSchema.safeParse(JSON.parse(readFileSync(file, "utf8")));
    if (!parsed.success) {
      out.push(`${s.id}: the snapshot does not parse: ${parsed.error.issues[0]?.path.join(".")}: ${parsed.error.issues[0]?.message}`);
      continue;
    }
    const snap = parsed.data;
    if (snap.subscription !== s.id) out.push(`${s.id}: the snapshot says it belongs to \`${snap.subscription}\``);
    if (snap.repository !== s.repository || snap.ref !== s.ref) {
      out.push(`${s.id}: the snapshot is of ${snap.repository}@${snap.ref.slice(0, 12)}, the subscription pins ${s.repository}@${s.ref.slice(0, 12)} — re-subscribe`);
    }
    // The subtree: the snapshot's file must sit in the directory the
    // subscription records, so a re-subscribe and this check are about the
    // declaration that was judged the first time.
    const recordedAt = normalizeUpstreamPath(s.upstreamPath);
    const readAt = dirname(snap.file) === "." ? undefined : dirname(snap.file);
    if (!recordedAt.ok) out.push(`${s.id}: ${recordedAt.why}`);
    else if (recordedAt.path !== readAt) {
      out.push(
        `${s.id}: the snapshot was read from ${readAt ? `\`${readAt}/\`` : "the root"}, the subscription records ` +
          `${recordedAt.path ? `\`upstreamPath\` \`${recordedAt.path}\`` : "the root"} — re-subscribe`,
      );
    }
    if (createHash("sha256").update(snap.raw).digest("hex") !== snap.fixity.digest) {
      out.push(`${s.id}: the snapshot's bytes do not match their digest — somebody else's bytes were edited in place`);
    }
    // The kind: the entry, the snapshot and a re-judgement of the bytes
    // must all say the same — a content subscription is never read as a
    // substrate, nor a substrate as content.
    const kind = subscriptionKindOf(snap);
    if (subscriptionKindOf(s) !== kind) {
      out.push(`${s.id}: the subscription is \`${subscriptionKindOf(s)}\`, its snapshot is \`${kind}\` — re-subscribe`);
    }
    const again = judgeDeclaration(snap.file, snap.raw);
    if (again.state !== "substrate" && again.state !== "content") {
      out.push(`${s.id}: the cached declaration no longer judges as a substrate or content: ${again.reason}`);
    } else if (again.state !== kind) out.push(`${s.id}: the snapshot says \`${kind}\`, its bytes judge as \`${again.state}\``);
    else if (JSON.stringify(again.summary) !== JSON.stringify(snap.summary)) out.push(`${s.id}: the snapshot's summary is not what its bytes say`);
    const offered = new Set(snap.summary.subgraphs.map((g) => g.id));
    for (const g of s.subgraphs ?? []) if (!offered.has(g)) out.push(`${s.id}: chose subgraph \`${g}\`, which the substrate does not declare`);
    for (const h of s.harnesses ?? []) if (!snap.summary.harnesses.includes(h)) out.push(`${s.id}: chose harness \`${h}\`, which the substrate does not declare`);
  }
  if (existsSync(dir)) {
    for (const f of readdirSync(dir).filter((n) => n.endsWith(SNAPSHOT_SUFFIX)).sort()) {
      if (!seen.has(f)) out.push(`${relative(instanceRoot, join(dir, f))}: a snapshot no subscription names — orphaned`);
    }
  }
  out.push(...checkHarnessHomes(instanceRoot, raw, subs, dir));
  return out;
}

/**
 * The `subscribed-harnesses` directory, judged (owner, 2026-10-30, bean `w1gy`
 * finding 1, option C). Findings, each a sentence:
 *
 * - a home left in the snapshot directory's old layout
 *   (`<snapshot dir>/<subscription>/harnesses/`), which made a read-only
 *   directory hold the subscriber's working state;
 * - a home `<subscription>/<harness>/` whose subscription is gone or did not
 *   choose that harness — orphaned state nobody's config reads;
 * - a file where only homes belong (anything but the generated `README.md`).
 */
export function checkHarnessHomes(instanceRoot: string, raw: Record<string, unknown>, subs: readonly Subscription[], snapshotDir: string): string[] {
  const out: string[] = [];
  const rel = (p: string): string => relative(instanceRoot, p).split("\\").join("/");
  for (const s of subs) {
    const old = join(snapshotDir, s.id, "harnesses");
    if (existsSync(old)) {
      out.push(`${rel(old)}/: instantiated-harness state in the read-only snapshot directory — move it to the \`${HARNESS_STATE_GRAPH_TYPOLOGY}\` directory (\`git mv\` to \`<state dir>/${s.id}/<harness>/\`)`);
    }
  }
  const stateDir = declaredDirOf(instanceRoot, raw, HARNESS_STATE_GRAPH_TYPOLOGY);
  if (!stateDir || !existsSync(stateDir)) return out;
  const chosen = new Map(subs.map((s) => [s.id, new Set(s.harnesses ?? [])]));
  for (const e of readdirSync(stateDir, { withFileTypes: true })) {
    if (e.name.startsWith(".") || (e.isFile() && e.name === "README.md")) continue;
    const p = join(stateDir, e.name);
    if (!e.isDirectory() || lstatSync(p).isSymbolicLink()) {
      out.push(`${rel(p)}: not a subscription's directory — only \`<subscription>/<harness>/\` homes belong here`);
      continue;
    }
    const harnesses = chosen.get(e.name);
    if (!harnesses) {
      out.push(`${rel(p)}/: state for subscription \`${e.name}\`, which this instance does not declare — orphaned`);
      continue;
    }
    for (const h of readdirSync(p, { withFileTypes: true })) {
      if (h.name.startsWith(".")) continue;
      const hp = join(p, h.name);
      if (!h.isDirectory() || lstatSync(hp).isSymbolicLink()) out.push(`${rel(hp)}: not a harness home — only \`<harness>/\` directories belong here`);
      else if (!harnesses.has(h.name)) out.push(`${rel(hp)}/: state for harness \`${h.name}\`, which subscription \`${e.name}\` did not choose — orphaned`);
    }
  }
  return out;
}

// ── Materialised parts: the layout, in `kg-parts.ts` ─────────────────────────
//
// Moved to a HARNESS module (bean `g8jp`) so the site build's reader of held
// subscribed trees (`subscribed-trees.ts`, harness) can share it: this module
// is classified core, and the harness may not import core. Re-exported here
// so every existing importer keeps its path.
export { PART_RECORD_FILE, PART_TREE, NESTED_DIR, NODES_RECORD_FILE, NODES_DIR, harnessHomeOf, nodesDirOf, partDirOf, safeRelPath, treeEntries, sha256File, treeDigest, viewOf } from "./kg-parts.js";
export type { KgPart, PartView } from "./kg-parts.js";

/**
 * Every part record under one subscription's directory, and every STRAY: a
 * file, or a part directory with no record — bytes nobody accounts for.
 * `strays` are relative to the snapshot directory. An instantiated harness's
 * state is not here (it is in the `subscribed-harnesses` directory, bean
 * `w1gy` finding 1), so a `harnesses/` left by the old layout is a stray.
 */
export function partRecordsIn(
  snapshotDir: string,
  subscription: string,
): { parts: PartView[]; strays: string[]; nodes: string[] } {
  const base = join(snapshotDir, subscription);
  const parts: PartView[] = [];
  const strays: string[] = [];
  const nodes: string[] = [];
  if (!existsSync(base)) return { parts, strays, nodes };
  const rel = (p: string): string => relative(snapshotDir, p).split("\\").join("/");
  for (const e of readdirSync(base, { withFileTypes: true })) {
    const p = join(base, e.name);
    if (e.name === "subgraphs" && e.isDirectory()) {
      for (const g of readdirSync(p, { withFileTypes: true })) {
        const gd = join(p, g.name);
        if (g.isDirectory() && existsSync(join(gd, PART_RECORD_FILE))) parts.push(viewOf(gd, { kind: "subgraph", id: g.name }));
        else strays.push(rel(gd));
      }
    } else if ((e.name === "assets" || e.name === NESTED_DIR) && e.isDirectory()) {
      // Both keyed by path: a directory holding a record is one part.
      const walk = (d: string): void => {
        for (const a of readdirSync(d, { withFileTypes: true })) {
          const ad = join(d, a.name);
          if (a.isDirectory() && !lstatSync(ad).isSymbolicLink()) {
            const path = relative(p, ad).split("\\").join("/");
            if (existsSync(join(ad, PART_RECORD_FILE))) parts.push(viewOf(ad, e.name === NESTED_DIR ? { kind: "nested", path } : { kind: "asset", path }));
            else walk(ad);
          } else strays.push(rel(ad));
        }
      };
      walk(p);
    } else if (e.name === NODES_DIR && e.isDirectory()) {
      // Metadata mode: a directory holding `nodes.json` is one fetched
      // subgraph, and it may also hold a child's directory. The only files a
      // record accounts for are itself and the hydrated file beside it.
      const walk = (d: string): void => {
        const recorded = existsSync(join(d, NODES_RECORD_FILE));
        if (recorded) nodes.push(d);
        for (const a of readdirSync(d, { withFileTypes: true })) {
          const ad = join(d, a.name);
          if (a.isDirectory() && !lstatSync(ad).isSymbolicLink()) walk(ad);
          else if (!(recorded && (a.name === NODES_RECORD_FILE || a.name === "index.hydrated.jsonld"))) strays.push(rel(ad));
        }
      };
      walk(p);
    } else strays.push(rel(p));
  }
  return { parts: parts.sort((a, b) => a.dir.localeCompare(b.dir)), strays: strays.sort(), nodes: nodes.sort() };
}

function flag(argv: string[], name: string): string | undefined {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  if (argv.includes("--check")) {
    const roots = [...new Set([resolve(INSTANCE), ...layerRootsIn(siblingScopeFor(INSTANCE)).map((r) => resolve(r))])];
    let subs = 0;
    const problems: string[] = [];
    for (const r of roots) {
      const f = findDeclarationFile(r);
      if (!f) continue;
      subs += ((JSON.parse(readFileSync(join(r, f), "utf8")) as { subscriptions?: unknown[] }).subscriptions ?? []).length;
      problems.push(...checkSubscriptions(r).map((p) => `${relative(repoRootFor(INSTANCE), r) || "."}: ${p}`));
    }
    console.log(`KG subscriptions — ${subs} across ${roots.length} instance(s)`);
    for (const p of problems) console.error(`  ✗ ${p}`);
    if (problems.length) process.exit(1);
    console.log(subs ? "  ✓ every subscription has a snapshot at its pin, and each snapshot holds" : "  ✓ none subscribed — every declaration was read, and no snapshot is orphaned");
    process.exit(0);
  }
  const valued = ["--instance", "--id", "--upstream-path", "--name"];
  const target = argv.find((a, i) => !a.startsWith("--") && !valued.includes(argv[i - 1] ?? ""));
  if (!target) {
    console.error(
      "usage: bun run cat kg:subscribe <owner/repo>@<40-char-sha> [--upstream-path <dir>] [--name <instance>] [--instance <dir>] [--id <id>] [--dry-run]",
    );
    process.exit(2);
  }
  const dryRun = argv.includes("--dry-run");
  const r = await subscribe({
    target,
    instance: flag(argv, "--instance"),
    id: flag(argv, "--id"),
    upstreamPath: flag(argv, "--upstream-path"),
    name: flag(argv, "--name"),
    dryRun,
  });
  if (!r.ok) {
    const mark = r.state === "could-not-determine" ? "?" : "✗";
    console.error(`  ${mark} ${r.state}: ${r.reason}`);
    process.exit(r.state === "could-not-determine" ? 3 : 1);
  }
  const v = r.verdict;
  console.log(
    v.state === "content"
      ? `  ✓ content: ${v.summary.name} at ${v.file} — no harness (contributes no skills, processes or roles), ${v.summary.subgraphs.length} subgraph(s), all referenced`
      : `  ✓ substrate: ${v.summary.name} at ${v.file} — harness(es) ${v.summary.harnesses.join(", ")}, ${v.summary.subgraphs.length} subgraph(s), all referenced`,
  );
  if (r.changed.length === 0) console.log("  ✓ already subscribed at this pin — nothing to write");
  for (const f of r.changed) console.log(`  ${dryRun ? "would write" : "wrote"} ${relative(process.cwd(), f)}`);
}
