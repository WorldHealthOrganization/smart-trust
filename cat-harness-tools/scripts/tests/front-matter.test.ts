/**
 * The node summary is what makes an inventory usable, so it is gated.
 *
 * `skill_list` advertised "one-line summaries" in `AGENTS.md` and emitted 150
 * bare names for months. Nothing caught it because nothing asserted it: the
 * tool had no test file at all. The assertions here are therefore about the
 * PROMISE — that a real corpus of skills comes back described — not only about
 * the regex.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { firstHeading, frontMatter, nodeSummary } from "../front-matter.js";
import { packageDirsIn } from "../skill-topics.js";
import { HARNESS_ROOT } from "../lib/roots.ts";

describe("front matter", () => {
  test("a plain scalar description is read", () => {
    expect(frontMatter("---\nname: a\ndescription: one line\n---\nbody").description).toBe("one line");
  });

  test("a folded `>` block is joined onto one line", () => {
    const text = "---\nname: a\ndescription: >\n  first part\n  second part\nadapters: [x]\n---\nbody";
    expect(frontMatter(text).description).toBe("first part second part");
  });

  test("a file with no front matter yields {}, not an error", () => {
    // 5 of folio-core's 77 skills open on a heading. Absence is a state, not a
    // fault, and the caller decides what it means.
    expect(frontMatter("# Just a heading\n\nbody")).toEqual({});
  });

  test("an unterminated front-matter block yields {}", () => {
    expect(frontMatter("---\nname: a\ndescription: b\nno closing fence")).toEqual({});
  });
});

describe("nodeSummary — and its third state", () => {
  test("front matter wins over the heading", () => {
    expect(nodeSummary("---\ndescription: from front matter\n---\n# From heading")).toBe("from front matter");
  });

  test("the heading is a real fallback, not a consolation prize", () => {
    // `directory-conventions.md` is the live instance of this: no front matter,
    // and a heading that summarises it better than most authored descriptions.
    expect(nodeSummary("# Directory conventions — what an instance declares it scans\n\nbody"))
      .toBe("Directory conventions — what an instance declares it scans");
  });

  test("a node declaring NOTHING returns undefined, never an empty string", () => {
    // The distinction the caller has to be able to render: a node that never
    // said what it is must not look like one that said it is nothing.
    expect(nodeSummary("just prose, no heading, no front matter")).toBeUndefined();
    expect(firstHeading("## only an h2\n")).toBeUndefined();
  });
});

describe("the live corpus really is describable — the assertion that would have caught it", () => {
  // Every package, through the topic-aware walk (bean 9umr). This read only
  // skills/folio-core/ until its skills moved into topics, which left it six —
  // and a corpus of six proves little about the promise.
  const SKILLS = join(HARNESS_ROOT, "skills");
  const files = packageDirsIn(SKILLS).flatMap((p) =>
    readdirSync(p.dir)
      .filter((f) => f.endsWith(".md") && f !== "README.md")
      .map((f) => join(p.dir, f)),
  );

  test("there are skills to check — otherwise this proves nothing", () => {
    expect(files.length).toBeGreaterThan(50);
  });

  test("every skill yields SOME summary", () => {
    // Not "most". If a skill can be listed it can be described, because the
    // heading fallback covers the ones carrying no front matter. A failure
    // here is a file with neither — which is a node that cannot say what it
    // is, and that is worth a red build.
    const mute = files.filter((f) => !nodeSummary(readFileSync(f, "utf8")));
    expect(mute).toEqual([]);
  });

  test("summaries are one line — a folded block must not leak newlines", () => {
    // `skill_list` renders one skill per line. A description carrying a newline
    // breaks the list into fragments that read as separate skills.
    const multiline = files.filter((f) => nodeSummary(readFileSync(f, "utf8"))?.includes("\n"));
    expect(multiline).toEqual([]);
  });
});
