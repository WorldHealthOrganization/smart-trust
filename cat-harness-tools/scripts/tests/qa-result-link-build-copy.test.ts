/**
 * A mounted layer's QA evidence, read from its BUILD COPY, is linked at the
 * layer's own path and on the branch its declaration names.
 *
 * The defect (folio-assistant#3186's `stage` job, 226 findings): the witness
 * reader takes a mounted layer's sidecars through the layer output overlay,
 * so `gen-docs-pages` handed `qaResultLinkFor` a path under
 * `build/layers/<instance>/test/results/…`. The link took that path relative
 * to the repository, lost the layer's mount path, missed the `qa` directory's
 * `storage` declaration, and addressed every result as
 * `blob/main/build/layers/…`, a path that is in no repository. It showed only
 * when staging had evidence to link.
 *
 * Here a throwaway checkout mounts one layer, declares its `qa` directory
 * stored, and holds evidence ONLY in the build copy. The link must name the
 * logical path on the declared branch, and the projection those links make
 * must pass the stage gate's own judge (`check:qa-result-links --site`).
 */
import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { judgeProjection, type QaDirDecl } from "../check-qa-result-links.ts";
import { clearMountedCache, LAYER_OUTPUT_ROOT, logicalPathOf, mountedInstances, outputTwinOf } from "../lib/layer-output.ts";
import { qaResultLinkFor } from "../qa-result-link.ts";
import type { QaLocation } from "../qa-store.ts";

const WEB = "https://github.com/litlfred/folio-assistant";
const LAYER = "cat-layer-x";
const MOUNT = "layers/cat-layer-x";
const BRANCH = `cat/${LAYER}/qa-reports`;
const SHA = "941df8d8eb29173e60cd5ed56d02aa8a425bbb56";
const REL = "test/results/block-qa/docs/source/intro/overview.qa.json";

const root = mkdtempSync(join(tmpdir(), "qa-link-build-copy-"));
writeFileSync(join(root, "index.lock.json"), JSON.stringify({ instances: [{ instance: LAYER, path: MOUNT }] }));
// The evidence exists ONLY in the build copy, as on a stage run.
const buildCopy = join(root, LAYER_OUTPUT_ROOT, LAYER, REL);
mkdirSync(join(buildCopy, ".."), { recursive: true });
writeFileSync(buildCopy, "{}\n");
mkdirSync(join(root, MOUNT, "test/results"), { recursive: true });

const location: QaLocation = {
  branch: BRANCH,
  keyedBy: "commit",
  declared: true,
  directories: [
    {
      instance: join(root, MOUNT),
      id: "qa-results",
      path: `${MOUNT}/test/results`,
      absPath: join(root, MOUNT, "test/results"),
      present: true,
      storage: { branch: BRANCH } as never,
    },
  ],
};
const dirs: QaDirDecl[] = location.directories.map((d) => ({ path: d.path, stored: d.storage !== undefined }));
const ctx = { repoRoot: root, repoWeb: WEB, location };

beforeEach(() => clearMountedCache());
afterAll(() => {
  clearMountedCache();
  rmSync(root, { recursive: true, force: true });
});

describe("logicalPathOf", () => {
  test("is the inverse of outputTwinOf for a mounted layer", () => {
    const logical = join(root, MOUNT, REL);
    expect(outputTwinOf(root, logical)).toBe(buildCopy);
    expect(logicalPathOf(root, buildCopy)).toBe(logical);
  });
  test("leaves a path outside the output root, or of an instance not mounted, as it is", () => {
    const elsewhere = join(root, MOUNT, REL);
    expect(logicalPathOf(root, elsewhere)).toBe(elsewhere);
    const unmounted = join(root, LAYER_OUTPUT_ROOT, "not-mounted", REL);
    expect(logicalPathOf(root, unmounted, mountedInstances(root))).toBe(unmounted);
  });
});

describe("a build copy with QA evidence present", () => {
  test("is linked at the layer's path, on its declared branch, under this build's entry", () => {
    const l = qaResultLinkFor(buildCopy, { ...ctx, key: `main/${SHA}` });
    expect(l.path).toBe(`${MOUNT}/${REL}`);
    expect(l.addressedBy).toBe("entry");
    expect(l.href).toBe(`${WEB}/blob/${BRANCH}/main/${SHA}/${MOUNT}/${REL}`);
  });
  test("with no entry known, it opens the declared branch's tip, never blob/main", () => {
    const l = qaResultLinkFor(buildCopy, ctx);
    expect(l.addressedBy).toBe("tip");
    expect(l.href).toBe(`${WEB}/blob/${BRANCH}/index.json`);
  });
  test("links the same as the logical path does", () => {
    expect(qaResultLinkFor(buildCopy, ctx)).toEqual(qaResultLinkFor(join(root, MOUNT, REL), ctx));
  });
});

describe("the stage gate over a projection with evidence", () => {
  const projection = (sidecarLinks: unknown[]) => ({
    $schema: "qa-witness/v1",
    sidecars: [`../../${LAYER_OUTPUT_ROOT}/${LAYER}/${REL}`],
    sidecarLinks,
  });
  test("the links this build makes resolve to the declared qa directory, so the gate finds nothing", () => {
    const l = qaResultLinkFor(buildCopy, { ...ctx, key: `main/${SHA}` });
    expect(dirs.some((d) => l.path === d.path || l.path.startsWith(`${d.path}/`))).toBe(true);
    expect(judgeProjection(projection([l]), dirs, "p.json")).toEqual({ projection: true, findings: [] });
  });
  test("the old build-copy address is what the gate refuses", () => {
    const old = { path: `${LAYER_OUTPUT_ROOT}/${LAYER}/${REL}`, addressedBy: "main", href: `${WEB}/blob/main/${LAYER_OUTPUT_ROOT}/${LAYER}/${REL}` };
    expect(judgeProjection(projection([old]), dirs, "p.json").findings).toHaveLength(1);
  });
});
