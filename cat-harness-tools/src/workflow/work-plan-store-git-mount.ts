/**
 * **The git state branch Tool, on its mount.** The work-plan store's
 * operations performed on the `beans/` a session mounts from its
 * `cat/<harness>/beans` branch, with the `beans` CLI when it is installed and
 * by editing the file when it is not.
 *
 * This is the code the engine used to call directly (`bean-link.ts` before
 * cat-harness#991 step 3), moved behind {@link WorkPlanStore} and otherwise
 * unchanged: the same CLI calls, and the same bytes when the CLI is absent.
 * Pushing the mount to its branch stays `state:push`
 * (`work-plan-store-git-branch` in cat-harness); this Tool writes the mount.
 *
 * Where it differs from a reader's guess:
 *
 * - `ifMatch` is git's blob id of the bean file ({@link versionOf}), the same
 *   value `BranchStore` reads on the branch.
 * - An archived bean lives in `archive/` beside its directory (bean `e8m3`:
 *   archiving is a view, the status is kept).
 * - `note` appends `text` as a paragraph, as the CLI's `--body-append` does.
 *   `by` is not written into the body: this Tool's `history` takes who from
 *   git (Q-BSD-4 A, step 5).
 *
 * @module folio-assistant/workflow/work-plan-store-git-mount
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, sep } from "node:path";
import { inputSiteReached } from "../../schemas/sdlc/input-trace.ts";
import { BeanStatusSchema } from "../../schemas/tools/tool-types.ts";
import { setFieldInText } from "../../scripts/beans-fallback.ts";
import { BranchStore, branchPathOf, tipLocations } from "../../scripts/branch-store.ts";
import { resolveBeanDefs } from "../../scripts/beans.ts";
import { listInstances } from "./store.ts";
import { beanVersions, branchReader, checkoutReader, historyFrom, type GitReader } from "./work-plan-store-history.ts";
import type { MemoryEntry, MemoryScope } from "../../schemas/kg/memory-record.ts";
import {
  admits,
  beansAtIn,
  keepOn,
  openOn,
  recallOn,
  positionsIn,
  parseBeanText,
  refuseWrite,
  renderBeanText,
  resolveId,
  setSequenceInText,
  slugifyTitle,
  versionOf,
  type BeanChange,
  type BeanFields,
  type BeanFilter,
  type Got,
  type HistoryEvent,
  type MemoryRecordView,
  type Position,
  type Refusal,
  type WorkPlanStore,
} from "./work-plan-store.ts";

const BEANS_DIR = "beans";
/** The archive, inside the defs directory, where `beans archive` moves a bean (`beans/beans.json`: `defs/archive`). */
export const ARCHIVE_DIR = "archive";

const STATUSES: ReadonlySet<string> = new Set(BeanStatusSchema.options);

/** A bean as this Tool holds it: its fields, and the file they are in. */
export interface MountedBean {
  bean: BeanFields;
  path: string;
  text: string;
}

export class MountedGitBranchStore implements WorkPlanStore {
  private readonly readers = new Map<string, GitReader>();

  /**
   * @param repoRoot the checkout whose `beans/` is mounted.
   * @param opts.cli use the `beans` CLI when it is installed (default true).
   *   A test that must see this Tool's own bytes turns it off.
   */
  constructor(
    private readonly repoRoot: string,
    private readonly opts: { cli?: boolean } = {},
  ) {}

  /**
   * Where to look for a bean: the store's declared `defs` directory and its
   * `archive/`, then the flat `beans/` this module was written against.
   *
   * The flat layout alone found nothing once the store moved to `beans/defs/`:
   * every claim, note and resolve then reported "not in beans/" and recorded
   * nothing. The declaration is read through `resolveBeanDefs`, the one answer
   * every bean reader shares; an unreachable store falls through to the legacy
   * directory rather than throwing out of a workflow step.
   */
  dirs(): string[] {
    const defs = this.defsDir();
    const dirs = defs ? [defs, join(defs, ARCHIVE_DIR)] : [];
    dirs.push(join(this.repoRoot, BEANS_DIR));
    return [...new Set(dirs)].filter((d) => existsSync(d));
  }

  private defsDir(): string | null {
    try {
      return resolveBeanDefs(this.repoRoot).dir;
    } catch {
      return null;
    }
  }

  /** Every bean, first directory wins. Bean filenames are `<id>--<slugged-title>.md`. */
  all(): Map<string, MountedBean> {
    const out = new Map<string, MountedBean>();
    for (const dir of this.dirs()) {
      for (const f of readdirSync(dir)) {
        if (!f.endsWith(".md") || !f.includes("--")) continue;
        const id = f.split("--")[0]!;
        if (out.has(id)) continue;
        const path = join(dir, f);
        const text = readFileSync(path, "utf8");
        const parsed = parseBeanText(text, id);
        if (!parsed) continue;
        // The filename carries the id the store indexes by; the front matter's
        // `# id` comment is the same id when the file is well formed.
        const bean: BeanFields = { ...parsed, id, ...(basename(dir) === ARCHIVE_DIR ? { archived: true } : {}) };
        out.set(id, { bean, path, text });
      }
    }
    return out;
  }

  /** One bean and its file, by exact id or unique suffix. */
  find(id: string): MountedBean | undefined {
    const all = this.all();
    const key = resolveId(all.keys(), id);
    return key ? all.get(key) : undefined;
  }

  get(id: string): Got {
    const e = this.find(id);
    return e ? { state: "hit", bean: e.bean, version: versionOf(e.text) } : { state: "none" };
  }

  list(filter: BeanFilter = {}): BeanFields[] {
    return [...this.all().values()]
      .map((e) => e.bean)
      .filter((b) => admits(filter, b))
      .sort((a, b) => a.id.localeCompare(b.id));
  }

  create(bean: BeanFields): { state: "created"; version: string } | Refusal {
    const all = this.all();
    const fields = new Map([...all].map(([k, v]) => [k, v.bean]));
    const refused = refuseWrite(fields, bean, STATUSES);
    if (refused) return refused;
    if (all.has(bean.id)) return { state: "refused", why: "exists", detail: bean.id };
    const dir = this.defsDir() ?? join(this.repoRoot, BEANS_DIR);
    mkdirSync(dir, { recursive: true });
    const text = renderBeanText({ ...bean, archived: undefined }, stamp());
    const path = join(dir, `${bean.id}--${slugifyTitle(bean.title)}.md`);
    writeFileSync(path, text, "utf8");
    if (bean.archived) this.move(path, true);
    return { state: "created", version: versionOf(text) };
  }

  update(id: string, change: BeanChange, ifMatch: string): { state: "updated"; version: string } | Refusal | { state: "none" } {
    const all = this.all();
    const key = resolveId(all.keys(), id);
    if (!key) return { state: "none" };
    const e = all.get(key)!;
    const version = versionOf(e.text);
    if (version !== ifMatch) return { state: "refused", why: "stale", detail: `${key} is at ${version.slice(0, 12)}, not ${ifMatch.slice(0, 12)}` };
    const after = { ...e.bean, ...change };
    const refused = refuseWrite(new Map([...all].map(([k, v]) => [k, v.bean])), after, STATUSES);
    if (refused) return refused;

    let path = e.path;
    if (change.status !== undefined && change.status !== e.bean.status) {
      if (!this.cli(["update", key, "-s", change.status])) setStatusInFile(path, change.status);
    }
    let text = readFileSync(path, "utf8");
    const edited = text;
    if (change.title !== undefined) text = setFieldInText(text, "title", `'${change.title.replace(/'/g, "''")}'`);
    if (change.type !== undefined) text = setFieldInText(text, "type", change.type);
    if (change.parent !== undefined) text = setFieldInText(text, "parent", change.parent);
    if (change.blockedBy !== undefined) text = setFieldInText(setSequenceInText(text, "blocked_by", change.blockedBy), "updated_at", stamp());
    if (change.tags !== undefined) text = setFieldInText(setSequenceInText(text, "tags", change.tags), "updated_at", stamp());
    if (text !== edited) writeFileSync(path, text, "utf8");
    if (change.archived !== undefined && change.archived !== (e.bean.archived === true)) path = this.move(path, change.archived);
    return { state: "updated", version: versionOf(readFileSync(path, "utf8")) };
  }

  keep(id: string, entry: MemoryEntry): { state: "kept"; version: string } | { state: "none" } {
    return keepOn(this, id, entry);
  }

  recall(id: string): { state: "hit"; record: MemoryRecordView } | { state: "none" } {
    return recallOn(this, id);
  }

  open(record: { id: string; title: string; scope: MemoryScope; about?: string[] }): { state: "opened"; version: string } | Refusal {
    return openOn(this, record);
  }

  note(id: string, text: string, _by: string): { state: "noted"; version: string } | { state: "none" } {
    const e = this.find(id);
    if (!e) return { state: "none" };
    if (!this.cli(["update", e.bean.id, "--body-append", text])) appendToFile(e.path, text);
    return { state: "noted", version: versionOf(readFileSync(e.path, "utf8")) };
  }

  /**
   * The bean's history (Q-BSD-4 A): `git log` of its file where it is kept —
   * the `beans` branch when the graph has moved there, else this checkout —
   * merged with the steps of every instance naming it. A write on the mount
   * that has not been pushed yet is not history until it is (`state:push`).
   * An unknown id has no history. A history that cannot be read throws: it
   * is never answered with an empty list.
   */
  history(id: string): HistoryEvent[] {
    const e = this.find(id);
    if (!e) return [];
    const rel = relative(this.repoRoot, e.path).split(sep).join("/");
    let loc: ReturnType<typeof tipLocations>[number] | undefined;
    try {
      loc = tipLocations(this.repoRoot).find((l) => rel === l.path || rel.startsWith(`${l.path}/`));
    } catch {
      loc = undefined;
    }
    // One reader per branch for this store's life: a site build reads every
    // bean's history, and each reader fetches the whole branch once.
    const key = loc ? `branch:${loc.branch}` : "checkout";
    let reader = this.readers.get(key);
    if (!reader) {
      reader = loc ? branchReader(BranchStore.open(loc.branch, { repoRoot: this.repoRoot, log: () => {} })) : checkoutReader(this.repoRoot);
      this.readers.set(key, reader);
    }
    const path = loc ? `${branchPathOf(loc)}${rel.slice(loc.path.length)}` : rel;
    return historyFrom(e.bean.id, beanVersions(reader, path), listInstances(this.repoRoot));
  }

  /** Read from the instances in the mounted `workflows/` (Q-BSD-1 B). A short id resolves as `get` does. */
  positions(id: string): Position[] {
    const key = resolveId(this.all().keys(), id) ?? id;
    return positionsIn(listInstances(this.repoRoot), key);
  }

  beansAt(process: string, step?: string): string[] {
    return beansAtIn(listInstances(this.repoRoot), process, step);
  }

  /** Into `archive/` beside the bean's directory, or back out of it. */
  private move(path: string, archived: boolean): string {
    const dir = dirname(path);
    const to = archived ? join(dir, ARCHIVE_DIR) : dirname(dir);
    mkdirSync(to, { recursive: true });
    const next = join(to, basename(path));
    renameSync(path, next);
    return next;
  }

  /** Run the beans CLI; `false` when it is off, not installed, or the call fails. */
  private cli(args: string[]): boolean {
    if (this.opts.cli === false) return false;
    return cli(this.repoRoot, args) !== undefined;
  }
}

/** Run the beans CLI; `undefined` when it is not installed or the call fails. */
function cli(repoRoot: string, args: string[]): string | undefined {
  try {
    // input-site: traced #5457f2e6 — the beans CLI, a binary outside the tree
    inputSiteReached("bean-link: beans CLI");
    return execFileSync("beans", args, {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return undefined;
  }
}

function stamp(): string {
  // input-site: traced #1f19f8e1 — stamps a bean being written
  inputSiteReached("bean-link: clock");
  const stamp = new Date().toISOString().replace(/\.\d+Z$/, "Z");
  return stamp;
}

/**
 * Rewrite `status:` in the front matter, and bump `updated_at`.
 *
 * The fallback for when the CLI is absent — which is not hypothetical: this
 * repo's own session-start hook reports "beans CLI not on PATH" and reads
 * `beans/` directly. A work-plan integration that only worked with the CLI
 * installed would be off exactly when someone is picking up a fresh container.
 */
function setStatusInFile(path: string, status: string): void {
  const body = readFileSync(path, "utf8");
  if (!/^status:\s*.+$/m.test(body)) {
    throw new Error(`${path} has no \`status:\` in its front matter`);
  }
  const next = body
    .replace(/^status:\s*.+$/m, `status: ${status}`)
    .replace(/^updated_at:\s*.+$/m, `updated_at: ${stamp()}`);
  writeFileSync(path, next, "utf8");
}

function appendToFile(path: string, text: string): void {
  const body = readFileSync(path, "utf8").replace(/\s*$/, "\n");
  writeFileSync(path, `${body}\n${text}\n`, "utf8");
}
