/**
 * `init-folio` tests about the WHOLE CHECKOUT, moved here from
 * `cat-harness/scripts/tests/init-folio.test.ts` (bean `7zz1`, owner ruling
 * 2026-10-06 "Top-level instance"): each scaffolds against the adapters
 * folio-assistant-core and folio-assistant-sci hold, which only the checkout
 * holds. Standing alone, cat-harness has none of it, and
 * `check:cat-harness-standalone` collects every test in that layer. The rest
 * of that file's tests stay there; every path here is composed from
 * ORIGIN_DIR, the directory they were written in, so nothing they read
 * changed.
 */
import { describe, test, expect, afterEach } from "bun:test";
import { mkdtempSync, rmSync, readFileSync, symlinkSync } from "fs";
import { join, resolve } from "path";
import { tmpdir } from "os";

import {
  initFolio,
  remotePlatformLayers,
  type InitFolioOptions,
} from "../../scripts/init-folio.ts";
import { declarationChain, resolveSkillDirs } from "../../schemas/kg/harness-config.js";
import { notApplicableAlone } from "../support/checkout.js";

/** The directory these tests were written in (`cat-harness/scripts/tests/`): every path below is composed from it exactly as it was before the move, so nothing they read changed. */
const ORIGIN_DIR = join(import.meta.dir, "../../../cat-harness/scripts/tests");

/**
 * The scaffold names its config after the folio's SLUG, not after the temp
 * directory it happens to land in. A fixture helper that composes the name
 * from `basename(dir)` is right for a fixture that declares itself and wrong
 * here, because `folio_init` is the thing under test and it writes the
 * declaration too.
 */
const SLUG = "cold-chain-guidance";
/**
 * The scaffold's config: INLINE in its `index.config.json` entry (bean `ymvt`
 * — `folio_init` writes no `<slug>.config.json`), minus the index's own keys.
 */
function scaffoldConfig(dir: string): Record<string, unknown> {
  const idx = JSON.parse(readFileSync(join(dir, "index.config.json"), "utf-8")) as { instances: Array<Record<string, unknown>> };
  const entry = idx.instances.find((e) => e.name === SLUG);
  if (entry === undefined) throw new Error(`index.config.json lists no ${SLUG}`);
  const { name: _n, source: _s, import: _i, _comment: _c, ...config } = entry;
  return config;
}

/**
 * The platform as a folio links it: the REPOSITORY root, which contains
 * `cat-harness/`.
 *
 * Bean `b963`. This read `resolve(ORIGIN_DIR, "../..")`, which was the
 * repository root while these tests lived at `scripts/tests/` and silently
 * became the `cat-harness/` directory when they moved to
 * `cat-harness/scripts/tests/`. The test went on passing — by modelling a
 * layout that no longer exists, and thereby asserting that `init-folio` should
 * emit the pre-split paths.
 *
 * What a folio actually does is `git submodule add …/folio-assistant.git
 * folio-assistant`, so the linked directory is the repository root and the
 * platform's code is under `cat-harness/` inside it.
 */
const REPO_ROOT = resolve(ORIGIN_DIR, "../../..");
const dirs: string[] = [];

function tmp(): string {
  const d = mkdtempSync(join(tmpdir(), "folio-init-"));
  dirs.push(d);
  return d;
}

afterEach(() => {
  while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true });
});

function opts(dir: string, over: Partial<InitFolioOptions> = {}): InitFolioOptions {
  return {
    targetDir: dir,
    contentType: "document",
    slug: "cold-chain-guidance",
    title: "Cold Chain Guidance",
    authors: ["A. Author"],
    link: "sibling",
    assistantPath: "folio-assistant",
    skipVcs: true,
    ...over,
  };
}

describe("what gets written", () => {

  test("the config selects the adapter matching the content type", () => {
    // `toBe`, not `toContain`, and that is the whole point of this test now.
    //
    // It pinned the SUBSTRINGS `adapters/document/index.ts` and
    // `adapters/paper/index.ts` until 2026-09-30, and both survive a wrong
    // answer: when `adapters/paper/` moved to `folio-assistant-sci/` (bean
    // `y5si`), the old composed path
    // `./folio-assistant/cat-harness/adapters/paper/index.ts` still contained
    // its substring while naming a file that does not exist. A gate that
    // cannot tell the right path from the broken one is not covering the
    // thing it looks like it covers, so each full path is written out.
    //
    // The two differ in their LAYER, which is the fact worth pinning, and
    // since 2026-09-30 NEITHER is under `cat-harness/`: `document` under
    // `folio-assistant-core/` (bean `ybp4`, step 2 of the adapters closure)
    // and `paper` under `folio-assistant-sci/` (bean `y5si`, step 1). That is
    // the whole closure — the escape axis reads 0 because the harness no
    // longer holds an adapter that imports upward.
    //
    // This assertion is why `toBe` replaced `toContain`, and it earned that on
    // the very next move: the document path changed layer, and a substring
    // pin on `adapters/document/index.ts` would have passed over it silently.
    // A change that re-composes both from one template breaks this line.
    const doc = tmp();
    initFolio(opts(doc));
    const docCfg = scaffoldConfig(doc);
    expect(docCfg.contentType).toBe("document");
    expect(docCfg.adapterModule).toBe("./folio-assistant/folio-assistant-core/adapters/document/index.ts");
    // The document entry's `module` now starts `../` too, exactly as paper's
    // does, so it has to RESOLVE rather than carry the segment through.
    expect(docCfg.adapterModule).not.toContain("..");

    const pap = tmp();
    initFolio(opts(pap, { contentType: "paper" }));
    const papCfg = scaffoldConfig(pap);
    expect(papCfg.contentType).toBe("paper");
    expect(papCfg.adapterModule).toBe("./folio-assistant/folio-assistant-sci/adapters/paper/index.ts");
  });

  test("the adapter path is normalised, and a non-default link path is honoured", () => {
    // The paper entry's `module` in `BUILTIN_ADAPTERS` starts `../`, because
    // it is relative to `cat-harness/`. Joining it to the link path has to
    // RESOLVE that segment rather than leave it in the string: a config
    // carrying `vendor/fa/cat-harness/../folio-assistant-sci/...` resolves to
    // the same file, but it reads as a mistake and would not survive anyone
    // tidying it by hand.
    const d = tmp();
    initFolio(opts(d, { contentType: "paper", assistantPath: "vendor/fa" }));
    const cfg = scaffoldConfig(d);
    expect(cfg.adapterModule).toBe("./vendor/fa/folio-assistant-sci/adapters/paper/index.ts");
    expect(cfg.adapterModule).not.toContain("..");
  });
});

describe("a scaffold says what it stands on (zmdo)", () => {
  const chainNames = (d: string) => declarationChain(d).map((c) => c.name);
  const skillRoots = (d: string) => resolveSkillDirs(d).map((x) => x.split("/").slice(-2).join("/"));

  test("a document folio stands on its adapter's instance, folio-assistant-core", () => {
    const d = tmp();
    initFolio(opts(d));
    const config = scaffoldConfig(d);
    expect(config.dependencies).toEqual({
      folioAssistant: [{ name: "folio-assistant-core", path: "folio-assistant/folio-assistant-core" }],
    });
    symlinkSync(REPO_ROOT, join(d, "folio-assistant"));
    const chain = chainNames(d);
    expect(chain).toContain("folio-assistant-core");
    expect(chain).toContain("cat-harness");
    expect(skillRoots(d)).toContain("folio-assistant-core/skills");
  });

  test("a paper folio stands on folio-assistant-sci; a sibling link path is honoured", () => {
    const d = tmp();
    initFolio(opts(d, { contentType: "paper", link: "sibling", assistantPath: "../platform" }));
    const config = scaffoldConfig(d);
    expect(config.dependencies).toEqual({
      folioAssistant: [{ name: "folio-assistant-sci", path: "../platform/folio-assistant-sci" }],
    });
  });
});

/**
 * The document and paper adapters are declared by folio-assistant-core and
 * folio-assistant-sci, which only a composed checkout holds; standing alone
 * the derivation has no adapter to read (its logic is pinned over fixtures
 * in scripts/tests/init-folio.test.ts).
 */
const NO_CONTENT_ADAPTERS = notApplicableAlone(
  "folio-assistant-core and folio-assistant-sci, whose declared document and paper adapters these remote mounts are derived from",
);

describe("remote mounts derived from the checkout's declarations (--link remote)", () => {
  // Pins the derivation against the composed checkout: the same list, in the
  // same order, as the names init-folio used to hard-code.
  const PLATFORM = ["cat-harness", "cat-harness-tools", "bootstrap", "bootstrap-tools"];
  test.skipIf(NO_CONTENT_ADAPTERS)("a document folio mounts the platform and the document adapter's instance", () => {
    expect(remotePlatformLayers("document")).toEqual([...PLATFORM, "folio-assistant-core"]);
  });
  test.skipIf(NO_CONTENT_ADAPTERS)("a paper folio mounts the paper adapter's instance after what it needs", () => {
    expect(remotePlatformLayers("paper")).toEqual([...PLATFORM, "folio-assistant-core", "folio-assistant-sci"]);
  });
  test("a contentless instance mounts the platform alone", () => {
    expect(remotePlatformLayers(undefined)).toEqual(PLATFORM);
  });
});
