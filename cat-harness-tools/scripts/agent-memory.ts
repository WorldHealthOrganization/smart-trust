/**
 * Agent memory as graph nodes, assembled into the file the harness reads.
 *
 * @module scripts/agent-memory
 * @covers memory
 *
 * `memory: project` is a Claude Code harness feature: it injects the first
 * 200 lines of `.claude/agent-memory/<agent>/MEMORY.md` into a subagent's
 * system prompt. That path is fixed by the harness; the entries are authored
 * as knowledge-graph nodes in `memory/`, so one fact can reach two agents —
 * the same relation `docs/reference/skill-instructions/` has to `memory/`.
 *
 * ## Only the generated region is written
 *
 * This writes only between `<!-- folio:memory:begin -->` and
 * `<!-- folio:memory:end -->`, as `pipeline/readme-sections.ts` writes only
 * inside its markers. Each memory file also holds sections the agent writes
 * itself (`## Session log`, and in `content-pipeline-navigator`
 * `## Corrected invocations`), which a whole-file rewrite would destroy.
 *
 * ## Telling a memory node from a skill
 *
 * Declaration over location: a file carrying `$schema: folio-memory/v1` is a
 * memory node whatever directory it is in. The declared `memory/` directory
 * holds the `memory` graph, on the `context` axis.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";

import { EMPTY_NOTE_TAGS, KgRefSchema, type KgRef, type NoteTags } from "../schemas/kg/carried-note.js";
import { mappingList, parseFrontMatter } from "../schemas/kg/front-matter.js";
import {
  AGENT_REF_KIND,
  MEMORY_LABELS,
  MEMORY_SCHEMA_TAG,
  MemoryNodeSchema,
  memoryForAgent,
  type MemoryLabel,
  type MemoryNode,
} from "../schemas/conduct/memory.js";
import {
  checkoutRootFor,
  deferResolution,
  findDeclarationFile,
  layerRootsIn,
  readDeclaration,
} from "../schemas/kg/cat-harness.js";
import { lockedMountPaths } from "../schemas/kg/index-config.js";
import { portableSegment } from "../schemas/kg/portable-path.ts";
import { mountScopeFor } from "../schemas/kg/remote-mount.js";
import { declaredDirectories, ownDeclaredDirectories } from "../schemas/kg/declared-nodes.js";
import { HARNESS_ROOT } from "./lib/roots.ts";

export const ROOT = resolve(HARNESS_ROOT);
export const DEFAULT_ROOT = checkoutRootFor(ROOT);

/**
 * True when `targetRoot` is a mounted layer placed by a mount lock (bean `bx4c`).
 * A mounted layer is a read-only copy of a pinned commit; index surface
 * regeneration must never write inside it.
 */
export function isMountedInstance(targetRoot: string, baseRoot?: string): boolean {
  const abs = resolve(targetRoot);
  if (baseRoot !== undefined && abs === resolve(baseRoot)) return false;
  const scope = mountScopeFor(abs);
  if (scope !== undefined && scope !== abs) return true;
  const base = baseRoot ? resolve(baseRoot) : checkoutRootFor(abs);
  if (abs === base) return false;
  return lockedMountPaths(base).some((p) => resolve(base, p) === abs);
}

/**
 * Memory directories for `root`: a layer root reads only the `memory`
 * directories it declares itself (`ownDeclaredDirectories`, bean `t5zb`), while
 * an index root reads every declared `memory` directory across the checkout.
 */
export function memoryDirsFor(root: string = DEFAULT_ROOT): string[] {
  const abs = resolve(root);
  const dirs =
    findDeclarationFile(abs) !== undefined
      ? ownDeclaredDirectories(abs, "memory")
      : declaredDirectories(abs, "memory");
  return dirs.filter((d) => existsSync(d));
}

/**
 * Authored entries — the directory declaring the `memory` graph.
 *
 * Asked BY GRAPH TYPOLOGY rather than composed from a path. It was
 * `kgRoots(ROOT).map((d) => join(d, "memory"))` — every knowledge-graph root's
 * `memory/` subdirectory — which was the right answer while the nodes lived
 * under `skills/`, and stopped finding anything the moment they moved out:
 * `kgRoots` filters to exactly-`cat-harness`, and `memory` is its own kind now.
 *
 * `directoriesForGraph` is the question actually being asked — "where does this
 * instance keep its memory graph" — and it survives the next relocation
 * without an edit, which composing a path does not.
 */
//
// EVERY layer's, since the owner's ruling of 2026-10-06 (bean `ar1s`):
// memory moved out of the repository root and SPLIT by the harness each lesson
// belongs to — platform discipline in `cat-harness/memory/`, content authoring
// in the content harness's `memory/`. One agent may be owed lessons from both,
// so the assembler reads every declared `memory` directory rather than the one
// `corpusDirectoryForGraph` allows.
export const MEMORY_DIRS = deferResolution(
  () => memoryDirsFor(DEFAULT_ROOT),
  { moduleUrl: import.meta.url, what: "its memory directories", under: ROOT },
);
/** Where the HARNESS looks. Not ours to move. */
export const AGENT_MEMORY_DIR = join(DEFAULT_ROOT, ".claude", "agent-memory");

export const BEGIN = "<!-- folio:memory:begin -->";
export const END = "<!-- folio:memory:end -->";

/** Markers for the repo-wide memory section in `AGENTS.md` (bean `31ni`). */
export const AGENTS_MD_BEGIN = "<!-- cat-harness:agent-memory:begin -->";
export const AGENTS_MD_END = "<!-- cat-harness:agent-memory:end -->";
export const AGENTS_MD_FILE = join(DEFAULT_ROOT, "AGENTS.md");

/** Per-target budgets (bean `31ni`). */
export const CLAUDE_MEMORY_LINE_BUDGET = 200;
export const ANTIGRAVITY_SKILL_BYTE_BUDGET = 24_000;
export const ANTIGRAVITY_RULE_BYTE_BUDGET = 24_000;
export const AGENTS_MD_BYTE_BUDGET = 32_768;
/** Per-agent vendor definition files (bean `31ni`): Copilot's limit is the vendor's, the rest the harness's cap. */
export const VENDOR_AGENT_BYTE_BUDGET = 32_768;
export const COPILOT_AGENT_CHAR_BUDGET = 30_000;

const LABELS = new Set<string>(MEMORY_LABELS);

// ── Parsing the hand-written files ──────────────────────────────

/** One `## LABEL — heading` section of a legacy `MEMORY.md`. */
export interface ParsedEntry {
  label: MemoryLabel;
  summary: string;
  comment: string;
}

/**
 * Split a hand-written `MEMORY.md` into its labelled entries.
 *
 * Only `## STABLE|TRAP|BASELINE — …` headings are entries. That is not a
 * convenience: `## Session log`, `## Corrected invocations` and the `# <agent>
 * — memory` title are all headings too, and none of them is a memory entry.
 * Keying on the label rather than on "is a heading" is what keeps them out —
 * and they are preserved in the file regardless, because this tool only ever
 * writes inside the markers.
 *
 * An em dash separates label from heading; the files use `—` throughout. A
 * hyphen is accepted too, because a heading written by hand at 2am should not
 * silently vanish from the corpus over a keystroke.
 */
export function parseMemoryFile(text: string): ParsedEntry[] {
  const out: ParsedEntry[] = [];
  const lines = text.split("\n");
  let cur: ParsedEntry | undefined;
  let body: string[] = [];

  const flush = (): void => {
    if (!cur) return;
    out.push({ ...cur, comment: body.join("\n").trim() });
    body = [];
  };

  for (const line of lines) {
    const m = /^##\s+([A-Z]+)\s+[—-]\s+(.+?)\s*$/.exec(line);
    if (m && LABELS.has(m[1]!.toLowerCase())) {
      flush();
      cur = { label: m[1]!.toLowerCase() as MemoryLabel, summary: m[2]!, comment: "" };
      continue;
    }
    // A heading that is NOT an entry ends the one in progress. Without this a
    // `## Session log` would be swallowed into the last TRAP's body and then
    // written back inside the markers, which is how the log gets destroyed by
    // a tool that never deletes anything.
    if (/^#{1,2}\s/.test(line) || line.trim() === "---") {
      flush();
      cur = undefined;
      continue;
    }
    if (cur) body.push(line);
  }
  flush();
  return out;
}

// ── Nodes on disk ───────────────────────────────────────────────

/** A slug that is stable under re-extraction, so ids do not churn. */
export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/`/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}


/** Read every memory node under `dir`, newest-id-last. */
/** The marker separating an entry's trigger from its evidence. */
export const DETAIL_MARKER = "<!-- detail -->";

/**
 * Split a node body at {@link DETAIL_MARKER}.
 *
 * In the BODY rather than the front matter deliberately. The front-matter
 * parser here is a small hand-rolled one with no block-scalar support, and
 * detail is prose — indenting paragraphs into YAML to carry prose is how a
 * code fence or a colon later breaks a parse for no gain. An HTML comment is
 * invisible in rendered Markdown, so the source file still reads as one
 * document to a human editing it.
 *
 * No marker means the whole body is the trigger, which is the common case.
 */
export function splitDetail(body: string): { comment: string; detail?: string } {
  const i = body.indexOf(DETAIL_MARKER);
  if (i === -1) return { comment: body.trim() };
  const detail = body.slice(i + DETAIL_MARKER.length).trim();
  return { comment: body.slice(0, i).trim(), ...(detail ? { detail } : {}) };
}

/**
 * `archived` as the author wrote it, or an error naming what was not understood.
 *
 * **This refuses rather than guessing, and the asymmetry is the whole reason.**
 * The field was a string compare against `"true"`, so every other YAML spelling
 * of the same boolean was COERCED AWAY: the node came back with `archived`
 * absent, which `MemoryNodeSchema` accepts because the field is
 * `z.boolean().optional()`. `safeParse` therefore could not catch it — it never
 * saw a bad value, it saw a missing one.
 *
 * What followed is the inversion archiving exists to prevent. An archived entry
 * has typically lost its `agents` tag, so a node that fails to read as archived
 * falls through to the untagged clause and reaches EVERY agent. Measured on
 * `main` at `e94288562` with four probe nodes through this reader: of `true`,
 * `TRUE`, `True` and `yes`, three reached an agent they were never tagged for.
 *
 * The two ways to be wrong are not symmetric. Too loose and an entry the author
 * meant to keep goes missing — visible, and the agent's own work shows it. Too
 * strict, as it was, and it goes to everybody: a widened blast radius that
 * nothing reports on and no budget check counts. So an unrecognised value is an
 * error, and silencing an entry costs more than not silencing it — the same
 * reasoning `<cat-harness.processes:no-skill reason="…"/>` already applies.
 *
 * Bean `folio-assistant-0j8h`.
 */
const YAML_TRUE = new Set(["true", "yes", "on"]);
const YAML_FALSE = new Set(["false", "no", "off"]);

export function readArchivedFlag(raw: unknown, where: string): boolean | undefined {
  if (raw === undefined) return undefined;
  // An empty scalar parses as `[]` — the front-matter reader's marker for "key
  // with no value" — and that is an author who meant something and typed
  // nothing, not an author who meant `false`.
  if (typeof raw !== "string") {
    throw new Error(
      `${where}: \`archived\` has no value. Write \`archived: true\` to keep the node ` +
        `in the graph and out of every agent's prompt, or remove the key entirely.`,
    );
  }
  const v = raw.trim().toLowerCase();
  if (YAML_TRUE.has(v)) return true;
  if (YAML_FALSE.has(v)) return false;
  throw new Error(
    `${where}: \`archived: ${raw}\` is not a boolean this reader understands. ` +
      `Use one of ${[...YAML_TRUE].join(", ")} / ${[...YAML_FALSE].join(", ")} ` +
      `(any case). Refusing rather than guessing: a value read as "not archived" ` +
      `returns the node LIVE, and an archived entry carries no agent tag, so the ` +
      `untagged rule would hand it to every agent — the opposite of archiving.`,
  );
}

/**
 * Every memory node under `dirs` — one directory or several (every declared
 * `memory` directory by default). An id held twice is refused: two layers
 * owning one lesson is the duplicate the split must not create.
 */
export function readMemoryNodes(dirs: string | readonly string[] = MEMORY_DIRS()): MemoryNode[] {
  const out: MemoryNode[] = [];
  const seen = new Map<string, string>();
  for (const dir of typeof dirs === "string" ? [dirs] : dirs) {
    for (const node of readMemoryNodesIn(dir)) {
      const prior = seen.get(node.id);
      if (prior !== undefined) throw new Error(`memory node ${node.id} is held by both ${prior} and ${dir}`);
      seen.set(node.id, dir);
      out.push(node);
    }
  }
  return out;
}

function readMemoryNodesIn(dir: string): MemoryNode[] {
  if (!existsSync(dir)) return [];
  const out: MemoryNode[] = [];
  for (const f of readdirSync(dir).sort()) {
    if (!f.endsWith(".md")) continue;
    const path = join(dir, f);
    const text = readFileSync(path, "utf8");
    const { fm, body } = parseFrontMatter(text);
    // Declaration over location: a .md here without the tag is not a memory
    // node, and is left alone rather than guessed at.
    if (fm["$schema"] !== MEMORY_SCHEMA_TAG) continue;

    // `agents:` was memory's own shorthand until #1168 B10a (owner,
    // 2026-09-30: "Rename, like todos"); it is refused rather than read, so an
    // entry copied from an old one fails here instead of reaching everybody.
    if (fm["agents"] !== undefined) {
      throw new Error(`${path}: \`agents:\` is retired — write \`references:\` with \`- kind: agent\` and \`id:\`, as todos do`);
    }
    const agents = mappingList(text, "references").map((r): KgRef => KgRefSchema.parse(r));
    const tags: NoteTags = {
      ...EMPTY_NOTE_TAGS,
      roles: Array.isArray(fm["roles"]) ? (fm["roles"] as string[]) : [],
      references: agents,
    };
    const node: Record<string, unknown> = {
      ...(readArchivedFlag(fm["archived"], path) ? { archived: true } : {}),
      id: String(fm["id"] ?? basename(f, ".md")),
      summary: String(fm["summary"] ?? ""),
      comment: splitDetail(body).comment,
      createdAt: String(fm["createdAt"] ?? ""),
      label: String(fm["label"] ?? ""),
      tags,
      $schema: MEMORY_SCHEMA_TAG,
    };
    const detail = splitDetail(body).detail;
    if (detail) node["detail"] = detail;
    if (fm["measuredCommand"] !== undefined) {
      node["measured"] = {
        command: String(fm["measuredCommand"]),
        date: String(fm["measuredDate"] ?? ""),
        result: String(fm["measuredResult"] ?? ""),
      };
    }
    const parsed = MemoryNodeSchema.safeParse(node);
    if (!parsed.success) {
      throw new Error(`${path}: ${JSON.stringify(parsed.error.issues)}`);
    }
    out.push(parsed.data);
  }

  // Duplicate ids are REFUSED, not resolved. `overlayMemory` overrides by id,
  // so two nodes sharing one would leave the loser silently absent from every
  // agent's file -- a memory entry that exists on disk, passes validation, and
  // reaches nobody.
  //
  // This is not hypothetical. Both `content-pipeline-navigator` and
  // `platform-boundary-guard` carry a BASELINE titled "re-measure, do not
  // quote", and their bodies are DISJOINT: one tabulates pipeline entrypoints,
  // the other folio-specific literals and README staleness. Same title, two
  // different facts. Deriving an id from the summary would have collided them
  // and dropped one.
  const byId = new Map<string, string>();
  for (const n of out) {
    const prev = byId.get(n.id);
    if (prev !== undefined) {
      throw new Error(
        `duplicate memory id \`${n.id}\` in ${dir}: two nodes cannot share one id, ` +
          `because overlay resolves by id and the loser would reach no agent at all. ` +
          `Give them distinct ids -- a shared SUMMARY is fine and is not the same thing.`,
      );
    }
    byId.set(n.id, n.summary);
  }
  return out;
}

// ── Rendering ───────────────────────────────────────────────────

/**
 * Entries the harness will not deliver whole — by heading OR by body.
 *
 * **Heading position is the wrong question on its own, and that let a real
 * truncation through.** Measured 2026-09-19: after splitting evidence into
 * detail files the generated region ended at line 209, so the last entry's
 * body ran nine lines past the cut — and this function returned nothing,
 * because its HEADING was comfortably inside. The check was green over an
 * entry the agent receives with its conclusion missing, which is worse than a
 * dropped entry: a truncated one still looks complete.
 *
 * So a heading past the budget is reported as before, and the region ENDING
 * past the budget is reported too, naming the last entry — the one actually
 * being cut.
 */
/**
 * The build-failing half of the budget warning, separated so it can be tested.
 *
 * **A dropped ENTRY is a different failure from a long file, and only one of
 * them is worth a red build.** Overflowing into the hand-written session log
 * costs nothing — that tail was never injected. Overflowing into an entry
 * costs the agent that entry, SILENTLY: the file still reads perfectly well,
 * the harness simply truncates, and nothing says which TRAP stopped arriving.
 *
 * Measured 2026-09-19 (bean `4kiw`): adding one 70-line node took
 * `platform-boundary-guard` from 204 to 259 lines and pushed THREE TRAPs past
 * the cut, while `--check` exited 0. `entriesPastBudget` had already computed
 * the exact list; it was printed as a warning nobody had to act on.
 *
 * **This is ergonomics, not a hole — do not read it as the only guard.**
 * `scripts/tests/agent-memory.test.ts` already asserts `overflowEntries` is
 * empty for every agent, and `bun test` runs in the same CI job, so a dropped
 * TRAP was never going to reach `main`. Verified by re-creating the probe:
 * the suite fails 3 tests. What this adds is that the command named `:check`
 * fails its own check, with a message saying what to do instead of an
 * assertion diff. The first version of this comment claimed the entry could
 * drop silently, which was inferred from one command exiting 0 without
 * running the suite against the failing state.
 *
 * Deliberately NOT keyed on total line count. `platform-boundary-guard` is
 * over 200 on `main` today by a one-line session-log tail, and a gate that is
 * red for a reason nobody should act on is a gate people learn to route
 * around.
 *
 * @returns the message to print before failing, or `null` when nothing is dropped.
 */
export function droppedEntryReport(
  dropped: readonly { agent: string; entries: readonly string[] }[],
): string | null {
  // Filter rather than trust the caller's shape: an agent that is over budget
  // on its session log alone belongs in the WARNING, and a row with no dropped
  // entries reaching here would fail the build for it.
  const real = dropped.filter((d) => d.entries.length > 0);
  if (real.length === 0) return null;
  const rows = real
    .map((d) => `  ${d.agent}: ${d.entries.length} dropped — ${d.entries.join("; ")}`)
    .join("\n");
  return (
    `\nMemory entries fall past the harness's 200-line injection budget and will be\n` +
    `silently dropped before the agent ever sees them:\n\n${rows}\n\n` +
    `Shorten or split an entry, or archive one that has outlived its subject\n` +
    `(\`archived: true\` keeps the node in the graph and out of the prompt).\n` +
    `Do not fix this by letting the last entry fall off the end.`
  );
}

export function entriesPastBudget(file: string, budget = 200): string[] {
  const lines = file.split("\n");
  const isHead = (l: string): boolean => /^##\s+(STABLE|TRAP|BASELINE)\s/.test(l);
  const strip = (l: string): string => l.replace(/^##\s*/, "");

  const headingsPast = lines.slice(budget).filter(isHead).map(strip);
  if (headingsPast.length > 0) return headingsPast;

  // No heading past the cut, but the region may still end past it — in which
  // case the LAST entry is the one losing lines.
  const end = lines.findIndex((l) => l.includes(END));
  if (end === -1 || end < budget) return [];
  const lastHead = lines.slice(0, end).filter(isHead).pop();
  return lastHead ? [`${strip(lastHead)} (truncated: region ends at line ${end + 1})`] : [];
}

/** The markdown for one agent's entries — what goes between the markers. */
/**
 * Where an entry's non-injected detail is written, relative to `MEMORY.md`.
 *
 * Beside the file rather than inside it, because `MEMORY.md`'s marked region is
 * generated and its tail is the agent's own running notes — a detail file
 * written into either would be destroyed or would destroy something.
 */
export function detailRelPath(id: string): string {
  return join("detail", detailFileName(id));
}

/**
 * The detail file's basename — ONE composer, because two would prune live files.
 *
 * `writeDetail` builds a keep-set of names and deletes everything in `detail/`
 * that is not in it. So a second spelling of this name is not a cosmetic
 * duplicate: the writer would emit one name, the keep-set would hold another,
 * and the pruner would delete the file the writer had just written.
 *
 * {@link portableSegment} because a memory-entry id is an identifier and
 * nothing requires it to be a legal filename — the `req:agent-workflow` shape
 * that made this repository unclonable on Windows. Every id in use today is a
 * slug and encodes to itself, so no existing detail file moves.
 */
export function detailFileName(id: string): string {
  return `${portableSegment(id)}.md`;
}

/**
 * Rebase relative links in node prose so they resolve from the per-agent files,
 * `.claude/agent-memory/<agent>/MEMORY.md` and `.agents/skills/<agent>-memory/SKILL.md`.
 * Both sit three levels below their root, while a node authored in
 * `cat-harness/memory/` writes its skill links one level up (`../skills/`).
 * Copied verbatim, every such link in those files was broken.
 */
export function rebaseAgentFileLinks(text: string, root: string): string {
  const prefix = isCatHarnessRoot(root) ? "](../../../skills/" : "](../../../cat-harness/skills/";
  return text.replace(/\]\(\.\.\/skills\//g, prefix);
}

/**
 * The entries of one agent's file. Given the `root` the file is written under,
 * links in each comment are rebased for the file's depth ({@link rebaseAgentFileLinks});
 * without it the prose is left as authored.
 */
export function renderEntries(entries: readonly MemoryNode[], root?: string): string {
  // Order is STABLE, TRAP, BASELINE: what is true, then what goes wrong, then
  // what was measured. A BASELINE last is deliberate -- it is the section most
  // likely to be cut by the harness's 200-line budget, and it is the one whose
  // staleness is designed in.
  const rank = (m: MemoryNode): number => MEMORY_LABELS.indexOf(m.label);
  const sorted = [...entries].sort((a, b) => rank(a) - rank(b) || a.id.localeCompare(b.id));
  return sorted
    .map((m) => {
      const head = `## ${m.label.toUpperCase()} — ${m.summary}`;
      const meas = m.measured
        ? `\n\n> Measured \`${m.measured.command}\` on ${m.measured.date}: ${m.measured.result}`
        : "";
      // A pointer, not the detail itself — that is the whole point. One line
      // costs one line of budget and buys the agent a way to the evidence;
      // inlining it is what put this file at capacity.
      const more = m.detail ? `\n\nMore: \`${detailRelPath(m.id)}\`` : "";
      const comment = root === undefined ? m.comment : rebaseAgentFileLinks(m.comment, root);
      return `${head}\n\n${comment}${meas}${more}`;
    })
    .join("\n\n");
}

/**
 * Put `body` between the markers in `file`, leaving everything else alone.
 *
 * A file with no markers is **not** rewritten and not silently skipped — it
 * returns `undefined`, and the caller reports it. Writing markers into a file
 * that does not have them would mean this tool deciding where an agent's
 * generated region starts, which is the author's call.
 */
export function spliceRegion(file: string, body: string): string | undefined {
  const i = file.indexOf(BEGIN);
  const j = file.indexOf(END);
  if (i === -1 || j === -1 || j < i) return undefined;
  return `${file.slice(0, i + BEGIN.length)}\n\n${body}\n\n${file.slice(j)}`;
}

/** Agents with a memory directory the harness will read. */
export function agentNames(dir: string = AGENT_MEMORY_DIR): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
}

export interface SyncResult {
  agent: string;
  state: "written" | "unchanged" | "no-markers" | "missing";
  entries: number;
  lines: number;
  /**
   * Memory entries that fall past the harness's 200-line injection budget.
   *
   * **Over budget is not one thing, and gating on total lines gets it wrong.**
   * The harness injects the FIRST 200 lines, so what a long file loses is its
   * TAIL — and the tail is the hand-written `## Session log`, which costs
   * nothing to drop. An entry falling past the line is a different event: that
   * is memory the agent will never see, which is the whole failure this module
   * exists to prevent.
   *
   * Measured 2026-09-19: `content-pipeline-navigator` went 13 lines over when
   * a sibling's 37-line TRAP arrived, and lost nothing but session-log lines.
   * A total-lines gate would have failed the build over that.
   */
  overflowEntries: string[];
}

/** Assemble every agent's file. `write: false` reports without touching disk. */
/**
 * Write each entry's `detail` beside `MEMORY.md`, and remove the stragglers.
 *
 * Pruning matters as much as writing: an entry whose `detail` was folded back
 * into its `comment` would otherwise leave a file behind that `MEMORY.md` no
 * longer points at, saying something the entry has stopped saying. That is the
 * orphan-sidecar shape one directory along, and it is cheap to prevent here.
 */
function writeDetail(dir: string, entries: readonly MemoryNode[]): void {
  const detailDir = join(dir, "detail");
  const wanted = new Map(entries.filter((m) => m.detail).map((m) => [detailFileName(m.id), m.detail!]));
  if (wanted.size === 0 && !existsSync(detailDir)) return;
  mkdirSync(detailDir, { recursive: true });
  for (const [name, body] of wanted) {
    writeFileSync(
      join(detailDir, name),
      `<!-- Generated from memory/${name} by \`bun run cat agent-memory\`. -->\n` +
        `<!-- Not injected into MEMORY.md; read on demand. Edits here are lost. -->\n\n` +
        body.trimEnd() +
        "\n",
    );
  }
  for (const f of readdirSync(detailDir)) {
    if (f.endsWith(".md") && !wanted.has(f)) rmSync(join(detailDir, f));
  }
}

export function syncAll(
  write: boolean,
  agentMemoryDir: string = AGENT_MEMORY_DIR,
  nodes: readonly MemoryNode[] = readMemoryNodes(),
): SyncResult[] {
  return agentNames(agentMemoryDir).map((agent) => {
    const path = join(agentMemoryDir, agent, "MEMORY.md");
    if (!existsSync(path)) {
      return { agent, state: "missing", entries: 0, lines: 0, overflowEntries: [] };
    }
    const entries = memoryForAgent(nodes, agent);
    const current = readFileSync(path, "utf8");
    const next = spliceRegion(current, renderEntries(entries, resolve(agentMemoryDir, "..", "..")));
    if (next === undefined) {
      return { agent, state: "no-markers", entries: entries.length, lines: 0, overflowEntries: [] };
    }
    const lines = next.split("\n").length;
    const overflowEntries = entriesPastBudget(next);

    // The sidecars are written whether or not MEMORY.md moved, and that is a
    // FIX rather than tidiness. `writeDetail` used to sit after the
    // `unchanged` early return, so a detail block could change — or a
    // generated header could go stale — while the INJECTED comment did not,
    // and the generator reported "unchanged" over a sidecar that was not.
    // Two things an entry says, one of them checked.
    //
    // Found 2026-09-20 by the memory nodes moving (bean `07xs`): every
    // sidecar still named `skills/memory/` in its generated header, through
    // two clean runs, because both agents' MEMORY.md happened to be
    // unchanged. Exactly the case the bug hides in.
    if (write) writeDetail(dirname(path), entries);

    if (next === current) {
      return { agent, state: "unchanged", entries: entries.length, lines, overflowEntries };
    }
    if (write) {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, next);
    }
    return { agent, state: "written", entries: entries.length, lines, overflowEntries };
  });
}

// ── Shared priority & budget helpers (bean `31ni`) ──────────────

/**
 * Live memory entries referencing no specific subagent (`kind: "agent"`).
 *
 * These are repository-wide lessons — facts that bind across every session
 * rather than belonging to one subagent's lane, and are rendered into a
 * marked repo-wide `AGENTS.md` section as well as reaching every subagent.
 */
export function repoWideMemory(entries: readonly MemoryNode[]): MemoryNode[] {
  return entries.filter(
    (e) => !e.archived && e.tags.references.every((r) => r.kind !== AGENT_REF_KIND),
  );
}

/**
 * Sort live nodes lowest-priority first so budget enforcement drops `baseline`
 * before `trap` and `trap` before `stable`, and oldest `createdAt` first within
 * the same label.
 */
export function lowestPriorityFirst(nodes: readonly MemoryNode[]): MemoryNode[] {
  const rank = (m: MemoryNode): number => MEMORY_LABELS.indexOf(m.label);
  return [...nodes].sort((a, b) => {
    const rankDiff = rank(b) - rank(a);
    if (rankDiff !== 0) return rankDiff;
    if (a.createdAt && b.createdAt && a.createdAt !== b.createdAt) {
      return a.createdAt.localeCompare(b.createdAt);
    }
    return a.id.localeCompare(b.id);
  });
}

export interface FitNodesToByteBudgetResult {
  active: MemoryNode[];
  body: string;
  dropped: MemoryNode[];
  bytes: number;
}

/**
 * Drop lowest-priority nodes one by one until the rendered output (or the
 * full spliced file when `measureFull` is supplied) fits within `budget` bytes.
 * Never truncates mid-entry, and returns every dropped node so the caller can
 * report and gate on it.
 */
export function fitNodesToByteBudget(
  nodes: readonly MemoryNode[],
  render: (active: readonly MemoryNode[]) => string,
  budget: number,
  measureFull?: (body: string) => string,
): FitNodesToByteBudgetResult {
  let active = [...nodes];
  const dropped: MemoryNode[] = [];
  const dropCandidates = lowestPriorityFirst(nodes);

  while (dropCandidates.length > 0) {
    const candidateBody = render(active);
    const measuredText = measureFull ? measureFull(candidateBody) : candidateBody;
    if (Buffer.byteLength(measuredText, "utf8") <= budget) {
      break;
    }
    const toDrop = dropCandidates.shift()!;
    dropped.push(toDrop);
    active = active.filter((n) => n.id !== toDrop.id);
  }

  const body = render(active);
  const measuredText = measureFull ? measureFull(body) : body;
  return {
    active,
    body,
    dropped,
    bytes: Buffer.byteLength(measuredText, "utf8"),
  };
}

export interface TargetDropRecord {
  target: string;
  budgetBytes: number;
  /** What `budgetBytes` counts; bytes unless said (Copilot counts characters). */
  unit?: "bytes" | "chars";
  dropped: readonly MemoryNode[];
}

/**
 * Format a report when any byte-budgeted target had to drop lowest-priority
 * nodes to fit its budget, or `null` when nothing was dropped.
 */
export function droppedTargetNodesReport(records: readonly TargetDropRecord[]): string | null {
  const real = records.filter((r) => r.dropped.length > 0);
  if (real.length === 0) return null;
  const rows = real
    .map((r) => {
      const items = r.dropped.map((d) => `[${d.label.toUpperCase()}] ${d.id} (${d.summary})`).join("; ");
      return `  ${r.target} (budget ${r.budgetBytes} ${r.unit ?? "bytes"}): ${r.dropped.length} dropped — ${items}`;
    })
    .join("\n");
  return (
    `\nMemory nodes were dropped to fit target byte budgets (lowest priority first —\n` +
    `never silent truncation):\n\n${rows}\n\n` +
    `Shorten or split a long entry with \`<!-- detail -->\`, or mark an obsolete entry\n` +
    `\`archived: true\` so every target fits within its budget.`
  );
}

export interface AgentMemoryTargetDef {
  id: string;
  vendor: string;
  pathPattern: string;
  scope: "per-agent" | "all-agents" | "repo-wide";
  delivery: "marked-region" | "whole-file";
  budget: { unit: "lines" | "bytes" | "chars"; limit: number };
}

/**
 * Active assembler targets and their budgets (bean `31ni`).
 *
 * The per-agent definition targets for Gemini CLI (`4682`), OpenAI Codex
 * (`5zs1`), Cursor (`uvfs`) and GitHub Copilot (`xxh4`) are written by
 * `agent-memory-vendors.ts` (owner lifted the hold, 2026-10-24).
 */
export const AGENT_MEMORY_TARGETS: readonly AgentMemoryTargetDef[] = [
  {
    id: "claude-agent-memory",
    vendor: "Claude Code",
    pathPattern: ".claude/agent-memory/<agent>/MEMORY.md",
    scope: "per-agent",
    delivery: "marked-region",
    budget: { unit: "lines", limit: CLAUDE_MEMORY_LINE_BUDGET },
  },
  {
    id: "antigravity-skill",
    vendor: "Antigravity",
    pathPattern: ".agents/skills/<agent>-memory/SKILL.md",
    scope: "per-agent",
    delivery: "whole-file",
    budget: { unit: "bytes", limit: ANTIGRAVITY_SKILL_BYTE_BUDGET },
  },
  {
    id: "antigravity-rule",
    vendor: "Antigravity",
    pathPattern: ".agents/rules/agent-memory.md",
    scope: "all-agents",
    delivery: "marked-region",
    budget: { unit: "bytes", limit: ANTIGRAVITY_RULE_BYTE_BUDGET },
  },
  {
    id: "agents-md",
    vendor: "Repo-wide (AGENTS.md)",
    pathPattern: "AGENTS.md",
    scope: "repo-wide",
    delivery: "marked-region",
    budget: { unit: "bytes", limit: AGENTS_MD_BYTE_BUDGET },
  },
  {
    id: "gemini-agent",
    vendor: "Gemini CLI",
    pathPattern: ".gemini/agents/<agent>.md",
    scope: "per-agent",
    delivery: "whole-file",
    budget: { unit: "bytes", limit: VENDOR_AGENT_BYTE_BUDGET },
  },
  {
    id: "codex-agent",
    vendor: "OpenAI Codex",
    pathPattern: ".codex/agents/<agent>.toml",
    scope: "per-agent",
    delivery: "whole-file",
    budget: { unit: "bytes", limit: VENDOR_AGENT_BYTE_BUDGET },
  },
  {
    id: "cursor-agent",
    vendor: "Cursor",
    pathPattern: ".cursor/agents/<agent>.md",
    scope: "per-agent",
    delivery: "whole-file",
    budget: { unit: "bytes", limit: VENDOR_AGENT_BYTE_BUDGET },
  },
  {
    id: "copilot-agent",
    vendor: "GitHub Copilot",
    pathPattern: ".github/agents/<agent>.agent.md",
    scope: "per-agent",
    delivery: "whole-file",
    budget: { unit: "chars", limit: COPILOT_AGENT_CHAR_BUDGET },
  },
];

// ── Antigravity target (bean `fkqa`) ────────────────────────────

/**
 * Where Antigravity looks for WORKSPACE SKILLS: `<workspace>/.agents/skills/`,
 * one folder per skill holding a required `SKILL.md` (the Agent Skills open
 * standard; Antigravity also reads the older `.agent/skills`). Measured from
 * the library's own copy of the vendor docs,
 * `cat-harness/library/corpus/conduct/agent-skills---google-antigravity-docs/`, page 1 and 4.
 *
 * Antigravity has no per-agent memory like Claude's `memory: project`, so each
 * agent's memory is published as one skill the agent model sees by name and
 * description and reads when relevant. Gemini CLI, Copilot, Codex and Cursor
 * get per-agent definition files instead (`agent-memory-vendors.ts`, bean `31ni`).
 */
export const ANTIGRAVITY_SKILLS_DIR = join(DEFAULT_ROOT, ".agents", "skills");

/** The skill folder an agent's memory is published under. */
export function antigravitySkillName(agent: string): string {
  return `${agent}-memory`;
}

/** The whole `SKILL.md` for one agent — generated end to end, no hand-written part. */
export function renderAntigravitySkill(agent: string, entries: readonly MemoryNode[], root?: string): string {
  const name = antigravitySkillName(agent);
  const description =
    `Lessons the ${agent} agent has already paid for in this repository — traps, ` +
    `stable facts and re-measure commands. Read before doing ${agent}'s kind of work here.`;
  return (
    `---\nname: ${name}\ndescription: ${JSON.stringify(description)}\n---\n\n` +
    `<!-- Generated by \`bun run cat agent-memory\` from every declared \`memory\` directory ` +
    `(bean fkqa). Do not edit: change the memory nodes and regenerate. -->\n\n` +
    `# ${agent} — memory\n\n` +
    `${renderEntries(entries, root)}\n`
  );
}

export interface RenderAntigravitySkillResult {
  content: string;
  dropped: MemoryNode[];
  bytes: number;
}

/**
 * Render one agent's Antigravity `SKILL.md` subject to a byte budget, dropping
 * lowest-priority nodes (`baseline` -> `trap` -> `stable`) and reporting them.
 */
export function renderAntigravitySkillWithBudget(
  agent: string,
  entries: readonly MemoryNode[],
  budget: number = ANTIGRAVITY_SKILL_BYTE_BUDGET,
  root?: string,
): RenderAntigravitySkillResult {
  const live = entries.filter((n) => !n.archived);
  const { body, dropped, bytes } = fitNodesToByteBudget(
    live,
    (active) => renderAntigravitySkill(agent, active, root),
    budget,
  );
  return { content: body, dropped, bytes };
}

export interface AntigravityResult {
  agent: string;
  state: "written" | "unchanged";
  entries: number;
  dropped: MemoryNode[];
  bytes: number;
}

/**
 * Publish every agent's memory as an Antigravity workspace skill. The agent
 * list is Claude's (`agentNames`) because that is where agents are declared
 * today; a skill folder whose agent no longer exists is removed, since a stale
 * skill would keep teaching a retired agent's lessons.
 */
export function syncAntigravity(
  write: boolean,
  nodes: readonly MemoryNode[] = readMemoryNodes(),
  budget: number = ANTIGRAVITY_SKILL_BYTE_BUDGET,
  skillsDir: string = ANTIGRAVITY_SKILLS_DIR,
  agentMemoryDir: string = AGENT_MEMORY_DIR,
): AntigravityResult[] {
  const agents = agentNames(agentMemoryDir);
  const out: AntigravityResult[] = agents.map((agent) => {
    const entries = memoryForAgent(nodes, agent);
    const path = join(skillsDir, antigravitySkillName(agent), "SKILL.md");
    const { content: next, dropped, bytes } = renderAntigravitySkillWithBudget(
      agent,
      entries,
      budget,
      resolve(skillsDir, "..", ".."),
    );
    const keptCount = entries.length - dropped.length;
    const current = existsSync(path) ? readFileSync(path, "utf8") : undefined;
    if (current === next) return { agent, state: "unchanged", entries: keptCount, dropped, bytes };
    if (write) {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, next);
    }
    return { agent, state: "written", entries: keptCount, dropped, bytes };
  });
  if (write && existsSync(skillsDir)) {
    const wanted = new Set(agents.map(antigravitySkillName));
    for (const e of readdirSync(skillsDir, { withFileTypes: true })) {
      if (e.isDirectory() && e.name.endsWith("-memory") && !wanted.has(e.name)) {
        rmSync(join(skillsDir, e.name), { recursive: true });
      }
    }
  }
  return out;
}

// ── Antigravity workspace rule target (bean `fkqa`) ─────────────

/**
 * Where Antigravity looks for WORKSPACE RULES: `<workspace>/.agents/rules/`.
 * Antigravity has no per-agent memory; all live memory nodes (not archived)
 * are assembled into a single always-on workspace rule, grouped by owning agent,
 * within a marked region and subject to a 24,000-byte per-file budget cap.
 */
export const ANTIGRAVITY_RULES_DIR = join(DEFAULT_ROOT, ".agents", "rules");
export const ANTIGRAVITY_RULE_FILE = join(ANTIGRAVITY_RULES_DIR, "agent-memory.md");

export const DEFAULT_ANTIGRAVITY_RULE_TEMPLATE = `---
trigger: always_on
description: "Repository agent memory: lessons, traps, stable facts, and baselines across all agents."
---

# Agent Memory

Memory nodes across all agent roles, assembled from declared \`memory\` directories.

<!-- folio:memory:begin -->
<!-- folio:memory:end -->
`;

export interface RenderAntigravityRuleResult {
  body: string;
  dropped: MemoryNode[];
}

function isCatHarnessRoot(root?: string): boolean {
  if (!root) return false;
  try {
    return readDeclaration(resolve(root))?.name === "cat-harness";
  } catch {
    return false;
  }
}

/**
 * Rebase relative links in node prose so they resolve correctly from `.agents/rules/agent-memory.md`.
 */
export function rebaseRuleLinks(text: string, root?: string): string {
  // Nodes authored in `cat-harness/memory/` refer to skills as `../skills/`.
  // From `.agents/rules/agent-memory.md`, that relative path points to
  // `../../skills/` in `cat-harness` itself, or `../../cat-harness/skills/` in an index root.
  const prefix = isCatHarnessRoot(root) ? "](../../skills/" : "](../../cat-harness/skills/";
  return text.replace(/\]\(\.\.\/skills\//g, prefix);
}

/**
 * Render live memory nodes as an Antigravity workspace rule body grouped by owning agent,
 * with budget enforcement that drops lowest-priority nodes (baseline first, then trap)
 * and reports them.
 */
export function renderAntigravityRule(
  nodes: readonly MemoryNode[],
  templateOrFile: string = DEFAULT_ANTIGRAVITY_RULE_TEMPLATE,
  budget: number = ANTIGRAVITY_RULE_BYTE_BUDGET,
  root?: string,
): RenderAntigravityRuleResult {
  const live = nodes.filter((n) => !n.archived);
  const rank = (m: MemoryNode): number => MEMORY_LABELS.indexOf(m.label);

  const formatRuleContent = (activeList: readonly MemoryNode[]): string => {
    const agentMap = new Map<string, MemoryNode[]>();
    for (const n of activeList) {
      const agents = n.tags.references.filter((r) => r.kind === AGENT_REF_KIND).map((r) => r.id);
      const keys = agents.length > 0 ? agents : ["repo-wide"];
      for (const k of keys) {
        if (!agentMap.has(k)) agentMap.set(k, []);
        agentMap.get(k)!.push(n);
      }
    }

    const sortedAgents = [...agentMap.keys()].sort();
    const sections: string[] = [];

    for (const agent of sortedAgents) {
      const entries = agentMap.get(agent)!;
      if (entries.length === 0) continue;
      const sortedEntries = [...entries].sort((a, b) => rank(a) - rank(b) || a.id.localeCompare(b.id));
      const rendered = sortedEntries
        .map((m) => {
          const head = `### ${m.label.toUpperCase()} — ${m.summary}`;
          const comment = rebaseRuleLinks(m.comment, root);
          const meas = m.measured
            ? `\n\n> Measured \`${m.measured.command}\` on ${m.measured.date}: ${m.measured.result}`
            : "";
          const more = m.detail ? `\n\nMore: \`${detailRelPath(m.id)}\`` : "";
          return `${head}\n\n${comment}${meas}${more}`;
        })
        .join("\n\n");

      sections.push(`## ${agent}\n\n${rendered}`);
    }

    return sections.join("\n\n");
  };

  const { body, dropped } = fitNodesToByteBudget(
    live,
    formatRuleContent,
    budget,
    (candidateBody) => spliceRegion(templateOrFile, candidateBody) ?? candidateBody,
  );

  return { body, dropped };
}

export interface AntigravityRuleResult {
  path: string;
  state: "written" | "unchanged" | "no-markers";
  entries: number;
  dropped: MemoryNode[];
  bytes: number;
}

export function syncAntigravityRule(
  write: boolean,
  nodes: readonly MemoryNode[] = readMemoryNodes(),
  budget: number = ANTIGRAVITY_RULE_BYTE_BUDGET,
  ruleFilePath: string = ANTIGRAVITY_RULE_FILE,
  root: string = resolve(ruleFilePath, "../../.."),
): AntigravityRuleResult {
  const liveCount = nodes.filter((n) => !n.archived).length;
  if (!existsSync(ruleFilePath) && liveCount === 0) {
    return { path: ruleFilePath, state: "unchanged", entries: 0, dropped: [], bytes: 0 };
  }
  const current = existsSync(ruleFilePath) ? readFileSync(ruleFilePath, "utf8") : DEFAULT_ANTIGRAVITY_RULE_TEMPLATE;
  const { body, dropped } = renderAntigravityRule(nodes, current, budget, root);
  const next = spliceRegion(current, body);
  if (next === undefined) {
    return {
      path: ruleFilePath,
      state: "no-markers",
      entries: 0,
      dropped: [],
      bytes: existsSync(ruleFilePath) ? Buffer.byteLength(readFileSync(ruleFilePath, "utf8"), "utf8") : 0,
    };
  }

  const bytes = Buffer.byteLength(next, "utf8");
  const entries = liveCount - dropped.length;

  if (existsSync(ruleFilePath) && next === readFileSync(ruleFilePath, "utf8")) {
    return { path: ruleFilePath, state: "unchanged", entries, dropped, bytes };
  }
  if (write) {
    mkdirSync(dirname(ruleFilePath), { recursive: true });
    writeFileSync(ruleFilePath, next);
  }
  return { path: ruleFilePath, state: "written", entries, dropped, bytes };
}

// ── Repo-wide AGENTS.md section target (bean `31ni`) ────────────

/**
 * Rebase relative links in node prose so they resolve from the repository root `AGENTS.md`.
 */
export function rebaseAgentsMdLinks(text: string, root?: string): string {
  // Nodes authored in `cat-harness/memory/` refer to skills as `../skills/`.
  // From `AGENTS.md`, that relative path is `skills/` in `cat-harness` itself,
  // or `cat-harness/skills/` in an index root.
  const prefix = isCatHarnessRoot(root) ? "](skills/" : "](cat-harness/skills/";
  return text.replace(/\]\(\.\.\/skills\//g, prefix);
}

/**
 * Splice `body` into an `AGENTS.md` file between `<!-- cat-harness:agent-memory:begin -->`
 * and `<!-- cat-harness:agent-memory:end -->` (or `<!-- folio:memory:begin -->` / `<!-- folio:memory:end -->`).
 * Returns `undefined` when no valid marker pair is present (the third state: not opted in).
 */
export function spliceAgentsMdRegion(file: string, body: string): string | undefined {
  for (const [begin, end] of [
    [AGENTS_MD_BEGIN, AGENTS_MD_END],
    [BEGIN, END],
  ] as const) {
    const i = file.indexOf(begin);
    const j = file.indexOf(end);
    if (i !== -1 && j !== -1 && j > i) {
      return body.length > 0
        ? `${file.slice(0, i + begin.length)}\n\n${body}\n\n${file.slice(j)}`
        : `${file.slice(0, i + begin.length)}\n${file.slice(j)}`;
    }
  }
  return undefined;
}

export interface RenderAgentsMdSectionResult {
  body: string;
  dropped: MemoryNode[];
  entries: number;
  bytes: number;
}

/**
 * Render agent-less (repo-wide) live memory nodes for the marked region of `AGENTS.md`,
 * ordered `STABLE`, `TRAP`, `BASELINE`, with budget enforcement that drops
 * lowest-priority nodes (`baseline` first, then `trap`) and reports them.
 */
export function renderAgentsMdSection(
  nodes: readonly MemoryNode[],
  templateOrFile?: string,
  budget: number = AGENTS_MD_BYTE_BUDGET,
  root?: string,
): RenderAgentsMdSectionResult {
  const repoWide = repoWideMemory(nodes);
  const rank = (m: MemoryNode): number => MEMORY_LABELS.indexOf(m.label);

  const formatSection = (activeList: readonly MemoryNode[]): string => {
    const sorted = [...activeList].sort((a, b) => rank(a) - rank(b) || a.id.localeCompare(b.id));
    return sorted
      .map((m) => {
        const head = `### ${m.label.toUpperCase()} — ${m.summary}`;
        const comment = rebaseAgentsMdLinks(m.comment, root);
        const meas = m.measured
          ? `\n\n> Measured \`${m.measured.command}\` on ${m.measured.date}: ${m.measured.result}`
          : "";
        const more = m.detail ? `\n\nMore: \`${detailRelPath(m.id)}\`` : "";
        return `${head}\n\n${comment}${meas}${more}`;
      })
      .join("\n\n");
  };

  const { active, body, dropped, bytes } = fitNodesToByteBudget(
    repoWide,
    formatSection,
    budget,
    templateOrFile !== undefined
      ? (candidateBody) => spliceAgentsMdRegion(templateOrFile, candidateBody) ?? candidateBody
      : undefined,
  );

  return {
    body,
    dropped,
    entries: active.length,
    bytes,
  };
}

export interface AgentsMdResult {
  path: string;
  state: "written" | "unchanged" | "no-markers" | "missing";
  entries: number;
  dropped: MemoryNode[];
  bytes: number;
}

/**
 * Sync the marked repo-wide memory section in `AGENTS.md` from agent-less nodes.
 *
 * Respects the third state: if `AGENTS.md` is absent (`missing`) or carries no
 * memory markers (`no-markers`), it is left untouched and reported as such.
 */
export function syncAgentsMd(
  write: boolean,
  nodes: readonly MemoryNode[] = readMemoryNodes(),
  budget: number = AGENTS_MD_BYTE_BUDGET,
  agentsMdPath: string = AGENTS_MD_FILE,
  root: string = dirname(resolve(agentsMdPath)),
): AgentsMdResult {
  if (!existsSync(agentsMdPath)) {
    return { path: agentsMdPath, state: "missing", entries: 0, dropped: [], bytes: 0 };
  }
  const current = readFileSync(agentsMdPath, "utf8");
  if (spliceAgentsMdRegion(current, "") === undefined) {
    return {
      path: agentsMdPath,
      state: "no-markers",
      entries: repoWideMemory(nodes).length,
      dropped: [],
      bytes: Buffer.byteLength(current, "utf8"),
    };
  }
  const { body, dropped, entries } = renderAgentsMdSection(nodes, current, budget, root);
  const next = spliceAgentsMdRegion(current, body)!;
  const bytes = Buffer.byteLength(next, "utf8");

  if (next === current) {
    return { path: agentsMdPath, state: "unchanged", entries, dropped, bytes };
  }
  if (write) {
    writeFileSync(agentsMdPath, next);
  }
  return { path: agentsMdPath, state: "written", entries, dropped, bytes };
}

// ── CLI ─────────────────────────────────────────────────────────

export interface AgentMemoryRunResult {
  ok: boolean;
  stale: number;
  mountedStale: number;
  lines: string[];
  mountedFindings: string[];
  byteDropReport: string | null;
  droppedReport: string | null;
}

export async function runAgentMemory(
  opts: { baseRoot?: string; explicitDir?: string; check?: boolean } = {},
): Promise<AgentMemoryRunResult> {
  const check = opts.check ?? false;
  const explicitDir = opts.explicitDir ? resolve(opts.explicitDir) : undefined;
  const cwd = process.cwd();
  const cwdRoot = existsSync(join(cwd, "index.config.json")) ? resolve(cwd) : checkoutRootFor(cwd);
  const baseRoot = opts.baseRoot
    ? resolve(opts.baseRoot)
    : findDeclarationFile(cwdRoot) !== undefined || existsSync(join(cwdRoot, "index.config.json"))
      ? cwdRoot
      : DEFAULT_ROOT;
  const roots =
    explicitDir !== undefined
      ? [explicitDir]
      : [
          baseRoot,
          ...layerRootsIn(baseRoot).filter(
            (r) => resolve(r) !== resolve(baseRoot) && existsSync(join(r, ".claude", "agents")),
          ),
        ];

  const { syncVendorAgents, vendorTargetsFor } = await import("./agent-memory-vendors.ts");
  let stale = 0;
  let mountedStale = 0;
  const lines: string[] = [];
  const mountedFindings: string[] = [];
  const targetDropRecords: TargetDropRecord[] = [];
  const dropped: { agent: string; entries: string[] }[] = [];

  for (const targetRoot of roots) {
    const mounted = isMountedInstance(targetRoot, baseRoot);
    const shouldWrite = !check && !mounted;
    const layerName = readDeclaration(targetRoot)?.name ?? (relative(baseRoot, targetRoot) || basename(targetRoot));
    const prefix = mounted
      ? `${layerName}/`
      : roots.length > 1
        ? `${relative(baseRoot, targetRoot) || "."}/`
        : "";
    const nodes = readMemoryNodes(memoryDirsFor(targetRoot));
    const memDir = join(targetRoot, ".claude", "agent-memory");
    const skillsDir = join(targetRoot, ".agents", "skills");
    const ruleFile = join(targetRoot, ".agents", "rules", "agent-memory.md");
    const agentsMdFile = join(targetRoot, "AGENTS.md");
    const claudeAgentsDir = join(targetRoot, ".claude", "agents");
    const results = syncAll(shouldWrite, memDir, nodes);

    const recordState = (state: string, targetPath: string): string => {
      if (state === "written" && (check || mounted)) {
        stale++;
        if (mounted) {
          mountedStale++;
          const msg = `✗ ${layerName}: ${targetPath} is stale in mounted layer ${layerName} (committed surface not rewritten — regenerate in ${layerName})`;
          mountedFindings.push(msg);
          return "stale";
        }
      }
      return state;
    };

    for (const r of syncAntigravity(shouldWrite, nodes, ANTIGRAVITY_SKILL_BYTE_BUDGET, skillsDir, memDir)) {
      const targetPath = `${prefix}.agents/skills/${antigravitySkillName(r.agent)}`;
      const labelState = recordState(r.state, targetPath);
      lines.push(
        `  ${labelState.padEnd(11)} ${targetPath.padEnd(28)} ${r.entries} entries (${r.bytes} bytes, Antigravity skill)`,
      );
      if (r.dropped.length > 0) {
        targetDropRecords.push({
          target: targetPath,
          budgetBytes: ANTIGRAVITY_SKILL_BYTE_BUDGET,
          dropped: r.dropped,
        });
      }
    }

    const ruleResult = syncAntigravityRule(shouldWrite, nodes, ANTIGRAVITY_RULE_BYTE_BUDGET, ruleFile, targetRoot);
    const ruleRel = `${prefix}.agents/rules/agent-memory.md`;
    const ruleState = recordState(ruleResult.state, ruleRel);
    lines.push(
      `  ${ruleState.padEnd(11)} ${ruleRel.padEnd(28)} ${ruleResult.entries} entries (${ruleResult.bytes} bytes, Antigravity rule)`,
    );
    if (ruleResult.dropped.length > 0) {
      targetDropRecords.push({
        target: ruleRel,
        budgetBytes: ANTIGRAVITY_RULE_BYTE_BUDGET,
        dropped: ruleResult.dropped,
      });
    }

    const agentsMdResult = syncAgentsMd(shouldWrite, nodes, AGENTS_MD_BYTE_BUDGET, agentsMdFile, targetRoot);
    const agentsMdRel = `${prefix}AGENTS.md`;
    const agentsMdState = recordState(agentsMdResult.state, agentsMdRel);
    const agentsMdNote =
      agentsMdResult.state === "no-markers"
        ? "no marked region — not opted in, left untouched"
        : agentsMdResult.state === "missing"
          ? "no AGENTS.md — nothing to assemble"
          : `${agentsMdResult.entries} entries (${agentsMdResult.bytes} bytes, repo-wide AGENTS.md)`;
    lines.push(`  ${agentsMdState.padEnd(11)} ${agentsMdRel.padEnd(28)} ${agentsMdNote}`);
    if (agentsMdResult.dropped.length > 0) {
      targetDropRecords.push({
        target: agentsMdRel,
        budgetBytes: AGENTS_MD_BYTE_BUDGET,
        dropped: agentsMdResult.dropped,
      });
    }

    const vTargets = vendorTargetsFor(targetRoot);
    for (const r of syncVendorAgents(shouldWrite, nodes, {
      agents: agentNames(memDir),
      claudeAgentsDir,
      targets: vTargets,
    })) {
      const t = vTargets.find((x) => x.id === r.target)!;
      const rel = `${prefix}${t.dir.slice(targetRoot.length + 1)}/${t.fileName(r.agent)}`;
      const vState = recordState(r.state, rel);
      const note =
        r.state === "no-definition"
          ? `no .claude/agents/${r.agent}.md — nothing to carry, left alone`
          : `${r.entries} entries (${r.size} ${t.budget.unit}, ${t.vendor} agent)`;
      lines.push(`  ${vState.padEnd(11)} ${rel.padEnd(28)} ${note}`);
      if (r.dropped.length > 0) {
        targetDropRecords.push({ target: rel, budgetBytes: t.budget.limit, unit: t.budget.unit, dropped: r.dropped });
      }
    }

    for (const r of results) {
      const agentLabel = `${prefix}${r.agent}`;
      const mState = recordState(r.state, `${prefix}.claude/agent-memory/${r.agent}/MEMORY.md`);
      const note =
        r.state === "no-markers"
          ? "no marked region — not opted in, left untouched"
          : r.state === "missing"
            ? "no MEMORY.md — nothing to assemble"
            : `${r.entries} entries, ${r.lines} lines`;
      lines.push(`  ${mState.padEnd(11)} ${agentLabel.padEnd(28)} ${note}`);
      if (r.lines > CLAUDE_MEMORY_LINE_BUDGET) {
        const detail = r.overflowEntries.length
          ? `and ${r.overflowEntries.length} MEMORY ENTRY(S) fall past it: ${r.overflowEntries.join("; ")}`
          : "and nothing past it is a memory entry — only the hand-written tail";
        lines.push(
          `  ${"".padEnd(11)} ${"".padEnd(28)} ⚠ ${r.lines - CLAUDE_MEMORY_LINE_BUDGET} line(s) over the harness's ${CLAUDE_MEMORY_LINE_BUDGET}-line budget, ${detail}`,
        );
        if (r.overflowEntries.length) dropped.push({ agent: agentLabel, entries: r.overflowEntries });
      }
    }
  }

  for (const f of mountedFindings) lines.push(f);
  const byteDropReport = droppedTargetNodesReport(targetDropRecords);
  const droppedReport = droppedEntryReport(dropped);
  const ok = stale === 0 && (!check || (droppedReport === null && byteDropReport === null));
  return { ok, stale, mountedStale, lines, mountedFindings, byteDropReport, droppedReport };
}

/**
 * `bun run cat-harness-tools/scripts/agent-memory.ts [--check] [--dir <root>]`
 *
 * `--check` writes nothing and exits non-zero when a file is stale or when any
 * target exceeds its budget and drops entries, so CI catches an entry edited
 * in `memory/` and never assembled or an entry that blew a target's budget.
 *
 * **`no-markers` and `missing` are not failures and not passes.** A file the
 * author has not opted in is left exactly as it is and reported as such — the
 * third state this repo insists on everywhere else. Rendering "has no marked
 * region" as "up to date" would make the check green over a file it never
 * wrote, which is the shape of `docs-site.yml` failing 30 times invisibly.
 */
if (import.meta.main) {
  const check = process.argv.includes("--check");
  const dirIdx = process.argv.indexOf("--dir");
  const explicitDir = dirIdx >= 0 && process.argv[dirIdx + 1] ? resolve(process.argv[dirIdx + 1]!) : undefined;
  const r = await runAgentMemory({ explicitDir, check });
  for (const line of r.lines) console.log(line);

  if (r.byteDropReport && !check) {
    console.warn(r.byteDropReport);
  }
  if (r.stale > 0) {
    for (const f of r.mountedFindings) console.error(f);
    console.error(
      `\n${r.stale} memory file(s) are stale. Run \`bun run cat agent-memory\` and commit the result.`,
    );
    process.exit(1);
  }
  if (check && r.droppedReport) {
    console.error(r.droppedReport);
    process.exit(1);
  }
  if (check && r.byteDropReport) {
    console.error(r.byteDropReport);
    process.exit(1);
  }
}
