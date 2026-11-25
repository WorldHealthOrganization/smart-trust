#!/usr/bin/env bun
/**
 * ensure-software — get the programs and modules the harness's scripts need,
 * instead of stopping at "X is not installed". The tool of the
 * `finding-software` skill.
 *
 * ## What it reads
 *
 * `scripts/software.json` — one entry per thing a script CHECKS FOR, with the
 * ways to get it.
 *
 * ## The ladder, per entry, stopping at the first that works
 *
 * 1. **present** — `command` on PATH, or `python` importable.
 * 2. **apt** — `apt-get install -y --no-install-recommends`, as root or with
 *    passwordless `sudo`; on failure `apt-get update` once, then again.
 * 3. **pip** — `python3 -m pip install` (with `--break-system-packages` when
 *    the interpreter is externally managed).
 * 4. **GitHub release** — the asset for this platform at a PINNED tag, checked
 *    against its sha256 before anything is unpacked, binary into
 *    `~/.local/bin`. No pin, no checksum, no install.
 *
 * Each rung is re-checked by presence, never by exit code alone, and every
 * attempt is reported. A rung the environment does not offer (no apt, not
 * root) is reported as such, not skipped silently.
 *
 * Usage:
 *   bun run cat software:ensure tesseract pdftoppm     # get these
 *   bun run cat software:ensure --for cat-harness-tools/scripts/pdf-ocr.py
 *   bun run cat software:ensure --check                # report only, every entry
 *
 * Exit: 0 everything asked for is present, 1 something is still missing,
 * 2 usage or an unknown name.
 *
 * @module scripts/ensure-software
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

export interface GithubRelease {
  repo: string;
  tag: string;
  /** The file inside the asset to install (or the asset itself, when it is not an archive). */
  bin: string;
  /** Keyed `${process.platform}-${process.arch}`, e.g. `linux-x64`. */
  assets: Record<string, { asset: string; sha256: string }>;
}

export interface SoftwareEntry {
  name: string;
  provides: { command: string } | { python: string };
  apt?: string[];
  pip?: string;
  github?: GithubRelease;
  licence?: string;
  usedBy?: string[];
  why?: string;
}

export type Rung = "present" | "apt" | "pip" | "github";

export interface Attempt {
  rung: Exclude<Rung, "present">;
  outcome: "installed" | "failed" | "not-offered";
  detail: string;
}

export interface EnsureResult {
  name: string;
  /** How it is present now, or `missing`. */
  state: Rung | "missing";
  attempts: Attempt[];
}

/** What the ladder needs from the machine — injected so tests run no installer. */
export interface Machine {
  run(cmd: string, args: string[]): { status: number; out: string };
  platform: string;
  fetch(url: string): Promise<{ ok: boolean; status: number; bytes?: Uint8Array }>;
  binDir: string;
}

export const SOFTWARE_FILE = join(import.meta.dir, "software.json");

export function readSoftware(file = SOFTWARE_FILE): SoftwareEntry[] {
  return (JSON.parse(readFileSync(file, "utf-8")) as { software: SoftwareEntry[] }).software;
}

const realMachine: Machine = {
  run(cmd, args) {
    const r = spawnSync(cmd, args, { encoding: "utf-8", timeout: 900_000 });
    return { status: r.status ?? (r.error ? 127 : 1), out: `${r.stdout ?? ""}${r.stderr ?? ""}${r.error ? String(r.error) : ""}` };
  },
  platform: `${process.platform}-${process.arch}`,
  async fetch(url) {
    try {
      const r = await fetch(url, { redirect: "follow" });
      return r.ok ? { ok: true, status: r.status, bytes: new Uint8Array(await r.arrayBuffer()) } : { ok: false, status: r.status };
    } catch {
      return { ok: false, status: 0 };
    }
  },
  binDir: join(homedir(), ".local", "bin"),
};

export function isPresent(e: SoftwareEntry, m: Machine): boolean {
  if ("command" in e.provides) {
    if (m.run("sh", ["-c", `command -v ${e.provides.command}`]).status === 0) return true;
    // Installed into ~/.local/bin by an earlier GitHub rung, which may not be on PATH yet.
    return existsSync(join(m.binDir, e.provides.command));
  }
  return m.run("python3", ["-c", `import ${e.provides.python}`]).status === 0;
}

const tail = (s: string): string => s.trim().split("\n").slice(-2).join(" / ").slice(0, 300);

function tryApt(e: SoftwareEntry, m: Machine): Attempt {
  if (!e.apt?.length) return { rung: "apt", outcome: "not-offered", detail: "no apt package declared" };
  if (m.run("sh", ["-c", "command -v apt-get"]).status !== 0) return { rung: "apt", outcome: "not-offered", detail: "no apt-get on this machine" };
  const root = m.run("id", ["-u"]).out.trim() === "0";
  const sudo = !root && m.run("sudo", ["-n", "true"]).status === 0;
  if (!root && !sudo) return { rung: "apt", outcome: "not-offered", detail: "not root and no passwordless sudo" };
  const pre = root ? [] : ["sudo", "-n"];
  const apt = (args: string[]) => (pre.length ? m.run(pre[0]!, [...pre.slice(1), "apt-get", ...args]) : m.run("apt-get", args));
  const install = ["install", "-y", "-q", "--no-install-recommends", ...e.apt];
  let r = apt(install);
  if (r.status !== 0) {
    apt(["update", "-q"]);
    r = apt(install);
  }
  if (r.status === 0 && isPresent(e, m)) return { rung: "apt", outcome: "installed", detail: e.apt.join(" ") };
  return { rung: "apt", outcome: "failed", detail: `apt-get install ${e.apt.join(" ")}: ${tail(r.out) || `exit ${r.status}`}` };
}

function tryPip(e: SoftwareEntry, m: Machine): Attempt {
  if (!e.pip) return { rung: "pip", outcome: "not-offered", detail: "no pip package declared" };
  let r = m.run("python3", ["-m", "pip", "install", "-q", e.pip]);
  if (r.status !== 0 && /externally-managed/i.test(r.out)) r = m.run("python3", ["-m", "pip", "install", "-q", "--break-system-packages", e.pip]);
  if (r.status === 0 && isPresent(e, m)) return { rung: "pip", outcome: "installed", detail: e.pip };
  return { rung: "pip", outcome: "failed", detail: `pip install ${e.pip}: ${tail(r.out) || `exit ${r.status}`}` };
}

async function tryGithub(e: SoftwareEntry, m: Machine): Promise<Attempt> {
  const g = e.github;
  if (!g) return { rung: "github", outcome: "not-offered", detail: "no GitHub release declared" };
  const a = g.assets[m.platform];
  if (!a) return { rung: "github", outcome: "not-offered", detail: `no asset declared for ${m.platform} (have: ${Object.keys(g.assets).join(", ")})` };
  if (!/^[0-9a-f]{64}$/.test(a.sha256)) return { rung: "github", outcome: "failed", detail: "the declared sha256 is not a sha256 — refusing an unverified download" };
  const url = `https://github.com/${g.repo}/releases/download/${g.tag}/${a.asset}`;
  const r = await m.fetch(url);
  if (!r.ok || !r.bytes) {
    return { rung: "github", outcome: "failed", detail: `${url} answered ${r.status || "no connection"}${r.status === 403 ? " (egress policy — see blocked-build-dependencies)" : ""}` };
  }
  const got = createHash("sha256").update(r.bytes).digest("hex");
  if (got !== a.sha256) return { rung: "github", outcome: "failed", detail: `${a.asset}: sha256 ${got} is not the declared ${a.sha256} — not installed` };
  const work = mkdtempSync(join(tmpdir(), "ensure-software-"));
  try {
    const file = join(work, a.asset);
    writeFileSync(file, r.bytes);
    let src = file;
    if (/\.(tar\.gz|tgz)$/.test(a.asset)) {
      const x = m.run("tar", ["-xzf", file, "-C", work]);
      if (x.status !== 0) return { rung: "github", outcome: "failed", detail: `tar: ${tail(x.out)}` };
      src = join(work, g.bin);
    } else if (a.asset.endsWith(".zip")) {
      const x = m.run("unzip", ["-q", "-o", file, "-d", work]);
      if (x.status !== 0) return { rung: "github", outcome: "failed", detail: `unzip: ${tail(x.out)}` };
      src = join(work, g.bin);
    }
    if (!existsSync(src)) return { rung: "github", outcome: "failed", detail: `${a.asset} holds no ${g.bin}` };
    mkdirSync(m.binDir, { recursive: true });
    const dest = join(m.binDir, "command" in e.provides ? e.provides.command : g.bin);
    copyFileSync(src, dest);
    chmodSync(dest, 0o755);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
  if (isPresent(e, m)) return { rung: "github", outcome: "installed", detail: `${g.repo}@${g.tag} ${a.asset} (sha256 verified) -> ${m.binDir}` };
  return { rung: "github", outcome: "failed", detail: "installed, but still not found" };
}

/** Walk the ladder for each entry. `checkOnly` reports presence and installs nothing. */
export async function ensureSoftware(entries: SoftwareEntry[], opts: { checkOnly?: boolean; machine?: Machine } = {}): Promise<EnsureResult[]> {
  const m = opts.machine ?? realMachine;
  const out: EnsureResult[] = [];
  for (const e of entries) {
    if (isPresent(e, m)) {
      out.push({ name: e.name, state: "present", attempts: [] });
      continue;
    }
    if (opts.checkOnly) {
      out.push({ name: e.name, state: "missing", attempts: [] });
      continue;
    }
    const attempts: Attempt[] = [];
    let state: EnsureResult["state"] = "missing";
    for (const rung of [tryApt, tryPip, tryGithub]) {
      const a = await rung(e, m);
      attempts.push(a);
      if (a.outcome === "installed") {
        state = a.rung;
        break;
      }
    }
    out.push({ name: e.name, state, attempts });
  }
  return out;
}

/** Pick entries by name, or by a script that uses them. Unknown names are returned, never dropped. */
export function select(all: SoftwareEntry[], names: string[], forScript?: string): { picked: SoftwareEntry[]; unknown: string[] } {
  if (forScript !== undefined) {
    const s = forScript.replace(/^(\.\/)?(cat-harness\/)?/, "");
    return { picked: all.filter((e) => (e.usedBy ?? []).includes(s)), unknown: [] };
  }
  if (names.length === 0) return { picked: all, unknown: [] };
  return { picked: all.filter((e) => names.includes(e.name)), unknown: names.filter((n) => !all.some((e) => e.name === n)) };
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const checkOnly = argv.includes("--check");
  const fi = argv.indexOf("--for");
  const forScript = fi >= 0 ? argv[fi + 1] : undefined;
  if (fi >= 0 && (!forScript || forScript.startsWith("--"))) {
    console.error("--for needs a script path, e.g. --for scripts/pdf-ocr.py");
    process.exit(2);
  }
  const names = argv.filter((a, i) => !a.startsWith("--") && argv[i - 1] !== "--for");
  const all = readSoftware();
  const { picked, unknown } = select(all, names, forScript);
  if (unknown.length) {
    console.error(`not declared in scripts/software.json: ${unknown.join(", ")} — declare it (how to get it, and which script needs it) rather than installing by hand`);
    process.exit(2);
  }
  if (forScript !== undefined && picked.length === 0) {
    console.error(`no entry in scripts/software.json names ${forScript} in usedBy`);
    process.exit(2);
  }
  const results = await ensureSoftware(picked, { checkOnly });
  for (const r of results) {
    console.log(`${r.state === "missing" ? "✗" : "✓"} ${r.name}: ${r.state === "missing" ? "MISSING" : r.state === "present" ? "present" : `installed via ${r.state}`}`);
    for (const a of r.attempts) console.log(`    ${a.rung}: ${a.outcome} — ${a.detail}`);
  }
  const githubInstalled = results.some((r) => r.state === "github");
  if (githubInstalled && !(process.env.PATH ?? "").split(":").includes(realMachine.binDir)) {
    console.log(`  note: ${realMachine.binDir} is not on PATH — export PATH="${realMachine.binDir}:$PATH"`);
  }
  process.exit(results.some((r) => r.state === "missing") ? 1 : 0);
}
