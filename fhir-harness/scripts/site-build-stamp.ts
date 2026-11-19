#!/usr/bin/env bun
/**
 * Which platform an IG repository's own site was built from, and whether its
 * siblings were built from the same one.
 *
 * Every IG repository publishes its own site by hand (`site-publish.yml`, manual
 * trigger only — owner, 2026-10-06), each from its own folio-assistant pin. So
 * the sites drift: rebuild one and it wears the new harness chrome while the
 * others keep the old. That was bean `48a6` — two of three IG sites looked
 * out of date beside the third, and nothing said so; the owner noticed by
 * looking.
 *
 * Owner, 2026-10-09: *"1, but rebuild dependency for now"* — a REPORT, not a
 * gate, plus a rebuild of the IGs this one depends on. Three commands:
 *
 * - `stamp` writes `folio-build.json` at the site root: the platform commit,
 *   the source commit and when. A site that says what built it can be compared
 *   without rebuilding anything.
 * - `drift` reads the sibling sites' stamps as deployed and prints a table.
 *   It never fails: drift is a message. A sibling whose stamp cannot be read is
 *   reported as **not checked**, never as matching.
 * - `dispatch` triggers `site-publish.yml` in each dependency repository. It
 *   needs a token that may run workflows there; without one it says what it
 *   did not rebuild, rather than skipping quietly.
 *
 * Usage (from the folio-assistant checkout):
 *   bun run fhir-harness/scripts/site-build-stamp.ts stamp --site <built site> --instance <name> --platform <dir>
 *   bun run fhir-harness/scripts/site-build-stamp.ts drift --self <stamp> --sites "<url> <url>"
 *   bun run fhir-harness/scripts/site-build-stamp.ts dispatch --repos "<owner/repo@ref> ..."
 *
 * @module fhir-harness/scripts/site-build-stamp
 */
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

export const STAMP_FILE = "folio-build.json";
/** The workflow an IG repository publishes its site with (`templates/ig-repo-site/site-publish.yml`). */
export const WORKFLOW = "site-publish.yml";

export interface SiteBuild {
  $schema: "folio-site-build/v1";
  instance: string;
  /** The folio-assistant commit the site was built with. */
  platform: { commit: string };
  /** The IG repository and commit it was built from. */
  source: { repo?: string; ref?: string; commit?: string };
  /**
   * The commit the IG's AST was built from, and the verdict it was published
   * under. An IG site's artefact pages come from the AST, not from `source`,
   * so when the verdict is not `valid` (a preview built with
   * a preview built on a stale AST, the default for a preview) the two differ and the stamp says so.
   */
  ast?: {
    commit?: string;
    verdict: string;
    /**
     * Which kind of Publisher build made the AST: `full`, or `incremental`
     * (a partial rebuild merged over an earlier AST). Phase P4: a release is
     * cut from a full build only, and the site says which it came from.
     */
    kind?: "full" | "incremental";
  };
  builtAt: string;
}

export type Sibling =
  | { site: string; state: "same"; build: SiteBuild }
  | { site: string; state: "different"; build: SiteBuild }
  | { site: string; state: "not-checked"; why: string };

export function siteBuild(instance: string, platformCommit: string, env: Record<string, string | undefined>, now = new Date()): SiteBuild {
  return {
    $schema: "folio-site-build/v1",
    instance,
    platform: { commit: platformCommit },
    source: { repo: env.GITHUB_REPOSITORY, ref: env.GITHUB_REF_NAME, commit: env.GITHUB_SHA },
    builtAt: now.toISOString(),
  };
}

/** Parse a fetched stamp; anything that is not one is a reason, not a build. */
export function parseBuild(text: string): SiteBuild | string {
  let j: unknown;
  try {
    j = JSON.parse(text);
  } catch {
    return `${STAMP_FILE} is not JSON`;
  }
  const b = j as Partial<SiteBuild>;
  if (b?.$schema !== "folio-site-build/v1" || typeof b.platform?.commit !== "string" || !b.platform.commit) {
    return `${STAMP_FILE} is not a folio-site-build/v1 stamp`;
  }
  return b as SiteBuild;
}

export function compare(self: SiteBuild, site: string, fetched: SiteBuild | string): Sibling {
  if (typeof fetched === "string") return { site, state: "not-checked", why: fetched };
  return { site, state: fetched.platform.commit === self.platform.commit ? "same" : "different", build: fetched };
}

const short = (c: string) => c.slice(0, 9);

export function driftReport(self: SiteBuild, siblings: Sibling[]): string {
  const lines = ["### Platform drift between IG sites", ""];
  lines.push(`This site (\`${self.instance}\`) was built with folio-assistant \`${short(self.platform.commit)}\`.`, "");
  if (!siblings.length) {
    lines.push("No sibling sites are configured (`FOLIO_SITE_SIBLINGS`), so nothing was compared.");
    return lines.join("\n") + "\n";
  }
  lines.push("| site | platform | built | state |", "|---|---|---|---|");
  for (const s of siblings) {
    if (s.state === "not-checked") lines.push(`| ${s.site} | — | — | **not checked**: ${s.why} |`);
    else lines.push(`| ${s.site} | \`${short(s.build.platform.commit)}\` | ${s.build.builtAt} | ${s.state === "same" ? "same" : "**different**"} |`);
  }
  const diff = siblings.filter((s) => s.state === "different").length;
  const blind = siblings.filter((s) => s.state === "not-checked").length;
  lines.push("");
  if (diff) lines.push(`${diff} site(s) were built with a different platform, so they will not look the same. Rebuild them, or this one, to match. This is a message, not a failure (bean 48a6).`);
  if (blind) lines.push(`${blind} site(s) could not be checked, which is not the same as matching.`);
  if (!diff && !blind) lines.push("Every sibling was built with the same platform.");
  return lines.join("\n") + "\n";
}

/** `owner/repo@ref` → the dispatch it names; `@ref` defaults to `main`. */
export function parseRepo(spec: string): { repo: string; ref: string } | undefined {
  const m = /^([\w.-]+\/[\w.-]+)(?:@(.+))?$/.exec(spec.trim());
  return m ? { repo: m[1]!, ref: m[2] ?? "main" } : undefined;
}

const words = (s: string | undefined) => (s ?? "").split(/[\s,]+/).filter(Boolean);

async function fetchBuild(site: string): Promise<SiteBuild | string> {
  const url = `${site.replace(/\/+$/, "")}/${STAMP_FILE}`;
  try {
    const r = await fetch(url, { headers: { "cache-control": "no-cache" } });
    if (r.status === 404) return `no ${STAMP_FILE} — built before stamps, or not with folio-site`;
    if (!r.ok) return `${url} answered ${r.status}`;
    return parseBuild(await r.text());
  } catch (e) {
    return `${url} could not be fetched (${(e as Error).message})`;
  }
}

function summary(text: string): void {
  process.stdout.write(text);
  const f = process.env.GITHUB_STEP_SUMMARY;
  if (f) writeFileSync(f, text, { flag: "a" });
}

async function main(): Promise<number> {
  const [cmd] = process.argv.slice(2);
  const arg = (k: string) => {
    const i = process.argv.indexOf(`--${k}`);
    return i >= 0 ? process.argv[i + 1] : undefined;
  };

  if (cmd === "stamp") {
    const site = arg("site"), instance = arg("instance"), platform = arg("platform") ?? ".";
    if (!site || !instance) return usage();
    const rev = spawnSync("git", ["-C", platform, "rev-parse", "HEAD"], { encoding: "utf8" });
    if (rev.status !== 0) {
      console.error(`cannot read the platform commit in ${platform}: ${rev.stderr.trim()}`);
      return 1;
    }
    const b = siteBuild(instance, rev.stdout.trim(), process.env);
    writeFileSync(join(site, STAMP_FILE), JSON.stringify(b, null, 2) + "\n");
    console.log(`stamped ${join(site, STAMP_FILE)}: folio-assistant ${short(b.platform.commit)}`);
    return 0;
  }

  if (cmd === "drift") {
    const selfFile = arg("self");
    if (!selfFile) return usage();
    const self = parseBuild(readFileSync(selfFile, "utf8"));
    if (typeof self === "string") {
      console.error(self);
      return 1;
    }
    const sites = words(arg("sites"));
    const siblings = await Promise.all(sites.map(async (s) => compare(self, s, await fetchBuild(s))));
    summary(driftReport(self, siblings));
    return 0;
  }

  if (cmd === "dispatch") {
    const specs = words(arg("repos"));
    const lines = ["### Dependencies rebuilt", ""];
    if (!specs.length) {
      summary(lines.concat("No dependency repositories are configured (`FOLIO_SITE_DEPENDENCIES`).", "").join("\n"));
      return 0;
    }
    const token = process.env.FOLIO_SITE_DISPATCH_TOKEN;
    let failed = 0;
    for (const spec of specs) {
      const d = parseRepo(spec);
      if (!d) {
        lines.push(`- \`${spec}\`: **not rebuilt** — not \`owner/repo[@ref]\``);
        failed++;
        continue;
      }
      if (!token) {
        lines.push(`- ${d.repo}@${d.ref}: **not rebuilt** — no \`FOLIO_SITE_DISPATCH_TOKEN\` secret (a token that may run workflows there)`);
        failed++;
        continue;
      }
      const r = await fetch(`https://api.github.com/repos/${d.repo}/actions/workflows/${WORKFLOW}/dispatches`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28" },
        body: JSON.stringify({ ref: d.ref }),
      }).catch((e: Error) => ({ ok: false, status: 0, text: async () => e.message }));
      if (r.ok) lines.push(`- ${d.repo}@${d.ref}: ${WORKFLOW} dispatched`);
      else {
        lines.push(`- ${d.repo}@${d.ref}: **not rebuilt** — ${r.status} ${(await r.text()).slice(0, 200)}`);
        failed++;
      }
    }
    summary(lines.join("\n") + "\n");
    for (let i = 0; i < failed; i++) console.log(`::warning::a dependency site was not rebuilt; see the job summary (bean 48a6)`);
    return 0;
  }

  return usage();
}

function usage(): number {
  console.error("usage: site-build-stamp.ts stamp --site <dir> --instance <name> [--platform <dir>]\n" +
    "       site-build-stamp.ts drift --self <stamp> --sites \"<url> ...\"\n" +
    "       site-build-stamp.ts dispatch --repos \"<owner/repo@ref> ...\"");
  return 2;
}

if (import.meta.main) process.exit(await main());
