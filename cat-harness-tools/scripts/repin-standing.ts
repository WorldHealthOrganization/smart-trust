#!/usr/bin/env bun
/**
 * repin-standing — move every pin a STANDING consent covers to the newest
 * (or newest green) commit of the branch it follows, and record that rule's
 * consent for each new pin.
 *
 * @module scripts/repin-standing
 * @graphNode none — a scheduled maintenance step over a site's own `index.config.json`
 * @covers none — it moves pins; the mount (`remote-mount.ts`) and its trust
 * check judge what it moved, exactly as they judge a pin a person moved.
 *
 * Each site keeps its own lock. The rule and its trust semantics are the
 * harness's (`cat-harness/schemas/kg/mount-trust.ts`, "Standing consent"); this is
 * the implementation.
 *
 *   bun run cat mount:repin:standing                 # resolve, re-pin, re-mount (writes index.config.json + index.lock.json)
 *   bun run cat mount:repin:standing --dry-run       # resolve and print what WOULD move; write nothing
 *   bun run cat mount:repin:standing --no-mount      # write index.config.json only; run mount:remote yourself
 *   bun run cat mount:repin:standing --extend-from <old index.config.json>   # step 4a ONLY, after the pins moved
 *   ... --instance <root>   --depth <n>   --consent-on <YYYY-MM-DD>   --summary-file <f>   --no-install
 *
 * ## What it does, per layer
 *
 * 1. Reads the site's declared mounts through `readDeclaredMounts` and keeps
 *    those whose own `trust.standing` is declared.
 * 2. Resolves the followed branch through {@link GitHubApi} — the ONLY place
 *    this script reaches the network, so tests stub it. Without `require`, the
 *    candidate is the branch head; with `require: "green"`, the newest of the
 *    last `--depth` commits whose own combined status and check runs are green
 *    ({@link verdictOf}). None green: that layer does not move.
 * 3. Asks `standingCovers` (the harness's pure coverage decision) whether the
 *    rule covers the move. Not covered: reported, not moved.
 * 3a. The cascade ({@link alignToHeldPins}): a layer below the harness
 *    is not pinned to its branch head but to the commit the harness's own
 *    lock holds at the harness's new pin, because the harness commits
 *    artefacts generated from those pins (bootstrap's checklists).
 * 4. Moves the covered pins with `seedRemote` — the same write `mount:remote
 *    --seed` makes — with the rule's grant (`standingGrantOf`), so the consent
 *    for each new pin is written in the same write, by the rule's person,
 *    marked `standing`.
 * 4a. A NEWLY DECLARED directory ({@link extendExplicitDirectories}): where
 *    the site's override names the layer's directories explicitly, an id
 *    the new pin declares in the checkout and the old pin did not is added to
 *    that list, and the summary says so. The standing consent follows the
 *    branch, and a directory the layer adds comes with it. Without this a
 *    layer that declared a directory could never be re-pinned: the old list
 *    left the new directory absent (`check:declared-dirs`), and naming it
 *    before the move was refused at the old pin (folio-assistant#3023, a
 *    content layer that added three). Ids are only ever ADDED: one the site left out on
 *    purpose stays out, and nothing the site wrote is removed.
 * 5. Re-mounts with `mountRemote`, which rewrites `index.lock.json` and runs
 *    the trust check over every layer of the closure, and re-renders the
 *    agent surface when the lock changed (`afterMount`). A transitive layer
 *    whose consent does not cover its new pin is refused there, as always.
 *
 * Layers reached through a gitlink move with their parent's tree; a
 * `standing` rule on `overrides.<name>.trust` is not followed here.
 *
 * Exit: 0 when it finished (moved or nothing to move); 1 when the re-mount
 * reported a layer missing or refused; 2 when a branch or verdict could
 * not be determined, or a write failed.
 */
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { contentIsOffCheckout, type SubgraphSource } from "../schemas/kg/subgraph-source.js";
import { standingCovers, standingGrantOf, type StandingCandidate, type StandingConsent } from "../schemas/kg/mount-trust.js";
import type { RemoteMount } from "../schemas/kg/remote-mount.js";
import { readLockFile, repositoryOwner, resolveLockJson } from "../schemas/kg/repo-owner.ts";

// ── The network, behind one seam ────────────────────────────────────────────

export type CommitVerdict = NonNullable<StandingCandidate["verdict"]>;

/** Everything this script asks GitHub. Tests pass a stub; {@link githubApi} is the real one. */
export interface GitHubApi {
  /** The last `limit` commits of `branch` in `repository` (`owner/repo`), NEWEST FIRST. */
  branchCommits(repository: string, branch: string, limit: number): Promise<string[]>;
  /** The commit's own combined status and check runs, reduced by {@link verdictOf}. */
  commitVerdict(repository: string, sha: string): Promise<CommitVerdict>;
  /**
   * The pins `repository`'s own `index.lock.json` holds at `sha`, as
   * `{ repository → ref }`; `undefined` when it has none. Optional: an API
   * without it applies no cascade ({@link alignToHeldPins}).
   */
  lockPinsAt?(repository: string, sha: string): Promise<Record<string, string> | undefined>;
  /**
   * How `head` relates to `base` in `repository`: GitHub's compare `status`
   * (`ahead`, `behind`, `identical`, `diverged`). Optional: without it the
   * cascade cannot tell a held pin is older, and moves it as before.
   */
  compareCommits?(repository: string, base: string, head: string): Promise<string>;
  /**
   * The parsed `<instance>.json` of `repository` at `sha`, read from `at`
   * (the instance's `upstreamRoot` in the site's lock, e.g. `<name>/`)
   * or from the root when `at` is empty; `undefined` when there is none.
   * Optional: an API without it adds no newly declared directory
   * ({@link extendExplicitDirectories}).
   */
  declarationAt?(repository: string, sha: string, instance: string, at?: string): Promise<unknown | undefined>;
}

/** The raw shapes {@link verdictOf} reads: GitHub's combined status and check-runs responses, reduced to what matters. */
export interface RawStatus {
  state: string;
  total_count: number;
}
export interface RawCheckRun {
  status: string;
  conclusion: string | null;
}

const PASSING_CONCLUSIONS = new Set(["success", "neutral", "skipped"]);

/**
 * One commit's verdict from its combined status and its check runs.
 * `green` only when at least ONE signal exists and every one passed — a
 * commit nothing checked is `none`, never green. Any failure is `red`; any
 * signal not yet concluded is `pending`.
 */
export function verdictOf(status: RawStatus | undefined, runs: readonly RawCheckRun[]): CommitVerdict {
  const statuses = status && status.total_count > 0 ? status.state : undefined;
  if (statuses === undefined && runs.length === 0) return "none";
  const failed = (statuses !== undefined && (statuses === "failure" || statuses === "error")) || runs.some((r) => r.status === "completed" && !PASSING_CONCLUSIONS.has(r.conclusion ?? ""));
  if (failed) return "red";
  const pending = (statuses !== undefined && statuses !== "success") || runs.some((r) => r.status !== "completed");
  return pending ? "pending" : "green";
}

/** The real {@link GitHubApi}: the REST API with `GITHUB_TOKEN` / `GH_TOKEN` when set. */
export function githubApi(token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN, base = process.env.GITHUB_API_URL ?? "https://api.github.com"): GitHubApi {
  const get = async <T>(path: string): Promise<T> => {
    // Read-only REST calls; what comes back is data (shas and states), checked by `standingCovers` before any pin moves.
    const r = await fetch(`${base}${path}`, {
      headers: { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    if (!r.ok) throw new Error(`GET ${path}: HTTP ${r.status}`);
    return (await r.json()) as T;
  };
  const repo = (r: string) => r.split("/").map(encodeURIComponent).join("/");
  return {
    async branchCommits(repository, branch, limit) {
      const xs = await get<Array<{ sha: string }>>(`/repos/${repo(repository)}/commits?sha=${encodeURIComponent(branch)}&per_page=${Math.min(Math.max(limit, 1), 100)}`);
      return xs.map((x) => x.sha);
    },
    async commitVerdict(repository, sha) {
      const [status, runs] = await Promise.all([
        get<RawStatus>(`/repos/${repo(repository)}/commits/${sha}/status`),
        get<{ check_runs: RawCheckRun[] }>(`/repos/${repo(repository)}/commits/${sha}/check-runs?per_page=100`),
      ]);
      return verdictOf(status, runs.check_runs);
    },
    async compareCommits(repository, base, head) {
      return (await get<{ status: string }>(`/repos/${repo(repository)}/compare/${base}...${head}`)).status;
    },
    async lockPinsAt(repository, sha) {
      let file: { content?: string; encoding?: string };
      try {
        file = await get(`/repos/${repo(repository)}/contents/index.lock.json?ref=${sha}`);
      } catch (e) {
        if (/HTTP 404/.test((e as Error).message)) return undefined;
        throw e;
      }
      if (!file.content || file.encoding !== "base64") return undefined;
      return lockPinsOf(resolveLockJson(JSON.parse(Buffer.from(file.content, "base64").toString("utf-8")), repositoryOwner(repository)));
    },
    async declarationAt(repository, sha, instance, at) {
      const path = [...(at ?? "").split("/").filter(Boolean), `${instance}.json`].map(encodeURIComponent).join("/");
      let file: { content?: string; encoding?: string };
      try {
        file = await get(`/repos/${repo(repository)}/contents/${path}?ref=${sha}`);
      } catch (e) {
        if (/HTTP 404/.test((e as Error).message)) return undefined;
        throw e;
      }
      if (!file.content || file.encoding !== "base64") return undefined;
      return JSON.parse(Buffer.from(file.content, "base64").toString("utf-8"));
    },
  };
}

/**
 * The harness and the layers below it, as this checkout declares them —
 * the same derivation `bpmn-checklist.ts` uses to decide whose checklists the
 * harness commits.
 *
 * Only each declaration's `name` and `needs` are read, structurally
 * (`needsOfRoots`). A full read validates every directory's kind against the
 * registry, and a site's declaration names kinds that a layer it mounts
 * declares (`ig-ast`, from the FHIR layer), which this job does not mount:
 * the standing re-pin of every IG with such a directory failed on
 * "declares unknown graph typology" before it read a pin.
 */
export async function cascadeOf(root: string, harnessRoot?: string): Promise<{ harness: string; below: Set<string> }> {
  const { layerRootsIn } = await import("../schemas/kg/cat-harness.ts");
  const { needsOfRoots } = await import("./declarations-retag.ts");
  const { belowHarness } = await import("./lib/needs-reach.ts");
  harnessRoot ??= (await import("./lib/roots.ts")).HARNESS_ROOT;
  const needs = needsOfRoots(layerRootsIn(root));
  const harness = [...needsOfRoots([harnessRoot]).keys()][0] ?? "";
  return { harness, below: harness ? belowHarness(harness, needs) : new Set<string>() };
}

/**
 * `{ instance → upstreamRoot }` from an `index.lock.json`'s `instances`: where
 * each instance's declaration sits in its repository. A layer whose
 * declaration is not at the root (a layer that keeps `<name>/<name>.json`)
 * was read at the root by step 4a, found missing, and turned every re-pin that
 * moved it into could-not-determine (2026-11-13). Pure.
 */
export function upstreamRootsOf(lock: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  const instances = (lock as { instances?: unknown })?.instances;
  for (const i of Array.isArray(instances) ? instances : []) {
    const { instance, upstreamRoot } = i as { instance?: unknown; upstreamRoot?: unknown };
    if (typeof instance === "string" && typeof upstreamRoot === "string") out[instance] = upstreamRoot;
  }
  return out;
}

/** `{ repository → ref }` from an `index.lock.json`'s `mounts`: the pins that layer is built and checked against. */
export function lockPinsOf(lock: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  const mounts = (lock as { mounts?: unknown })?.mounts;
  if (!Array.isArray(mounts)) return out;
  for (const m of mounts) {
    const { repository, ref } = (m ?? {}) as { repository?: unknown; ref?: unknown };
    if (typeof repository === "string" && typeof ref === "string") out[repository] = ref;
  }
  return out;
}

/**
 * The candidate a rule would pin: the branch head, or — `require: "green"` —
 * the newest of the last `depth` commits whose verdict is green. `undefined`
 * when the rule requires green and none of them is.
 */
export async function candidateFor(api: GitHubApi, repository: string, rule: StandingConsent, depth = 30): Promise<{ candidate?: StandingCandidate; looked: Array<{ sha: string; verdict: CommitVerdict }> }> {
  const shas = await api.branchCommits(repository, rule.follows, rule.require === "green" ? depth : 1);
  const looked: Array<{ sha: string; verdict: CommitVerdict }> = [];
  if (rule.require !== "green") return { candidate: shas[0] ? { branch: rule.follows, sha: shas[0] } : undefined, looked };
  for (const sha of shas.slice(0, depth)) {
    const verdict = await api.commitVerdict(repository, sha);
    looked.push({ sha, verdict });
    if (verdict === "green") return { candidate: { branch: rule.follows, sha, verdict }, looked };
  }
  return { candidate: undefined, looked };
}

// ── The plan ─────────────────────────────────────────────────────────────────

export interface PlannedMove {
  harness: string;
  repository: string;
  from: string;
  to: string;
  rule: StandingConsent;
  /** Commits passed over on the way to `to` (newer, not green). */
  skipped: Array<{ sha: string; verdict: CommitVerdict }>;
  /** Set when the cascade chose `to`: the layer(s) whose own lock holds it. */
  alignedTo?: string;
  /** Directory ids `to` newly declares, added to the override that lists them explicitly ({@link extendExplicitDirectories}). */
  addDirectories?: string[];
}

export interface RepinPlan {
  moves: PlannedMove[];
  /** Layers with a standing rule that do not move, and why. */
  held: Array<{ harness: string; reason: string }>;
  /** Layers whose branch or verdict could not be determined. */
  unknown: Array<{ harness: string; reason: string }>;
}

/**
 * The directory ids a declaration puts IN THE CHECKOUT: neither kept off it
 * (`source`/`storage`) nor an opt-in sub-graph. These are the ids a mount's
 * explicit list can name and the presence checks look for on disk.
 */
export function inCheckoutDirectoryIds(declaration: unknown): string[] {
  const dirs = (declaration as { directories?: unknown } | undefined)?.directories;
  if (!Array.isArray(dirs)) return [];
  return dirs
    .filter((d): d is { id: string; source?: SubgraphSource; storage?: unknown; optIn?: unknown } => typeof (d as { id?: unknown })?.id === "string")
    .filter((d) => d.optIn !== true && !contentIsOffCheckout(d))
    .map((d) => d.id);
}

/** The in-checkout ids `after` declares that `before` did not, in `after`'s order. */
export function newlyDeclaredDirectoryIds(before: unknown, after: unknown): string[] {
  const had = new Set(inCheckoutDirectoryIds(before));
  return inCheckoutDirectoryIds(after).filter((id) => !had.has(id));
}

/**
 * The moves already MADE between `before` (an `index.config.json` as it was
 * before the pins moved) and `mounts` (as they are now): each remote layer
 * whose ref changed and that carries a standing rule. The train freezes its
 * pins with the tools the site had BEFORE the move, so a step those tools do
 * not have (4a, here) runs afterwards from the tools the move brought, given
 * this diff (`--extend-from`). Pure.
 */
export function movesSince(before: unknown, mounts: readonly RemoteMount[]): PlannedMove[] {
  const was = new Map<string, string>();
  const instances = (before as { instances?: unknown } | undefined)?.instances;
  for (const i of Array.isArray(instances) ? instances : []) {
    const name = (i as { name?: unknown }).name;
    const ref = (i as { source?: { remote?: { ref?: unknown } } }).source?.remote?.ref;
    if (typeof name === "string" && typeof ref === "string") was.set(name, ref);
  }
  const out: PlannedMove[] = [];
  for (const m of mounts) {
    const from = was.get(m.harness);
    const rule = m.trust?.standing;
    if (!from || !rule || from === m.ref) continue;
    out.push({ harness: m.harness, repository: m.repository, from, to: m.ref, rule, skipped: [] });
  }
  return out;
}

/**
 * Step 4a: for each move whose site override lists the layer's
 * `directories` explicitly, the ids the new pin newly declares in the
 * checkout, less those the list already names. Reads the two declarations
 * through `api.declarationAt`; a declaration it cannot read is could-not-
 * determine (the move is withdrawn, never made with a list that may be short).
 */
export async function extendExplicitDirectories(
  plan: RepinPlan,
  mounts: readonly RemoteMount[],
  api: GitHubApi,
  roots: Readonly<Record<string, string>> = {},
): Promise<RepinPlan> {
  if (!api.declarationAt) return plan;
  const moves: PlannedMove[] = [];
  const unknown = [...plan.unknown];
  for (const mv of plan.moves) {
    const listed = mounts.find((m) => m.harness === mv.harness)?.overrides?.[mv.harness]?.directories;
    if (!listed) {
      moves.push(mv);
      continue;
    }
    let before: unknown;
    let after: unknown;
    try {
      const at = roots[mv.harness];
      [before, after] = await Promise.all([api.declarationAt(mv.repository, mv.from, mv.harness, at), api.declarationAt(mv.repository, mv.to, mv.harness, at)]);
    } catch (e) {
      unknown.push({ harness: mv.harness, reason: `could not read \`${mv.harness}.json\` to compare the directories it declares: ${(e as Error).message}` });
      continue;
    }
    if (before === undefined || after === undefined) {
      const where = roots[mv.harness] ? `in \`${roots[mv.harness]}/\` of` : "at the root of";
      unknown.push({ harness: mv.harness, reason: `no \`${mv.harness}.json\` ${where} ${mv.repository}@${(before === undefined ? mv.from : mv.to).slice(0, 10)}, so whether it declares new directories cannot be told` });
      continue;
    }
    const add = newlyDeclaredDirectoryIds(before, after).filter((id) => !listed.includes(id));
    moves.push(add.length ? { ...mv, addDirectories: add } : mv);
  }
  return { ...plan, moves, unknown };
}

/** Resolve what each standing rule among `mounts` would move. Reads the network only through `api`; writes nothing. */
export async function planRepin(mounts: readonly RemoteMount[], api: GitHubApi, depth = 30): Promise<RepinPlan> {
  const plan: RepinPlan = { moves: [], held: [], unknown: [] };
  for (const m of mounts) {
    const rule = m.trust?.standing;
    if (!rule) continue;
    let found: Awaited<ReturnType<typeof candidateFor>>;
    try {
      found = await candidateFor(api, m.repository, rule, depth);
    } catch (e) {
      plan.unknown.push({ harness: m.harness, reason: `could not resolve \`${rule.follows}\` of ${m.repository}: ${(e as Error).message}` });
      continue;
    }
    if (!found.candidate) {
      plan.held.push({
        harness: m.harness,
        reason: rule.require === "green" ? `none of the last ${found.looked.length} commit(s) of \`${rule.follows}\` is green` : `\`${rule.follows}\` of ${m.repository} has no commits`,
      });
      continue;
    }
    const cover = standingCovers(m, found.candidate);
    if (!cover.covered) {
      plan.held.push({ harness: m.harness, reason: cover.reason });
      continue;
    }
    plan.moves.push({ harness: m.harness, repository: m.repository, from: m.ref, to: found.candidate.sha, rule, skipped: found.looked.filter((l) => l.sha !== found.candidate!.sha) });
  }
  return plan;
}

/**
 * The cascade (owner litlfred, 2026-11-06, bean `folio-assistant-pqlh`): a
 * layer below the harness never moves to a commit other than the one the
 * harness's OWN lock holds. The harness commits artefacts generated from those
 * pins — `bpmn-checklist.ts` writes the checklists of every layer below it
 * into the harness's site — so a site that moved bootstrap past the harness's
 * pin failed `bpmn:checklist:check` (re-pin trains folio-assistant#2975…#2986).
 * They move once the harness has re-pinned them: bottom-up, one layer at a time.
 *
 * Only the harness's lock caps, and only for the layers below it
 * (`belowHarness`): a content layer's lock holds artefacts of nothing, and
 * those locks lag and disagree, so capping by them would freeze every train.
 *
 * The harness's lock is read at the commit this plan pins it to (its move, or
 * its current pin). For each layer below it with a standing rule:
 * - the harness holds its current pin → it does not move (held);
 * - otherwise it moves to the held pin, when its standing rule covers that
 *   commit; one the rule does not cover is held, as any other;
 * - the harness's lock does not name it → left as {@link planRepin} planned.
 * A lock that cannot be read makes the run unknown, never silently unaligned.
 */
export async function alignToHeldPins(plan: RepinPlan, mounts: readonly RemoteMount[], api: GitHubApi, cap: { harness: string; below: ReadonlySet<string> }): Promise<RepinPlan> {
  const holder = mounts.find((m) => m.harness === cap.harness);
  if (!api.lockPinsAt || !holder) return plan;
  const at = plan.moves.find((m) => m.harness === holder.harness)?.to ?? holder.ref;
  let pins: Record<string, string>;
  try {
    pins = (await api.lockPinsAt(holder.repository, at)) ?? {};
  } catch (e) {
    return { ...plan, unknown: [...plan.unknown, { harness: holder.harness, reason: `could not read its lock at ${at.slice(0, 10)}, so the cascade cannot be checked: ${(e as Error).message}` }] };
  }
  const by = `${holder.harness}@${at.slice(0, 10)}`;
  const decided = new Set<string>();
  const moves: PlannedMove[] = [];
  const held: RepinPlan["held"] = [];
  for (const m of mounts) {
    const rule = m.trust?.standing;
    const ref = pins[m.repository];
    if (!rule || !ref || !cap.below.has(m.harness)) continue;
    decided.add(m.harness);
    if (ref === m.ref) {
      held.push({ harness: m.harness, reason: `${by} holds it at its current pin in its own lock; it moves when that layer re-pins it (cascade)` });
      continue;
    }
    // Never BACKWARDS. A layer's lock records what it was last tested with, so
    // it can trail the site's own pin; aligning to it then undid fixes the
    // site already had (folio-assistant train #3111 took bootstrap-tools from
    // 0f88368 back to bbdaffb, the commit before a reference-direction fix).
    if (api.compareCommits) {
      let rel: string;
      try {
        rel = await api.compareCommits(m.repository, m.ref, ref);
      } catch (e) {
        held.push({ harness: m.harness, reason: `${by} holds it at ${ref.slice(0, 10)}, and whether that is older than its current pin could not be asked: ${(e as Error).message}` });
        continue;
      }
      if (rel === "behind") {
        held.push({ harness: m.harness, reason: `${by} holds it at ${ref.slice(0, 10)}, OLDER than its current pin ${m.ref.slice(0, 10)}; a re-pin never moves a pin backwards` });
        continue;
      }
    }
    const verdict = rule.require === "green" ? await api.commitVerdict(m.repository, ref) : undefined;
    const cover = standingCovers(m, { branch: rule.follows, sha: ref, ...(verdict ? { verdict } : {}) });
    if (!cover.covered) held.push({ harness: m.harness, reason: `${by} holds it at ${ref.slice(0, 10)}, which its standing consent does not cover: ${cover.reason}` });
    else moves.push({ harness: m.harness, repository: m.repository, from: m.ref, to: ref, rule, skipped: [], alignedTo: by });
  }
  return {
    moves: [...plan.moves.filter((mv) => !decided.has(mv.harness)), ...moves],
    held: [...plan.held.filter((h) => !decided.has(h.harness)), ...held],
    // Its own branch no longer matters: the harness's lock decided it.
    unknown: plan.unknown.filter((u) => !decided.has(u.harness)),
  };
}

// ── Applying it: the existing mount:remote write paths ─────────────────────

export interface ApplyOptions {
  /** Consent date written on each new pin (default today, UTC). */
  on?: string;
  /** Re-mount after writing the config, so the lock moves too. Default true. */
  mount?: boolean;
  /** Passed to `mountRemote` — tests serve fixture repositories. */
  urlFor?: (repository: string) => string;
  install?: "production" | "all" | false;
  /** Write each move's pin and consent. Default true; `--extend-from` passes false — the pins already moved. */
  seed?: boolean;
}

export interface ApplyResult {
  configFile?: string;
  /** `mountRemote`'s overall state, when it ran. */
  mountState?: string;
  mountText?: string;
  exit: number;
}

/**
 * Write each planned move through `seedRemote` (the `--seed` path: pin and
 * consent in one write, other entries untouched), one rule's grant per
 * layer, then re-mount so `index.lock.json` follows. Imported lazily so
 * a dry run, and the pure parts' tests, load no mount machinery.
 */
export async function applyRepin(instanceRoot: string, plan: RepinPlan, opts: ApplyOptions = {}): Promise<ApplyResult> {
  if (plan.moves.length === 0) return { exit: 0 };
  const rm = await import("./remote-mount.ts");
  let configFile: string | undefined;
  for (const mv of opts.seed === false ? [] : plan.moves) {
    configFile = rm.seedRemote(instanceRoot, [{ harness: mv.harness, repository: mv.repository, ref: mv.to }], standingGrantOf(mv.rule, opts.on)).file;
  }
  const adding = plan.moves.filter((mv) => mv.addDirectories?.length);
  if (adding.length) {
    const { readDeclaredMounts, writeDeclaredMounts } = await import("../schemas/kg/index-config.js");
    const next = readDeclaredMounts(instanceRoot).mounts.map((m) => {
      const add = adding.find((mv) => mv.harness === m.harness)?.addDirectories;
      const o = m.overrides?.[m.harness];
      if (!add || !o?.directories) return m;
      return { ...m, overrides: { ...m.overrides, [m.harness]: { ...o, directories: [...o.directories, ...add.filter((id) => !o.directories!.includes(id))] } } };
    });
    configFile = writeDeclaredMounts(instanceRoot, next).file;
  }
  if (opts.mount === false) return { configFile, exit: 0 };
  const before = rm.lockBytes(instanceRoot);
  const r = rm.mountRemote({ instanceRoot, urlFor: opts.urlFor, install: opts.install ?? "production" });
  const s = rm.summarise(r.plan.outcomes);
  const mountText = rm.reportOutcomes("Remote mounts after the standing repin", s.state, s.reason, r.plan.outcomes);
  // `--no-agent-surface` when no install ran: a fixture checkout has no generators to run.
  const exit = rm.afterMount(instanceRoot, before, opts.install === false ? ["--no-agent-surface"] : [], rm.exitCode(s.state));
  return { configFile, mountState: s.state, mountText, exit };
}

/** The moved pins as Markdown — the run's output, and the PR body the workflow opens. */
export function summaryOf(plan: RepinPlan, dryRun: boolean): string {
  const L: string[] = [`## Standing repin${dryRun ? " (dry run)" : ""}`, ""];
  if (plan.moves.length === 0) L.push("No pin moved.", "");
  else {
    L.push("| instance | repository | from | to | follows | consent by |", "|---|---|---|---|---|---|");
    for (const m of plan.moves) {
      L.push(
        `| ${m.harness} | ${m.repository} | \`${m.from.slice(0, 12)}\` | \`${m.to.slice(0, 12)}\` | ${m.alignedTo ? `held by ${m.alignedTo}` : `\`${m.rule.follows}\`${m.rule.require ? ` (${m.rule.require})` : ""}`} | ${m.rule.consentBy} (standing, ${m.rule.consentAt}) |`,
      );
    }
    L.push("");
    for (const m of plan.moves.filter((x) => x.skipped.length > 0)) L.push(`- ${m.harness}: passed over ${m.skipped.map((s) => `\`${s.sha.slice(0, 10)}\` (${s.verdict})`).join(", ")}`);
    if (plan.moves.some((x) => x.skipped.length > 0)) L.push("");
    const adding = plan.moves.filter((x) => x.addDirectories?.length);
    if (adding.length) {
      L.push("Newly declared directories, added to the mount's explicit list (the standing consent follows the branch, and these came with it):");
      for (const m of adding) L.push(`- ${m.harness}: ${m.addDirectories!.map((id) => `\`${id}\``).join(", ")}`);
      L.push("");
    }
  }
  if (plan.held.length) L.push("Held:", ...plan.held.map((h) => `- ${h.harness}: ${h.reason}`), "");
  if (plan.unknown.length) L.push("**Could not determine:**", ...plan.unknown.map((h) => `- ${h.harness}: ${h.reason}`), "");
  return L.join("\n");
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const valueOf = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const dryRun = argv.includes("--dry-run");
  try {
    const { checkoutRootFor } = await import("../schemas/kg/cat-harness.js");
    const { readDeclaredMounts } = await import("../schemas/kg/index-config.js");
    const root = valueOf("--instance") ? resolve(valueOf("--instance")!) : checkoutRootFor(process.cwd());
    const depth = Number(valueOf("--depth") ?? 30);
    const api = githubApi();
    const mounts = readDeclaredMounts(root).mounts;
    const lockFile = join(root, "index.lock.json");
    const roots = existsSync(lockFile) ? upstreamRootsOf(readLockFile(lockFile)) : {};
    const extendFrom = valueOf("--extend-from");
    if (extendFrom !== undefined) {
      const done = await extendExplicitDirectories({ moves: movesSince(JSON.parse(readFileSync(extendFrom, "utf-8")), mounts), held: [], unknown: [] }, mounts, api, roots);
      const plan: RepinPlan = { ...done, moves: done.moves.filter((m) => m.addDirectories?.length) };
      const adding = plan.moves.map((m) => `- ${m.harness}: ${m.addDirectories!.map((id) => `\`${id}\``).join(", ")}`);
      const text = [
        ...(adding.length ? ["Newly declared directories, added to the mount's explicit list (the standing consent follows the branch, and these came with it):", ...adding, ""] : []),
        ...(plan.unknown.length ? ["**Could not determine:**", ...plan.unknown.map((h) => `- ${h.harness}: ${h.reason}`), ""] : []),
      ].join("\n");
      console.log(text || "No moved instance newly declares a directory its explicit list leaves out.");
      const summaryFile = valueOf("--summary-file");
      if (summaryFile && text) appendFileSync(summaryFile, `\n${text}\n`);
      let exit = plan.unknown.length > 0 ? 2 : 0;
      if (!dryRun && plan.moves.length > 0) {
        const r = await applyRepin(root, plan, { seed: false, mount: !argv.includes("--no-mount"), install: argv.includes("--no-install") ? false : "production" });
        if (r.mountText) console.log(`\n${r.mountText}`);
        exit = Math.max(exit, r.exit);
      }
      process.exit(exit);
    }
    const aligned = await alignToHeldPins(await planRepin(mounts, api, Number.isFinite(depth) && depth > 0 ? depth : 30), mounts, api, await cascadeOf(root));
    const plan = await extendExplicitDirectories(aligned, mounts, api, roots);
    const text = summaryOf(plan, dryRun);
    console.log(text);
    const summaryFile = valueOf("--summary-file");
    if (summaryFile) writeFileSync(summaryFile, text + "\n");
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `moved=${dryRun ? 0 : plan.moves.length}\n`);
    let exit = plan.unknown.length > 0 ? 2 : 0;
    if (!dryRun && plan.moves.length > 0) {
      const r = await applyRepin(root, plan, {
        on: valueOf("--consent-on"),
        mount: !argv.includes("--no-mount"),
        install: argv.includes("--no-install") ? false : "production",
      });
      if (r.mountText) console.log(`\n${r.mountText}`);
      console.log(`\nwrote ${r.configFile}${argv.includes("--no-mount") ? " — run `bun run cat mount:remote` to move the lock" : " and the lock"}`);
      exit = Math.max(exit, r.exit);
    }
    process.exit(exit);
  } catch (e) {
    console.error(`✗ ${(e as Error).message}`);
    process.exit(2);
  }
}
