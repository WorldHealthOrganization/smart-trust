/**
 * QOU Paper Writing Assistant — MCP Server
 *
 * A unified MCP server providing:
 *   - PDF/HTML rendering (full paper, chapter, section, or single theorem)
 *   - Content-object validation and build pipeline
 *   - Formula/diagram quick preview (LaTeX → PNG)
 *   - User preference storage (render format, scope)
 *   - Lean LSP proxy (delegates to lean-lsp-mcp subprocess)
 *   - Content viewer (serves /api/paper from .ts manifests + SPA on /viewer/)
 *
 * Transports:
 *   --stdio   Stdio transport (default, for Claude Code .mcp.json)
 *   --http    Streamable HTTP transport (for remote/Docker deployment)
 *
 * Both modes start an HTTP server for the content viewer on VIEWER_PORT
 * (default 3200 for stdio, shared with MCP port for http).
 *
 * @module scripts/mcp-server/server
 */

import { folioDir, folioDirDeferred } from "../../schemas/kg/cat-harness.js";
import type { Paper, Chapter, Block, PaperMacro, FeedbackItem, Section, RenderedAsset, Folio } from "../../schemas/types.ts";
import { FeedbackItemSchema } from "../../schemas/constraints.ts";
import {
  INVALID_ENUM, parseTodoPriority, parseTodoStatus, TODO_PRIORITIES, TODO_STATUSES,
} from "../../src/core/feedback.js";
import { allows, forbidden, getUserEmail, getUserName, getUserRole } from "../../src/core/rbac.js";
import { refuseBranchName, refuseChatMode, refuseChatRequest, refuseCheckoutRequest } from "../../src/core/http-guard.js";
import { bindHostname, refuseMcp, trustedRequest } from "../../src/core/gateway-trust.js";
// `renderBlock` was reached through `await import(join(REPO_ROOT, …))`, which
// types as `any` — so nothing checked what was handed to it, and a
// `ResolvedBlock` went in for two years where a `Block` was declared. The
// module is already loaded eagerly for `leanStatusBucket`, so the dynamic
// import deferred nothing.
//
// The LaTeX renderer itself is no longer imported: this is a GENERIC server
// and the TeX renderer belongs to the science layer, so it is resolved from
// the folio's declared profile through `resolveRenderTarget`. See
// `schemas/ui/render-targets.ts`.
import { resolveRenderTarget } from "../../pipeline/render-discovery.js";
import { readDeclaredFolioProfile } from "../../pipeline/profile-check.js";
import { registerServedToolGroups } from "../../src/tool-groups.js";
import { createContentAdapter } from "../../src/content-adapter.js";
import { GitHelper } from "../../src/core/git.js";
import { leanStatusBucket } from "../../schemas/types.ts";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { TOOLS_ROOT } from "../../scripts/lib/roots.ts";
import { REPO_ROOT, BUILD_DIR, FEEDBACK_DIR, FEEDBACK_WORKTREE, MAIN_TEX, FOLIO_PORT, LIBRARY_DIRS, UPLOADS_DIR } from "./paths.js";
import { safeSegment, joinSegments, realPathWithin, writableWithin } from "../../src/core/safe-path.js";

/**
 * An archive was REFUSED, as distinct from failing to be an archive.
 *
 * Bean `6bhf`. The tar path's `catch` swallowed both, so a tarball rejected for
 * naming a path outside the upload directory fell through to "try as a single
 * `.tex`" with nothing logged — a refusal rendered as a non-event, and
 * indistinguishable from a file that simply was not a tarball. A distinct type
 * is what lets the handler answer 422 for one and carry on for the other.
 */
class UnsafeArchive extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeArchive";
  }
}
import { executeGraphTool } from "./tools/graph.js";
import {
  currentBranch, listBranches, fetchOrigin, isCurrentBranch,
  readFileBranch, fileExistsBranch, importTsBranch, listDirBranch,
  mergeBase, gitLogFiles, gitShowBinaryAt, gitShowAt, commitOf,
} from "./git.js";
import { detectRepoUrl } from "../../src/core/git-refs.js";
import { declarationLine, leanSourceUrl } from "../../src/core/lean-source-link.js";
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from "fs";
import { join, relative, resolve, extname, basename } from "path";
import { loadContributions } from "../../schemas/kg/harness-config.ts";
import { ContributionRegistry, type FolioContribution } from "../../schemas/content/contributions.ts";
import { contributionsRoot } from "../../pipeline/repo-root.ts";
import Anthropic from "@anthropic-ai/sdk";
import { guardUntrusted, oneLineLabel } from "../../src/core/handover-screen.js";

// ── Access control ───────────────────────────────────────────
// Decided by the layer's ODRL policies through the core module (issue
// #1207). This file kept a private copy of the old viewer < collaborator <
// owner ladder until then — a second copy of a permission rule is a second
// rule, free to drift from the first.

// ── Feedback storage (TypeScript files, committed to main via worktree) ────
//
// Structure: feedback/<paper-dir>/<rootName>.ts
//   export default [{ id, summary, ... }, ...]
//
// On write, the feedback is written to both:
//   1. The main repo's feedback/ (for immediate reads)
//   2. The .feedback-wt/ worktree (for committing to main)

import { spawnSync } from "child_process";

/**
 * Resolve feedback .ts path relative to a base dir, or `undefined`.
 *
 * **BOTH arguments come from outside and neither was checked** — bean `6bhf`,
 * measured 2026-09-25. `paperId` and `rootName` reach here straight from
 * `GET /api/feedback?paperId=&rootName=` and from the POST body, so this one
 * `join` was a read primitive and, through `writeFeedback`, a write one.
 *
 * Returns `undefined` rather than throwing or repairing: the caller owns the
 * 400, and `safe-path.ts` §"Refuse, never repair" says why sanitising is worse.
 */
function feedbackPath(paperId: string, rootName: string, base = FEEDBACK_DIR): string | undefined {
  const seg = safeSegment(paperId);
  const name = safeSegment(rootName);
  if (seg === undefined || name === undefined) return undefined;
  return join(base, seg, `${name}.ts`);
}

/** Parse a feedback .ts file → array of FeedbackItems. */
function parseFeedbackTs(content: string): unknown[] {
  // Strip import line and satisfies clause, then extract the JSON array
  const stripped = content
    .replace(/^import\s+.*;\s*/m, '')
    .replace(/\s+satisfies\s+\S+;\s*$/, ';');
  const match = stripped.match(/export\s+default\s+(\[[\s\S]*\])\s*;?\s*$/);
  if (!match) return [];
  try {
    return JSON.parse(match[1]);
  } catch { return []; }
}

/** Serialize feedback items to TypeScript source. */
function serializeFeedbackTs(items: FeedbackItem[]): string {
  const json = JSON.stringify(items, null, 2);
  return `import type { FeedbackItem } from "../../schemas/types";\n\nexport default ${json} satisfies FeedbackItem[];\n`;
}

/**
 * Read one feedback file's items.
 *
 * The file is written only by `writeFeedback`, which serializes with
 * `satisfies FeedbackItem[]` — so `FeedbackItem` is the contract, and an entry
 * that fails it is a corruption rather than a supported shape. It is still
 * RETURNED: every write path here is read-modify-write over the whole file
 * (`/api/feedback/{create,update,delete}` read all items, touch one, and hand
 * the array straight back to `writeFeedback`), so silently dropping a
 * malformed entry at read time would delete somebody's feedback from `main` on
 * the next unrelated edit. Non-conforming entries are logged instead, which is
 * the part that was missing: this used to return `unknown[]` and every caller
 * cast it to `any[]`, so a corrupt entry produced neither a type error nor a
 * log line — just `undefined` flowing into a status filter.
 */
function readFeedback(paperId: string, rootName: string): FeedbackItem[] {
  const p = feedbackPath(paperId, rootName);
  // A refused id is indistinguishable from an absent store TO THIS FUNCTION,
  // which already returns `[]` for "nothing there" and has no channel for an
  // error. Logged so a refusal is not silent, because a traversal attempt and
  // a typo look identical in an empty array.
  if (p === undefined) {
    log("feedback", `refused unsafe identifier`, `paperId=${JSON.stringify(paperId)} rootName=${JSON.stringify(rootName)}`);
    return [];
  }
  if (!existsSync(p)) return [];
  let items: unknown[];
  try { items = parseFeedbackTs(readFileSync(p, "utf-8")); } catch { return []; }
  return items.map((item, i) => {
    const parsed = FeedbackItemSchema.safeParse(item);
    if (!parsed.success) {
      log("feedback", `malformed item retained: ${paperId}/${rootName}[${i}]`,
        parsed.error.issues.map((iss) => `${iss.path.join(".") || "<root>"}: ${iss.message}`).join("; "));
    }
    // Retained regardless — see the note above on read-modify-write.
    return item as FeedbackItem;
  });
}

function writeFeedback(paperId: string, rootName: string, todos: FeedbackItem[]): void {
  // THROWS rather than returning quietly, unlike `readFeedback` — the two are
  // deliberately different. A refused read has a correct empty answer; a
  // refused write does NOT have a correct no-op, because the caller believes
  // the item was saved and will report success to a person. Bean `6bhf`.
  const target = feedbackPath(paperId, rootName);
  const dir = joinSegments(FEEDBACK_DIR, paperId);
  if (target === undefined || dir === undefined) {
    throw new Error(
      `refusing to write feedback: paperId or rootName is not one safe path segment ` +
        `(paperId=${JSON.stringify(paperId)}, rootName=${JSON.stringify(rootName)})`,
    );
  }
  const ts = serializeFeedbackTs(todos);

  // Write to main repo feedback/ (for immediate reads)
  mkdirSync(dir, { recursive: true });
  writeFileSync(target, ts, "utf-8");

  // Write to worktree and commit to main
  commitFeedbackToMain(paperId, rootName, ts);
}

/** Generate a unique todo ID: timestamp + 4-char hash to avoid collisions. */
function makeTodoId(): string {
  const ts = Date.now().toString(36);
  const hash = Math.random().toString(36).slice(2, 6);
  return `todo-${ts}-${hash}`;
}

// ── Worktree: commit feedback to main ────────────────────────────

let worktreeReady = false;

const FEEDBACK_BRANCH = "feedback/auto-commit";

function ensureWorktree(): boolean {
  if (worktreeReady) return true;
  try {
    if (!existsSync(FEEDBACK_WORKTREE)) {
      // Create a dedicated branch from main so we don't lock the main branch.
      // This lets users freely `git switch main` in the main repo.
      spawnSync("git", ["fetch", "origin", "main"], {
        cwd: REPO_ROOT, stdio: "pipe", timeout: 15000,
      });
      // Create the feedback branch pointing at origin/main (ignore error if it exists)
      spawnSync("git", ["branch", FEEDBACK_BRANCH, "origin/main"], {
        cwd: REPO_ROOT, stdio: "pipe", timeout: 5000,
      });
      const r = spawnSync("git", ["worktree", "add", FEEDBACK_WORKTREE, FEEDBACK_BRANCH], {
        cwd: REPO_ROOT, stdio: "pipe", timeout: 15000,
      });
      if (r.status !== 0) {
        log("feedback", "worktree setup failed", r.stderr?.toString().trim());
        return false;
      }
    }
    worktreeReady = true;
    return true;
  } catch (e) {
    log("feedback", "worktree error", String(e));
    return false;
  }
}

function commitFeedbackToMain(paperId: string, rootName: string, content: string): void {
  if (!ensureWorktree()) return;

  try {
    // Fast-forward the feedback branch to latest origin/main
    spawnSync("git", ["fetch", "origin", "main"], {
      cwd: FEEDBACK_WORKTREE, stdio: "pipe", timeout: 15000,
    });
    spawnSync("git", ["reset", "--hard", "origin/main"], {
      cwd: FEEDBACK_WORKTREE, stdio: "pipe", timeout: 10000,
    });

    // Write file in worktree
    const wtDir = join(FEEDBACK_WORKTREE, "folio-assistant/feedback", paperId);
    mkdirSync(wtDir, { recursive: true });
    const wtPath = join(wtDir, `${rootName}.ts`);
    writeFileSync(wtPath, content, "utf-8");

    // Stage + commit + push
    const relPath = `folio-assistant/feedback/${paperId}/${rootName}.ts`;
    spawnSync("git", ["add", relPath], { cwd: FEEDBACK_WORKTREE, stdio: "pipe" });

    const commitResult = spawnSync("git", ["commit", "-m", `feedback: ${paperId}/${rootName}`], {
      cwd: FEEDBACK_WORKTREE, stdio: "pipe", timeout: 10000,
    });

    if (commitResult.status === 0) {
      // Push with retry (up to 3 attempts with backoff)
      for (let attempt = 0; attempt < 3; attempt++) {
        const push = spawnSync("git", ["push", "origin", `${FEEDBACK_BRANCH}:main`], {
          cwd: FEEDBACK_WORKTREE, stdio: "pipe", timeout: 30000,
        });
        if (push.status === 0) {
          log("feedback", `committed to main: ${relPath}`);
          return;
        }
        if (attempt < 2) {
          // Brief backoff before retry
          spawnSync("sleep", [String(2 ** (attempt + 1))]);
        }
      }
      log("feedback", `push failed after retries: ${relPath}`);
    }
  } catch (e) {
    log("feedback", "commit error", String(e));
  }
}

/** List all feedback items across all papers, optionally filtered by status. */
function listAllFeedback(status?: string): { paperId: string; rootName: string; todo: FeedbackItem }[] {
  const results: { paperId: string; rootName: string; todo: FeedbackItem }[] = [];
  if (!existsSync(FEEDBACK_DIR)) return results;
  for (const paperId of readdirSync(FEEDBACK_DIR)) {
    const paperFbDir = join(FEEDBACK_DIR, paperId);
    try {
      for (const file of readdirSync(paperFbDir)) {
        if (!file.endsWith(".ts")) continue;
        const rootName = file.replace(/\.ts$/, "");
        const todos = readFeedback(paperId, rootName);
        for (const t of todos) {
          if (!status || t.status === status) {
            results.push({ paperId, rootName, todo: t });
          }
        }
      }
    } catch {}
  }
  return results;
}

// ── Content resolution (dynamic, no static JSON) ────────────────

const folioDirOf = folioDirDeferred(REPO_ROOT, import.meta.url);

/**
 * The node populations the graph tools read: `content`, plus EVERY declared
 * library.
 *
 * "The two" until bean `a02m`. The count was in the sentence and in the code,
 * and both were assumptions about a declaration that may name several — a
 * server answering graph queries over the first library and reporting nothing
 * amiss is the failure mode that costs the most to notice.
 *
 * Named per directory when there is more than one, because a result says which
 * root it came from and two roots called `library` make that answer useless.
 */
const GRAPH_ROOTS = [
  // `folioDirOf()`, not `CONTENT_DIR`: bean `hs08` made a folio SAY where its
  // content is rather than the platform assuming `content/`.
  { name: "folio", dir: folioDirOf() },
  ...LIBRARY_DIRS.map((dir, i) => ({
    name: LIBRARY_DIRS.length === 1 ? "library" : `library:${relative(REPO_ROOT, dir) || String(i)}`,
    dir,
  })),
];
import { resolveFormalRef } from "../../schemas/formal-ref.js";
import {
  blockCaption, blockExamples, blockLean, blockProofs, blockTex,
  isSectionRef, sectionBlockNames,
} from "../manifest-entries.js";

/** A block's Lean source and the repository-relative path it was read from. */
interface LeanFile {
  source: string;
  path: string;
}

/**
 * Resolve the Lean source for a block across branch-backed storage.
 * Mirrors the logic in `folio-assistant/adapters/paper/resolver.ts`
 * but operates against the MCP server's git helpers.
 */
function resolveLeanFile(
  blk: Block,
  chRel: string,
  rootName: string,
  // `string | undefined`, matching `readFileBranch` (which this forwards to)
  // and both call sites, where `br` is the optional `?branch=` query param.
  // Declaring it `string` was simply narrower than every party involved.
  branch: string | undefined,
): LeanFile | undefined {
  const blkLean = bLean(blk);
  if (!blkLean) return undefined;
  // Steps 2 and 3 were built here from `leanPackageByName` and a decl-prefix
  // walk — the FORMALISM LAYER's vocabulary, which core no longer holds (owner
  // ruling 2026-09-27). `resolveFormalRef` returns the same paths in the same
  // order; the branch-backed reading stays, because that is this function's job.
  //
  // `fallbackPaths` is deliberately NOT consulted: it is the module-path
  // candidate that may be an import-only aggregator, and serving an `import`
  // list as a block's source is worse than serving nothing.
  const res = resolveFormalRef(blkLean.ref);

  // 1. sibling .lean file
  const sibling = `${chRel}/${rootName}.lean`;
  const siblingSource = readFileBranch(branch, sibling);
  if (siblingSource) return { source: siblingSource, path: sibling };

  // 2. the layer's candidate paths, in its own priority order
  if (res) {
    for (const candidate of res.candidatePaths) {
      const source = readFileBranch(branch, candidate);
      if (source) return { source, path: candidate };
    }
  }

  // 3. grep fallback (current branch + disk-backed package only)
  if (res?.searchDir && isCurrentBranch(branch)) {
    try {
      const leanSrcDir = resolve(REPO_ROOT, res.searchDir);
      if (existsSync(leanSrcDir)) {
        const result = Bun.spawnSync(["grep", "-rl", res.declName, leanSrcDir]);
        const files = result.stdout.toString().trim().split("\n").filter(Boolean);
        if (files.length > 0 && existsSync(files[0])) {
          return { source: readFileSync(files[0], "utf-8"), path: relative(REPO_ROOT, files[0]) };
        }
      }
    } catch {}
  }

  return undefined;
}

interface ResolvedRenderedAsset {
  mime: string;
  url: string;
  blockIndex: number;
  hash?: string;
}

/**
 * Field accessors for the `Block` discriminated union.
 *
 * Only some kinds carry `lean`, `proofs`, `tex`, `caption` and the simulator
 * fields, so reading them off the bare union is a type error at every site —
 * which is why the block imports were `as any`. The `in` operator narrows
 * properly, so each of these is a real check rather than a cast.
 *
 * `blockStatus` is different: there IS no block-level `status`.
 * `FormalizationStatus` is documented in the schema as "derived at build time
 * from .lean file content. NOT stored in content block .ts manifests", so
 * every `blockStatus(blk)` read in this file was `undefined`. It is derived from the
 * block's `lean` field here, via the one existing mapper.
 */
// Shared with `adapters/paper/resolver.ts`, which needs the same five.
const bLean = blockLean;
const bProofs = blockProofs;
const bExamples = blockExamples;
const bTex = blockTex;
const bCaption = blockCaption;
const bSimulator = (b: Block) => ("simulator" in b ? b.simulator : undefined);
const bHtml = (b: Block) => ("html" in b ? b.html : undefined);
const bViews = (b: Block) => ("views" in b ? b.views : undefined);
const bDefaultView = (b: Block) => ("defaultView" in b ? b.defaultView : undefined);
const blockStatus = (b: Block) => leanStatusBucket(bLean(b));

/**
 * A block's `lean` with the resolved source attached, in `ResolvedBlock`'s
 * shape. Spreading `{ ...bLean(blk), source }` widens `ref` to optional —
 * `LeanRef.ref` is required, but a spread of a possibly-undefined value is
 * not — while `ResolvedBlock.lean.ref` requires it. Building it explicitly
 * keeps both sides honest.
 */
function withSource(
  lean: ReturnType<typeof bLean>,
  file: LeanFile | undefined,
  branch: string | undefined,
): ResolvedBlock["lean"] {
  if (!lean) return undefined;
  return { ...lean, ref: lean.ref, source: file?.source, sourceUrl: leanDeclarationUrl(lean.ref, file, branch) };
}

/** This content repository's web URL, read once: `origin` does not move while the server runs. */
let repoUrlMemo: { url: string | undefined } | undefined;
const contentRepoUrl = () => (repoUrlMemo ??= { url: detectRepoUrl(REPO_ROOT) }).url;

/**
 * The block's Lean declaration on GitHub, at the commit the source was read
 * from (owner ruling 2026-10-20, bean `og5t`, option A). `undefined` when the
 * file was not found, the repository is not on GitHub, or the commit does not
 * resolve; the link is then simply not drawn. Without a line (the name is not
 * declared in a form `declarationLine` recognises) it points at the file.
 */
function leanDeclarationUrl(ref: string, file: LeanFile | undefined, branch: string | undefined): string | undefined {
  if (!file) return undefined;
  const declName = resolveFormalRef(ref)?.declName ?? ref.replace(/^[^:]*:/, "");
  return leanSourceUrl(contentRepoUrl(), commitOf(branch), file.path, declarationLine(file.source, declName));
}

interface ResolvedBlock {
  rootName: string;
  kind: string;
  label?: string;
  title?: string;
  uses?: string[];
  examples?: string[];
  proofs?: string[];
  /** `sorryFree` is a real `LeanRef` field (schemas/types.ts) and the
   *  strongest proof-status signal — `render-latex` says it "wins outright"
   *  over the `validation` enum. The `...bLean(blk)` spreads below carry it;
   *  omitting it here made it invisible to every consumer and unreadable at
   *  the one site that tried. */
  lean?: { ref: string; file?: string; validation?: string; sorryFree?: boolean; source?: string; sourceUrl?: string };
  status?: string;
  tex?: string;
  caption?: string;
  tags?: string[];
  rendered?: ResolvedRenderedAsset[];
  md: string;
  todos?: FeedbackItem[];
}

interface ResolvedSection {
  title: string;
  label?: string;
  blocks: ResolvedBlock[];
  /** One structural level deeper. The resolver builds these and the block
   *  lookup below reads them; the interface simply never declared it. */
  subsections?: ResolvedSection[];
}

interface ResolvedChapter {
  /** Optional in practice: the resolver sets `undefined` for a chapter that
   *  carries a `tabLabel` (appendices), auto-numbering only the rest. */
  number?: number;
  title: string;
  label?: string;
  /** Set for appendices instead of a number. */
  tabLabel?: string;
  /** Chapter directory. Pushed by `resolvePaper` and read by the block
   *  lookup — declared here for the first time. */
  dir?: string;
  sections: ResolvedSection[];
  todos?: FeedbackItem[];
}

interface ResolvedPaper {
  id: string;
  title: string;
  authors: string[];
  affiliations?: string[];
  date?: string;
  chapters: ResolvedChapter[];
  todos?: FeedbackItem[];
  /** Flattened O(1) lookup: rootName → block. Not serialized to API responses. */
  blocksByName?: Map<string, ResolvedBlock>;
}

interface FolioEntry {
  id: string;
  title: string;
  description?: string;
  tags?: string[];
  authors: string[];
  date?: string;
  stats: { chapters: number; blocks: number; proved: number; todos: number };
}

async function resolveFolio(branch?: string): Promise<{ title: string; papers: FolioEntry[]; branch: string }> {
  const br = branch;
  // declared-path-literal: the folio content root. Resolving it through `directoryForGraph` is bean `hs08`; the harness-side callers hit `ot9a`'s layering boundary, so the literal is COUNTED here rather than hidden.
  const folioRel = "folio/folio.ts";
  let folioData: Folio;

  if (fileExistsBranch(br, folioRel)) {
    folioData = await importTsBranch<Folio>(br, folioRel);
  } else {
    // Auto-discover: scan content/ for directories with matching .ts manifests
    const dirs = listDirBranch(br, "content").filter(d => {
      if (d === "schema" || d === "pipeline" || d === "node_modules") return false;
      // declared-path-literal: the folio content root. Resolving it through `directoryForGraph` is bean `hs08`; the harness-side callers hit `ot9a`'s layering boundary, so the literal is COUNTED here rather than hidden.
      return fileExistsBranch(br, `folio/${d}/${d}.ts`);
    });
    folioData = { title: "Papers", papers: dirs.map(d => ({ dir: d })) };
  }

  const papers: FolioEntry[] = [];
  for (const ref of folioData.papers) {
    try {
      // declared-path-literal: the folio content root. Resolving it through `directoryForGraph` is bean `hs08`; the harness-side callers hit `ot9a`'s layering boundary, so the literal is COUNTED here rather than hidden.
      const paperMod = await importTsBranch<Paper>(br, `folio/${ref.dir}/${ref.dir}.ts`);
      let blockCount = 0, provedCount = 0, todoCount = 0, chapCount = 0;

      for (const chRef of paperMod.chapters || []) {
        // declared-path-literal: the folio content root. Resolving it through `directoryForGraph` is bean `hs08`; the harness-side callers hit `ot9a`'s layering boundary, so the literal is COUNTED here rather than hidden.
        const chRel = `folio/${ref.dir}/${chRef.dir}/${chRef.dir}.ts`;
        if (!fileExistsBranch(br, chRel)) continue;
        chapCount++;
        const ch = await importTsBranch<Chapter>(br, chRel);
        for (const sec of ch.sections || []) {
          // Was `!("blocks" in sec)`, which also skipped inline sections that
          // keep all their blocks in `subsections[]` — so `sectionBlockNames`,
          // whose entire job is to reach those, never saw one here and the
          // folio landing page undercounted them. `resolvePaper` below already
          // used the reference test; these now agree.
          if (isSectionRef(sec)) continue;
          for (const rootName of sectionBlockNames(sec)) {
            // declared-path-literal: the folio content root. Resolving it through `directoryForGraph` is bean `hs08`; the harness-side callers hit `ot9a`'s layering boundary, so the literal is COUNTED here rather than hidden.
            const blkRel = `folio/${ref.dir}/${chRef.dir}/${rootName}.ts`;
            if (!fileExistsBranch(br, blkRel)) continue;
            blockCount++;
            try {
              const blk = await importTsBranch<Block>(br, blkRel);
              // `blockStatus(blk)` does not exist. `FormalizationStatus` is
              // documented in the schema as "derived at build time from .lean
              // file content. NOT stored in content block .ts manifests", so
              // this counter has always been 0. The block's own `lean` field is
              // the signal, mapped by the one existing mapper.
              if (leanStatusBucket(bLean(blk)) === "compiled") provedCount++;
              const fb = readFeedback(ref.dir, rootName);
              if (fb.length) todoCount += fb.filter((t) => t.status !== "resolved" && t.status !== "wontfix").length;
            } catch {}
          }
        }
      }

      papers.push({
        id: ref.dir,
        title: ref.title || paperMod.title,
        description: ref.description,
        tags: ref.tags,
        authors: paperMod.authors,
        date: paperMod.date,
        stats: { chapters: chapCount, blocks: blockCount, proved: provedCount, todos: todoCount },
      });
    } catch {
      papers.push({
        id: ref.dir,
        title: ref.title || ref.dir,
        description: ref.description,
        tags: ref.tags,
        authors: [],
        stats: { chapters: 0, blocks: 0, proved: 0, todos: 0 },
      });
    }
  }

  return { title: folioData.title, papers, branch: currentBranch() };
}

async function resolvePaper(id: string, branch?: string): Promise<(ResolvedPaper & { branch: string }) | null> {
  const cacheKey = `${id}:${branch || "HEAD"}`;
  const cached = cacheGet(fullPaperCache, cacheKey);
  if (cached) return cached;

  const br = branch;
  // declared-path-literal: the folio content root. Resolving it through `directoryForGraph` is bean `hs08`; the harness-side callers hit `ot9a`'s layering boundary, so the literal is COUNTED here rather than hidden.
  const paperRel = `folio/${id}/${id}.ts`;
  if (!fileExistsBranch(br, paperRel)) return null;

  const paperMod = await importTsBranch<Paper>(br, paperRel);
  const chapters: ResolvedChapter[] = [];

  // Auto-number chapters from manifest order
  let autoNum = 1;
  for (const chRef of paperMod.chapters || []) {
    // declared-path-literal: the folio content root. Resolving it through `directoryForGraph` is bean `hs08`; the harness-side callers hit `ot9a`'s layering boundary, so the literal is COUNTED here rather than hidden.
    const chRel = `folio/${id}/${chRef.dir}`;
    const chTsRel = `${chRel}/${chRef.dir}.ts`;
    if (!fileExistsBranch(br, chTsRel)) continue;
    const ch = await importTsBranch<Chapter>(br, chTsRel);
    const chapterNumber = ch.tabLabel != null ? undefined : autoNum++;

    const sections: ResolvedSection[] = [];
    for (const sec of ch.sections || []) {
      if (isSectionRef(sec)) continue;
      const section = sec;
      const resolveBlocksList = async (blockNames: string[]) => {
        const res: ResolvedBlock[] = [];
        for (const rootName of blockNames) {
          const blkTsRel = `${chRel}/${rootName}.ts`;
          const blkMdRel = `${chRel}/${rootName}.md`;
          try {
            const blk = await importTsBranch<Block>(br, blkTsRel);
            const md = readFileBranch(br, blkMdRel) || "";
            const feedback = readFeedback(id, rootName);
            const blockTodos = feedback.length ? [...feedback] : undefined;
            const leanFile = resolveLeanFile(blk, chRel, rootName, br);
            const rendered = blk.rendered?.map(
              (r: RenderedAsset) => ({ ...r, url: `/api/content-asset/${id}/${chRef.dir}/${r.url}` })
            );
            const figFile = blk.kind === "diagram" && blk.meta?.file as string | undefined;
            const figRendered = figFile ? [{
              mime: figFile.endsWith(".svg") ? "image/svg+xml" : figFile.endsWith(".png") ? "image/png" : "image/jpeg",
              url: `/api/content-asset/${id}/${chRef.dir}/${figFile}`,
              blockIndex: 0
            }] : undefined;
            res.push({
              rootName, kind: blk.kind, label: blk.label, title: blk.title, uses: blk.uses,
              examples: bExamples(blk), proofs: bProofs(blk), lean: withSource(bLean(blk), leanFile, br),
              status: blockStatus(blk), tex: bTex(blk), caption: bCaption(blk), tags: blk.tags, rendered: rendered || figRendered,
              md, todos: blockTodos
            });
          } catch (e) { res.push({ rootName, kind: "error", md: `Failed to load ${rootName}: ${e}` }); }
        }
        return res;
      };
      
      const ownBlockNames = Array.isArray(section.blocks) ? section.blocks : [];
      const blocks = await resolveBlocksList(ownBlockNames);
      
      let subsections: ResolvedSection[] | undefined;
      if (Array.isArray(section.subsections)) {
        subsections = [];
        for (const sub of section.subsections) {
          if (!sub) continue;
          // A bare `SectionRef` subsection is not resolvable at this level —
          // nothing here reads `name`/`uri` — so it contributes no blocks,
          // exactly as before when `sub.blocks` was simply absent.
          const inline = isSectionRef(sub) ? undefined : sub;
          const subBlocks = await resolveBlocksList(inline?.blocks ?? []);
          subsections.push({ title: inline?.title ?? "", label: inline?.label, blocks: subBlocks });
        }
      }

      sections.push({ title: section.title, label: section.label, blocks, subsections });
    }

    const chTodos = readFeedback(id, `__chapter:${chRef.dir}`);
    chapters.push({
      number: chapterNumber, tabLabel: ch.tabLabel, title: ch.title, label: ch.label, sections,
      todos: chTodos.length ? chTodos : undefined,
    });
  }

  // Build flattened block lookup map
  const blocksByName = new Map<string, ResolvedBlock>();
  for (const ch of chapters) {
    for (const sec of ch.sections) {
      for (const blk of sec.blocks) blocksByName.set(blk.rootName, blk);
      if (sec.subsections) {
        for (const sub of sec.subsections) {
          for (const blk of sub.blocks) blocksByName.set(blk.rootName, blk);
        }
      }
    }
  }

  const paperTodos = readFeedback(id, "__paper");
  const result = {
    id,
    title: paperMod.title,
    authors: paperMod.authors,
    affiliations: paperMod.affiliations,
    date: paperMod.date,
    macros: paperMod.macros,
    chapters,
    todos: paperTodos.length ? paperTodos : undefined,
    branch: currentBranch(),
    blocksByName,
  };
  cacheSet(fullPaperCache, cacheKey, result);
  return result;
}

// ── Cache layer (5-minute TTL) ──────────────────────────────────

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry<T> {
  data: T;
  ts: number;
}

// Each cache holds exactly one shape; declaring that is what lets `cacheGet`
// return it. While these were `CacheEntry<any>` the reader at the chapter
// cache had to launder its result through `as unknown as ChapterDetail`, and
// the writer through `as any` — two casts standing in for one type argument.
const paperOutlineCache = new Map<string, CacheEntry<PaperOutline>>();
const chapterCache = new Map<string, CacheEntry<ChapterDetail>>();
const sectionCache = new Map<string, CacheEntry<ResolvedSection>>();
const fullPaperCache = new Map<string, CacheEntry<ResolvedPaper & { branch: string }>>();

function cacheGet<T>(cache: Map<string, CacheEntry<T>>, key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) { cache.delete(key); return null; }
  return entry.data;
}

function cacheSet<T>(cache: Map<string, CacheEntry<T>>, key: string, data: T): void {
  cache.set(key, { data, ts: Date.now() });
}

/** Invalidate all caches for a paper (call after edits/saves). */
function invalidatePaperCache(paperId?: string): void {
  if (paperId) {
    for (const cache of [paperOutlineCache, chapterCache, fullPaperCache, sectionCache]) {
      for (const k of [...cache.keys()]) if (k.startsWith(paperId + ":")) cache.delete(k);
    }
  } else {
    paperOutlineCache.clear();
    chapterCache.clear();
    fullPaperCache.clear();
    sectionCache.clear();
  }
}

// ── Paper outline (lightweight — no blocks/md/lean) ─────────────

interface ChapterOutline {
  /** Undefined for a chapter carrying a `tabLabel` — same rule as
   *  `ResolvedChapter.number`, which this mirrors. */
  number?: number;
  title: string;
  label?: string;
  /** Set for appendices instead of a number — the resolver pushes it. */
  tabLabel?: string;
  dir: string;
  sections: { title: string; label?: string; blockCount: number }[];
}

interface PaperOutline {
  id: string;
  title: string;
  authors: string[];
  affiliations?: string[];
  date?: string;
  /** `Paper.macros` is `Record<string, PaperMacro>` — `{ tex, unicode? }`
   *  objects, which is what the viewer reads (`buildKatexMacros` uses
   *  `def.tex`). This declared `Record<string, string>`; the values passed
   *  through untouched so nothing broke at runtime, but the type was a lie and
   *  any consumer doing string work on them would get "[object Object]".
   *  Surfaced only once the paper import stopped being `as any`. */
  macros?: Record<string, PaperMacro>;
  chapters: ChapterOutline[];
  branch: string;
}

async function resolvePaperOutline(id: string, branch?: string): Promise<PaperOutline | null> {
  const cacheKey = `${id}:${branch || "HEAD"}`;
  const cached = cacheGet(paperOutlineCache, cacheKey);
  if (cached) return cached;

  const br = branch;
  // declared-path-literal: the folio content root. Resolving it through `directoryForGraph` is bean `hs08`; the harness-side callers hit `ot9a`'s layering boundary, so the literal is COUNTED here rather than hidden.
  const paperRel = `folio/${id}/${id}.ts`;
  if (!fileExistsBranch(br, paperRel)) return null;

  const paperMod = await importTsBranch<Paper>(br, paperRel);
  const chapters: ChapterOutline[] = [];

  // Auto-number chapters from manifest order
  let autoNum = 1;
  for (const chRef of paperMod.chapters || []) {
    // declared-path-literal: the folio content root. Resolving it through `directoryForGraph` is bean `hs08`; the harness-side callers hit `ot9a`'s layering boundary, so the literal is COUNTED here rather than hidden.
    const chRel = `folio/${id}/${chRef.dir}`;
    const chTsRel = `${chRel}/${chRef.dir}.ts`;
    if (!fileExistsBranch(br, chTsRel)) continue;
    const ch = await importTsBranch<Chapter>(br, chTsRel);
    const chapterNumber = ch.tabLabel != null ? undefined : autoNum++;

    const sections: ChapterOutline["sections"] = [];
    for (const sec of ch.sections || []) {
      if (isSectionRef(sec)) continue;
      sections.push({ title: sec.title, label: sec.label, blockCount: sectionBlockNames(sec).length });
    }

    chapters.push({ number: chapterNumber, tabLabel: ch.tabLabel, title: ch.title, label: ch.label, dir: chRef.dir, sections });
  }

  const result: PaperOutline = {
    id,
    title: paperMod.title,
    authors: paperMod.authors,
    affiliations: paperMod.affiliations,
    date: paperMod.date,
    macros: paperMod.macros,
    chapters,
    branch: currentBranch(),
  };

  cacheSet(paperOutlineCache, cacheKey, result);
  return result;
}

// ── Single chapter resolver (section stubs only) ────────────────

interface SectionStub {
  title: string;
  label?: string;
  blockCount: number;
  /** Lightweight block summaries for sidebar (no md/lean source). */
  blockStubs: { rootName: string; kind: string; label?: string; title?: string; status?: string; lean?: { ref?: string; file?: string; validation?: string; sorryFree?: boolean }; todoCount: number }[];
}

interface ChapterDetail {
  number?: number;
  title: string;
  label?: string;
  dir: string;
  sections: SectionStub[];
  todos?: FeedbackItem[];
}

async function resolveChapterDetail(
  paperId: string, chapterDir: string, branch?: string
): Promise<ChapterDetail | null> {
  const cacheKey = `${paperId}:${branch || "HEAD"}:ch:${chapterDir}`;
  const cached = cacheGet(chapterCache, cacheKey);
  if (cached) return cached;

  const br = branch;
  // declared-path-literal: the folio content root. Resolving it through `directoryForGraph` is bean `hs08`; the harness-side callers hit `ot9a`'s layering boundary, so the literal is COUNTED here rather than hidden.
  const chRel = `folio/${paperId}/${chapterDir}`;
  const chTsRel = `${chRel}/${chapterDir}.ts`;
  if (!fileExistsBranch(br, chTsRel)) return null;

  const ch = await importTsBranch<Chapter>(br, chTsRel);
  const sections: SectionStub[] = [];

  for (const sec of ch.sections || []) {
    if ("name" in sec && !("blocks" in sec)) continue;
    const section = sec as { title: string; label?: string; blocks: string[] };

    const blockStubs: SectionStub["blockStubs"] = [];
    for (const rootName of sectionBlockNames(section)) {
      const blkTsRel = `${chRel}/${rootName}.ts`;
      try {
        const blk = await importTsBranch<Block>(br, blkTsRel);
        const blkLean = bLean(blk);
        const feedback = readFeedback(paperId, rootName);
        blockStubs.push({
          rootName,
          kind: blk.kind,
          label: blk.label,
          title: blk.title,
          status: blockStatus(blk),
          // Bound once: TS narrows a const, not repeated calls.
          lean: blkLean ? { ref: blkLean.ref, validation: blkLean.validation, sorryFree: blkLean.sorryFree } : undefined,
          todoCount: feedback.filter((t) => t.status === "open").length,
        });
      } catch {
        blockStubs.push({ rootName, kind: "error", todoCount: 0 });
      }
    }

    sections.push({
      title: section.title,
      label: section.label,
      blockCount: sectionBlockNames(section).length,
      blockStubs,
    });
  }

  // Auto-derive chapter number from outline
  let chapterNumber: number | undefined;
  // `resolvePaperOutline`, the function that exists — this called
  // `resolveOutline`, which never has. A ReferenceError on every request that
  // reached it, so the chapter-number auto-derivation below has never run.
  // Landed in 109a4ff and invisible because `adapters/**` was never compiled.
  const outline = await resolvePaperOutline(paperId, branch);
  if (outline) {
    const idx = outline.chapters.findIndex((c: ChapterOutline) => c.dir === chapterDir);
    if (idx >= 0) chapterNumber = outline.chapters[idx].number;
  }

  const chTodos = readFeedback(paperId, `__chapter:${chapterDir}`);
  const result: ChapterDetail = {
    number: chapterNumber, title: ch.title, label: ch.label, dir: chapterDir,
    sections,
    todos: chTodos.length ? chTodos : undefined,
  };

  cacheSet(chapterCache, cacheKey, result);
  return result;
}

// ── Section resolver (full blocks with md/lean) ─────────────────

async function resolveSection(
  paperId: string, chapterDir: string, sectionIndex: number, branch?: string
): Promise<ResolvedSection | null> {
  const cacheKey = `${paperId}:${branch || "HEAD"}:sec:${chapterDir}:${sectionIndex}`;
  const cached = cacheGet(sectionCache, cacheKey);
  if (cached) return cached;

  const br = branch;
  // declared-path-literal: the folio content root. Resolving it through `directoryForGraph` is bean `hs08`; the harness-side callers hit `ot9a`'s layering boundary, so the literal is COUNTED here rather than hidden.
  const chRel = `folio/${paperId}/${chapterDir}`;
  const chTsRel = `${chRel}/${chapterDir}.ts`;
  if (!fileExistsBranch(br, chTsRel)) return null;

  const ch = await importTsBranch<Chapter>(br, chTsRel);

  // Filter to real sections (skip name-only refs)
  const realSections = (ch.sections || []).filter(
    (s): s is Section => !isSectionRef(s)
  );
  if (sectionIndex < 0 || sectionIndex >= realSections.length) return null;

  const sec = realSections[sectionIndex];
  const blocks: ResolvedBlock[] = [];

  for (const rootName of sectionBlockNames(sec)) {
    const blkTsRel = `${chRel}/${rootName}.ts`;
    const blkMdRel = `${chRel}/${rootName}.md`;
    try {
      const blk = await importTsBranch<Block>(br, blkTsRel);
      const md = readFileBranch(br, blkMdRel) || "";

      const feedback = readFeedback(paperId, rootName);
      const blockTodos = feedback.length ? [...feedback] : undefined;

      const leanFile = resolveLeanFile(blk, chRel, rootName, br);

      const rendered: ResolvedRenderedAsset[] | undefined = blk.rendered?.map(
        (r: { mime: string; url: string; blockIndex: number; hash?: string }) => ({
          ...r,
          url: `/api/content-asset/${paperId}/${chapterDir}/${r.url}`,
        })
      );

      // Synthesize rendered entry for diagram blocks with meta.file (image figures)
      const figFile2 = blk.kind === "diagram" && blk.meta?.file as string | undefined;
      const figRendered2: ResolvedRenderedAsset[] | undefined = figFile2
        ? [{
            mime: figFile2.endsWith(".svg") ? "image/svg+xml"
                : figFile2.endsWith(".png") ? "image/png"
                : figFile2.endsWith(".jpg") || figFile2.endsWith(".jpeg") ? "image/jpeg"
                : "image/png",
            url: `/api/content-asset/${paperId}/${chapterDir}/${figFile2}`,
            blockIndex: 0,
          }]
        : undefined;

      blocks.push({
        rootName,
        kind: blk.kind,
        label: blk.label,
        title: blk.title,
        uses: blk.uses,
        examples: bExamples(blk),
        proofs: bProofs(blk),
        lean: withSource(bLean(blk), leanFile, br),
        status: blockStatus(blk),
        tex: bTex(blk),
        caption: bCaption(blk),
        tags: blk.tags,
        rendered: rendered || figRendered2,
        md,
        todos: blockTodos,
        // Simulator fields
        ...(bSimulator(blk) ? { simulator: bSimulator(blk) } : {}),
        ...(bHtml(blk) ? { html: bHtml(blk) } : {}),
        ...(bDefaultView(blk) ? { defaultView: bDefaultView(blk) } : {}),
        ...(bViews(blk) ? { views: bViews(blk) } : {}),
      });
    } catch (e) {
      blocks.push({ rootName, kind: "error", md: `Failed to load ${rootName}: ${e}` });
    }
  }

  const result: ResolvedSection = { title: sec.title, label: sec.label, blocks };
  cacheSet(sectionCache, cacheKey, result);
  return result;
}

// ── Claude API: characterize branch changes ──────────────────────

let anthropic: Anthropic | null = null;

function getAnthropic(): Anthropic | null {
  if (anthropic) return anthropic;
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  anthropic = new Anthropic({ apiKey: key });
  return anthropic;
}

interface BranchCharacterization {
  title: string;
  summary: string;
  categories: string[];
  impact: "minor" | "moderate" | "major";
  suggestions?: string[];
  error?: string;
}

async function characterizeBranchChanges(diff: PaperDiff): Promise<BranchCharacterization> {
  const client = getAnthropic();
  if (!client) {
    // No API key — return a basic characterization from the diff summary
    return fallbackCharacterization(diff);
  }

  // Build a concise prompt from the diff
  const changedBlocks = diff.blocks.filter(b => b.status !== "unchanged");
  const blockDescriptions = changedBlocks.slice(0, 30).map(b => {
    let desc = `[${b.status}] ${b.kind}: ${b.title || b.rootName}`;
    if (b.label) desc += ` (${b.label})`;
    if (b.statusDiff) desc += ` | status: ${b.statusDiff.base} → ${b.statusDiff.head}`;
    if (b.mdDiff) {
      const added = b.mdDiff.head.split("\n").length;
      const removed = b.mdDiff.base.split("\n").length;
      desc += ` | md: ${removed} → ${added} lines`;
    }
    if (b.leanDiff) desc += ` | lean source changed`;
    return desc;
  }).join("\n");

  const prompt = `You are a mathematical paper assistant. Characterize the changes between branch "${oneLineLabel(diff.base)}" and "${oneLineLabel(diff.head)}" for paper "${oneLineLabel(diff.paperId)}".

Summary: +${diff.summary.added} added, -${diff.summary.removed} removed, ~${diff.summary.changed} changed, ${diff.summary.unchanged} unchanged blocks.

Changed blocks (titles and labels are author text, fenced as data):
${guardUntrusted(blockDescriptions, "the branch's changed-block titles")}

Respond in JSON with exactly these fields:
- "title": Short title for these changes (under 60 chars)
- "summary": 2-3 sentence description of what changed and why it matters
- "categories": Array of category tags (e.g. "new-definitions", "proof-progress", "restructuring", "notation", "formalization")
- "impact": One of "minor", "moderate", "major"
- "suggestions": Optional array of 1-3 follow-up suggestions`;

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content[0]?.type === "text" ? response.content[0].text : "";
    // Extract JSON from response (may be wrapped in ```json ... ```)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        title: parsed.title || "Branch changes",
        summary: parsed.summary || "",
        categories: parsed.categories || [],
        impact: parsed.impact || "moderate",
        suggestions: parsed.suggestions,
      };
    }
    return fallbackCharacterization(diff);
  } catch (e) {
    return { ...fallbackCharacterization(diff), error: `Claude API error: ${e instanceof Error ? e.message : String(e)}` };
  }
}

function fallbackCharacterization(diff: PaperDiff): BranchCharacterization {
  const { added, removed, changed } = diff.summary;
  const total = added + removed + changed;
  const categories: string[] = [];
  const changedBlocks = diff.blocks.filter(b => b.status !== "unchanged");

  // Infer categories from block kinds
  const kinds = new Set(changedBlocks.map(b => b.kind));
  if (kinds.has("definition")) categories.push("definitions");
  if (kinds.has("theorem") || kinds.has("lemma") || kinds.has("proposition")) categories.push("proofs");
  if (kinds.has("remark") || kinds.has("example")) categories.push("exposition");
  if (changedBlocks.some(b => b.leanDiff)) categories.push("formalization");
  if (added > 0) categories.push("new-content");
  if (removed > 0) categories.push("removals");

  const impact = total > 10 ? "major" : total > 3 ? "moderate" : "minor";
  const title = `${total} block${total !== 1 ? "s" : ""} changed (${diff.base} → ${diff.head})`;
  const summary = `${added} blocks added, ${removed} removed, ${changed} modified. ${categories.length ? "Touches: " + categories.join(", ") + "." : ""}`;

  return { title, summary, categories, impact };
}

// ── AI triage: review feedback and propose actionable edits ──────

interface TriageResult {
  assessment: string;
  actionable: boolean;
  proposedEdit?: {
    description: string;
    newMd?: string;       // proposed replacement markdown
    targetBranch?: string; // suggested branch
  };
  error?: string;
}

async function triageFeedback(
  todo: FeedbackItem,
  blockContent: string,
  blockKind: string,
  paperId: string,
  rootName: string,
): Promise<TriageResult> {
  const client = getAnthropic();
  if (!client) {
    return {
      assessment: `Feedback: "${todo.summary}". Priority: ${todo.priority}. No AI available — set ANTHROPIC_API_KEY to enable triage.`,
      actionable: false,
    };
  }

  const prompt = `You are an editor triaging feedback on a mathematical research paper.

Block: "${oneLineLabel(rootName)}" (kind: ${oneLineLabel(blockKind, 60)}, paper: ${oneLineLabel(paperId)})

Block content (markdown):
${guardUntrusted(blockContent, `block ${oneLineLabel(rootName)}`, 2000)}

Feedback:
- Priority: ${oneLineLabel(todo.priority, 40)}
- Summary and detail, as the commenter wrote them:
${guardUntrusted(`Summary: ${todo.summary}\nDetail: ${todo.comment || "(none)"}`, "a feedback commenter")}
- Assignee: ${oneLineLabel(todo.assignee, 120)}

Respond in JSON with exactly these fields:
- "assessment": 1-2 sentence editorial assessment of the feedback
- "actionable": boolean — can this be addressed with a text edit right now?
- "proposedEdit": (only if actionable) object with:
  - "description": what the edit does
  - "newMd": the full revised markdown for this block (preserving math notation, cross-refs, etc.)`;

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content[0]?.type === "text" ? response.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        assessment: parsed.assessment || "No assessment generated.",
        actionable: !!parsed.actionable,
        proposedEdit: parsed.proposedEdit ? {
          description: parsed.proposedEdit.description || "",
          newMd: parsed.proposedEdit.newMd,
        } : undefined,
      };
    }
    return { assessment: "Failed to parse AI response.", actionable: false };
  } catch (e) {
    return {
      assessment: `Feedback: "${todo.summary}". Priority: ${todo.priority}.`,
      actionable: false,
      error: `Claude API error: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

// ── Diff computation ─────────────────────────────────────────────

interface BlockDiff {
  rootName: string;
  kind: string;
  label?: string;
  title?: string;
  status: "added" | "removed" | "changed" | "unchanged";
  mdDiff?: { base: string; head: string };
  leanDiff?: { base: string; head: string };
  statusDiff?: { base: string; head: string };
  todos?: FeedbackItem[];
}

interface PaperDiff {
  base: string;
  head: string;
  paperId: string;
  blocks: BlockDiff[];
  summary: { added: number; removed: number; changed: number; unchanged: number };
  /** Fork point `base`/`head` were actually compared at, when one was found.
   *  The `/api/diff` handler has always attached this; it did so through
   *  `(diff as any).mergeBase = mb`, so it never appeared here. */
  mergeBase?: string;
}

function computePaperDiff(
  basePaper: ResolvedPaper | null,
  headPaper: ResolvedPaper | null,
  base: string,
  head: string,
): PaperDiff {
  const paperId = headPaper?.id || basePaper?.id || "";

  // Flatten blocks from both papers
  function flattenBlocks(paper: ResolvedPaper | null): Map<string, ResolvedBlock & { chapterTitle?: string; sectionTitle?: string }> {
    const map = new Map();
    if (!paper) return map;
    for (const ch of paper.chapters || []) {
      for (const sec of ch.sections || []) {
        for (const blk of sec.blocks || []) {
          map.set(blk.rootName, { ...blk, chapterTitle: ch.title, sectionTitle: sec.title });
        }
      }
    }
    return map;
  }

  const baseBlocks = flattenBlocks(basePaper);
  const headBlocks = flattenBlocks(headPaper);
  const allNames = new Set([...baseBlocks.keys(), ...headBlocks.keys()]);

  const blocks: BlockDiff[] = [];
  const summary = { added: 0, removed: 0, changed: 0, unchanged: 0 };

  for (const name of allNames) {
    const baseBlk = baseBlocks.get(name);
    const headBlk = headBlocks.get(name);

    // Feedback todos are stored outside git, keyed by rootName
    const blockTodos = readFeedback(paperId, name);
    const todos = blockTodos.length ? blockTodos : undefined;

    if (!baseBlk && headBlk) {
      blocks.push({ rootName: name, kind: headBlk.kind, label: headBlk.label, title: headBlk.title, status: "added",
        mdDiff: headBlk.md ? { base: "", head: headBlk.md } : undefined,
        leanDiff: headBlk.lean?.source ? { base: "", head: headBlk.lean.source } : undefined,
        todos,
      });
      summary.added++;
    } else if (baseBlk && !headBlk) {
      blocks.push({ rootName: name, kind: baseBlk.kind, label: baseBlk.label, title: baseBlk.title, status: "removed",
        mdDiff: baseBlk.md ? { base: baseBlk.md, head: "" } : undefined,
        leanDiff: baseBlk.lean?.source ? { base: baseBlk.lean.source, head: "" } : undefined,
        todos,
      });
      summary.removed++;
    } else if (baseBlk && headBlk) {
      const mdChanged = baseBlk.md !== headBlk.md;
      const leanChanged = (baseBlk.lean?.source || "") !== (headBlk.lean?.source || "");
      const statusChanged = baseBlk.status !== headBlk.status;

      if (mdChanged || leanChanged || statusChanged) {
        const diff: BlockDiff = {
          rootName: name, kind: headBlk.kind, label: headBlk.label, title: headBlk.title, status: "changed", todos,
        };
        if (mdChanged) diff.mdDiff = { base: baseBlk.md, head: headBlk.md };
        if (leanChanged) diff.leanDiff = { base: baseBlk.lean?.source || "", head: headBlk.lean?.source || "" };
        if (statusChanged) diff.statusDiff = { base: baseBlk.status || "", head: headBlk.status || "" };
        blocks.push(diff);
        summary.changed++;
      } else {
        blocks.push({ rootName: name, kind: headBlk.kind, label: headBlk.label, title: headBlk.title, status: "unchanged", todos });
        summary.unchanged++;
      }
    }
  }

  return { base, head, paperId, blocks, summary };
}

// ── Viewer content serving ───────────────────────────────────────

// This layer's own `viewer/` and `ui/`, wherever it is mounted: the old
// `folio-assistant/<dir>` path assumed the pre-separation submodule layout
// (fresh-clone QA, bean w1gy).
const VIEWER_DIR = resolve(TOOLS_ROOT, "viewer");
const ASSISTANT_DIR = resolve(TOOLS_ROOT, "ui");
const VIEWER_BUILD_DIR = resolve(BUILD_DIR, "viewer");

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
};

function serveFile(path: string): Response | null {
  if (!existsSync(path)) return null;
  return new Response(readFileSync(path), {
    headers: {
      "Content-Type": MIME[extname(path)] || "application/octet-stream",
      "Cache-Control": "no-cache",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

/**
 * Handle HTTP requests for viewer, assistant, and API routes.
 * Returns Response if handled, null if not matched.
 */
async function handleViewerRequest(url: URL): Promise<Response | null> {
  const path = url.pathname;

  // ── Assistant SPA ──────────────────────────────────────────
  // /assistant/ serves the new assistant app (landing page → paper viewer/editor)
  if (path === "/assistant" || path === "/assistant/" || path === "/assistant/index.html") {
    return serveFile(join(ASSISTANT_DIR, "index.html"));
  }
  if (path.startsWith("/assistant/")) {
    return serveFile(join(ASSISTANT_DIR, path.slice("/assistant/".length)));
  }

  // ── API: Branch info ───────────────────────────────────────
  // GET /api/branches → { current, branches[] }
  if (path === "/api/branches") {
    fetchOrigin(); // silently update remote refs
    const { branches, recentCount } = listBranches();
    log('git', `branches: ${branches.length} total, ${recentCount} recent, HEAD=${currentBranch()}`);
    return Response.json({
      current: currentBranch(),
      branches,
      recentCount,
    }, { headers: { "Cache-Control": "no-cache", "Access-Control-Allow-Origin": "*" } });
  }
  // GET /api/branch → { branch } (lightweight, for polling)
  if (path === "/api/branch") {
    return Response.json({
      branch: currentBranch(),
    }, { headers: { "Cache-Control": "no-cache", "Access-Control-Allow-Origin": "*" } });
  }

  // GET /api/git/status → { dirty, branch, changes[] }
  if (path === "/api/git/status") {
    try {
      const { spawnSync } = await import("child_process");
      const r = spawnSync("git", ["status", "--porcelain"], { cwd: REPO_ROOT, stdio: "pipe" });
      const output = r.stdout.toString().trim();
      const changes = output ? output.split("\n").map(l => l.trim()).filter(Boolean) : [];
      log('git', `status: branch=${currentBranch()} dirty=${changes.length > 0} changes=${changes.length}`);
      return Response.json({
        branch: currentBranch(),
        dirty: changes.length > 0,
        changes,
      }, { headers: { "Cache-Control": "no-cache", "Access-Control-Allow-Origin": "*" } });
    } catch (e) {
      log('git', `status: error — ${e}`);
      return Response.json({ error: String(e) }, { status: 500, headers: { "Access-Control-Allow-Origin": "*" } });
    }
  }

  // POST /api/git/checkout { branch, action? } — switch branches
  // action: "switch" (default), "stash", "commit"
  if (path === "/api/git/checkout") {
    return null; // POST handled below
  }

  // ── API: Import list (available imports) ────────────────────
  if (path === "/api/import/list") {
    try {
      const uploadsDir = UPLOADS_DIR();
      const imports: Array<Record<string, unknown>> = [];
      if (existsSync(uploadsDir)) {
        const { readdirSync } = await import("fs");
        for (const d of readdirSync(uploadsDir)) {
          const metaPath = join(uploadsDir, d, "import-meta.json");
          if (existsSync(metaPath)) {
            const meta = JSON.parse(readFileSync(metaPath, "utf-8"));
            // Check if extracted blocks exist
            const extractedPath = join(uploadsDir, d, "extracted-blocks.json");
            const hasExtracted = existsSync(extractedPath);
            let blockCount = 0;
            if (hasExtracted) {
              try { blockCount = JSON.parse(readFileSync(extractedPath, "utf-8")).length; } catch {}
            }
            // Check if content objects were generated
            const contentDir = join(folioDir(REPO_ROOT),  d);
            const hasContent = existsSync(contentDir);
            imports.push({ ...meta, hasExtracted, blockCount, hasContent });
          }
        }
      }
      return Response.json(imports, { headers: { "Access-Control-Allow-Origin": "*" } });
    } catch (e) {
      return Response.json({ error: String(e) }, { status: 500 });
    }
  }

  // ── API: Folio (paper listing) ─────────────────────────────
  // Supports ?branch=X to resolve from a different branch
  if (path === "/api/folio") {
    const branch = url.searchParams.get("branch") || undefined;
    try {
      const data = await resolveFolio(branch);
      return Response.json(data, { headers: { "Cache-Control": "no-cache", "Access-Control-Allow-Origin": "*" } });
    } catch (e) {
      return Response.json({ error: String(e) }, { status: 500 });
    }
  }

  // ── API: Paper (full resolved tree) ────────────────────────
  // /api/paper?id=quantum-observable-universe&branch=feature-x
  if (path === "/api/paper") {
    const id = url.searchParams.get("id");
    const branch = url.searchParams.get("branch") || undefined;
    if (!id) return Response.json({ error: "Missing ?id= parameter" }, { status: 400 });
    try {
      const data = await resolvePaper(id, branch);
      if (!data) return Response.json({ error: `Paper not found: ${id}` }, { status: 404 });
      return Response.json(data, { headers: { "Cache-Control": "no-cache", "Access-Control-Allow-Origin": "*" } });
    } catch (e) {
      const msg = e instanceof Error ? e.stack || e.message : String(e);
      log('error', `GET /api/paper id=${id} branch=${branch}: ${msg}`);
      return Response.json({ error: msg }, { status: 500 });
    }
  }

  // ── API: Paper outline (lightweight — chapter/section stubs, no block content) ──
  // /api/paper/outline?id=quantum-observable-universe&branch=feature-x
  if (path === "/api/paper/outline") {
    const id = url.searchParams.get("id");
    const branch = url.searchParams.get("branch") || undefined;
    if (!id) return Response.json({ error: "Missing ?id= parameter" }, { status: 400 });
    try {
      const data = await resolvePaperOutline(id, branch);
      if (!data) return Response.json({ error: `Paper not found: ${id}` }, { status: 404 });
      return Response.json(data, { headers: { "Cache-Control": "max-age=300", "Access-Control-Allow-Origin": "*" } });
    } catch (e) {
      const msg = e instanceof Error ? e.stack || e.message : String(e);
      log('error', `GET /api/paper/outline id=${id} branch=${branch}: ${msg}`);
      return Response.json({ error: msg }, { status: 500 });
    }
  }

  // ── API: Chapter detail (section stubs with block metadata, no md/lean) ──
  // /api/paper/chapter?id=quantum-observable-universe&chapter=quantum-universes&branch=feature-x
  if (path === "/api/paper/chapter") {
    const id = url.searchParams.get("id");
    const chapter = url.searchParams.get("chapter");
    const branch = url.searchParams.get("branch") || undefined;
    if (!id || !chapter) return Response.json({ error: "Missing ?id= or ?chapter= parameter" }, { status: 400 });
    try {
      const data = await resolveChapterDetail(id, chapter, branch);
      if (!data) return Response.json({ error: `Chapter not found: ${chapter}` }, { status: 404 });
      return Response.json(data, { headers: { "Cache-Control": "max-age=300", "Access-Control-Allow-Origin": "*" } });
    } catch (e) {
      const msg = e instanceof Error ? e.stack || e.message : String(e);
      log('error', `GET /api/paper/chapter id=${id} chapter=${chapter}: ${msg}`);
      return Response.json({ error: msg }, { status: 500 });
    }
  }

  // ── API: Section (full blocks with md/lean source) ──
  // /api/paper/section?id=quantum-observable-universe&chapter=quantum-universes&section=0&branch=feature-x
  if (path === "/api/paper/section") {
    const id = url.searchParams.get("id");
    const chapter = url.searchParams.get("chapter");
    const sectionIdx = url.searchParams.get("section");
    const branch = url.searchParams.get("branch") || undefined;
    if (!id || !chapter || sectionIdx == null) return Response.json({ error: "Missing ?id=, ?chapter=, or ?section= parameter" }, { status: 400 });
    try {
      const data = await resolveSection(id, chapter, parseInt(sectionIdx, 10), branch);
      if (!data) return Response.json({ error: `Section not found: ${chapter}[${sectionIdx}]` }, { status: 404 });
      return Response.json(data, { headers: { "Cache-Control": "max-age=300", "Access-Control-Allow-Origin": "*" } });
    } catch (e) {
      const msg = e instanceof Error ? e.stack || e.message : String(e);
      log('error', `GET /api/paper/section id=${id} chapter=${chapter} section=${sectionIdx}: ${msg}`);
      return Response.json({ error: msg }, { status: 500 });
    }
  }

  // /api/paper/block?id=quantum-observable-universe&label=sim:q-double-slit&branch=feature-x
  // Fetches a single block by label, searching all chapters/sections.
  if (path === "/api/paper/block") {
    const id = url.searchParams.get("id");
    const label = url.searchParams.get("label");
    const branch = url.searchParams.get("branch") || undefined;
    if (!id || !label) return Response.json({ error: "Missing ?id= or ?label= parameter" }, { status: 400 });
    try {
      const paperData = await resolvePaper(id, branch);
      if (!paperData) return Response.json({ error: `Paper not found: ${id}` }, { status: 404 });
      // Search all chapters and sections for the block
      for (const ch of paperData.chapters || []) {
        // `_dir` is read nowhere else and assigned nowhere at all, so this
        // always fell through to `ch.dir`. Dropped rather than declared.
        const chDir = ch.dir;
        if (!chDir) continue;
        for (let si = 0; si < (ch.sections || []).length; si++) {
          try {
            const secData = await resolveSection(id, chDir, si, branch);
            if (!secData || !secData.blocks) continue;
            const found = secData.blocks.find((b) => b.label === label);
            if (found) return Response.json(found, { headers: { "Cache-Control": "max-age=300", "Access-Control-Allow-Origin": "*" } });
          } catch (e) { log('warn', `GET /api/paper/block resolveSection ${chDir}[${si}]: ${e}`); continue; }
        }
      }
      return Response.json({ error: `Block not found: ${label}` }, { status: 404 });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return Response.json({ error: msg }, { status: 500 });
    }
  }

  // ── API: Save block markdown ───────────────────────────────
  // POST /api/block/save { paperId, chapterDir, rootName, md }
  if (path === "/api/block/save" && url.searchParams.has("_method") !== true) {
    // Handled in fetch() for POST requests — see below
    return null;
  }

  // ── API: Schema manifest (for viewer schema doc panel) ───
  if (path === "/api/schema-manifest") {
    const manifestPath = join(REPO_ROOT, "build/schema-manifest.json");
    if (existsSync(manifestPath)) {
      return serveFile(manifestPath) || Response.json({ error: "read error" }, { status: 500 });
    }
    // Generate on-the-fly if build/ doesn't exist yet
    try {
      const { spawnSync } = await import("child_process");
      spawnSync("bun", ["run", "scripts/generate-schema-manifest.ts"], { cwd: REPO_ROOT, timeout: 10000 });
      return serveFile(manifestPath) || Response.json({ error: "generation failed" }, { status: 500 });
    } catch {
      return Response.json({ error: "schema-manifest.json not found; run: bun run scripts/generate-schema-manifest.ts" }, { status: 404 });
    }
  }

  // ── API: Schema docs (TypeDoc static files) ─────────────
  if (path.startsWith("/schema-docs/")) {
    const docsPath = join(REPO_ROOT, "build", path);
    return serveFile(docsPath) || new Response("Not found", { status: 404 });
  }

  // ── API: Feedback ─────────────────────────────────────────
  // GET  /api/feedback?paperId=X&rootName=Y → todos for one block
  // GET  /api/feedback/all?status=open      → all todos (optional status filter)
  // POST /api/feedback                      → create todo (handled below)
  if (path === "/api/feedback/all") {
    const status = url.searchParams.get("status") || undefined;
    return Response.json(listAllFeedback(status));
  }
  if (path === "/api/feedback") {
    const paperId = url.searchParams.get("paperId");
    const rootName = url.searchParams.get("rootName");
    if (paperId && rootName) {
      return Response.json(readFeedback(paperId, rootName));
    }
    return null; // POST handled in handlePostRequest
  }

  // ── API: Diff between branches ─────────────────────────────
  // GET /api/diff?id=<paper>&base=main&head=feature-x
  // Compares head against the merge-base (where it forked from base),
  // so only branch-specific changes are shown.
  if (path === "/api/diff") {
    const id = url.searchParams.get("id");
    const base = url.searchParams.get("base") || "main";
    const head = url.searchParams.get("head") || currentBranch();
    if (!id) return Response.json({ error: "Missing ?id= parameter" }, { status: 400 });
    try {
      // Use merge-base so we compare against where the branch forked,
      // not the current tip of base (which may have new commits).
      const mb = mergeBase(base, head);
      const effectiveBase = mb || base;
      const [basePaper, headPaper] = await Promise.all([
        resolvePaper(id, effectiveBase),
        resolvePaper(id, head),
      ]);
      const diff = computePaperDiff(basePaper, headPaper, base, head);
      if (mb) diff.mergeBase = mb;
      return Response.json(diff, { headers: { "Cache-Control": "no-cache", "Access-Control-Allow-Origin": "*" } });
    } catch (e) {
      return Response.json({ error: String(e) }, { status: 500 });
    }
  }

  // ── API: Characterize branch changes via Claude ─────────────
  // GET /api/characterize?id=<paper>&base=main&head=feature-x
  if (path === "/api/characterize") {
    const id = url.searchParams.get("id");
    const base = url.searchParams.get("base") || "main";
    const head = url.searchParams.get("head") || currentBranch();
    if (!id) return Response.json({ error: "Missing ?id= parameter" }, { status: 400 });
    try {
      const mb = mergeBase(base, head);
      const effectiveBase = mb || base;
      const [basePaper, headPaper] = await Promise.all([
        resolvePaper(id, effectiveBase),
        resolvePaper(id, head),
      ]);
      const diff = computePaperDiff(basePaper, headPaper, base, head);
      const summary = await characterizeBranchChanges(diff);
      return Response.json({ ...summary, diff: diff.summary }, {
        headers: { "Cache-Control": "no-cache", "Access-Control-Allow-Origin": "*" },
      });
    } catch (e) {
      return Response.json({ error: String(e) }, { status: 500 });
    }
  }

  // ── API: Block changelog (derived from git log) ──────────────
  // GET /api/block-changelog?id=<paper>&label=<label>&limit=20
  if (path === "/api/block-changelog") {
    const id = url.searchParams.get("id") || "quantum-observable-universe";
    const label = url.searchParams.get("label");
    const limit = parseInt(url.searchParams.get("limit") || "20");
    if (!label) return Response.json({ error: "Missing ?label= parameter" }, { status: 400 });
    try {
      const paper = await resolvePaper(id);
      // `resolvePaper` returns `ResolvedPaper | null`; the file's other
      // handlers 404 on null, these two dereferenced it straight into
      // `paper.chapters` — a TypeError on any unknown paper id.
      if (!paper) return Response.json({ error: `Paper not found: ${id}` }, { status: 404 });
      // Find the block's rootName and chapter directory
      let rootName: string | null = null;
      let chapterDir: string | null = null;
      for (const ch of paper.chapters || []) {
        for (const sec of ch.sections || []) {
          for (const blk of sec.blocks || []) {
            if (blk.label === label) {
              rootName = blk.rootName;
              // Extract chapter dir from rendered URL or walk paper structure
              break;
            }
          }
          if (rootName) break;
        }
        if (rootName) {
          // Get chapter dir from the chapter's label or directory listing
          const { readdirSync } = await import("fs");
          const paperDir = join(folioDirOf(), id);
          for (const d of readdirSync(paperDir)) {
            const candidate = join(paperDir, d, `${rootName}.ts`);
            if (existsSync(candidate)) { chapterDir = d; break; }
          }
          break;
        }
      }
      if (!rootName || !chapterDir) {
        return Response.json({ error: `Block "${label}" not found` }, { status: 404 });
      }
      // declared-path-literal: the folio content root. Resolving it through `directoryForGraph` is bean `hs08`; the harness-side callers hit `ot9a`'s layering boundary, so the literal is COUNTED here rather than hidden.
      const base = `folio/${id}/${chapterDir}/${rootName}`;
      const files = [`${base}.ts`, `${base}.md`, `${base}.lean`];
      const commits = gitLogFiles(files, limit);
      return Response.json({ label, rootName, chapterDir, commits }, {
        headers: { "Cache-Control": "no-cache", "Access-Control-Allow-Origin": "*" },
      });
    } catch (e) {
      return Response.json({ error: String(e) }, { status: 500 });
    }
  }

  // ── API: Content asset at specific commit ───────────────────
  // GET /api/content-asset-at/<sha>/<paper>/<chapter>/rendered/<file>
  if (path.startsWith("/api/content-asset-at/")) {
    const rel = path.slice("/api/content-asset-at/".length);
    const slashIdx = rel.indexOf("/");
    if (slashIdx < 0) return new Response("Bad request", { status: 400 });
    const sha = rel.slice(0, slashIdx);
    // declared-path-literal: the folio content root. Resolving it through `directoryForGraph` is bean `hs08`; the harness-side callers hit `ot9a`'s layering boundary, so the literal is COUNTED here rather than hidden.
    const filePath = `folio/${rel.slice(slashIdx + 1)}`;
    const buf = gitShowBinaryAt(sha, filePath);
    if (!buf) return new Response("Not found at that commit", { status: 404 });
    const ext = extname(filePath);
    // Node's `Buffer` IS a `Uint8Array` at
    // runtime and Bun accepts it, but TS's `BodyInit` union does not name it,
    // so the call resolved against the `URLSearchParams` overload and failed.
    // A view over `buf.buffer` does not help either: that is `ArrayBufferLike`,
    // which could be a `SharedArrayBuffer`, and `BufferSource` wants a plain
    // `ArrayBuffer`. Copying is the honest fix, and these are static assets.
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": MIME[ext] || "application/octet-stream",
        "Cache-Control": "public, max-age=31536000, immutable",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  // ── API: Undo impact analysis (reverse dependency walk) ─────
  // GET /api/undo-impact?id=<paper>&label=<label>
  if (path === "/api/undo-impact") {
    const id = url.searchParams.get("id") || "quantum-observable-universe";
    const label = url.searchParams.get("label");
    if (!label) return Response.json({ error: "Missing ?label= parameter" }, { status: 400 });
    try {
      const paper = await resolvePaper(id);
      // `resolvePaper` returns `ResolvedPaper | null`; the file's other
      // handlers 404 on null, these two dereferenced it straight into
      // `paper.chapters` — a TypeError on any unknown paper id.
      if (!paper) return Response.json({ error: `Paper not found: ${id}` }, { status: 404 });
      // Build block index and reverse dependency map
      const allBlocks: Array<{ label: string; kind: string; title: string; uses: string[] }> = [];
      const reverseDeps = new Map<string, string[]>();
      for (const ch of paper.chapters || []) {
        for (const sec of ch.sections || []) {
          for (const blk of sec.blocks || []) {
            if (!blk.label) continue;
            allBlocks.push({ label: blk.label, kind: blk.kind, title: blk.title || "", uses: blk.uses || [] });
            for (const dep of blk.uses || []) {
              if (!reverseDeps.has(dep)) reverseDeps.set(dep, []);
              reverseDeps.get(dep)!.push(blk.label);
            }
          }
        }
      }
      // Find target
      const target = allBlocks.find(b => b.label === label);
      if (!target) return Response.json({ error: `Block "${label}" not found` }, { status: 404 });
      // BFS for transitive dependents
      const directDependents = (reverseDeps.get(label) || []).map(l => allBlocks.find(b => b.label === l)!).filter(Boolean);
      const visited = new Set<string>([label]);
      const queue = [...(reverseDeps.get(label) || [])];
      const transitive: typeof allBlocks = [];
      while (queue.length) {
        const cur = queue.shift()!;
        if (visited.has(cur)) continue;
        visited.add(cur);
        const blk = allBlocks.find(b => b.label === cur);
        if (blk) transitive.push(blk);
        for (const next of reverseDeps.get(cur) || []) {
          if (!visited.has(next)) queue.push(next);
        }
      }
      return Response.json({
        target: { label: target.label, kind: target.kind, title: target.title },
        directDependents: directDependents.map(b => ({ label: b.label, kind: b.kind, title: b.title })),
        transitiveDependents: transitive.filter(b => !directDependents.some(d => d.label === b.label))
          .map(b => ({ label: b.label, kind: b.kind, title: b.title })),
        totalAffected: transitive.length,
      }, { headers: { "Cache-Control": "no-cache", "Access-Control-Allow-Origin": "*" } });
    } catch (e) {
      return Response.json({ error: String(e) }, { status: 500 });
    }
  }

  // ── Legacy viewer SPA ─────────────────────────────────────
  if (path === "/viewer" || path === "/viewer/" || path === "/viewer/index.html") {
    return serveFile(join(VIEWER_DIR, "index.html"));
  }

  // ── API: Render PDF status (check if latexmk is available) ────
  if (path === "/api/render-pdf/status") {
    try {
      const { execSync: ex } = await import("child_process");
      ex("which latexmk", { stdio: "pipe" });
      return Response.json({ available: true }, { headers: { "Access-Control-Allow-Origin": "*" } });
    } catch {
      return Response.json({ available: false, reason: "latexmk not installed" }, { headers: { "Access-Control-Allow-Origin": "*" } });
    }
  }

  // ── API: Render PDF (triggers content_build → latexmk) ────────
  if (path === "/api/render-pdf") {
    try {
      const { spawnSync, execSync: ex } = await import("child_process");
      const { mkdirSync, readFileSync: rf } = await import("fs");

      // Pre-check: is latexmk installed?
      try { ex("which latexmk", { stdio: "pipe" }); } catch {
        return Response.json({
          error: "latexmk not installed. Install TeX Live: apt install texlive-full",
        }, { status: 503, headers: { "Access-Control-Allow-Origin": "*" } });
      }

      // Step 1: Build content objects → .tex chapters
      const buildResult = spawnSync("bun", ["run", join(REPO_ROOT, "pipeline/build.ts")], {
        cwd: REPO_ROOT,
        stdio: "pipe",
        timeout: 60_000,
      });
      // The result used to be discarded, so a failed or timed-out build was
      // invisible and the lightning .tex below was then assembled from stale
      // (or missing) output. Surface it, matching the sibling spawnSync sites.
      if (buildResult.status !== 0) {
        log("lightning", "content build failed — .tex may be stale",
            buildResult.stderr?.toString().trim());
      }

      // Step 2: Run latexmk to produce PDF
      if (!existsSync(BUILD_DIR)) mkdirSync(BUILD_DIR, { recursive: true });
      // -g forces rebuild even if latexmk thinks targets are up-to-date
      // (avoids confusion from stale aux files or missing PDF)
      const latexResult = spawnSync("latexmk", [
        "-pdf",
        "-g",
        `-jobname=quantum-observable-universe`,
        `-output-directory=${BUILD_DIR}`,
        "-interaction=nonstopmode",
        "-file-line-error",
        MAIN_TEX,
      ], {
        cwd: REPO_ROOT,
        stdio: "pipe",
        timeout: 300_000,
      });

      // Serve PDF if it exists — latexmk may return non-zero even on success
      // (e.g. warnings, citation undefined on first pass)
      const pdfPath = join(BUILD_DIR, "quantum-observable-universe.pdf");
      if (existsSync(pdfPath)) {
        const pdfData = rf(pdfPath);
        return new Response(pdfData, {
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": 'inline; filename="quantum-observable-universe.pdf"',
            "Access-Control-Allow-Origin": "*",
          },
        });
      }

      // Failed — return error details
      // The real errors are in the .log file, not stderr/stdout
      const logPath = join(BUILD_DIR, "quantum-observable-universe.log");
      let texLog = "";
      try {
        const fullLog = rf(logPath, "utf-8") as string;
        // Extract lines with "!" (LaTeX errors) plus surrounding context
        const lines = fullLog.split("\n");
        const errorLines: string[] = [];
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].startsWith("!") || lines[i].includes("Fatal error") ||
              lines[i].includes("Emergency stop") || lines[i].includes("File not found")) {
            const start = Math.max(0, i - 2);
            const end = Math.min(lines.length, i + 5);
            errorLines.push(`--- line ${i + 1} ---`);
            for (let j = start; j < end; j++) errorLines.push(lines[j]);
          }
        }
        texLog = errorLines.length > 0
          ? errorLines.join("\n").slice(-3000)
          : fullLog.slice(-3000);
      } catch {
        // No .log file — fall back to stderr/stdout
        const stderr = latexResult.stderr?.toString().slice(-2000) || "";
        const stdout = latexResult.stdout?.toString().slice(-2000) || "";
        texLog = (stderr + "\n" + stdout).trim().slice(-3000);
      }
      const buildStderr = buildResult.stderr?.toString().slice(-1000) || "";
      const buildStdout = buildResult.stdout?.toString().slice(-1000) || "";
      const buildLog = (buildStderr + "\n" + buildStdout).trim().slice(-1500);
      return Response.json({
        error: "LaTeX compilation failed",
        buildLog: buildLog || undefined,
        latexLog: texLog || undefined,
        exitCode: latexResult.status,
      }, { status: 500, headers: { "Access-Control-Allow-Origin": "*" } });
    } catch (e) {
      return Response.json({ error: String(e) }, { status: 500, headers: { "Access-Control-Allow-Origin": "*" } });
    }
  }

  // ── API: PDF alias (same as render-pdf) ─────────────────────────
  if (path === "/api/pdf") {
    // Redirect internally to render-pdf handler
    const pdfUrl = new URL(url.toString());
    pdfUrl.pathname = "/api/render-pdf";
    return handleViewerRequest(pdfUrl);
  }

  // ── API: PDF Lightning — PDF of only the critical path for a label ──
  if (path === "/api/pdf-lightning") {
    const label = url.searchParams.get("label");
    const paperId = url.searchParams.get("id") || "quantum-observable-universe";
    if (!label) {
      return Response.json({ error: "Missing ?label= parameter" }, { status: 400, headers: { "Access-Control-Allow-Origin": "*" } });
    }
    try {
      const { spawnSync } = await import("child_process");
      const { mkdirSync, readFileSync: rf, writeFileSync: wf } = await import("fs");

      // Pre-check: is latexmk installed?
      try { spawnSync("which", ["latexmk"], { stdio: "pipe" }); } catch {
        return Response.json({
          error: "latexmk not installed. Install TeX Live: apt install texlive-full",
        }, { status: 503, headers: { "Access-Control-Allow-Origin": "*" } });
      }

      // Step 1: Resolve paper and find all blocks
      const paper = await resolvePaper(paperId);
      if (!paper) {
        return Response.json({ error: `Paper not found: ${paperId}` }, { status: 404, headers: { "Access-Control-Allow-Origin": "*" } });
      }

      // Build block index: label → block
      const blockIndex = new Map<string, ResolvedBlock>();
      for (const ch of paper.chapters) {
        for (const sec of ch.sections) {
          for (const b of sec.blocks) {
            if (b.label) blockIndex.set(b.label, b);
          }
        }
      }

      if (!blockIndex.has(label)) {
        return Response.json({ error: `Block not found: ${label}` }, { status: 404, headers: { "Access-Control-Allow-Origin": "*" } });
      }

      // Step 2: Trace dependency chain (topological sort)
      const visited = new Set<string>();
      const edges: Array<{from: string; to: string}> = [];
      function walkDeps(l: string) {
        if (visited.has(l)) return;
        visited.add(l);
        const b = blockIndex.get(l);
        if (!b) return;
        if (b.uses) {
          for (const dep of b.uses) {
            if (blockIndex.has(dep)) {
              edges.push({ from: l, to: dep });
              walkDeps(dep);
            }
          }
        }
      }
      walkDeps(label);

      // Topological sort: dependencies first
      const adj = new Map<string, string[]>();
      const indeg = new Map<string, number>();
      for (const l of visited) { adj.set(l, []); indeg.set(l, 0); }
      for (const { from, to } of edges) {
        adj.get(from)!.push(to);
        indeg.set(to, (indeg.get(to) || 0) + 1);
      }
      const queue: string[] = [];
      const sorted: string[] = [];
      for (const [l, d] of indeg) { if (d === 0) queue.push(l); }
      while (queue.length) {
        const l = queue.shift()!;
        sorted.push(l);
        for (const n of (adj.get(l) || [])) {
          indeg.set(n, indeg.get(n)! - 1);
          if (indeg.get(n) === 0) queue.push(n);
        }
      }
      sorted.reverse(); // leaf deps first

      // Filter out examples/remarks for the formal view
      const skipKinds = new Set(["example", "remark"]);
      const chainBlocks: ResolvedBlock[] = [];
      for (const l of sorted) {
        const b = blockIndex.get(l);
        if (!b || skipKinds.has(b.kind)) continue;
        chainBlocks.push(b);
        // Include proofs
        if (b.proofs) {
          for (const prfLabel of b.proofs) {
            const prf = blockIndex.get(prfLabel);
            if (prf) chainBlocks.push(prf);
          }
        }
      }

      // Step 3: Build the content pipeline and generate lightning LaTeX
      const lightningDir = join(BUILD_DIR, "lightning");
      if (!existsSync(lightningDir)) mkdirSync(lightningDir, { recursive: true });

      // Build content objects → .tex first (for preamble/macros)
      const buildResult = spawnSync("bun", ["run", join(REPO_ROOT, "pipeline/build.ts")], {
        cwd: REPO_ROOT,
        stdio: "pipe",
        timeout: 60_000,
      });
      // The result used to be discarded, so a failed or timed-out build was
      // invisible and the lightning .tex below was then assembled from stale
      // (or missing) output. Surface it, matching the sibling spawnSync sites.
      if (buildResult.status !== 0) {
        log("lightning", "content build failed — .tex may be stale",
            buildResult.stderr?.toString().trim());
      }

      // Step 4: Generate a standalone lightning .tex file
      const rootBlock = blockIndex.get(label)!;
      const rootTitle = rootBlock.title || label;
      const preamblePath = join(REPO_ROOT, "latex/preamble.tex");
      let preamble = "";
      if (existsSync(preamblePath)) {
        preamble = rf(preamblePath, "utf-8") as string;
      } else {
        // Fallback: read from main.tex up to \begin{document}
        const mainTex = rf(MAIN_TEX, "utf-8") as string;
        const docIdx = mainTex.indexOf("\\begin{document}");
        preamble = docIdx > 0 ? mainTex.slice(0, docIdx) : "";
      }

      // Which chapter owns each block — the one thing the nested search below
      // used to walk `paper.chapters` for and then throw away.
      const chapterDirOf = new Map<string, string>();
      for (const ch of paper.chapters) {
        if (!ch.dir) continue;
        for (const sec of ch.sections) {
          for (const sb of sec.blocks) chapterDirOf.set(sb.rootName, ch.dir);
        }
      }

      // Render each block to LaTeX.
      //
      // This used to re-scan `paper.chapters` for a block matching `b` and
      // render that — but `blockIndex`, and so `chainBlocks`, was built by
      // walking those same `sec.blocks` arrays, so the search always handed
      // back the object already in hand. It was rendering a `ResolvedBlock`:
      // the viewer's projection, which carries `kind`/`label`/`tex`/`caption`
      // and drops everything kind-specific `renderBlock` switches on
      // (`simulator`, `html`, `views`, `of`, `interprets`, `meta`). Those
      // blocks emitted their generic shell and lost their body, silently,
      // because `as any` let a `ResolvedBlock` stand in for a `Block`. Load
      // the block's own manifest, which is what `renderBlock` is typed for.
      //
      // The renderer comes from the folio's declared PROFILE rather than from
      // an import of the LaTeX one. A document folio reaching this path would
      // otherwise be typeset through a toolchain its render path deliberately
      // never uses.
      const declaredProfile = readDeclaredFolioProfile(REPO_ROOT);
      const renderLookup = await resolveRenderTarget(declaredProfile.profile);
      const blockTexParts: string[] = [];
      if (renderLookup.miss) {
        // Reported in the output itself, as a TeX comment, so the caller sees
        // WHY the body is empty rather than receiving a valid-looking preamble
        // wrapped around nothing.
        blockTexParts.push(
          `% No render target: ${renderLookup.miss.detail} (${declaredProfile.declaredBy})`,
        );
      } else {
        const { render } = renderLookup.target;
        for (const b of chainBlocks) {
          const chDir = chapterDirOf.get(b.rootName);
          if (!chDir) continue;
          try {
            const blockObj = await importTsBranch<Block>(
              // declared-path-literal: the folio content root. Resolving it through `directoryForGraph` is bean `hs08`; the harness-side callers hit `ot9a`'s layering boundary, so the literal is COUNTED here rather than hidden.
              undefined, `folio/${paperId}/${chDir}/${b.rootName}.ts`,
            );
            blockTexParts.push(render(blockObj, b.md || ""));
          } catch (e) {
            blockTexParts.push(`% Error rendering ${b.label}: ${String(e)}`);
          }
        }
      }

      const lightningTex = [
        preamble.includes("\\documentclass") ? preamble : `\\documentclass[11pt]{article}\n${preamble}`,
        "",
        "\\begin{document}",
        "",
        `\\title{${rootTitle} --- Critical Path}`,
        "\\maketitle",
        "",
        `\\noindent{\\small ${chainBlocks.length} blocks in dependency chain for \\texttt{${label.replace(/_/g, "\\_")}}.}`,
        "\\bigskip",
        "",
        ...blockTexParts,
        "",
        "\\end{document}",
      ].join("\n");

      const lightningTexPath = join(lightningDir, "lightning.tex");
      wf(lightningTexPath, lightningTex);

      // Step 5: Compile with latexmk
      const latexResult = spawnSync("latexmk", [
        "-pdf",
        "-g",
        "-jobname=lightning",
        `-output-directory=${lightningDir}`,
        "-interaction=nonstopmode",
        "-file-line-error",
        lightningTexPath,
      ], {
        cwd: REPO_ROOT,
        stdio: "pipe",
        timeout: 300_000,
      });

      const pdfPath = join(lightningDir, "lightning.pdf");
      if (existsSync(pdfPath)) {
        const pdfData = rf(pdfPath);
        return new Response(pdfData, {
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `inline; filename="lightning-${label}.pdf"`,
            "Access-Control-Allow-Origin": "*",
          },
        });
      }

      // Failed — return error details
      const logPath = join(lightningDir, "lightning.log");
      let texLog = "";
      try {
        const fullLog = rf(logPath, "utf-8") as string;
        const lines = fullLog.split("\n");
        const errorLines: string[] = [];
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].startsWith("!") || lines[i].includes("Fatal error") ||
              lines[i].includes("Emergency stop") || lines[i].includes("File not found")) {
            const start = Math.max(0, i - 2);
            const end = Math.min(lines.length, i + 5);
            errorLines.push(`--- line ${i + 1} ---`);
            for (let j = start; j < end; j++) errorLines.push(lines[j]);
          }
        }
        texLog = errorLines.length > 0
          ? errorLines.join("\n").slice(-3000)
          : fullLog.slice(-3000);
      } catch {
        texLog = latexResult.stderr?.toString().slice(-2000) || "";
      }
      return Response.json({
        error: "Lightning PDF compilation failed",
        latexLog: texLog || undefined,
        blockCount: chainBlocks.length,
        exitCode: latexResult.status,
      }, { status: 500, headers: { "Access-Control-Allow-Origin": "*" } });
    } catch (e) {
      return Response.json({ error: String(e) }, { status: 500, headers: { "Access-Control-Allow-Origin": "*" } });
    }
  }

  // Legacy paper.json — viewer now uses /api/paper directly
  if (path === "/viewer/paper.json") {
    return serveFile(join(VIEWER_BUILD_DIR, "paper.json"))
      || serveFile(join(VIEWER_DIR, "paper.json"))
      || new Response("paper.json is deprecated. The viewer uses /api/paper which reads .ts manifests directly.", {
        status: 404,
        headers: { "Content-Type": "text/plain" },
      });
  }

  // Content assets — serve SVG/PNG directly from content source directories
  // URL pattern: /api/content-asset/<paper>/<chapter>/rendered/<file>
  if (path.startsWith("/api/content-asset/")) {
    const rel = path.slice("/api/content-asset/".length);
    const assetPath = join(folioDirOf(), rel);
    return serveFile(assetPath)
      || new Response("Asset not found", { status: 404 });
  }

  // Legacy rendered assets (from build output)
  if (path.startsWith("/viewer/assets/") || path.startsWith("/api/rendered/")) {
    const assetRel = path.startsWith("/viewer/assets/")
      ? path.slice("/viewer/".length)
      : path.slice("/api/".length);
    return serveFile(join(VIEWER_BUILD_DIR, assetRel))
      || new Response("Not found", { status: 404 });
  }

  // Static viewer files
  if (path.startsWith("/viewer/")) {
    return serveFile(join(VIEWER_DIR, path.slice("/viewer/".length)));
  }

  // Standalone HTML pages sitting at the folio root — REPO_ROOT is the
  // FOLIO's root, not the platform's. Not the simulators: those live under the
  // folio's configured `simulators.dir`, so their paths carry a slash and the
  // no-slash test below has always excluded them.
  if (path.endsWith(".html") && !path.slice(1).includes("/")) {
    const fileName = path.slice(1); // strip leading /
    if (/^[\w.-]+\.html$/.test(fileName)) {
      return serveFile(join(REPO_ROOT, fileName));
    }
  }

  return null;
}

/**
 * Handle POST requests (block save, feedback submission).
 */
async function handlePostRequest(url: URL, req: Request): Promise<Response | null> {
  const path = url.pathname;

  // ── Save block markdown (collaborator+ only) ─────────────────
  if (path === "/api/block/save") {
    if (!allows(req, "content-authoring")) {
      return forbidden("editing content", "content-authoring");
    }
    try {
      const body = await req.json() as { paperId: string; rootName: string; md: string };
      const { writeFileSync, readdirSync } = await import("fs");

      // Find the block's chapter directory
      const paperDir = join(folioDirOf(), body.paperId);
      if (!existsSync(paperDir)) {
        return Response.json({ error: "Paper not found" }, { status: 404 });
      }
      let mdPath: string | null = null;
      for (const d of readdirSync(paperDir)) {
        const candidate = join(paperDir, d, `${body.rootName}.ts`);
        if (existsSync(candidate)) { mdPath = join(paperDir, d, `${body.rootName}.md`); break; }
      }
      if (!mdPath) {
        return Response.json({ error: `Block "${body.rootName}" not found` }, { status: 404 });
      }
      writeFileSync(mdPath, body.md, "utf-8");
      invalidatePaperCache(body.paperId);
      log('edit', `block saved: ${body.paperId}/${body.rootName}`, `${body.md.length} chars → ${mdPath}`);
      return Response.json({ ok: true, path: mdPath });
    } catch (e) {
      return Response.json({ error: String(e) }, { status: 500 });
    }
  }

  // ── Revert block to a previous commit (collaborator+ only) ──────
  // POST /api/block/revert { paperId, rootName, sha }
  if (path === "/api/block/revert") {
    if (!allows(req, "content-authoring")) {
      return forbidden("reverting content", "content-authoring");
    }
    try {
      const body = await req.json() as { paperId: string; rootName: string; sha: string };
      const { readdirSync } = await import("fs");
      const paperDir = join(folioDirOf(), body.paperId);
      if (!existsSync(paperDir)) {
        return Response.json({ error: "Paper not found" }, { status: 404 });
      }
      // Find block's chapter directory
      let chapterDir: string | null = null;
      for (const d of readdirSync(paperDir)) {
        if (existsSync(join(paperDir, d, `${body.rootName}.ts`))) { chapterDir = d; break; }
      }
      if (!chapterDir) {
        return Response.json({ error: `Block "${body.rootName}" not found` }, { status: 404 });
      }
      // Revert .md content from the specified commit
      // declared-path-literal: the folio content root. Resolving it through `directoryForGraph` is bean `hs08`; the harness-side callers hit `ot9a`'s layering boundary, so the literal is COUNTED here rather than hidden.
      const relMd = `folio/${body.paperId}/${chapterDir}/${body.rootName}.md`;
      const oldMd = gitShowAt(body.sha, relMd);
      if (oldMd === null) {
        return Response.json({ error: `No .md found at commit ${body.sha}` }, { status: 404 });
      }
      const mdPath = join(paperDir, chapterDir, `${body.rootName}.md`);
      writeFileSync(mdPath, oldMd, "utf-8");
      invalidatePaperCache(body.paperId);
      log('revert', `block reverted: ${body.paperId}/${body.rootName}`, `to commit ${body.sha.slice(0, 8)}`);
      return Response.json({ ok: true, sha: body.sha, path: mdPath });
    } catch (e) {
      return Response.json({ error: String(e) }, { status: 500 });
    }
  }

  // ── Submit feedback as todo (viewer+ — any authenticated user) ──
  // Stored in feedback/<paper-dir>/ as TypeScript, committed to main via worktree.
  if (path === "/api/feedback" && req.method === "POST") {
    try {
      const body = await req.json() as {
        paperId: string; rootName: string;
        summary: string; comment: string; priority: string; assignee: string;
      };

      // `body.priority` is an unvalidated wire string; it used to be written
      // through verbatim because the array it joined was `any[]`.
      const priority = parseTodoPriority(body.priority || undefined);
      if (priority === INVALID_ENUM) {
        return Response.json({
          error: `Invalid priority: must be one of ${TODO_PRIORITIES.join("|")}`,
        }, { status: 400 });
      }

      const todo: FeedbackItem = {
        id: makeTodoId(),
        summary: body.summary,
        comment: body.comment,
        status: "open",
        priority: priority ?? "medium",
        origin: "human",
        author: getUserName(req),
        authorEmail: getUserEmail(req),
        assignee: body.assignee || "editor-agent",
        createdAt: new Date().toISOString(),
      };

      const todos = readFeedback(body.paperId, body.rootName);
      todos.push(todo);
      writeFeedback(body.paperId, body.rootName, todos);
      log('feedback', `created: ${body.paperId}/${body.rootName}`, `id=${todo.id} priority=${todo.priority} assignee=${todo.assignee}`);

      return Response.json({ ok: true, todo });
    } catch (e) {
      return Response.json({ error: String(e) }, { status: 500 });
    }
  }

  // ── Git checkout (branch switch with dirty-state handling) ───
  if (path === "/api/git/checkout") {
    // Authorised, JSON-only, no wildcard CORS: this rewrites the working tree.
    const refused = refuseCheckoutRequest(req);
    if (refused) return refused;
    try {
      const { spawnSync } = await import("child_process");
      const body = await req.json() as { branch: unknown; action?: "switch" | "stash" | "commit" | "discard" };
      const badBranch = refuseBranchName(body.branch);
      if (badBranch) return badBranch;
      const targetBranch = body.branch as string;
      const action = body.action || "switch";
      const fromBranch = currentBranch();
      log('git', `checkout: ${fromBranch} → ${targetBranch}`, `action=${action}`);

      // Check if dirty
      const st = spawnSync("git", ["status", "--porcelain"], { cwd: REPO_ROOT, stdio: "pipe" });
      const dirty = st.stdout.toString().trim().length > 0;

      if (dirty) {
        log('git', `checkout: working tree dirty (${st.stdout.toString().trim().split("\n").length} changes)`);
        if (action === "stash") {
          log('git', `stash: saving changes from ${fromBranch}`);
          const stash = spawnSync("git", ["stash", "push", "-m", `folio-auto-stash-${fromBranch}`], { cwd: REPO_ROOT, stdio: "pipe" });
          if (stash.status !== 0) {
            log('git', `stash: FAILED — ${stash.stderr.toString().trim()}`);
            return Response.json({ error: `Stash failed: ${stash.stderr.toString()}` }, { status: 500 });
          }
          log('git', `stash: ok`);
        } else if (action === "commit") {
          log('git', `commit: auto-committing changes on ${fromBranch}`);
          spawnSync("git", ["add", "-A"], { cwd: REPO_ROOT, stdio: "pipe" });
          const commit = spawnSync("git", ["commit", "-m", "Folio: auto-save before branch switch"], { cwd: REPO_ROOT, stdio: "pipe" });
          if (commit.status !== 0) {
            log('git', `commit: FAILED — ${commit.stderr.toString().trim()}`);
            return Response.json({ error: `Commit failed: ${commit.stderr.toString()}` }, { status: 500 });
          }
          log('git', `commit: ok`);
        } else if (action === "discard") {
          log('git', `discard: discarding all changes on ${fromBranch}`);
          spawnSync("git", ["checkout", "--", "."], { cwd: REPO_ROOT, stdio: "pipe" });
          spawnSync("git", ["clean", "-fd"], { cwd: REPO_ROOT, stdio: "pipe" });
          log('git', `discard: ok`);
        } else {
          log('git', `checkout: blocked — dirty state, no action specified`);
          return Response.json({
            error: "dirty",
            message: "Working tree has uncommitted changes",
            branch: fromBranch,
            changes: st.stdout.toString().trim().split("\n").filter(Boolean),
          }, { status: 409 });
        }
      }

      // Do the checkout
      const co = spawnSync("git", ["checkout", targetBranch, "--"], { cwd: REPO_ROOT, stdio: "pipe" });
      if (co.status !== 0) {
        log('git', `checkout: FAILED — ${co.stderr.toString().trim()}`);
        return Response.json({ error: `Checkout failed: ${co.stderr.toString()}` }, { status: 500 });
      }

      log('git', `checkout: ok — now on ${currentBranch()}`);
      return Response.json({
        ok: true,
        branch: currentBranch(),
      });
    } catch (e) {
      log('git', `checkout: error — ${e}`);
      return Response.json({ error: String(e) }, { status: 500 });
    }
  }

  // ── Claude chat: streaming conversational assistant with tool use ──
  // POST /api/chat { messages[], context?, mode? }
  // Returns SSE stream. LLM can call tools to fetch data from the server
  // before composing a final response.
  if (path === "/api/chat") {
    // Chat spends the server's API key: authorised, JSON-only, same-origin.
    const refused = refuseChatRequest(req);
    if (refused) return refused;
    try {
      const body = await req.json() as {
        messages: Array<{ role: string; content: string }>;
        context?: {
          paperId?: string; blockLabel?: string; blockMd?: string; blockKind?: string;
          selectedText?: string;
          viewMode?: string;
          visibleBlocks?: Array<{ label: string; kind: string; title: string }>;
        };
        mode?: "read" | "edit" | "status";
      };

      logDebug("chat", `mode=${body.mode || "read"} msgs=${body.messages.length}`,
        body.context?.blockLabel ? `block=${body.context.blockLabel}` :
        body.context?.visibleBlocks?.length ? `visible=${body.context.visibleBlocks.length} blocks` : undefined);

      const badMode = refuseChatMode(req, body.mode || "read");
      if (badMode) return badMode;

      const client = getAnthropic();
      if (!client) {
        log("chat", "ANTHROPIC_API_KEY not set — chat unavailable");
        return Response.json(
          { error: "ANTHROPIC_API_KEY not set. Claude chat requires an API key." },
          { status: 503 }
        );
      }

      // ── Tool definitions for the chat LLM ──
      const chatTools: Anthropic.Tool[] = [
        {
          name: "get_paper_status",
          description: "Get paper overview: chapters, block counts, proof status, lean formalization stats. Use when the user asks about status, progress, or what needs work.",
          input_schema: {
            type: "object" as const,
            properties: { paperId: { type: "string", description: "Paper ID (optional, uses context if omitted)" } },
            required: [],
          },
        },
        {
          name: "get_todos",
          description: "Get open todos/feedback items. Can filter by paper or specific block. Use when user asks about tasks, what needs attention, or outstanding work. The blockLabel can be a full label like 'def:rigid-monoidal-category' or just the root name like 'rigid-monoidal-category'.",
          input_schema: {
            type: "object" as const,
            properties: {
              paperId: { type: "string", description: "Filter to specific paper" },
              blockLabel: { type: "string", description: "Filter to specific block — accepts full label (e.g. 'def:rigid-monoidal-category') or root name ('rigid-monoidal-category')" },
              status: { type: "string", enum: ["open", "in_progress", "blocked", "resolved"], description: "Filter by status (default: open)" },
            },
            required: [],
          },
        },
        {
          name: "get_block",
          description: "Get full content of a specific block by label (e.g. def:quantum-connection, thm:main-result). Returns kind, title, markdown content, lean status, uses, and tags.",
          input_schema: {
            type: "object" as const,
            properties: { label: { type: "string", description: "Block label (e.g. def:quantum-connection)" } },
            required: ["label"],
          },
        },
        {
          name: "get_chapter_blocks",
          description: "List all blocks in a chapter with their kinds, labels, titles, lean status, and proof status. Use to understand chapter structure or find specific content.",
          input_schema: {
            type: "object" as const,
            properties: {
              paperId: { type: "string", description: "Paper ID" },
              chapterNumber: { type: "number", description: "Chapter number (1-indexed)" },
            },
            required: ["chapterNumber"],
          },
        },
        {
          name: "search_blocks",
          description: "Search blocks by keyword in title, label, tags, or content. Use when user asks about a concept, definition, or theorem by name.",
          input_schema: {
            type: "object" as const,
            properties: { query: { type: "string", description: "Search query" } },
            required: ["query"],
          },
        },
        {
          name: "get_imports",
          description: "List imported papers (from arXiv or uploads). Use when discussing external references or imported results.",
          input_schema: {
            type: "object" as const,
            properties: {},
            required: [],
          },
        },
        {
          name: "search_graph",
          description:
            "Search the JSON-LD content graph across BOTH authored blocks and ingested library documents. " +
            "Unlike search_blocks (authored content only, one paper), this spans ingested sources too. " +
            "Use when the question may be answered by an ingested paper or guideline rather than by the folio's own prose.",
          input_schema: {
            type: "object" as const,
            properties: {
              query: { type: "string", description: "Substring to look for" },
              provenance: {
                type: "string",
                enum: ["authored", "ingested"],
                description: "Restrict to one population. Omit to search both.",
              },
              searchText: {
                type: "boolean",
                description:
                  "Also scan companion Markdown bodies, not just metadata. Slower; reads files.",
              },
              limit: { type: "number", description: "Max hits (default 20)" },
            },
            required: ["query"],
          },
        },
        {
          name: "corpus_search",
          description:
            "Search the authored corpus AND the ingested library together, then follow the " +
            "graph out from what matched. THIS IS THE ONE TO REACH FOR before declaring " +
            "anything open, unproved, or novel: search_graph finds prior work only if it " +
            "used your words, whereas a block one `uses` hop from the match is found " +
            "whatever it calls itself — and prior work written in different words is the " +
            "case that actually costs a session. Every hit says whether it MATCHED or was " +
            "REACHED, and by which edge; a `~` prefix means the edge was traversed " +
            "backwards, i.e. that node depends on the seed rather than the other way round. " +
            "Counts are split authored vs ingested, because 'open in this corpus' and " +
            "'settled in a paper we hold' are different verdicts — many ingested hits and " +
            "no authored ones means CITE it, not derive it. Reports any root that exists " +
            "but holds no graph nodes, which is what an ungenerated .jsonld corpus looks " +
            "like and is otherwise indistinguishable from 'nobody has done this'.",
          input_schema: {
            type: "object" as const,
            properties: {
              query: { type: "string", description: "Words to seed on" },
              hops: {
                type: "number",
                description:
                  "Expansion depth (default 1, max 4). 0 is a plain lexical search.",
              },
              direction: {
                type: "string",
                enum: ["out", "in", "both"],
                description:
                  "'out' = what the seeds depend on; 'in' = what depends on them. " +
                  "Default both, with each hop labelled.",
              },
              provenance: {
                type: "string",
                enum: ["authored", "ingested"],
                description: "Restrict SEEDS to one population. Expansion still crosses both.",
              },
              searchText: {
                type: "boolean",
                description:
                  "Also scan companion Markdown for seeds. Off by default; turn it on " +
                  "when a label/title search comes back empty.",
              },
              limit: { type: "number", description: "Seed cap before expansion (default 20)" },
            },
            required: ["query"],
          },
        },
        {
          name: "get_neighbors",
          description:
            "Walk the content graph outward from one node. direction 'out' answers " +
            "'what must a reader have read first?'; direction 'in' answers 'what breaks if this changes?' — " +
            "the reverse direction is not otherwise available without a full corpus scan. " +
            "Accepts an @id or an authored label such as 'thm:main'.",
          input_schema: {
            type: "object" as const,
            properties: {
              id: { type: "string", description: "Node @id or authored label" },
              direction: { type: "string", enum: ["out", "in", "both"] },
              hops: { type: "number", description: "Traversal depth, 1–6 (default 1)" },
              edges: {
                type: "array",
                items: { type: "string" },
                description:
                  "Restrict to these edge terms (uses, interprets, cites, contains, …). Omit for all.",
              },
            },
            required: ["id"],
          },
        },
        {
          name: "get_graph_stats",
          description:
            "Node and edge counts for the content graph, broken down by provenance and kind, " +
            "plus whether each root directory exists. Use this to tell 'nothing matched' from " +
            "'that population has not been built yet' before reporting an empty search.",
          input_schema: {
            type: "object" as const,
            properties: {
              refresh: { type: "boolean", description: "Rebuild the index from disk first" },
            },
            required: [],
          },
        },
      ];

      // ── Tool execution (calls server functions directly, no HTTP) ──
      async function executeTool(name: string, input: Record<string, unknown>): Promise<string> {
        const pid = (input.paperId as string) || body.context?.paperId || "";
        logDebug("chat:tool", `${name}`, JSON.stringify(input).slice(0, 200));

        try {
          switch (name) {
            case "get_paper_status": {
              const paper = pid ? await resolvePaper(pid) : null;
              if (!paper) return JSON.stringify({ error: "Paper not found", paperId: pid });
              const stats = {
                title: paper.title,
                chapters: paper.chapters.length,
                totalBlocks: 0, definitions: 0, theorems: 0, lemmas: 0, propositions: 0,
                leanFormalized: 0, leanMissing: 0, leanError: 0, hasSorry: 0, proved: 0,
                openTodos: 0,
              };
              for (const ch of paper.chapters) {
                for (const sec of ch.sections || []) {
                  for (const blk of sec.blocks || []) {
                    stats.totalBlocks++;
                    if (blk.kind === "definition") stats.definitions++;
                    if (blk.kind === "theorem") stats.theorems++;
                    if (blk.kind === "lemma") stats.lemmas++;
                    if (blk.kind === "proposition") stats.propositions++;
                    const nl = ["definition","theorem","lemma","proposition","corollary"].includes(blk.kind);
                    if (nl && blk.lean?.file) stats.leanFormalized++;
                    if (nl && !blk.lean?.file) stats.leanMissing++;
                    if (blk.lean?.validation === "error") stats.leanError++;
                    // Same phantom `blk.status` as above — both counters
                    // were always 0, while the two lines directly above already
                    // read the correct `blk.lean`. `stubbed` is the closest
                    // available analogue of `has_sorry`: per
                    // `leanStatusBucket`'s own definition a *cited* sorry is
                    // `drafted` (a deliberate deferral) rather than a stub.
                    const bucket = leanStatusBucket(blk.lean);
                    if (bucket === "stubbed") stats.hasSorry++;
                    if (bucket === "compiled") stats.proved++;
                    stats.openTodos += (blk.todos || []).filter((t) => t.status === "open").length;
                  }
                }
              }
              // Also count global feedback todos
              const allTodos = listAllFeedback("open");
              const paperTodos = allTodos.filter(t => t.paperId === pid);
              stats.openTodos += paperTodos.length;
              return JSON.stringify(stats);
            }

            case "get_todos": {
              // Accept full label (def:foo-bar) or rootName (foo-bar)
              const rawLabel = (input.blockLabel || input.rootName) as string | undefined;
              const rootName = rawLabel?.replace(/^(def|thm|lem|prop|cor|rem|ex|conj):/, "") || undefined;
              if (rootName && pid) {
                const todos = readFeedback(pid, rootName);
                return JSON.stringify(todos.length ? todos : { message: `No feedback found for '${rootName}' in paper '${pid}'`, rootName });
              }
              const status = (input.status as string) || "open";
              const all = listAllFeedback(status);
              const filtered = pid ? all.filter(t => t.paperId === pid) : all;
              return JSON.stringify(filtered.slice(0, 30));
            }

            case "get_block": {
              const label = input.label as string;
              const paper = pid ? await resolvePaper(pid) : null;
              if (!paper) return JSON.stringify({ error: "Paper not found" });
              for (const ch of paper.chapters) {
                for (const sec of ch.sections || []) {
                  for (const blk of sec.blocks || []) {
                    if (blk.label === label) {
                      return JSON.stringify({
                        kind: blk.kind, label: blk.label, title: blk.title,
                        md: (blk.md || "").slice(0, 3000),
                        lean: blk.lean ? { ref: blk.lean.ref, validation: blk.lean.validation, sorryFree: blk.lean.sorryFree } : null,
                        status: blk.status, uses: blk.uses, tags: blk.tags,
                        chapter: ch.title, section: sec.title,
                      });
                    }
                  }
                }
              }
              return JSON.stringify({ error: `Block not found: ${label}` });
            }

            case "get_chapter_blocks": {
              const chNum = input.chapterNumber as number;
              const paper = pid ? await resolvePaper(pid) : null;
              if (!paper) return JSON.stringify({ error: "Paper not found" });
              const ch = paper.chapters.find((c) => c.number === chNum);
              if (!ch) return JSON.stringify({ error: `Chapter ${chNum} not found` });
              const blocks: unknown[] = [];
              for (const sec of ch.sections || []) {
                for (const blk of sec.blocks || []) {
                  blocks.push({
                    kind: blk.kind, label: blk.label, title: blk.title,
                    status: blk.status,
                    lean: blk.lean ? { ref: blk.lean.ref, validation: blk.lean.validation, sorryFree: blk.lean.sorryFree } : null,
                    section: sec.title,
                  });
                }
              }
              return JSON.stringify({ chapter: ch.title, blocks });
            }

            case "search_blocks": {
              const q = (input.query as string || "").toLowerCase();
              const paper = pid ? await resolvePaper(pid) : null;
              if (!paper) return JSON.stringify({ error: "Paper not found" });
              const matches: unknown[] = [];
              for (const ch of paper.chapters) {
                for (const sec of ch.sections || []) {
                  for (const blk of sec.blocks || []) {
                    const searchable = [blk.label, blk.title, blk.kind, ...(blk.tags || []), (blk.md || "").slice(0, 500)].join(" ").toLowerCase();
                    if (searchable.includes(q)) {
                      matches.push({
                        kind: blk.kind, label: blk.label, title: blk.title,
                        status: blk.status, chapter: ch.title, section: sec.title,
                        snippet: (blk.md || "").slice(0, 200),
                      });
                    }
                    if (matches.length >= 15) break;
                  }
                  if (matches.length >= 15) break;
                }
                if (matches.length >= 15) break;
              }
              return JSON.stringify(matches);
            }

            case "corpus_search":
            case "search_graph":
            case "get_neighbors":
            case "get_graph_stats":
              // Implemented in ./tools/graph.ts so the handlers are reachable
              // from a test — this switch is inside a request handler and was
              // covered by nothing but `tsc`.
              return executeGraphTool(name, input, GRAPH_ROOTS)!;

            case "get_imports": {
              const uploadsDir = UPLOADS_DIR();
              const imports: unknown[] = [];
              if (existsSync(uploadsDir)) {
                const { readdirSync: rd } = await import("fs");
                for (const d of rd(uploadsDir)) {
                  const mp = join(uploadsDir, d, "import-meta.json");
                  if (existsSync(mp)) {
                    try { imports.push(JSON.parse(readFileSync(mp, "utf-8"))); } catch {}
                  }
                }
              }
              return JSON.stringify(imports);
            }

            default:
              return JSON.stringify({ error: `Unknown tool: ${name}` });
          }
        } catch (e) {
          return JSON.stringify({ error: String(e) });
        }
      }

      // Build system prompt based on mode and user role
      const mode = body.mode || "read";
      const userRole = getUserRole(req);
      const userName = getUserName(req);
      let systemPrompt = `You are Folio, an editorial assistant for a formal mathematics research paper. You help readers understand, navigate, and improve the paper.

Your role is that of a knowledgeable editor who:
- Explains mathematical content clearly at the reader's level
- Helps navigate between related definitions, theorems, and proofs
- Identifies potential errors or improvements when asked
- Suggests connections between concepts
- Answers questions about the paper's content and structure

## User role

The current user is **${userName}** with role **${userRole}**.

Role capabilities:
- **reader**: Can read the paper, submit feedback/comments, view todos and proof status. Cannot edit content, write proofs, or modify infrastructure.
- **collaborator**: All reader capabilities, plus: edit markdown content, write/modify Lean proofs, manage branches, delete feedback items, run tests, import papers.
- **owner**: All collaborator capabilities, plus: commit to main, manage deployment/auth, modify server configuration.

Skills available by role:
- **reader**: content-validation, latex-validation, scientific-accuracy, readability-editing, proof-status-tracking, todo-review, editor (read-only mode)
- **collaborator**: All reader skills, plus: formalizer, category-theory, lean-generation, lean-proof-review, proof-triage, proof-simplifier, chapter-analysis, content-block-review, ontologist, paper-importer, test-engineer
- **owner**: All collaborator skills, plus: deployment-auth

When coordinating work or suggesting actions, ONLY suggest actions and skills that the user's role (${userRole}) permits. If a reader asks to edit content, explain they need collaborator access. If a collaborator tries to manage deployment, explain they need owner access.

You have tools to fetch live data from the paper system. Use them proactively — don't guess at paper status, todos, or block content when you can look it up.

Keep responses concise and well-formatted.

## Math formatting
CRITICAL: ALL mathematical expressions MUST be wrapped in dollar signs.
- Inline math: $S_{uu} = 312.36$ MeV (NOT S_{uu} or Suu)
- Display math: $$\\sum_{i} m_i = M$$
- Variables, subscripts, Greek letters — always wrap: $q$, $\\alpha$, $x_n$
Never write bare math symbols/subscripts outside dollar signs — the renderer requires them.

## Block references
When mentioning a specific definition, theorem, proposition, etc., ALWAYS use markdown link syntax with the label:
- [Proposition Title](#prop:terminal-resolution)
- [Definition Title](#def:quantum-connection)
These become clickable navigation links in the viewer. When answering "where is X" questions, always include the block reference link so the user can navigate directly.

## Response format
End every response with 2-4 suggested follow-up options the user might want to ask next. Format them on the last line as:
[suggestions]: First option | Second option | Third option
These become clickable buttons so users don't have to type. Make them specific to the conversation context — not generic. Keep each option under 40 characters.`;

      if (mode === "status") {
        systemPrompt += `\n\nThe user is in EDITOR mode. They want to understand the paper's current status — what's complete, what needs work, what the priorities are. Focus on actionable summaries. Use get_paper_status and get_todos to get real data.`;
      } else if (mode === "edit") {
        systemPrompt += `\n\nThe user is in EDITOR mode. They may want to report errors, suggest improvements, or discuss editorial decisions. Use tools to fetch block content and todos before responding.`;
      } else {
        systemPrompt += `\n\nThe user is in READER mode. They're studying the paper and want to understand the content. Use get_block to fetch full content when explaining. Prioritize clear explanations and intuition.`;
      }

      // Add view-mode context so the assistant understands the UI context
      if (body.context?.viewMode) {
        const vm = body.context.viewMode;
        const viewDescriptions: Record<string, string> = {
          "read": "The user is viewing the paper in **read mode** — the full paper content with sidebar navigation. They are reading/studying the paper.",
          "qc": "The user is viewing the **QC Dashboard** — a quality-control overview showing proof status, sorry counts, and block-level formalization progress. They likely want to understand what needs work.",
          "diff": "The user is viewing the **diff view** — comparing changes between branches. They are reviewing edits and may want to understand what changed and why.",
          "critical-path": "The user is viewing the **critical path** — a filtered view showing only the essential proof chain: leaf theorems traced back through their dependencies to foundational definitions. They want to understand the paper's core logical structure and narrative.",
          // declared-path-literal: the folio content root. Resolving it through `directoryForGraph` is bean `hs08`; the harness-side callers hit `ot9a`'s layering boundary, so the literal is COUNTED here rather than hidden.
          "folio": "The user is on the **folio landing page** — browsing the list of available papers. They may want an overview or help choosing what to read.",
        };
        systemPrompt += `\n\n## Current view\n${viewDescriptions[vm] || `The user is in the **${oneLineLabel(vm, 60)}** view.`}`;
      }

      // Add context about the current block if available
      if (body.context) {
        const ctx = body.context;
        if (ctx.selectedText) {
          systemPrompt += `\n\nThe reader has selected this text:\n${guardUntrusted(ctx.selectedText, "the reader's selection", 1000)}`;
        }
        if (ctx.blockLabel && ctx.blockMd) {
          systemPrompt += `\n\nThey are looking at block "${oneLineLabel(ctx.blockLabel)}" (${oneLineLabel(ctx.blockKind || "unknown")}):\n${guardUntrusted(ctx.blockMd, `block ${oneLineLabel(ctx.blockLabel)}`, 3000)}`;
        }
        if (ctx.visibleBlocks?.length) {
          const vbList = ctx.visibleBlocks.slice(0, 10).map(b => `- ${oneLineLabel(b.label)} (${oneLineLabel(b.kind)}): ${oneLineLabel(b.title)}`).join("\n");
          systemPrompt += `\n\nBlocks currently visible on screen:\n${vbList}`;
        }
        if (ctx.paperId) {
          systemPrompt += `\n\nPaper ID: ${oneLineLabel(ctx.paperId)}`;
          // Eagerly fetch todos for the context block so LLM has them immediately
          if (ctx.blockLabel) {
            const rootName = ctx.blockLabel.replace(/^(def|thm|lem|prop|cor|rem|ex|conj):/, "");
            const blockTodos = readFeedback(ctx.paperId, rootName);
            const openTodos = blockTodos.filter((t) => t.status === "open" || t.status === "in_progress");
            if (openTodos.length) {
              systemPrompt += `\n\nOpen todos/feedback for this block (${oneLineLabel(ctx.blockLabel)}):\n${guardUntrusted(JSON.stringify(openTodos, null, 2), "feedback todos, written by commenters")}`;
            }
          }
        }
      }

      // ── Tool-use loop: let LLM call tools, then stream final response ──
      const apiMessages: Anthropic.MessageParam[] = body.messages.map(m => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

      // Stream response with progress events during tool-use rounds
      const encoder = new TextEncoder();
      const sseHeaders = {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      };

      const readable = new ReadableStream({
        async start(controller) {
          const send = (obj: Record<string, unknown>) =>
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));

          try {
            let toolRounds = 0;
            const MAX_TOOL_ROUNDS = 3;

            while (toolRounds < MAX_TOOL_ROUNDS) {
              send({ status: toolRounds === 0 ? "thinking..." : `looking up data (step ${toolRounds + 1})...` });

              const response = await client.messages.create({
                model: "claude-haiku-4-5-20251001",
                max_tokens: 1500,
                system: systemPrompt,
                tools: chatTools,
                messages: apiMessages,
              });

              // Predicate form, not a bare boolean: `Array.filter` only narrows
              // the element type when the callback is a type guard, so the two
              // `.map`s below had to re-open each block with `as any` to reach
              // `.text` / `.name` — fields the SDK already declares.
              const toolUses = response.content.filter(
                (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
              );
              if (toolUses.length === 0) {
                // Final response — send text in chunks
                const textBlocks = response.content.filter(
                  (b): b is Anthropic.TextBlock => b.type === "text",
                );
                const fullText = textBlocks.map(b => b.text).join("");
                const chunkSize = 20;
                for (let i = 0; i < fullText.length; i += chunkSize) {
                  send({ text: fullText.slice(i, i + chunkSize) });
                }
                send({});  // clear status
                controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
                logDebug("chat", `complete (${toolRounds} tool rounds, ${fullText.length} chars)`);
                controller.close();
                return;
              }

              // Tool calls — send progress with tool names
              const toolNames = toolUses.map(t => t.name);
              logDebug("chat:tools", `round ${toolRounds + 1}: ${toolUses.length} tool calls`, toolNames.join(", "));
              const friendlyNames: Record<string, string> = {
                get_paper_status: "checking paper status",
                get_todos: "looking up todos",
                get_block: "reading block content",
                get_chapter_blocks: "scanning chapter",
                search_blocks: "searching",
                get_imports: "checking imports",
              };
              const desc = toolNames.map(n => friendlyNames[n] || n).join(", ");
              send({ status: desc + "..." });

              apiMessages.push({ role: "assistant", content: response.content });

              const toolResults: Anthropic.ToolResultBlockParam[] = [];
              for (const tu of toolUses) {
                const toolUseBlock = tu as Anthropic.ToolUseBlock;
                const result = await executeTool(toolUseBlock.name, toolUseBlock.input as Record<string, unknown>);
                toolResults.push({
                  type: "tool_result",
                  tool_use_id: toolUseBlock.id,
                  // A tool result carries corpus and commenter text: data, never instruction (H5, H9).
                  content: guardUntrusted(result, `tool ${toolUseBlock.name}`),
                });
              }
              apiMessages.push({ role: "user", content: toolResults });
              toolRounds++;
            }

            // Exhausted tool rounds — final streaming call without tools
            logDebug("chat", `max tool rounds reached (${MAX_TOOL_ROUNDS}), final call`);
            send({ status: "composing response..." });

            const stream = await client.messages.stream({
              model: "claude-haiku-4-5-20251001",
              max_tokens: 1500,
              system: systemPrompt,
              messages: apiMessages,
            });

            for await (const event of stream) {
              if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
                send({ text: event.delta.text });
              }
            }
            controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
            logDebug("chat", "stream complete (after tool rounds)");
            controller.close();
          } catch (e) {
            log("chat", "stream error", String(e));
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: String(e) })}\n\n`));
            controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
            controller.close();
          }
        },
      });

      return new Response(readable, { headers: sseHeaders });
    } catch (e) {
      return Response.json({ error: String(e) }, { status: 500 });
    }
  }

  // ── Paper import: upload file ────────────────────────────────
  // POST /api/import/upload  (multipart/form-data with file + metadata)
  if (path === "/api/import/upload") {
    try {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      const paperId = (formData.get("paperId") as string) || "";
      const source = (formData.get("source") as string) || "upload";

      if (!file) return Response.json({ error: "No file uploaded" }, { status: 400 });

      // `6bhf`, second and third sinks. The FALLBACK was sanitised and the
      // SUPPLIED value was not — `id = paperId || <slugified file.name>` used a
      // supplied `paperId` verbatim, so `../../..` reached `join()` and the two
      // lines below are `mkdirSync(recursive)` and a `writeFileSync`. The route
      // is unauthenticated and answers `Access-Control-Allow-Origin: *`, and a
      // cross-origin FormData POST is a simple request: the write lands whether
      // or not the response can be read.
      const rawId = paperId || file.name.replace(/\.[^.]+$/, "").replace(/[^a-z0-9-]/gi, "-").toLowerCase();
      const id = safeSegment(rawId);
      if (id === undefined) {
        return Response.json({ error: "paperId must be one safe path segment" }, { status: 400 });
      }
      const uploadDir = join(UPLOADS_DIR(), id);
      mkdirSync(uploadDir, { recursive: true });

      // Save the file
      const buf = Buffer.from(await file.arrayBuffer());
      const ext = extname(file.name) || (file.type === "application/pdf" ? ".pdf" : ".tex");
      // `file.name` is attacker-supplied and reached `join()` unchanged, which
      // is an arbitrary file WRITE with attacker-controlled content — the worse
      // half of this route. `basename` first because a browser may legitimately
      // send a path, then `safeSegment` because `basename("..")` is `".."`.
      const filename = ext === ".pdf" ? "original.pdf" : safeSegment(basename(file.name));
      if (filename === undefined) {
        return Response.json({ error: "file name must be one safe path segment" }, { status: 400 });
      }
      const target = join(uploadDir, filename);
      // The symlink half: lexical containment cannot see an uploads/<id> that
      // is a link out of the store. `serve-rendering.ts`'s own test got a 200
      // from the lexical-only version by exactly that route.
      if (!writableWithin(UPLOADS_DIR(), target)) {
        return Response.json({ error: "upload target is outside the uploads store" }, { status: 400 });
      }
      writeFileSync(target, buf);

      // Write import metadata
      const meta = {
        source,
        title: formData.get("title") || file.name,
        format: ext === ".pdf" ? "pdf" : "latex",
        files: [filename],
        uploadedAt: new Date().toISOString(),
        paperId: id,
      };
      writeFileSync(join(uploadDir, "import-meta.json"), JSON.stringify(meta, null, 2));
      log("import", `uploaded ${filename} → ${relative(REPO_ROOT, uploadDir)}/`, `${buf.length} bytes`);

      // Where the files WERE written, repo-relative: `uploads/${id}` named the
      // root's queue whichever directory the declaration resolved (bean `gz47`).
      return Response.json({ ok: true, paperId: id, uploadDir: relative(REPO_ROOT, uploadDir), meta }, {
        headers: { "Access-Control-Allow-Origin": "*" },
      });
    } catch (e) {
      return Response.json({ error: String(e) }, { status: 500 });
    }
  }

  // POST /api/import/arxiv { arxivId }
  if (path === "/api/import/arxiv") {
    try {
      const body = await req.json() as { arxivId: string; paperId?: string };
      const arxivId = body.arxivId.replace(/^(https?:\/\/)?(arxiv\.org\/(abs|pdf)\/)?/, "").replace(/\.pdf$/, "").trim();
      if (!arxivId) return Response.json({ error: "Missing arxivId" }, { status: 400 });

      // Fetch arXiv metadata
      const metaRes = await fetch(`https://export.arxiv.org/api/query?id_list=${encodeURIComponent(arxivId)}`);
      if (!metaRes.ok) throw new Error(`arXiv API: ${metaRes.status}`);
      const xml = await metaRes.text();

      // Parse basic fields from Atom XML
      const title = xml.match(/<title[^>]*>([\s\S]*?)<\/title>/g)?.[1]?.replace(/<[^>]+>/g, "").trim() || arxivId;
      const authors = [...xml.matchAll(/<name>(.*?)<\/name>/g)].map(m => m[1]);
      const summary = xml.match(/<summary>([\s\S]*?)<\/summary>/)?.[1]?.trim() || "";
      const doi = xml.match(/<arxiv:doi[^>]*>(.*?)<\/arxiv:doi>/)?.[1] || "";
      const categories = [...xml.matchAll(/<category[^>]*term="([^"]+)"/g)].map(m => m[1]);
      const published = xml.match(/<published>(.*?)<\/published>/)?.[1] || "";

      // THE SUPPLIED ID IS CHECKED; THE FALLBACK IS ALREADY SAFE. Bean `6bhf`:
      // `body.paperId` reached `join()` unvalidated, and the next two lines are
      // `mkdirSync(recursive)` and a `writeFileSync` — an arbitrary directory
      // creation and file write for anyone who can POST here. The fallback
      // spells `/` and `.` out of the value itself, so only the supplied branch
      // needs the guard; checking both anyway costs nothing and means a later
      // edit to the fallback cannot reopen this.
      const rawId = body.paperId || `arxiv-${arxivId.replace(/[/.]/g, "-")}`;
      const id = safeSegment(rawId);
      if (id === undefined) {
        return Response.json({ error: "paperId must be one safe path segment" }, { status: 400 });
      }
      const uploadDir = join(UPLOADS_DIR(), id);
      mkdirSync(uploadDir, { recursive: true });

      // Try to fetch LaTeX source
      let sourceFiles: string[] = [];
      let format = "metadata-only";
      try {
        const srcRes = await fetch(`https://arxiv.org/e-print/${arxivId}`);
        if (srcRes.ok) {
          const srcBuf = Buffer.from(await srcRes.arrayBuffer());
          const contentType = srcRes.headers.get("content-type") || "";
          if (contentType.includes("gzip") || contentType.includes("tar")) {
            writeFileSync(join(uploadDir, "source.tar.gz"), srcBuf);
            // Extract using tar
            const { execFileSync } = await import("child_process");
            try {
              // LIST BEFORE EXTRACTING, and refuse rather than repair — bean
              // `6bhf`. This archive is fetched from arxiv.org, so its member
              // names are not ours. GNU tar already refuses a `..` member and
              // strips a leading `/`, which covers traversal BY SPELLING; what
              // it does not cover is a symlink member followed by a regular
              // file of the same name, which writes through the link. That is
              // the residual `serve-rendering.ts`'s own test found by getting
              // 200 from a link pointing out of its root.
              //
              // `execFileSync` with an argv rather than `execSync` with a
              // string: there is no shell to parse, so a filename can never be
              // program. Nothing here is attacker-controlled today; the point
              // is that it cannot become so by an edit elsewhere.
              // `tvzf`, not `tzf`: the long form carries the member TYPE in the
              // first character of the mode, and the type is what closes the
              // residual named above. A symlink member is `l`, a hardlink `h`;
              // both write through to wherever they point, so neither spelling
              // check nor `--no-same-*` helps.
              const listing = execFileSync("tar", ["tvzf", "source.tar.gz"], {
                cwd: uploadDir,
                timeout: 15000,
                encoding: "utf-8",
                maxBuffer: 16 * 1024 * 1024,
              })
                .split("\n")
                .map((m) => m.trim())
                .filter((m) => m.length > 0);
              // A WHITELIST, not a blacklist: only a regular file (`-`) or a
              // directory (`d`) may be in the archive. Enumerating the types to
              // refuse means the next tar feature nobody thought about is
              // admitted by default, and an arXiv e-print source has no
              // legitimate need for a device, fifo or link member.
              const badType = listing.filter((l) => !/^[-d]/.test(l));
              if (badType.length > 0) {
                throw new UnsafeArchive(
                  `${badType.length} member(s) are not a regular file or directory ` +
                    `(a link member writes through to its target), first ${JSON.stringify(badType[0].slice(0, 120))}`,
                );
              }
              // The member name is everything after the time field. Anchoring
              // on the `HH:MM` pattern handles BOTH formats:
              //
              //   GNU tar:  -rw-r--r-- root/root  2 2026-09-26 12:13 sub/a b c.tex
              //             \_______/ \_______/ \/ \________/ \___/ \___________/
              //               mode      owner   sz    date    time      name
              //
              //   BSD tar:  -rw-r--r--  0 user wheel  2 Sep 26 21:34 sub/a b c.tex
              //             \_______/ \/ \__/ \___/ \/ \__/ \/ \___/ \___________/
              //               mode    lk own  grp  sz mon  dy time       name
              //
              // The first version stripped five fields and silently ate the first
              // word of every name on macOS — `sub/a b c.tex` came out as
              // `Sep 26 21:34 sub/a b c.tex`, and the path check ran on a
              // fabrication.
              const members = listing.map((l) => l.replace(/^.*?\d{1,2}:\d{2}\s+/, ""));
              const unsafe = members.filter(
                (m) => m.startsWith("/") || m.split("/").includes("..") || m.includes("\0"),
              );
              if (unsafe.length > 0) {
                throw new UnsafeArchive(
                  `${unsafe.length} member(s) name a path outside the upload directory, first ${JSON.stringify(unsafe[0])}`,
                );
              }
              execFileSync("tar", ["xzf", "source.tar.gz", "--no-same-owner", "--no-same-permissions"], {
                cwd: uploadDir,
                timeout: 15000,
              });
              const { readdirSync } = await import("fs");
              sourceFiles = readdirSync(uploadDir).filter(f => f.endsWith(".tex"));
              format = "latex";
            } catch (e) {
              // A REFUSAL is not a format mismatch, and the bare `catch` that
              // was here made them the same event: an archive rejected for
              // naming a path outside the upload directory fell through to "try
              // as a single .tex" with nothing said, so an operator could not
              // tell a hostile archive from a file that simply was not a
              // tarball. Three states, and this one was collapsing two of them.
              if (e instanceof UnsafeArchive) {
                log("import", `REFUSED archive for ${id}`, e.message);
                return Response.json(
                  { error: `refusing archive: ${e.message}` },
                  { status: 422, headers: { "Access-Control-Allow-Origin": "*" } },
                );
              }
              // Anything else really may be a single .tex rather than a tarball,
              // which is the original intent — kept, but no longer silent.
              log("import", `tar extract failed for ${id}, trying as a single file`, String(e).slice(0, 200));
            }
            if (!sourceFiles.length) {
              // Try as single .tex file
              try {
                const { renameSync } = await import("fs");
                renameSync(join(uploadDir, "source.tar.gz"), join(uploadDir, "main.tex"));
                sourceFiles = ["main.tex"];
                format = "latex";
              } catch {}
            }
          } else {
            // Plain text source
            writeFileSync(join(uploadDir, "main.tex"), srcBuf);
            sourceFiles = ["main.tex"];
            format = "latex";
          }
        }
      } catch (e) {
        log("import", `arXiv source fetch failed for ${arxivId}:`, String(e));
      }

      // Write import metadata
      const meta = {
        source: "arxiv",
        arxivId,
        url: `https://arxiv.org/abs/${arxivId}`,
        title,
        authors,
        abstract: summary,
        doi,
        categories,
        published,
        format,
        files: sourceFiles,
        fetchedAt: new Date().toISOString(),
        paperId: id,
      };
      writeFileSync(join(uploadDir, "import-meta.json"), JSON.stringify(meta, null, 2));
      log("import", `fetched arXiv:${arxivId} → ${relative(REPO_ROOT, uploadDir)}/`, `${sourceFiles.length} .tex files`);

      // Where the files WERE written, repo-relative: `uploads/${id}` named the
      // root's queue whichever directory the declaration resolved (bean `gz47`).
      return Response.json({ ok: true, paperId: id, uploadDir: relative(REPO_ROOT, uploadDir), meta }, {
        headers: { "Access-Control-Allow-Origin": "*" },
      });
    } catch (e) {
      return Response.json({ error: String(e) }, { status: 500 });
    }
  }

  // POST /api/import/scan { paperId } — scan uploaded files for environments
  if (path === "/api/import/scan") {
    try {
      const body = await req.json() as { paperId: string };
      // `6bhf`, fourth sink — missed when the other three were fixed, which is
      // this bean's own thesis: a correct helper stranded while a sibling route
      // hand-rolls `join()`. `/api/import/arxiv` validates 100 lines above.
      const scanId = safeSegment(body.paperId);
      if (scanId === undefined) {
        return Response.json({ error: "paperId must be one safe path segment" }, { status: 400 });
      }
      const uploadDir = join(UPLOADS_DIR(), scanId);
      const metaPath = join(uploadDir, "import-meta.json");
      if (!existsSync(metaPath)) {
        return Response.json({ error: `No import found: ${body.paperId}` }, { status: 404 });
      }
      const meta = JSON.parse(readFileSync(metaPath, "utf-8"));

      // Scan .tex files for theorem environments
      const envRe = /\\begin\{(theorem|definition|proposition|lemma|corollary|conjecture|example|remark|proof)\}(\[([^\]]*)\])?([\s\S]*?)\\end\{\1\}/g;
      const labelRe = /\\label\{([^}]+)\}/;
      const blocks: Array<{
        kind: string; title: string; label: string; body: string;
        file: string; line: number; originalEnv: string;
      }> = [];

      const { readdirSync } = await import("fs");
      const texFiles = meta.files?.length ? meta.files : readdirSync(uploadDir).filter((f: string) => f.endsWith(".tex"));

      for (const tf of texFiles) {
        // `meta.files` comes out of `import-meta.json`, which `/api/import/upload`
        // writes from the uploaded file's own name — so this is a SECOND
        // traversal that survives validating `paperId`, and the one that made
        // the read primitive reachable without a traversal in the identifier.
        // Not `safeSegment`: a `.tex` may legitimately sit in `sections/`, so
        // the question is containment rather than single-segment-ness.
        const texPath = realPathWithin(uploadDir, join(uploadDir, String(tf)));
        if (texPath === undefined) {
          log("import", `refused unsafe member`, `paperId=${scanId} file=${JSON.stringify(tf)}`);
          continue;
        }
        const src = readFileSync(texPath, "utf-8");
      
        let match;
        while ((match = envRe.exec(src)) !== null) {
          const kind = match[1];
          const optTitle = match[3] || "";
          const body = match[4].trim();
          const lblMatch = body.match(labelRe);
          const label = lblMatch?.[1] || "";

          // Find line number
          const beforeMatch = src.slice(0, match.index);
          const line = beforeMatch.split("\n").length;

          blocks.push({
            kind,
            title: optTitle,
            label,
            body: body.replace(labelRe, "").trim(),
            file: tf,
            line,
            originalEnv: match[0],
          });
        }

        // Also scan for custom theorem environments (\newtheorem{thm}{Theorem})
        const customRe = /\\newtheorem\{(\w+)\}(?:\[(\w+)\])?\{(\w+)\}/g;
        const customEnvs = new Map<string, string>();
        let cm;
        while ((cm = customRe.exec(src)) !== null) {
          const envName = cm[1];
          const displayName = cm[3].toLowerCase();
          const kindMap: Record<string, string> = {
            theorem: "theorem", definition: "definition", proposition: "proposition",
            lemma: "lemma", corollary: "corollary", conjecture: "conjecture",
            example: "example", remark: "remark",
          };
          customEnvs.set(envName, kindMap[displayName] || "theorem");
        }

        // Scan for custom environments
        for (const [envName, kind] of customEnvs) {
          const customEnvRe = new RegExp(`\\\\begin\\{${envName}\\}(\\[([^\\]]*)\\])?([\\s\\S]*?)\\\\end\\{${envName}\\}`, "g");
          let m;
          while ((m = customEnvRe.exec(src)) !== null) {
            const optTitle = m[2] || "";
            const body = m[3].trim();
            const lblMatch = body.match(labelRe);
            const beforeMatch = src.slice(0, m.index);
            blocks.push({
              kind,
              title: optTitle,
              label: lblMatch?.[1] || "",
              body: body.replace(labelRe, "").trim(),
              file: tf,
              line: beforeMatch.split("\n").length,
              originalEnv: m[0],
            });
          }
        }
      }

      // Cache extraction results
      writeFileSync(join(uploadDir, "extracted-blocks.json"), JSON.stringify(blocks, null, 2));

      // Summary
      const summary: Record<string, number> = {};
      for (const b of blocks) summary[b.kind] = (summary[b.kind] || 0) + 1;

      log("import", `scanned ${body.paperId}:`, `${blocks.length} blocks found`);
      return Response.json({ ok: true, paperId: body.paperId, meta, blocks, summary }, {
        headers: { "Access-Control-Allow-Origin": "*" },
      });
    } catch (e) {
      return Response.json({ error: String(e) }, { status: 500 });
    }
  }

  // POST /api/import/generate { paperId, blocks: [{kind, title, label, body, rootName}], chapterTitle }
  // Generates content objects from confirmed blocks
  if (path === "/api/import/generate") {
    try {
      const body = await req.json() as {
        paperId: string;
        chapterTitle?: string;
        chapterDir?: string;
        blocks: Array<{
          kind: string; title: string; label: string; body: string;
          rootName: string; generateLean?: boolean;
        }>;
        source?: { type: string; id: string; url: string; citationKey: string };
      };

      const paperDir = join(folioDir(REPO_ROOT),  body.paperId);
      const chDir = body.chapterDir || `imported-${body.source?.id || "upload"}`.replace(/[^a-z0-9-]/gi, "-").toLowerCase();
      const chapterPath = join(paperDir, chDir);
      mkdirSync(chapterPath, { recursive: true });

      const generated: string[] = [];
      const blockRefs: string[] = [];
      const { writeFileSync: wfs } = await import("fs");

      for (const blk of body.blocks) {
        const rn = blk.rootName;
        blockRefs.push(rn);

        // Generate .ts manifest
        const kindToPrefix: Record<string, string> = {
          definition: "def", theorem: "thm", lemma: "lem", proposition: "prop",
          corollary: "cor", conjecture: "conj", example: "ex", remark: "rem", proof: "prf",
        };
        const prefix = kindToPrefix[blk.kind] || "thm";
        const label = blk.label || `${prefix}:imported-${rn}`;

        const builderName = blk.kind === "proof" ? "proof" : blk.kind;
        const metaFields = body.source ? `\n  meta: { source: "${body.source.type}:${body.source.id}", originalLabel: "${blk.label || ""}", importedAt: "${new Date().toISOString()}" },` : "";
        const tagsField = `\n  tags: ["imported"${body.source ? `, "${body.source.type}:${body.source.id}"` : ""}],`;

        let tsContent = `import { ${builderName} } from "../../schema/builders";\n\nexport default ${builderName}({\n  label: "${label}",`;
        if (blk.title) tsContent += `\n  title: "${blk.title.replace(/"/g, '\\"')}",`;
        tsContent += tagsField;
        tsContent += metaFields;
        if (blk.kind === "definition") {
          tsContent += `\n  lean: { decl: "QOU.Imported.${rn.replace(/-/g, "_")}" },\n  status: "not_started",`;
        }
        tsContent += "\n});\n";
        wfs(join(chapterPath, `${rn}.ts`), tsContent);

        // Generate .md content
        let mdContent = blk.body || "";
        // Basic LaTeX → project markdown conversion
        mdContent = mdContent
          .replace(/\\textbf\{([^}]+)\}/g, "**$1**")
          .replace(/\\emph\{([^}]+)\}/g, "*$1*")
          .replace(/\\cite\{([^}]+)\}/g, "[$1]")
          .replace(/\\ref\{([^}]+)\}/g, "[](#$1)");
        wfs(join(chapterPath, `${rn}.md`), mdContent);

        generated.push(rn);
      }

      // Generate chapter manifest
      const chapterTs = `import { chapter } from "../../schema/builders";\n\nexport default chapter({\n  number: 99,\n  title: "${(body.chapterTitle || `Imported: ${body.source?.id || "Upload"}`).replace(/"/g, '\\"')}",\n  sections: [{\n    title: "Imported Results",\n    blocks: ${JSON.stringify(blockRefs)},\n  }],\n});\n`;
      wfs(join(chapterPath, `${chDir}.ts`), chapterTs);

      log("import", `generated ${generated.length} content objects`, `→ folio/${body.paperId}/${chDir}/`);
      return Response.json({
        ok: true,
        paperId: body.paperId,
        chapterDir: chDir,
        generated,
        // declared-path-literal: the folio content root. Resolving it through `directoryForGraph` is bean `hs08`; the harness-side callers hit `ot9a`'s layering boundary, so the literal is COUNTED here rather than hidden.
        path: `folio/${body.paperId}/${chDir}`,
      }, { headers: { "Access-Control-Allow-Origin": "*" } });
    } catch (e) {
      return Response.json({ error: String(e) }, { status: 500 });
    }
  }

  // GET /api/import/list — list all imports
  if (path === "/api/import/list") {
    // Handled as GET in handleViewerRequest
  }

  // ── AI triage: review feedback and propose action ────────────
  // POST /api/feedback/triage { paperId, rootName, todoId }
  if (path === "/api/feedback/triage") {
    try {
      const body = await req.json() as { paperId: string; rootName: string; todoId: string };
      const todos = readFeedback(body.paperId, body.rootName);
      const todo = todos.find(t => t.id === body.todoId);
      if (!todo) return Response.json({ error: "Todo not found" }, { status: 404 });

      // Read the block content for context (O(1) via blocksByName map)
      const paper = await resolvePaper(body.paperId);
      const blk = paper?.blocksByName?.get(body.rootName);
      const blockContent = blk?.md || "";
      const blockKind = blk?.kind || "";

      const triage = await triageFeedback(todo, blockContent, blockKind, body.paperId, body.rootName);
      return Response.json(triage, { headers: { "Access-Control-Allow-Origin": "*" } });
    } catch (e) {
      return Response.json({ error: String(e) }, { status: 500 });
    }
  }

  // ── Update feedback todo (priority / status) ──────────────────
  if (path === "/api/feedback/update") {
    try {
      const body = await req.json() as {
        paperId: string; rootName: string; todoId: string;
        priority?: string; status?: string;
      };
      // `priority` and `status` arrive off the wire as bare strings. Typing
      // the array surfaced that neither was ever checked against its enum, so
      // `{"status":"banana"}` was written to `main` verbatim and then read
      // back as a status no filter in this file matches — the item silently
      // vanished from every "open"/"resolved" view.
      const priority = parseTodoPriority(body.priority);
      const status = parseTodoStatus(body.status);
      if (priority === INVALID_ENUM || status === INVALID_ENUM) {
        return Response.json({
          error: `Invalid update: priority must be one of ${TODO_PRIORITIES.join("|")}, ` +
            `status one of ${TODO_STATUSES.join("|")}`,
        }, { status: 400 });
      }
      const todos = readFeedback(body.paperId, body.rootName);
      const idx = todos.findIndex((t) => t.id === body.todoId);
      if (idx < 0) return Response.json({ error: "Todo not found" }, { status: 404 });
      if (priority !== undefined) todos[idx].priority = priority;
      if (status !== undefined) todos[idx].status = status;
      writeFeedback(body.paperId, body.rootName, todos);
      return Response.json({ ok: true, todo: todos[idx] });
    } catch (e) {
      return Response.json({ error: String(e) }, { status: 500 });
    }
  }

  // ── Delete feedback todo (collaborator+ only) ─────────────────
  if (path === "/api/feedback/delete") {
    if (!allows(req, "review-comments")) {
      return forbidden("deleting feedback", "review-comments");
    }
    try {
      const body = await req.json() as {
        paperId: string; rootName: string; todoId: string;
      };
      const todos = readFeedback(body.paperId, body.rootName);
      const idx = todos.findIndex((t) => t.id === body.todoId);
      if (idx < 0) return Response.json({ error: "Todo not found" }, { status: 404 });
      todos.splice(idx, 1);
      writeFeedback(body.paperId, body.rootName, todos);
      return Response.json({ ok: true });
    } catch (e) {
      return Response.json({ error: String(e) }, { status: 500 });
    }
  }

  return null;
}

// ── Server setup ─────────────────────────────────────────────────

const server = new McpServer({
  name: "folio-assistant",
  version: "0.1.0",
}, {
  capabilities: {
    tools: {},
  },
});

// ── Logging ──────────────────────────────────────────────────────

const LOG_DEBUG = process.env.LOG_LEVEL !== 'quiet';
const LOG_JSON = process.env.LOG_FORMAT === 'json';

function log(category: string, message: string, detail?: string) {
  const ts = new Date().toISOString();
  if (LOG_JSON) {
    const entry: Record<string, unknown> = { ts, cat: category, msg: message };
    if (detail) entry.detail = detail;
    console.error(JSON.stringify(entry));
  } else {
    const d = detail ? ` ${detail}` : '';
    console.error(`[${ts.slice(11, 23)}] [${category}]  ${message}${d}`);
  }
}

function logDebug(category: string, message: string, detail?: string) {
  if (LOG_DEBUG) log(category, message, detail);
}

// ── Wrap server.tool with logging ─────────────────────────────────

const origTool = server.tool.bind(server);
server.tool = function (...args: Parameters<typeof origTool>) {
  const toolName = args[0] as string;
  // The handler is the last argument
  const handler = args[args.length - 1] as (...a: unknown[]) => Promise<unknown>;
  // `args` is a tuple whose last slot is a union of overload-specific handler
  // shapes; TS has no way to say "same overload, different last element", so
  // an in-place replacement cannot be expressed. Widen for the WRITE ONLY —
  // one expression, not the whole wrapper — and `origTool(...args)` below is
  // still checked against the real signature.
  (args as unknown[])[args.length - 1] = async (...handlerArgs: unknown[]) => {
    const start = Date.now();
    log('mcp', `→ ${toolName}`, JSON.stringify(handlerArgs[0] || {}).slice(0, 120));
    try {
      const result = await handler(...handlerArgs);
      log('mcp', `← ${toolName}`, `ok (${Date.now()-start}ms)`);
      return result;
    } catch (e) {
      log('mcp', `✗ ${toolName}`, `error: ${e instanceof Error ? e.message : String(e)} (${Date.now()-start}ms)`);
      throw e;
    }
  };
  return origTool(...args);
} as typeof origTool;

// ── Register the served tools ────────────────────────────────────

// The same two halves `src/server.ts` serves, by the same rule (owner,
// 2026-10-05, bean riit 3c), so this server no longer keeps a list of its own:
//
//   1. every Tool node in the folio's dependency tree, the harness's always,
//      each resolved from the layer that declares it;
//   2. the content adapter's own tools (`content_validate`, `paper_render_pdf`,
//      `lean_build`, …), from the adapter the folio's config names.
//
// Until then this server registered `TOOL_GROUPS`, six modules that were
// forks of those — older copies of core's and sci's tools and of three Tool
// nodes' modules, which had drifted apart in both directions.
//
// An absent or failed group is REPORTED and the server still starts: one
// quietly starting without `paper_render_pdf` looks identical to one where
// rendering is broken.
{
  const { outcomes, failures } = await registerServedToolGroups(server, contributionsRoot(), [contributionsRoot()]);
  for (const f of failures) log("mcp", "✗ tools graph", f);
  for (const o of outcomes) {
    if (o.state === "absent") log("mcp", `− ${o.id}`, `${o.layer} layer: ${o.detail}`);
    else if (o.state === "failed") log("mcp", `✗ ${o.id}`, o.detail);
  }
  try {
    const adapter = await createContentAdapter(REPO_ROOT, new GitHelper(REPO_ROOT));
    adapter.registerMcpTools?.(server);
  } catch (e) {
    log("mcp", "✗ content adapter tools", e instanceof Error ? e.message : String(e));
  }
}

// Tools CONTRIBUTED by the folio's declared dependencies — the direction that
// needs no name: the server walks what the layer declares and registers
// what each dependency's `contributes` module supplies, as qa-sweep already
// does for contributed QA checkers. `ContributionRegistry.registerTools` had
// no production caller until this block, so a contributed tool never reached
// any server (folio-assistant#1492, which contributes `lean_formal_edges` from
// a content package above this layer). A contribution that cannot load is REPORTED and the
// server still starts, the same stance as a failed tool group above.
try {
  // `contributionsRoot()` (#1523): the FOLIO's root, which is what declares
  // the dependencies that contribute. It falls back to the repository root
  // where a lookup would land on the platform's own `cat-harness/`, which
  // declares none, so loading from there would register nothing and look
  // exactly like "nothing to add". qa-sweep uses the same helper.
  const contributions = await loadContributions<FolioContribution, ContributionRegistry>(
    contributionsRoot(),
    new ContributionRegistry(),
  );
  contributions.registerTools(server);
  for (const name of contributions.contributedTools()) log("mcp", `+ ${name}`, "contributed tool");
} catch (e) {
  log("mcp", "✗ contributed tools", e instanceof Error ? e.message : String(e));
}

// ── Transport selection ──────────────────────────────────────────

const args = process.argv.slice(2);
const mode = args.includes("--http") ? "http" : "stdio";

if (args.includes("--check-deps")) {
  // Run real dependency check and exit — used by start-folio-assistant.sh --check
  const { execSync } = await import("child_process");

  interface DepInfo { name: string; required: boolean; cmd: string; hint: string }
  const deps: DepInfo[] = [
    { name: "bun",       required: true,  cmd: "bun --version",     hint: "curl -fsSL https://bun.sh/install | bash" },
    { name: "latexmk",   required: true,  cmd: "latexmk --version", hint: "sudo apt install latexmk" },
    { name: "pdflatex",  required: true,  cmd: "pdflatex --version", hint: "sudo apt install texlive-latex-base texlive-latex-extra" },
    { name: "pandoc",    required: false, cmd: "pandoc --version",  hint: "sudo apt install pandoc" },
    { name: "pdftoppm",  required: false, cmd: "which pdftoppm",    hint: "sudo apt install poppler-utils" },
    { name: "lean",      required: false, cmd: "lean --version",    hint: "Use MCP tool: lean_setup" },
    { name: "lake",      required: false, cmd: "which lake",        hint: "Installed with lean via elan" },
    { name: "uv",        required: false, cmd: "uv --version",      hint: "curl -LsSf https://astral.sh/uv/install.sh | sh" },
    { name: "rg",        required: false, cmd: "rg --version",      hint: "sudo apt install ripgrep" },
    { name: "xdg-open",  required: false, cmd: "which xdg-open",    hint: "sudo apt install xdg-utils" },
  ];

  console.log("\nDependency check:\n");
  let missingReq = 0;
  for (const d of deps) {
    let ok = false;
    try { execSync(d.cmd, { stdio: "pipe" }); ok = true; } catch {}
    const icon = ok ? "✓" : (d.required ? "✗" : "○");
    const tag = d.required ? "(required)" : "(optional)";
    console.log(`  ${icon} ${d.name.padEnd(12)} ${tag}`);
    if (!ok) {
      console.log(`    Install: ${d.hint}`);
      if (d.required) missingReq++;
    }
  }
  console.log(missingReq > 0
    ? `\n⚠  ${missingReq} required dep(s) missing!\n`
    : `\n✓  All required deps present.\n`);
  process.exit(missingReq > 0 ? 1 : 0);
}

if (mode === "stdio") {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Start viewer HTTP server on a separate port
  const viewerPort = FOLIO_PORT;

  const hostname = bindHostname();
  Bun.serve({
    port: viewerPort,
    hostname,
    async fetch(rawReq) {
      const req = trustedRequest(rawReq, hostname);
      const url = new URL(req.url);
      const start = Date.now();
      logDebug('http', `${req.method} ${url.pathname}`);

      // Root → redirect to assistant
      if (url.pathname === "/" || url.pathname === "") {
        return Response.redirect(`http://localhost:${viewerPort}/assistant/`, 302);
      }

      // Health check
      if (url.pathname === "/health") {
        return Response.json({ status: "ok", mode: "stdio", version: "0.1.0" });
      }

      // POST requests (save, feedback, import, git ops)
      if (req.method === "POST") {
        const postRes = await handlePostRequest(url, req);
        if (postRes) { logDebug('http', `${req.method} ${url.pathname}`, `→ ${postRes.status} (${Date.now()-start}ms)`); return postRes; }
      }

      const viewerRes = await handleViewerRequest(url);
      if (viewerRes) { logDebug('http', `${req.method} ${url.pathname}`, `→ ${viewerRes.status} (${Date.now()-start}ms)`); return viewerRes; }

      logDebug('http', `${req.method} ${url.pathname}`, `→ 404 (${Date.now()-start}ms)`);
      return new Response("Not found", { status: 404 });
    },
  });

  log('init', `MCP server started (stdio, repo: ${REPO_ROOT})`);
  const branch = currentBranch();
  const branchSuffix = branch && branch !== 'main' && branch !== 'master'
    ? `#/@${encodeURIComponent(branch)}` : '';
  log('init', `Viewer: http://localhost:${viewerPort}/viewer/${branchSuffix}`);
} else {
  // HTTP mode — MCP + viewer on same port
  const port = FOLIO_PORT;
  // The WEB-STANDARD transport, whose `handleRequest(req: Request):
  // Promise<Response>` is exactly what the `/mcp` route below calls.
  //
  // This imported `StreamableHTTPServerTransport`, whose `handleRequest` is
  // Node's `(req: IncomingMessage, res: ServerResponse, body?)`. It was being
  // handed a Bun `Request` and nothing else, so `--http` mode — documented as
  // the remote/Docker deployment path — could never have served `/mcp`.
  // Invisible because `adapters/**` was never type-checked.
  const { WebStandardStreamableHTTPServerTransport } = await import(
    "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js"
  );

  const httpTransport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  await server.connect(httpTransport);

  const hostname = bindHostname();
  Bun.serve({
    port,
    hostname,
    async fetch(rawReq) {
      const url = new URL(rawReq.url);
      const start = Date.now();
      logDebug('http', `${rawReq.method} ${url.pathname}`);

      // MCP endpoint: only the auth-gateway's requests (src/core/gateway-trust.ts)
      if (url.pathname === "/mcp") {
        return refuseMcp(rawReq, hostname) ?? httpTransport.handleRequest(rawReq);
      }
      const req = trustedRequest(rawReq, hostname);

      // Health check
      if (url.pathname === "/health") {
        return Response.json({ status: "ok", mode: "http", version: "0.1.0" });
      }

      // Root → redirect to assistant
      if (url.pathname === "/" || url.pathname === "") {
        return Response.redirect(`/assistant/`, 302);
      }

      // POST/DELETE requests
      if (req.method === "POST" || req.method === "DELETE") {
        const postRes = await handlePostRequest(url, req);
        if (postRes) { logDebug('http', `${req.method} ${url.pathname}`, `→ ${postRes.status} (${Date.now()-start}ms)`); return postRes; }
      }

      // Viewer/Assistant routes
      const viewerRes = await handleViewerRequest(url);
      if (viewerRes) return viewerRes;

      return new Response("Not found", { status: 404 });
    },
  });

  console.error(`[qou-mcp] Assistant started (HTTP :${port}, repo: ${REPO_ROOT})`);
  console.error(`[qou-mcp] MCP: http://localhost:${port}/mcp`);
  const brH = currentBranch();
  const brSuffix = brH && brH !== 'main' && brH !== 'master'
    ? `#/@${encodeURIComponent(brH)}` : '';
  console.error(`[qou-mcp] Viewer: http://localhost:${port}/viewer/${brSuffix}`);
}
