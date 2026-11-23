#!/usr/bin/env bun
/**
 * Seed the FHIR package cache from trusted sources (exact versions).
 *
 * Usage:
 *   bun run fhir-harness/scripts/fhir-cache-seed-npm.ts [--cache DIR] [--sushi-config FILE]
 *                                                      [--mirror DIR|GIT-URL] [--mirror-commit SHA]
 *                                                      [--missing-out FILE] [--template-repo NAME=OWNER/REPO]
 *                                                      [--site-repo PREFIX=OWNER/REPO[@BRANCH]]
 *                                                      [--lock FILE] [--dry-run] [name#version ...]
 *
 * A package `--lock` pins (an IG's `fhir-packages.lock.json`: name, version, tarball
 * URL, and `integrity` sha512-/sha256- and/or hex `sha256`) is installed from that URL
 * only, after every pinned hash matches; a mismatch refuses it. Its own dependencies are
 * not followed: the lock lists the IG's packages in full.
 *
 * Sources, tried in order for each package the lock does not pin:
 *   1. the cache itself (already present and verified);
 *   2. npm, account `grahamegrieve` (owner, 2026-09-30: trusted);
 *   3. a publisher's published-site repository on GitHub, for package-name prefixes
 *      the caller maps with --site-repo (none by default: which publisher owns which
 *      prefix is the layer's to say, not this layer's);
 *   4. a template's own repository (from FHIR/ig-registry or explicit --template-repo);
 *   5. `--mirror`: directory or git repository of `<name>#<version>.tgz` with SHA512SUMS.
 *
 * Dependencies:
 *   Follows transitive `dependencies` in `package.json` recursively for every
 *   installed or cached package until all reachable dependencies are visited.
 *   Missing packages are reported and listed in `--missing-out`.
 *
 * Exit codes:
 *   0: all requested and transitive packages installed or present in cache
 *   1: one or more packages missing (listed in stdout and --missing-out)
 *   2: usage or syntax error
 *
 * @module fhir-harness/scripts/fhir-cache-seed-npm
 */

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join, normalize, resolve } from "node:path";
import { gunzipSync } from "node:zlib";
import { parse as parseYaml } from "yaml";

export const TRUSTED_NPM_PUBLISHER = "grahamegrieve";
export const PLACEHOLDER_VERSION = "0.0.1-security";
export const NPM_REGISTRY = "https://registry.npmjs.org/";
export const TEMPLATE_REGISTRY_URL =
  "https://raw.githubusercontent.com/FHIR/ig-registry/master/templates.json";

/** A package name or version safe to put in a path or an npm argument. */
export function validPart(s: unknown): boolean {
  return (
    typeof s === "string" &&
    s.length > 0 &&
    !s.startsWith("-") &&
    !s.includes("/") &&
    !s.includes("\\") &&
    !s.includes("..") &&
    !s.includes("\0") &&
    s.trim() === s
  );
}

/** Exact semver or current (template HEAD). */
export function exact(v: unknown): boolean {
  return (
    typeof v === "string" &&
    (/^\d+\.\d+\.\d+([-.][0-9A-Za-z.-]+)?$/.test(v) || v === "current")
  );
}

export function sha512Hex(data: Buffer): string {
  return createHash("sha512").update(data).digest("hex");
}

export function sha512Integrity(data: Buffer): string {
  return "sha512-" + createHash("sha512").update(data).digest("base64");
}

/**
 * Extract dependencies and fhirVersion core package from a sushi-config.yaml file.
 * Handles single-line values, nested object configurations (version: ...), and ignores comments.
 */
export function parseSushiConfigDeps(sushiConfigPath: string): string[] {
  if (!existsSync(sushiConfigPath)) return [];
  const text = readFileSync(sushiConfigPath, "utf-8");
  const doc = parseYaml(text) as Record<string, unknown> | null;
  if (!doc || typeof doc !== "object") return [];
  const out: string[] = [];

  const fv = typeof doc.fhirVersion === "string" ? doc.fhirVersion.trim() : undefined;
  if (fv) {
    const majorMap: Record<string, string> = {
      "4.0.1": "r4",
      "4.3.0": "r4b",
      "5.0.0": "r5",
    };
    const major =
      majorMap[fv] ??
      (fv.startsWith("4.0") ? "r4" : fv.startsWith("4.3") ? "r4b" : fv.startsWith("5.") ? "r5" : undefined);
    if (major) {
      out.push(`hl7.fhir.${major}.core#${fv}`);
    }
  }

  const deps = doc.dependencies;
  if (deps && typeof deps === "object") {
    for (const [key, val] of Object.entries(deps)) {
      if (typeof val === "string" || typeof val === "number") {
        const v = String(val).split("#")[0].trim();
        if (v) out.push(`${key}#${v}`);
      } else if (val && typeof val === "object" && "version" in (val as Record<string, unknown>)) {
        const v = String((val as { version: unknown }).version).split("#")[0].trim();
        if (v) out.push(`${key}#${v}`);
      }
    }
  }

  return out;
}

/**
 * Inspect a .tgz archive in memory and return parsed package/package.json if present.
 */
export function readPackageJsonFromTgz(tgzData: Buffer): Record<string, unknown> | null {
  try {
    const buf = gunzipSync(tgzData);
    let off = 0;
    while (off + 512 <= buf.length) {
      const header = buf.subarray(off, off + 512);
      let name = header.toString("utf8", 0, 100).replace(/\0.*$/, "").trim();
      if (!name) break;
      const magic = header.toString("utf8", 257, 263);
      if (magic.startsWith("ustar")) {
        const prefix = header.toString("utf8", 345, 500).replace(/\0.*$/, "").trim();
        if (prefix) name = `${prefix}/${name}`;
      }
      name = normalize(name).replace(/^[./]+/, "");
      const sizeStr = header.toString("utf8", 124, 136).replace(/\0.*$/, "").trim();
      const size = parseInt(sizeStr, 8) || 0;
      const bodyOff = off + 512;
      if (name === "package/package.json" || name === "./package/package.json") {
        const jsonText = buf.toString("utf8", bodyOff, bodyOff + size);
        return JSON.parse(jsonText) as Record<string, unknown>;
      }
      off = bodyOff + Math.ceil(size / 512) * 512;
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Extract a .tgz safely into destination directory, ensuring path safety (no `..` or absolute paths).
 * Uses atomic unpack into temporary folder beside dest, then rename.
 */
export function unpackTgz(tgzData: Buffer, dest: string): void {
  const buf = gunzipSync(tgzData);
  const parent = dirname(resolve(dest));
  mkdirSync(parent, { recursive: true });
  const stage = mkdtempSync(join(parent, ".unpack-"));

  try {
    let off = 0;
    while (off + 512 <= buf.length) {
      const header = buf.subarray(off, off + 512);
      let name = header.toString("utf8", 0, 100).replace(/\0.*$/, "").trim();
      if (!name) break;
      const magic = header.toString("utf8", 257, 263);
      if (magic.startsWith("ustar")) {
        const prefix = header.toString("utf8", 345, 500).replace(/\0.*$/, "").trim();
        if (prefix) name = `${prefix}/${name}`;
      }
      const typeflag = String.fromCharCode(header[156]);
      const sizeStr = header.toString("utf8", 124, 136).replace(/\0.*$/, "").trim();
      const size = parseInt(sizeStr, 8) || 0;
      const bodyOff = off + 512;

      const norm = normalize(name);
      if (norm.startsWith("..") || /^[/\\]/.test(name)) {
        throw new Error(`unsafe path in tarball: ${name}`);
      }

      const outPath = join(stage, norm);
      if (typeflag === "5" || name.endsWith("/")) {
        mkdirSync(outPath, { recursive: true });
      } else if (typeflag === "0" || typeflag === "\0" || typeflag === "") {
        mkdirSync(dirname(outPath), { recursive: true });
        const fileData = buf.subarray(bodyOff, bodyOff + size);
        writeFileSync(outPath, fileData);
      }
      off = bodyOff + Math.ceil(size / 512) * 512;
    }

    if (existsSync(dest)) {
      rmSync(dest, { recursive: true, force: true });
    }
    renameSync(stage, dest);
  } catch (err) {
    rmSync(stage, { recursive: true, force: true });
    throw err;
  }
}

/** Check that destination holds valid matching package/package.json. */
export function checkCached(dest: string, name: string, version: string): string | null {
  const pjf = join(dest, "package", "package.json");
  if (!existsSync(pjf)) {
    return `${pjf} not found`;
  }
  let pj: Record<string, unknown>;
  try {
    pj = JSON.parse(readFileSync(pjf, "utf-8")) as Record<string, unknown>;
  } catch (e) {
    return `${pjf}: ${e instanceof Error ? e.message : String(e)}`;
  }
  const pjName = typeof pj.name === "string" ? pj.name : "";
  const pjVersion = typeof pj.version === "string" ? pj.version : "";
  if (pjName !== name && pjName !== `@hl7/${name}`) {
    return `cache entry ${dest} says ${pjName}#${pjVersion}`;
  }
  if (version !== "current" && pjVersion !== version) {
    return `cache entry ${dest} says ${pjName}#${pjVersion}`;
  }
  return null;
}

/** Parse SHA512SUMS file in a directory into filename -> hex. */
export function readSha512Sums(dir: string): Map<string, string> | null {
  const sumFile = join(dir, "SHA512SUMS");
  if (!existsSync(sumFile)) return null;
  const content = readFileSync(sumFile, "utf-8");
  const out = new Map<string, string>();
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const m = /^([0-9a-f]{128})\s+[ *]?(.+)$/.exec(trimmed);
    if (m) {
      out.set(m[2].trim(), m[1].toLowerCase());
    }
  }
  return out;
}

export function remoteCommit(url: string, ref = "HEAD"): string | null {
  try {
    const res = spawnSync("git", ["ls-remote", url, ref], { encoding: "utf-8" });
    if (res.status === 0 && res.stdout) {
      const parts = res.stdout.trim().split(/\s+/);
      if (parts[0] && /^[0-9a-f]{40}$/i.test(parts[0])) {
        return parts[0];
      }
    }
  } catch {}
  return null;
}

export interface NpmMeta {
  cand: string;
  meta: Record<string, unknown>;
  tarballUrl: string;
  integrity: string;
  publishedBy: string | null;
  maintainers: string[];
}

export function resolveNpm(
  name: string,
  version: string,
): { ok: true; data: NpmMeta } | { ok: false; reasons: string[] } {
  const reasons: string[] = [];
  for (const cand of [name, `@hl7/${name}`]) {
    try {
      const res = spawnSync("npm", ["view", `${cand}@${version}`, "--json", "--registry", NPM_REGISTRY], {
        encoding: "utf-8",
        maxBuffer: 10 * 1024 * 1024,
      });
      if (res.status !== 0 || !res.stdout?.trim()) {
        reasons.push(`${cand}@${version}: not on npm`);
        continue;
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(res.stdout);
      } catch {
        reasons.push(`${cand}@${version}: npm output invalid JSON`);
        continue;
      }
      const meta = (Array.isArray(parsed) ? parsed[parsed.length - 1] : parsed) as Record<string, unknown>;
      if (!meta || typeof meta !== "object") {
        reasons.push(`${cand}@${version}: not on npm`);
        continue;
      }
      if (meta.version !== version) {
        reasons.push(`${cand}: resolved to ${meta.version}, not ${version}`);
        continue;
      }
      if (version === PLACEHOLDER_VERSION) {
        reasons.push(`${cand}: npm malicious-package placeholder`);
        continue;
      }
      const u = meta._npmUser;
      let who: string | null = null;
      if (u && typeof u === "object" && "name" in (u as Record<string, unknown>)) {
        who = String((u as { name: unknown }).name);
      } else if (u) {
        who = String(u).split(" ")[0];
      }
      if (who !== TRUSTED_NPM_PUBLISHER) {
        reasons.push(`${cand}@${version}: published by ${who ? `'${who}'` : "unknown"}, not ${TRUSTED_NPM_PUBLISHER}`);
        continue;
      }
      const dist = meta.dist as { tarball?: string; integrity?: string } | undefined;
      if (!dist?.tarball) {
        reasons.push(`${cand}@${version}: no tarball in dist`);
        continue;
      }
      const integrity = dist.integrity ?? "";
      if (!integrity.startsWith("sha512-")) {
        reasons.push(`${cand}@${version}: no sha512 integrity published`);
        continue;
      }
      const rawMaintainers = (meta.maintainers as Array<unknown>) || [];
      const mList = rawMaintainers.map((m) => {
        if (typeof m === "object" && m !== null && "name" in (m as Record<string, unknown>)) {
          return String((m as { name: unknown }).name);
        }
        return String(m).split(" ")[0];
      });

      return {
        ok: true,
        data: {
          cand,
          meta,
          tarballUrl: dist.tarball,
          integrity,
          publishedBy: who,
          maintainers: mList,
        },
      };
    } catch (e) {
      reasons.push(`${cand}@${version}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return { ok: false, reasons };
}

export async function fetchVerifiedNpm(meta: NpmMeta): Promise<Buffer> {
  const resp = await fetch(meta.tarballUrl);
  if (!resp.ok) {
    throw new Error(`failed to fetch ${meta.tarballUrl}: HTTP ${resp.status}`);
  }
  const arrayBuf = await resp.arrayBuffer();
  const data = Buffer.from(arrayBuf);
  const got = sha512Integrity(data);
  if (got !== meta.integrity) {
    throw new Error(`${meta.tarballUrl}: integrity mismatch (expected ${meta.integrity}, got ${got})`);
  }
  return data;
}

export function fromMirror(
  mirrorDir: string,
  commit: string | null,
  name: string,
  version: string,
): { data: Buffer; provenance: Record<string, unknown> } | { error: string } {
  const sums = readSha512Sums(mirrorDir);
  if (!sums) {
    return { error: `mirror ${mirrorDir} has no SHA512SUMS` };
  }
  const base = `${name}#${version}.tgz`;
  const filePath = join(mirrorDir, base);
  if (!existsSync(filePath)) {
    return { error: `not in mirror ${mirrorDir}` };
  }
  const expectedHash = sums.get(base);
  if (!expectedHash) {
    return { error: `${base} is not listed in the mirror's SHA512SUMS` };
  }
  const data = readFileSync(filePath);
  const actualHash = sha512Hex(data);
  if (actualHash.toLowerCase() !== expectedHash.toLowerCase()) {
    return { error: `${base} does not match the mirror's SHA512SUMS` };
  }
  const pj = readPackageJsonFromTgz(data);
  if (!pj || pj.name !== name || pj.version !== version) {
    return { error: `mirror file says ${pj?.name}#${pj?.version}` };
  }
  return {
    provenance: {
      mirror: mirrorDir,
      commit,
      file: base,
      sha512: sha512Integrity(data),
    },
    data,
  };
}

/**
 * Fetch `<name>#<version>` from a publisher's published-site repository, at
 * `<rest-of-name>/<version>/package.tgz`, where `siteRepos` maps a package-name
 * prefix (e.g. `"org.example."`) to `OWNER/REPO` or `OWNER/REPO@BRANCH`
 * (default branch `main`). The longest matching prefix wins; no match is null.
 */
export async function fromSite(
  name: string,
  version: string,
  siteRepos: Record<string, string> = {},
): Promise<{ data: Buffer; provenance: Record<string, unknown> } | null> {
  const prefix = Object.keys(siteRepos)
    .filter((p) => p && name.startsWith(p) && name.length > p.length)
    .sort((a, b) => b.length - a.length)[0];
  if (!prefix) return null;
  const [repo, branch = "main"] = siteRepos[prefix].split("@");
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo) || !/^[\w./-]+$/.test(branch)) return null;
  const rel = `${name.slice(prefix.length)}/${version}/package.tgz`;
  const commit = remoteCommit(`https://github.com/${repo}`, branch);
  if (!commit) return null;
  const url = `https://raw.githubusercontent.com/${repo}/${commit}/${rel}`;
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const data = Buffer.from(await resp.arrayBuffer());
    const pj = readPackageJsonFromTgz(data);
    if (!pj || pj.name !== name || pj.version !== version) return null;
    return {
      provenance: { site: url, branch, commit, sha512: sha512Integrity(data) },
      data,
    };
  } catch {
    return null;
  }
}

/**
 * The file an IG repository commits to pin its FHIR packages, at its root by default:
 * `{ "packages": [{ "name", "version", "tarball", "integrity" | "sha256" }] }`, the
 * format of this layer's own `scripts/sushi/fhir-packages.lock.json`. `integrity` is
 * an npm-style SRI string (`sha512-<base64>` or `sha256-<base64>`); `sha256` is a hex
 * digest. At least one is required, and every one given must match.
 */
export const PACKAGE_LOCK_FILE = "fhir-packages.lock.json";

/** One package a lock pins: where its tarball is, and what its bytes must hash to. */
export interface LockedPackage {
  name: string;
  version: string;
  tarball: string;
  integrity?: string;
  sha256?: string;
}

const SRI = /^(sha256|sha512)-([A-Za-z0-9+/]+={0,2})$/;

/** Parse and check a package lock. Throws on anything it would not install as pinned. */
export function parsePackageLock(text: string, where = PACKAGE_LOCK_FILE): LockedPackage[] {
  let doc: unknown;
  try {
    doc = JSON.parse(text);
  } catch (e) {
    throw new Error(`${where}: not JSON (${e instanceof Error ? e.message : String(e)})`);
  }
  const pkgs = (doc as { packages?: unknown } | null)?.packages;
  if (!Array.isArray(pkgs)) throw new Error(`${where}: no "packages" array`);
  const out: LockedPackage[] = [];
  const seen = new Set<string>();
  pkgs.forEach((p, i) => {
    const at = `${where} packages[${i}]`;
    const e = (p ?? {}) as Record<string, unknown>;
    const { name, version, tarball, integrity, sha256 } = e;
    if (!validPart(name) || !validPart(version) || !exact(version) || version === "current") {
      throw new Error(`${at}: needs an exact "name" and "version" (no wildcard, no "current")`);
    }
    if (typeof tarball !== "string" || !/^https:\/\/[^\s]+$/.test(tarball)) {
      throw new Error(`${at}: "tarball" must be an https URL`);
    }
    if (integrity !== undefined && (typeof integrity !== "string" || !SRI.test(integrity))) {
      throw new Error(`${at}: "integrity" must be sha512-<base64> or sha256-<base64>`);
    }
    if (sha256 !== undefined && (typeof sha256 !== "string" || !/^[0-9a-f]{64}$/i.test(sha256))) {
      throw new Error(`${at}: "sha256" must be 64 hex digits`);
    }
    if (integrity === undefined && sha256 === undefined) {
      throw new Error(`${at}: pins no hash: give "integrity" or "sha256"`);
    }
    const spec = `${name}#${version}`;
    if (seen.has(spec)) throw new Error(`${at}: ${spec} is pinned twice`);
    seen.add(spec);
    out.push({
      name: name as string,
      version: version as string,
      tarball,
      ...(integrity !== undefined ? { integrity: integrity as string } : {}),
      ...(sha256 !== undefined ? { sha256: (sha256 as string).toLowerCase() } : {}),
    });
  });
  return out;
}

/** Why `data` is not the tarball `pkg` pins, or null when every pinned hash matches. */
export function lockMismatch(pkg: LockedPackage, data: Buffer): string | null {
  if (pkg.integrity) {
    const algo = pkg.integrity.slice(0, pkg.integrity.indexOf("-"));
    const got = `${algo}-${createHash(algo).update(data).digest("base64")}`;
    if (got !== pkg.integrity) return `integrity mismatch (pinned ${pkg.integrity}, got ${got})`;
  }
  if (pkg.sha256) {
    const got = createHash("sha256").update(data).digest("hex");
    if (got !== pkg.sha256) return `sha256 mismatch (pinned ${pkg.sha256}, got ${got})`;
  }
  const pj = readPackageJsonFromTgz(data);
  if (!pj || pj.name !== pkg.name || pj.version !== pkg.version) {
    return `the tarball says ${pj?.name}#${pj?.version}, not ${pkg.name}#${pkg.version}`;
  }
  return null;
}

/** Fetch a locked package's tarball and verify it against the lock. */
export async function fromLock(
  pkg: LockedPackage,
  fetchFn: (url: string) => Promise<Response> = (u) => fetch(u),
): Promise<{ data: Buffer } | { error: string }> {
  let data: Buffer;
  try {
    const resp = await fetchFn(pkg.tarball);
    if (!resp.ok) return { error: `${pkg.tarball}: HTTP ${resp.status}` };
    data = Buffer.from(await resp.arrayBuffer());
  } catch (e) {
    return { error: `${pkg.tarball}: ${e instanceof Error ? e.message : String(e)}` };
  }
  const bad = lockMismatch(pkg, data);
  return bad ? { error: `${pkg.tarball}: ${bad}` } : { data };
}

export function fromTemplateRepo(
  repo: string,
  name: string,
  version: string,
  dest: string,
  via: string,
  workDir: string,
): { provenance: Record<string, unknown>; pj: Record<string, unknown> } | { error: string } {
  const tmp = join(workDir, `template-${name.replace(/[^A-Za-z0-9._-]/g, "_")}`);
  rmSync(tmp, { recursive: true, force: true });
  const clone = spawnSync("git", ["clone", "-q", "--depth", "1", `https://github.com/${repo}`, tmp]);
  if (clone.status !== 0) {
    return { error: `${repo}: clone failed` };
  }
  const pjf = join(tmp, "package", "package.json");
  if (!existsSync(pjf)) {
    return { error: `${repo} HEAD has no package/package.json` };
  }
  let pj: Record<string, unknown>;
  try {
    pj = JSON.parse(readFileSync(pjf, "utf-8"));
  } catch (_e) {
    return { error: `${pjf}: invalid JSON` };
  }
  if (pj.name !== name || (version !== "current" && pj.version !== version)) {
    return { error: `${repo} HEAD is ${pj.name}#${pj.version}, not ${name}#${version}` };
  }
  const rev = spawnSync("git", ["-C", tmp, "rev-parse", "HEAD"], { encoding: "utf-8" });
  const commit = rev.stdout.trim();

  // Assemble inside stage
  const parent = dirname(resolve(dest));
  mkdirSync(parent, { recursive: true });
  const stage = mkdtempSync(join(parent, ".unpack-"));
  const pkgDir = join(stage, "package");
  mkdirSync(pkgDir, { recursive: true });

  for (const entry of readdirSync(tmp)) {
    if (entry === ".git" || entry === "package") continue;
    renameSync(join(tmp, entry), join(pkgDir, entry));
  }
  const innerPkg = join(tmp, "package");
  if (existsSync(innerPkg)) {
    for (const entry of readdirSync(innerPkg)) {
      renameSync(join(innerPkg, entry), join(pkgDir, entry));
    }
  }

  if (existsSync(dest)) rmSync(dest, { recursive: true, force: true });
  renameSync(stage, dest);

  return {
    provenance: {
      templateRepo: `https://github.com/${repo}`,
      repoFrom: via,
      commit,
      headVersion: pj.version,
    },
    pj,
  };
}

export function resolvePatchWildcard(
  name: string,
  version: string,
  mirrorDir?: string | null,
): { concrete: string; where: string } | null {
  const m = /^(\d+)\.(\d+)\.x$/.exec(version);
  if (!m) return null;
  const major = m[1];
  const minor = m[2];
  const pat = new RegExp(`^${major}\\.${minor}\\.(\\d+)$`);
  const cands: Array<{ ver: string; patch: number; where: string }> = [];

  // 1. check mirror
  if (mirrorDir && existsSync(mirrorDir)) {
    const files = readdirSync(mirrorDir);
    for (const f of files) {
      if (f.startsWith(`${name}#`) && f.endsWith(".tgz")) {
        const v = f.slice(name.length + 1, -4);
        const pm = pat.exec(v);
        if (pm) {
          cands.push({ ver: v, patch: parseInt(pm[1], 10), where: "mirror" });
        }
      }
    }
  }

  // 2. check npm
  try {
    const res = spawnSync("npm", ["view", name, "versions", "--json", "--registry", NPM_REGISTRY], {
      encoding: "utf-8",
    });
    if (res.status === 0 && res.stdout) {
      const parsed = JSON.parse(res.stdout);
      const list = Array.isArray(parsed) ? parsed : [parsed];
      for (const v of list) {
        if (typeof v === "string") {
          const pm = pat.exec(v);
          if (pm) {
            cands.push({ ver: v, patch: parseInt(pm[1], 10), where: "npm" });
          }
        }
      }
    }
  } catch {}

  if (cands.length === 0) return null;
  cands.sort((a, b) => b.patch - a.patch);
  return { concrete: cands[0].ver, where: cands[0].where };
}

/**
 * A commit `--mirror-commit` accepts: the full 40-character SHA. `git fetch <url> <sha>`
 * cannot resolve an abbreviated SHA on the remote, so a short one used to fail the fetch
 * and silently drop the mirror, and every mirror-only package was then reported missing.
 */
export const FULL_COMMIT = /^[0-9a-f]{40}$/;

export interface SeedOptions {
  cacheDir?: string;
  sushiConfigPath?: string;
  dryRun?: boolean;
  mirror?: string;
  mirrorCommit?: string;
  missingOut?: string;
  templateRepos?: Record<string, string>;
  /** Package-name prefix → `OWNER/REPO[@BRANCH]` of the publisher's site repository. */
  siteRepos?: Record<string, string>;
  /** A package lock (`fhir-packages.lock.json` format): each package it pins is installed from it, verified. */
  lock?: string;
  /** For tests: what fetches a locked tarball. */
  fetchFn?: (url: string) => Promise<Response>;
  wanted?: string[];
  logger?: {
    log: (msg: string) => void;
    error: (msg: string) => void;
  };
  resolveNpmFn?: (name: string, version: string) => { ok: true; data: NpmMeta } | { ok: false; reasons: string[] };
}

export interface SeedResult {
  installed: Array<{ spec: string; how: string }>;
  missing: Array<{ spec: string; why: string }>;
  cacheDir: string;
  exitCode: number;
}

/**
 * Main seeding logic: iteratively processes requested and transitive packages,
 * resolving each from trusted sources or recording it as missing.
 */
export async function seedFhirCache(options: SeedOptions): Promise<SeedResult> {
  const logger = options.logger ?? {
    log: (msg: string) => console.log(msg),
    error: (msg: string) => console.error(msg),
  };

  const cacheDir = resolve(options.cacheDir ? options.cacheDir : join(homedir(), ".fhir", "packages"));
  const dry = !!options.dryRun;
  const sushiConfig = options.sushiConfigPath;
  const mirrorSpec = options.mirror;
  const missingOut = options.missingOut;
  const templateOverrides = options.templateRepos || {};
  const siteRepos = options.siteRepos || {};

  // The lock's packages come first, and each is installed from the lock only.
  const locked = new Map<string, LockedPackage>();
  if (options.lock) {
    try {
      for (const p of parsePackageLock(readFileSync(options.lock, "utf-8"), options.lock)) {
        locked.set(`${p.name}#${p.version}`, p);
      }
    } catch (e) {
      logger.error(e instanceof Error ? e.message : String(e));
      return { installed: [], missing: [], cacheDir, exitCode: 2 };
    }
  }

  const wanted: string[] = [...locked.keys()];
  if (sushiConfig) {
    wanted.push(...parseSushiConfigDeps(sushiConfig));
  }
  if (options.wanted) {
    wanted.push(...options.wanted);
  }

  if (wanted.length === 0) {
    return { installed: [], missing: [], cacheDir, exitCode: 2 };
  }

  const provPath = join(cacheDir, "ast-export-npm-provenance.json");
  let prov: {
    trustAnchor: string;
    packages: Record<string, unknown>;
    wildcards?: Record<string, unknown>;
  } = { trustAnchor: TRUSTED_NPM_PUBLISHER, packages: {} };

  if (existsSync(provPath)) {
    try {
      prov = JSON.parse(readFileSync(provPath, "utf-8"));
    } catch {}
  }

  const workDir = mkdtempSync(join(tmpdir(), "fhir-cache-seed-"));

  // Mirror directory resolution
  let mirrorDir: string | null = null;
  let mirrorCommit: string | null = null;
  if (mirrorSpec) {
    if (existsSync(mirrorSpec) && statSync(mirrorSpec).isDirectory()) {
      mirrorDir = mirrorSpec;
    } else {
      const commit = options.mirrorCommit || remoteCommit(mirrorSpec);
      if (!commit) {
        logger.error(`cannot resolve HEAD commit for mirror ${mirrorSpec}`);
      } else if (!FULL_COMMIT.test(commit)) {
        logger.error(
          `--mirror-commit must be a full 40-character commit SHA, got "${commit}": git cannot fetch an abbreviated SHA from a remote, so the mirror would be skipped`,
        );
      } else {
        const mStage = join(workDir, "mirror");
        mkdirSync(mStage, { recursive: true });
        const init = spawnSync("git", ["init", "-q", mStage]);
        const fetch = spawnSync("git", ["-C", mStage, "fetch", "-q", "--depth", "1", mirrorSpec, commit]);
        const co = spawnSync("git", ["-C", mStage, "checkout", "-q", "--detach", "FETCH_HEAD"]);
        if (init.status === 0 && fetch.status === 0 && co.status === 0) {
          mirrorDir = mStage;
          mirrorCommit = commit;
        } else {
          logger.error(`failed to clone git mirror ${mirrorSpec} at ${commit}`);
        }
      }
    }
  }

  // Template repos list
  const templateRegistry: Record<string, [string, string]> = {};
  for (const [k, v] of Object.entries(templateOverrides)) {
    templateRegistry[k] = [v, "--template-repo"];
  }

  const queue: string[] = [...wanted];
  const seen = new Set<string>();
  const installed: Array<{ spec: string; how: string }> = [];
  const missing: Array<{ spec: string; why: string }> = [];

  while (queue.length > 0) {
    const spec = queue.shift()!;
    if (seen.has(spec)) continue;
    seen.add(spec);

    const hashIdx = spec.indexOf("#");
    if (hashIdx === -1) {
      missing.push({ spec, why: "missing version delimiter '#'" });
      continue;
    }
    const name = spec.slice(0, hashIdx);
    const version = spec.slice(hashIdx + 1);

    if (!validPart(name) || !validPart(version)) {
      missing.push({
        spec,
        why: "refused: a name or version must not start with '-' or hold a path separator or '..'",
      });
      continue;
    }

    if (version.endsWith(".x")) {
      const resolved = resolvePatchWildcard(name, version, mirrorDir);
      if (!resolved) {
        missing.push({ spec, why: `cannot resolve wildcard version '${version}'` });
        continue;
      }
      prov.wildcards = prov.wildcards || {};
      prov.wildcards[spec] = { resolved: resolved.concrete, from: resolved.where };
      installed.push({ spec, how: `wildcard -> ${resolved.concrete} (${resolved.where})` });
      queue.push(`${name}#${resolved.concrete}`);
      continue;
    }

    const dest = join(cacheDir, spec);
    let pj: Record<string, unknown> | null = null;
    const reasons: string[] = [];

    // 0. The lock: the only source for a package it pins. A cache entry is kept only when
    // this seeder installed it from the same pinned hashes; any other is replaced. The
    // lock lists the IG's packages in full, so a locked package's own dependencies are
    // not followed (a package built from an AST may declare none).
    const pin = locked.get(spec);
    if (pin) {
      const had = prov.packages[spec] as Record<string, unknown> | undefined;
      if (
        existsSync(dest) &&
        had?.source === "lock" &&
        had.integrity === (pin.integrity ?? null) &&
        had.sha256 === (pin.sha256 ?? null) &&
        checkCached(dest, name, version) === null
      ) {
        installed.push({ spec, how: "already in cache, installed from the lock" });
        continue;
      }
      const got = await fromLock(pin, options.fetchFn);
      if ("error" in got) {
        missing.push({ spec, why: `refused: lock: ${got.error}` });
        continue;
      }
      if (dry) {
        installed.push({ spec, how: "would install from the lock" });
        continue;
      }
      try {
        unpackTgz(got.data, dest);
      } catch (e) {
        missing.push({ spec, why: `refused: lock: ${e instanceof Error ? e.message : String(e)}` });
        continue;
      }
      prov.packages[spec] = {
        source: "lock",
        lock: options.lock,
        tarball: pin.tarball,
        integrity: pin.integrity ?? null,
        sha256: pin.sha256 ?? null,
      };
      installed.push({ spec, how: "lock, hash verified" });
      continue;
    }

    // 1. Cache
    if (existsSync(dest)) {
      const bad = checkCached(dest, name, version);
      if (bad) {
        missing.push({ spec, why: `refused: ${bad}; remove it and run again` });
        continue;
      }
      try {
        pj = JSON.parse(readFileSync(join(dest, "package", "package.json"), "utf-8"));
        installed.push({ spec, how: "already in cache" });
      } catch (e) {
        missing.push({ spec, why: `cannot read cache package.json: ${e}` });
        continue;
      }
    } else {
      // 2. npm registry
      if (exact(version)) {
        const resolveNpmImpl = options.resolveNpmFn ?? resolveNpm;
        const npmRes = resolveNpmImpl(name, version);
        if (npmRes.ok) {
          if (dry) {
            installed.push({ spec, how: `would install from npm ${npmRes.data.cand}` });
            pj = { dependencies: npmRes.data.meta.dependencies || {} };
          } else {
            try {
              const data = await fetchVerifiedNpm(npmRes.data);
              unpackTgz(data, dest);
              prov.packages[spec] = {
                source: "npm",
                npm: npmRes.data.cand,
                tarball: npmRes.data.tarballUrl,
                integrity: npmRes.data.integrity,
                publishedBy: npmRes.data.publishedBy,
                maintainers: npmRes.data.maintainers,
              };
              installed.push({ spec, how: `npm ${npmRes.data.cand}` });
              pj = JSON.parse(readFileSync(join(dest, "package", "package.json"), "utf-8"));
            } catch (e) {
              reasons.push(`npm: ${e instanceof Error ? e.message : String(e)}`);
            }
          }
        } else {
          reasons.push(`npm: ${npmRes.reasons.join("; ")}`);
        }
      } else {
        reasons.push(`npm: '${version}' is not an exact version`);
      }

      // 3. publisher site repo
      if (pj === null && exact(version)) {
        const siteRes = await fromSite(name, version, siteRepos);
        if (siteRes) {
          if (dry) {
            installed.push({ spec, how: "would install from site" });
            pj = readPackageJsonFromTgz(siteRes.data) || {};
          } else {
            try {
              unpackTgz(siteRes.data, dest);
              prov.packages[spec] = { source: "site", ...siteRes.provenance };
              installed.push({ spec, how: "site" });
              pj = JSON.parse(readFileSync(join(dest, "package", "package.json"), "utf-8"));
            } catch (e) {
              reasons.push(`site: ${e}`);
            }
          }
        } else {
          reasons.push("site: no publisher site repo for this name");
        }
      }

      // 4. mirror
      if (pj === null && exact(version) && mirrorDir) {
        const mRes = fromMirror(mirrorDir, mirrorCommit, name, version);
        if ("data" in mRes) {
          if (dry) {
            installed.push({ spec, how: "would install from mirror" });
            pj = readPackageJsonFromTgz(mRes.data) || {};
          } else {
            try {
              unpackTgz(mRes.data, dest);
              prov.packages[spec] = { source: "mirror", ...mRes.provenance };
              installed.push({ spec, how: "mirror" });
              pj = JSON.parse(readFileSync(join(dest, "package", "package.json"), "utf-8"));
            } catch (e) {
              reasons.push(`mirror: ${e}`);
            }
          }
        } else {
          reasons.push(`mirror: ${mRes.error}`);
        }
      }

      // 5. template repo
      if (pj === null && (name in templateRegistry)) {
        const [tRepo, via] = templateRegistry[name];
        const tRes = fromTemplateRepo(tRepo, name, version, dest, via, workDir);
        if ("pj" in tRes) {
          prov.packages[spec] = { source: "template-repo", ...tRes.provenance };
          installed.push({ spec, how: `template repo ${String(tRes.provenance.commit).slice(0, 8)}` });
          pj = tRes.pj;
        } else {
          reasons.push(`template: ${tRes.error}`);
        }
      }

      if (pj === null) {
        missing.push({ spec, why: reasons.join(" | ") });
        continue;
      }
    }

    // Follow transitive dependencies from package.json recursively
    if (pj && pj.dependencies && typeof pj.dependencies === "object") {
      for (const [dn, dv] of Object.entries(pj.dependencies)) {
        if (typeof dv === "string" || typeof dv === "number") {
          const depSpec = `${dn}#${String(dv).trim()}`;
          if (!seen.has(depSpec)) {
            queue.push(depSpec);
          }
        }
      }
    }
  }

  // Cleanup temporary work directory
  rmSync(workDir, { recursive: true, force: true });

  if (!dry) {
    mkdirSync(cacheDir, { recursive: true });
    writeFileSync(provPath, JSON.stringify(prov, null, 2) + "\n");
  }

  for (const { spec, how } of installed) {
    logger.log(`ok       ${spec}  (${how})`);
  }
  for (const { spec, why } of missing) {
    logger.log(`MISSING  ${spec}  — ${why}`);
  }

  if (missingOut) {
    const parent = dirname(resolve(missingOut));
    mkdirSync(parent, { recursive: true });
    writeFileSync(missingOut, missing.map((m) => `${m.spec}\n`).join(""));
  }

  logger.log(`\n${installed.length} installed or present, ${missing.length} missing. Cache: ${cacheDir}`);
  return {
    installed,
    missing,
    cacheDir,
    exitCode: missing.length > 0 ? 1 : 0,
  };
}

export function parseCliArgs(argv: string[]): SeedOptions & { help?: boolean } {
  let cacheDir: string | undefined;
  let sushiConfigPath: string | undefined;
  let dryRun = false;
  let mirror: string | undefined;
  let mirrorCommit: string | undefined;
  let missingOut: string | undefined;
  const templateRepos: Record<string, string> = {};
  const siteRepos: Record<string, string> = {};
  let lock: string | undefined;
  const wanted: string[] = [];

  const it = argv[Symbol.iterator]();
  let next = it.next();
  while (!next.done) {
    const a = next.value;
    if (a === "-h" || a === "--help") {
      return { help: true };
    } else if (a === "--cache") {
      next = it.next();
      if (!next.done) cacheDir = next.value;
    } else if (a === "--sushi-config") {
      next = it.next();
      if (!next.done) sushiConfigPath = next.value;
    } else if (a === "--dry-run") {
      dryRun = true;
    } else if (a === "--mirror") {
      next = it.next();
      if (!next.done) mirror = next.value;
    } else if (a === "--mirror-commit") {
      next = it.next();
      if (!next.done) mirrorCommit = next.value;
    } else if (a === "--missing-out") {
      next = it.next();
      if (!next.done) missingOut = next.value;
    } else if (a === "--template-repo") {
      next = it.next();
      if (!next.done) {
        const [k, v] = next.value.split("=");
        if (k && v) templateRepos[k] = v;
      }
    } else if (a === "--site-repo") {
      next = it.next();
      if (!next.done) {
        const [k, v] = next.value.split("=");
        if (k && v) siteRepos[k] = v;
      }
    } else if (a === "--lock") {
      next = it.next();
      if (!next.done) lock = next.value;
    } else if (a.includes("#")) {
      wanted.push(a);
    }
    next = it.next();
  }

  return {
    cacheDir,
    sushiConfigPath,
    dryRun,
    mirror,
    mirrorCommit,
    missingOut,
    templateRepos,
    siteRepos,
    lock,
    wanted,
  };
}

if (import.meta.main) {
  const parsed = parseCliArgs(process.argv.slice(2));
  if (parsed.help) {
    console.log(`Seed the FHIR package cache from trusted sources (exact versions).

Usage:
  bun run fhir-harness/scripts/fhir-cache-seed-npm.ts [--cache DIR] [--sushi-config FILE]
                                                     [--mirror DIR|GIT-URL] [--mirror-commit SHA]
                                                     [--missing-out FILE] [--template-repo NAME=OWNER/REPO]
                                                     [--site-repo PREFIX=OWNER/REPO[@BRANCH]]
                                                     [--lock FILE] [--dry-run] [name#version ...]`);
    process.exit(0);
  }
  const res = await seedFhirCache(parsed);
  process.exit(res.exitCode);
}
