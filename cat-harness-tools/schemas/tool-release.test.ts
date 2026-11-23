import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { defaultGraphTypologies, graphLayer, isRenderable, processMayWrite } from "./kg/cat-harness.ts";
import { loadSpdxLicenseList } from "./library/spdx-license-expression.ts";
import {
  TOOL_RELEASE_SCHEMA_TAG,
  ToolReleaseRefSchema,
  ToolReleaseSchema,
  parseToolReleaseRef,
  toolReleaseLicenceProblem,
  toolReleaseRef,
} from "./tools/tool-release.ts";
import { HARNESS_ROOT } from "../scripts/lib/roots.ts";
import { dirname } from "node:path";

const SHA = "a".repeat(64);
const REPO = resolve(dirname(HARNESS_ROOT));
const SEEDED = resolve(HARNESS_ROOT, "tool-releases");

/**
 * One valid release. Each test changes ONE thing, so it cannot pass because of
 * a second violation elsewhere in its fixture.
 */
function release(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    $schema: TOOL_RELEASE_SCHEMA_TAG,
    name: "plantuml",
    version: "1.2026.9",
    role: "tool",
    kind: "jar",
    digest: { algorithm: "sha256", digest: SHA },
    source: { type: "url", url: "https://example.org/plantuml.jar" },
    licence: "GPL-3.0-or-later",
    licenceSource: "the jar's own -license",
    runtimes: [{ release: "temurin-jre@21.0.4+7", inject: "JAVA_HOME" }],
    entry: { template: "java -jar {path}" },
    ...over,
  };
}

const ok = (r: unknown) => ToolReleaseSchema.safeParse(r).success;

describe("folio-tool-release/v1", () => {
  test("a valid release parses", () => {
    expect(ok(release())).toBe(true);
  });

  test("the digest is REQUIRED — the resolver's one refusal compares against it", () => {
    const { digest: _d, ...rest } = release();
    expect(ok(rest)).toBe(false);
  });

  test("the digest is `binary-release`'s ReleaseDigestSchema: an uppercase or short hash is refused", () => {
    expect(ok(release({ digest: { algorithm: "sha256", digest: "A".repeat(64) } }))).toBe(false);
    expect(ok(release({ digest: { algorithm: "sha256", digest: "a".repeat(63) } }))).toBe(false);
    expect(ok(release({ digest: { algorithm: "md5", digest: SHA } }))).toBe(false);
  });

  test("strict: a field carrying the bytes is refused", () => {
    expect(ok(release({ content: "UEsDBBQ..." }))).toBe(false);
  });

  test("an unknown kind is refused", () => {
    expect(ok(release({ kind: "snap" }))).toBe(false);
  });

  test("a plain-http source is refused", () => {
    expect(ok(release({ source: { type: "url", url: "http://example.org/x.jar" } }))).toBe(false);
  });

  describe("an OCI image is identified by digest, never by tag", () => {
    const image = (reference: string, digest = SHA) =>
      release({ kind: "oci-image", source: { type: "oci", reference }, digest: { algorithm: "sha256", digest }, runtimes: [], entry: { template: "docker run {path}" } });

    test("by digest: accepted", () => {
      expect(ok(image(`ghcr.io/example/latex@sha256:${SHA}`))).toBe(true);
    });

    test("by TAG: refused", () => {
      expect(ok(image("ghcr.io/example/latex:2026.10"))).toBe(false);
      expect(ok(image("ghcr.io/example/latex:latest"))).toBe(false);
    });

    test("by tag AND digest: refused — the tag is a second, moving answer", () => {
      expect(ok(image(`ghcr.io/example/latex:2026.10@sha256:${SHA}`))).toBe(false);
    });

    test("a reference naming a different digest from `digest` is refused", () => {
      expect(ok(image(`ghcr.io/example/latex@sha256:${"b".repeat(64)}`))).toBe(false);
    });

    test("an `oci-image` fetched by URL, or a jar fetched by OCI reference, is refused", () => {
      expect(ok(release({ kind: "oci-image", runtimes: [] }))).toBe(false);
      expect(ok(release({ source: { type: "oci", reference: `ghcr.io/x/y@sha256:${SHA}` } }))).toBe(false);
    });
  });

  describe("runtimes are per release", () => {
    test("`runtimes` is required, so 'needs none' is stated rather than omitted", () => {
      const { runtimes: _r, ...rest } = release();
      expect(ok(rest)).toBe(false);
      expect(ok(release({ runtimes: [] }))).toBe(true);
    });

    test("a runtime ref must be `name@version`", () => {
      expect(ok(release({ runtimes: [{ release: "temurin-jre", inject: "JAVA_HOME" }] }))).toBe(false);
    });

    test("injection is JAVA_HOME or PATH — never 'inherit'", () => {
      expect(ok(release({ runtimes: [{ release: "temurin-jre@21.0.4+7", inject: "inherit" }] }))).toBe(false);
      expect(ok(release({ runtimes: [{ release: "temurin-jre@21.0.4+7", inject: "PATH" }] }))).toBe(true);
    });

    test("a release cannot be its own runtime", () => {
      expect(ok(release({ runtimes: [{ release: "plantuml@1.2026.9", inject: "PATH" }] }))).toBe(false);
    });

    test("one runtime named twice is refused", () => {
      const rt = { release: "temurin-jre@21.0.4+7", inject: "JAVA_HOME" };
      expect(ok(release({ runtimes: [rt, rt] }))).toBe(false);
    });
  });

  describe("the entry template runs THIS release", () => {
    test("a template that never names {path} or {home} is refused", () => {
      expect(ok(release({ entry: { template: "java -version" } }))).toBe(false);
    });

    test("an unknown placeholder is refused", () => {
      expect(ok(release({ entry: { template: "java -jar {jar}" } }))).toBe(false);
    });

    test("{home} needs `home`, and `home` may not climb out of the archive", () => {
      expect(ok(release({ entry: { template: "{home}/bin/java" } }))).toBe(false);
      expect(ok(release({ entry: { template: "{home}/bin/java", home: "jdk" } }))).toBe(true);
      expect(ok(release({ entry: { template: "{home}/bin/java", home: "../etc" } }))).toBe(false);
      expect(ok(release({ entry: { template: "{home}/bin/java", home: "/usr" } }))).toBe(false);
    });
  });

  test("a multi-line licence is refused by the schema", () => {
    expect(ok(release({ licence: "MIT\nOR Apache-2.0" }))).toBe(false);
  });
});

describe("release refs", () => {
  test("round-trip, splitting at the one `@`", () => {
    expect(parseToolReleaseRef("temurin-jre@21.0.4+7")).toEqual({ name: "temurin-jre", version: "21.0.4+7" });
    expect(toolReleaseRef({ name: "graphviz", version: "16.1.0" })).toBe("graphviz@16.1.0");
  });

  test("two `@`, a missing version or an uppercase name is refused", () => {
    expect(ToolReleaseRefSchema.safeParse("a@b@c").success).toBe(false);
    expect(ToolReleaseRefSchema.safeParse("plantuml@").success).toBe(false);
    expect(ToolReleaseRefSchema.safeParse("PlantUML@1").success).toBe(false);
  });
});

describe("licences, against the pinned SPDX License List", () => {
  const list = loadSpdxLicenseList(REPO);

  test("the list loads (could-not-determine would fail here, not pass)", () => {
    expect(typeof list).not.toBe("string");
  });

  test("a real expression passes and a mistyped id does not", () => {
    if (typeof list === "string") throw new Error(list);
    expect(toolReleaseLicenceProblem({ licence: "GPL-2.0-only WITH Classpath-exception-2.0" }, list)).toBeUndefined();
    expect(toolReleaseLicenceProblem({ licence: "GPL-3.O-or-later" }, list)).toBeDefined();
  });
});

describe("the seeded records", () => {
  const files = readdirSync(SEEDED).filter((f) => f.endsWith(".json"));
  const releases = files
    .map((f) => JSON.parse(readFileSync(join(SEEDED, f), "utf-8")) as { $schema: string })
    .filter((j) => j.$schema === TOOL_RELEASE_SCHEMA_TAG);

  test("T4: PlantUML, its JRE and graphviz are all present, and each parses", () => {
    const parsed = releases.map((r) => ToolReleaseSchema.parse(r));
    expect(parsed.map((r) => r.name)).toEqual(expect.arrayContaining(["graphviz", "plantuml", "temurin-jre"]));
  });

  test("PlantUML's digest is the one `scripts/plantuml-render.ts` already pins — one fact, two places, checked", async () => {
    const { PLANTUML } = await import("../scripts/plantuml-render");
    const p = releases.map((r) => ToolReleaseSchema.parse(r)).find((r) => r.name === "plantuml")!;
    expect(p.version).toBe(PLANTUML.version);
    expect(p.digest.digest).toBe(PLANTUML.sha256);
    expect(p.source).toEqual({ type: "url", url: PLANTUML.url });
  });
});

describe("the graph typology it is held under", () => {
  test("registered, not renderable, `content` — a pin is a decision the resolver reads", () => {
    expect(defaultGraphTypologies.get("tool-release")).toBeDefined();
    expect(isRenderable("tool-release")).toBe(false);
    expect(graphLayer("tool-release")).toBe("content");
  });

  test("both families are listed, so `check:kind-validators` can route every file", () => {
    const families = Object.keys(defaultGraphTypologies.get("tool-release")?.nodeSchemas ?? {}).sort();
    expect(families).toEqual(["folio-tool-profile/v1", "folio-tool-release/v1"]);
  });

  test("a running step never WRITES a pin — the resolver reads it; what a run resolved is a run context", () => {
    expect(processMayWrite("tool-release")).toBe(false);
  });
});
