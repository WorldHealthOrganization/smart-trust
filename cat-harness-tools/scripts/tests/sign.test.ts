/**
 * `sign.sh` — YubiKey signing wrapper (cat-harness-tools#1730).
 *
 * CI has no YubiKey, so the tests use a plain ed25519 key file. The script
 * treats it the same way: setup finds an existing key and skips key creation.
 */
import { describe, expect, test } from "bun:test";
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const SCRIPT = resolve(import.meta.dir, "../sign.sh");
const hasSshKeygen = spawnSync("sh", ["-c", "command -v ssh-keygen"]).status === 0;

function sandbox() {
  const root = mkdtempSync(join(tmpdir(), "sign-"));
  const home = join(root, "home");
  const repo = join(root, "repo");
  mkdirSync(join(home, ".ssh"), { recursive: true });
  mkdirSync(repo);
  const env = { ...process.env, HOME: home, GIT_CONFIG_NOSYSTEM: "1" };
  const run = (cmd: string, args: string[]) => spawnSync(cmd, args, { cwd: repo, env, encoding: "utf8" });
  run("git", ["init", "-q"]);
  run("git", ["config", "--global", "user.email", "cat@example.org"]);
  run("git", ["config", "--global", "user.name", "Cat"]);
  run("ssh-keygen", ["-q", "-t", "ed25519", "-N", "", "-f", join(home, ".ssh", "id_ed25519_sk_sign")]);
  const sign = (...args: string[]) => run("bash", [SCRIPT, ...args]);
  return { home, repo, run, sign };
}

describe.skipIf(!hasSshKeygen)("sign.sh", () => {
  test("setup writes allowed_signers and turns on commit signing", () => {
    const { repo, run, sign } = sandbox();
    expect(sign("setup", "--no-github").status).toBe(0);
    const allowed = readFileSync(join(repo, ".signing/allowed_signers"), "utf8");
    expect(allowed).toMatch(/^cat@example\.org namespaces="git,file" ssh-ed25519 /);
    expect(run("git", ["config", "--get", "gpg.format"]).stdout.trim()).toBe("ssh");
    expect(run("git", ["config", "--get", "commit.gpgsign"]).stdout.trim()).toBe("true");
    // Running setup again does not add the key twice.
    expect(sign("setup", "--no-github").status).toBe(0);
    expect(readFileSync(join(repo, ".signing/allowed_signers"), "utf8")).toBe(allowed);
  });

  test("a signed commit verifies", () => {
    const { repo, run, sign } = sandbox();
    sign("setup", "--no-github");
    writeFileSync(join(repo, "x.txt"), "x\n");
    run("git", ["add", "-A"]);
    expect(run("git", ["commit", "-qm", "x"]).status).toBe(0);
    expect(run("git", ["verify-commit", "HEAD"]).status).toBe(0);
  });

  test("file signs, verify passes, and a changed file fails", () => {
    const { repo, run, sign } = sandbox();
    sign("setup", "--no-github");
    const asset = join(repo, "asset.json");
    writeFileSync(asset, '{"a":1}\n');
    expect(sign("file", asset).status).toBe(0);
    expect(existsSync(`${asset}.sig`)).toBe(true);
    run("git", ["add", "-A"]);

    const ok = sign("verify");
    expect(ok.status).toBe(0);
    expect(ok.stdout).toContain("all 1 signatures verified");

    appendFileSync(asset, "tampered\n");
    const bad = sign("verify", asset);
    expect(bad.status).toBe(1);
    expect(bad.stdout).toContain("signature does not match");
  });

  test("a signature by a key not in allowed_signers fails", () => {
    const { home, repo, sign } = sandbox();
    sign("setup", "--no-github");
    const asset = join(repo, "asset.txt");
    writeFileSync(asset, "hello\n");
    const other = join(home, ".ssh", "other");
    spawnSync("ssh-keygen", ["-q", "-t", "ed25519", "-N", "", "-f", other]);
    spawnSync("ssh-keygen", ["-Y", "sign", "-q", "-f", other, "-n", "file", asset]);
    const r = sign("verify", asset);
    expect(r.status).toBe(1);
    expect(r.stdout).toContain("not in");
  });

  test("a file with no .sig fails", () => {
    const { repo, sign } = sandbox();
    sign("setup", "--no-github");
    writeFileSync(join(repo, "lonely.txt"), "x\n");
    const r = sign("verify", join(repo, "lonely.txt"));
    expect(r.status).toBe(1);
    expect(r.stdout).toContain("no ");
  });
});
