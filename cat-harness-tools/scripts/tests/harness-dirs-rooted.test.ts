/**
 * `harness:dirs` in a ROOTED checkout — an IG repository that is its own
 * index (smart-ips-pilgrimage), cat-harness-tools#1701.
 *
 * - A harness's repository-scoped directory the root instance does not
 *   declare is not this checkout's: excused, with a reason, never created.
 *   Declared at the root, or with the harness as the root, it is judged as
 *   before.
 * - The scope-trap guard in `materialiseDirectories` refuses an empty
 *   repository-scoped directory beside an instance directory with content —
 *   unless that instance directory is itself a declared entry (cat-harness's
 *   `uploads` beside its `checkout-uploads`).
 *
 * @module scripts/tests/harness-dirs-rooted
 */
import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { materialiseDirectories, resolveDirectories } from "../../schemas/kg/cat-harness.js";
import { declarationChain } from "../../schemas/kg/harness-config.js";
import { notThisCheckouts } from "../harness-dirs.ts";

const made: string[] = [];
afterEach(() => {
  for (const d of made.splice(0)) rmSync(d, { recursive: true, force: true });
});

function put(root: string, rel: string, body: unknown): void {
  const p = join(root, rel);
  mkdirSync(join(p, ".."), { recursive: true });
  writeFileSync(p, typeof body === "string" ? body : JSON.stringify(body, null, 2));
}

/** A root instance `top` over a harness `h` declaring an instance and a checkout `uploads/`. */
function rooted(opts: { harnessOwnUploads?: boolean; rootDeclaresUploads?: boolean } = {}): string {
  const root = mkdtempSync(join(tmpdir(), "harness-dirs-rooted-"));
  made.push(root);
  put(root, "top.json", {
    name: "top",
    needs: ["h"],
    directories: opts.rootDeclaresUploads ? [{ id: "checkout-uploads", path: "uploads/", graphTypologies: ["uploads"] }] : [],
  });
  put(root, "h/h.json", {
    name: "h",
    needs: [],
    directories: [
      ...(opts.harnessOwnUploads === false ? [] : [{ id: "uploads", path: "uploads/", graphTypologies: ["uploads"] }]),
      { id: "checkout-uploads", path: "uploads/", scope: "repository", graphTypologies: ["uploads"] },
    ],
  });
  put(root, "h/uploads/item.md", "# queued\n");
  return root;
}

const entry = (root: string, id: string) =>
  resolveDirectories(declarationChain(join(root, "h"))).find((d) => d.id === id)!;

describe("notThisCheckouts", () => {
  test("a harness's checkout-level directory the root does not declare is excused, with a reason", () => {
    const root = rooted();
    expect(notThisCheckouts(entry(root, "checkout-uploads"), join(root, "h"))).toContain("top");
  });

  test("declared by the root, it is the checkout's and judged as before", () => {
    const root = rooted({ rootDeclaresUploads: true });
    expect(notThisCheckouts(entry(root, "checkout-uploads"), join(root, "h"))).toBeUndefined();
  });

  test("an instance-scoped entry is never excused", () => {
    const root = rooted();
    expect(notThisCheckouts(entry(root, "uploads"), join(root, "h"))).toBeUndefined();
  });

  test("with the harness as the checkout's root, nothing is excused", () => {
    const root = rooted();
    const h = join(root, "h");
    rmSync(join(root, "top.json"));
    put(h, ".git/HEAD", "ref: refs/heads/main\n"); // h is its own checkout
    expect(notThisCheckouts(entry(root, "checkout-uploads"), h)).toBeUndefined();
  });
});

describe("the scope-trap guard", () => {
  test("a declared instance twin is a second directory on purpose, not a wrong scope", () => {
    const root = rooted();
    const h = join(root, "h");
    expect(() => materialiseDirectories(resolveDirectories(declarationChain(h)), h, { dryRun: true })).not.toThrow();
  });

  test("an undeclared twin with content is still refused", () => {
    const root = rooted({ harnessOwnUploads: false });
    const h = join(root, "h");
    expect(() => materialiseDirectories(resolveDirectories(declarationChain(h)), h, { dryRun: true })).toThrow(/wrong/);
  });
});
