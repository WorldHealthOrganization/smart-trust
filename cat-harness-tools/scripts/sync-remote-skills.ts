#!/usr/bin/env bun
/**
 * MATERIALIZE a remote package's declared skills, at a PINNED commit, so
 * `skill_fetch` can serve them.
 *
 * @module cat-harness/scripts/sync-remote-skills
 * @covers skills — the synced packages a remote-package wrapper declares, at their pin
 *
 * It performs what the wrappers under `skills/remote-packages/` declare. The
 * synced bytes are COMMITTED, at the commit the wrapper pins, read-only, with
 * sha256 fixity per file, so `check:materialized-fixity` fails an edit in
 * place: a synced skill is somebody else's bytes, and a change to them is a
 * re-sync, never a hand edit.
 *
 * ## Why a pinned commit and never a branch
 *
 * A skill body IS a prompt; an unpinned one is an unreviewed prompt from a
 * stranger. So a wrapper that declares a `sync` must pin a full 40-character
 * commit, and an update is a deliberate change to that pin, reviewed as a
 * diff of the materialized files. {@link pinnedRef} refuses anything else.
 *
 * ## Layout — one package per skill
 *
 * Upstream uses the Agent Skills layout, `<path>/<skill>/SKILL.md`, with
 * `references/`, `scripts/` and `assets/` beside it, and SKILL.md links to
 * them relatively. This layer serves FLAT packages, `<package>/<skill>.md`.
 * Flattening several upstream skills into one package would collide their
 * `references/` directories, so each skill becomes its own package:
 * `skills/<skill>/<skill>.md` is the upstream SKILL.md renamed, and everything
 * else keeps its upstream relative path, so every relative link still
 * resolves.
 *
 * ## What is written, per skill
 *
 * - every upstream file under `<path>/<skill>/`, byte for byte;
 * - `materialization.json` — one `materialization` record per file, in the
 *   shape `check:materialized-fixity` already walks;
 * - `package-manifest.json` — THIS layer's wrapper for the package, which
 *   is ours rather than upstream's and so carries no fixity.
 *
 * Usage:
 *   bun run cat-harness-tools/scripts/sync-remote-skills.ts            # fetch + write
 *   bun run cat-harness-tools/scripts/sync-remote-skills.ts --check    # offline: is every declared skill materialized at its pin?
 */
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";

import { findInstanceRoot } from "../schemas/kg/cat-harness.ts";
import { kgRoots } from "./known-skills.js";
import { packageDirsIn } from "./skill-topics.js";
import { HARNESS_ROOT } from "./lib/roots.ts";
import { inputSiteReached } from "../schemas/sdlc/input-trace.ts";

const INSTANCE = join(HARNESS_ROOT);

/** The record file written beside a materialized skill. */
export const RECORD_FILE = "materialization.json";
export const RECORD_SCHEMA = "folio-remote-skill/v1";

export interface Wrapper {
  file: string;
  name: string;
  description: string;
  repo: string;
  ref: string;
  path: string;
  maintainer: string;
  sync?: { strategy: string; frequency: string; autoUpdate: boolean };
  wrapper: { description: string; skills: string[]; lifecycleStages?: string[] };
}

/** A full commit SHA, or the reason it is not one. */
export function pinnedRef(ref: string): { ok: true } | { ok: false; why: string } {
  if (/^[0-9a-f]{40}$/.test(ref)) return { ok: true };
  return {
    ok: false,
    why: `ref \`${ref}\` is not a full commit SHA — a synced skill is a prompt an agent follows, so it is pinned to a commit and moved only by a reviewed change`,
  };
}

/** Where the upstream skill directory is, inside a clone. */
export function upstreamSkillDir(clone: string, w: Pick<Wrapper, "path">, skill: string): string {
  const base = w.path.replace(/^\/+|\/+$/g, "");
  return base ? join(clone, base, skill) : join(clone, skill);
}

/**
 * Is this directory a synced skill — somebody else's bytes, pinned?
 *
 * For the checks that LINT authored text (paths, links, headings). A finding
 * in upstream's own prose is not ours to fix: editing it would fork the
 * pinned copy, which `check:materialized-fixity` exists to refuse. Those
 * checks skip it and leave fixity to vouch for it. The record is the
 * declaration; a directory name is not asked.
 */
export function isSyncedSkillDir(dir: string): boolean {
  try {
    const r = JSON.parse(readFileSync(join(dir, RECORD_FILE), "utf8")) as { $schema?: string };
    return r.$schema === RECORD_SCHEMA;
  } catch {
    return false;
  }
}

export function wrappersIn(skillsDir: string): Wrapper[] {
  const dir = join(skillsDir, "remote-packages");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => ({ file: f, ...(JSON.parse(readFileSync(join(dir, f), "utf8")) as Omit<Wrapper, "file">) }));
}

function filesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...filesUnder(p));
    else if (e.isFile()) out.push(p);
  }
  return out.sort();
}

const sha256 = (p: string): string => createHash("sha256").update(readFileSync(p)).digest("hex");

/**
 * The record for one materialized skill. `localPath` is INSTANCE-relative,
 * which is what `check:materialized-fixity` resolves it against.
 */
export function buildRecord(
  w: Wrapper,
  skill: string,
  pkgDir: string,
  instanceRoot: string,
  upstreamRel: (local: string) => string,
  at: string,
): Record<string, unknown> {
  const repoBase = w.repo.replace(/\.git$/, "");
  const files = filesUnder(pkgDir)
    .filter((p) => ![RECORD_FILE, "package-manifest.json"].includes(relative(pkgDir, p)))
    .map((p) => {
      const local = relative(pkgDir, p);
      return {
        id: `${skill}/${local}`,
        name: local,
        materialization: {
          state: "materialized",
          provenance: { upstream: `${repoBase}/blob/${w.ref}/${upstreamRel(local)}` },
          localPath: relative(instanceRoot, p),
          bytes: statSync(p).size,
          // ARCHIVAL, not working: these bytes are the reviewed contract at
          // the pin. A working copy may be quietly re-fetched when it rots;
          // this one may only move by a reviewed change to the pin.
          purpose: "archival",
          fixity: { algorithm: "sha256", digest: sha256(p) },
          materializedAt: at,
          upstreamVersion: w.ref,
        },
      };
    });
  return {
    $schema: RECORD_SCHEMA,
    skill,
    package: w.name,
    repo: w.repo,
    ref: w.ref,
    wrapper: `remote-packages/${w.file}`,
    note: "Somebody else's bytes, pinned. Do not edit in place: change the pin in the wrapper and re-run `bun run cat sync:remote-skills`.",
    files,
  };
}

export const LICENCE_NAMES = ["LICENSE", "LICENSE.md", "LICENSE.txt", "LICENCE", "COPYING"];

/** The licence governing a skill: its own, else the upstream root's. */
export function upstreamLicence(clone: string, skillDir: string): { path: string; inSkill: boolean } | undefined {
  for (const n of LICENCE_NAMES) if (existsSync(join(skillDir, n))) return { path: join(skillDir, n), inSkill: true };
  for (const n of LICENCE_NAMES) if (existsSync(join(clone, n))) return { path: join(clone, n), inSkill: false };
  return undefined;
}

/** Run git; its stdout, or a throw carrying its stderr. Shared with `kg-subscribe`. */
export function git(args: string[], cwd?: string): string {
  // input-site: traced #aeee0c38 — any git command, a fetch from the network among them (shallowFetch by a branch or a sha); a run that reaches it records no hash
  inputSiteReached("sync-remote-skills: git");
  const r = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${(r.stderr ?? "").trim() || `exit ${r.status}`}`);
  return r.stdout;
}

/**
 * Fetch exactly one commit, shallowly, into a fresh repository, WITHOUT a
 * checkout: the caller reads `FETCH_HEAD`. `blobless` adds
 * `--filter=blob:none`, so only trees arrive and a blob is fetched when it is
 * read — `kg-subscribe` reads one file of a whole repository this way.
 */
export function shallowFetch(repo: string, ref: string, opts: { blobless?: boolean; prefix?: string } = {}): string {
  // input-site: traced #c912fbc5 — the scratch repository a remote fetch lands in
  inputSiteReached("sync-remote-skills: shallowFetch");
  const dir = mkdtempSync(join(tmpdir(), opts.prefix ?? "remote-skill-"));
  try {
    git(["init", "-q", dir]);
    git(["remote", "add", "origin", repo], dir);
    git(["fetch", "-q", "--depth", "1", ...(opts.blobless ? ["--filter=blob:none"] : []), "origin", ref], dir);
  } catch (e) {
    rmSync(dir, { recursive: true, force: true });
    throw e;
  }
  return dir;
}

/** Fetch exactly one commit, shallowly, and check it out. */
function fetchAt(repo: string, ref: string): string {
  const dir = shallowFetch(repo, ref);
  git(["checkout", "-q", "FETCH_HEAD"], dir);
  return dir;
}

/**
 * Where a synced skill's package lives under `skillsDir`: the existing package
 * directory of that name, which may sit in a concern group
 * (`skills/content/<skill>/`, placement PR1, bean `ybwt`), else a new one at
 * the top level. Asked of the ONE grouped walk rather than composed, so a
 * re-sync lands where discovery already looks.
 */
export function syncedPackageDir(skillsDir: string, skill: string): string {
  return packageDirsIn(skillsDir).find((d) => d.name === skill)?.dir ?? join(skillsDir, skill);
}

/**
 * Every skills directory in the checkout that holds a `remote-packages/`
 * directory. A wrapper belongs to the layer whose skills use it — sci holds
 * `claude-scientific-skills`, the FHIR IG harness `smarter-fhir` (placement PR1) — so
 * a check rooted at the harness alone would read none of them.
 */
export function wrapperSkillsDirs(instance: string): string[] {
  return [...new Set(kgRoots(instance).map((d) => resolve(d)))].filter((d) => existsSync(join(d, "remote-packages"))).sort();
}

/** Offline: every declared skill is materialized, at the wrapper's pin, from that wrapper. */
export function checkMaterialized(skillsDir: string): string[] {
  const problems: string[] = [];
  for (const w of wrappersIn(skillsDir)) {
    if (!w.sync) continue;
    const pin = pinnedRef(w.ref);
    if (!pin.ok) {
      problems.push(`${w.file}: ${pin.why}`);
      continue;
    }
    if (w.sync.autoUpdate) problems.push(`${w.file}: autoUpdate is true — a pinned sync never updates itself`);
    for (const skill of w.wrapper.skills) {
      const pkg = syncedPackageDir(skillsDir, skill);
      const rec = join(pkg, RECORD_FILE);
      if (!existsSync(rec)) {
        problems.push(`${w.file}: \`${skill}\` is declared and not materialized — run \`bun run cat sync:remote-skills\``);
        continue;
      }
      const r = JSON.parse(readFileSync(rec, "utf8")) as { ref?: string; package?: string };
      if (r.ref !== w.ref) problems.push(`${skill}: materialized at ${r.ref}, but ${w.file} pins ${w.ref} — re-sync`);
      if (r.package !== w.name) problems.push(`${skill}: materialized from \`${r.package}\`, but declared by \`${w.name}\``);
      if (!existsSync(join(pkg, `${skill}.md`))) problems.push(`${skill}: no \`${skill}.md\` entry point`);
      if (!LICENCE_NAMES.some((n) => existsSync(join(pkg, n)))) {
        problems.push(`${skill}: no licence file beside the copy — the notice must travel with it`);
      }
    }
  }
  return problems;
}

/**
 * NOTICE names every synced package, at its current pin (owner, 2026-09-24:
 * third-party skills keep their own licence and are listed in NOTICE). A pin
 * moved without NOTICE following would credit bytes that are no longer here.
 */
export function checkNotice(noticeText: string, wrappers: Wrapper[]): string[] {
  const problems: string[] = [];
  for (const w of wrappers) {
    if (!w.sync || w.wrapper.skills.length === 0) continue;
    const repo = w.repo.replace(/\.git$/, "");
    if (!noticeText.includes(repo)) problems.push(`NOTICE does not name ${repo}, which ${w.file} syncs`);
    else if (!noticeText.includes(w.ref)) problems.push(`NOTICE names ${repo} but not its current pin ${w.ref}`);
  }
  return problems;
}

function sync(skillsDir: string, instanceRoot: string): number {
  let failures = 0;
  // input-site: inert #a3e3d49c — the sync time stamped into each provenance record (buildRecord); it never reaches the exit code
  const at = new Date().toISOString();
  for (const w of wrappersIn(skillsDir)) {
    if (!w.sync) continue;
    const pin = pinnedRef(w.ref);
    if (!pin.ok) {
      console.error(`  ✗ ${w.file}: ${pin.why}`);
      failures++;
      continue;
    }
    console.log(`${w.name} @ ${w.ref.slice(0, 12)}`);
    const clone = fetchAt(w.repo, w.ref);
    try {
      for (const skill of w.wrapper.skills) {
        const src = upstreamSkillDir(clone, w, skill);
        if (!existsSync(join(src, "SKILL.md"))) {
          // NOT SKIPPED QUIETLY: a declared name upstream does not have is a
          // false declaration, and `smart-launch` was one for months.
          console.error(`  ✗ ${skill}: upstream has no ${relative(clone, join(src, "SKILL.md"))} at this commit`);
          failures++;
          continue;
        }
        const dst = syncedPackageDir(skillsDir, skill);
        rmSync(dst, { recursive: true, force: true });
        cpSync(src, dst, { recursive: true });
        renameSync(join(dst, "SKILL.md"), join(dst, `${skill}.md`));
        // THE LICENCE TRAVELS WITH THE COPY. A permissive licence (MIT and its
        // kin) is conditional on its notice being kept with every copy, and
        // upstream keeps that notice at its ROOT, outside the skill directory
        // that is copied. So it is copied in beside the skill, under fixity
        // like every other byte. A skill with no licence anywhere upstream is
        // refused: bytes nobody granted are bytes this repository may not hold.
        const licence = upstreamLicence(clone, src);
        if (!licence) {
          rmSync(dst, { recursive: true, force: true });
          console.error(`  ✗ ${skill}: no licence file in the skill or at the upstream root — not copied`);
          failures++;
          continue;
        }
        const licenceLocal = licence.inSkill ? relative(src, licence.path) : "LICENSE";
        if (!licence.inSkill) cpSync(licence.path, join(dst, licenceLocal));
        const upstreamRel = (local: string): string =>
          local === licenceLocal && !licence.inSkill
            ? relative(clone, licence.path)
            : relative(clone, join(src, local === `${skill}.md` ? "SKILL.md" : local));
        const record = buildRecord(w, skill, dst, instanceRoot, upstreamRel, at);
        writeFileSync(join(dst, RECORD_FILE), `${JSON.stringify(record, null, 2)}\n`);
        writeFileSync(
          join(dst, "package-manifest.json"),
          `${JSON.stringify(
            {
              name: skill,
              version: "0.0.0",
              description: `Materialized from ${w.name} (${w.repo}) at ${w.ref}. Read-only: see ${RECORD_FILE}.`,
              skills: [skill],
              docker: { baseImage: "ubuntu:24.04", aptPackages: [] },
              lifecycleStages: w.wrapper.lifecycleStages ?? [],
            },
            null,
            2,
          )}\n`,
        );
        console.log(`  ✓ ${skill} — ${(record.files as unknown[]).length} file(s)`);
      }
    } finally {
      rmSync(clone, { recursive: true, force: true });
    }
  }
  return failures;
}

if (import.meta.main) {
  const dirs = wrapperSkillsDirs(INSTANCE);
  if (process.argv.includes("--check")) {
    const noticePath = join(INSTANCE, "..", "NOTICE");
    const notice = existsSync(noticePath) ? readFileSync(noticePath, "utf8") : "";
    const problems = dirs.flatMap((d) => [...checkMaterialized(d), ...checkNotice(notice, wrappersIn(d))]);
    const declared = dirs.flatMap((d) => wrappersIn(d).filter((w) => w.sync).flatMap((w) => w.wrapper.skills));
    console.log(`Remote skills — ${declared.length} declared by a syncing wrapper, in ${dirs.length} skills director${dirs.length === 1 ? "y" : "ies"}`);
    if (declared.length === 0) {
      console.log("  ✓ none declared — every skills directory was read and no wrapper syncs");
      process.exit(0);
    }
    for (const p of problems) console.error(`  ✗ ${p}`);
    if (problems.length) process.exit(1);
    console.log("  ✓ every declared skill is materialized at its wrapper's pin");
    process.exit(0);
  }
  let failures = 0;
  for (const d of dirs) failures += sync(d, findInstanceRoot(d) ?? INSTANCE);
  process.exit(failures ? 1 : 0);
}
