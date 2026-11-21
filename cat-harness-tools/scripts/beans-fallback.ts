#!/usr/bin/env bun
/**
 * Work the bean store when the `beans` CLI is not available.
 *
 * Unlike a read-only fallback, this one writes, so an agent without the CLI
 * can still claim, create and note beans instead of working unclaimed.
 *
 * ## It is the same store, not a shadow copy
 *
 * Every operation reads and writes `beans/<id>--<slug>.md` in the layout the CLI
 * uses, with the id prefix and length taken from `.beans.yml`. Anything written
 * here is read by the CLI once it is available again, and vice versa — there is
 * no import step and no second store to reconcile.
 *
 * ## Idempotent create
 *
 * `beans create` mints a fresh id on every call and dedupes on nothing, so
 * `create` here refuses an exact title that already exists and names the bean
 * to claim instead. `--force` allows an intended duplicate title.
 *
 * Usage:
 *   bun run cat beans:fallback list [--status todo]
 *   bun run cat beans:fallback show <id>
 *   bun run cat beans:fallback create "<title>" [--type task] [--status todo] [--body "..."]
 *   bun run cat beans:fallback claim <id>
 *   bun run cat beans:fallback update <id> --status completed   # also lifts the blocks it held
 *   bun run cat beans:fallback note <id> "<text>"
 *   ... add --json to any of them
 *
 * @module scripts/beans-fallback
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { graphReadPath } from "./graph-read.ts";

export interface StoreConfig {
  dir: string;
  prefix: string;
  idLength: number;
  defaultStatus: string;
  defaultType: string;
}

export interface Bean {
  id: string;
  title: string;
  status: string;
  type: string;
  priority?: string;
  createdAt?: string;
  updatedAt?: string;
  path: string;
  body: string;
  issue?: number | string;
  targets?: string[];
}

/**
 * Read `.beans.yml`. Its five keys are flat scalars written by `beans init`, so
 * this reads them with a regex rather than taking a YAML dependency for a file
 * of this shape. Anything absent falls back to the same defaults the CLI uses.
 */
export function readStoreConfig(root: string): StoreConfig {
  const defaults: StoreConfig = {
    dir: "beans",
    prefix: "",
    idLength: 4,
    defaultStatus: "todo",
    defaultType: "task",
  };
  const p = join(root, ".beans.yml");
  if (!existsSync(p)) return defaults;
  const text = readFileSync(p, "utf-8");
  const scalar = (k: string): string | undefined =>
    new RegExp(`^\\s*${k}:\\s*(\\S+)\\s*$`, "m").exec(text)?.[1]?.replace(/^["']|["']$/g, "");
  const n = Number(scalar("id_length"));
  return {
    dir: scalar("path") ?? defaults.dir,
    prefix: scalar("prefix") ?? defaults.prefix,
    idLength: Number.isFinite(n) && n > 0 ? n : defaults.idLength,
    defaultStatus: scalar("default_status") ?? defaults.defaultStatus,
    defaultType: scalar("default_type") ?? defaults.defaultType,
  };
}

const FM = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/;

function parseBean(path: string): Bean | undefined {
  let raw: string;
  try {
    raw = readFileSync(path, "utf-8");
  } catch {
    return undefined;
  }
  const m = FM.exec(raw);
  if (!m) return undefined;
  const [, front, body] = m;
  const field = (k: string): string | undefined => {
    const v = new RegExp(`^${k}:\\s*(.*)$`, "m").exec(front!)?.[1]?.trim();
    return v?.replace(/^["']|["']$/g, "");
  };
  // The id is the `# <id>` comment the CLI writes as the first front-matter line;
  // fall back to the filename stem before `--`, which carries it too.
  const id =
    /^#\s*(\S+)\s*$/m.exec(front!)?.[1] ??
    path.split("/").pop()!.split("--")[0];
  const rawIssue = field("issue");
  const issue = rawIssue
    ? (/^\d+$/.test(rawIssue) ? Number.parseInt(rawIssue, 10) : rawIssue)
    : undefined;
  return {
    id: id!,
    title: field("title") ?? "(untitled)",
    status: field("status") ?? "todo",
    type: field("type") ?? "task",
    priority: field("priority"),
    createdAt: field("created_at"),
    updatedAt: field("updated_at"),
    path,
    body: body ?? "",
    ...(issue !== undefined ? { issue } : {}),
    targets: (() => {
      const block = new RegExp(`^targets:\\s*\\n((?:[ \\t]+-[ \\t]*\\S.*\\n?)+)`, "m").exec(front!);
      if (block) {
        return block[1]!
          .split("\n")
          .map((l) => l.replace(/^[ \t]*-[ \t]*/, "").trim().replace(/^['"]|['"]$/g, ""))
          .filter((s) => s.length > 0);
      }
      const flow = new RegExp(`^targets:\\s*\\[(.*)\\]\\s*$`, "m").exec(front!);
      if (flow) {
        return flow[1]!
          .split(",")
          .map((s) => s.trim().replace(/^['"]|['"]$/g, ""))
          .filter((s) => s.length > 0);
      }
      const single = new RegExp(`^targets:\\s*(\\S+)\\s*$`, "m").exec(front!);
      if (single && !single[1]!.startsWith("[") && single[1] !== "") {
        return [single[1]!.replace(/^['"]|['"]$/g, "")];
      }
      return undefined;
    })(),
  };
}

/**
 * `.beans.yml`'s `path`, relocated onto wherever the `beans` graph ACTUALLY is.
 *
 * Bean `9ofm` row D. `.beans.yml` carries a repository-relative path because
 * the `beans` binary is third-party and reads it that way, and that path stops
 * being in the checkout the moment the graph is cut over to its branch. So the
 * part of it the graph accounts for is rebased onto the graph's read path, and
 * the rest is kept — `beans/defs` under a graph at `beans` becomes
 * `<mount>/defs`.
 *
 * The declared prefix comes from {@link graphReadPath}'s `path` rather than
 * from `at`: those agree in the checkout and differ for a mount, and deriving
 * it from `at` would work until the day it mattered.
 *
 * A path OUTSIDE the declared graph is returned unchanged. That is not a
 * fallback hiding a failure: `.beans.yml` is free to point somewhere the
 * `beans` declaration says nothing about, and relocating such a path onto the
 * graph would be inventing an answer.
 */
export function fallbackStoreDir(root: string, cfg: StoreConfig): { at: string } | { refused: string } {
  const g = graphReadPath("beans", root);
  const plain = resolve(root, cfg.dir);
  if (g.state === "undeclared") return { at: plain };
  const rel = cfg.dir.split("\\").join("/").replace(/^\.\//, "").replace(/\/+$/, "");
  // IS MY PATH EVEN INSIDE THIS GRAPH — asked BEFORE inheriting a refusal.
  // Asking afterwards made an unreachable `beans` graph refuse a `.beans.yml`
  // pointing somewhere else entirely, which the tests here caught.
  const inside = g.path !== undefined && (rel === g.path || rel.startsWith(`${g.path}/`));
  if (!inside) return { at: plain };
  if (g.state === "refused") return { refused: g.reason };
  return { at: rel === g.path ? g.at : join(g.at, rel.slice(g.path.length + 1)) };
}

export function listBeans(root: string, cfg = readStoreConfig(root)): Bean[] {
  const where = fallbackStoreDir(root, cfg);
  // THROWS rather than returning `[]`. This module exists because an agent in
  // a container where the CLI would not install must still be able to work the
  // plan; `[]` from here reads as "there is no work", and bean `35nj` records
  // what that cost once already — two merged PRs' worth of work done
  // unclaimed. "Could not reach the store" and "the store is empty" must not
  // arrive as the same value.
  if ("refused" in where) throw new Error(`cannot read the bean store: ${where.refused}`);
  const dir = where.at;
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".md") && f !== "README.md")
    .map((f) => parseBean(join(dir, f)))
    .filter((b): b is Bean => Boolean(b))
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function findBean(root: string, id: string, cfg = readStoreConfig(root)): Bean | undefined {
  const all = listBeans(root, cfg);
  // Accept the bare suffix as well as the full prefixed id: an agent reading a
  // report sees `p4vj`, not `folio-assistant-p4vj`, and being strict about that
  // is a papercut with no upside.
  return all.find((b) => b.id === id) ?? all.find((b) => b.id.endsWith(`-${id}`) || b.id === `${cfg.prefix}${id}`);
}

const slugify = (s: string): string =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50);

/** Ids the CLI mints are lowercase alphanumeric of `id_length`. Match that. */
function mintId(cfg: StoreConfig, taken: Set<string>): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  for (let attempt = 0; attempt < 1000; attempt++) {
    let s = "";
    for (let i = 0; i < cfg.idLength; i++) {
      // input-site: inert #5b7a5266 — mints a new bean's id when one is created, a write; never part of a check's answer
      s += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    const id = `${cfg.prefix}${s}`;
    if (!taken.has(id)) return id;
  }
  throw new Error(`Could not mint a free id of length ${cfg.idLength} after 1000 attempts.`);
}

// input-site: inert #3e6aafde — the created_at / updated_at stamp written into a bean; never part of a check's answer
const nowStamp = (): string => new Date().toISOString().replace(/\.\d+Z$/, "Z");

export interface CreateOptions {
  title: string;
  type?: string;
  status?: string;
  priority?: string;
  issue?: number | string;
  body?: string;
  /** Allow a duplicate title. Has to be asked for. */
  force?: boolean;
}

export function createBean(root: string, opts: CreateOptions): { bean: Bean; duplicateOf?: Bean } {
  const cfg = readStoreConfig(root);
  const existing = listBeans(root, cfg);

  if (!opts.force) {
    const dup = existing.find((b) => b.title.trim() === opts.title.trim());
    if (dup) return { bean: dup, duplicateOf: dup };
  }

  const where = fallbackStoreDir(root, cfg);
  // A create must never land in the checkout once the store is on its branch:
  // the file would be invisible to every reader and lost at the next clone.
  if ("refused" in where) throw new Error(`cannot write to the bean store: ${where.refused}`);
  const dir = where.at;
  mkdirSync(dir, { recursive: true });
  const id = mintId(cfg, new Set(existing.map((b) => b.id)));
  const stamp = nowStamp();
  const path = join(dir, `${id}--${slugify(opts.title)}.md`);

  const front = [
    "---",
    `# ${id}`,
    `title: '${opts.title.replace(/'/g, "''")}'`,
    `status: ${opts.status ?? cfg.defaultStatus}`,
    `type: ${opts.type ?? cfg.defaultType}`,
    `priority: ${opts.priority ?? "normal"}`,
    ...(opts.issue !== undefined ? [`issue: ${opts.issue}`] : []),
    `created_at: ${stamp}`,
    `updated_at: ${stamp}`,
    "---",
    "",
  ].join("\n");

  writeFileSync(path, front + (opts.body ? `${opts.body}\n` : ""), "utf-8");
  return { bean: parseBean(path)! };
}

/**
 * {@link setField} as a pure TEXT transform.
 *
 * Extracted so the branch-store claim path (bean `9ofm`) writes **byte-identical**
 * bytes to what the filesystem writer produces. That is this module's stated
 * contract — "it is the same store, not a shadow copy", asserted by
 * `scripts/tests/beans-fallback.test.ts` — and the only way to keep it through
 * a second writer is for both to share the transform rather than reimplement
 * it. A claim spliced onto the branch has to read back cleanly under the CLI.
 */
export function setFieldInText(raw: string, key: string, value: string, now = nowStamp()): string {
  const m = FM.exec(raw);
  if (!m) throw new Error("not a bean file: no front matter");
  let front = m[1]!;
  const line = `${key}: ${value}`;
  front = new RegExp(`^${key}:.*$`, "m").test(front)
    ? front.replace(new RegExp(`^${key}:.*$`, "m"), line)
    : `${front}\n${line}`;
  if (key !== "updated_at") {
    front = /^updated_at:.*$/m.test(front)
      ? front.replace(/^updated_at:.*$/m, `updated_at: ${now}`)
      : `${front}\nupdated_at: ${now}`;
  }
  return `---\n${front}\n---\n${m[2]}`;
}

/** {@link noteBean} as a pure TEXT transform. Same reason as {@link setFieldInText}. */
export function appendNoteToText(raw: string, text: string, now = nowStamp()): string {
  const m = FM.exec(raw);
  if (!m) throw new Error("not a bean file: no front matter");
  const body = `${m[2]!.replace(/\s*$/, "")}\n\n_${now}_ — ${text}\n`;
  return setFieldInText(`---\n${m[1]}\n---\n${body}`, "updated_at", now, now);
}

/** Rewrite one front-matter scalar in place, leaving the body untouched. */
function setField(bean: Bean, key: string, value: string): void {
  writeFileSync(bean.path, setFieldInText(readFileSync(bean.path, "utf-8"), key, value), "utf-8");
}

/** The statuses that finish a bean. Closing one lifts the blocks it holds. */
export const CLOSING_STATUSES = new Set(["completed", "scrapped"]);

/** The ids in a block-style front-matter sequence (`key:` then `    - id` lines). */
function sequenceIn(front: string, key: string): { ids: string[]; span?: [number, number] } {
  const m = new RegExp(`^${key}:[ \\t]*\\n((?:[ \\t]+-[ \\t]*\\S.*(?:\\n|$))+)`, "m").exec(front);
  if (!m) return { ids: [] };
  const ids = m[1]!
    .split("\n")
    .map((l) => l.replace(/^[ \t]*-[ \t]*/, "").trim().replace(/^['"]|['"]$/g, ""))
    .filter((s) => s.length > 0);
  return { ids, span: [m.index, m.index + m[0].length] };
}

/**
 * Remove `blocker` from a bean's `key:` sequence, as a pure TEXT transform,
 * dropping the key when nothing is left and appending a dated note that says
 * why. `undefined` when the sequence does not name it, so a caller can tell
 * "nothing to lift" from "lifted".
 */
export function liftBlockInText(
  raw: string,
  key: "blocked_by" | "blocking",
  blocker: string,
  note: string,
  now = nowStamp(),
): string | undefined {
  const m = FM.exec(raw);
  if (!m) throw new Error("not a bean file: no front matter");
  const front = m[1]!;
  const { ids, span } = sequenceIn(front, key);
  if (!span || !ids.includes(blocker)) return undefined;
  const kept = ids.filter((x) => x !== blocker);
  const replacement = kept.length ? `${key}:\n${kept.map((x) => `    - ${x}`).join("\n")}\n` : "";
  let nextFront = front.slice(0, span[0]) + replacement + front.slice(span[1]);
  nextFront = nextFront.replace(/\n+$/, "");
  return appendNoteToText(`---\n${nextFront}\n---\n${m[2]}`, note, now);
}

/**
 * Lift every block a bean holds, because it has just closed.
 *
 * A block is declared from either end: `blocked_by:` on the blocked bean, or
 * `blocking:` on the blocker. Closing the blocker used to leave both in place,
 * so the blocked bean read as waiting on work that had already finished, and
 * the store collected "Block never lifted" findings (34 edges on
 * `cat/cat-harness/beans`, 2026-10-15) that someone had to clear by hand. So
 * closing a bean removes its id from every other bean's `blocked_by:` and
 * clears its own `blocking:`, with a dated note on each file it changes.
 *
 * Returns the ids of the beans whose `blocked_by:` changed.
 */
export function liftBlocksOf(root: string, closed: Bean, status: string, cfg = readStoreConfig(root)): string[] {
  const lifted: string[] = [];
  const now = nowStamp();
  for (const b of listBeans(root, cfg)) {
    if (b.id === closed.id) continue;
    const raw = readFileSync(b.path, "utf-8");
    const next = liftBlockInText(raw, "blocked_by", closed.id, `Block lifted: \`${closed.id}\` is ${status}.`, now);
    if (next !== undefined) {
      writeFileSync(b.path, next, "utf-8");
      lifted.push(b.id);
    }
  }
  const own = readFileSync(closed.path, "utf-8");
  const m = FM.exec(own);
  for (const target of m ? sequenceIn(m[1]!, "blocking").ids : []) {
    const cur = readFileSync(closed.path, "utf-8");
    const next = liftBlockInText(cur, "blocking", target, `Block on \`${target}\` lifted: this bean is ${status}.`, now);
    if (next !== undefined) writeFileSync(closed.path, next, "utf-8");
  }
  return lifted.sort();
}

export function updateBean(root: string, id: string, fields: Record<string, string>): Bean & { lifted?: string[] } {
  const bean = findBean(root, id);
  if (!bean) throw new Error(`No bean matching "${id}" in this store.`);
  for (const [k, v] of Object.entries(fields)) setField(bean, k, v);
  const status = fields.status;
  if (status !== undefined && CLOSING_STATUSES.has(status) && !CLOSING_STATUSES.has(bean.status)) {
    const lifted = liftBlocksOf(root, bean, status);
    return { ...parseBean(bean.path)!, lifted };
  }
  return parseBean(bean.path)!;
}

export function noteBean(root: string, id: string, text: string): Bean {
  const bean = findBean(root, id);
  if (!bean) throw new Error(`No bean matching "${id}" in this store.`);
  writeFileSync(bean.path, appendNoteToText(readFileSync(bean.path, "utf-8"), text), "utf-8");
  return parseBean(bean.path)!;
}

function usage(): string {
  return [
    "beans-fallback — work the bean store without the `beans` CLI",
    "",
    "  list [--status S]              every bean, or those with status S",
    "  show <id>                      one bean in full",
    '  create "<title>" [--type T] [--status S] [--body "..."] [--force]',
    "  claim <id>                     shorthand for: update <id> --status in-progress",
    "  update <id> --status S [--priority P]",
    '  note <id> "<text>"             append a timestamped line to the body',
    "",
    "  --json on any command for machine-readable output.",
    "",
    "Same store, same layout as the CLI — install it with scripts/install-beans.sh",
    "and it reads everything written here.",
  ].join("\n");
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const json = argv.includes("--json");
  const flag = (name: string): string | undefined => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const positional = argv.filter(
    (a, i) => !a.startsWith("--") && !(i > 0 && argv[i - 1]!.startsWith("--") && argv[i - 1] !== "--json" && argv[i - 1] !== "--force"),
  );
  const [cmd, ...rest] = positional;
  const root = resolve(".");

  const emit = (v: unknown, text: string): void => {
    console.log(json ? JSON.stringify(v, null, 2) : text);
  };

  try {
    switch (cmd) {
      case "list": {
        const status = flag("status");
        const beans = listBeans(root).filter((b) => !status || b.status === status);
        emit(
          beans,
          beans.length
            ? beans.map((b) => `${b.id.padEnd(24)} ${b.status.padEnd(12)} ${b.title}`).join("\n")
            : "(no beans)",
        );
        break;
      }
      case "show": {
        const b = findBean(root, rest[0] ?? "");
        if (!b) throw new Error(`No bean matching "${rest[0]}".`);
        emit(b, `${b.id}  [${b.status}/${b.type}]  ${b.title}\n${b.path}\n\n${b.body}`);
        break;
      }
      case "create": {
        const title = rest[0];
        if (!title) throw new Error('create needs a title: create "<title>"');
        const { bean, duplicateOf } = createBean(root, {
          title,
          type: flag("type"),
          status: flag("status"),
          priority: flag("priority"),
          issue: flag("issue"),
          body: flag("body"),
          force: argv.includes("--force"),
        });
        emit(
          { bean, duplicate: Boolean(duplicateOf) },
          duplicateOf
            ? `NOT created — a bean with this exact title already exists:\n` +
                `  ${bean.id}  [${bean.status}]  ${bean.title}\n` +
                `Claim it instead:  bun run cat beans:fallback claim ${bean.id}\n` +
                `(Pass --force only if a genuine duplicate title is intended.)`
            : `Created ${bean.id}\n  ${bean.path}`,
        );
        break;
      }
      case "claim": {
        const b = updateBean(root, rest[0] ?? "", { status: "in-progress" });
        emit(b, `${b.id} → in-progress`);
        break;
      }
      case "update": {
        const fields: Record<string, string> = {};
        for (const k of ["status", "priority", "type", "issue"]) {
          const v = flag(k);
          if (v) fields[k] = v;
        }
        if (!Object.keys(fields).length) throw new Error("update needs at least --status, --priority, --type or --issue.");
        const b = updateBean(root, rest[0] ?? "", fields);
        const lifted = b.lifted?.length ? `\n  block lifted on: ${b.lifted.join(", ")}` : "";
        emit(b, `${b.id} → ${Object.entries(fields).map(([k, v]) => `${k}=${v}`).join(" ")}${lifted}`);
        break;
      }
      case "note": {
        const b = noteBean(root, rest[0] ?? "", rest.slice(1).join(" "));
        emit(b, `noted on ${b.id}`);
        break;
      }
      default:
        console.log(usage());
        process.exit(cmd ? 1 : 0);
    }
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  }
}
