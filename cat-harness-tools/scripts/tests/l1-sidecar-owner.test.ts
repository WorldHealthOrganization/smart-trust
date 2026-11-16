/**
 * An L1 verdict is written under the layer that owns the library entry.
 *
 * In the index checkout the root declares no layer (owner, 2026-10-08),
 * so writing under it put the `library-qa` sidecars in an undeclared
 * `<index>/test/results/` (measured 2026-10-09: 79 files).
 */
import { afterEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { DECLARATION_SUFFIX } from "../../schemas/kg/cat-harness.ts";
import { sidecarRootFor } from "../check-l1-complete.ts";
import { HARNESS_ROOT } from "../lib/roots.ts";

const made: string[] = [];
afterEach(() => {
  for (const d of made.splice(0)) rmSync(d, { recursive: true, force: true });
});

test("an entry's sidecar root is the instance holding its library, not an undeclared checkout root", () => {
  const root = mkdtempSync(join(tmpdir(), "l1-owner-"));
  made.push(root);
  const inst = join(root, "inst");
  mkdirSync(join(inst, "library", "some-entry"), { recursive: true });
  writeFileSync(
    join(inst, `inst${DECLARATION_SUFFIX}`),
    JSON.stringify({
      name: "inst",
      directories: [
        { id: "library", path: "library/", graphTypologies: ["library"] },
        { id: "qa", path: "test/results/", graphTypologies: ["qa"] },
      ],
    }),
  );
  expect(sidecarRootFor(inst, "some-entry")).toBe(inst);
  expect(sidecarRootFor(root, "some-entry")).toBe(inst);
  expect(sidecarRootFor(root, "not-an-entry")).toBe(root);
});

// 49a8e8f: an owner with no `qa` tree cannot hold the verdict, so it goes to
// the checkout root when that declares one, else to the harness.
test("an owner with no qa tree does not get the sidecar", () => {
  const root = mkdtempSync(join(tmpdir(), "l1-owner-noqa-"));
  made.push(root);
  const inst = join(root, "inst");
  mkdirSync(join(inst, "library", "some-entry"), { recursive: true });
  writeFileSync(
    join(inst, `inst${DECLARATION_SUFFIX}`),
    JSON.stringify({ name: "inst", directories: [{ id: "library", path: "library/", graphTypologies: ["library"] }] }),
  );
  expect(sidecarRootFor(inst, "some-entry")).toBe(inst);
  expect(sidecarRootFor(root, "some-entry")).toBe(resolve(HARNESS_ROOT));
});
