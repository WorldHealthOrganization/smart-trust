/**
 * A layer that declares a kind in its OWN `typologies/` graph and uses it in
 * its own declaration is readable at a pin (2026-11-14: dth-hrh re-pinning
 * smart-base main, whose `l1-extraction` kind lives in smart-base/typologies/,
 * was refused as "declares unknown graph typology").
 */
import { afterAll, describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { RemoteTree } from "../remote-tree.ts";
import { upstreamDirectories } from "../upstream-directories.ts";

const repo = mkdtempSync(join(tmpdir(), "own-kinds-"));
const git = (...a: string[]) => execFileSync("git", a, { cwd: repo, encoding: "utf-8" }).trim();
const write = (p: string, v: unknown) => {
  mkdirSync(join(repo, p, ".."), { recursive: true });
  writeFileSync(join(repo, p), JSON.stringify(v, null, 2));
};
write("fx/fx.json", {
  $schema: "cat-harness-declaration/1.0.0",
  version: "0.1.0",
  name: "fx",
  directories: [
    { id: "fx-typologies", path: "typologies/", description: "fx's own kinds", graphTypologies: ["typologies"] },
    { id: "fx-things", path: "things/", description: "uses fx's own kind", graphTypologies: ["fx-own-kind"] },
  ],
});
write("fx/typologies/fx-own-kind.json", {
  $schema: "folio-graph-typology/v1",
  kind: "fx-own-kind",
  title: "fx own kind",
  renderable: false,
  holds: "derived",
  summary: "A kind only fx declares.",
  validatorNotApplicable: "A fixture.",
});
mkdirSync(join(repo, "fx/things"), { recursive: true });
writeFileSync(join(repo, "fx/things/.keep"), "");
git("init", "-q");
git("add", "-A");
git("-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", "fixture");
const sha = git("rev-parse", "HEAD");

afterAll(() => rmSync(repo, { recursive: true, force: true }));

describe("upstreamDirectories: a layer's own kinds", () => {
  test("a directory of a kind the layer declares itself is read at the pin", () => {
    const tree = RemoteTree.open("fixture/fx", sha, { urlFor: () => repo });
    try {
      const r = upstreamDirectories(tree, "fx", "fx/fx.json");
      if (!r.ok) throw new Error(r.detail);
      expect(r.directories.map((d) => d.id)).toContain("fx-things");
    } finally {
      tree.close();
    }
  });
});
