import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { NodeKindEntry } from "./node-kind-index";
import { nodesOfKind } from "./node-kind-nodes";

/**
 * Issue #2195: a kind's nodes are the files its typologies' directories hold
 * whose `$schema` the kind ACCEPTS — subclasses included.
 */
const repo = mkdtempSync(join(import.meta.dir, ".tmp-node-kind-nodes-"));
afterAll(() => rmSync(repo, { recursive: true, force: true }));

writeFileSync(
  join(repo, "alpha.json"),
  JSON.stringify({ name: "alpha", version: "0.1.0", directories: [{ id: "items", path: "items/", graphTypologies: ["todo-items"] }] }),
);
mkdirSync(join(repo, "items", "deep"), { recursive: true });
writeFileSync(join(repo, "items", "a.md"), "---\n$schema: todo/1.0.0\nid: a\nrefs:\n  - kind: bean\n    id: b1\n---\nBody.\n");
writeFileSync(join(repo, "items", "deep", "b.json"), JSON.stringify({ $schema: "sub-todo/1.1.0", id: "b" }));
writeFileSync(join(repo, "items", "c.json"), JSON.stringify({ $schema: "todo/2.0.0", id: "c" }));
writeFileSync(join(repo, "items", "d.json"), JSON.stringify({ id: "no-tag" }));
writeFileSync(join(repo, "items", "README.md"), "# not a node\n");

const entry = (id: string, version: string, extra: Partial<NodeKindEntry> = {}): NodeKindEntry => ({
  id, version, tag: `${id}/${version}`, parents: [], subclasses: [], declaredBy: "alpha", holdings: [{ typology: "todo-items" }], ...extra,
});
const index = {
  kinds: [entry("todo", "1.0.0", { subclasses: ["sub-todo"] }), entry("sub-todo", "1.2.0", { parents: ["todo"] })],
};

describe("nodesOfKind", () => {
  const nodes = nodesOfKind(index, "todo", repo);

  test("a kind's page includes its subclasses' nodes, each filed under the kind it IS", () => {
    expect(nodes.map((n) => [n.kind, n.path])).toEqual([
      ["todo", "items/a"],
      ["sub-todo", "items/deep/b"],
    ]);
  });

  test("an earlier minor is accepted; another major, no tag and a plain README are not nodes", () => {
    // deep/b is tagged sub-todo/1.1.0 while the kind is at 1.2.0: an earlier minor, accepted.
    expect(index.kinds.find((k) => k.id === "sub-todo")!.version).toBe("1.2.0");
    expect(nodes.find((n) => n.path === "items/deep/b")).toMatchObject({ kind: "sub-todo", node: { $schema: "sub-todo/1.1.0" } });
    expect(nodes.some((n) => n.path === "items/c" || n.path === "items/d" || n.path === "items/README")).toBe(false);
  });

  test("a subclass's own page does not include its parent's nodes", () => {
    expect(nodesOfKind(index, "sub-todo", repo).map((n) => n.path)).toEqual(["items/deep/b"]);
  });

  test("each node is held by the instance that declares the directory, at a path without its extension", () => {
    expect(nodes[0]).toMatchObject({ harness: "alpha", path: "items/a", file: "items/a.md" });
  });

  test("Markdown front matter is read as YAML, so nested lists of objects survive", () => {
    expect(nodes[0]!.node.refs).toEqual([{ kind: "bean", id: "b1" }]);
  });
});

/**
 * Bean `ujiv` (issue #88): a layer declaration is found by its NAME RULE,
 * a repository-scoped directory is addressed from the repository rather than
 * with `../`, and a directory whose content is off the checkout is not read.
 */
describe("nodesOfKind: name rules, repository scope, off-checkout content", () => {
  const agg = mkdtempSync(join(import.meta.dir, ".tmp-node-kind-nodes-agg-"));
  afterAll(() => rmSync(agg, { recursive: true, force: true }));
  mkdirSync(join(agg, "beta"), { recursive: true });
  writeFileSync(
    join(agg, "beta", "beta.json"),
    JSON.stringify({
      $schema: "cat-harness-declaration/1.0.0",
      name: "beta",
      version: "0.1.0",
      directories: [
        { id: "shared", path: "shared/", scope: "repository", graphTypologies: ["todo-items"] },
        { id: "branched", path: "branched/", source: { kind: "branch", branch: "cat/beta/branched", keyedBy: "tip" }, graphTypologies: ["todo-items"] },
      ],
    }),
  );
  mkdirSync(join(agg, "gamma"), { recursive: true });
  writeFileSync(join(agg, "gamma", "gamma.json"), JSON.stringify({ name: "gamma", version: "0.1.0" }));
  mkdirSync(join(agg, "shared"), { recursive: true });
  writeFileSync(join(agg, "shared", "s.json"), JSON.stringify({ $schema: "todo/1.0.0", id: "s" }));
  mkdirSync(join(agg, "beta", "branched"), { recursive: true });
  writeFileSync(join(agg, "beta", "branched", "m.json"), JSON.stringify({ $schema: "todo/1.0.0", id: "mounted" }));

  const idx = {
    kinds: [
      entry("todo", "1.0.0"),
      entry("cat-harness-declaration", "1.0.0", { holdings: [], foundBy: "instance-declaration" }),
    ],
  };

  test("a repository-scoped directory's node is addressed from the repository, not with ../", () => {
    expect(nodesOfKind(idx, "todo", agg).map((n) => [n.harness, n.path])).toEqual([["beta", "shared/s"]]);
  });

  test("content mounted from a branch is not read: a committed page cannot keep up with its tip", () => {
    expect(nodesOfKind(idx, "todo", agg).some((n) => n.node.id === "mounted")).toBe(false);
  });

  test("an instance declaration is a node by its name rule, and only when tagged", () => {
    expect(nodesOfKind(idx, "cat-harness-declaration", agg).map((n) => [n.harness, n.path, n.file])).toEqual([["beta", "beta", "beta/beta.json"]]);
  });
});
