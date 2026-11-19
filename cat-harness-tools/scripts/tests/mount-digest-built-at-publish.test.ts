/**
 * A remote mount's integrity digest leaves out what the layer declares it
 * builds at publish (`builtAtPublish`), in EVERY directory the lock pins of
 * it, not only when the lock pins the layer root.
 *
 * Found 2026-11-06 (bean `cat-tools-sm8r`): an IG layer is pinned as seven
 * directories (`<ig>/fhir-artifact-index`, `<ig>/document-kinds`,
 * …) and declares `fhir-artifact-index/index.json` built by `ig-index:build`.
 * The declaration was looked for inside each pinned directory and its
 * instance-relative paths compared with directory-relative ones, so it never
 * applied: once `ig-index:build` wrote the index, every later mount check read
 * the IG as edited and refused it, and a local gate run's eight
 * `state:mount` steps all exited 1.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { builtAtPublishOf, coveredFiles, digestOf, withoutBuiltAtPublish } from "../mount-from-lock.ts";

const ROOT = mkdtempSync(join(tmpdir(), "mount-digest-built-"));
afterAll(() => rmSync(ROOT, { recursive: true, force: true }));

function put(rel: string, text: string): void {
  mkdirSync(join(ROOT, rel, ".."), { recursive: true });
  writeFileSync(join(ROOT, rel), text);
}

const decl = (builtAtPublish: unknown[]) =>
  JSON.stringify({ $schema: "cat-harness-declaration/1.0.0", name: "ig", builtAtPublish });

spawnSync("git", ["init", "-q"], { cwd: ROOT });
// An index checkout: the layer `ig` is mounted under it, pinned as several directories.
put("index.lock.json", "{}\n");
put(
  "ig/ig.json",
  decl([
    { path: "fhir-artifact-index/index.json", writer: ["ig-index:build"] },
    { path: "fhir-artifact-index/sidecars/", writer: ["ig-index:build"] },
    { path: "built-whole/", writer: ["x"] },
    // declared-path-literal: a fixture entry written into a temp checkout; it matches this repo's built context only where jsonld:contexts already ran
    { path: "ns/context/v1.jsonld", writer: ["jsonld:contexts"] },
  ]),
);
put("ig/fhir-artifact-index/pinned.json", "{}\n");
put("ig/document-kinds/k.json", "{}\n");
put("ig/built-whole/a.txt", "a\n");
// A layer that declares nothing, next to it: it must borrow no entries.
put("plain/notes/index.json", "{}\n");

describe("builtAtPublishOf", () => {
  test("at the instance root, the entries as declared", () => {
    expect(builtAtPublishOf(join(ROOT, "ig"))).toContain("fhir-artifact-index/index.json");
  });
  test("in a pinned sub-directory, the instance's entries rebased onto it", () => {
    expect(builtAtPublishOf(join(ROOT, "ig/fhir-artifact-index")).sort()).toEqual(["index.json", "sidecars/"]);
    expect(builtAtPublishOf(join(ROOT, "ig/document-kinds"))).toEqual([]);
  });
  test("a directory the instance declares built as a whole excludes all of its files", () => {
    expect(withoutBuiltAtPublish(["a.txt", "b/c.txt"], builtAtPublishOf(join(ROOT, "ig/built-whole")))).toEqual([]);
  });
  test("a directory of an instance with no declaration borrows nothing, and the walk stops at the index", () => {
    expect(builtAtPublishOf(join(ROOT, "plain/notes"))).toEqual([]);
  });
});

describe("the digest of a pinned sub-directory", () => {
  test("is the same before and after its declared outputs are built", () => {
    const dir = join(ROOT, "ig/fhir-artifact-index");
    const before = digestOf(dir);
    put("ig/fhir-artifact-index/index.json", '{"built":true}\n');
    put("ig/fhir-artifact-index/sidecars/a.json", "{}\n");
    expect(digestOf(dir)).toEqual(before);
    expect(coveredFiles(dir)).toEqual(["pinned.json"]);
  });
  test("still moves for an undeclared file, or a changed pinned byte", () => {
    const dir = join(ROOT, "ig/fhir-artifact-index");
    const before = digestOf(dir).treeDigest;
    put("ig/fhir-artifact-index/menu.json", "{}\n");
    expect(digestOf(dir).treeDigest).not.toBe(before);
    rmSync(join(ROOT, "ig/fhir-artifact-index/menu.json"));
    put("ig/fhir-artifact-index/pinned.json", '{"edited":true}\n');
    expect(digestOf(dir).treeDigest).not.toBe(before);
  });
});

// cat-harness-tools#1701: bootstrap declares itself the way bootstrap's own
// layers do, `name` and `needs` with no `$schema`, and declares
// `ns.context.v1.jsonld` built at publish. Only the harness's `$schema` was
// read, so that entry never applied and derive:publish writing the file made
// every later mount check read `bootstrap/ modified`.
describe("a bare `<name>.json` declaration (bootstrap's form)", () => {
  put("boot/boot.json", JSON.stringify({ name: "boot", needs: [], builtAtPublish: [{ path: "ns.context.v1.jsonld", writer: ["jsonld:contexts"] }] }));
  put("boot/pinned.json", "{}\n");
  // A JSON file whose `name` is not its own is not a declaration.
  put("other/data.json", JSON.stringify({ name: "something-else", builtAtPublish: [{ path: "pinned.json" }] }));
  put("other/pinned.json", "{}\n");

  test("its builtAtPublish entries are read", () => {
    expect(builtAtPublishOf(join(ROOT, "boot"))).toEqual(["ns.context.v1.jsonld"]);
  });
  test("so the digest is the same before and after the declared file is built", () => {
    const dir = join(ROOT, "boot");
    const before = digestOf(dir);
    put("boot/ns.context.v1.jsonld", '{"@context":{}}\n');
    expect(digestOf(dir)).toEqual(before);
  });
  test("a JSON file that does not name itself declares nothing", () => {
    expect(builtAtPublishOf(join(ROOT, "other"))).toEqual([]);
  });
});
