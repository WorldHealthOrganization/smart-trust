/**
 * Cut an IG release as a GitHub DRAFT release that carries its files (owner,
 * 2026-11-09, Q-REL-1 "A"; skill `ig-binary-artefacts`, "Releasing").
 *
 *   bun run fhir-harness/scripts/ig-release.ts assets --output <publisher output/> --ast <AST dir> --out <dir>
 *   bun run fhir-harness/scripts/ig-release.ts kind   --ig <IG root>
 *   bun run fhir-harness/scripts/ig-release.ts draft  --repo <owner/repo> --tag <tag> --dir <dir> [--prerelease] [--dry-run]
 *   bun run fhir-harness/scripts/ig-release.ts check  --ig <IG root> [--repo <owner/repo>]
 *
 * `assets` gathers what every release carries: the Publisher's `package.tgz`
 * (and its R4 and R4B variants when the build wrote them) and `ast-data.zip`,
 * the IG's AST, whose Library resources keep their ELM. It writes
 * `SHA256SUMS` beside them.
 *
 * `kind` says `prerelease` or `release` from the IG's `sushi-config.yaml`: a
 * ballot, draft or CI-build version is a GitHub pre-release.
 *
 * `draft` makes the release a DRAFT and uploads the files. Nobody sees a draft
 * but the repository's writers, and nothing this pipeline reads lists one
 * (`ig-releases.ts`). The owner publishes it on GitHub: that click is
 * `Task_AuthorizeRelease` in `draft-to-publication.bpmn`. A tag that already
 * has a PUBLISHED release is refused; a tag that has a draft gets its files
 * replaced.
 *
 * `check` is the CATCH-UP (owner, 2026-11-10: "need to add this to process
 * (and how to catchup if not tagged)"). Tagging is a governance decision: the
 * owner tags the IG's current version, `v<version>` from `sushi-config.yaml`,
 * and that tag starts the release. `check` reports, never acts: when the
 * version has no tag it names the commit that set the version (`git log -G`
 * over `sushi-config.yaml`, HEAD when the history cannot say) for the owner to
 * tag; when the tag has no release, draft or published, it says to run the IG
 * release workflow by hand for that tag. It always exits 0 unless misused.
 * Nothing here ever pushes a tag or picks a version.
 *
 * Nothing here knows about any one IG or publisher (fhir-harness/AGENTS.md).
 *
 * @covers none — a release step that uploads build outputs, not an audit of a declared graph
 */
import { spawnSync } from "node:child_process";
import { copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";

/** The Publisher's packages a release carries, in this order; only `package.tgz` is required. */
export const RELEASE_PACKAGES: readonly string[] = ["package.tgz", "package.r4.tgz", "package.r4b.tgz"];
/** The IG's AST, zipped. */
export const AST_ZIP = "ast-data.zip";
export const SUMS = "SHA256SUMS";

/** A file a release carries. */
export interface ReleaseAsset {
  name: string;
  bytes: number;
  sha256: string;
}

/** A release label or version that marks a pre-release. */
const PRE = /ballot|draft|ci-build|preview|snapshot/i;

/**
 * `prerelease` when the IG's version carries a pre-release suffix
 * (`1.0.0-ballot`) or its `releaseLabel` names a ballot, draft or CI build;
 * otherwise `release`.
 */
export function releaseKind(cfg: Record<string, unknown>): "prerelease" | "release" {
  const version = String(cfg["version"] ?? "");
  const label = String(cfg["releaseLabel"] ?? "");
  return /-/.test(version) || PRE.test(label) ? "prerelease" : "release";
}

export function sha256(file: string): string {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

/** Zip a directory so the archive depends only on the files' names and contents. The directory is not changed. */
export function zipDir(dir: string, out: string): void {
  rmSync(out, { force: true });
  const stage = mkdtempSync(join(tmpdir(), "ig-release-"));
  try {
    cpSync(dir, stage, { recursive: true, dereference: true });
    const files: string[] = [];
    const walk = (d: string, rel: string): void => {
      for (const n of readdirSync(d).sort()) {
        const p = join(d, n);
        const r = rel ? `${rel}/${n}` : n;
        if (statSync(p).isDirectory()) walk(p, r);
        else {
          files.push(r);
          utimesSync(p, EPOCH, EPOCH);
        }
      }
    };
    walk(stage, "");
    // -X: no extra file attributes; -D: no directory entries; every entry at one fixed time.
    const r = spawnSync("zip", ["-X", "-q", "-D", resolve(out), "-@"], { cwd: stage, input: files.join("\n") });
    if (r.status !== 0) throw new Error(`zip failed: ${r.stderr?.toString() || r.error?.message || "no output"}`);
  } finally {
    rmSync(stage, { recursive: true, force: true });
  }
}

/** The time every zipped file carries: zip's own epoch, so no build time is in the bytes. */
const EPOCH = new Date("1980-01-01T00:00:00Z");

/** Gather the release's files into `out` and write `SHA256SUMS`. Refuses a build with no `package.tgz` or no AST. */
export function releaseAssets(o: { output: string; ast: string; out: string }): ReleaseAsset[] {
  if (!existsSync(join(o.output, "package.tgz"))) throw new Error(`no package.tgz in ${o.output}: a release carries the package (ig-binary-artefacts)`);
  if (!existsSync(join(o.ast, "manifest.json"))) throw new Error(`no AST manifest in ${o.ast}`);
  mkdirSync(o.out, { recursive: true });
  for (const p of RELEASE_PACKAGES) if (existsSync(join(o.output, p))) copyFileSync(join(o.output, p), join(o.out, p));
  zipDir(o.ast, join(o.out, AST_ZIP));
  const names = [...RELEASE_PACKAGES.filter((p) => existsSync(join(o.out, p))), AST_ZIP];
  const assets = names.map((name) => ({ name, bytes: statSync(join(o.out, name)).size, sha256: sha256(join(o.out, name)) }));
  writeFileSync(join(o.out, SUMS), assets.map((a) => `${a.sha256}  ${a.name}\n`).join(""));
  return assets;
}

/** The release's description: what it carries, and that the owner publishes it. */
export function releaseBody(tag: string, assets: readonly ReleaseAsset[], prerelease: boolean): string {
  return [
    `Release ${tag}${prerelease ? " (pre-release: a ballot, draft or CI build)" : ""}.`,
    "",
    "| File | Size | SHA-256 |",
    "|---|---:|---|",
    ...assets.map((a) => `| \`${a.name}\` | ${(a.bytes / 1e6).toFixed(1)} MB | \`${a.sha256}\` |`),
    "",
    `\`${AST_ZIP}\` is the IG's AST: every resource as built, Library resources with their ELM.`,
    "",
    "Made as a draft by `fhir-harness/scripts/ig-release.ts`. Publishing it is the release's authorisation (`draft-to-publication.bpmn`).",
    "",
  ].join("\n");
}

/** A GitHub REST call through `gh api`; injectable for tests. */
export type Gh = (args: string[], input?: string) => { status: number; out: string };

export const gh: Gh = (args, input) => {
  const r = spawnSync("gh", ["api", ...args], { input, encoding: "utf-8", maxBuffer: 64 << 20 });
  return { status: r.status ?? 1, out: `${r.stdout ?? ""}${r.status === 0 ? "" : r.stderr ?? ""}` };
};

interface GhRelease {
  id: number;
  draft: boolean;
  upload_url: string;
  assets: { id: number; name: string }[];
}

/** The release for `tag`, a draft included, or undefined. Drafts have no tag lookup, so the list is read. */
export function releaseFor(repo: string, tag: string, call: Gh = gh): GhRelease | undefined {
  const r = call([`repos/${repo}/releases?per_page=100`]);
  if (r.status !== 0) throw new Error(`could not list ${repo}'s releases: ${r.out}`);
  return (JSON.parse(r.out) as (GhRelease & { tag_name: string })[]).find((x) => x.tag_name === tag);
}

/**
 * Make (or refresh) the draft release for `tag` and upload the files in `dir`.
 * Returns what was done, as lines. A published release for the tag is refused.
 */
export function draftRelease(o: { repo: string; tag: string; dir: string; prerelease: boolean; dryRun?: boolean }, call: Gh = gh): string[] {
  const names = [...RELEASE_PACKAGES, AST_ZIP, SUMS].filter((n) => existsSync(join(o.dir, n)));
  if (!names.includes("package.tgz") || !names.includes(AST_ZIP)) throw new Error(`${o.dir} lacks package.tgz or ${AST_ZIP}: run \`assets\` first`);
  const assets = names.filter((n) => n !== SUMS).map((name) => ({ name, bytes: statSync(join(o.dir, name)).size, sha256: sha256(join(o.dir, name)) }));
  const body = releaseBody(o.tag, assets, o.prerelease);
  const existing = releaseFor(o.repo, o.tag, call);
  if (existing && !existing.draft) throw new Error(`${o.repo} already has a published release for ${o.tag}: a published release is never changed here`);
  const log: string[] = [];
  if (o.dryRun) return [`would ${existing ? "refresh the draft" : "make a draft"} for ${o.tag}${o.prerelease ? " (pre-release)" : ""} with ${names.join(", ")}`];
  let rel: GhRelease;
  if (existing) {
    const r = call(["-X", "PATCH", `repos/${o.repo}/releases/${existing.id}`, "--input", "-"], JSON.stringify({ body, prerelease: o.prerelease, draft: true }));
    if (r.status !== 0) throw new Error(`could not update the draft: ${r.out}`);
    rel = JSON.parse(r.out) as GhRelease;
    for (const a of existing.assets.filter((a) => names.includes(a.name))) {
      const d = call(["-X", "DELETE", `repos/${o.repo}/releases/assets/${a.id}`]);
      if (d.status !== 0) throw new Error(`could not replace ${a.name}: ${d.out}`);
    }
    log.push(`refreshed the draft for ${o.tag}`);
  } else {
    const r = call(["-X", "POST", `repos/${o.repo}/releases`, "--input", "-"], JSON.stringify({ tag_name: o.tag, name: o.tag, body, draft: true, prerelease: o.prerelease }));
    if (r.status !== 0) throw new Error(`could not make the draft: ${r.out}`);
    rel = JSON.parse(r.out) as GhRelease;
    log.push(`made a draft for ${o.tag}${o.prerelease ? " (pre-release)" : ""}`);
  }
  const upload = rel.upload_url.replace(/\{.*\}$/, "");
  for (const n of names) {
    const r = call(["-X", "POST", `${upload}?name=${encodeURIComponent(n)}`, "-H", "Content-Type: application/octet-stream", "--input", join(o.dir, n)]);
    if (r.status !== 0) throw new Error(`could not upload ${n}: ${r.out}`);
    log.push(`uploaded ${n}`);
  }
  return log;
}

/** Runs git in a directory; injectable for tests. */
export type Git = (args: string[], cwd: string) => { status: number; out: string };
const git: Git = (args, cwd) => {
  const r = spawnSync("git", args, { cwd, encoding: "utf-8" });
  return { status: r.status ?? 1, out: `${r.stdout ?? ""}`.trim() };
};

/** What `check` found: the version, its tag, and each thing the owner should do. */
export interface ReleaseCheck {
  version?: string;
  tag?: string;
  tagged?: boolean;
  /** The commit that last set the version, the one to tag. */
  versionCommit?: string;
  /** `draft`, `published`, `none`, or `unknown` (the release list could not be read). */
  release?: "draft" | "published" | "none" | "unknown";
  /** One line per finding, for the run's log; empty when all is in order. */
  report: string[];
}

/** The tag a version is released under. */
export function releaseTag(version: string): string {
  return `v${version}`;
}

/** Whether `tag` exists, locally or on `origin` (a CI checkout may hold no tags). */
export function tagExists(ig: string, tag: string, run: Git = git): boolean {
  if (run(["rev-parse", "-q", "--verify", `refs/tags/${tag}`], ig).status === 0) return true;
  const r = run(["ls-remote", "--tags", "origin", `refs/tags/${tag}`], ig);
  return r.status === 0 && r.out.length > 0;
}

/**
 * The commit that last set `version` in `sushi-config.yaml`: the newest
 * commit whose diff adds or removes a `version:` line holding it. Undefined
 * when the history cannot say (a shallow clone, a file never committed).
 */
export function versionCommit(ig: string, version: string, run: Git = git): string | undefined {
  // A basic regular expression, git's default for -G: only `.` needs escaping in a version.
  const esc = version.replace(/[\\.[\]*^$]/g, "\\$&");
  const r = run(["log", "-1", "--format=%H", "-G", `^version:[[:space:]]*["']*${esc}["']*[[:space:]]*$`, "--", "sushi-config.yaml"], ig);
  return r.status === 0 && /^[0-9a-f]{40}$/.test(r.out) ? r.out : undefined;
}

/**
 * The catch-up check (module doc): whether the IG's current version is tagged,
 * and whether its tag has a release. Reports; never tags, never releases.
 */
export function releaseCheck(o: { ig: string; repo?: string }, run: Git = git, call: Gh = gh): ReleaseCheck {
  const cfgPath = join(o.ig, "sushi-config.yaml");
  if (!existsSync(cfgPath)) return { report: [`${cfgPath}: no sushi-config.yaml, so no version to check`] };
  const cfg = parseYaml(readFileSync(cfgPath, "utf-8")) as Record<string, unknown>;
  const version = cfg["version"] === undefined || cfg["version"] === null ? "" : String(cfg["version"]).trim();
  if (!version) return { report: ["sushi-config.yaml has no version: nothing to tag"] };
  const tag = releaseTag(version);
  const kind = releaseKind(cfg);
  if (!tagExists(o.ig, tag, run)) {
    const at = versionCommit(o.ig, version, run);
    const head = run(["rev-parse", "HEAD"], o.ig).out;
    return {
      version,
      tag,
      tagged: false,
      ...(at ? { versionCommit: at } : {}),
      report: [
        `version ${version} is untagged: the owner tags commit ${at ?? head} with ${tag}` +
          `${at ? " (the commit that set the version)" : " (HEAD: the history does not say which commit set the version)"}` +
          `${kind === "prerelease" ? "; it is a pre-release" : ""}. Pushing the tag starts the IG release (draft). An agent never tags.`,
      ],
    };
  }
  if (!o.repo) return { version, tag, tagged: true, release: "unknown", report: [`${tag} is tagged; pass --repo <owner/repo> to check it has a release`] };
  let rel: ReturnType<typeof releaseFor>;
  try {
    rel = releaseFor(o.repo, tag, call);
  } catch (e) {
    return { version, tag, tagged: true, release: "unknown", report: [`${tag} is tagged; its release could not be read (${(e as Error).message.split("\n")[0]})`] };
  }
  if (!rel) {
    return {
      version,
      tag,
      tagged: true,
      release: "none",
      report: [`tag ${tag} has no release: run "IG release (draft)" (ig-release.yml) by hand with tag ${tag}. (A draft is visible only to a token with write access.)`],
    };
  }
  return { version, tag, tagged: true, release: rel.draft ? "draft" : "published", report: rel.draft ? [`${tag} has a draft release waiting for the owner to publish it`] : [] };
}

function arg(argv: readonly string[], name: string): string | undefined {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}

function main(argv: string[]): number {
  const [cmd] = argv;
  try {
    if (cmd === "assets") {
      const [output, ast, out] = [arg(argv, "--output"), arg(argv, "--ast"), arg(argv, "--out")];
      if (!output || !ast || !out) throw new Error("usage: ig-release.ts assets --output <publisher output/> --ast <AST dir> --out <dir>");
      for (const a of releaseAssets({ output, ast, out })) console.log(`${a.name}\t${a.bytes}\t${a.sha256}`);
      return 0;
    }
    if (cmd === "kind") {
      const ig = arg(argv, "--ig") ?? ".";
      console.log(releaseKind(parseYaml(readFileSync(join(ig, "sushi-config.yaml"), "utf-8")) as Record<string, unknown>));
      return 0;
    }
    if (cmd === "draft") {
      const [repo, tag, dir] = [arg(argv, "--repo"), arg(argv, "--tag"), arg(argv, "--dir")];
      if (!repo || !tag || !dir) throw new Error("usage: ig-release.ts draft --repo <owner/repo> --tag <tag> --dir <dir> [--prerelease] [--dry-run]");
      for (const l of draftRelease({ repo, tag, dir, prerelease: argv.includes("--prerelease"), dryRun: argv.includes("--dry-run") })) console.log(l);
      return 0;
    }
    if (cmd === "check") {
      const ig = resolve(arg(argv, "--ig") ?? ".");
      const repo = arg(argv, "--repo");
      const c = releaseCheck({ ig, ...(repo ? { repo } : {}) });
      for (const l of c.report) console.log(`ig-release check: ${l}`);
      if (!c.report.length) console.log(`ig-release check: ${c.tag} is tagged and released`);
      return 0;
    }
    console.error("usage: ig-release.ts assets|kind|draft|check …");
    return 2;
  } catch (e) {
    console.error(`ig-release: ${(e as Error).message}`);
    return 1;
  }
}

if (import.meta.main) process.exit(main(process.argv.slice(2)));
