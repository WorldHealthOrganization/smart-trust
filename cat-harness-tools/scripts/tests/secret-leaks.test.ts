/**
 * The secret scanner, falsified.
 *
 * Two risks, and the second is the one this epic is about. A scanner that
 * misses a real credential is a bad scanner. A scanner that reports "clean"
 * over a root it never read is the false pass — indistinguishable downstream
 * from a genuinely clean repository.
 */

import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "bun:test";

import { SECRET_PATTERNS, scanRoots, scanTree } from "../check-secret-leaks.ts";

function tree(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "secrets-"));
  mkdirSync(join(root, "src"), { recursive: true });
  for (const [name, body] of Object.entries(files)) writeFileSync(join(root, "src", name), body);
  return root;
}

describe("it finds a credential that announces itself", () => {
  test("a classic GitHub PAT", () => {
    const r = scanTree(tree({ "a.ts": `const t = "ghp_${"a".repeat(36)}";\n` }), ["src"]);
    expect(r.leaks.map((l) => l.pattern)).toEqual(["github-pat-classic"]);
  });

  test("a private key block", () => {
    // Assembled from parts on purpose. Written as a literal, this fixture is a
    // finding in the scanner's own test file — which is how a scanner ends up
    // excluding its tests wholesale and going blind to a real leak in one.
    const marker = ["-".repeat(5), "BEGIN RSA PRIVATE KEY", "-".repeat(5)].join("");
    const r = scanTree(tree({ "k.txt": `${marker}\n` }), ["src"]);
    expect(r.leaks.map((l) => l.pattern)).toEqual(["private-key-block"]);
  });

  test("an AWS access key id", () => {
    const r = scanTree(tree({ "a.yml": `key: AKIA${"B".repeat(16)}\n` }), ["src"]);
    expect(r.leaks.map((l) => l.pattern)).toEqual(["aws-access-key-id"]);
  });

  test("a finding does not itself leak the secret", () => {
    const secret = `ghp_${"c".repeat(36)}`;
    const r = scanTree(tree({ "a.ts": `const t = "${secret}";\n` }), ["src"]);
    expect(r.leaks[0].redacted).not.toContain(secret);
    expect(r.leaks[0].redacted).toContain("…");
  });
});

describe("it is quiet on what this corpus is actually full of", () => {
  test("12-char hashes, git SHAs and @id URIs are not findings", () => {
    const r = scanTree(
      tree({
        "qa.json": JSON.stringify({
          field_hash: { md: "a1b2c3d4e5f6", ts: "0f9e8d7c6b5a" },
          reviewed_sha: "c2f5dee7d4bdc2973d96f1edf5e38dcfb8340d17",
          "@id": "https://litlfred.github.io/folio-assistant/kg/skills/untainted-verification",
        }),
        "b.yml": "  source=orphan-branch\n  path: folio-assistant/scripts/lake-cache\n",
      }),
      ["src"],
    );
    // Measured over the real tree: an entropy detector flags 68,337 of these
    // and zero credentials. Prefix anchoring is why this is empty.
    expect(r.leaks).toEqual([]);
  });
});

describe("could-not-scan is the third state and outranks clean", () => {
  test("a declared root that is not there is reported, never silently skipped", () => {
    const r = scanTree(tree({ "a.ts": "ok\n" }), ["src", "does-not-exist"]);
    expect(r.unreadable).toEqual(["does-not-exist"]);
    // And it is NOT clean, despite zero leaks — the distinction the whole
    // epic turns on.
    expect(r.leaks).toEqual([]);
    expect(r.unreadable.length > 0).toBe(true);
  });
});

describe("the pattern set", () => {
  test("every pattern is prefix-anchored or a literal block — none is entropy", () => {
    // A pattern that matches on shape alone would reintroduce the 100%
    // false-positive rate measured on this corpus.
    for (const { name, re } of SECRET_PATTERNS) {
      const src = re.source;
      const anchored =
        /\\b\(?[A-Za-z_-]{2,}/.test(src) || src.includes("BEGIN") || src.includes("api[_-]?key");
      expect({ name, anchored }).toEqual({ name, anchored: true });
    }
  });
});

describe("scan roots come from the instances present (bean 0r7u)", () => {
  const instance = (root: string, name: string, dirs: Array<[string, string]>) => {
    mkdirSync(join(root, name), { recursive: true });
    writeFileSync(
      join(root, name, `${name}.json`),
      JSON.stringify({
        name,
        version: "0.1.0",
        directories: dirs.map(([id, kind]) => ({ id, path: `${id}/`, graphTypologies: [kind] })),
      }),
    );
    for (const [id] of dirs) mkdirSync(join(root, name, id), { recursive: true });
  };

  test("standalone, with no instance above, only the fixed roots are scanned", () => {
    const root = mkdtempSync(join(tmpdir(), "roots-"));
    expect(scanRoots(root)).toEqual([".github", "cat-harness", "beans", "package.json"]);
  });

  test("an instance's skills and glossary graphs are added; its other graphs are not", () => {
    const root = mkdtempSync(join(tmpdir(), "roots-"));
    instance(root, "acme", [["skills", "skills"], ["glossary", "glossary"], ["library", "library"]]);
    expect(scanRoots(root)).toEqual([".github", "cat-harness", "beans", "package.json", "acme/glossary", "acme/skills"]);
  });

  test("a directory under a fixed root is not scanned twice", () => {
    const root = mkdtempSync(join(tmpdir(), "roots-"));
    instance(root, "cat-harness", [["skills", "skills"]]);
    expect(scanRoots(root)).toEqual([".github", "cat-harness", "beans", "package.json"]);
  });
});
