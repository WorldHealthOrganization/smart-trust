#!/usr/bin/env bun
/**
 * Give a layer a folio and a landing sticky — the last act of initiation.
 *
 * @module scripts/ensure-landing-sticky
 * @covers folio
 *
 * Creates an empty `folio/` graph directory (if none is declared) and
 * attaches a sticky note to it. This is the `folio` graph DIRECTORY, not the
 * separate content repository `scripts/init-folio.ts` scaffolds.
 *
 * It belongs to cat-harness and runs after bootstrap's hand-off (`A_Install`):
 * bootstrap may not import from the layer composed on top of it, so a bare
 * bootstrap layer gets no folio.
 *
 * ## Idempotent
 *
 * Initiation runs again (a re-initialisation, a sibling session, a resumed
 * container), so every step is safe to repeat:
 *
 * 1. **The sticky's `createdAt`.** An existing sticky's `createdAt` is **read
 *    back and reused**; the clock is consulted only when there is nothing
 *    there, so `--check` can say *nothing changed*.
 * 2. **The declaration.** It is committed **ASCII-escaped**, and
 *    its `description` carries a deliberate NO-BREAK SPACE before
 *    `c@t-harness`; `JSON.stringify` would rewrite both. So
 *    {@link insertDirectoryEntry} is a **surgical text edit** — it splices one
 *    entry into the `directories` array and leaves every other byte alone,
 *    which `ensure-landing-sticky.test.ts` asserts directly.
 *
 * Exit codes: 0 up to date or written · 1 stale/absent under `--check`.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

import {
  checkoutRootFor,
  type ContentDirectory,
  findDeclarationFile,
  findInstanceRoot,
  readDeclaration,
  rootForScope,
  declarationPathIn,
} from "../schemas/kg/cat-harness.js";
import { mountedInstanceRoots } from "../schemas/kg/remote-mount.js";
import {
  LandingStickySchema,
  stickyFromContribution,
  type LandingSticky,
} from "../schemas/content/landing-sticky.js";
import { portableSegment } from "../schemas/kg/portable-path.ts";
import {
  StickyContributionSchema,
  composeContributions,
  readerText,
  type DeclaredContribution,
} from "../schemas/content/sticky-contribution.js";
import { HARNESS_ROOT } from "./lib/roots.ts";

/** The graph typology, and the conventional directory a layer keeps it in. */
export const FOLIO_GRAPH_TYPOLOGY = "folio";
export const FOLIO_DIR_ID = "folio";
// declared-path-literal: the convention for a directory that does not exist yet.
// This script's whole job is to CREATE the folio graph and then declare it, so
// there is no declaration to read at the only moment this value is used — the
// same write-target case `adapters/document/paths.ts` and `src/workflow/gate.ts`
// mark, and for the same reason: `directoriesForGraph` returns undefined for a
// directory that is not there, which would make the first run impossible rather
// than merely empty. Once declared, every later run reads `folioDirPath` off the
// declaration and never reaches this.
export const FOLIO_DIR_PATH = "folio/";

/**
 * A sticky's file within the folio graph.
 *
 * Named from the sticky's own id, so the set of files IS the set of stickies.
 * A hand-kept list beside them would be the shape `BLOCK_KINDS` exists to
 * prevent — an enumeration maintained in two places, one of which is short.
 */
export function stickyFile(id: string): string {
  // `portableSegment`: the id is what NAMES the file, and an id is not
  // constrained to be a legal filename — the `req:agent-workflow` shape that
  // made this repository unclonable on Windows. Every sticky id today is a slug
  // and encodes to itself, so no existing sticky moves. One composer, used by
  // both the writers and the readers below, so the encoding cannot split them.
  return `${portableSegment(id)}.json`;
}

/**
 * The declaration entry a folio graph gets.
 *
 * `path` carries its trailing slash because every sibling entry does —
 * `tools/`, `schemas/`, `beans/`. Matching the neighbours is not cosmetic here:
 * `check:harness-dirs` and `check:declared-paths` both read these, and a lone
 * entry spelled differently is the kind of thing that resolves fine and then
 * fails to match a comparison somewhere.
 */
export const FOLIO_DIRECTORY_ENTRY: ContentDirectory = {
  id: FOLIO_DIR_ID,
  path: FOLIO_DIR_PATH,
  graphTypologies: [FOLIO_GRAPH_TYPOLOGY],
  description:
    "Authored content of this instance itself, rendered to a website. Holds the landing sticky — the instance's own description and its onboarding links, as a page-global note rather than text composited into the backdrop.",
};

/**
 * The kinds one raw directory entry declares — `graphTypologies`, or the pre-2026-09-21
 * `graphs`.
 *
 * **This path parses the declaration itself**, because the edit below is a byte
 * splice rather than a re-serialise, so `ContentDirectorySchema`'s preprocess —
 * which is what accepts the legacy key everywhere else — never runs on it. The
 * alias has to be restated here or a downstream folio spelling the field the old
 * way reads as declaring nothing, and `ensureLandingSticky` would splice a
 * SECOND folio entry into a declaration that already has one.
 *
 * Tolerant of a missing or non-array value on purpose: the input is whatever
 * `JSON.parse` returned, not something a schema has vouched for.
 */
function kindsOf(d: { graphTypologies?: readonly string[]; graphs?: readonly string[] }): readonly string[] {
  const k = d.graphTypologies ?? d.graphs;
  return Array.isArray(k) ? k : [];
}

/** One raw entry as this module reads it — neither spelling assumed present. */
type RawDirectory = Partial<ContentDirectory> & { graphs?: readonly string[] };

/** Does this declaration already know about a folio graph? */
export function declaresFolio(decl: { directories?: readonly RawDirectory[] } | undefined): boolean {
  // Matched on the GRAPH TYPOLOGY rather than on `id` or `path`. A layer may
  // keep its folio anywhere and call the entry what it likes — `harness.json`'s
  // own comment records that overrides match on id, not path, precisely because
  // a relocation must not mint a second graph. What makes an entry "the folio"
  // is the kind it declares.
  return (decl?.directories ?? []).some((d) => kindsOf(d).includes(FOLIO_GRAPH_TYPOLOGY));
}

/** The declared folio directory's path, or the convention when none is declared. */
export function folioDirPath(
  decl: { directories?: readonly RawDirectory[] } | undefined,
): string {
  return (
    (decl?.directories ?? []).find((d) => kindsOf(d).includes(FOLIO_GRAPH_TYPOLOGY))?.path ??
    FOLIO_DIR_PATH
  );
}

/**
 * JSON with every non-ASCII character escaped, matching the committed file.
 *
 * `JSON.stringify` emits literal UTF-8. The declaration is committed escaped, so
 * an em dash written raw would be a real difference in a file the rest of this
 * function is at pains not to touch.
 */
export function toAsciiJson(value: unknown, indent: number): string {
  return JSON.stringify(value, null, indent).replace(/[\u0080-￿]/g, (c) => {
    return `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`;
  });
}

/**
 * Splice one entry into a declaration's `directories` array, byte-preserving.
 *
 * **A text edit, not a re-serialise**, for the reasons in the module docs. The
 * array's bounds are found by bracket matching rather than by a regex, because a
 * regex over nested JSON either stops at the first `]` — there are nested arrays
 * inside these entries, `graphTypologies` among them — or is unreadable.
 *
 * Returns the input unchanged when a folio is already declared, so calling this
 * twice is the same as calling it once.
 */
export function insertDirectoryEntry(raw: string, entry: ContentDirectory): string {
  const decl = JSON.parse(raw) as { directories?: RawDirectory[] };
  if (declaresFolio(decl)) return raw;

  const key = '"directories"';
  const keyAt = raw.indexOf(key);
  if (keyAt < 0) throw new Error("no `directories` key in the declaration");
  const open = raw.indexOf("[", keyAt);
  if (open < 0) throw new Error("`directories` is not an array");

  // Bracket match, honouring strings so a `[` inside a `description` does not
  // shift the count. The `_comment` fields here are long English prose and one
  // of them will eventually contain a bracket.
  let depth = 0;
  let close = -1;
  let inStr = false;
  for (let i = open; i < raw.length; i += 1) {
    const c = raw[i]!;
    if (inStr) {
      if (c === "\\") i += 1;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "[") depth += 1;
    else if (c === "]") {
      depth -= 1;
      if (depth === 0) {
        close = i;
        break;
      }
    }
  }
  if (close < 0) throw new Error("unterminated `directories` array");

  const body = raw.slice(open + 1, close);
  // The indent of an existing entry, so the insertion matches the file rather
  // than a constant that is right until somebody reformats.
  const indentMatch = body.match(/\n(\s+)\{/);
  const itemIndent = indentMatch?.[1] ?? "    ";
  const closeIndent = itemIndent.slice(0, Math.max(0, itemIndent.length - 2));

  const entryText = toAsciiJson(entry, 2)
    .split("\n")
    .map((l, i) => (i === 0 ? l : `${itemIndent}${l}`))
    .join("\n");

  const trimmed = body.replace(/\s*$/, "");
  const sep = trimmed.endsWith("}") ? "," : "";
  return `${raw.slice(0, open + 1)}${trimmed}${sep}\n${itemIndent}${entryText}\n${closeIndent}${raw.slice(close)}`;
}

/** What one sticky's file needed. */
export interface StickyReport {
  id: string;
  path: string;
  state: "already" | "written" | "updated";
  /**
   * The card belongs to a REMOTE-MOUNTED layer: it arrives with the mount
   * (bean `1yd7`), so this run never writes it and `--check` never counts it.
   * The mount is gitignored; a card written into it would be committed nowhere.
   */
  mounted?: true;
}

/** Everything a run did or found, so the caller reports rather than guesses. */
export interface EnsureReport {
  declaredFolio: "already" | "added";
  folioDir: string;
  createdDir: boolean;
  /** One per sticky, in render order. */
  stickies: StickyReport[];
  /**
   * Sticky files no layer declares any more, removed by this run.
   *
   * Reported rather than done silently: this is the one place the tool deletes
   * anything, and a deletion nobody is told about is the shape
   * `deletion-requires-confirmation` exists to stop.
   */
  pruned: string[];
}

/**
 * Sticky files in the folio directory that no layer declares any more.
 *
 * **Narrow on purpose.** A file is a candidate only when it is in the folio
 * directory, parses as a landing sticky (so it carries the
 * `folio-landing-sticky/v1` tag this tool writes), and its id is in no current
 * contribution. Anything else in that directory — a file somebody put there,
 * a file of another kind, one that does not parse — is left alone.
 *
 * That narrowness is why pruning here does not violate the rule that an agent
 * never removes a durable artefact on its own initiative: these are files this
 * tool minted, identified by the tag it wrote, and the alternative is worse.
 * Retiring a card left `landing.json` and `subgraphs.json` behind as orphans
 * that nothing rendered and nothing reported — content that had been removed
 * from the board but not from the graph, which is the `dh4f` shape inverted
 * one more time.
 */
export function prunableStickies(dir: string, wantedIds: readonly string[]): string[] {
  if (!existsSync(dir)) return [];
  const keep = new Set(wantedIds.map((id) => stickyFile(id)));
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json") && !keep.has(f))
    .filter((f) => readExistingSticky(join(dir, f)) !== undefined)
    .sort();
}

/**
 * Read the sticky already on disk, if there is a valid one.
 *
 * A malformed file returns `undefined` rather than throwing: initiation must be
 * able to repair a half-written sticky, and refusing to run because the thing
 * this function exists to write is broken would be the one failure mode with no
 * recovery. The malformed content is overwritten, which is the same call
 * `--check` reports as stale.
 */
export function readExistingSticky(path: string): LandingSticky | undefined {
  if (!existsSync(path)) return undefined;
  try {
    return LandingStickySchema.parse(JSON.parse(readFileSync(path, "utf8")));
  } catch {
    return undefined;
  }
}

/**
 * Every layer that contributes to this layer's board, in read order.
 *
 * Two sources, and the second is what makes bootstrap's card possible:
 *
 * 1. **the layer itself** — its own `harness.json`;
 * 2. **every NESTED layer** — a declared directory that belongs to another
 *    layer in this checkout. `bootstrap/` is exactly that.
 *
 * Nested layers are the PRE-SPLIT shape (issue #223). After the split they
 * become dependencies and arrive through the dependency chain instead, which is
 * why this returns a **list of roots** rather than doing the reading: the caller
 * supplies whichever set is true of its layout, the same way `resolveDirectories`
 * takes a `chain` rather than walking one so that *"this module does not depend on
 * the dependency resolver"*.
 *
 * **Discovered rather than hardcoded.** Naming `bootstrap/` here would put the
 * layer list back in the layer above — the ownership inversion this whole change
 * is undoing — and would go stale the moment the split happens.
 *
 * ## Two mechanisms this has to use rather than reimplement
 *
 * Measured against the live declaration, which is where a plausible version of
 * this function got both wrong and quietly composed a board of three instead of
 * four:
 *
 * | | why a naive `join(root, dir.path)` misses it |
 * |---|---|
 * | **`scope`** | `bootstrap` is declared `repository`-scoped, so its path resolves against the REPOSITORY root, not the layer. `rootForScope` is what knows that. |
 * | **the declared path is not the layer root** | the entry is `bootstrap/skills/` — the graph directory — and `harness.json` sits one level up, in `bootstrap/`. `findInstanceRoot` walks up to the layer that OWNS a directory. |
 *
 * Looking for `harness.json` inside the declared directory finds nothing here,
 * and the failure is silent: the board renders, bootstrap's card is simply not on
 * it. That is the same shape as the CSS selector that matched nothing — no error,
 * no output, and only a count says so.
 */
export function contributingRoots(root: string): string[] {
  const decl = readDeclaration(root);
  const own = resolve(root);
  const nested: string[] = [];
  for (const dir of decl?.directories ?? []) {
    // `rootForScope` FIRST: a repository-scoped entry is relative to the
    // checkout, and resolving it against the layer would point outside it.
    const abs = resolve(rootForScope(own, dir.scope), dir.path);
    // Then up to the layer that owns that directory. `undefined` means the
    // directory belongs to no layer — `beans/` at the repository root is the
    // live case — which is a real answer and not a gap.
    const owner = findInstanceRoot(abs);
    if (owner !== undefined && resolve(owner) !== own) nested.push(resolve(owner));
  }
  // SIBLINGS AT THE REPOSITORY ROOT, and this is the third source rather than a
  // tidier way of writing the second.
  //
  // The walk above finds a layer only when THIS layer declares a directory
  // inside it — which is how `bootstrap/` is found, since cat-harness declares
  // `bootstrap/skills/`. The content core's directory is declared by nobody: it is a
  // sibling directory that declares itself, and under the rule everywhere else
  // here — a layer is a directory holding its own `harness.json` — it is a
  // layer the moment it exists.
  //
  // Without this, adding a layer meant ALSO editing the layer above to mention
  // it, which is the ownership inversion the whole contribution design undoes.
  // Measured: the content core declared its card and the board did not show
  // it.
  // GUARDED ON `.git`, and the guard is not belt-and-braces — without it this
  // scan is actively wrong. `repoRootFor` is just `instanceRoot/..`, so for a
  // throwaway layer at `/tmp/xyz/` the "repository root" is `/tmp`, and
  // scanning it picks up every other temp layer on the machine. Measured:
  // 22 tests failed the moment this scan was added, each one reading somebody
  // else's fixture as a contributing layer.
  //
  // `.git` is the honest marker of "this directory is a checkout". A real
  // repository has one; a temp directory does not.
  //
  // `checkoutRootFor`, not `repoRootFor` (2026-10-15): for the CHECKOUT-ROOT
  // layer — a folio whose landing is the repository itself — `dirname` is
  // the directory holding the clone, and the `.git` guard does not stop it
  // when that directory is a checkout too: a Claude Code worktree's parent
  // resolves to the MAIN checkout, so every layer in another session's tree
  // joined this board. The checkout root answers itself and the scan is skipped.
  const repoRoot = checkoutRootFor(own);
  if (repoRoot !== own && existsSync(join(repoRoot, ".git"))) {
    // THE CHECKOUT ROOT ITSELF, by the same rule: it is a layer the moment
    // it declares itself. It used to be reached only by accident — cat-harness
    // declared `beans/` with `scope: "repository"`, and walking up from it found
    // the root's declaration. cmsl step 2 (issue #1694) moved those entries to
    // the root, and the root's card silently left the board (measured
    // 2026-09-30: `cat-harness/folio/folio-assistant.json` pruned).
    if (findDeclarationFile(resolve(repoRoot)) !== undefined) nested.push(resolve(repoRoot));
    for (const entry of readdirSync(repoRoot, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
      const abs = resolve(repoRoot, entry.name);
      if (abs === own) continue;
      if (findDeclarationFile(abs) !== undefined) nested.push(abs);
    }
    // THE CHECKOUT'S ROOT LAYER, when the repository root is one. It was
    // reached only through the walk above, because this layer declared
    // `beans/` at `scope: "repository"` and the root's declaration owns that
    // path — so the root's card was on the board by accident of a mirror.
    // Placement PR0 (bean `ejye`) moved `beans/` to the root's own
    // declaration, and the card went with the accident; it is named here.
    if (findDeclarationFile(repoRoot) !== undefined) nested.push(resolve(repoRoot));
  }

  // MOUNTED LAYERS: remote-mounted layers declared in index.lock.json
  // (or mount lock). For a mounted layer, the sticky arrives with the mount.
  for (const mRoot of mountedInstanceRoots(own).values()) {
    if (resolve(mRoot) !== own && findDeclarationFile(mRoot) !== undefined) nested.push(resolve(mRoot));
  }
  if (repoRoot !== own) {
    for (const mRoot of mountedInstanceRoots(repoRoot).values()) {
      if (resolve(mRoot) !== own && findDeclarationFile(mRoot) !== undefined) nested.push(resolve(mRoot));
    }
  }

  // The layer LAST, so its own contributions are read after its nested
  // layers'. Order here does not decide the board — `order` does — but a stable
  // read order makes the duplicate-id error message name the layers in a
  // predictable sequence.
  return [...new Set(nested), own];
}

/**
 * The contributions every layer declares, composed and ordered.
 *
 * Reads `stickies` off each layer's declaration and pairs it with that layer's
 * own `name`, `summary`, `alsoWritten` and `description`. `bodyFrom` reads **the
 * declaring layer's** fields, so bootstrap's card carries bootstrap's sentence and
 * not this layer's. Reading the root's for every layer would give a board of
 * one sentence repeated, which is the defect that makes the whole seam pointless.
 */
export function declaredContributions(root: string): DeclaredContribution[] {
  const declared: DeclaredContribution[] = [];
  for (const layer of contributingRoots(root)) {
    const decl = readDeclaration(layer);
    if (!decl?.stickies) continue;
    for (const raw of decl.stickies) {
      declared.push({
        contribution: StickyContributionSchema.parse(raw),
        declaredBy: decl.name,
        // The FILE, not just the layer's name. `layer` is the contributing
        // layer's root and was being discarded here; a consumer wanting to
        // link to the source had only a name, which is not resolvable — and
        // resolving one by searching is how two layers sharing a `name`
        // silently attribute a card to the wrong file.
        declaredIn: relative(checkoutRootFor(root), declarationPathIn(layer)!) || (findDeclarationFile(layer) ?? ""),
        instanceRoot: resolve(layer),
        ...(decl.description === undefined ? {} : { description: decl.description }),
        ...(decl.summary === undefined ? {} : { summary: decl.summary }),
        ...(decl.alsoWritten === undefined ? {} : { alsoWritten: decl.alsoWritten }),
      });
    }
  }
  return composeContributions(declared);
}

/**
 * Find the file for a declared contribution on disk.
 *
 * Looks in the declaring layer's own declared folio directory first:
 * each layer's sticky lives in its own folio/, not in cat-harness/folio/.
 * Falls back to the composing layer's folio directory for backward
 * compatibility / pre-split fixtures.
 */
export function stickyPathForContribution(
  d: DeclaredContribution,
  composingRoot: string,
): { abs: string; rel: string } {
  const composingDecl = readDeclaration(composingRoot);
  const composingFolio = folioDirPath(composingDecl);

  const instRoot = d.instanceRoot;
  if (instRoot && existsSync(instRoot)) {
    const instDecl = instRoot === resolve(composingRoot) ? composingDecl : readDeclaration(instRoot);
    const instFolio = folioDirPath(instDecl);
    const instAbs = join(instRoot, instFolio, stickyFile(d.contribution.id));
    if (existsSync(instAbs)) {
      const rel = relative(composingRoot, instAbs);
      return { abs: instAbs, rel: rel.startsWith("..") ? join(instFolio, stickyFile(d.contribution.id)) : rel };
    }
    if (instRoot !== resolve(composingRoot)) {
      const rel = relative(composingRoot, instAbs);
      return { abs: instAbs, rel: rel.startsWith("..") ? join(instFolio, stickyFile(d.contribution.id)) : rel };
    }
  }

  const fallbackAbs = join(composingRoot, composingFolio, stickyFile(d.contribution.id));
  return { abs: fallbackAbs, rel: join(composingFolio, stickyFile(d.contribution.id)) };
}

/**
 * The stickies this layer should have, each reusing its own `createdAt`.
 *
 * **Per-sticky reuse, not one timestamp for the set.** Reading the first
 * sticky's `createdAt` and applying it to all of them would rewrite the second
 * every time a new one was added, which is the no-op property this exists to
 * protect. Each file answers for itself.
 */
export function stickiesFor(
  root: string,
  dir: string,
  now: string,
  initiation?: InitiationUpdate,
): LandingSticky[] {
  return declaredContributions(root).map((d) => {
    const { abs } = stickyPathForContribution(d, root);
    const existing = readExistingSticky(abs) ?? readExistingSticky(join(dir, stickyFile(d.contribution.id)));
    // The status this card should carry after this run. Only the harness named
    // by the update changes; every other card keeps what it had, because one
    // harness finishing says nothing about another.
    const next = initiation && initiation.harness === d.declaredBy
      ? nextInitiation(existing?.initiation, initiation, now)
      : existing?.initiation;
    const wanted = stickyFromContribution(d, {
      createdAt: now,
      ...(next === undefined ? {} : { initiation: next }),
    });
    return existing ? { ...wanted, createdAt: existing.createdAt } : wanted;
  });
}

/**
 * Every harness sticky whose words are not the reader's text for its harness.
 *
 * The owner's ruling on bean `ob3m` finding 3, 2026-10-01: *"Stickies show the
 * same text as the landing page"*. A card built from its declaration must open
 * with {@link readerText}: the `summary` (else the description) and the
 * "Also written" spellings, which is what the landing's harness section shows.
 * The defect this catches: the folio-assistant card read its `description`,
 * which opens "The repository itself… NAMED `folio-assistant-checkout`", the
 * reason the name was chosen, written for a maintainer.
 *
 * **Reads the FILES the board renders**, not the declaration's intent, so a
 * card left stale is caught as well as a declaration that picks the author's
 * text. `startsWith` rather than equality, because `bodyAppend` may add to the
 * reader's text without copying it.
 *
 * A card with a literal `body` is not judged here. Its words are written for
 * the card itself, and there is no declaration field to compare them with.
 */
export function readerTextProblems(root: string): string[] {
  const problems: string[] = [];
  const own = resolve(root);
  const repoRoot = checkoutRootFor(own);
  const mountedRoots = new Set([
    ...mountedInstanceRoots(own).values(),
    ...(repoRoot !== own ? mountedInstanceRoots(repoRoot).values() : []),
  ]);
  for (const d of declaredContributions(root)) {
    if (d.instanceRoot && mountedRoots.has(resolve(d.instanceRoot))) continue;
    if (d.contribution.bodyFrom === undefined) continue;
    const want = readerText(d);
    if (want === undefined) continue;
    const { abs, rel } = stickyPathForContribution(d, root);
    const onDisk = readExistingSticky(abs);
    if (onDisk === undefined) continue; // reported as missing by the main check
    if (!onDisk.comment.startsWith(want)) {
      const why =
        d.contribution.bodyFrom === "description" && d.summary !== undefined
          ? `declares \`bodyFrom: "description"\` but ${d.declaredIn} has a \`summary\`; use \`bodyFrom: "summary"\``
          : "is stale";
      problems.push(
        `${rel} does not show ${d.declaredBy}'s summary and "Also written" (the landing's text): it ${why}`,
      );
    }
  }
  return problems;
}

/** What a `--begin` / `--complete` run is asking for. */
export interface InitiationUpdate {
  /** The layer NAME whose card this is about — `declaredBy`, not a path. */
  harness: string;
  phase: "begin" | "complete";
  /** `ok` unless the caller says otherwise. Only read on `complete`. */
  status?: "ok" | "failed";
  detail?: string;
}

/**
 * The status a card should carry after an update, given what it had.
 *
 * **`startedAt` is preserved across `complete`.** It answers *when did this
 * harness begin*, and a completion that overwrote it would turn the pair into
 * two readings of the same instant — which is exactly the drift `createdAt`
 * reuse exists to prevent one field over.
 *
 * A `complete` with nothing on the card is not refused. An initiation that was
 * never announced still finished, and losing that is worse than a `startedAt`
 * that is only as precise as the completion.
 */
export function nextInitiation(
  existing: LandingSticky["initiation"],
  update: InitiationUpdate,
  now: string,
): NonNullable<LandingSticky["initiation"]> {
  if (update.phase === "begin") {
    return { status: "running", startedAt: now };
  }
  const status = update.status ?? "ok";
  return {
    status,
    startedAt: existing?.startedAt ?? now,
    completedAt: now,
    ...(update.detail === undefined ? {} : { detail: update.detail }),
  };
}

/**
 * Every landing sticky currently on disk, in the declared render order.
 *
 * Reads the FILES rather than rebuilding them, because the two answer different
 * questions: the declarations say what a layer *should* have, and a renderer
 * must draw what it *does* have. If initiation has not run, or has run against an
 * older set, drawing the declarations' answer would render a page that does not
 * exist on disk — and the `--check` gate that exists to report exactly that
 * divergence would be bypassed by the renderer agreeing with the declaration
 * instead of with the files.
 *
 * Order comes from the composed contributions rather than from directory
 * listing, which is alphabetical and would put `bootstrap` before `landing`.
 * A sticky whose file is absent or unparseable is skipped rather than faked.
 */
export function readLandingStickies(root: string): LandingSticky[] {
  const decl = JSON.parse(readFileSync(declarationPathIn(root)!, "utf8")) as {
    directories?: ContentDirectory[];
  };
  const ownDir = join(root, folioDirPath(decl));
  return declaredContributions(root)
    .map((d) => {
      const { abs } = stickyPathForContribution(d, root);
      return readExistingSticky(abs) ?? readExistingSticky(join(ownDir, stickyFile(d.contribution.id)));
    })
    .filter((s): s is LandingSticky => s !== undefined);
}

export function ensureLandingSticky(
  root: string,
  now: string,
  opts: { check?: boolean; initiation?: InitiationUpdate } = {},
): EnsureReport {
  const raw = readFileSync(declarationPathIn(root)!, "utf8");
  const decl = JSON.parse(raw) as { directories?: ContentDirectory[] };
  const already = declaresFolio(decl);
  const folioDir = folioDirPath(decl);
  const absDir = join(root, folioDir);

  const own = resolve(root);
  // The checkout, never the directory holding it — see `contributingRoots`.
  const repoRoot = checkoutRootFor(own);
  const mountedRoots = new Set([
    ...mountedInstanceRoots(own).values(),
    ...(repoRoot !== own ? mountedInstanceRoots(repoRoot).values() : []),
  ]);

  const wanted = stickiesFor(root, absDir, now, opts.initiation);
  const contributions = declaredContributions(root);

  const planned = wanted.map((w) => {
    const contrib = contributions.find((c) => c.contribution.id === w.id);
    const instRoot = contrib?.instanceRoot ? resolve(contrib.instanceRoot) : own;
    const isMounted = mountedRoots.has(instRoot);

    const { abs, rel } = contrib ? stickyPathForContribution(contrib, root) : {
      abs: join(absDir, stickyFile(w.id)),
      rel: join(folioDir, stickyFile(w.id)),
    };

    const wantedText = `${JSON.stringify(w, null, 2)}\n`;
    const currentText = existsSync(abs) ? readFileSync(abs, "utf8") : undefined;
    const state: StickyReport["state"] =
      currentText === wantedText ? "already" : currentText === undefined ? "written" : "updated";
    return {
      abs,
      wantedText,
      currentText,
      isMounted,
      instRoot,
      report: { id: w.id, path: rel, state, ...(isMounted ? { mounted: true as const } : {}) },
    };
  });

  const ownWantedIds = planned.filter((p) => p.instRoot === own).map((p) => p.report.id);
  const prunable = prunableStickies(absDir, ownWantedIds);
  const report: EnsureReport = {
    declaredFolio: already ? "already" : "added",
    folioDir,
    createdDir: !existsSync(absDir),
    stickies: planned.map((p) => p.report),
    pruned: prunable,
  };
  if (opts.check) return report;

  // ONE-TIME REPAIR, NOT MAINTENANCE (`content-context-and-state-graphs` §"A
  // declared ASSET carries a layer too", bean `b5f0` §2: "A process may CREATE
  // or REPAIR the declaration. It never maintains it"). `<name>.json` is a
  // hand-authored declaration, not a `state` file that a running process keeps
  // current: this write fires only when the `folio` directory entry is missing
  // (`!already`) and returns on `already` every time thereafter. Do not take
  // this call as evidence that the declaration is process-maintained state.
  //
  // Written back to the file it was READ from — never composed. Production
  // code must not reach for the test-support writer, which names the file from
  // the body; here the declaration already exists and keeping its path is the
  // whole point.
  if (!already) writeFileSync(declarationPathIn(root)!, insertDirectoryEntry(raw, FOLIO_DIRECTORY_ENTRY));
  mkdirSync(absDir, { recursive: true });
  for (const p of planned) {
    if (p.isMounted) continue;
    if (p.currentText !== p.wantedText) {
      mkdirSync(dirname(p.abs), { recursive: true });
      writeFileSync(p.abs, p.wantedText);
    }
  }
  for (const f of prunable) unlinkSync(join(absDir, f));
  return report;
}

/** Parse `--begin <harness>` / `--complete <harness>` off the argv. */
export function initiationFromArgv(argv: readonly string[]): InitiationUpdate | undefined {
  const at = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const begin = at("--begin");
  if (begin) return { harness: begin, phase: "begin" };
  const complete = at("--complete");
  if (!complete) return undefined;
  const failed = argv.includes("--failed");
  const detail = at("--detail");
  return {
    harness: complete,
    phase: "complete",
    status: failed ? "failed" : "ok",
    ...(detail === undefined ? {} : { detail }),
  };
}

if (import.meta.main) {
  const check = process.argv.includes("--check");
  // `instanceRootFor` rather than cwd: the layer root and the repository root
  // stopped being the same directory in bean `wggr`, and a gate invoked from the
  // repository root would look for `harness.json` one level up from where it is.
  //
  // A layer directory given as an argument wins (bean `1yd7`). Run from a
  // separated layer's own repository, this script sits in the REMOTE-MOUNTED
  // cat-harness, so its own root is the mount: the mounted layers were then not
  // recognised as mounts and were written into, and the layer actually being
  // composed — the IRIS replica — never had its `folio` graph declared.
  const positional = process.argv.slice(2).find((a, i, all) => !a.startsWith("--") && !["--begin", "--complete"].includes(all[i - 1] ?? ""));
  const root = positional === undefined ? HARNESS_ROOT : resolve(positional);
  if (positional !== undefined && declarationPathIn(root) === undefined) {
    console.error(`${positional} holds no instance declaration`);
    process.exit(2);
  }
  // `--begin <harness>` at the START of that harness's initiation, `--complete
  // <harness>` at the end. Without the pair, a crashed initiation and one that
  // never ran look identical — both are a card that is simply not there, and
  // "missing" is the least informative thing a status board can say.
  const initiation = initiationFromArgv(process.argv);
  if (initiation && check) {
    console.error("`--check` reports; it does not record an initiation. Drop one of the two.");
    process.exit(2);
  }
  const report = ensureLandingSticky(root, new Date().toISOString(), {
    check,
    ...(initiation === undefined ? {} : { initiation }),
  });

  if (check) {
    const problems = [
      report.declaredFolio === "added" ? "no folio graph is declared" : undefined,
      report.createdDir ? `${report.folioDir} does not exist` : undefined,
      ...report.stickies
        .filter((st) => st.state !== "already" && !st.mounted)
        .map((st) => `${st.path} is ${st.state === "written" ? "missing" : "stale"}`),
      ...report.pruned.map((f) => `${join(report.folioDir, f)} is declared by no layer`),
      ...readerTextProblems(root),
    ].filter((p): p is string => p !== undefined);
    if (problems.length === 0) {
      console.log(`✓ folio declared at ${report.folioDir}, ${report.stickies.length} sticky/ies up to date`);
      process.exit(0);
    }
    console.error(`landing sticky is not in order:\n${problems.map((p) => `  · ${p}`).join("\n")}`);
    console.error(`run \`bun run cat landing:sticky\` and commit`);
    process.exit(1);
  }

  console.log(
    `folio graph ${report.declaredFolio === "added" ? "DECLARED" : "already declared"} at ${report.folioDir}; ` +
      report.stickies.map((st) => `${st.id} ${st.mounted ? "mounted" : st.state}`).join(", ") +
      (report.pruned.length > 0 ? `; pruned ${report.pruned.join(", ")}` : ""),
  );
  if (initiation) {
    console.log(
      `${initiation.harness}: initiation ${initiation.phase === "begin" ? "RUNNING" : (initiation.status ?? "ok").toUpperCase()}`,
    );
  }
}
