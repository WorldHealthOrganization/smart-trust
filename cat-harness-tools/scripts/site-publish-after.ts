/**
 * Which of a repository's workflows a site publish waits for, on the same
 * commit, before it builds.
 *
 * @module scripts/site-publish-after
 * @covers none — it names the workflows to wait for; the wait is folio-site-publish.yml's
 *
 * ## Why derived
 *
 * A site may be built from something another workflow of the same push
 * seeds: an IG's site from the AST cache its IG AST refresh writes. Started
 * together, the publish read the cache before it existed and failed
 * (smart-pcmt, 2026-11-19: "cache branch ... not found on origin", while the
 * refresh on the same commit seeded it minutes later). The wait was opt-in,
 * `site.publishAfter` in `index.config.json`, and a repository that did not
 * declare it raced on every push and failed its first publish.
 *
 * So the wait is derived as well as declared. A site publisher a mounted
 * layer declares names the reusable workflows that seed what it builds from
 * (`after`, `site-publisher.ts`), and every workflow of the repository that
 * calls one of them is waited for. Every declared publisher counts, not only
 * the one that builds the site: a folio whose build steps restore an IG's AST
 * races the IG's refresh just the same. `site.publishAfter` still adds to it.
 *
 * A workflow that calls the shared site publish is never waited for: it is
 * the publish itself.
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { declaredSitePublishers, parseUses, readWorkflows, type PublisherWorkflows } from "./site-publisher.ts";

/** The shared site publish; a caller of it is the publish itself. */
export const SITE_PUBLISH_WORKFLOW = "folio-site-publish.yml";

/** A workflow file name under `.github/workflows/`, as `site.publishAfter` takes one. */
const WORKFLOW_FILE = /^[\w.-]+\.ya?ml$/;

export interface Wait {
  /** The repository's workflow file, under `.github/workflows/`. */
  workflow: string;
  /** Why it is waited for. */
  why: string;
}

/**
 * The workflows to wait for, in file-name order. Pure over the repository's
 * workflows (`{file name → text}`), what `index.config.json` declares, and
 * the publishers on offer.
 */
export function publishAfter(o: { workflows: Map<string, string>; declared?: readonly unknown[]; publishers: readonly PublisherWorkflows[] }): Wait[] {
  const out = new Map<string, string>();
  for (const d of o.declared ?? []) {
    if (typeof d === "string" && WORKFLOW_FILE.test(d) && !out.has(d)) out.set(d, "index.config.json site.publishAfter");
  }
  const seeders = new Map<string, string>();
  for (const p of o.publishers) for (const w of p.after ?? []) seeders.set(w, p.kind);
  for (const [caller, text] of [...o.workflows.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const calls = [...text.matchAll(/^\s*(?:-\s*)?uses:\s*(\S+)\s*(?:#.*)?$/gm)].map((m) => parseUses(m[1]!)).filter((u) => u !== undefined);
    if (calls.some((u) => u.file === SITE_PUBLISH_WORKFLOW)) {
      out.delete(caller);
      continue;
    }
    if (out.has(caller)) continue;
    const seeder = calls.find((u) => seeders.has(u.file));
    if (seeder) out.set(caller, `it calls ${seeder.file}, which seeds what the ${seeders.get(seeder.file)} publisher builds from`);
  }
  return [...out.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([workflow, why]) => ({ workflow, why }));
}

/** `site.publishAfter` from the repository's `index.config.json`, or none. */
export function declaredPublishAfter(repo: string): unknown[] {
  const f = join(repo, "index.config.json");
  if (!existsSync(f)) return [];
  try {
    const a = (JSON.parse(readFileSync(f, "utf-8")) as { site?: { publishAfter?: unknown } }).site?.publishAfter;
    return Array.isArray(a) ? a : [];
  } catch {
    return [];
  }
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const at = args.indexOf("--repo");
  const repo = resolve(at >= 0 ? (args[at + 1] ?? ".") : ".");
  let publishers: readonly PublisherWorkflows[] = [];
  try {
    publishers = declaredSitePublishers(repo);
  } catch (e) {
    console.error(`· no declared site publisher could be read (${(e as Error).message}): only site.publishAfter is waited for`);
  }
  const waits = publishAfter({ workflows: readWorkflows(repo), declared: declaredPublishAfter(repo), publishers });
  for (const w of waits) console.error(`waits for ${w.workflow}: ${w.why}`);
  if (waits.length === 0) console.error("waits for nothing: no workflow here seeds what the site is built from");
  console.log(waits.map((w) => w.workflow).join(" "));
}
