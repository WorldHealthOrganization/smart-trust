/**
 * Fetched witness projections are re-addressed at fetch time, not published
 * with the links the run that wrote them stamped.
 *
 * The defect (folio-assistant#3186's `stage` job, run 44356612922): the stage
 * fetched `pr/3186/81b0fb6…` (FETCHED-FALLBACK) and published its witness
 * projections from `cat-harness/test/results/witnesses/` as they were. Their
 * `sidecarLinks` had been stamped by 81b0fb6's own run, before #2448, as
 * `blob/main/build/layers/cat-harness/test/results/…`, and
 * `check:qa-result-links --site` refused 220 of them. The docs generator's
 * fresh projections of a mounted layer go to `build/layers/…`, so nothing
 * re-stamped the copied tree.
 *
 * The fixture is that shape: `cat-harness` mounted at `cat-harness/`, its
 * results stored on `cat/cat-harness/qa-reports`, a witness whose sidecars
 * name the build copy (layer-root-relative, as `readWitnessDoc` writes them)
 * and whose links are the stale ones from the log.
 */
import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { judgeProjection, type QaDirDecl } from "../check-qa-result-links.ts";
import { clearMountedCache } from "../lib/layer-output.ts";
import { restampWitnessLinks } from "../qa-site-assets.ts";
import type { QaLocation } from "../qa-store.ts";

const WEB = "https://github.com/litlfred/folio-assistant";
const BRANCH = "cat/cat-harness/qa-reports";
const KEY = "pr/3186/81b0fb6a6bdd1b0aea835be7bff8e03a7a0f530f";
const BLOCK = "test/results/block-qa/docs/source/concepts-harnessed-kg-overview/slide-11.qa.json";
const TRANSLATION = "test/results/translation-qa/docs/concepts/architecture.ru.translation-qa.json";
const W_BLOCK = "cat-harness/test/results/witnesses/concepts-harnessed-kg-overview/slide-11.block.json";
const W_TRANSLATION = "cat-harness/test/results/witnesses/concepts-architecture/page.translation.json";
/** The same projection, as an entry holding the mounted layer's BUILD copy of the tree. */
const W_BUILD_COPY = "build/layers/cat-harness/test/results/witnesses/start-installation/page.translation.json";

const root = mkdtempSync(join(tmpdir(), "qa-restamp-root-"));
const entry = mkdtempSync(join(tmpdir(), "qa-restamp-entry-"));
writeFileSync(join(root, "index.lock.json"), JSON.stringify({ instances: [{ instance: "cat-harness", path: "cat-harness" }] }));

const location: QaLocation = {
  branch: BRANCH,
  keyedBy: "commit",
  declared: true,
  directories: [
    {
      instance: join(root, "cat-harness"),
      id: "qa-results",
      path: "cat-harness/test/results",
      absPath: join(root, "cat-harness/test/results"),
      present: true,
      storage: { branch: BRANCH } as never,
    },
  ],
};
const dirs: QaDirDecl[] = [{ path: "cat-harness/test/results", stored: true }];

/** A projection as 81b0fb6's run wrote it: build-copy sidecars, stale `blob/main` links. */
function stale(sidecar: string) {
  const viaBuild = `../build/layers/cat-harness/${sidecar}`;
  return {
    $schema: "qa-witness/v1",
    family: "block",
    subject: "x",
    sidecars: [viaBuild],
    sidecarLinks: [{ path: `build/layers/cat-harness/${sidecar}`, href: `${WEB}/blob/main/build/layers/cat-harness/${sidecar}`, addressedBy: "main" }],
    state: "pass",
    counts: {},
    criteria: [],
  };
}

function lay(rel: string, doc: unknown) {
  for (const base of [entry, root]) {
    mkdirSync(dirname(join(base, rel)), { recursive: true });
    writeFileSync(join(base, rel), JSON.stringify(doc));
  }
}

beforeEach(() => {
  clearMountedCache();
  lay(W_BLOCK, stale(BLOCK));
  lay(W_TRANSLATION, stale(TRANSLATION));
  lay(W_BUILD_COPY, stale("test/results/translation-qa/docs/start/installation.zh.translation-qa.json"));
  lay("cat-harness/test/results/witnesses/not-a-witness.json", { other: true });
});
afterAll(() => {
  clearMountedCache();
  rmSync(root, { recursive: true, force: true });
  rmSync(entry, { recursive: true, force: true });
});

const read = (rel: string) => JSON.parse(readFileSync(join(root, rel), "utf-8"));

describe("restampWitnessLinks", () => {
  test("the stale projection is what the stage gate refused", () => {
    expect(judgeProjection(read(W_BLOCK), dirs, W_BLOCK).findings.length).toBeGreaterThan(0);
  });

  test("addresses each sidecar at the layer's own path, on the declared branch, at the fetched entry", () => {
    const r = restampWitnessLinks(root, entry, KEY, { repoWeb: WEB, location });
    expect(r).toEqual({ restamped: 3, failed: 0 });
    expect(read(W_BLOCK).sidecarLinks).toEqual([
      { path: `cat-harness/${BLOCK}`, addressedBy: "entry", key: KEY, href: `${WEB}/blob/cat/cat-harness/qa-reports/${KEY}/cat-harness/${BLOCK}` },
    ]);
    expect(read(W_TRANSLATION).sidecarLinks[0].href).toBe(`${WEB}/blob/cat/cat-harness/qa-reports/${KEY}/cat-harness/${TRANSLATION}`);
  });

  test("an entry holding the build copy of the tree resolves the layer logically too", () => {
    restampWitnessLinks(root, entry, KEY, { repoWeb: WEB, location });
    expect(read(W_BUILD_COPY).sidecarLinks[0].path).toBe("cat-harness/test/results/translation-qa/docs/start/installation.zh.translation-qa.json");
  });

  test("every re-stamped projection passes the stage gate's own judge", () => {
    restampWitnessLinks(root, entry, KEY, { repoWeb: WEB, location });
    for (const rel of [W_BLOCK, W_TRANSLATION, W_BUILD_COPY]) {
      const j = judgeProjection(read(rel), dirs, rel);
      expect(j.projection).toBe(true);
      expect(j.findings).toEqual([]);
    }
  });

  test("leaves a JSON file that is not a witness projection alone", () => {
    restampWitnessLinks(root, entry, KEY, { repoWeb: WEB, location });
    expect(read("cat-harness/test/results/witnesses/not-a-witness.json")).toEqual({ other: true });
  });
});
