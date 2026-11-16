/**
 * The address of a QA result, bean `bejf` (issue #2217).
 *
 * The panel linked `blob/main/` + an instance-relative path, so every QA result
 * link on the site was a 404. These pin the rule in both of its halves, the
 * path and the branch, and the choice of entry, over plain inputs. The real
 * declaration is asked once, read-only, to pin that this repository's derived
 * results ARE stored (so a `blob/main` link to one is wrong by declaration).
 */
import { describe, expect, test } from "bun:test";
import { join } from "node:path";

import { repoRootFor } from "../../schemas/kg/cat-harness.ts";
import { linkKeyFromFetchState, qaResultHref, qaResultLinkFor, siteFetchStatePath, siteLinkKey } from "../qa-result-link.ts";
import { HARNESS_ROOT } from "../lib/roots.ts";
import { resolveQaLocation } from "../qa-store.ts";

const WEB = "https://github.com/litlfred/folio-assistant";
const BRANCH = "cat/cat-harness/qa-reports";
const SHA = "941df8d8eb29173e60cd5ed56d02aa8a425bbb56";
const PATH = "cat-harness/test/results/translation-qa/docs/index.ar.translation-qa.json";

describe("qaResultHref", () => {
  test("a stored result with a known entry is addressed on the branch, under that entry", () => {
    const l = qaResultHref({ repoWeb: WEB, repoPath: PATH, storedOn: BRANCH, key: `main/${SHA}` });
    expect(l).toEqual({
      path: PATH,
      addressedBy: "entry",
      key: `main/${SHA}`,
      href: `${WEB}/blob/${BRANCH}/main/${SHA}/${PATH}`,
    });
  });

  test("a PR entry is addressed the same way", () => {
    const l = qaResultHref({ repoWeb: WEB, repoPath: PATH, storedOn: BRANCH, key: `pr/12/${SHA}` });
    expect(l.href).toBe(`${WEB}/blob/${BRANCH}/pr/12/${SHA}/${PATH}`);
  });

  test("a stored result with no entry known opens the tip's index, and says so", () => {
    const l = qaResultHref({ repoWeb: WEB, repoPath: PATH, storedOn: BRANCH });
    expect(l.addressedBy).toBe("tip");
    expect(l.href).toBe(`${WEB}/blob/${BRANCH}/index.json`);
  });

  test("a result in a directory that declares no storage keeps its main address", () => {
    const l = qaResultHref({ repoWeb: WEB, repoPath: "x/test/results/a.json", storedOn: undefined, key: `main/${SHA}` });
    expect(l).toEqual({ path: "x/test/results/a.json", addressedBy: "main", href: `${WEB}/blob/main/x/test/results/a.json` });
  });

  test("a stored result never gets a blob/main href, whatever the inputs", () => {
    for (const key of [undefined, `main/${SHA}`, `pr/3/${SHA}`]) {
      const l = qaResultHref({ repoWeb: WEB, repoPath: PATH, storedOn: BRANCH, key });
      expect(l.href).not.toContain("/blob/main/");
    }
  });

  test("no forge: no href rather than a guessed one", () => {
    expect(qaResultHref({ repoWeb: undefined, repoPath: PATH, storedOn: BRANCH, key: `main/${SHA}` }).href).toBeUndefined();
    expect(qaResultHref({ repoWeb: undefined, repoPath: PATH, storedOn: undefined }).href).toBeUndefined();
  });

  test("a trailing slash or .git on the forge URL does not leak into the href", () => {
    expect(qaResultHref({ repoWeb: `${WEB}.git`, repoPath: PATH, storedOn: undefined }).href).toBe(`${WEB}/blob/main/${PATH}`);
    expect(qaResultHref({ repoWeb: `${WEB}/`, repoPath: PATH, storedOn: undefined }).href).toBe(`${WEB}/blob/main/${PATH}`);
  });

  test("segments are percent-encoded, separators are not", () => {
    const l = qaResultHref({ repoWeb: WEB, repoPath: "a b/c#d.json", storedOn: undefined });
    expect(l.href).toBe(`${WEB}/blob/main/a%20b/c%23d.json`);
  });

  test("a path that is not repo-relative is refused, not composed (the instance-relative defect)", () => {
    expect(() => qaResultHref({ repoWeb: WEB, repoPath: "../smart-base/test/results/x.json", storedOn: BRANCH })).toThrow();
  });

  test("a key that is a search (main, a prefix) is refused: an address names one entry", () => {
    expect(() => qaResultHref({ repoWeb: WEB, repoPath: PATH, storedOn: BRANCH, key: "main" })).toThrow();
    expect(() => qaResultHref({ repoWeb: WEB, repoPath: PATH, storedOn: BRANCH, key: "main/941df8d" })).toThrow();
  });
});

describe("linkKeyFromFetchState: the entry the page's evidence came from", () => {
  const main = `main/${SHA}`;
  test("fetched: the entry read", () => {
    expect(linkKeyFromFetchState({ source: "fetched", requested: [main, "main"], key: main })).toBe(main);
  });
  test("fetched-fallback: the fallback entry read, which IS the evidence shown", () => {
    const other = `main/${"a".repeat(40)}`;
    expect(linkKeyFromFetchState({ source: "fetched-fallback", requested: [main, "main"], key: other })).toBe(other);
  });
  test("checkout: the build's own ref, because the checkout IS that commit's evidence", () => {
    expect(linkKeyFromFetchState({ source: "checkout", requested: [main, "main"] })).toBe(main);
    // A fallback hit is another commit, not the checkout's evidence.
    const other = `main/${"b".repeat(40)}`;
    expect(linkKeyFromFetchState({ source: "checkout", requested: [main, "main"], key: other })).toBe(main);
  });
  test("checkout with no full key requested (a dispatch run asks for `main`): unknown", () => {
    expect(linkKeyFromFetchState({ source: "checkout", requested: ["main"] })).toBeUndefined();
  });
  test("unavailable: nothing to name", () => {
    expect(linkKeyFromFetchState({ source: "unavailable", requested: [main] })).toBeUndefined();
  });
});

describe("where the state is read from", () => {
  test("CI's RUNNER_TEMP, or an explicit QA_SITE_STATE, and nothing local by default", () => {
    expect(siteFetchStatePath({ RUNNER_TEMP: "/r" })).toBe(join("/r", "qa-site-assets.state.json"));
    expect(siteFetchStatePath({ QA_SITE_STATE: "/s.json", RUNNER_TEMP: "/r" })).toBe("/s.json");
    // A local run does not pick up a stray state file from the temp directory.
    expect(siteLinkKey({})).toBeUndefined();
  });
});

describe("this repository's declaration", () => {
  test("its derived translation results are stored, so their link is on the branch, never blob/main", () => {
    const instance = join(HARNESS_ROOT);
    const repoRoot = repoRootFor(instance);
    const l = qaResultLinkFor(join(repoRoot, PATH), {
      repoRoot,
      repoWeb: WEB,
      key: `main/${SHA}`,
    });
    expect(l.path).toBe(PATH);
    expect(l.addressedBy).toBe("entry");
    expect(l.href).toBe(`${WEB}/blob/${BRANCH}/main/${SHA}/${PATH}`);
  });
  test("a location resolved once and passed in gives the same address as resolving per call (#871)", () => {
    const repoRoot = repoRootFor(join(HARNESS_ROOT));
    const location = resolveQaLocation(repoRoot);
    const ctx = { repoRoot, repoWeb: WEB, key: `main/${SHA}` };
    for (const p of [PATH, "cat-harness/docs/index.md"]) {
      expect(qaResultLinkFor(join(repoRoot, p), { ...ctx, location })).toEqual(qaResultLinkFor(join(repoRoot, p), ctx));
    }
  });
});
