/**
 * Projected reads: a reader that uses only part of a file says so, and a
 * writer's record keeps only that part.
 *
 * @module schemas/sdlc/read-projections
 * @graphNode none — a table of pure functions and the hook that reports them
 *
 * A writer's record (`writer-cone.ts`) keeps the content digest of every file
 * its traced run opened. Some files are opened by nearly every writer and used
 * for almost nothing, e.g. every `*.json` beside a declaration read only for
 * its `name` (`build/qa-refresh.json`), `docs/todos.json` read only for its
 * `directories`, and a mount marker such as `.git/branch-mounts/beans.json`
 * read only for where the mount lives. Their whole digest would make writers
 * re-run when an unused part changes.
 *
 * ## The rule
 *
 * The line above such a read calls {@link projectedRead} with the file and a
 * {@link PROJECTIONS} name. Under a recording run the report goes to the
 * input trace (`input-trace.ts`). The writer's record then stores
 * `proj <name> <digest of the projection>` for that file instead of its whole
 * digest, but only when every open of the file in the strace trace is matched
 * by a report. A file that is also opened by code that did not report it keeps
 * its whole digest, so a projection covers only the code that names it.
 *
 * A projection must return everything its reader derives from the file. It is
 * reviewed like an `inert` input-site annotation: a wrong one is a wrong skip.
 */
import { createHash } from "node:crypto";
import { appendFileSync } from "node:fs";

/**
 * The environment variable naming the trace file of the run being recorded.
 * Declared here, and re-exported by `input-trace.ts`, because the harness
 * modules that report projected reads may not import that module.
 */
export const TRACE_ENV = "INPUT_HASH_TRACE";

/**
 * The prefix of a projected-read line: a report of how a file was used, not a
 * read the fingerprint misses, so `input-trace.ts` never counts it as reached.
 */
export const PROJECTED_LINE = "projected ";

const parsed = (text: string): { ok: true; value: unknown } | { ok: false } => {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
};

/**
 * Each projection, from the file's text to the canonical string of what its
 * reader uses. Unparseable text projects to `unparseable`, which the readers
 * all treat as a case of its own.
 */
export const PROJECTIONS = {
  /** `findDeclarationFile`: whether the JSON parses, and its `name`. */
  "declaration-name": (text: string): string => {
    const p = parsed(text);
    if (!p.ok) return "unparseable";
    const v = p.value as { name?: unknown } | null;
    return JSON.stringify(v !== null && typeof v === "object" ? (v.name ?? null) : null);
  },
  /** `nestedDirectories`: whether the JSON parses, and its `directories` as written. */
  "nested-directories": (text: string): string => {
    const p = parsed(text);
    if (!p.ok) return "unparseable";
    const v = p.value as { directories?: unknown } | null;
    return JSON.stringify(v !== null && typeof v === "object" ? (v.directories ?? null) : null);
  },
  /** A mount marker read only to find where the mount lives (`contentAt`): its schema, id, key, path and `into`. */
  "mount-location": (text: string): string => {
    const p = parsed(text);
    if (!p.ok) return "unparseable";
    const v = (p.value ?? {}) as Record<string, unknown>;
    return JSON.stringify([v.$schema ?? null, v.id ?? null, v.key ?? null, v.path ?? null, v.into ?? null]);
  },
} as const satisfies Record<string, (text: string) => string>;

export type ProjectionName = keyof typeof PROJECTIONS;

/** Whether `name` is a projection this version knows. */
export function isProjection(name: string): name is ProjectionName {
  return Object.hasOwn(PROJECTIONS, name);
}

/** The recorded state of a file read through projection `name`: `proj <name> <sha256>`. */
export function projectedState(name: ProjectionName, text: string): string {
  return `proj ${name} ${createHash("sha256").update(PROJECTIONS[name](text)).digest("hex")}`;
}

/** Say, just before reading `abs`, that this read uses only projection `name` of it. */
export function projectedRead(abs: string, name: ProjectionName): void {
  // input-site: inert #aff7f52b — names the trace file of the recording run; what is written there is never part of an answer
  const path = process.env[TRACE_ENV];
  if (path) appendFileSync(path, `${PROJECTED_LINE}${name} ${abs}\n`);
}

/**
 * The projected-read lines of a trace: each absolute path with its projection
 * and how many reads were reported. A path reported under two projections gets
 * no projection (`undefined`), so it keeps its whole digest.
 */
export function projectedReads(lines: readonly string[]): Map<string, { name: ProjectionName | undefined; count: number }> {
  const out = new Map<string, { name: ProjectionName | undefined; count: number }>();
  for (const l of lines) {
    if (!l.startsWith(PROJECTED_LINE)) continue;
    const rest = l.slice(PROJECTED_LINE.length);
    const sp = rest.indexOf(" ");
    if (sp < 0) continue;
    const name = rest.slice(0, sp);
    const abs = rest.slice(sp + 1);
    const known = isProjection(name) ? name : undefined;
    const prev = out.get(abs);
    if (prev === undefined) out.set(abs, { name: known, count: 1 });
    else out.set(abs, { name: prev.name === known ? known : undefined, count: prev.count + 1 });
  }
  return out;
}
