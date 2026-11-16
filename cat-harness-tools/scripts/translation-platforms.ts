#!/usr/bin/env bun
/**
 * Translation platforms (Weblate, Crowdin, Transifex): write the layout each
 * one reads, and turn what one sends back into CANDIDATES.
 *
 * @module scripts/translation-platforms
 * @covers translation-sources
 *
 *   # Push — print (default), --write, or --check the file a platform reads:
 *   bun run cat-harness-tools/scripts/translation-platforms.ts export --platform crowdin \
 *     [--root <layer root>] [--repo-root <repository root>] [--write | --check] \
 *     [--organization <tx org>] [--project <tx project>] [--repository <git url>] [--branch <b>]
 *
 *   # Pull — rewrite a platform's .po changes on the checked-out branch into candidates:
 *   bun run cat-harness-tools/scripts/translation-platforms.ts import --platform weblate \
 *     --base <git ref> [--root <layer root>] [--repo-root <repository root>] \
 *     [--hints <json>] [--export-mode all|approved] [--summary <file>] [--dry-run]
 *
 * Nothing here talks to a platform or the network: `export` reads the layer's
 * declared `translation-sources` directory and writes a config file; `import`
 * reads the working tree and `git show <base>:<path>`. A platform is never an
 * adjudicator (`lib/translation-sources/platforms.ts`).
 *
 * Exit 0 done (import: something rewritten) · 1 `--check` found drift ·
 * 3 import found nothing to rewrite · 2 could not determine.
 */
import { execFileSync } from "node:child_process";

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";

import {
  catalogueLayout,
  declaredTranslationsDir,
  candidatesPath,
  annotatePlatformStates,
  flagStateHints,
  platformDiff,
  isPlatform,
  platformFiles,
  poPathParts,
  readCandidates,
  rewriteSubject,
  weblateStateHints,
  PLATFORMS,
  type Platform,
  type StateHints,
} from "./lib/translation-sources/platforms.ts";
import { addCandidates } from "./lib/translation-candidates.ts";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const flag = (name: string) => process.argv.includes(name);

function gitRoot(dir: string): string {
  try {
    return execFileSync("git", ["-C", dir, "rev-parse", "--show-toplevel"], { encoding: "utf-8" }).trim();
  } catch {
    return dir;
  }
}

/**
 * The layer's `translation-sources` directory, resolved the way the status
 * page resolves it when the harness is mounted, else from the declaration
 * file alone (a bare checkout, as in a platform-import job's dry run).
 */
async function findTranslationsDir(root: string): Promise<string | undefined> {
  try {
    const m = await import("./gen-translation-status.ts");
    return m.translationsDirOf(root);
  } catch {
    return declaredTranslationsDir(root);
  }
}

async function resolveDirs(): Promise<{ repoRoot: string; translationsDir: string } | undefined> {
  const root = resolve(arg("--root") ?? ".");
  const translationsDir = await findTranslationsDir(root);
  if (!translationsDir || !existsSync(translationsDir)) {
    console.error(`translation-platforms: ${root} declares no \`translation-sources\` directory, or it is absent. This is NOT a pass.`);
    return undefined;
  }
  return { repoRoot: resolve(arg("--repo-root") ?? gitRoot(root)), translationsDir };
}

function platformArg(): Platform | undefined {
  const p = arg("--platform");
  if (isPlatform(p)) return p;
  console.error(`translation-platforms: --platform must be one of ${PLATFORMS.join(", ")}.`);
  return undefined;
}

async function runExport(): Promise<number> {
  const platform = platformArg();
  const dirs = await resolveDirs();
  if (!platform || !dirs) return 2;
  const layout = catalogueLayout(dirs.repoRoot, dirs.translationsDir);
  if (layout.catalogues.length === 0) {
    console.error(`translation-platforms: no .pot templates under ${layout.dir}. This is NOT a pass.`);
    return 2;
  }
  for (const d of layout.divergent) console.error(`  warning   ${layout.dir}/*/${d}.pot: the locale copies of this template differ; the platform reads the first locale's`);
  const opts = {
    ...(arg("--organization") ? { organization: arg("--organization")! } : {}),
    ...(arg("--project") ? { project: arg("--project")! } : {}),
    ...(arg("--repository") ? { repository: arg("--repository")! } : {}),
    ...(arg("--branch") ? { branch: arg("--branch")! } : {}),
  };
  const files = platformFiles(platform, layout, opts);
  if (flag("--check")) {
    let stale = 0;
    for (const f of files) {
      const target = join(dirs.repoRoot, f.path);
      if (!existsSync(target)) {
        console.log(`translation-platforms: no ${f.path} — ${platform} is not configured, nothing to check.`);
        continue;
      }
      if (readFileSync(target, "utf-8") === f.text) continue;
      console.error(`translation-platforms: ${f.path} is stale; run \`translation-platforms.ts export --platform ${platform} --write\`.`);
      stale += 1;
    }
    return stale > 0 ? 1 : 0;
  }
  for (const f of files) {
    if (flag("--write")) {
      const target = join(dirs.repoRoot, f.path);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, f.text);
      console.log(`translation-platforms: wrote ${f.path} (${layout.catalogues.length} catalogues, ${layout.locales.length} locales).`);
    } else {
      if (files.length > 1) process.stdout.write(`# ── ${f.path} ──\n`);
      process.stdout.write(f.text);
    }
  }
  return 0;
}

function loadHints(platform: Platform): StateHints | undefined {
  const p = arg("--hints");
  if (!p) return undefined;
  const data: unknown = JSON.parse(readFileSync(p, "utf-8"));
  return platform === "weblate" ? weblateStateHints(data) : flagStateHints(data);
}

async function runImport(): Promise<number> {
  const platform = platformArg();
  const dirs = await resolveDirs();
  const base = arg("--base");
  if (!platform || !dirs) return 2;
  if (!base || !/^[\w./-]+$/.test(base)) {
    console.error("translation-platforms: import needs --base <git ref> (the branch the platform's PR targets).");
    return 2;
  }
  const exportMode = arg("--export-mode") === "approved" ? "approved" : "all";
  const hints = loadHints(platform);
  const dir = relative(dirs.repoRoot, dirs.translationsDir).split(sep).join("/") || ".";
  const changed = execFileSync("git", ["-C", dirs.repoRoot, "diff", "--name-only", "--diff-filter=AM", `${base}...HEAD`, "--", dir], { encoding: "utf-8" })
    .split("\n")
    .filter(Boolean);
  const at = new Date().toISOString();
  const lines: string[] = [];
  let rewrote = 0;
  for (const path of changed) {
    const parts = poPathParts(dir, path);
    if (!parts) continue;
    // Our own rewrite is the newest change: nothing new from the platform since.
    const last = execFileSync("git", ["-C", dirs.repoRoot, "log", "-1", "--format=%s", "--", path], { encoding: "utf-8" }).trim();
    if (last === rewriteSubject(platform)) continue;
    let baseText: string | undefined;
    try {
      baseText = execFileSync("git", ["-C", dirs.repoRoot, "show", `${base}:${path}`], { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] });
    } catch {
      baseText = undefined; // the platform created this catalogue
    }
    const incoming = readFileSync(join(dirs.repoRoot, path), "utf-8");
    const d = platformDiff({ platform, base: baseText, incoming, ...(hints ? { hints } : {}), exportMode, at });
    if (d.inputs.length === 0 && d.base === incoming) continue;
    const dry = flag("--dry-run");
    const cpath = candidatesPath(dirs.translationsDir, parts.locale, parts.catalogue);
    const sidecarBefore = existsSync(cpath) ? readFileSync(cpath, "utf-8") : undefined;
    // The platform's text never stays in a msgstr: put the base back first.
    if (!dry) writeFileSync(join(dirs.repoRoot, path), d.base);
    const r = addCandidates(d.inputs, { root: dirs.repoRoot, translations: dir, locale: parts.locale, catalogue: parts.catalogue, dryRun: dry, now: () => new Date(at) });
    if (!dry && !r.refused && existsSync(cpath)) {
      const annotated = annotatePlatformStates(readCandidates(cpath)!, platform, d.states);
      writeFileSync(cpath, `${JSON.stringify(annotated, null, 2)}\n`);
    }
    // A re-run over strings already imported changes nothing; say so rather than claim a rewrite.
    const unchanged = dry
      ? r.added === 0 && d.base === incoming
      : readFileSync(join(dirs.repoRoot, path), "utf-8") === incoming && (existsSync(cpath) ? readFileSync(cpath, "utf-8") : undefined) === sidecarBefore;
    if (unchanged) continue;
    rewrote += 1;
    const skipped = [...d.skipped, ...r.rejected.map((x) => `${JSON.stringify(x.msgid.slice(0, 60))}: ${x.reason}`)];
    lines.push(`- \`${path}\`: ${r.refused ? `restored to the base; candidates NOT recorded (${r.refused})` : `${r.added} candidate(s) from ${platform}${r.filled.length ? `, ${r.filled.length} empty string(s) filled fuzzy` : ""}${r.noFill ? ` (${r.noFill})` : ""}`}${skipped.length ? `, ${skipped.length} skipped` : ""}`);
    for (const s of skipped) lines.push(`  - skipped ${s}`);
  }
  const summary = rewrote === 0
    ? `Nothing from ${platform} to rewrite: no translated string in this branch differs from \`${base}\`.`
    : [
        `Translations from **${platform}** rewritten as candidates (\`translation-candidates/v1\`).`,
        "",
        `${platform} is a source, never an adjudicator: its strings — approved there or not — are candidates in each catalogue's \`.candidates.json\`, with ${platform}'s own state as metadata. The \`.po\` keeps the base branch's text; an empty string takes the first candidate, marked fuzzy. A person adjudicates on the translation review page.`,
        "",
        ...lines,
      ].join("\n");
  const sp = arg("--summary");
  if (sp) writeFileSync(sp, `${summary}\n`);
  console.log(summary);
  return rewrote === 0 ? 3 : 0;
}

async function main(): Promise<number> {
  const cmd = process.argv[2];
  if (cmd === "export") return runExport();
  if (cmd === "import") return runImport();
  console.error("usage: translation-platforms.ts export|import --platform weblate|crowdin|transifex …");
  return 2;
}

if (import.meta.main) process.exit(await main());
