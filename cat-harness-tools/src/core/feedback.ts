/**
 * Folio Assistant — Feedback storage (declared `todos/` node with `.folio-feedback` transition fallback).
 *
 * Feedback lives in the folio's declared `todo-feedback` directory inside its
 * `todos/` graph (`todos/todos.json`), keyed by item/block, while keeping the
 * legacy `.folio-feedback` path readable during transition (bean `folio-assistant-c4rz`).
 *
 * @module folio-assistant/core/feedback
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from "fs";
import { basename, dirname, join, resolve } from "path";
import { XMLParser } from "fast-xml-parser";
import type { FeedbackItem, TodoOrigin, TodoPriority, TodoStatus } from "../../schemas/types.js";
import { TodoItemSchema } from "../../schemas/constraints.js";
import {
  EMPTY_NOTE_TAGS,
  NoteTagsSchema,
  type ArtefactRef,
  type ExternalIdentity,
  type KgRef,
  type NoteTags,
  type TaskRef,
} from "../../schemas/kg/carried-note.js";
import {
  DEFAULT_TODO_GRAPH_ROOT,
  TODO_GRAPH_FILE,
  nodeOfKind,
  parseTodoGraph,
} from "../../schemas/sdlc/todo-graph.js";
import { directoriesForGraph, directoryForGraph } from "../../schemas/kg/cat-harness.js";
import {
  ACTORS_DIRNAME,
  ROLE_GRAPH_DIR,
  ROLE_GRAPH_FILENAME,
  readActors,
  readRoleGraph,
} from "../../schemas/process/role-graph.js";

export const TodoTagsSchema = NoteTagsSchema;
export type TodoTags = NoteTags;

/** A feedback item carrying knowledge-graph `TodoTags`. */
export type TaggedFeedbackItem = FeedbackItem & { tags?: TodoTags };

/** Legacy feedback directory name accepted on read during transition. */
export const LEGACY_FEEDBACK_DIRNAME = ".folio-feedback";

/** Sentinel: the client sent a value the target enum does not accept. */
export const INVALID_ENUM = Symbol("invalid-enum");

function parseEnum<T extends string>(
  schema: { safeParse: (v: unknown) => { success: true; data: T } | { success: false } },
  value: string | undefined,
): T | undefined | typeof INVALID_ENUM {
  if (value === undefined) return undefined;
  const parsed = schema.safeParse(value);
  return parsed.success ? parsed.data : INVALID_ENUM;
}

/**
 * Narrow a wire string to a `TodoPriority` / `TodoStatus`.
 *
 * `undefined` in → `undefined` out ("field absent, leave it alone"); an
 * unrecognised string → `INVALID_ENUM`, for the caller to turn into a 400.
 *
 * The `/api/feedback/{create,update}` handlers used to assign these straight
 * onto a stored item, which typechecked only because the array was `any[]`.
 * `{"status":"banana"}` was persisted verbatim and then matched no filter in
 * the codebase, so the item silently disappeared from every view of it.
 */
export const parseTodoPriority = (v: string | undefined) => parseEnum<TodoPriority>(TodoItemSchema.shape.priority, v);
export const parseTodoStatus = (v: string | undefined) => parseEnum<TodoStatus>(TodoItemSchema.shape.status, v);

/** The accepted values, for error messages. */
export const TODO_PRIORITIES = TodoItemSchema.shape.priority.options;
export const TODO_STATUSES = TodoItemSchema.shape.status.options;

/**
 * Resolve the declared `todo-feedback` directory from `<todosRoot>/todos.json`,
 * given either a folio/instance root or the `todos/` root itself.
 *
 * Returns `undefined` when no `todos.json` exists or it declares no node of
 * graph typology `todo-feedback`.
 */
export function resolveDeclaredFeedbackDir(repoOrTodosRoot: string): string | undefined {
  const root = resolve(repoOrTodosRoot);
  const candidates: string[] = [root];
  try {
    const declaredTodos = directoryForGraph(root, "todos");
    if (declaredTodos) candidates.push(declaredTodos);
  } catch {
    // No layer declaration at `root` — fall through to convention.
  }
  candidates.push(join(root, DEFAULT_TODO_GRAPH_ROOT));

  for (const todosRoot of candidates) {
    const declPath = join(todosRoot, TODO_GRAPH_FILE);
    if (!existsSync(declPath)) continue;
    try {
      const graph = parseTodoGraph(JSON.parse(readFileSync(declPath, "utf-8")));
      const node = nodeOfKind(graph, "todo-feedback");
      if (node) return resolve(todosRoot, node.path);
    } catch {
      continue;
    }
  }
  return undefined;
}

/**
 * Determine the primary feedback directory (preferring the declared `todo-feedback`
 * node in `todos/todos.json`) and any legacy `.folio-feedback` fallback directories.
 */
export function resolveFeedbackStoreDirs(
  feedbackDir: string,
  legacyFeedbackDir?: string,
): { primaryDir: string; legacyDirs: string[] } {
  const abs = resolve(feedbackDir);
  if (legacyFeedbackDir !== undefined) {
    const leg = resolve(legacyFeedbackDir);
    return { primaryDir: abs, legacyDirs: leg === abs ? [] : [leg] };
  }

  // Case 1: Caller passed `<repoRoot>/.folio-feedback` on a folio that declares `todo-feedback`.
  if (basename(abs) === LEGACY_FEEDBACK_DIRNAME) {
    const repoRoot = dirname(abs);
    const declared = resolveDeclaredFeedbackDir(repoRoot);
    if (declared && declared !== abs) {
      return { primaryDir: declared, legacyDirs: [abs] };
    }
    return { primaryDir: abs, legacyDirs: [] };
  }

  // Case 2: Caller passed `<todosRoot>` or `<repoRoot>` directly.
  const declaredFromInput = resolveDeclaredFeedbackDir(abs);
  if (declaredFromInput) {
    const repoRoot = existsSync(join(abs, TODO_GRAPH_FILE)) ? dirname(abs) : abs;
    const legacy = join(repoRoot, LEGACY_FEEDBACK_DIRNAME);
    return {
      primaryDir: declaredFromInput,
      legacyDirs: legacy === declaredFromInput ? [] : [legacy],
    };
  }

  // Case 3: Caller passed `<repoRoot>/todos/feedback` directly.
  const parentDir = dirname(abs);
  if (existsSync(join(parentDir, TODO_GRAPH_FILE)) || basename(parentDir) === DEFAULT_TODO_GRAPH_ROOT) {
    const repoRoot = dirname(parentDir);
    const legacy = join(repoRoot, LEGACY_FEEDBACK_DIRNAME);
    return { primaryDir: abs, legacyDirs: legacy === abs ? [] : [legacy] };
  }

  return { primaryDir: abs, legacyDirs: [] };
}

/** Context from which a feedback producer populates `TodoTags`. */
export interface FeedbackTagContext {
  /** Submitter display name (from OAuth or local config). */
  author?: string;
  /** Submitter email (from OAuth or local config). */
  authorEmail?: string;
  /** Explicit provider-qualified identity strings (`"github:litlfred"`) or objects. */
  identities?: ReadonlyArray<string | ExternalIdentity>;
  /** Provider name used when qualifying `authorEmail` or `author`. */
  identityProvider?: string;
  /** Optional declared actor id (`scenarios/actors/<id>.json`) to link the submitter identity to. */
  actor?: string;
  /** Role ids (`scenarios/roles.json`) acting on this feedback item. */
  roles?: readonly string[];
  /** BPMN process ids (`processes/*.bpmn`). */
  processes?: readonly string[];
  /** BPMN task pairs (`{ process, task }`). */
  tasks?: readonly TaskRef[];
  /** Target block label (e.g. `"def:rigid-monoidal-category"` or `"sec:intro"`). */
  targetLabel?: string;
  /** Knowledge-graph node references (`{ kind, id, note? }`). */
  references?: readonly KgRef[];
  /** External artefact references (`{ kind, id, repo?, provider? }`). */
  artefacts?: readonly ArtefactRef[];
}

function parseQualifiedIdentity(
  entry: string | ExternalIdentity,
  actor?: string,
  displayName?: string,
): ExternalIdentity | undefined {
  const validDisplay = displayName && displayName !== "anonymous" ? displayName : undefined;
  if (typeof entry !== "string") {
    return {
      ...entry,
      ...(entry.displayName === undefined && validDisplay ? { displayName: validDisplay } : {}),
      ...(entry.actor === undefined && actor ? { actor } : {}),
    };
  }
  const idx = entry.indexOf(":");
  if (idx <= 0 || idx === entry.length - 1) return undefined;
  return {
    provider: entry.slice(0, idx),
    id: entry.slice(idx + 1),
    ...(validDisplay ? { displayName: validDisplay } : {}),
    ...(actor ? { actor } : {}),
  };
}

/**
 * Build validated `TodoTags` from a feedback submission's context.
 *
 * Ensures identities are provider-qualified, tasks remain `{ process, task }`
 * pairs, and a target block label is recorded as a `block` reference when present.
 */
export function buildFeedbackTags(ctx: FeedbackTagContext): TodoTags {
  const identities: ExternalIdentity[] = [];
  for (const raw of ctx.identities ?? []) {
    const parsed = parseQualifiedIdentity(raw, ctx.actor, ctx.author);
    if (parsed) identities.push(parsed);
  }

  if (identities.length === 0) {
    const cleanAuthor = ctx.author?.trim();
    const cleanEmail = ctx.authorEmail?.trim();
    const fromAuthorColon =
      cleanAuthor && cleanAuthor !== "anonymous"
        ? parseQualifiedIdentity(cleanAuthor, ctx.actor)
        : undefined;
    if (fromAuthorColon) {
      identities.push(fromAuthorColon);
    } else if (cleanEmail) {
      identities.push({
        provider: ctx.identityProvider ?? "email",
        id: cleanEmail,
        ...(cleanAuthor && cleanAuthor !== "anonymous" ? { displayName: cleanAuthor } : {}),
        ...(ctx.actor ? { actor: ctx.actor } : {}),
      });
    } else if (cleanAuthor && cleanAuthor !== "anonymous") {
      identities.push({
        provider: ctx.identityProvider ?? "github",
        id: cleanAuthor,
        displayName: cleanAuthor,
        ...(ctx.actor ? { actor: ctx.actor } : {}),
      });
    }
  }

  const references: KgRef[] = [...(ctx.references ?? [])];
  if (ctx.targetLabel && !references.some((r) => r.kind === "block" && r.id === ctx.targetLabel)) {
    references.push({ kind: "block", id: ctx.targetLabel });
  }

  return NoteTagsSchema.parse({
    ...EMPTY_NOTE_TAGS,
    roles: [...(ctx.roles ?? [])],
    processes: [...(ctx.processes ?? [])],
    tasks: [...(ctx.tasks ?? [])],
    identities,
    references,
    artefacts: [...(ctx.artefacts ?? [])],
  });
}

/** Input for creating a tagged feedback item. */
export interface CreateFeedbackInput extends FeedbackTagContext {
  id?: string;
  summary: string;
  comment?: string;
  status?: TodoStatus;
  priority?: TodoPriority;
  origin?: TodoOrigin;
  assignee?: string;
  createdAt?: string;
  updatedAt?: string;
  updatedBy?: string;
  data?: Record<string, unknown>;
  related?: string[];
  theme?: string;
}

/**
 * Producer that constructs a `TaggedFeedbackItem` with populated `TodoTags`
 * from the submitting context.
 */
export function createFeedbackItem(input: CreateFeedbackInput): TaggedFeedbackItem {
  const tags = buildFeedbackTags(input);
  return {
    id: input.id ?? FeedbackStore.makeId(),
    summary: input.summary,
    comment: input.comment ?? "",
    status: input.status ?? "open",
    priority: input.priority ?? "medium",
    origin: input.origin ?? "human",
    ...(input.targetLabel ? { targetLabel: input.targetLabel } : {}),
    ...(input.assignee ? { assignee: input.assignee } : {}),
    createdAt: input.createdAt ?? new Date().toISOString(),
    ...(input.updatedAt ? { updatedAt: input.updatedAt } : {}),
    ...(input.updatedBy ? { updatedBy: input.updatedBy } : {}),
    ...(input.data ? { data: input.data } : {}),
    ...(input.related ? { related: input.related } : {}),
    ...(input.theme ? { theme: input.theme } : {}),
    ...(input.author ? { author: input.author } : {}),
    ...(input.authorEmail ? { authorEmail: input.authorEmail } : {}),
    tags,
  };
}

export class FeedbackStore {
  private readonly primaryDir: string;
  private readonly legacyDirs: readonly string[];

  constructor(feedbackDir: string, legacyFeedbackDir?: string) {
    const resolved = resolveFeedbackStoreDirs(feedbackDir, legacyFeedbackDir);
    this.primaryDir = resolved.primaryDir;
    this.legacyDirs = resolved.legacyDirs;
  }

  /** Primary directory where feedback files are written (the declared `todo-feedback` node). */
  get dir(): string {
    return this.primaryDir;
  }

  /** Legacy fallback directories consulted on read when a file is not yet in `dir`. */
  get fallbackDirs(): readonly string[] {
    return this.legacyDirs;
  }

  private feedbackPathIn(baseDir: string, itemId: string, rootName: string): string {
    return join(baseDir, itemId, `${rootName}.json`);
  }

  private feedbackPath(itemId: string, rootName: string): string {
    return this.feedbackPathIn(this.primaryDir, itemId, rootName);
  }

  /**
   * Read one feedback file's items, checking the declared `todo-feedback`
   * directory first and falling back to legacy `.folio-feedback` during transition.
   *
   * The file is written only by `write`, so `FeedbackItem` is the contract.
   * Entries are returned as-is rather than filtered against it: every caller
   * is read-modify-write over the whole file, so dropping a malformed entry
   * here would delete it on the next unrelated edit.
   */
  read(itemId: string, rootName: string): TaggedFeedbackItem[] {
    for (const baseDir of [this.primaryDir, ...this.legacyDirs]) {
      const p = this.feedbackPathIn(baseDir, itemId, rootName);
      if (!existsSync(p)) continue;
      try {
        return JSON.parse(readFileSync(p, "utf-8")) as TaggedFeedbackItem[];
      } catch {
        return [];
      }
    }
    return [];
  }

  write(itemId: string, rootName: string, todos: TaggedFeedbackItem[]): void {
    const dir = join(this.primaryDir, itemId);
    mkdirSync(dir, { recursive: true });
    writeFileSync(this.feedbackPath(itemId, rootName), JSON.stringify(todos, null, 2), "utf-8");
  }

  /**
   * Create and persist a new feedback item with populated `TodoTags` in the
   * declared `todo-feedback` store.
   */
  create(itemId: string, rootName: string, input: CreateFeedbackInput): TaggedFeedbackItem {
    const item = createFeedbackItem({
      ...input,
      targetLabel: input.targetLabel ?? rootName,
    });
    const existing = this.read(itemId, rootName);
    existing.push(item);
    this.write(itemId, rootName, existing);
    return item;
  }

  /** List all feedback items across primary and legacy directories, optionally filtered by status. */
  listAll(status?: string): Array<{ itemId: string; rootName: string; todo: TaggedFeedbackItem }> {
    const results: Array<{ itemId: string; rootName: string; todo: TaggedFeedbackItem }> = [];
    const seenBlocks = new Set<string>();

    for (const baseDir of [this.primaryDir, ...this.legacyDirs]) {
      if (!existsSync(baseDir)) continue;
      let itemIds: string[];
      try {
        itemIds = readdirSync(baseDir).sort();
      } catch {
        continue;
      }
      for (const itemId of itemIds) {
        const itemFbDir = join(baseDir, itemId);
        try {
          for (const file of readdirSync(itemFbDir).sort()) {
            if (!file.endsWith(".json")) continue;
            const rootName = file.replace(/\.json$/, "");
            const blockKey = `${itemId}/${rootName}`;
            if (seenBlocks.has(blockKey)) continue;
            seenBlocks.add(blockKey);
            const todos = this.read(itemId, rootName);
            for (const t of todos) {
              if (!status || t.status === status) {
                results.push({ itemId, rootName, todo: t });
              }
            }
          }
        } catch {}
      }
    }
    return results;
  }

  /** Generate a unique feedback item ID. */
  static makeId(): string {
    const ts = Date.now().toString(36);
    const hash = Math.random().toString(36).slice(2, 6);
    return `todo-${ts}-${hash}`;
  }
}

// ── Knowledge-graph index builder (`KgIndex`) ────────────────────

/**
 * What the knowledge graph currently declares, for checking todo tags against.
 *
 * Each field is optional, and `undefined` means "could not be read" (`not-checked`),
 * as distinct from an empty `Set`/`Map` ("read, and empty" → `dangling`).
 */
export interface KgIndex {
  roles?: ReadonlySet<string>;
  processes?: ReadonlySet<string>;
  /** Task ids per process id. */
  tasks?: ReadonlyMap<string, ReadonlySet<string>>;
  actors?: ReadonlySet<string>;
}

const BPMN_ACTIVITY_KEYS = [
  "task",
  "userTask",
  "serviceTask",
  "callActivity",
  "sendTask",
  "receiveTask",
  "manualTask",
  "businessRuleTask",
  "scriptTask",
  "subProcess",
] as const;

const bpmnXmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true,
});

function asArray<T>(val: T | T[] | undefined): T[] {
  if (val === undefined) return [];
  return Array.isArray(val) ? val : [val];
}

function collectBpmnActivities(container: Record<string, unknown>, out: Set<string>): void {
  for (const key of BPMN_ACTIVITY_KEYS) {
    for (const item of asArray(container[key] as Record<string, unknown> | Record<string, unknown>[] | undefined)) {
      if (item && typeof item === "object") {
        const id = item["@_id"];
        if (typeof id === "string" && id.length > 0) out.add(id);
        if (key === "subProcess") collectBpmnActivities(item, out);
      }
    }
  }
}

function candidateGraphDirs(
  instanceRoot: string,
  graphKind: string,
  fallbackSubdirs: readonly string[],
): string[] {
  try {
    const declared = directoriesForGraph(instanceRoot, graphKind);
    if (declared.length > 0) return [...declared];
  } catch {
    // No layer declaration at `instanceRoot` — fall back to conventional subdirectories.
  }
  return fallbackSubdirs.map((sub) => join(instanceRoot, sub));
}

function readRolesIndex(instanceRoot: string): ReadonlySet<string> | undefined {
  // declared-path-literal: convention fallback when no declaration file exists
  const scenarioDirs = candidateGraphDirs(instanceRoot, "scenarios", ["scenarios"]);
  // declared-path-literal: convention fallback when no declaration file exists
  const kgDirs = candidateGraphDirs(instanceRoot, "kg", ["skills"]);
  const searchRoots = [...scenarioDirs, ...kgDirs, instanceRoot];

  const roleFiles: Array<{ root: string; file: string }> = [];
  const seenFiles = new Set<string>();
  for (const dir of searchRoots) {
    for (const candidate of [join(dir, ROLE_GRAPH_DIR, ROLE_GRAPH_FILENAME), join(dir, ROLE_GRAPH_FILENAME)]) {
      const abs = resolve(candidate);
      if (!seenFiles.has(abs) && existsSync(abs)) {
        seenFiles.add(abs);
        roleFiles.push({ root: dir, file: abs });
      }
    }
  }

  if (roleFiles.length === 0) return undefined;

  const roles = new Set<string>();
  for (const { root, file } of roleFiles) {
    try {
      const graph = readRoleGraph(root);
      if (graph) {
        for (const r of graph.roles) roles.add(r.id);
        continue;
      }
    } catch {
      // Fall through to raw JSON parse in case a lightweight fixture omits optional RoleDef fields.
    }
    try {
      const raw = JSON.parse(readFileSync(file, "utf-8")) as { roles?: unknown };
      if (!raw || typeof raw !== "object" || !Array.isArray(raw.roles)) return undefined;
      for (const entry of raw.roles) {
        if (!entry || typeof entry !== "object" || typeof (entry as { id?: unknown }).id !== "string") {
          return undefined;
        }
        roles.add((entry as { id: string }).id);
      }
    } catch {
      return undefined;
    }
  }
  return roles;
}

function readActorsIndex(instanceRoot: string): ReadonlySet<string> | undefined {
  // declared-path-literal: convention fallback when no declaration file exists
  const scenarioDirs = candidateGraphDirs(instanceRoot, "scenarios", ["scenarios"]);
  const actorDirs = [...scenarioDirs.map((d) => join(d, ACTORS_DIRNAME)), join(instanceRoot, ACTORS_DIRNAME)].filter(
    (d, i, arr) => arr.indexOf(d) === i && existsSync(d) && statSync(d).isDirectory(),
  );

  if (actorDirs.length === 0) return undefined;

  const actors = new Set<string>();
  for (const dir of actorDirs) {
    try {
      for (const a of readActors(dir)) actors.add(a.id);
    } catch {
      return undefined;
    }
  }
  return actors;
}

function walkBpmnFiles(dir: string): string[] {
  const out: string[] = [];
  const walk = (current: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      // declared-path-literal: skip translated diagram subdirectories, matching processDiagrams()
      if (entry.isDirectory() && entry.name !== "translations") {
        walk(join(current, entry.name));
      } else if (entry.isFile() && entry.name.endsWith(".bpmn")) {
        out.push(join(current, entry.name));
      }
    }
  };
  walk(dir);
  return out.sort();
}

function readProcessesAndTasksIndex(instanceRoot: string): {
  processes?: ReadonlySet<string>;
  tasks?: ReadonlyMap<string, ReadonlySet<string>>;
} {
  // declared-path-literal: convention fallback when no declaration file exists
  const procDirs = candidateGraphDirs(instanceRoot, "processes", ["processes"]).filter(
    (d) => existsSync(d) && statSync(d).isDirectory(),
  );

  if (procDirs.length === 0) {
    return { processes: undefined, tasks: undefined };
  }

  const processes = new Set<string>();
  const tasks = new Map<string, Set<string>>();

  for (const dir of procDirs) {
    let files: string[];
    try {
      files = walkBpmnFiles(dir);
    } catch {
      return { processes: undefined, tasks: undefined };
    }
    for (const file of files) {
      let xml: string;
      try {
        xml = readFileSync(file, "utf-8");
      } catch {
        return { processes: undefined, tasks: undefined };
      }
      // Skip global-tasks-only libraries that declare no `<bpmn:process>`.
      if (xml.includes("globalTask") && !/<(?:bpmn:)?process\b/.test(xml)) {
        continue;
      }
      let parsed: Record<string, unknown>;
      try {
        parsed = bpmnXmlParser.parse(xml) as Record<string, unknown>;
      } catch {
        return { processes: undefined, tasks: undefined };
      }
      const defs = parsed["definitions"] as Record<string, unknown> | undefined;
      if (!defs || typeof defs !== "object") {
        return { processes: undefined, tasks: undefined };
      }
      for (const proc of asArray(defs["process"] as Record<string, unknown> | Record<string, unknown>[] | undefined)) {
        if (!proc || typeof proc !== "object") continue;
        const procId = proc["@_id"];
        if (typeof procId !== "string" || procId.length === 0) continue;
        processes.add(procId);
        const set = tasks.get(procId) ?? new Set<string>();
        collectBpmnActivities(proc, set);
        tasks.set(procId, set);
      }
    }
  }

  return { processes, tasks };
}

/**
 * Build a {@link KgIndex} from a layer's declared `roles`, `processes`,
 * `tasks` and `actors` directories.
 *
 * Preserves the three-valued contract (`undefined` ≠ empty):
 * - When an axis's backing directory/file does not exist or cannot be read,
 *   that field is `undefined` so `resolveTodoTags` reports `not-checked`.
 * - When the directory/file exists and holds zero entries, that field is an
 *   empty `Set` / `Map` so `resolveTodoTags` reports `dangling`.
 */
export function buildKgIndex(instanceRoot: string): KgIndex {
  const root = resolve(instanceRoot);
  const roles = readRolesIndex(root);
  const actors = readActorsIndex(root);
  const { processes, tasks } = readProcessesAndTasksIndex(root);
  return {
    ...(roles !== undefined ? { roles } : {}),
    ...(processes !== undefined ? { processes } : {}),
    ...(tasks !== undefined ? { tasks } : {}),
    ...(actors !== undefined ? { actors } : {}),
  };
}
