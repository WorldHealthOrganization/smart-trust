/**
 * Which publisher a repository uses, and where its code comes from: the
 * SITE-PUBLISHER slot that `stage-local.ts` reaches a higher layer's publish
 * path through.
 *
 * @module scripts/site-publisher
 * @covers none — the slot and the workflow reading that chooses a publisher; it builds and judges nothing
 *
 * ## Why a slot
 *
 * The FHIR-IG publish path lives in the layer that owns IG builds, and this
 * layer names no higher one, so `stage-local.ts` reaches it through the
 * pipeline-plugin mechanism: a layer declares a `folio-pipeline-plugin/v1`
 * node whose `slot` starts with {@link SITE_PUBLISHER_SLOT_PREFIX}, naming a
 * table that holds a {@link SitePublisherDeclaration}, and
 * `loadContributionsSync` finds it through the repository's declared
 * dependencies. One contributor per slot, as for every pipeline slot: which
 * code publishes an IG must not depend on the order the dependencies are
 * listed in.
 *
 * The FOLIO publisher is this layer's own (`folio-staging.yml` is the
 * platform's reusable workflow), so it is built in, not a slot.
 *
 * ## Read from the workflow, never restated
 *
 * A repository names the reusable workflow it publishes with in its own
 * `.github/workflows/*.yml` (`uses: <owner>/<repo>/.github/workflows/<file>@<ref>`).
 * Each publisher declares the workflow FILE NAMES it publishes for, and the
 * repository's callers decide which one applies ({@link detectPublisher}).
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { parse as parseYaml } from "yaml";

import { ContributionRegistry, type FolioContribution } from "../schemas/content/contributions.ts";
import { loadContributionsSync } from "../schemas/kg/harness-config.ts";

/** The reusable workflow a folio calls. */
export const FOLIO_WORKFLOW = "folio-staging.yml";

/** The kind the built-in folio publisher answers to. */
export const FOLIO_PUBLISHER_KIND = "folio";

/** Every pipeline slot whose name starts with this is a site publisher; the rest of the name is its kind. */
export const SITE_PUBLISHER_SLOT_PREFIX = "site-publisher-";

/** What a publisher declares about the workflows it publishes for. */
export interface PublisherWorkflows {
  /** What `--publisher` calls it, e.g. `folio`. */
  kind: string;
  /** The reusable workflow file names a caller of which this publisher builds. */
  workflows: readonly string[];
  /** When a repository calls several of them, the one that is the Pages build. */
  preferred?: string;
}

/** The built-in folio publisher's workflows. */
export const FOLIO_PUBLISHER: PublisherWorkflows = { kind: FOLIO_PUBLISHER_KIND, workflows: [FOLIO_WORKFLOW] };

/**
 * What a site-publisher slot holds: its workflows, and the function that
 * stages a repository it detected. `stage` is typed by `stage-local.ts`
 * (`SitePublisher` in `stage-local.ts`), which hands it the run
 * and the host's services; this module only checks that it is a function.
 */
export interface SitePublisherDeclaration extends PublisherWorkflows {
  stage: (...args: never[]) => Promise<unknown>;
}

export interface UsesRef {
  owner: string;
  repo: string;
  /** Path inside that repository, e.g. `.github/workflows/<file>.yml`. */
  path: string;
  ref: string;
  file: string;
}

/** `<owner>/<repo>/<path>@<ref>` for a reusable workflow, or undefined. */
export function parseUses(s: string): UsesRef | undefined {
  const m = /^([^/\s]+)\/([^/\s]+)\/(\.github\/workflows\/[^@\s]+)@(\S+)$/.exec(s.trim().replace(/^['"]|['"]$/g, ""));
  if (!m) return undefined;
  return { owner: m[1]!, repo: m[2]!, path: m[3]!, ref: m[4]!, file: m[3]!.split("/").pop()! };
}

/** A publisher's kind: `folio`, or the kind a declared site-publisher slot names. */
export type Publisher = string;

export interface Detected {
  kind: Publisher;
  caller: string;
  uses: UsesRef;
  /** The other kind, when the repository also calls it (a folio may carry an IG under `input/`). */
  alsoCalls?: { kind: Publisher; caller: string; file: string };
}

/**
 * Which publisher a repository uses, from the reusable workflows its own
 * workflow files call. Pure over `{file name → text}` and the publishers on
 * offer. Throws when it names none.
 *
 * A repository may call several: a folio can carry a FHIR IG under `input/`.
 * Then the FOLIO is chosen unless `prefer` says otherwise, because the folio
 * owns the publish root (`publish-main` keeps `branches/` and `_render-log/`
 * there), while another publisher's root deploy may be a clean one that would
 * delete both.
 */
/**
 * The repository being published, for a publisher it HOSTS rather than calls:
 * its `owner/repo` and the commit being built.
 */
export interface SelfRef {
  owner: string;
  repo: string;
  ref: string;
}

/** Does this workflow text declare a `workflow_call` trigger (is it a reusable workflow)? */
export function isReusableWorkflow(text: string): boolean {
  return /^\s*workflow_call\s*:/m.test(text);
}

export function detectPublisher(
  workflows: Map<string, string>,
  publishers: readonly PublisherWorkflows[],
  prefer?: Publisher,
  self?: SelfRef,
): Detected {
  const kindOf = new Map<string, PublisherWorkflows>();
  for (const p of publishers) for (const w of p.workflows) kindOf.set(w, p);
  const found: Detected[] = [];
  const seen: string[] = [];
  for (const [caller, text] of [...workflows.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    // A trailing YAML comment is allowed: a pinned SHA is commonly annotated
    // with the branch it came from (`@<sha> # main`), and the reference is
    // still the one token before it.
    for (const m of text.matchAll(/^\s*uses:\s*(\S+)\s*(?:#.*)?$/gm)) {
      const u = parseUses(m[1]!);
      if (!u) continue;
      seen.push(`${caller} → ${u.file}`);
      const p = kindOf.get(u.file);
      if (p) found.push({ kind: p.kind, caller, uses: u });
    }
    // The repository that DEFINES a publisher's reusable workflow builds with
    // it too, though no workflow of its own calls it: the layer that keeps the
    // IG build (fhirbuild.yml, ghbuild.yml) every IG calls found no caller for
    // its own site-publish, which failed on every push from 2026-11-11.
    // Its `uses` is its own file at the commit being built.
    const hosted = self ? kindOf.get(caller) : undefined;
    if (hosted && self && isReusableWorkflow(text)) {
      seen.push(`${caller} (defined here)`);
      found.push({ kind: hosted.kind, caller, uses: { owner: self.owner, repo: self.repo, path: `.github/workflows/${caller}`, ref: self.ref, file: caller } });
    }
  }
  const offered = publishers.map((p) => `${p.kind} (${p.workflows.join("/")})`).join(", ");
  if (found.length === 0) {
    throw new Error(
      `no workflow here calls a reusable workflow a publisher on offer builds: ${offered}${seen.length ? ` (found: ${seen.join(", ")})` : ""} — nothing to mirror. ` +
        `A publisher other than the folio's is a mounted layer's declared ${SITE_PUBLISHER_SLOT_PREFIX}<kind> pipeline slot`,
    );
  }
  const want: Publisher = prefer ?? (found.some((f) => f.kind === FOLIO_PUBLISHER_KIND) ? FOLIO_PUBLISHER_KIND : found[0]!.kind);
  const mine = found.filter((f) => f.kind === want);
  if (mine.length === 0) {
    const p = publishers.find((x) => x.kind === want);
    throw new Error(`--publisher ${want}: no workflow here calls ${p ? p.workflows.join("/") : `a workflow of a publisher called ${want} (on offer: ${offered})`}`);
  }
  // A repository that calls several of one publisher's workflows: its preferred one is the build.
  const preferred = publishers.find((p) => p.kind === want)?.preferred;
  const chosen = mine.find((f) => f.uses.file === preferred) ?? mine[0]!;
  const other = found.find((f) => f.kind !== want);
  return other ? { ...chosen, alsoCalls: { kind: other.kind, caller: other.caller, file: other.uses.file } } : chosen;
}

/** The `with:` a caller passes to the reusable workflow it calls, as strings. */
export function callerInputs(text: string, u: UsesRef): Record<string, unknown> {
  const y = parseYaml(text) as { jobs?: Record<string, { uses?: string; with?: Record<string, unknown> }> };
  for (const j of Object.values(y?.jobs ?? {})) {
    const c = j.uses ? parseUses(j.uses) : undefined;
    if (c && c.path === u.path && c.owner === u.owner && c.repo === u.repo) return { ...(j.with ?? {}) };
  }
  return {};
}

/** Every `.github/workflows/*.yml|yaml` of a repository, by file name. */
export function readWorkflows(repo: string): Map<string, string> {
  const dir = join(repo, ".github", "workflows");
  const out = new Map<string, string>();
  if (!existsSync(dir)) return out;
  for (const f of readdirSync(dir)) if (/\.ya?ml$/.test(f)) out.set(f, readFileSync(join(dir, f), "utf-8"));
  return out;
}

/** Is this a site-publisher declaration, as far as this layer can check one? */
export function isSitePublisher(x: unknown): x is SitePublisherDeclaration {
  if (typeof x !== "object" || x === null) return false;
  const p = x as Partial<SitePublisherDeclaration>;
  return typeof p.kind === "string" && p.kind !== "" && Array.isArray(p.workflows) && p.workflows.every((w) => typeof w === "string") && typeof p.stage === "function";
}

/**
 * The site publishers `repo`'s declared dependencies contribute, through
 * pipeline slots named `site-publisher-<kind>`. Empty when none does. A slot
 * whose table entry is not a publisher, or whose kind disagrees with its slot
 * name, is an error naming both: a publisher that silently did nothing would
 * publish nothing and say it had.
 *
 * `registry` is for a caller that has already loaded one; by default the
 * contributions are loaded from `repo`, the checkout being published, since
 * it is that checkout's mounts that decide what can publish it.
 */
export function declaredSitePublishers(repo: string, registry?: ContributionRegistry): SitePublisherDeclaration[] {
  const reg = registry ?? loadContributionsSync<FolioContribution, ContributionRegistry>(resolve(repo), new ContributionRegistry());
  const out: SitePublisherDeclaration[] = [];
  for (const { kind: slot, contributor } of reg.contributedPipelinePlugins()) {
    if (!slot.startsWith(SITE_PUBLISHER_SLOT_PREFIX)) continue;
    const impl = reg.pipelinePlugin(slot);
    if (!isSitePublisher(impl)) throw new Error(`${contributor} fills the pipeline slot ${slot} with something that is not a site publisher (kind, workflows, stage)`);
    const kind = slot.slice(SITE_PUBLISHER_SLOT_PREFIX.length);
    if (impl.kind !== kind) throw new Error(`${contributor}'s ${slot} says its kind is '${impl.kind}', not '${kind}'`);
    if (kind === FOLIO_PUBLISHER_KIND) throw new Error(`${contributor}'s ${slot}: '${FOLIO_PUBLISHER_KIND}' is the built-in publisher's kind`);
    out.push(impl);
  }
  return out.sort((a, b) => a.kind.localeCompare(b.kind));
}
