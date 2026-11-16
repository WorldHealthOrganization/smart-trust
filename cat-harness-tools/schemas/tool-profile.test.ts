import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";

import { TOOL_PROFILE_SCHEMA_TAG, ToolProfileSchema, toolReleaseGraphProblems, type ToolProfile } from "./tools/tool-profile.ts";
import { TOOL_RELEASE_SCHEMA_TAG, ToolReleaseSchema, type ToolRelease } from "./tools/tool-release.ts";
import { loadToolReleases } from "../scripts/tool-releases";
import { HARNESS_ROOT } from "../scripts/lib/roots.ts";
import { dirname } from "node:path";

const SHA = "a".repeat(64);

function rel(name: string, version: string, over: Record<string, unknown> = {}): ToolRelease {
  return ToolReleaseSchema.parse({
    $schema: TOOL_RELEASE_SCHEMA_TAG,
    name,
    version,
    role: "tool",
    kind: "archive",
    digest: { algorithm: "sha256", digest: SHA },
    source: { type: "url", url: `https://example.org/${name}-${version}.tgz` },
    licence: "MIT",
    licenceSource: "LICENSE",
    runtimes: [],
    entry: { template: "{home}/bin/" + name, home: name },
    ...over,
  });
}

function profile(tools: Record<string, string>, name = "default"): unknown {
  return { $schema: TOOL_PROFILE_SCHEMA_TAG, name, description: "for tests", tools };
}

const JRE = rel("temurin-jre", "21.0.4+7", { role: "runtime", entry: { template: "{home}/bin/java", home: "jdk" } });
const GRAPHVIZ = rel("graphviz", "16.1.0");
const PLANTUML = rel("plantuml", "1.2026.9", {
  kind: "jar",
  runtimes: [
    { release: "temurin-jre@21.0.4+7", inject: "JAVA_HOME" },
    { release: "graphviz@16.1.0", inject: "PATH" },
  ],
  entry: { template: "java -jar {path}" },
});

describe("folio-tool-profile/v1", () => {
  test("a valid profile parses", () => {
    expect(ToolProfileSchema.safeParse(profile({ plantuml: "plantuml@1.2026.9" })).success).toBe(true);
  });

  test("an empty profile is refused", () => {
    expect(ToolProfileSchema.safeParse(profile({})).success).toBe(false);
  });

  test("a key that is not the name of the release it maps to is refused — the runtime cannot hide under a tool's name", () => {
    expect(ToolProfileSchema.safeParse(profile({ plantuml: "temurin-jre@21.0.4+7" })).success).toBe(false);
  });

  test("a bare tool name with no version is refused", () => {
    expect(ToolProfileSchema.safeParse(profile({ plantuml: "plantuml" })).success).toBe(false);
  });

  test("strict: an unknown field is refused", () => {
    expect(ToolProfileSchema.safeParse({ ...(profile({ plantuml: "plantuml@1.2026.9" }) as object), runtimes: {} }).success).toBe(false);
  });
});

describe("the graph — what one file cannot know", () => {
  const p = (tools: Record<string, string>, name?: string) => ToolProfileSchema.parse(profile(tools, name)) as ToolProfile;

  test("the T4 set is clean: PlantUML with its JRE and graphviz, and a default profile naming tools only", () => {
    expect(toolReleaseGraphProblems([JRE, GRAPHVIZ, PLANTUML], [p({ plantuml: "plantuml@1.2026.9", graphviz: "graphviz@16.1.0" })])).toEqual([]);
  });

  test("a profile NAMING A RUNTIME is refused — that is the global java pin by another name", () => {
    const problems = toolReleaseGraphProblems([JRE, GRAPHVIZ, PLANTUML], [p({ "temurin-jre": "temurin-jre@21.0.4+7" })]);
    expect(problems.length).toBe(1);
    expect(problems[0]).toContain("names runtime temurin-jre@21.0.4+7 directly");
  });

  test("a profile ref to no release is refused", () => {
    expect(toolReleaseGraphProblems([JRE, GRAPHVIZ, PLANTUML], [p({ plantuml: "plantuml@9.9" })])[0]).toContain("no record declares");
  });

  test("a runtime ref to no release is refused", () => {
    expect(toolReleaseGraphProblems([GRAPHVIZ, PLANTUML], [])[0]).toContain("needs runtime temurin-jre@21.0.4+7");
  });

  test("a runtime with no `entry.home` cannot be injected", () => {
    const bareJre = rel("temurin-jre", "21.0.4+7", { role: "runtime", kind: "binary", entry: { template: "{path}" } });
    expect(toolReleaseGraphProblems([bareJre, GRAPHVIZ, PLANTUML], [])[0]).toContain("declares no `entry.home`");
  });

  test("a TOOL may be another tool's runtime — graphviz is how PlantUML finds `dot`", () => {
    expect(toolReleaseGraphProblems([JRE, GRAPHVIZ, PLANTUML], [p({ graphviz: "graphviz@16.1.0" })])).toEqual([]);
  });

  test("one release recorded twice on one platform is refused; on two platforms it is not", () => {
    expect(toolReleaseGraphProblems([JRE, JRE], [])[0]).toContain("recorded twice");
    const arm = rel("temurin-jre", "21.0.4+7", { role: "runtime", platform: { os: "linux", arch: "arm64" }, entry: { template: "{home}/bin/java", home: "jdk" } });
    const x64 = rel("temurin-jre", "21.0.4+7", { role: "runtime", platform: { os: "linux", arch: "x64" }, entry: { template: "{home}/bin/java", home: "jdk" } });
    expect(toolReleaseGraphProblems([arm, x64], [])).toEqual([]);
  });

  test("two profiles with one name are refused", () => {
    const one = p({ graphviz: "graphviz@16.1.0" });
    expect(toolReleaseGraphProblems([GRAPHVIZ], [one, one])[0]).toContain("declared twice");
  });
});

describe("the seeded directory, as the gate reads it", () => {
  const dir = resolve(HARNESS_ROOT, "tool-releases");
  const loaded = loadToolReleases([dir], resolve(dirname(HARNESS_ROOT)));

  test("every file parses and none is mistaken for an instance declaration", () => {
    expect(loaded.problems).toEqual([]);
  });

  test("the graph is clean, and the `default` profile names no runtime", () => {
    expect(toolReleaseGraphProblems(loaded.releases.map((r) => r.release), loaded.profiles.map((p) => p.profile))).toEqual([]);
    expect(loaded.profiles.map((p) => p.profile.name)).toContain("default");
  });
});
