/**
 * `bootstrap-reading` tests about the WHOLE CHECKOUT, moved here from
 * `cat-harness/schemas/bootstrap-reading.test.ts` (bean `7zz1`, owner ruling
 * 2026-10-06 "Top-level instance"): each reads every layer declaration in
 * the checkout, which only the checkout holds. Standing alone, cat-harness has
 * none of it, and `check:cat-harness-standalone` collects every test in that
 * layer. The rest of that file's tests stay there; every path here is composed
 * from ORIGIN_DIR, the directory they were written in, so nothing they read
 * changed.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { findDeclarationFile, layerRootsIn } from "../../schemas/kg/cat-harness.ts";
import { KnowledgeGraphDeclarationSchema } from "@litlfred/bootstrap-tools/schemas/graph.ts";

/** The directory these tests were written in (`cat-harness/schemas/`): every path below is composed from it exactly as it was before the move, so nothing they read changed. */
const ORIGIN_DIR = join(import.meta.dir, "../../../cat-harness/schemas");

const REPO_ROOT = join(ORIGIN_DIR, "..", "..");

describe("every declaration in this repository is a Knowledge Graph declaration", () => {
  const roots = layerRootsIn(REPO_ROOT);
  test("there are declarations to check", () => expect(roots.length).toBeGreaterThan(3));
  test.each(roots.map((root): [string, string] => [root.slice(REPO_ROOT.length) || "/", root]))(
    "the declaration at %s parses as a Knowledge Graph declaration",
    (_at, root) => {
      const file = join(root, findDeclarationFile(root)!);
      const r = KnowledgeGraphDeclarationSchema.safeParse(JSON.parse(readFileSync(file, "utf-8")));
      expect(r.success ? "ok" : JSON.stringify(r.error.issues.slice(0, 2))).toBe("ok");
    },
  );
});
