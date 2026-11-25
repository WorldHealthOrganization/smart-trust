/**
 * `schemeOwner`: a source in a layer mounted from another repository that the
 * declaring layer does not need is a citation, and the scheme stays the
 * declaring layer's.
 *
 * A folio's scheme of organizations cited the library layer it mounts for its
 * documents. Credited to that layer, its IRIs were minted in a namespace whose
 * site is built from a repository that never holds the folio's file: all 17
 * terms were 404s (2026-11-23). A layer the declarer needs is the stack it
 * extends, and keeps its vocabulary.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { clearMountedCache } from "../lib/layer-output.ts";
import { repositoryRoots, schemeOwner, type InstanceRoot } from "../lib/scheme-owner.ts";

const declaration = (name: string, needs?: string[]) =>
  JSON.stringify({ $schema: "cat-harness-declaration/1.0.0", name, title: name, version: "0.1.0", ...(needs ? { needs } : {}), directories: [] });

/**
 * A checkout: the host layer `hb` at the root with a sub-layer `sub`, and two
 * layers mounted from other repositories: `lib`, which `hb` does not need, and
 * `base`, which it does.
 */
function checkout(): { repo: string; owners: InstanceRoot[] } {
  const repo = mkdtempSync(join(tmpdir(), "scheme-owner-"));
  const files: Record<string, string> = {
    "hb.json": declaration("hb", ["base"]),
    "sub/sub.json": declaration("sub"),
    "lib/lib.json": declaration("lib"),
    "base/base.json": declaration("base"),
    "library/doc/a.md": "",
    "sub/schemas/x.ts": "",
    "lib/library/doc/b.md": "",
    "base/schemas/role.ts": "",
    "index.lock.json": JSON.stringify({ instances: [{ instance: "lib", path: "lib" }, { instance: "base", path: "base" }] }),
  };
  for (const [f, body] of Object.entries(files)) {
    mkdirSync(join(repo, f, ".."), { recursive: true });
    writeFileSync(join(repo, f), body);
  }
  clearMountedCache();
  // Longest root first, as instanceRoots returns them.
  const owners = [
    { root: join(repo, "base"), name: "base" },
    { root: join(repo, "lib"), name: "lib" },
    { root: join(repo, "sub"), name: "sub" },
    { root: repo, name: "hb" },
  ];
  return { repo, owners };
}

const scheme = (over: { source?: string; terms?: Array<{ id: string; source?: string }> }) => ({ terms: [], ...over });

describe("schemeOwner across repositories", () => {
  test("repositoryRoots: the checkout and each mount, longest first", () => {
    const { repo } = checkout();
    expect(repositoryRoots(repo)).toEqual([join(repo, "base"), join(repo, "lib"), repo]);
  });

  test("a scheme whose source is in a mounted layer the declarer does not need is the declaring layer's", () => {
    const { repo, owners } = checkout();
    expect(schemeOwner(repo, scheme({ source: "lib/library/doc/" }), "hb", owners)).toEqual({ owner: "hb" });
  });

  test("terms sourced in such a layer are the declaring layer's too, not a second owner", () => {
    const { repo, owners } = checkout();
    const terms = [
      { id: "a", source: "lib/library/doc/b.md" },
      { id: "b", source: "library/doc/a.md" },
    ];
    expect(schemeOwner(repo, scheme({ terms }), "hb", owners)).toEqual({ owner: "hb" });
  });

  test("a mounted layer the declarer needs keeps what it holds", () => {
    const { repo, owners } = checkout();
    expect(schemeOwner(repo, scheme({ source: "base/schemas/role.ts" }), "hb", owners)).toEqual({ owner: "base" });
  });

  test("within one repository a sub-layer still owns what it holds (owner, 2026-09-24)", () => {
    const { repo, owners } = checkout();
    expect(schemeOwner(repo, scheme({ source: "sub/schemas/x.ts" }), "hb", owners)).toEqual({ owner: "sub" });
    expect(schemeOwner(repo, scheme({ terms: [{ id: "a", source: "sub/schemas/x.ts" }] }), "hb", owners)).toEqual({ owner: "sub" });
  });

  test("a mounted layer's own scheme stays its own", () => {
    const { repo, owners } = checkout();
    expect(schemeOwner(repo, scheme({ source: "lib/library/doc/" }), "lib", owners)).toEqual({ owner: "lib" });
  });

  test("a mounted layer declaring a scheme about the host repository keeps it", () => {
    const { repo, owners } = checkout();
    expect(schemeOwner(repo, scheme({ source: "library/doc/a.md" }), "lib", owners)).toEqual({ owner: "lib" });
  });

  test("read as one repository (`[repo]`), the source's layer, as before", () => {
    const { repo, owners } = checkout();
    expect(schemeOwner(repo, scheme({ source: "lib/library/doc/" }), "hb", owners, [repo])).toEqual({ owner: "lib" });
  });
});
