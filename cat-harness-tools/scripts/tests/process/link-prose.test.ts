/**
 * linkProse: process ids and skill names in BPMN documentation become links,
 * and what cannot be linked is reported (owner, 2026-10-31).
 */
import { describe, expect, test } from "bun:test";
import { escapeAngles, linkProse } from "../../lib/link-prose.ts";

const procs: Record<string, string> = { Process_ContentChangeReview: "content-change-review.html" };
const skills = new Set(["public-comment", "review-comments"]);
const run = (t: string) =>
  linkProse(t, (id) => procs[id], (n) => (skills.has(n) ? `../skills/${n}.html` : undefined));

describe("linkProse", () => {
  test("the public-comment sentence the owner pointed at", () => {
    const r = run(
      "The change set is reviewed by the same process as any content change (Process_ContentChangeReview); only the intake is new. Skill: public-comment.",
    );
    expect(r.text).toBe(
      "The change set is reviewed by the same process as any content change ([Process_ContentChangeReview](content-change-review.html)); only the intake is new. Skill: [`public-comment`](../skills/public-comment.html).",
    );
    expect(r.unlinked).toEqual([]);
  });

  test("backticked ids and skills, and lists after Skills:", () => {
    expect(run("calls `Process_ContentChangeReview`").text).toBe("calls [`Process_ContentChangeReview`](content-change-review.html)");
    expect(run("see `review-comments`").text).toBe("see [`review-comments`](../skills/review-comments.html)");
    expect(run("Skills: public-comment, review-comments").text).toBe(
      "Skills: [`public-comment`](../skills/public-comment.html), [`review-comments`](../skills/review-comments.html)",
    );
  });

  test("existing links are left alone", () => {
    const t = "already [Process_ContentChangeReview](x.html) and [`public-comment`](y.html)";
    expect(run(t).text).toBe(t);
  });

  test("what cannot be linked is reported, not silently left", () => {
    const r = run("hands off to Process_Gone. Skill: no-such-skill");
    expect(r.text).toBe("hands off to Process_Gone. Skill: no-such-skill");
    expect(r.unlinked.sort()).toEqual(["Process_Gone", "skill:no-such-skill"]);
  });

  test("a backticked kebab word that is not a skill stays code and is not reported", () => {
    const r = run("run `render-bpmn` first");
    expect(r.text).toBe("run `render-bpmn` first");
    expect(r.unlinked).toEqual([]);
  });
});

describe("escapeAngles", () => {
  test("a placeholder no longer opens an HTML element that swallows the links after it", () => {
    const t = run("a permanent PC/<version> site; handled in Process_ContentChangeReview.").text;
    expect(escapeAngles(t)).toBe(
      "a permanent PC/&lt;version&gt; site; handled in [Process_ContentChangeReview](content-change-review.html).",
    );
  });
  test("code spans keep their brackets", () => {
    expect(escapeAngles("run `pc:release <version>` for <slug>")).toBe("run `pc:release <version>` for &lt;slug&gt;");
  });
});
