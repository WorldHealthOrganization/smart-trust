/**
 * **The work-plan store, as operations.** The interface every Tool that backs
 * the Beans store implements, and the engine calls.
 *
 * The contract is `work-plan-store` in cat-harness
 * (`work-plan/skills/work-plan/work-plan-store.md`); its conformance suite is
 * `scripts/tests/sdlc/work-plan-store-conformance.ts`. A process or a module
 * names the operation it performs ("note the bean", "claim it"), never the
 * command a Tool performs it with: that is cat-harness#991, step 3.
 *
 * Archiving is a field, not an operation (owner, 2026-11-02, Q-BSD-7 B):
 * `update(id, { archived: true }, ifMatch)`. Each Tool decides where an
 * archived bean lives; every Tool refuses to archive a bean that is not
 * `completed` or `scrapped` (`check:bean-archive`'s invariant), `get` still
 * finds an archived bean, and `list` leaves archived beans out unless asked.
 *
 * `positions` and `beansAt` read the workflow instances the store holds,
 * through {@link positionsIn} and {@link beansAtIn}, which every Tool shares;
 * `history` is the bean's own versions merged with those instances' steps
 * (`work-plan-store-history.ts`).
 *
 * @module folio-assistant/workflow/work-plan-store
 */
import { createHash } from "node:crypto";
import { entriesInBody, MEMORY_SCOPES, renderEntryLine, type MemoryEntry, type MemoryScope } from "../../schemas/kg/memory-record.ts";

/** A bean as the contract speaks of it: fields, not a file. */
export interface BeanFields {
  id: string;
  title: string;
  status: string;
  type: string;
  parent?: string;
  blockedBy?: string[];
  tags?: string[];
  /** Set only when true. */
  archived?: boolean;
  body: string;
}

/** A change to a bean's fields. The id never changes; the body changes only through `note`. */
export type BeanChange = Partial<Omit<BeanFields, "id" | "body">>;

export type Refusal = {
  state: "refused";
  /**
   * `stale`: `ifMatch` is not the current version. `exists`: the id is taken.
   * `dangling-link`: a link names no bean. `closed-list`: a value outside the
   * schema's list. `not-terminal`: archiving a bean that is not completed or
   * scrapped. `invalid`: a record a memory store cannot keep as given (an id
   * that is not a plain name, a field outside its schema).
   */
  why: "stale" | "exists" | "dangling-link" | "closed-list" | "not-terminal" | "invalid";
  detail: string;
};

export type Got = { state: "hit"; bean: BeanFields; version: string } | { state: "none" };

export interface BeanFilter {
  status?: string;
  type?: string;
  tag?: string;
  parent?: string;
  /** `true`: archived beans only. Absent or `false`: only beans not archived. */
  archived?: boolean;
}

/**
 * What kind of change an event records (proposal §4.6). `claimed` is a status
 * change into `in-progress`; `step-reached` comes from a workflow instance,
 * every other kind from the bean itself.
 */
export type HistoryKind =
  | "created"
  | "status-changed"
  | "claimed"
  | "noted"
  | "changed"
  | "archived"
  | "unarchived"
  | "removed"
  | "step-reached";

/** One entry of `history(id)`, oldest first. */
export interface HistoryEvent {
  at: string;
  by: string;
  kind: HistoryKind;
  what: string;
  /** Set when a workflow instance made the change: the instance (a phase's id is `parent/callNode`) and its step. */
  instance?: string;
  node?: string;
}

/** One entry of `positions(id)`. */
export interface Position {
  process: string;
  /** The instance id; a phase's is the parent's, then the call activity's node, joined by `/`. */
  instance: string;
  /** The steps holding a token. */
  nodes: string[];
  status: string;
  /** When the instance last moved. */
  lastMoved?: string;
}

/**
 * A memory record as `recall` answers it (proposal §4.14, Q17). For a bean
 * the scope is `item` unless a `memory-scope:` tag says otherwise, and the
 * entries are the body lines `renderEntryLine` wrote.
 */
export interface MemoryRecordView {
  id: string;
  title: string;
  scope: MemoryScope;
  about: string[];
  entries: MemoryEntry[];
  version: string;
}

/**
 * The memory store: the layer every memory Tool implements (Q17, option 1).
 * `keep` appends, so agents sharing a record never overwrite one another;
 * `open` makes a record for a run or a shared space.
 */
export interface MemoryStore {
  keep(id: string, entry: MemoryEntry): { state: "kept"; version: string } | { state: "none" };
  recall(id: string): { state: "hit"; record: MemoryRecordView } | { state: "none" };
  open(record: { id: string; title: string; scope: MemoryScope; about?: string[] }): { state: "opened"; version: string } | Refusal;
}

/** The contract's operations: the memory store's, and the work item's on top of them. */
export interface WorkPlanStore extends MemoryStore {
  get(id: string): Got;
  list(filter?: BeanFilter): BeanFields[];
  create(bean: BeanFields): { state: "created"; version: string } | Refusal;
  update(id: string, change: BeanChange, ifMatch: string): { state: "updated"; version: string } | Refusal | { state: "none" };
  note(id: string, text: string, by: string): { state: "noted"; version: string } | { state: "none" };
  history(id: string): HistoryEvent[];
  positions(id: string): Position[];
  beansAt(process: string, step?: string): string[];
}

// ---------------------------------------------------------------------------
// The memory layer, in terms of the work item's operations, so any work-plan
// Tool is a memory Tool too: the same service, with fewer parameters.

const SCOPE_TAG = "memory-scope:";
const ABOUT_TAG = "about:";

/** `keep` for a work-plan Tool: the entry as one body line. */
export function keepOn(store: Pick<WorkPlanStore, "note">, id: string, entry: MemoryEntry): { state: "kept"; version: string } | { state: "none" } {
  const r = store.note(id, renderEntryLine(entry), entry.by);
  return r.state === "noted" ? { state: "kept", version: r.version } : { state: "none" };
}

/** `recall` for a work-plan Tool: the bean read as a memory record. */
export function recallOn(store: Pick<WorkPlanStore, "get">, id: string): { state: "hit"; record: MemoryRecordView } | { state: "none" } {
  const got = store.get(id);
  if (got.state !== "hit") return { state: "none" };
  const tags = got.bean.tags ?? [];
  const scope = tags.find((t) => t.startsWith(SCOPE_TAG))?.slice(SCOPE_TAG.length);
  return {
    state: "hit",
    record: {
      id: got.bean.id,
      title: got.bean.title,
      scope: (MEMORY_SCOPES as readonly string[]).includes(scope ?? "") ? (scope as MemoryScope) : "item",
      about: tags.filter((t) => t.startsWith(ABOUT_TAG)).map((t) => t.slice(ABOUT_TAG.length)),
      entries: entriesInBody(got.bean.body),
      version: got.version,
    },
  };
}

/** `open` for a work-plan Tool: a bean in progress, tagged with its scope and what it is about. */
export function openOn(
  store: Pick<WorkPlanStore, "create">,
  record: { id: string; title: string; scope: MemoryScope; about?: string[] },
): { state: "opened"; version: string } | Refusal {
  const r = store.create({
    id: record.id,
    title: record.title,
    status: "in-progress",
    type: "task",
    tags: [`${SCOPE_TAG}${record.scope}`, ...(record.about ?? []).map((a) => `${ABOUT_TAG}${a}`)],
    body: "",
  });
  return r.state === "created" ? { state: "opened", version: r.version } : r;
}

/** The statuses a bean may be archived in. */
export const TERMINAL_STATUSES: ReadonlySet<string> = new Set(["completed", "scrapped"]);

/**
 * A bean's version for `ifMatch`: git's blob id of its text. The same value
 * whether the bean was read from a mounted checkout or from the branch itself,
 * so a version read one way can be matched the other.
 */
export function versionOf(text: string): string {
  return createHash("sha1").update(`blob ${Buffer.byteLength(text)}\0`).update(text).digest("hex");
}

// ---------------------------------------------------------------------------
// The bean file, as the `beans` CLI writes it. Shared by every Tool that keeps
// beans as files, so they read and write one format.

const FM = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/;

export const slugifyTitle = (s: string): string =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50);

const quote = (s: string): string => `'${s.replace(/'/g, "''")}'`;

/** A front-matter block sequence: `key:` then one `    - id` line per entry. */
function sequenceLines(key: string, ids: readonly string[] | undefined): string[] {
  return ids?.length ? [`${key}:`, ...ids.map((x) => `    - ${x}`)] : [];
}

function sequenceIn(front: string, key: string): { ids: string[]; span?: [number, number] } {
  const m = new RegExp(`^${key}:[ \\t]*\\n((?:[ \\t]+-[ \\t]*\\S.*(?:\\n|$))+)`, "m").exec(front);
  if (!m) return { ids: [] };
  const ids = m[1]!
    .split("\n")
    .map((l) => l.replace(/^[ \t]*-[ \t]*/, "").trim().replace(/^['"]|['"]$/g, ""))
    .filter(Boolean);
  return { ids, span: [m.index, m.index + m[0].length] };
}

/** A new bean's file text. `archived` is where the file is, not a field in it. */
export function renderBeanText(b: BeanFields, stamp: string): string {
  return (
    [
      "---",
      `# ${b.id}`,
      `title: ${quote(b.title)}`,
      `status: ${b.status}`,
      `type: ${b.type}`,
      "priority: normal",
      ...sequenceLines("tags", b.tags),
      `created_at: ${stamp}`,
      `updated_at: ${stamp}`,
      ...(b.parent ? [`parent: ${b.parent}`] : []),
      ...sequenceLines("blocked_by", b.blockedBy),
      "---",
      "",
    ].join("\n") + b.body
  );
}

/** A bean file's fields; `undefined` when it has no front matter or no id. */
export function parseBeanText(text: string, fallbackId?: string): BeanFields | undefined {
  const m = FM.exec(text);
  if (!m) return undefined;
  const front = m[1]!;
  const field = (k: string): string | undefined => {
    const v = new RegExp(`^${k}:[ \\t]*(.*)$`, "m").exec(front)?.[1]?.trim();
    if (!v) return undefined;
    return v.startsWith("'") && v.endsWith("'") ? v.slice(1, -1).replace(/''/g, "'") : v.replace(/^"|"$/g, "");
  };
  const id = /^#\s*(\S+)\s*$/m.exec(front)?.[1] ?? fallbackId;
  if (!id) return undefined;
  const parent = field("parent");
  const blockedBy = sequenceIn(front, "blocked_by").ids;
  const tags = sequenceIn(front, "tags").ids;
  return {
    id,
    title: field("title") ?? id,
    status: field("status") ?? "unknown",
    type: field("type") ?? "task",
    ...(parent ? { parent } : {}),
    ...(blockedBy.length ? { blockedBy } : {}),
    ...(tags.length ? { tags } : {}),
    body: m[2] ?? "",
  };
}

/** Replace (or drop, when empty) a block sequence in the front matter. Leaves `updated_at` to the caller. */
export function setSequenceInText(raw: string, key: string, ids: readonly string[]): string {
  const m = FM.exec(raw);
  if (!m) throw new Error("not a bean file: no front matter");
  let front = m[1]!;
  const { span } = sequenceIn(front, key);
  const block = sequenceLines(key, ids).join("\n");
  if (span) front = front.slice(0, span[0]) + (block ? `${block}\n` : "") + front.slice(span[1]);
  else if (block) front = `${front}\n${block}`;
  return `---\n${front.replace(/\n+$/, "")}\n---\n${m[2]}`;
}

/** Whether a filter admits a bean. */
export function admits(filter: BeanFilter, b: BeanFields): boolean {
  return (
    (filter.archived === true) === (b.archived === true) &&
    (!filter.status || b.status === filter.status) &&
    (!filter.type || b.type === filter.type) &&
    (!filter.tag || (b.tags ?? []).includes(filter.tag)) &&
    (!filter.parent || b.parent === filter.parent)
  );
}

/**
 * The checks every Tool makes before a write, in the contract's order, so a
 * refusal reads the same whichever Tool gave it. `all` is the store as read.
 */
export function refuseWrite(
  all: ReadonlyMap<string, BeanFields>,
  after: Pick<BeanFields, "status" | "parent" | "blockedBy" | "archived">,
  statuses: ReadonlySet<string>,
): Refusal | undefined {
  if (!statuses.has(after.status)) return { state: "refused", why: "closed-list", detail: `status ${after.status}` };
  for (const l of [...(after.parent ? [after.parent] : []), ...(after.blockedBy ?? [])]) {
    if (!all.has(l)) return { state: "refused", why: "dangling-link", detail: l };
  }
  if (after.archived && !TERMINAL_STATUSES.has(after.status)) {
    return { state: "refused", why: "not-terminal", detail: `it is ${after.status}, and only a completed or scrapped bean may be archived` };
  }
  return undefined;
}

/** An exact id, else the one id ending `-<id>`; ambiguous is none. */
export function resolveId(ids: Iterable<string>, id: string): string | undefined {
  const all = [...ids];
  if (all.includes(id)) return id;
  const bySuffix = all.filter((k) => k.endsWith(`-${id}`));
  return bySuffix.length === 1 ? bySuffix[0] : undefined;
}

// ---------------------------------------------------------------------------
// Where a bean is: read from the instances (owner, 2026-11-02, Q-BSD-1 B).
// The bean records no position of its own; these are the one reading of the
// instances every Tool shares, so `positions` and `beansAt` agree whichever
// Tool holds them.

/** An instance as these two read it: the fields of `InstanceState` they need. */
export interface InstanceLike {
  id: string;
  processId: string;
  bean?: string;
  carriedBeans?: string[];
  tokens: string[];
  status: string;
  updatedAt?: string;
  history?: ReadonlyArray<{ at?: string; node?: string; actor?: string; outcome?: string }>;
  children?: Record<string, InstanceLike>;
}

/** The newest moment an instance moved: `updatedAt`, else its latest dated history line. */
function lastMove(s: InstanceLike): string | undefined {
  if (s.updatedAt) return s.updatedAt;
  return (s.history ?? []).map((h) => h.at).filter((a): a is string => !!a).sort().at(-1);
}

/**
 * Every instance and sub-instance, each with the beans it carries. A bean the
 * parent names travels into every phase the parent calls, as the engine's
 * `TaskContext.carriedBeans` already has it.
 */
export function* walk(s: InstanceLike, inherited: ReadonlySet<string>, path: string): Generator<{ s: InstanceLike; beans: Set<string>; id: string }> {
  const beans = new Set([...inherited, ...(s.bean ? [s.bean] : []), ...(s.carriedBeans ?? [])]);
  yield { s, beans, id: path };
  for (const [node, child] of Object.entries(s.children ?? {})) yield* walk(child, beans, `${path}/${node}`);
}

/**
 * `positions(beanId)`: every instance (and phase) naming the bean, with where
 * its tokens are. A sub-instance's id is the parent's, then the call
 * activity's node, joined by `/`. Oldest move first.
 */
export function positionsIn(instances: Iterable<InstanceLike>, beanId: string): Position[] {
  const out: Array<Position & { lastMoved?: string }> = [];
  for (const top of instances) {
    for (const { s, beans, id } of walk(top, new Set(), top.id)) {
      if (!beans.has(beanId)) continue;
      const moved = lastMove(s);
      out.push({ process: s.processId, instance: id, nodes: [...s.tokens].sort(), status: s.status, ...(moved ? { lastMoved: moved } : {}) });
    }
  }
  return out.sort((a, b) => (a.lastMoved ?? "").localeCompare(b.lastMoved ?? "") || a.instance.localeCompare(b.instance));
}

/**
 * `beansAt(process, step?)`: the beans with a token at that step of that
 * process. With no step, the beans of every RUNNING instance of the process:
 * a finished instance's tokens rest on its end event, and "the beans in this
 * process" means the ones still in it. Sorted, each once.
 */
export function beansAtIn(instances: Iterable<InstanceLike>, process: string, step?: string): string[] {
  const out = new Set<string>();
  for (const top of instances) {
    for (const { s, beans } of walk(top, new Set(), top.id)) {
      if (s.processId !== process) continue;
      const here = step === undefined ? s.status === "running" : s.tokens.includes(step);
      if (here) for (const b of beans) out.add(b);
    }
  }
  return [...out].sort();
}

// ---------------------------------------------------------------------------
// The bean in the task's context (cat-harness#991 step 4b; proposal §4.4).

/** A carried bean as an agent receives it with its step: the bean itself, not only its id. */
export interface BeanInContext {
  id: string;
  /** False when the store holds no such bean: an instance naming a deleted bean, or another store's. */
  found: boolean;
  title?: string;
  status?: string;
  type?: string;
  parent?: string;
  blockedBy?: string[];
  tags?: string[];
  archived?: boolean;
  body?: string;
  /** Where the bean is, from the instances (Q-BSD-1 B). */
  positions?: Position[];
  /** Set instead of `positions` when the instances could not be read: could not determine is not "nowhere". */
  positionsUnknown?: string;
}

/** Each id, read through `get` and `positions`. Never throws for one bean. */
export function beansInContext(store: WorkPlanStore, ids: readonly string[]): BeanInContext[] {
  return ids.map((id): BeanInContext => {
    const got = store.get(id);
    if (got.state !== "hit") return { id, found: false };
    const { id: _id, ...fields } = got.bean;
    let where: Pick<BeanInContext, "positions" | "positionsUnknown">;
    try {
      where = { positions: store.positions(got.bean.id) };
    } catch (e) {
      where = { positionsUnknown: e instanceof Error ? e.message : String(e) };
    }
    return { id: got.bean.id, found: true, ...fields, ...where };
  });
}

/**
 * The same position with each enabled step's context carrying its beans.
 * Each bean is read once, however many steps carry it.
 */
export function withBeans<P extends { enabled: Array<{ context?: { carriedBeans: string[]; beans?: BeanInContext[] } }> }>(
  pos: P,
  store: WorkPlanStore,
): P {
  const ids = [...new Set(pos.enabled.flatMap((e) => e.context?.carriedBeans ?? []))].sort();
  const read = new Map(beansInContext(store, ids).map((b, i) => [ids[i]!, b]));
  return {
    ...pos,
    enabled: pos.enabled.map((e) =>
      e.context ? { ...e, context: { ...e.context, beans: e.context.carriedBeans.map((id) => read.get(id)!) } } : e,
    ),
  };
}

/** One line per bean, for the text an agent reads. */
export function describeBeans(beans: readonly BeanInContext[]): string {
  if (beans.length === 0) return "";
  const lines = ["", "  beans:"];
  for (const b of beans) {
    if (!b.found) {
      lines.push(`    ${b.id} — not in the work plan`);
      continue;
    }
    const where = b.positionsUnknown
      ? `position could not be read: ${b.positionsUnknown}`
      : (b.positions ?? []).filter((p) => p.status === "running").map((p) => `${p.process} at ${p.nodes.join(", ") || "(no token)"}`).join("; ") ||
        "in no running process";
    lines.push(`    ${b.id} — ${b.title} (${b.status}${b.archived ? ", archived" : ""}); ${where}`);
  }
  return lines.join("\n");
}
