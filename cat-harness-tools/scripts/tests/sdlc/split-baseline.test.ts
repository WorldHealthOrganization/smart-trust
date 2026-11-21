/**
 * `split:baseline --check` is a falsifier for stage 1a (`70lx`), so it is
 * tested going RED: a check never seen failing checks nothing (`4j3h`, `q2wn`).
 */
import { describe, expect, test } from "bun:test";

import { diff, measure, type ToolContract } from "../../split-baseline.ts";

const tool = (name: string, required: string[] = [], optional: string[] = []): ToolContract => ({ name, required, optional });

describe("split-baseline diff", () => {
  const base = { mcpTools: [tool("a", ["x"]), tool("b")], knownSkills: ["s1", "s2"] };

  test("identical measurements agree", () => {
    expect(diff(base, base)).toEqual([]);
  });

  test("a tool gone, added, or with a changed contract is each reported", () => {
    const now = { mcpTools: [tool("a", ["x"], ["y"]), tool("c")], knownSkills: ["s1", "s2"] };
    expect(diff(base, now).sort()).toEqual(
      ["tool added: c", "tool contract changed: a req=[x] opt=[] → a req=[x] opt=[y]", "tool gone: b"].sort(),
    );
  });

  test("a skill that stops or starts resolving is reported", () => {
    expect(diff(base, { ...base, knownSkills: ["s2", "s3"] }).sort()).toEqual(
      ["skill newly resolves: s3", "skill no longer resolves: s1"].sort(),
    );
  });
});

describe("split-baseline measure", () => {
  test("reads the real checkout: tools AND skills, never a vacuous zero", async () => {
    const m = await measure();
    expect(m.problems).toEqual([]);
    expect(m.mcpTools.length).toBeGreaterThan(10);
    expect(m.knownSkills.length).toBeGreaterThan(100);
  });
});
