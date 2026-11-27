/**
 * The Python dependency declaration, and the two checks that keep it true.
 *
 * Bean `68dt`. The declaration is only worth having if it cannot quietly
 * diverge from what the scripts import, so the interesting tests are the ones
 * that prove divergence is CAUGHT.
 *
 * @module scripts/tests/python-deps
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  DEP_TIERS,
  PYTHON_DEPS,
  PythonDepSchema,
  depsForTier,
  importNameOf,
  requirementsPath,
} from "../../schemas/sdlc/python-deps.ts";
import { checkPythonDeps, scanImports } from "../check-python-deps.ts";
import { dockerfileFindings, dockerfileOf, generatedPaths, imageFindings, requirementsBody, staleTiers } from "../gen-python-deps.ts";
import { tools } from "../../tools/discover.ts";
import { TOOLS_ROOT } from "../lib/roots.ts";

// TWO ROOTS, because this file asks two questions of two different trees.
//
// `requirements.txt` is addressed from THIS LAYER's root — it lives at
// `requirementsPath("lean")` (`python/`, bean `ar1s`), though CI installs it
// from the checkout root.
// The `.py` files that import those packages are the LAYER's, under
// `cat-harness/scripts/`. One `ROOT` answered both when this arrived from
// main, and pointing it at either alone breaks the other half: at the
// layer, `requirements.txt` is ENOENT; at the repository, the
// `scripts/**/*.py` glob matches nothing and the scan reports 0 imports —
// which the vacuity guard below is there to refuse.
const INSTANCE = TOOLS_ROOT;  // bean 70lx: where the scripts are

describe("the declaration matches what the scripts actually import", () => {
  test("nothing imported is undeclared, and nothing declared is dead", () => {
    const r = checkPythonDeps(INSTANCE);
    expect(r.undeclared.map((u) => u.module)).toEqual([]);
    expect(r.unused.map((u) => u.distribution)).toEqual([]);
  });

  test("the scan finds real imports — not a vacuous pass", () => {
    // A scan returning nothing would satisfy the assertion above trivially.
    // `pymupdf` is the one this bean exists for, so it is named explicitly.
    const found = scanImports(INSTANCE);
    expect(found.length).toBeGreaterThan(5);
    expect(found.map((f) => f.module)).toContain("pymupdf");
  });

  test("local sibling modules are NOT treated as dependencies", () => {
    // The first scan reported 13 packages; five were files inside
    // `scripts/translation/` imported flat. Declaring them would have put
    // phantom entries into requirements.txt.
    const names = scanImports(INSTANCE).map((f) => f.module);
    for (const local of ["translation_config", "translation_security", "pull_translations"]) {
      expect(names).not.toContain(local);
    }
  });

  test("import name and distribution name are allowed to differ", () => {
    // Three of them do, and a checker without this mapping reports three
    // false gaps — which is how a checker gets switched off.
    const byDist = new Map(PYTHON_DEPS.map((d) => [d.distribution, d]));
    expect(importNameOf(byDist.get("PyYAML")!)).toBe("yaml");
    expect(importNameOf(byDist.get("pdfminer.six")!)).toBe("pdfminer");
    expect(importNameOf(byDist.get("camelot-py")!)).toBe("camelot");
    // …and the common case still works.
    expect(importNameOf(byDist.get("lxml")!)).toBe("lxml");
  });
});

describe("a transitive dependency is declared, not inferred", () => {
  test("cffi is declared transitive and says what needs it", () => {
    // This pinned Pillow until bean `scfh`, when `image-reuse.py` started
    // importing PIL directly, so Pillow stopped being transitive and is now an
    // ordinary declared import. `cffi` is the example that is still true.
    const cffi = PYTHON_DEPS.find((d) => d.distribution === "cffi");
    expect(cffi?.transitive).toBe(true);
    // No `import cffi` exists anywhere, so without the flag this reads as dead
    // weight and gets removed — and `cryptography` then panics at import time.
    expect(scanImports(INSTANCE).map((f) => f.module)).not.toContain("cffi");
  });

  test("Pillow is a direct import now, and declared as one", () => {
    const pillow = PYTHON_DEPS.find((d) => d.distribution === "pillow");
    expect(pillow?.transitive).toBeUndefined();
    expect(scanImports(INSTANCE).map((f) => f.module)).toContain("PIL");
  });

  test("the schema refuses a transitive entry whose `why` does not say what requires it", () => {
    const bad = { distribution: "x", tier: "lean" as const, transitive: true, why: "it is nice" };
    expect(PythonDepSchema.safeParse(bad).success).toBe(false);
    const good = { ...bad, why: "required by y, which imports it" };
    expect(PythonDepSchema.safeParse(good).success).toBe(true);
  });
});

describe("the two tiers, and what each costs", () => {
  test("each extended entry carries its measured cost", () => {
    // camelot-py was the only one until vosk (meeting transcription, 2026-10-06),
    // then the OPUS-MT runner's three (open machine translation, 2026-11-14)
    // and anthropic (vision digit fallback, 2026-11-15).
    expect(depsForTier("extended").map((d) => d.distribution)).toEqual([
      "camelot-py",
      "vosk",
      "transformers",
      "torch",
      "sentencepiece",
      "anthropic",
    ]);
    // The reason has to carry the measurement — a tier with no stated cost is
    // a judgement nobody can check.
    for (const d of depsForTier("extended")) expect(d.why, d.distribution).toMatch(/\d+(\.\d+)? ?MB/);
  });

  test("every lean entry is installable by CI's own file", () => {
    const body = readFileSync(join(TOOLS_ROOT, requirementsPath("lean")), "utf-8");
    for (const d of depsForTier("lean")) expect(body).toContain(`\n${d.distribution}\n`);
    // And the expensive one is NOT in it.
    expect(body).not.toContain("\ncamelot-py\n");
  });
});

describe("the generated files cannot drift from the declaration", () => {
  test("both are current", () => {
    expect(staleTiers(TOOLS_ROOT)).toEqual([]);
  });

  test("generation is deterministic — byte-identical on a re-run", () => {
    for (const tier of DEP_TIERS) expect(requirementsBody(tier)).toBe(requirementsBody(tier));
  });

  test("each file says it is generated and names its source", () => {
    for (const tier of DEP_TIERS) {
      const body = readFileSync(join(TOOLS_ROOT, requirementsPath(tier)), "utf-8");
      expect(body).toContain("GENERATED");
      expect(body).toContain("schemas/sdlc/python-deps.ts");
    }
  });

  test("every package carries a machine-readable `# imports:` line", () => {
    // The reason above is for a PERSON. This one is for
    // `scripts/tests/python-deps-importable.test.py`, which reads the
    // distribution -> module mapping back out and tries each import for real.
    // Emitted for every package, including where it equals the distribution
    // name: a parser with a default path cannot tell a missing line from an
    // unremarkable one, so a dropped line would silently become a weaker check.
    for (const tier of DEP_TIERS) {
      const body = requirementsBody(tier);
      const emitted = [...body.matchAll(/^# imports: (\S+)$/gm)].map((m) => m[1]);
      expect(emitted).toEqual(
        [...depsForTier(tier)]
          .sort((a, b) => a.distribution.localeCompare(b.distribution))
          .map(importNameOf),
      );
    }
  });

  test("the mapping that differs is the mapping that matters", () => {
    // Three distributions here do not import under their own name. If this
    // list ever went empty the importability check would still pass while
    // testing nothing interesting, so name them.
    const body = requirementsBody("lean");
    for (const [dist, mod] of [
      ["pillow", "PIL"],
      ["PyYAML", "yaml"],
      ["pdfminer.six", "pdfminer"],
    ]) {
      expect(body).toContain(`# imports: ${mod}\n${dist}\n`);
    }
  });

  test("every package's reason travels into the file with it", () => {
    // A requirements file is where somebody lands when an install fails, and
    // "what is this for" is the question they have.
    const body = readFileSync(join(TOOLS_ROOT, requirementsPath("lean")), "utf-8");
    for (const d of depsForTier("lean")) expect(body).toContain(`# ${d.distribution}:`);
  });
});

// Bean `ar1s`, phase 2. The image check used to read the ROOT Dockerfile only —
// the one image nothing built — and passed vacuously once it was gone. It now
// reads the images Tools declare, so these prove each rule is CAUGHT.
describe("every image a Tool declares installs the generated set", () => {
  const [lean] = generatedPaths();
  const copy = `COPY ${lean} /tmp/requirements.txt\n`;

  test("the build line names the Dockerfile", () => {
    expect(dockerfileOf("docker build -t x -f a/b/Dockerfile a/b")).toBe("a/b/Dockerfile");
    expect(dockerfileOf("docker build --file=a/Dockerfile .")).toBe("a/Dockerfile");
    expect(dockerfileOf("docker build -t x .")).toBeNull();
  });

  test("installing the COPYed generated file passes", () => {
    expect(dockerfileFindings(`FROM x\n${copy}RUN pip3 install --no-cache-dir \\\n    -r /tmp/requirements.txt\n`)).toEqual([]);
  });

  test("an image with no pip install passes", () => {
    expect(dockerfileFindings("FROM ubuntu\nRUN apt-get install -y texlive-full\n")).toEqual([]);
  });

  test("a retyped declared package is a finding, across a continuation", () => {
    const f = dockerfileFindings(`FROM x\n${copy}RUN pip3 install -r /tmp/requirements.txt\nRUN pip3 install --no-cache-dir \\\n    requests>=2.32\n`);
    expect(f.some((x) => x.includes("requests>=2.32"))).toBe(true);
  });

  test("a requirements file that is not the generated one is a finding", () => {
    const f = dockerfileFindings("FROM x\nCOPY .github/scripts/requirements.txt r.txt\nRUN pip3 install -r r.txt\n");
    expect(f.some((x) => x.includes("-r r.txt"))).toBe(true);
    expect(f.some((x) => x.includes("never `-r`"))).toBe(true);
  });

  test("a wheel or build tool outside the declaration is not a retyped list", () => {
    expect(dockerfileFindings(`FROM x\n${copy}RUN pip3 install -r /tmp/requirements.txt && pip3 install maturin /tmp/w/x.whl\n`)).toEqual([]);
  });

  test("a Tool whose Dockerfile is missing is a finding, not a pass", () => {
    const fake = { id: "gone", install: { container: "docker build -f no/such/Dockerfile ." } } as never;
    expect(imageFindings([fake])).toEqual([{ tool: "gone", dockerfile: "no/such/Dockerfile", problem: "the Dockerfile does not exist" }]);
  });

  test("the declared images exist and are clean — and there are some", () => {
    const defs = tools();
    // Vacuity guard: with no image declared this test would pass on nothing.
    expect(defs.filter((t) => t.install.container !== undefined).length).toBeGreaterThan(0);
    expect(imageFindings(defs)).toEqual([]);
  });
});
