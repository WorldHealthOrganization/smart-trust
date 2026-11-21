/**
 * Expand a Jekyll config's GLOB front-matter scopes into one exact-path scope
 * per path the glob matches, over the finished composed tree.
 *
 * WHY (owner, 2026-10-14: "Explicit scopes"). Jekyll re-evaluates every
 * `defaults` scope on every `to_liquid` of every page, and a scope whose path
 * holds `*` is evaluated by `Dir.glob` plus a `Pathname#relative_path_from`
 * per match, EVERY time. On the folio-assistant docs tree the seven glob
 * scopes in `cat-harness/docs/_config.yml` took ~68% of the build's CPU
 * (stackprof); with them written out, the full tree built in 263 s instead of
 * 1146 s, byte-identical (cat-harness#233's measurements).
 *
 * Written out BY HAND they would rot: a page added to `start/` would silently
 * miss its permalink. So the glob stays in the authored config as the
 * declaration, and this step, run where the composed tree and its config are
 * assembled (`compose-docs.ts`), expands it against the files actually there.
 *
 * EQUIVALENCE, under both Jekyll 3.10 (the github-pages gem CI builds with)
 * and Jekyll 4:
 *
 * - The generated paths are exactly what the glob's `Dir.glob` returns, files
 *   AND directories, relative to the source. Both Jekylls test each globbed
 *   path with the same subpath test they use for a bare scope (3.10: path
 *   segments; 4: `start_with?`), so a bare scope on each globbed path matches
 *   exactly the pages the glob did, in either version. `process/*` yields
 *   `process/<entry>`, never `processes/`.
 * - A matched directory (a locale folder, `start/fr`) stays ONE scope for the
 *   whole folder, as the glob treats it; listing its files one by one would
 *   differ from the glob under Jekyll 4's `start_with?`.
 * - Precedence is by scope-path LENGTH in both versions, and a generated path
 *   is longer than its glob, so it can only win MORE ties. Expansion therefore
 *   refuses when another scope sets one of the same keys (see
 *   `precedenceConflicts`), rather than shift which default wins.
 * - The generated entries take the glob entry's place in the list, in sorted
 *   order, with its `values` deep-copied (no YAML anchors).
 *
 * Only the `Dir.glob` features the configs use are implemented: `*` and `?`
 * within a path segment. `**`, `[...]`, `{...}`, escapes, a leading `/` or
 * `..`, and a trailing `/` are REFUSED with an error rather than approximated.
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";
import { join } from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

/** A `defaults` entry as Jekyll reads it. */
interface DefaultsEntry {
  scope?: { path?: unknown; type?: unknown; [k: string]: unknown };
  values?: Record<string, unknown>;
  [k: string]: unknown;
}

/** Jekyll's own test for "this scope is a glob": `scope["path"].to_s.include?("*")`. */
export const isGlobScopePath = (path: unknown): path is string => typeof path === "string" && path.includes("*");

/** One segment of a glob as a RegExp, or the literal name when it has no wildcard. */
function segmentMatcher(seg: string, pattern: string): RegExp | string {
  if (/[[\]{}\\]/.test(seg) || seg.includes("**")) {
    throw new Error(`default-scope-globs: '${pattern}' uses a glob feature this expansion does not implement (only * and ? within a segment)`);
  }
  if (!/[*?]/.test(seg)) return seg;
  const body = seg.replace(/[.+^$()|]/g, "\\$&").replace(/\*/g, "[^/]*").replace(/\?/g, "[^/]");
  return new RegExp(`^${body}$`);
}

/**
 * What Ruby's `Dir.glob(File.join(root, pattern))` returns, relative to
 * `root`, sorted. A wildcard segment does not match a name beginning with `.`
 * unless the segment itself begins with `.` (Ruby's default, no DOTMATCH).
 */
export function globScopeMatches(root: string, pattern: string): string[] {
  if (pattern.startsWith("/") || pattern.endsWith("/") || pattern.split("/").includes("..") || pattern === "") {
    throw new Error(`default-scope-globs: '${pattern}' is not a relative glob this expansion implements`);
  }
  const segs = pattern.split("/").filter((s) => s !== "" && s !== ".");
  let frontier: string[] = [""];
  for (const [i, seg] of segs.entries()) {
    const last = i === segs.length - 1;
    const m = segmentMatcher(seg, pattern);
    const next: string[] = [];
    for (const rel of frontier) {
      const dir = rel === "" ? root : join(root, rel);
      if (typeof m === "string") {
        const cand = rel === "" ? m : `${rel}/${m}`;
        try {
          const st = statSync(join(root, cand));
          if (last || st.isDirectory()) next.push(cand);
        } catch {
          /* absent: no match */
        }
        continue;
      }
      let names: string[];
      try {
        names = readdirSync(dir);
      } catch {
        continue;
      }
      for (const name of names) {
        if (name.startsWith(".") && !seg.startsWith(".")) continue;
        if (!m.test(name)) continue;
        const cand = rel === "" ? name : `${rel}/${name}`;
        if (!last) {
          try {
            if (!statSync(join(root, cand)).isDirectory()) continue;
          } catch {
            continue;
          }
        }
        next.push(cand);
      }
    }
    frontier = next;
  }
  return [...new Set(frontier)].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/** Could a page be under both scope paths, by either Jekyll's subpath test? Conservative: the literal stems are prefixes one way or the other. */
const mayOverlap = (a: string, b: string): boolean => {
  const sa = a.replace(/[*?].*$/, "");
  const sb = b.replace(/[*?].*$/, "");
  return sa.startsWith(sb) || sb.startsWith(sa);
};

/**
 * The other `defaults` entries that could change which value wins once the
 * glob's scope path is lengthened. Both Jekylls give precedence to the LONGER
 * scope path (ties by `type`, then order), so an overlapping scope that sets
 * the same key with a path SHORTER than the glob lost to it before and loses
 * to every longer generated path too. Only one at least as long as the glob
 * can flip, so only those are conflicts, and expansion refuses on any.
 */
export function precedenceConflicts(entries: readonly DefaultsEntry[], globIndex: number): string[] {
  const g = entries[globIndex]!;
  const gPath = String(g.scope?.path ?? "");
  const keys = Object.keys(g.values ?? {});
  const out: string[] = [];
  for (const [j, e] of entries.entries()) {
    if (j === globIndex) continue;
    const p = String(e.scope?.path ?? "");
    if (p.replace(/^\.?\/+|\/+$/g, "").length < gPath.replace(/^\.?\/+|\/+$/g, "").length) continue;
    if (!mayOverlap(gPath, p)) continue;
    const shared = keys.filter((k) => k in (e.values ?? {}));
    if (shared.length > 0) out.push(`'${p}' also sets ${shared.join(", ")}`);
  }
  return out;
}

/** What one glob scope became. */
export interface ExpandedScope {
  readonly glob: string;
  readonly paths: string[];
}

/**
 * Return `config` with every glob `defaults` scope replaced by exact-path
 * scopes over `root`. `config` is not mutated. `expanded` is empty, and
 * `config` returned as given, when there is no glob scope.
 */
export function expandGlobScopes(config: unknown, root: string): { config: unknown; expanded: ExpandedScope[] } {
  if (typeof config !== "object" || config === null || Array.isArray(config)) return { config, expanded: [] };
  const defaults = (config as Record<string, unknown>).defaults;
  if (!Array.isArray(defaults) || !defaults.some((e) => isGlobScopePath((e as DefaultsEntry)?.scope?.path))) {
    return { config, expanded: [] };
  }
  const entries = defaults as DefaultsEntry[];
  const next: DefaultsEntry[] = [];
  const expanded: ExpandedScope[] = [];
  for (const [i, e] of entries.entries()) {
    const glob = e?.scope?.path;
    if (!isGlobScopePath(glob)) {
      next.push(e);
      continue;
    }
    const conflicts = precedenceConflicts(entries, i);
    if (conflicts.length > 0) {
      throw new Error(
        `default-scope-globs: cannot expand '${glob}' without changing precedence: ${conflicts.join("; ")}`,
      );
    }
    const paths = globScopeMatches(root, glob);
    for (const p of paths) {
      next.push({ ...structuredClone(e), scope: { ...structuredClone(e.scope), path: p } });
    }
    expanded.push({ glob, paths });
  }
  return { config: { ...(config as Record<string, unknown>), defaults: next }, expanded };
}

/**
 * Replace the top-level `defaults:` block of a YAML config's TEXT with
 * `defaults`, leaving every other byte as it was: the other keys, their
 * quoting and folding, and the comments around them. A run of comment or
 * blank lines at the block's end, before the next key, belongs to that key and
 * is kept.
 *
 * Checked, not trusted: the result must parse to the original with only
 * `defaults` replaced, or it throws. A config this cannot splice (no block
 * `defaults:` key at column 0, say) is therefore refused rather than
 * re-serialised wholesale.
 */
export function spliceDefaults(text: string, defaults: unknown[]): string {
  const lines = text.split("\n");
  const start = lines.findIndex((l) => /^defaults:\s*(#.*)?$/.test(l));
  if (start < 0) throw new Error("default-scope-globs: no top-level `defaults:` block to splice");
  let end = start + 1;
  while (end < lines.length && !/^[^\s#-]/.test(lines[end]!)) end++;
  while (end > start + 1 && /^(#.*)?\s*$/.test(lines[end - 1]!)) end--;
  const block = stringifyYaml({ defaults }).replace(/\n$/, "").split("\n");
  const out = [...lines.slice(0, start), ...block, ...lines.slice(end)].join("\n");
  const before = parseYaml(text) as Record<string, unknown>;
  const after = parseYaml(out) as Record<string, unknown>;
  if (!isDeepStrictEqual(after, { ...before, defaults })) {
    throw new Error("default-scope-globs: splicing `defaults` would change another key; refusing");
  }
  return out;
}

/**
 * Expand the glob scopes of the Jekyll config at `configPath` over `root`,
 * rewriting only its `defaults` block. Untouched when it has no glob scope.
 */
export function expandGlobScopesInFile(configPath: string, root: string): ExpandedScope[] {
  const text = readFileSync(configPath, "utf-8");
  const r = expandGlobScopes(parseYaml(text), root);
  if (r.expanded.length === 0) return [];
  writeFileSync(configPath, spliceDefaults(text, (r.config as { defaults: unknown[] }).defaults));
  return r.expanded;
}
