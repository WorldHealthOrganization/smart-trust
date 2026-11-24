/**
 * The adapter for a layer that holds no content.
 *
 * A harness layer (`cat-harness`, `bootstrap`) declares no content type and
 * carries no adapter: every content adapter lives above it. Until 2026-10-04
 * the server refused to start in that case — *"A server with no adapter can
 * serve no content, so it does not start"* — so a fresh layer standing on
 * `cat-harness` alone could not reach `folio_init`, `skill_fetch` or the
 * workflow tools over MCP. Measured by bean `zmdo`'s rehearsal; the owner
 * ruled the same day that the server starts with the generic tools only.
 *
 * It registers no MCP tools of its own: the generic ones come from the
 * server, which reads them from the harness's Tool nodes.
 *
 * Every content read answers EMPTY (no items, no outline), and every content
 * write or analysis REFUSES with a message naming why. Empty for reads,
 * because "this instance lists no documents" is true; a refusal for writes,
 * because a silent no-op would report a save that never happened.
 *
 * @module cat-harness/src/no-content-adapter
 */

import type {
  BranchCharacterization,
  ChapterDetail,
  ContentAdapter,
  ContentOutline,
  DocumentDiff,
  FolioItem,
  ResolvedDocument,
  ResolvedSection,
  TriageResult,
} from "./types.js";

/** Why a content operation was refused — one sentence, reused by every refusal. */
export const NO_CONTENT =
  "this instance holds no content: no content adapter is installed, so only the generic tools are served";

export class NoContentAdapter implements ContentAdapter {
  readonly type = "none";
  readonly name = "no content";

  constructor(readonly repoRoot: string) {}

  async listItems(branch = "main"): Promise<{ title: string; papers: FolioItem[]; branch: string }> {
    return { title: "", papers: [], branch };
  }
  async getOutline(): Promise<ContentOutline | null> { return null; }
  async getChapterDetail(): Promise<ChapterDetail | null> { return null; }
  async getSection(): Promise<ResolvedSection | null> { return null; }
  async getDocument(): Promise<ResolvedDocument | null> { return null; }
  invalidateCache(): void {}

  async saveBlock(): Promise<string> { throw new Error(NO_CONTENT); }
  async computeDiff(): Promise<DocumentDiff> { throw new Error(NO_CONTENT); }
  async characterizeChanges(): Promise<BranchCharacterization> { throw new Error(NO_CONTENT); }
  async triageFeedback(): Promise<TriageResult> { throw new Error(NO_CONTENT); }

  getChatTools(): unknown[] { return []; }
  async executeChatTool(name: string): Promise<string> { throw new Error(`${name}: ${NO_CONTENT}`); }
  getChatSystemPrompt(): string { return `This instance holds no content; ${NO_CONTENT}.`; }

  async handleGet(): Promise<Response | null> { return null; }
  async handlePost(): Promise<Response | null> { return null; }
}
