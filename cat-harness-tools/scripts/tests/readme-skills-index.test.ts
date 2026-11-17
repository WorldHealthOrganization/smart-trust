/**
 * The per-repository skill index (bean `e0uk`): the `skills:index`
 * region of a layer's AGENTS.md lists the skills that layer publishes.
 *
 * What is worth gating: a summary that tells an agent nothing (a heading that
 * only repeats the name), an AGENTS.md pushed past what an agent reads, a
 * missing SKILLS.md that AGENTS.md links, and a write outside the region.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  AGENTS_MD_BYTE_BUDGET,
  SKILLS_INDEX_FILE,
  SKILLS_INDEX_MARKER,
  firstParagraph,
  ownSkillIndex,
  renderCompactSkillIndex,
  runReadmeSync,
  skillPurpose,
  skillSummaryLine,
} from "../../pipeline/readme-sections";
import { FIXTURE_INSTANCE, declareInstance, writeDeclaration } from "../../test/support/instance-fixture.js";

const dirs: string[] = [];
afterEach(() => {
  while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true });
});

const REGION = `<!-- ${SKILLS_INDEX_MARKER}:begin -->\n<!-- ${SKILLS_INDEX_MARKER}:end -->\n`;

/** A layer with a README, an AGENTS.md carrying the region, and the given skills under skills/<pkg>/. */
function instance(skills: Record<string, string>, agentsPrefix = "# Agents\n\nHand-written.\n\n"): string {
  const root = mkdtempSync(join(tmpdir(), "skills-index-"));
  dirs.push(root);
  declareInstance(root, FIXTURE_INSTANCE);
  writeFileSync(join(root, "README.md"), "# Fixture\n");
  writeFileSync(join(root, "AGENTS.md"), `${agentsPrefix}${REGION}\nAfter.\n`);
  for (const [rel, body] of Object.entries(skills)) {
    mkdirSync(join(root, "skills", rel, ".."), { recursive: true });
    writeFileSync(join(root, "skills", rel), body);
  }
  return root;
}

const withDescription = (name: string, d: string) => `---\nname: ${name}\ndescription: ${d}\n---\n\n# ${name}\n\nBody.\n`;

describe("what a skill says it is for", () => {
  test("the first sentence, capped at a word", () => {
    expect(skillSummaryLine("Does a thing. Then more.")).toBe("Does a thing.");
    const long = `${"word ".repeat(60)}end.`;
    const out = skillSummaryLine(long, 50)!;
    expect(out.endsWith("…")).toBe(true);
    expect(out.length).toBeLessThanOrEqual(50);
    expect(out).not.toMatch(/wor…$/);
    expect(skillSummaryLine("   ")).toBeUndefined();
  });

  test("a description wins; a heading that only repeats the name falls through to the first paragraph", () => {
    expect(skillPurpose(withDescription("a", "Reads A."), "a")).toEqual({ summary: "Reads A.", from: "description" });
    const noDesc = "---\ninput: x.json\n---\n\n# fhir-validation\n\n> Skill id: `fhir-validation`\n\nValidate an IG against its profiles.\n";
    expect(skillPurpose(noDesc, "fhir-validation")).toEqual({ summary: "Validate an IG against its profiles.", from: "paragraph" });
    expect(skillPurpose("# A heading that says more\n", "x")).toEqual({ summary: "A heading that says more", from: "heading" });
    expect(skillPurpose("# x\n", "x")).toEqual({ from: "none" });
  });

  test("first paragraph skips quotes, lists, tables and fenced code", () => {
    expect(firstParagraph("# h\n\n> q\n\n- l\n\n| t |\n\n```\nnot this\n```\n\nThis one.\n")).toBe("This one.");
  });
});

describe("the AGENTS.md region", () => {
  test("lists the instance's own skills with links, and leaves the rest of the file alone", async () => {
    const root = instance({
      "pkg/alpha.md": withDescription("alpha", "Does alpha | with a pipe."),
      "pkg/beta.md": withDescription("beta", "Does beta."),
    });
    const r = await runReadmeSync({ root });
    expect(r.exitCode).toBe(0);
    const agents = readFileSync(join(root, "AGENTS.md"), "utf-8");
    expect(agents.startsWith("# Agents\n\nHand-written.\n\n")).toBe(true);
    expect(agents.endsWith("\nAfter.\n")).toBe(true);
    expect(agents).toContain("| [`alpha`](skills/pkg/alpha.md) | Does alpha \\| with a pipe. |");
    expect(agents).toContain("**`skills/pkg/`** (2)");
    expect(existsSync(join(root, SKILLS_INDEX_FILE))).toBe(false);
    expect((await runReadmeSync({ root, check: true })).exitCode).toBe(0);
  });

  test("--check fails when a skill is added and the region was not re-synced", async () => {
    const root = instance({ "pkg/alpha.md": withDescription("alpha", "A.") });
    await runReadmeSync({ root });
    writeFileSync(join(root, "skills", "pkg", "gamma.md"), withDescription("gamma", "G."));
    const r = await runReadmeSync({ root, check: true });
    expect(r.exitCode).toBe(1);
    expect(r.text).toContain("AGENTS.md is out of date");
  });

  test("an AGENTS.md without the region is never touched", async () => {
    const root = instance({ "pkg/alpha.md": withDescription("alpha", "A.") });
    writeFileSync(join(root, "AGENTS.md"), "# Mine\n");
    await runReadmeSync({ root });
    expect(readFileSync(join(root, "AGENTS.md"), "utf-8")).toBe("# Mine\n");
  });
});

describe("past the AGENTS.md budget", () => {
  test("AGENTS.md gets the directories and SKILLS.md the full list; --check then holds", async () => {
    const filler = `# Agents\n\n${"x".repeat(AGENTS_MD_BYTE_BUDGET - 200)}\n\n`;
    const root = instance({ "pkg/alpha.md": withDescription("alpha", "A."), "other/beta.md": withDescription("beta", "B.") }, filler);
    expect(ownSkillIndex(root).total).toBe(2);

    expect((await runReadmeSync({ root })).exitCode).toBe(0);
    const agents = readFileSync(join(root, "AGENTS.md"), "utf-8");
    expect(agents).toContain(`[\`${SKILLS_INDEX_FILE}\`](${SKILLS_INDEX_FILE})`);
    expect(agents).toContain("| [`skills/pkg/`](skills/pkg/) | 1 |");
    expect(agents).not.toContain("(skills/pkg/alpha.md)");
    const index = readFileSync(join(root, SKILLS_INDEX_FILE), "utf-8");
    expect(index).toContain("| [`alpha`](skills/pkg/alpha.md) | A. |");

    expect((await runReadmeSync({ root, check: true })).exitCode).toBe(0);
    rmSync(join(root, SKILLS_INDEX_FILE));
    const missing = await runReadmeSync({ root, check: true });
    expect(missing.exitCode).toBe(1);
    expect(missing.text).toContain(`${SKILLS_INDEX_FILE} is missing`);
  });
});

describe("skills in an opt-in sub-graph", () => {
  /** `instance()` plus an opt-in `extra/` group whose skills are declared from within, as `cat-harness.sdlc` is. */
  function withOptInGroup(): string {
    const root = instance({ "pkg/alpha.md": withDescription("alpha", "A.") });
    mkdirSync(join(root, "extra", "skills", "ops"), { recursive: true });
    writeFileSync(join(root, "extra", "skills", "ops", "gamma.md"), withDescription("gamma", "G."));
    writeFileSync(
      join(root, "extra", "graph.json"),
      JSON.stringify({ name: "extra", directories: [{ id: "extra-skills", path: "skills/", subgraph: true, graphTypologies: ["skills"] }] }),
    );
    writeDeclaration(root, {
      name: FIXTURE_INSTANCE,
      directories: [
        { id: "skills", path: "skills/", graphTypologies: ["skills"] },
        { id: "extra", path: "extra/", optIn: true, graphTypologies: ["cat-harness"] },
      ],
      // The declaring layer switches its own group on, as cat-harness does.
      enableSubgraphs: [`${FIXTURE_INSTANCE}.extra`],
    });
    return root;
  }

  test("are listed by name, unlinked, under a directory marked opt-in", async () => {
    const root = withOptInGroup();
    expect((await runReadmeSync({ root })).exitCode).toBe(0);
    const agents = readFileSync(join(root, "AGENTS.md"), "utf-8");
    expect(agents).toContain("| [`alpha`](skills/pkg/alpha.md) | A. |");
    expect(agents).toContain("| `gamma` | G. |");
    expect(agents).not.toContain("(extra/skills/ops/gamma.md)");
    expect(agents).toContain("**`extra/skills/ops/`** (1) (opt-in `fixture.extra`)");
  });

  test("the short form names the directory without a link", () => {
    const root = withOptInGroup();
    const p = ownSkillIndex(root).packages.find((x) => x.dir === "extra/skills/ops");
    expect(p?.optIn).toBe("fixture.extra");
    const compact = renderCompactSkillIndex(ownSkillIndex(root), AGENTS_MD_BYTE_BUDGET);
    expect(compact).toContain("| `extra/skills/ops/` (opt-in `fixture.extra`) | 1 |");
    expect(compact).toContain("| [`skills/pkg/`](skills/pkg/) | 1 |");
  });
});
