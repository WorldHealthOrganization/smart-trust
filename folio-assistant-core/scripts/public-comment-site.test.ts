import { describe, expect, test } from "bun:test";

import type { ReviewAnchors } from "./docx-to-folio.js";
import { type ChangeSet, PublicCommentSchema } from "../schemas/public-comment.js";
import { dashboardHtml, overlaySnippet, safeHref, siteComments, stagingReviewUrl, stagingSlug } from "./public-comment-site.js";
import { dashboardPageRoute, dashboardRoute, toSiteRoot } from "./public-comment-route.js";

const anchors: ReviewAnchors = {
  $schema: "folio-review-anchors/v1",
  document: "doc",
  library: "lib",
  source: { docx: { file: "d", sha256: "a" }, pdf: { file: "p", sha256: "b", pages: 1 } },
  chapters: [],
  sections: [{ label: "sec:1-1", number: "1.1", title: "About", chapter: "ch1" }],
  blocks: [{ label: "prose:1-1-abc", kind: "prose", chapter: "ch1", root: "p-1-1-abc", sections: ["sec:1-1"], hash: "h", excerpt: "x", page: 1, method: "numbered" }],
};

const comment = (over: Record<string, unknown> = {}) =>
  PublicCommentSchema.parse({
    $schema: "public-comment/1.0.0",
    id: "pc-0001",
    summary: "Split <the> definition",
    comment: "Split <the> definition",
    createdAt: "t",
    targetLabel: "prose:1-1-abc",
    status: "editing",
    priority: "medium",
    origin: "human",
    public: {
      ref: "PC-0001",
      source: { channel: "comment-matrix", batch: "m" },
      reviewer: { id: "r-1", organisation: "Org" },
      citation: { raw: "§1.1 p.9 l.42" },
      anchor: { targetLabel: "prose:1-1-abc", method: "page-line", confidence: "high", candidates: [] },
      text: "Split <the> definition",
      decision: { code: "accepted", reason: "", by: "ed", at: "t", changeSet: { branch: "pc/1.1 definitions", pr: 7 } },
    },
    ...over,
  });

describe("public-comment-site", () => {
  test("stagingSlugMatchesWorkflow", () => {
    expect(stagingSlug("pc/1.1 definitions")).toBe("pc-1.1-definitions");
    expect(stagingSlug("--a//b--")).toBe("a-b");
  });

  test("linksPointAtAnchor", () => {
    const [r] = siteComments([comment()], anchors, { slug: "doc", site: "https://o.github.io/r/", repo: "o/r", storeDir: "review/public-comment", openPrs: new Set([7]) });
    expect(r.phase).toBe("editing");
    expect(r.section).toBe("1.1");
    expect(r.links).toMatchObject({
      document: "../en/doc/index.html#prose%3A1-1-abc",
      before: "https://o.github.io/r/en/doc/index.html#prose%3A1-1-abc",
      after: "https://o.github.io/r/branches/pc-1.1-definitions/en/doc/index.html#prose%3A1-1-abc",
      pr: "https://github.com/o/r/pull/7",
      review: "https://o.github.io/r/branches/pc-1.1-definitions/en/review/",
      record: "https://github.com/o/r/blob/main/review/public-comment/comments/PC-0001.json",
    });
  });

  test("prLinksStagingReview", () => {
    expect(stagingReviewUrl("https://o.github.io/r/", "claude/x y")).toBe("https://o.github.io/r/branches/claude-x-y/en/review/");
    expect(stagingReviewUrl(undefined, "b", "https://p.example/STAGING/b/")).toBe("https://p.example/STAGING/b/en/review/");
    expect(stagingReviewUrl(undefined, "b")).toBeUndefined();
    // A comment whose own change has no PR takes the review page of a change-set it is in that has one.
    const c = comment();
    const noPr = PublicCommentSchema.parse({ ...c, status: "triaged", public: { ...c.public, decision: undefined } });
    const cs = { id: "CS-001", title: "t", requirements: "r", refs: ["PC-0001"], status: "editing", issues: [], pr: { number: 9, branch: "claude/cs-1" } } as unknown as ChangeSet;
    const open = new Set([9]);
    const rows = siteComments([noPr], anchors, { slug: "doc", site: "https://o.github.io/r", repo: "o/r", changeSets: [cs], openPrs: open });
    expect(rows[0]!.links.review).toBe("https://o.github.io/r/branches/claude-cs-1/en/review/");
    const html = dashboardHtml(rows, { title: "T", slug: "doc", generated: "g", repo: "o/r", site: "https://o.github.io/r", changeSets: [cs], openPrs: open });
    expect(html).toContain('<a href="https://github.com/o/r/pull/9">#9</a> <a class="review" href="https://o.github.io/r/branches/claude-cs-1/en/review/">review (staging)</a>');
    expect(html).toContain('<a href="https://o.github.io/r/branches/claude-cs-1/en/review/">review (staging)</a>');
    // A merged PR has no preview: no review link, in the rows or the change-set table (owner, 2026-10-30).
    const merged = siteComments([noPr], anchors, { slug: "doc", site: "https://o.github.io/r", repo: "o/r", changeSets: [cs], openPrs: new Set([12]) });
    expect(merged[0]!.links.review).toBeUndefined();
    expect(merged[0]!.changeSets[0]!.review).toBeUndefined();
    expect(dashboardHtml(merged, { title: "T", slug: "doc", generated: "g", repo: "o/r", site: "https://o.github.io/r", changeSets: [cs], openPrs: new Set([12]) })).not.toContain("review (staging)");
    // Open PRs unknown (GitHub not read): no review link rather than a dead one.
    expect(siteComments([noPr], anchors, { slug: "doc", site: "https://o.github.io/r", changeSets: [cs] })[0]!.links.review).toBeUndefined();
    // No PR anywhere: no review link.
    expect(siteComments([noPr], anchors, { slug: "doc", site: "https://o.github.io/r" })[0]!.links.review).toBeUndefined();
  });

  test("dashboardUnderLocale", () => {
    const route = dashboardRoute("/r", "doc");
    const page = dashboardPageRoute("/r", "doc");
    expect(page).toBe(`en/${route}`);
    const records = `${toSiteRoot(page)}${route}/comments.json`;
    const html = dashboardHtml(siteComments([comment({})], anchors, { slug: "doc", toRoot: toSiteRoot(page) }), { title: "T", slug: "doc", generated: "g", toRoot: toSiteRoot(page), records });
    expect(html).toContain(`fetch(${JSON.stringify(records)})`);
    expect(html).toContain(`href="${toSiteRoot(page)}en/doc/index.html"`);
    // Without a records path, the old beside-the-page address.
    expect(dashboardHtml([], { title: "T", slug: "doc", generated: "g" })).toContain('fetch("comments.json")');
  });

  test("commentTextEscaped", () => {
    const rows = siteComments([comment({ summary: "</script><b>x" })], anchors, { slug: "doc" });
    expect(dashboardHtml(rows, { title: "T", slug: "doc", generated: "g" })).not.toContain("<the>");
    expect(overlaySnippet(rows, { dashboard: "../d/index.html" })).not.toContain("</script><b>");
  });

  test("onlySafeHrefs", () => {
    expect(safeHref("https://github.com/o/r/issues/1")).toBe("https://github.com/o/r/issues/1");
    expect(safeHref("HTTP://x.example/")).toBe("HTTP://x.example/");
    expect(safeHref("../en/doc/index.html#a")).toBe("../en/doc/index.html#a");
    expect(safeHref("#PC-0001")).toBe("#PC-0001");
    expect(safeHref("javascript:void(0)")).toBeUndefined();
    expect(safeHref(" Java\tScript:void(0)")).toBeUndefined();
    expect(safeHref("data:text/plain,x")).toBeUndefined();
    expect(safeHref(undefined)).toBeUndefined();
    const rows = siteComments([comment()], anchors, { slug: "doc" });
    rows[0]!.links.discussion = "javascript:void(0)";
    rows[0]!.recommendations = [{ by: "cm", code: "accepted", rationale: "", url: "javascript:void(0)" } as (typeof rows)[0]["recommendations"][0]];
    const cs = { id: "CS-001", title: "t", requirements: "r", refs: ["PC-0001"], status: "discussing", issues: [], committee: "Clinical", committeeMoves: [{ who: "chine", when: "2026-10-16T10:00:00Z", to: "Clinical", why: "w", url: "javascript:void(0)" }] } as unknown as ChangeSet;
    const html = dashboardHtml(rows, { title: "T", slug: "doc", generated: "g", changeSets: [cs] });
    expect(html).not.toContain('href="javascript:');
    expect(html).toContain("discussion");
    expect(html).toContain("cm: accepted");
    expect(html).toContain('<span class="muted">chine, 2026-10-16</span>');
  });

  test("statusTypeEscapedInScript", () => {
    const html = dashboardHtml(siteComments([comment()], anchors, { slug: "doc" }), { title: "T", slug: "doc", generated: "g" });
    expect(html).toContain("h(c[2].textContent)");
    expect(html).toContain("h(c[3].textContent)");
    expect(html).not.toMatch(/\+ c\[[23]\]\.textContent/);
  });

  test("tilesAreToggles", () => {
    const html = dashboardHtml(siteComments([comment({})], anchors, { slug: "doc" }), { title: "T", slug: "doc", generated: "g" });
    for (const key of ["all", "open", "unplaced", "editing", "decided", "incorporated"]) {
      expect(html).toMatch(new RegExp(`<button type="button" class="tile" data-tile="${key}" aria-pressed="false"`));
    }
    expect(html).toMatch(/<tr id="PC-0001" data-phase="\w+" data-status="\w+" data-placed="[01]"/);
  });

  test("searchPreindexedDebounced", () => {
    const html = dashboardHtml(siteComments([comment({})], anchors, { slug: "doc" }), { title: "T", slug: "doc", generated: "g" });
    expect(html).toContain("const commentItems = rows.map((r) =>");
    expect(html).toContain("searchDebounceTimer = setTimeout(() => { apply(); save(false); }, 75)");
    expect(html).toContain("if (it.el.hidden !== !ok) it.el.hidden = !ok");
  });
  test("committeeRolledUp", () => {
    const routed = (ref: string, cat: string) => {
      const c = comment();
      return PublicCommentSchema.parse({ ...c, id: ref.toLowerCase(), public: { ...c.public, ref, labels: { "TWG consideration? AI categorisation": cat } } });
    };
    const rows = siteComments([routed("PC-0001", "Clinical"), routed("PC-0002", "Clinical"), routed("PC-0003", "Core architects")], anchors, { slug: "doc" });
    expect(rows[0]!.committee).toMatchObject({ group: "Clinical", source: "ai" });
    const cs = { id: "CS-001", title: "t", requirements: "r", refs: ["PC-0001", "PC-0002", "PC-0003", "PC-0009"], status: "proposed", issues: [] } as unknown as ChangeSet;
    const html = dashboardHtml(rows, { title: "T", slug: "doc", generated: "g", changeSets: [cs] });
    expect(html).toContain('<tr id="CS-001" data-cs-status="proposed" data-committee="Clinical">');
    expect(html).toContain("<b>Clinical</b> <span class=\"muted\">2 of 4</span>");
    expect(html).toContain("1 not routed");
    expect(html).toContain('<label>Committee<select id="f-committee">');
    expect(html).toMatch(/<tr id="PC-0003"[^>]*data-committee="Core architects"/);
  });
  test("reroutedShowsHistory", () => {
    const routed = (ref: string, cat: string) => {
      const c = comment();
      return PublicCommentSchema.parse({ ...c, id: ref.toLowerCase(), public: { ...c.public, ref, labels: { "TWG consideration? AI categorisation": cat } } });
    };
    const rows = siteComments([routed("PC-0001", "Core architects"), routed("PC-0002", "Core architects")], anchors, { slug: "doc" });
    const cs = {
      id: "CS-001",
      title: "Workflow alignment",
      requirements: "Align workflow.",
      refs: ["PC-0001", "PC-0002"],
      status: "discussing",
      issue: 12,
      issues: [12],
      committee: "Clinical",
      committeeMoves: [
        {
          who: "chine",
          when: "2026-10-16T10:00:00Z",
          from: "Core architects",
          to: "Clinical",
          why: "This is about clinical workflow, not core architecture.",
          url: "https://github.com/o/r/issues/12#issuecomment-1",
        },
      ],
    } as unknown as ChangeSet;
    const html = dashboardHtml(rows, { title: "T", slug: "doc", generated: "g", changeSets: [cs] });
    expect(html).toContain('<tr id="CS-001" data-cs-status="discussing" data-committee="Clinical">');
    expect(html).toContain('<b>Clinical</b> <span class="chip">rerouted</span>');
    expect(html).toContain("move history (1)");
    expect(html).toContain('Core architects → <b>Clinical</b> · <span class="muted"><a href="https://github.com/o/r/issues/12#issuecomment-1">chine</a>, 2026-10-16</span> — This is about clinical workflow, not core architecture.');
    // The Committee filter dropdown includes Clinical even though no individual comment is routed to Clinical.
    expect(html).toContain("<option>Clinical</option>");
  });
  test("editAndFeedbackPerComment", () => {
    const rows = siteComments([comment()], anchors, { slug: "doc", repo: "o/r", storeDir: "review/public-comment" });
    expect(rows[0]!.source).toBe("review/public-comment/comments/PC-0001.json");
    const html = dashboardHtml(rows, { title: "T", slug: "doc", generated: "g", repo: "o/r", actions: { repo: "o/r", branch: "main", content: "doc" }, page: "en/d/index.html" });
    expect(html).toContain('<span class="block-actions" data-block="PC-0001" data-src="review/public-comment/comments/PC-0001.json" data-sec="1.1 About">');
    expect(html).toContain('data-fa-link="edit"');
    expect(html).toContain('data-fa-link="feedback"');
    expect(html).toContain('id="fa-edit-cfg"');
    // Without a repository there is nothing to link to.
    expect(dashboardHtml(rows, { title: "T", slug: "doc", generated: "g" })).not.toContain('data-fa-link="edit"');
  });
});
