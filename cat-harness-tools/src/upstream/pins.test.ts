/**
 * The three states, and the two ways the middle one is got wrong.
 *
 * @module src/upstream/pins.test
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  assessPin,
  compareVersions,
  exitCode,
  locatePins,
  missingFileVerdict,
  readPin,
  releases,
  render,
  type PinDef,
  type PinRegistry,
} from "./pins.js";

const THEME: PinDef = {
  id: "just-the-docs",
  title: "just-the-docs Jekyll theme",
  repo: "https://github.com/just-the-docs/just-the-docs",
  pinnedIn: "docs/_config.yml",
  pattern: "^remote_theme:\\s*just-the-docs/just-the-docs@(\\S+)\\s*$",
  tagPattern: "^v\\d+\\.\\d+\\.\\d+$",
};

const TAGS = ["v0.9.0", "v0.10.0", "v0.10.1", "v0.11.2", "v0.12.0", "v0.4.0.rc1"];

describe("readPin", () => {
  test("reads the ref out of the file the build reads", () => {
    const yml = "title: x\nremote_theme: just-the-docs/just-the-docs@v0.12.0\nbaseurl: /y\n";
    expect(readPin(yml, THEME.pattern)).toBe("v0.12.0");
  });

  test("an UNPINNED line does not match, so the caller reports unknown", () => {
    const yml = "remote_theme: just-the-docs/just-the-docs\n";
    expect(readPin(yml, THEME.pattern)).toBeUndefined();
  });

  test("a commented-out pin is not read as the pin", () => {
    const yml = "# remote_theme: just-the-docs/just-the-docs@v0.11.0\nremote_theme: just-the-docs/just-the-docs@v0.12.0\n";
    expect(readPin(yml, THEME.pattern)).toBe("v0.12.0");
  });
});

describe("compareVersions", () => {
  // The trap: lexicographically "v0.9.0" > "v0.12.0", which is how a sorted
  // tag list announces the wrong newest release. Measured against the real
  // upstream on 2026-09-19 — `git ls-remote --tags | tail` ends at v0.9.0
  // while the newest release is v0.12.0.
  test("orders numerically, not lexicographically", () => {
    expect(compareVersions("v0.9.0", "v0.12.0")).toBe(-1);
    expect(compareVersions("v0.12.0", "v0.9.0")).toBe(1);
    expect(compareVersions("v0.12.0", "v0.12.0")).toBe(0);
  });

  test("an unparseable tag never sorts newest", () => {
    expect(compareVersions("nightly", "v0.1.0")).toBe(-1);
  });
});

describe("releases", () => {
  test("keeps only what tagPattern admits, oldest first", () => {
    expect(releases(TAGS, THEME.tagPattern)).toEqual(["v0.9.0", "v0.10.0", "v0.10.1", "v0.11.2", "v0.12.0"]);
  });
});

describe("assessPin", () => {
  test("at the newest release is current", () => {
    const v = assessPin(THEME, "v0.12.0", TAGS);
    expect(v.state).toBe("current");
    expect(v.behindBy).toEqual([]);
  });

  test("behind reports every release in between, oldest first", () => {
    const v = assessPin(THEME, "v0.10.0", TAGS);
    expect(v.state).toBe("behind");
    expect(v.behindBy).toEqual(["v0.10.1", "v0.11.2", "v0.12.0"]);
    expect(v.latest).toBe("v0.12.0");
  });

  test("an unreachable remote is unknown, NEVER current", () => {
    const v = assessPin(THEME, "v0.12.0", undefined);
    expect(v.state).toBe("unknown");
    expect(v.detail).toContain("could not read tags");
  });

  test("a pattern that matched nothing is unknown, not 'unpinned'", () => {
    const v = assessPin(THEME, undefined, TAGS);
    expect(v.state).toBe("unknown");
    expect(v.detail).toContain("drifted");
  });

  test("a ref upstream does not list is unknown, not behind by everything", () => {
    const v = assessPin(THEME, "ba03257", TAGS);
    expect(v.state).toBe("unknown");
    expect(v.behindBy).toBeUndefined();
  });

  test("no tag matches the pattern at all", () => {
    const v = assessPin(THEME, "v0.12.0", ["nightly", "latest"]);
    expect(v.state).toBe("unknown");
  });
});

describe("exitCode", () => {
  test("unknown outranks behind, and both outrank current", () => {
    const cur = assessPin(THEME, "v0.12.0", TAGS);
    const behind = assessPin(THEME, "v0.10.0", TAGS);
    const unknown = assessPin(THEME, "v0.12.0", undefined);
    expect(exitCode([cur])).toBe(0);
    expect(exitCode([cur, behind])).toBe(1);
    expect(exitCode([cur, behind, unknown])).toBe(2);
  });
});

describe("render", () => {
  test("names the governing process, so the reader can act without opening anything", () => {
    const out = render([assessPin(THEME, "v0.10.0", TAGS)]);
    expect(out).toContain("upstream-version-adoption");
    expect(out).toContain("v0.12.0");
  });

  test("an empty registry says so rather than rendering a green table", () => {
    expect(render([])).toContain("declares no pins");
  });
});

/**
 * `tagPrefix` — when the pin literal CANNOT be the tag.
 *
 * Bun is the case that forced this. `.bun-version` and `setup-bun`'s
 * `bun-version` both take a bare `1.3.14`; upstream tags it `bun-v1.3.14`. So a
 * literal that matched the tag would be a literal the build rejects, and the
 * registry's own rule — the version lives in the file the build reads, never in
 * the registry — forbids storing a second, tag-shaped copy.
 */
describe("tagPrefix", () => {
  const BUN: PinDef = {
    id: "bun",
    title: "Bun runtime",
    repo: "https://github.com/oven-sh/bun",
    pinnedIn: ".bun-version",
    pattern: "^(\\d+\\.\\d+\\.\\d+)\\s*$",
    tagPattern: "^bun-v\\d+\\.\\d+\\.\\d+$",
    tagPrefix: "bun-v",
  };
  const BUN_TAGS = ["bun-v1.3.11", "bun-v1.3.14", "bun-v1.4.0", "bun-v1.4.1", "bun-v1.4.2"];

  test("WITHOUT it the verdict is `unknown`, which is the defect it fixes", () => {
    // The falsification, and it is not hypothetical: this is what the registry
    // did before the field existed. `unknown` sets exit 2, so the watchdog
    // would report itself blind on every weekly run forever — the failure its
    // own docblock warns about, pointing the other way.
    const { tagPrefix: _omitted, ...noPrefix } = BUN;
    const v = assessPin(noPrefix, "1.3.14", BUN_TAGS);
    expect(v.state).toBe("unknown");
    expect(exitCode([v])).toBe(2);
  });

  test("WITH it, a pin behind upstream reads `behind`, counting only newer releases", () => {
    const v = assessPin(BUN, "1.3.14", BUN_TAGS);
    expect(v.state).toBe("behind");
    expect(v.behindBy).toEqual(["bun-v1.4.0", "bun-v1.4.1", "bun-v1.4.2"]);
    expect(v.latest).toBe("bun-v1.4.2");
    // The literal a reader will find in `pinnedIn`, not the tag form — the
    // comparison is internal and the report has to match the file.
    expect(v.pinned).toBe("1.3.14");
  });

  test("the newest release reads `current`", () => {
    expect(assessPin(BUN, "1.4.2", BUN_TAGS).state).toBe("current");
  });

  test("a literal upstream never tagged is still `unknown`, not `behind`", () => {
    // The prefix must not turn "I cannot place this ref" into a confident
    // answer: `1.3.99` prefixes to a tag that does not exist.
    const v = assessPin(BUN, "1.3.99", BUN_TAGS);
    expect(v.state).toBe("unknown");
    expect(v.detail).toContain("bun-v1.3.99");
  });

  test("an absent prefix leaves every existing pin's behaviour untouched", () => {
    // The regression guard for the change itself: `tagPrefix` is optional and
    // defaults to "", so a pin whose literal IS its tag compares as before.
    expect(assessPin(THEME, "v0.11.2", TAGS).state).toBe("behind");
    expect(assessPin(THEME, "v0.12.0", TAGS).state).toBe("current");
  });
});

describe("locatePins — each row resolves against the layer that declares it (folio-assistant#1481)", () => {
  const PDF: PinDef = { ...THEME, id: "pdfjs", title: "pdf.js", pinnedIn: "scripts/pdf-viewer.ts" };

  test("a row resolves against ITS registry's root, not the harness's", () => {
    const located = locatePins(
      [
        { layer: "cat-harness", root: "/h", pins: [THEME] },
        { layer: "cat-harness-tools", root: "/t", pins: [PDF] },
      ],
      join,
    );
    expect(located.map((l) => [l.pin.id, l.layer, l.file])).toEqual([
      ["just-the-docs", "cat-harness", "/h/docs/_config.yml"],
      ["pdfjs", "cat-harness-tools", "/t/scripts/pdf-viewer.ts"],
    ]);
  });

  test("the same id in two registries is reported twice, never merged", () => {
    const located = locatePins(
      [
        { layer: "cat-harness", root: "/h", pins: [PDF] },
        { layer: "cat-harness-tools", root: "/t", pins: [PDF] },
      ],
      join,
    );
    expect(located).toHaveLength(2);
  });

  test("a missing file is unknown, and says the file is missing rather than that the pattern drifted", () => {
    const [located] = locatePins([{ layer: "cat-harness", root: "/h", pins: [PDF] }], join);
    const v = missingFileVerdict(located);
    expect(v.state).toBe("unknown");
    expect(v.detail).toContain("scripts/pdf-viewer.ts is not in cat-harness");
    expect(v.detail).not.toContain("pattern has drifted");
    expect(exitCode([v])).toBe(2);
  });
});

describe("this layer's own registry", () => {
  // The guard that was missing: the pdfjs row pointed at a file that had moved
  // layers, and nothing noticed until the weekly watchdog went red.
  const toolsRoot = join(import.meta.dir, "..", "..");
  const registry: PinRegistry = JSON.parse(readFileSync(join(toolsRoot, "upstream", "upstream-pins.json"), "utf8"));

  test("every row's pinnedIn file is in this layer, and its pattern reads a ref out of it", () => {
    expect(registry.pins.length).toBeGreaterThan(0);
    for (const pin of registry.pins) {
      const file = join(toolsRoot, pin.pinnedIn);
      expect(existsSync(file)).toBe(true);
      expect(readPin(readFileSync(file, "utf8"), pin.pattern)).toMatch(/\d/);
    }
  });
});
