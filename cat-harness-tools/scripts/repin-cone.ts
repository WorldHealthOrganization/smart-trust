#!/usr/bin/env bun
/**
 * repin-cone — when a harness changes, show every site downstream of it, in
 * the order their re-pins must land, and for each pin that moves, an
 * old-versus-new IMPACT report: what changed upstream that the site mounts,
 * and which of the site's own files look like adaptations of a changed file.
 *
 * @module scripts/repin-cone
 * @graphNode none — a read-only planning report over the fleet's index.lock.json files
 * @covers none — it moves no pin; `mount:remote --seed` (or `repin-standing.ts`) does, and the trust check judges it
 *
 * A re-pin is also a REVIEW step, like a country comparing an old guideline,
 * the new one and its own adaptations. This tool produces the technical half
 * of that review; the people half is the "Guideline Updates" process.
 *
 *   bun run cat mount:repin:cone --fleet fleet.json --changed litlfred/cat-harness
 *   bun run cat mount:repin:cone --fleet a/x,a/y --changed litlfred/cat-harness --impact
 *   bun run cat mount:repin:cone --fleet fleet.json --all             # every behind pin, no cone
 *   ... --format md|json   --out <file>   --max-files <n>   --via git [--cache <dir>]
 *   ... --dispatch     # poke the READY sites' standing re-pin (`standing-repin.yml`), one wave at a time
 *
 * `--fleet` names the SITES to look at (a JSON file `{ "sites": ["owner/repo", ...] }`
 * or a comma list). This layer may not name the layers above it
 * (`check:reference-direction`), so the list is always the caller's.
 *
 * ## The order (waves)
 *
 * A site depends on every repository its lock's `mounts` pin. The CONE of a
 * changed repository is every fleet site that reaches it through those edges.
 * A site's wave is one more than the highest wave among its dependencies in
 * the cone (the changed repository is wave 0), so a site is re-pinned only
 * after every layer it takes from has landed its own re-pin. Sites in the
 * same wave can go in parallel.
 *
 * ## The impact report
 *
 * For each pin that moves (old = the lock's ref, new = the dependency's
 * default-branch head NOW; a dependency still waiting on its own re-pin is
 * marked so), the report lists the files that changed between the two, kept
 * to the directories the site actually mounts from that dependency (the
 * lock's `instances[].directories[].upstreamPath`). Then, for each kept file,
 * the site's own files that share its path or file name are listed as
 * POSSIBLE adaptations — a hint for the reviewer, never a verdict.
 *
 * Exit: 0 when the report was made; 2 when the fleet or a dependency could not
 * be read.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { repositoryOwner, resolveLockJson } from "../schemas/kg/repo-owner.ts";

// ── The network, behind one seam ────────────────────────────────────────────

/** The parts of an `index.lock.json` this tool reads. */
export interface FleetLock {
  mounts: Array<{ harness: string; repository: string; ref: string }>;
  instances?: Array<{ instance: string; repository: string; sha: string; directories?: Array<{ upstreamPath?: string }> }>;
}

/** Everything this tool asks GitHub. Tests pass a stub; {@link githubFleetApi} is the real one. */
export interface FleetApi {
  /** The site's `index.lock.json` on its default branch, or undefined when it has none. */
  lockOf(repository: string): Promise<FleetLock | undefined>;
  /** The head of the repository's default branch. */
  head(repository: string): Promise<string>;
  /** How far `head` is ahead of `base`, and the paths that changed between them. */
  compare(repository: string, base: string, head: string): Promise<{ aheadBy: number; files: string[] }>;
  /** Every file path in the repository at the default branch. */
  paths(repository: string): Promise<string[]>;
}

// ── The plan (pure) ─────────────────────────────────────────────────────────

export interface ConeSite {
  site: string;
  wave: number;
  /** The pins of this site that move: those on a dependency in the cone (or every behind pin with `all`). */
  moves: Array<{ harness: string; repository: string; from: string; waitsOn: boolean }>;
}

export interface ConePlan {
  changed?: string;
  sites: ConeSite[];
  /** Fleet sites with no lock on their default branch. */
  noLock: string[];
}

/**
 * The cone of `changed` over the fleet's locks, in waves. With `changed`
 * undefined, every fleet site is in the plan and every pin is a candidate move
 * (the "all" view); the waves still order the sites by their dependencies.
 */
export function planCone(locks: ReadonlyMap<string, FleetLock | undefined>, changed?: string): ConePlan {
  const deps = new Map<string, string[]>();
  const noLock: string[] = [];
  for (const [site, lock] of locks) {
    if (!lock) noLock.push(site);
    else deps.set(site, [...new Set(lock.mounts.map((m) => m.repository).filter((r) => r !== site))]);
  }
  const inCone = new Set<string>();
  if (changed) {
    let grew = true;
    while (grew) {
      grew = false;
      for (const [site, ds] of deps) {
        if (inCone.has(site) || site === changed) continue;
        if (ds.some((d) => d === changed || inCone.has(d))) {
          inCone.add(site);
          grew = true;
        }
      }
    }
  } else for (const site of deps.keys()) inCone.add(site);

  const wave = new Map<string, number>();
  const waveOf = (site: string, seen: Set<string>): number => {
    if (site === changed) return 0;
    if (!inCone.has(site)) return 0;
    const known = wave.get(site);
    if (known !== undefined) return known;
    if (seen.has(site)) throw new Error(`dependency cycle through ${site}`);
    seen.add(site);
    const w = 1 + Math.max(0, ...(deps.get(site) ?? []).filter((d) => d === changed || inCone.has(d)).map((d) => waveOf(d, seen)));
    seen.delete(site);
    wave.set(site, w);
    return w;
  };

  const sites: ConeSite[] = [...inCone].map((site) => {
    const lock = locks.get(site)!;
    const moves = lock.mounts
      .filter((m) => m.repository !== site && (!changed || m.repository === changed || inCone.has(m.repository)))
      .map((m) => ({ harness: m.harness, repository: m.repository, from: m.ref, waitsOn: inCone.has(m.repository) }));
    return { site, wave: waveOf(site, new Set()), moves };
  });
  sites.sort((a, b) => a.wave - b.wave || a.site.localeCompare(b.site));
  return { changed, sites, noLock: noLock.sort() };
}

/** The upstream directories a site mounts from `repository`: `""` means the whole tree. */
export function mountedPrefixes(lock: FleetLock, repository: string): string[] {
  const xs = (lock.instances ?? [])
    .filter((i) => i.repository === repository)
    .flatMap((i) => (i.directories ?? []).map((d) => (d.upstreamPath ?? ".").replace(/^\.\/?/, "").replace(/\/$/, "")));
  return xs.length === 0 ? [""] : [...new Set(xs)];
}

export function underAny(path: string, prefixes: readonly string[]): boolean {
  return prefixes.some((p) => p === "" || path === p || path.startsWith(`${p}/`));
}

const base = (p: string) => p.slice(p.lastIndexOf("/") + 1);

/**
 * File names every layer carries, so a name match on them says nothing about
 * adaptation: housekeeping, generated indexes and per-folder notes.
 */
export const GENERIC_NAMES: ReadonlySet<string> = new Set([
  ".gitignore", ".gitattributes", "AGENTS.md", "CLAUDE.md", "README.md", "SKILLS.md", "LICENSE", "bun.lock", "package.json",
  "tsconfig.json", "index.json", "index.jsonld", "index.md", "summaries.json", "manifest.json", "_config.yml", "index.config.json",
  "index.lock.json", "bunfig.toml", "docs.json", "settings.json",
]);

/**
 * The site's own files that look like adaptations of `changed`: the same
 * path, or the same file name when that name is not generic
 * ({@link GENERIC_NAMES}) and only ONE of the site's own files carries it.
 * Mounted copies (under a mount's `path`) are not the site's own and are left
 * out by the caller.
 */
export function possibleAdaptations(changed: string, own: readonly string[]): string[] {
  if (own.includes(changed)) return GENERIC_NAMES.has(base(changed)) || changed.startsWith(".github/") ? [] : [changed];
  const name = base(changed);
  if (GENERIC_NAMES.has(name) || name.startsWith(".")) return [];
  const same = own.filter((p) => base(p) === name);
  return same.length === 1 ? same : [];
}

// ── The report ──────────────────────────────────────────────────────────────

export interface MoveImpact {
  harness: string;
  repository: string;
  from: string;
  to: string;
  behind: number;
  waitsOn: boolean;
  /** Changed files the site mounts. */
  reaching: string[];
  /** Changed files outside what the site mounts. */
  outside: number;
  adaptations: Array<{ upstream: string; own: string[] }>;
}

export interface SiteImpact {
  site: string;
  wave: number;
  /** True when no dependency it takes from still has a re-pin of its own to land: its PR can open now. */
  ready: boolean;
  moves: MoveImpact[];
}

/** Resolve heads, behind counts and (with `impact`) the impact of every move in the plan. */
export async function impactOf(plan: ConePlan, locks: ReadonlyMap<string, FleetLock | undefined>, api: FleetApi, opts: { impact?: boolean } = {}): Promise<SiteImpact[]> {
  const heads = new Map<string, Promise<string>>();
  const headOf = (r: string) => {
    if (!heads.has(r)) heads.set(r, api.head(r));
    return heads.get(r)!;
  };
  const out: SiteImpact[] = [];
  for (const s of plan.sites) {
    const lock = locks.get(s.site)!;
    const own = opts.impact ? await ownPaths(s.site, lock, api) : [];
    const moves: MoveImpact[] = [];
    for (const m of s.moves) {
      const to = await headOf(m.repository);
      if (to === m.from) continue;
      const cmp = await api.compare(m.repository, m.from, to);
      const prefixes = mountedPrefixes(lock, m.repository);
      const reaching = cmp.files.filter((f) => underAny(f, prefixes));
      const adaptations = opts.impact
        ? reaching.map((f) => ({ upstream: f, own: possibleAdaptations(f, own) })).filter((a) => a.own.length > 0)
        : [];
      moves.push({ ...m, to, behind: cmp.aheadBy, reaching, outside: cmp.files.length - reaching.length, adaptations });
    }
    if (moves.length > 0) out.push({ site: s.site, wave: s.wave, ready: true, moves });
  }
  const pending = new Set(out.map((s) => s.site));
  for (const s of out) s.ready = !s.moves.some((m) => m.waitsOn && pending.has(m.repository));
  return out;
}

/** The site's own files: every path except those under a mounted layer's `path`. */
async function ownPaths(site: string, lock: FleetLock, api: FleetApi): Promise<string[]> {
  const mountedAt = new Set<string>();
  for (const i of (lock as { instances?: Array<{ path?: string; repository: string }> }).instances ?? []) {
    if (i.repository !== site && i.path) mountedAt.add(i.path.replace(/\/$/, ""));
  }
  const all = await api.paths(site);
  return all.filter((p) => ![...mountedAt].some((m) => p === m || p.startsWith(`${m}/`)));
}

const short = (sha: string) => sha.slice(0, 7);

/** The report as Markdown: the waves, then one section per site. */
export function reportOf(plan: ConePlan, impacts: readonly SiteImpact[], maxFiles = 15): string {
  const L: string[] = [plan.changed ? `## Re-pin cone of \`${plan.changed}\`` : "## Behind pins across the fleet", ""];
  if (impacts.length === 0) L.push("Every site in the cone is already on the newest commit.", "");
  const waves = [...new Set(impacts.map((i) => i.wave))].sort((a, b) => a - b);
  L.push("| wave | site | ready now | pins moving | commits behind (largest) | waits on a re-pin upstream |", "|---:|---|---|---|---:|---|");
  for (const s of impacts) {
    const waits = s.moves.filter((m) => m.waitsOn).map((m) => m.harness);
    L.push(`| ${s.wave} | ${s.site} | ${s.ready ? "yes" : "no"} | ${s.moves.map((m) => m.harness).join(", ")} | ${Math.max(...s.moves.map((m) => m.behind))} | ${waits.join(", ") || "no"} |`);
  }
  L.push("", `Land the waves in order: ${waves.map((w) => `wave ${w}`).join(" → ")}. A site is "ready now" when nothing it takes from still has a re-pin of its own to land; open those PRs first, then run this again.`, "");
  for (const s of impacts) {
    L.push(`### ${s.site} (wave ${s.wave})`, "");
    for (const m of s.moves) {
      L.push(`- **${m.harness}** \`${short(m.from)}\` → \`${short(m.to)}\`: ${m.behind} commits, ${m.reaching.length} changed files this site mounts, ${m.outside} outside it${m.waitsOn ? " (moves again after its own re-pin)" : ""}`);
      for (const f of m.reaching.slice(0, maxFiles)) L.push(`  - \`${f}\``);
      if (m.reaching.length > maxFiles) L.push(`  - … and ${m.reaching.length - maxFiles} more`);
      if (m.adaptations.length > 0) {
        L.push("  - Possible adaptations to review:");
        for (const a of m.adaptations.slice(0, maxFiles)) L.push(`    - \`${a.upstream}\` ↔ ${a.own.map((o) => `\`${o}\``).join(", ")}`);
      }
    }
    L.push("", "Re-pin with: " + s.moves.map((m) => `\`--seed ${m.harness}=${m.repository}@${short(m.to)}\``).join(" ") + " (`bun run cat mount:remote`, with the owner's consent evidence)", "");
  }
  if (plan.noLock.length) L.push(`No \`index.lock.json\` on the default branch: ${plan.noLock.join(", ")}.`, "");
  return L.join("\n");
}

// ── The real network ────────────────────────────────────────────────────────

/** The real {@link FleetApi}: the REST API with `GITHUB_TOKEN` / `GH_TOKEN` when set. */
export function githubFleetApi(token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN, apiBase = process.env.GITHUB_API_URL ?? "https://api.github.com"): FleetApi {
  const get = async <T>(path: string, raw = false): Promise<T | undefined> => {
    const r = await fetch(`${apiBase}${path}`, {
      headers: { Accept: raw ? "application/vnd.github.raw" : "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    if (r.status === 404) return undefined;
    if (!r.ok) throw new Error(`GET ${path}: HTTP ${r.status}`);
    return (raw ? JSON.parse(await r.text()) : await r.json()) as T;
  };
  const must = async <T>(path: string): Promise<T> => {
    const x = await get<T>(path);
    if (x === undefined) throw new Error(`GET ${path}: not found`);
    return x;
  };
  const repo = (r: string) => r.split("/").map(encodeURIComponent).join("/");
  const branches = new Map<string, Promise<string>>();
  const defaultBranch = (r: string) => {
    if (!branches.has(r)) branches.set(r, must<{ default_branch: string }>(`/repos/${repo(r)}`).then((x) => x.default_branch));
    return branches.get(r)!;
  };
  return {
    lockOf: (r) => get<FleetLock>(`/repos/${repo(r)}/contents/index.lock.json`, true),
    async head(r) {
      return (await must<{ sha: string }>(`/repos/${repo(r)}/commits/${encodeURIComponent(await defaultBranch(r))}`)).sha;
    },
    async compare(r, b, h) {
      const x = await must<{ ahead_by: number; files?: Array<{ filename: string }> }>(`/repos/${repo(r)}/compare/${b}...${h}?per_page=300`);
      return { aheadBy: x.ahead_by, files: (x.files ?? []).map((f) => f.filename) };
    },
    async paths(r) {
      const x = await must<{ tree: Array<{ path: string; type: string }> }>(`/repos/${repo(r)}/git/trees/${encodeURIComponent(await defaultBranch(r))}?recursive=1`);
      return x.tree.filter((t) => t.type === "blob").map((t) => t.path);
    },
  };
}

/**
 * A {@link FleetApi} over blobless bare clones (`--via git`), for a sandbox
 * whose REST access is limited to the repositories attached to it: git over
 * HTTPS still reads every public repository. Clones are cached in `dir`.
 * Note: the compare API caps at 300 files; this path lists them all.
 */
export function gitFleetApi(dir: string, host = "https://github.com"): FleetApi {
  const git = (args: string[], ok = false): string | undefined => {
    const r = spawnSync("git", args, { encoding: "utf8", maxBuffer: 1 << 28 });
    if (r.status !== 0) {
      if (ok) return undefined;
      throw new Error(`git ${args.join(" ")}: ${r.stderr.trim()}`);
    }
    return r.stdout;
  };
  const ready = new Set<string>();
  const clone = (r: string) => {
    const at = `${dir}/${r.replace("/", "__")}.git`;
    if (!ready.has(r)) {
      if (existsSync(at)) git(["-C", at, "fetch", "-q", "--filter=blob:none", "origin", "+HEAD:HEAD"], true);
      else git(["clone", "-q", "--bare", "--filter=blob:none", `${host}/${r}`, at]);
      ready.add(r);
    }
    return at;
  };
  return {
    async lockOf(r) {
      const text = git(["-C", clone(r), "show", "HEAD:index.lock.json"], true);
      return text === undefined ? undefined : resolveLockJson(JSON.parse(text) as FleetLock, repositoryOwner(r));
    },
    async head(r) {
      return git(["-C", clone(r), "rev-parse", "HEAD"])!.trim();
    },
    async compare(r, b, h) {
      const at = clone(r);
      const n = Number(git(["-C", at, "rev-list", "--count", `${b}..${h}`])!.trim());
      const files = git(["-C", at, "diff", "--name-only", "--no-renames", b, h])!.split("\n").filter(Boolean);
      return { aheadBy: n, files };
    },
    async paths(r) {
      return git(["-C", clone(r), "ls-tree", "-r", "--name-only", "HEAD"])!.split("\n").filter(Boolean);
    },
  };
}

/**
 * Poke every READY site's standing re-pin (`standing-repin.yml` listens for
 * `repository_dispatch: upstream-merged`). This opens nothing by itself: the
 * site's own workflow moves only the pins its owner's standing consent covers,
 * and opens or updates its one re-pin PR. A site without that workflow
 * ignores the poke, and the report still lists its `--seed` line.
 */
export async function dispatchReady(impacts: readonly SiteImpact[], changed: string | undefined, token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN, apiBase = process.env.GITHUB_API_URL ?? "https://api.github.com"): Promise<Array<{ site: string; status: number }>> {
  const out: Array<{ site: string; status: number }> = [];
  for (const s of impacts.filter((x) => x.ready)) {
    const r = await fetch(`${apiBase}/repos/${s.site}/dispatches`, {
      method: "POST",
      headers: { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ event_type: "upstream-merged", client_payload: { changed: changed ?? null, by: "repin-cone" } }),
    });
    out.push({ site: s.site, status: r.status });
  }
  return out;
}

/** `--fleet` as a JSON file `{ "sites": [...] }` or a comma list of `owner/repo`. */
export function fleetOf(arg: string): string[] {
  if (/\.json$/.test(arg)) return (JSON.parse(readFileSync(arg, "utf8")) as { sites: string[] }).sites;
  return arg.split(",").map((s) => s.trim()).filter(Boolean);
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const valueOf = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  try {
    const fleetArg = valueOf("--fleet");
    if (!fleetArg) throw new Error("--fleet <file.json|owner/repo,...> is required");
    const changedArg = argv.includes("--all") ? undefined : valueOf("--changed");
    if (!changedArg && !argv.includes("--all")) throw new Error("--changed <owner/repo> or --all is required");
    const changed = changedArg?.split("@")[0];
    const api = valueOf("--via") === "git" ? gitFleetApi(valueOf("--cache") ?? `${tmpdir()}/repin-cone`) : githubFleetApi();
    const sites = fleetOf(fleetArg);
    const locks = new Map(await Promise.all(sites.map(async (s) => [s, await api.lockOf(s)] as const)));
    const plan = planCone(locks, changed);
    const impacts = await impactOf(plan, locks, api, { impact: argv.includes("--impact") });
    const text = valueOf("--format") === "json" ? JSON.stringify({ plan, impacts }, null, 2) : reportOf(plan, impacts, Number(valueOf("--max-files") ?? 15));
    console.log(text);
    if (argv.includes("--dispatch")) {
      for (const d of await dispatchReady(impacts, changed)) console.error(`dispatch upstream-merged → ${d.site}: HTTP ${d.status}`);
    }
    const out = valueOf("--out");
    if (out) writeFileSync(out, text + "\n");
    process.exit(0);
  } catch (e) {
    console.error(`✗ ${(e as Error).message}`);
    process.exit(2);
  }
}
