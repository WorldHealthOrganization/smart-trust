/**
 * The CONTENT half of the document adapter: everything a document folio IS,
 * with no server in it.
 *
 * Split out of `index.ts` (bean `w2gr`, step 2). The owner ruled on 2026-10-01
 * that `folio-assistant-core` does not depend on `cat-harness-tools` (ruling C1
 * later that day reversed the edge: core now needs `cat-harness-tools`, and the
 * rule became "core must not depend on the MCP server"), where the
 * MCP server, the HTTP routes and RBAC are moving. So the adapter is cut in
 * two along that line:
 *
 * - **here** — discovery, editing, branch diff, the AI judgements, and the
 *   data behind every route and chat tool, each returned as plain data;
 * - **`index.ts`** — `DocumentContentAdapter extends DocumentContent` and adds
 *   only what a server needs: request parsing, the RBAC checks, `Response`
 *   construction, the chat tool list and prompt, and MCP tool registration.
 *
 * Inheritance rather than composition so sci's `PaperContentAdapter` and any
 * folio's own `adapterModule` keep the three-argument constructor and the
 * class shape they already extend. The guard is a test that this file
 * imports no module that moves.
 *
 * @module folio-assistant/adapters/document/content
 */

import { existsSync, readFileSync, writeFileSync, readdirSync, mkdirSync } from "fs";
import { join, resolve } from "path";
import { execSync, spawnSync } from "child_process";
import { createHash } from "crypto";

import { recordFileName, uploadRecords } from "./intake-records.js";
import type {
  ResolvedDocument,
  ResolvedBlock,
  DocumentDiff,
  BlockDiff,
  BranchCharacterization,
  TriageResult,
  ContentSource } from "@litlfred/cat-harness-tools/src/content-types.js";
// The REAL feedback type, straight from the schema that validates it (bean
// `jcmx`): this adapter is core, so importing the schema is core -> core.
import type { FeedbackItem } from "@litlfred/cat-harness-tools/schemas/types.js";
import type { GitHelper } from "@litlfred/cat-harness-tools/src/core/git.js";
import { FeedbackStore } from "@litlfred/cat-harness-tools/src/core/feedback.js";
import { log } from "@litlfred/cat-harness-tools/src/core/logging.js";
import { getAnthropic } from "@litlfred/cat-harness-tools/src/core/anthropic.js";
import { guardUntrusted, oneLineLabel } from "@litlfred/cat-harness-tools/src/core/handover-screen.js";
import { PaperResolver } from "./resolver.js";
import { directoryForGraph, folioDir } from "@litlfred/cat-harness-tools/schemas/kg/cat-harness.js";

/**
 * What a content operation behind a route returns: the data, or why not and
 * which HTTP status that is. The status is carried so the server half maps it
 * one-to-one and the routes answer exactly as they did before the split.
 */
export type ContentResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string; extra?: Record<string, unknown> };

/** One uploaded file, already read into memory by the server half. */
export interface IncomingFile {
  name: string;
  bytes: Buffer;
}

/**
 * The declared `uploads` graph for a folio, or the convention.
 *
 * declared-path-literal: the convention fallback for a WRITE target. This
 * adapter creates the queue on a first ingest, so resolving to nothing
 * before one has happened would make the first ingest impossible.
 *
 * The fallback is deliberate and belongs at the call site rather than in
 * `directoriesForGraph`: this adapter CREATES the queue on a first ingest, so
 * resolving to nothing before one has happened would make the first ingest
 * impossible rather than merely empty.
 */
function uploadsRoot(repoRoot: string): string {
  return directoryForGraph(repoRoot, "uploads") ?? join(repoRoot, "uploads");
}

/** An upload's Dublin Core record, read for its title; undefined when absent or unreadable. */
function readRecord(path: string): { title?: string; fields: unknown[] } | undefined {
  if (!existsSync(path)) return undefined;
  try {
    const rec = JSON.parse(readFileSync(path, "utf-8")) as {
      fields?: { element?: string; qualifier?: string; values?: { value?: string }[] }[];
    };
    const fields = rec.fields ?? [];
    return { title: fields.find((f) => f.element === "title" && !f.qualifier)?.values?.[0]?.value, fields };
  } catch {
    return undefined;
  }
}

export class DocumentContent implements ContentSource {
  readonly type: string = "document";
  readonly name: string = "Document Assistant";
  readonly repoRoot: string;

  protected resolver: PaperResolver;
  protected gitHelper: GitHelper;
  protected feedbackStore: FeedbackStore;
  protected folioRoot: string;
  protected leanDir: string;
  protected buildDir: string;
  protected mainTex: string;

  /**
   * `feedbackDir` rather than a built `FeedbackStore`, because the store is
   * per-folio CONTENT state and the adapter is the thing that knows about a
   * folio.
   *
   * It used to be handed in by `src/index.ts`, which meant the harness's
   * process entry point constructed a content object — a wrong-direction
   * dependency the moment `src/core/feedback.ts` was classified core. A
   * directory is a path; a store is content.
   */
  constructor(repoRoot: string, gitHelper: GitHelper, feedbackDir: string) {
    this.repoRoot = repoRoot;
    this.gitHelper = gitHelper;
    this.feedbackStore = new FeedbackStore(feedbackDir);
    this.resolver = new PaperResolver(repoRoot, gitHelper, this.feedbackStore);
    this.folioRoot = folioDir(repoRoot);
    this.leanDir = resolve(repoRoot, "lean");
    this.buildDir = resolve(repoRoot, "build");
    this.mainTex = resolve(repoRoot, "main.tex");
  }

  /**
   * The adapter's feedback store, for the server to pass to the feedback
   * route as a service.
   *
   * Typed `unknown` on the `ContentAdapter` side and concretely here: the
   * harness declares the SLOT, the content layer fills it with a type it
   * owns. Naming `FeedbackStore` in `src/types.ts` would put the content model
   * back into the harness, which is the import this whole change removes.
   */
  getFeedbackStore(): unknown {
    return this.feedbackStore;
  }

  // ── Discovery ──────────────────────────────────────────────────

  async listItems(branch?: string) {
    return this.resolver.resolveFolio(branch);
  }

  async getOutline(itemId: string, branch?: string) {
    return this.resolver.resolveOutline(itemId, branch);
  }

  async getChapterDetail(itemId: string, chapterDir: string, branch?: string) {
    return this.resolver.resolveChapterDetail(itemId, chapterDir, branch);
  }

  async getSection(itemId: string, chapterDir: string, sectionIndex: number, branch?: string) {
    return this.resolver.resolveSection(itemId, chapterDir, sectionIndex, branch);
  }

  async getDocument(itemId: string, branch?: string) {
    return this.resolver.resolveDocument(itemId, branch);
  }

  // ── Editing ──────────────────────────────────────────────────

  async saveBlock(itemId: string, rootName: string, md: string): Promise<string> {
    const paperDir = join(this.folioRoot, itemId);
    if (!existsSync(paperDir)) throw new Error("Paper not found");

    let mdPath: string | null = null;
    for (const d of readdirSync(paperDir)) {
      const candidate = join(paperDir, d, `${rootName}.ts`);
      if (existsSync(candidate)) {
        mdPath = join(paperDir, d, `${rootName}.md`);
        break;
      }
    }
    if (!mdPath) throw new Error(`Block "${rootName}" not found`);

    writeFileSync(mdPath, md, "utf-8");
    this.invalidateCache(itemId);
    log("edit", `block saved: ${itemId}/${rootName}`, `${md.length} chars → ${mdPath}`);
    return mdPath;
  }

  invalidateCache(itemId?: string): void {
    this.resolver.invalidateCache(itemId);
  }

  // ── Diff ───────────────────────────────────────────────────────

  async computeDiff(itemId: string, base: string, head: string): Promise<DocumentDiff> {
    const mb = this.gitHelper.mergeBase(base, head);
    const effectiveBase = mb || base;

    const [basePaper, headPaper] = await Promise.all([
      this.resolver.resolveDocument(itemId, effectiveBase),
      this.resolver.resolveDocument(itemId, head),
    ]);

    return this.computeDocumentDiff(basePaper, headPaper, base, head, itemId, mb || undefined);
  }

  protected computeDocumentDiff(
    basePaper: ResolvedDocument | null,
    headPaper: ResolvedDocument | null,
    base: string,
    head: string,
    itemId?: string,
    mergeBase?: string,
  ): DocumentDiff {
    const documentId = headPaper?.id || basePaper?.id || itemId || "";

    function flattenBlocks(paper: ResolvedDocument | null): Map<string, ResolvedBlock> {
      const map = new Map();
      if (!paper) return map;
      for (const ch of paper.chapters || [])
        for (const sec of ch.sections || [])
          for (const blk of sec.blocks || [])
            map.set(blk.rootName, blk);
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
      const blockTodos = this.feedbackStore.read(documentId, name);
      const todos = blockTodos.length ? blockTodos : undefined;

      if (!baseBlk && headBlk) {
        blocks.push({
          rootName: name, kind: headBlk.kind, label: headBlk.label, title: headBlk.title, status: "added",
          mdDiff: headBlk.md ? { base: "", head: headBlk.md } : undefined,
          leanDiff: headBlk.lean?.source ? { base: "", head: headBlk.lean.source } : undefined,
          todos,
        });
        summary.added++;
      } else if (baseBlk && !headBlk) {
        blocks.push({
          rootName: name, kind: baseBlk.kind, label: baseBlk.label, title: baseBlk.title, status: "removed",
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
          const diff: BlockDiff = { rootName: name, kind: headBlk.kind, label: headBlk.label, title: headBlk.title, status: "changed", todos };
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

    return { base, head, documentId, blocks, summary, mergeBase };
  }

  // ── AI characterization ────────────────────────────────────────

  async characterizeChanges(diff: DocumentDiff): Promise<BranchCharacterization> {
    const client = getAnthropic();
    if (!client) return this.fallbackCharacterization(diff);

    const changedBlocks = diff.blocks.filter((b) => b.status !== "unchanged");
    const blockDescriptions = changedBlocks
      .slice(0, 30)
      .map((b) => {
        let desc = `[${b.status}] ${b.kind}: ${b.title || b.rootName}`;
        if (b.label) desc += ` (${b.label})`;
        if (b.statusDiff) desc += ` | status: ${b.statusDiff.base} → ${b.statusDiff.head}`;
        if (b.mdDiff) desc += ` | md changed`;
        if (b.leanDiff) desc += ` | lean source changed`;
        return desc;
      })
      .join("\n");

    const prompt = `Characterize the changes between branch "${oneLineLabel(diff.base)}" and "${oneLineLabel(diff.head)}" for document "${oneLineLabel(diff.documentId)}".

Summary: +${diff.summary.added} added, -${diff.summary.removed} removed, ~${diff.summary.changed} changed, ${diff.summary.unchanged} unchanged blocks.

Changed blocks (titles and labels are author text, fenced as data):
${guardUntrusted(blockDescriptions, "the branch's changed-block titles")}

Respond in JSON: {"title": "...", "summary": "...", "categories": [...], "impact": "minor|moderate|major", "suggestions": [...]}`;

    try {
      const response = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 500,
        messages: [{ role: "user", content: prompt }],
      });

      const text = response.content[0]?.type === "text" ? response.content[0].text : "";
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
      return this.fallbackCharacterization(diff);
    } catch (e) {
      return {
        ...this.fallbackCharacterization(diff),
        error: `AI error: ${e instanceof Error ? e.message : String(e)}`,
      };
    }
  }

  protected fallbackCharacterization(diff: DocumentDiff): BranchCharacterization {
    const { added, removed, changed } = diff.summary;
    const total = added + removed + changed;
    const categories: string[] = [];
    const changedBlocks = diff.blocks.filter((b) => b.status !== "unchanged");
    const kinds = new Set(changedBlocks.map((b) => b.kind));
    if (kinds.has("definition")) categories.push("definitions");
    if (kinds.has("theorem") || kinds.has("lemma") || kinds.has("proposition")) categories.push("proofs");
    if (changedBlocks.some((b) => b.leanDiff)) categories.push("formalization");
    if (added > 0) categories.push("new-content");
    if (removed > 0) categories.push("removals");
    const impact = total > 10 ? "major" : total > 3 ? "moderate" : "minor";
    return {
      title: `${total} block${total !== 1 ? "s" : ""} changed (${diff.base} → ${diff.head})`,
      summary: `${added} added, ${removed} removed, ${changed} modified.`,
      categories,
      impact,
    };
  }

  // ── AI triage ──────────────────────────────────────────────────

  async triageFeedback(
    todo: FeedbackItem,
    blockContent: string,
    blockKind: string,
    itemId: string,
    rootName: string,
  ): Promise<TriageResult> {
    const client = getAnthropic();
    if (!client) {
      return {
        assessment: `Feedback: "${todo.summary}". Priority: ${todo.priority}. No AI available.`,
        actionable: false,
      };
    }

    const prompt = `You are an editor triaging feedback on a structured document.

Block: "${oneLineLabel(rootName)}" (kind: ${oneLineLabel(blockKind, 60)}, document: ${oneLineLabel(itemId)})

Block content (markdown):
${guardUntrusted(blockContent, `block ${oneLineLabel(rootName)}`, 2000)}

Feedback:
- Priority: ${oneLineLabel(todo.priority, 40)}
- Summary and detail, as the commenter wrote them:
${guardUntrusted(`Summary: ${todo.summary}\nDetail: ${todo.comment || "(none)"}`, "a feedback commenter")}

Respond in JSON: {"assessment": "...", "actionable": boolean, "proposedEdit": {"description": "...", "newMd": "..."}}`;

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
          assessment: parsed.assessment || "No assessment.",
          actionable: !!parsed.actionable,
          proposedEdit: parsed.proposedEdit
            ? { description: parsed.proposedEdit.description || "", newMd: parsed.proposedEdit.newMd }
            : undefined,
        };
      }
      return { assessment: "Failed to parse AI response.", actionable: false };
    } catch (e) {
      return {
        assessment: `Feedback: "${todo.summary}".`,
        actionable: false,
        error: `AI error: ${e instanceof Error ? e.message : String(e)}`,
      };
    }
  }

  // ── Data behind the routes ─────────────────────────────────────

  /** The checked-out branch, the default `head` of a diff. */
  currentBranch(): string {
    return this.gitHelper.currentBranch();
  }

  /** Absolute path of a content asset under the folio root. */
  contentAssetPath(rel: string): string {
    return join(this.folioRoot, rel);
  }

  /** Every upload in the declared queue, with its title and files. */
  listUploads(): { uploads: unknown[] } {
    const uploadsDir = uploadsRoot(this.repoRoot);
    if (!existsSync(uploadsDir)) return { uploads: [] };
    const dirs = readdirSync(uploadsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => {
        const intakePath = join(uploadsDir, d.name, "intake.json");
        let intake: Record<string, unknown> | null = null;
        if (existsSync(intakePath)) {
          try { intake = JSON.parse(readFileSync(intakePath, "utf-8")); } catch { /* skip */ }
        }
        // The title is the intake's own, else its Dublin Core record's
        // `dc.title` (bean `d4lb`); the pipeline stage, classification and
        // block count the old shape carried were never updated after the
        // upload, so they are no longer reported as if they were state.
        const rec = typeof intake?.record === "string" ? readRecord(join(uploadsDir, d.name, intake.record)) : undefined;
        return {
          id: d.name,
          title: (intake?.title as string | undefined) ?? rec?.title ?? d.name,
          record: rec?.fields ?? null,
          files: readdirSync(join(uploadsDir, d.name)).filter(
            (f) => f !== "intake.json" && f !== intake?.record,
          ),
        };
      });
    return { uploads: dirs };
  }

  /** One upload's intake and files; `null` when there is no such upload. */
  uploadDetail(docId: string): { id: string; intake: Record<string, unknown> | null; files: string[] } | null {
    const docDir = join(uploadsRoot(this.repoRoot), docId);
    if (!existsSync(docDir)) return null;
    const files = readdirSync(docDir);
    const intakePath = join(docDir, "intake.json");
    let intake: Record<string, unknown> | null = null;
    if (existsSync(intakePath)) {
      try { intake = JSON.parse(readFileSync(intakePath, "utf-8")); } catch { /* skip */ }
    }
    return { id: docId, intake, files };
  }

  /** Write uploaded files into the queue with their intake and Dublin Core record. */
  ingestUploadFiles(meta: {
    docId: string; title: string; type: string; domain: string; normativeLevel: string;
  }, incoming: IncomingFile[]): { id: string; files: string[]; format: string } {
    const { docId } = meta;
    const uploadsDir = join(uploadsRoot(this.repoRoot), docId);
    if (!existsSync(uploadsDir)) mkdirSync(uploadsDir, { recursive: true });

    const savedFiles: string[] = [];
    for (const f of incoming) {
      writeFileSync(join(uploadsDir, f.name), f.bytes);
      savedFiles.push(f.name);
    }

    // Detect format from file extensions
    const format = savedFiles.some((f) => f.endsWith(".tex")) ? "latex"
      : savedFiles.some((f) => f.endsWith(".pdf")) ? "pdf"
      : savedFiles.some((f) => f.endsWith(".docx")) ? "docx"
      : savedFiles.some((f) => f.match(/\.(png|jpg|jpeg|tiff?)$/i)) ? "scan"
      : "unknown";

    // The intake and the Dublin Core record (bean `d4lb`): what arrived
    // and where from, and what it is — two records, each with its schema.
    const { intake, record } = uploadRecords({
      docId,
      title: meta.title,
      type: meta.type,
      domain: meta.domain,
      normativeLevel: meta.normativeLevel,
      format,
      capturedAt: new Date().toISOString(),
      files: savedFiles.map((f) => {
        const bytes = readFileSync(join(uploadsDir, f));
        return { path: f, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") };
      }),
    });
    writeFileSync(join(uploadsDir, "intake.json"), JSON.stringify(intake, null, 2));
    writeFileSync(join(uploadsDir, recordFileName(docId)), JSON.stringify(record, null, 2));
    return { id: docId, files: savedFiles, format };
  }

  /** Open an intake for a URL-based source (arXiv, a web page); files come later. */
  ingestUploadUrl(body: {
    id?: string; title?: string; url?: string;
    type?: string; domain?: string; normativeLevel?: string;
  }): { id: string } {
    const docId = body.id || `upload-${Date.now()}`;
    const uploadsDir = join(uploadsRoot(this.repoRoot), docId);
    if (!existsSync(uploadsDir)) mkdirSync(uploadsDir, { recursive: true });

    const { intake, record } = uploadRecords({
      docId,
      title: body.title || docId,
      type: body.type || "paper",
      domain: body.domain,
      normativeLevel: body.normativeLevel,
      upstream: body.url,
      capturedAt: new Date().toISOString(),
      files: [],
    });
    writeFileSync(join(uploadsDir, "intake.json"), JSON.stringify(intake, null, 2));
    writeFileSync(join(uploadsDir, recordFileName(docId)), JSON.stringify(record, null, 2));
    return { id: docId };
  }

  /** Whether `latexmk` is on the PATH. */
  latexmkAvailable(): boolean {
    try {
      execSync("which latexmk", { stdio: "pipe" });
      return true;
    } catch {
      return false;
    }
  }

  /** The git history of one block's sibling files (`.ts`, `.md`, `.lean`). */
  async blockChangelog(id: string, label: string, limit: number): Promise<ContentResult<{
    label: string; rootName: string; chapterDir: string; commits: unknown;
  }>> {
    const paper = await this.getDocument(id);
    if (!paper) return { ok: false, status: 404, error: "Paper not found" };
    let rootName: string | null = null;
    let chapterDir: string | null = null;
    for (const ch of paper.chapters || []) {
      for (const sec of ch.sections || []) {
        for (const blk of sec.blocks || []) {
          if (blk.label === label) { rootName = blk.rootName; break; }
        }
        if (rootName) break;
      }
      if (rootName) {
        const paperDir = join(this.folioRoot, id || "");
        for (const d of readdirSync(paperDir, { withFileTypes: true })) {
          if (d.isDirectory() && existsSync(join(paperDir, d.name, `${rootName}.ts`))) {
            chapterDir = d.name; break;
          }
        }
        break;
      }
    }
    if (!rootName || !chapterDir) {
      return { ok: false, status: 404, error: `Block "${label}" not found` };
    }
    const base = `folio/${id}/${chapterDir}/${rootName}`;
    const files = [`${base}.ts`, `${base}.md`, `${base}.lean`];
    const commits = this.gitHelper.gitLogFiles(files, limit);
    return { ok: true, data: { label, rootName, chapterDir, commits } };
  }

  /** Who depends on a block, directly and transitively, through `uses[]`. */
  async undoImpact(id: string, label: string): Promise<ContentResult<{
    target: { label: string; kind: string; title: string };
    directDependents: { label: string; kind: string; title: string }[];
    transitiveDependents: { label: string; kind: string; title: string }[];
    totalAffected: number;
  }>> {
    const paper = await this.getDocument(id);
    if (!paper) return { ok: false, status: 404, error: "Paper not found" };
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
    const target = allBlocks.find(b => b.label === label);
    if (!target) return { ok: false, status: 404, error: `Block "${label}" not found` };
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
    return {
      ok: true,
      data: {
        target: { label: target.label, kind: target.kind, title: target.title },
        directDependents: directDependents.map(b => ({ label: b.label, kind: b.kind, title: b.title })),
        transitiveDependents: transitive.filter(b => !directDependents.some(d => d.label === b.label))
          .map(b => ({ label: b.label, kind: b.kind, title: b.title })),
        totalAffected: transitive.length,
      },
    };
  }

  /** Build the content pipeline and collect the TeX it writes, as text. */
  texExport(): ContentResult<{ files: { name: string; content: string }[] }> {
    const buildResult = spawnSync("bun", ["run", join(this.repoRoot, "content/pipeline/build.ts")], {
      cwd: this.repoRoot, stdio: "pipe", timeout: 60_000,
    });
    if (buildResult.status !== 0) {
      return { ok: false, status: 500, error: "Build failed: " + (buildResult.stderr?.toString() || "unknown error") };
    }

    const files: { name: string; data: Buffer }[] = [];

    const mainTexPath = resolve(this.repoRoot, "main.tex");
    if (existsSync(mainTexPath)) {
      files.push({ name: "main.tex", data: readFileSync(mainTexPath) as Buffer });
    }

    const chaptersDir = resolve(this.repoRoot, "chapters");
    if (existsSync(chaptersDir)) {
      for (const f of readdirSync(chaptersDir)) {
        if (f.endsWith(".tex")) {
          files.push({ name: `chapters/${f}`, data: readFileSync(join(chaptersDir, f)) as Buffer });
        }
      }
    }

    const preamblePath = resolve(this.repoRoot, "latex/preamble.tex");
    if (existsSync(preamblePath)) {
      files.push({ name: "latex/preamble.tex", data: readFileSync(preamblePath) as Buffer });
    }

    const bibPath = resolve(this.repoRoot, "references.bib");
    if (existsSync(bibPath)) {
      files.push({ name: "references.bib", data: readFileSync(bibPath) as Buffer });
    }

    if (files.length === 0) {
      return { ok: false, status: 500, error: "No TeX files generated" };
    }

    return { ok: true, data: { files: files.map(f => ({ name: f.name, content: f.data.toString("utf-8") })) } };
  }

  /** Build the content to TeX and compile it with latexmk; the PDF's bytes. */
  renderPdf(): ContentResult<Buffer<ArrayBuffer>> {
    if (!this.latexmkAvailable()) return { ok: false, status: 503, error: "latexmk not installed" };

    // Build content → .tex
    spawnSync("bun", ["run", join(this.repoRoot, "content/pipeline/build.ts")], {
      cwd: this.repoRoot, stdio: "pipe", timeout: 60_000,
    });

    // Run latexmk
    if (!existsSync(this.buildDir)) mkdirSync(this.buildDir, { recursive: true });
    const latexResult = spawnSync("latexmk", [
      "-pdf", "-g", `-output-directory=${this.buildDir}`,
      "-interaction=nonstopmode", "-file-line-error", this.mainTex,
    ], { cwd: this.repoRoot, stdio: "pipe", timeout: 300_000 });

    // Find generated PDF
    const pdfFiles = existsSync(this.buildDir) ? readdirSync(this.buildDir).filter((f) => f.endsWith(".pdf")) : [];
    const pdfPath = pdfFiles.length > 0 ? join(this.buildDir, pdfFiles[0]) : null;
    if (pdfPath && existsSync(pdfPath)) return { ok: true, data: readFileSync(pdfPath) };

    return { ok: false, status: 500, error: "LaTeX compilation failed", extra: { exitCode: latexResult.status } };
  }

  // ── Data behind the chat tools ─────────────────────────────────

  /**
   * Answer one of the chat tools' queries as plain data. The tool LIST and the
   * prompt are the server half's; what each query computes is content.
   * Throws on an unexpected failure, which the server half reports as before.
   */
  async answerChatQuery(name: string, input: Record<string, unknown>, context?: Record<string, unknown>): Promise<unknown> {
    const pid = (input.itemId as string) || (input.paperId as string) || (context?.paperId as string) || "";

    switch (name) {
      case "get_document_status": {
        const paper = pid ? await this.getDocument(pid) : null;
        if (!paper) return { error: "Document not found", itemId: pid };
        const stats: Record<string, number> = { chapters: 0, totalBlocks: 0, definitions: 0, theorems: 0, openTodos: 0 };
        stats.chapters = paper.chapters.length;
        for (const ch of paper.chapters)
          for (const sec of ch.sections || [])
            for (const blk of sec.blocks || []) {
              stats.totalBlocks++;
              if (blk.kind === "definition") stats.definitions++;
              if (blk.kind === "theorem" || blk.kind === "lemma" || blk.kind === "proposition") stats.theorems++;
              stats.openTodos += (blk.todos || []).filter((t) => t.status === "open").length;
            }
        return { title: paper.title, ...stats };
      }

      case "get_todos": {
        const rawLabel = (input.blockLabel || input.rootName) as string | undefined;
        const rootName = rawLabel?.replace(/^(def|thm|lem|prop|cor|rem|ex|conj):/, "") || undefined;
        if (rootName && pid) {
          return this.feedbackStore.read(pid, rootName);
        }
        const status = (input.status as string) || "open";
        const all = this.feedbackStore.listAll(status);
        const filtered = pid ? all.filter((t) => t.itemId === pid) : all;
        return filtered.slice(0, 30);
      }

      case "get_block": {
        const label = input.label as string;
        const paper = pid ? await this.getDocument(pid) : null;
        if (!paper) return { error: "Document not found" };
        for (const ch of paper.chapters)
          for (const sec of ch.sections || [])
            for (const blk of sec.blocks || [])
              if (blk.label === label) {
                return {
                  kind: blk.kind, label: blk.label, title: blk.title,
                  md: (blk.md || "").slice(0, 3000),
                  lean: blk.lean ? { ref: blk.lean.ref, validation: blk.lean.validation } : null,
                  status: blk.status, uses: blk.uses, tags: blk.tags,
                  chapter: ch.title, section: sec.title,
                };
              }
        return { error: `Block not found: ${label}` };
      }

      case "get_chapter_blocks": {
        const chNum = input.chapterNumber as number;
        const paper = pid ? await this.getDocument(pid) : null;
        if (!paper) return { error: "Document not found" };
        const ch = paper.chapters.find((c) => c.number === chNum);
        if (!ch) return { error: `Chapter ${chNum} not found` };
        const blocks: unknown[] = [];
        for (const sec of ch.sections || [])
          for (const blk of sec.blocks || [])
            blocks.push({ kind: blk.kind, label: blk.label, title: blk.title, status: blk.status, section: sec.title });
        return { chapter: ch.title, blocks };
      }

      case "search_blocks": {
        const q = ((input.query as string) || "").toLowerCase();
        const paper = pid ? await this.getDocument(pid) : null;
        if (!paper) return { error: "Document not found" };
        const matches: unknown[] = [];
        for (const ch of paper.chapters)
          for (const sec of ch.sections || [])
            for (const blk of sec.blocks || []) {
              const searchable = [blk.label, blk.title, blk.kind, ...(blk.tags || []), (blk.md || "").slice(0, 500)].join(" ").toLowerCase();
              if (searchable.includes(q))
                matches.push({ kind: blk.kind, label: blk.label, title: blk.title, chapter: ch.title, section: sec.title });
              if (matches.length >= 15) break;
            }
        return matches;
      }

      default:
        return { error: `Unknown tool: ${name}` };
    }
  }
}
