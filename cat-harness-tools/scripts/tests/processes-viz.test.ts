/**
 * The processes index must be true before it is useful.
 *
 * Bean `prhr`. Owner, 2026-09-21: *"we also need a processes/ visualization as
 * it is controlled.... its basically a bpmn searcher tool or so."*
 *
 * ## Three defects this file pins, all committed during its own construction
 *
 * 1. **It swept nothing and called that success.** `workflowFiles` takes a
 *    LAYER root; handed the repository root it returns `[]`. The first run
 *    printed *"Wrote processes-index.md — 0 diagram(s)"* and exited 0, over a
 *    corpus of 62. The `dh4f` shape, produced by the generator written to
 *    report it.
 * 2. **It claimed a gap that was not there.** The SVG path was composed from
 *    each `.bpmn`'s own location rather than from the docs layer
 *    `render:bpmn` writes to, so it reported **11 of 62** diagrams as
 *    unrendered — all 8 CRDM and all 3 bootstrap. Every one of those SVGs
 *    exists, and `render:bpmn:check` was green throughout. A finding that
 *    contradicts a passing gate is a finding to verify, not to publish.
 * 3. **It measured with a regex.** The first corpus pass found **30**
 *    `folio:bean` ops; there are **49**. Two legal markup variants were
 *    missed: a `store=` attribute before `op=`, and attributes wrapped onto
 *    the next line. The generator now consumes `loadProcessModel`, the same
 *    bpmn-moddle parse the engine runs.
 *
 * @module cat-harness/scripts/tests/processes-viz.test
 *
 * The tests of this file that read the whole checkout (regenerates the
 * processes page over every layer's diagrams) live in
 * `test/processes-viz-checkout.test.ts` (bean `7zz1`): standing alone,
 * cat-harness has none of it.
 */
import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

import { baseDocsDir } from "../compose-docs.js";
import { instancesCell, instancesRead, NO_INSTANCES, page, pageRelPath, processRows, skillToProcesses } from "../gen-processes-viz.js";
import { ownElementPattern } from "../../schemas/kg/namespaces.ts";
import { HARNESS_ROOT } from "../lib/roots.ts";
import { siteNotBuilt } from "../../test/support/checkout.ts";
import { siteRootFrom } from "../../schemas/kg/visualiser-route.js";
import { PAGE_LOCALE, pageParts } from "../viewer-declarations.js";
import { dirname } from "node:path";

const REPO = resolve(dirname(HARNESS_ROOT));
/** The base docs layer — asked, never spelled; `site-dir-single-answer` refuses a literal. */
const DOCS = baseDocsDir(REPO);

const rows = await processRows(REPO);

describe("the sweep actually swept", () => {
  it("finds diagrams at all", () => {
    // DEFECT 1, pinned. This is the assertion whose absence let a generator
    // report a clean run over 62 files it never opened.
    expect(rows.length).toBeGreaterThan(0);
  });

  it("reaches MORE THAN ONE instance", () => {
    // `workflowFiles` resolves one layer's declared graph plus its
    // dependencies'. `bootstrap` declares its own diagrams and `cat-harness`
    // does not reach them, so a single-root index omits them silently — which
    // is a quieter version of the same defect.
    expect(new Set(rows.map((r) => r.group.split("/")[0])).size).toBeGreaterThan(1);
  });

  it("indexes no decision tables", () => {
    // `.dmn` is a different kind — a table a gateway computes from, with no
    // lanes, skills or activities. Counting them would inflate every number.
    for (const r of rows) expect(r.file.endsWith(".bpmn")).toBe(true);
  });
});

describe("a gap it reports is a gap that exists", () => {
  it("every diagram named as unrendered really has no SVG", () => {
    // DEFECT 2, pinned, in the direction that went wrong. Claiming a missing
    // SVG that is present teaches a reader to discount the whole Findings
    // section.
    for (const r of rows.filter((x) => x.svg === undefined)) {
      const guess = join(DOCS, "assets/img/workflows", `${basename(r.file, ".bpmn")}.svg`);
      expect(existsSync(guess), `${r.file}: reported unrendered, but ${guess} exists`).toBe(false);
    }
  });

  it("and every SVG it names is on disk", () => {
    for (const r of rows) {
      if (r.svg === undefined) continue;
      expect(existsSync(join(REPO, r.svg)), `${r.file}: names ${r.svg}, which is absent`).toBe(true);
    }
  });

  it("a diagram that will not load is reported, never dropped", () => {
    // Omission shrinks every denominator on the page and makes a broken
    // diagram read as one that does not exist.
    for (const r of rows.filter((x) => x.loadError !== undefined)) {
      expect(r.loadError!.length).toBeGreaterThan(0);
      expect(page(rows)).toContain(basename(r.file));
    }
  });
});

describe("the joins are the point", () => {
  const join_ = skillToProcesses(rows);

  it("every skill named by an activity is reachable from the index", () => {
    expect(join_.size).toBeGreaterThan(0);
    const named = new Set(rows.flatMap((r) => r.skills));
    expect([...named].filter((s) => !join_.has(s))).toEqual([]);
  });

  it("the reverse join names files, so two processes running one skill both show", () => {
    const shared = [...join_.values()].filter((fs) => fs.length > 1);
    expect(shared.length, "no skill is run by more than one process — is the join collapsing?").toBeGreaterThan(0);
  });

  it("bean ops come from the parser, not a regex over the text", () => {
    // DEFECT 3, pinned by its consequence: the regex undercounted by 19, so a
    // parser-backed total must EXCEED what a naive `<folio:bean op=` scan finds
    // across the same corpus.
    const parsed = rows.reduce((a, r) => a + r.beanOps.length, 0);
    const naive = rows.reduce((a, r) => {
      const text = readFileSync(join(REPO, r.file), "utf-8");
      return a + new Set([...text.matchAll(ownElementPattern(text, "bean", String.raw`\s+op="([^"]*)"`))].map((m) => m[1]!)).size;
    }, 0);
    expect(parsed).toBeGreaterThanOrEqual(naive);
  });
});

describe("a skill-less activity is a census entry, not an accusation", () => {
  /**
   * THE SECOND FALSE FINDING THIS PAGE SHIPPED, caught the same way as the
   * first — by checking the claim against what the repository already knew.
   *
   * The first version said *"31 activities carry no `<folio:skill ref>`.
   * `bpmn-processes` requires one on every activity"* and listed them as a
   * defect. Beans `luke` and `uuhu` had already worked this corpus from 90
   * down to that remainder and settled it: `luke` — *"coverage is deliberately
   * NOT gated — a human sign-off step has no skill"*; `uuhu` added the
   * call-activity exemption and recorded that its remainder *"are not gaps"*.
   *
   * So the page was accusing 31 deliberate design decisions, in a section a
   * reader is meant to act on. Same shape as the 11 phantom unrendered SVGs,
   * two hours apart, in the same file.
   */
  const withNone = rows.filter((r) => r.activitiesWithoutSkill.length > 0);
  const html = page(rows);

  it("there are some to reason about", () => {
    expect(withNone.length).toBeGreaterThan(0);
  });

  it("does NOT call them a requirement violation", () => {
    // The exact wording that was wrong. A reader who believes this section is
    // a gap list will go and "fix" a stakeholder sign-off by inventing a skill
    // for it.
    expect(html).not.toContain("requires one on every activity");
  });

  it("names the beans that settled it", () => {
    // Without the provenance the census reads as a softened accusation rather
    // than as a decision somebody already made.
    expect(html).toContain("`luke`");
    expect(html).toContain("`uuhu`");
  });

  it("separates call activities, which delegate rather than omit", () => {
    const calls = withNone.flatMap((r) => r.activitiesWithoutSkill).filter((a) => a.type.endsWith("CallActivity"));
    expect(calls.length).toBeGreaterThan(0);
    expect(html).toContain("call activities, which delegate to a subprocess");
  });

  it("and declines to rule on the rest, saying WHY it cannot", () => {
    // The third state, stated rather than hedged: the lane's actor KIND is
    // what would decide, and a free-text lane name does not carry it.
    expect(html).toContain("No verdict is offered");
    expect(html).toContain("actor KIND");
  });

  it("counts roleRef rather than characterising it", () => {
    // An earlier draft said "few of these" and was counting whether the lane
    // had a NAME — a different question with a different answer. A count in
    // prose is a claim; this asserts the number is derived.
    const rest = withNone.flatMap((r) => r.activitiesWithoutSkill).filter((a) => !a.type.endsWith("CallActivity"));
    const n = rest.filter((a) => a.roleRef).length;
    expect(html).toContain(`present on **${n}** of these **${rest.length}** steps`);
    // The CLAIM form, not the words. The page explains the old mistake using
    // the phrase "few of these", and a bare `not.toContain` for it failed on
    // the very sentence documenting the fix — a guard tripping over its own
    // subject's name. What must not come back is the phrase standing where a
    // NUMBER belongs.
    expect(html).not.toMatch(/present on \*\*(?!\d)/);
  });
});

describe("declared and defaulted are different facts", () => {
  it("reports both, and does not merge them", () => {
    // `loadProcessModel` reads an undeclared policy as `strict`, correctly for
    // the engine. A reader wants to know which of those 22-plus-24 was
    // somebody's decision.
    const html = page(rows);
    expect(html).toContain("| enforcement | declared | defaulted |");
    expect(rows.some((r) => !r.enforcementDeclared)).toBe(true);
    expect(rows.some((r) => r.enforcementDeclared)).toBe(true);
  });

  it("a process whose file declares an enforcement VALUE is marked declared", () => {
    for (const r of rows) {
      const xml = readFileSync(join(REPO, r.file), "utf-8");
      const declares = ownElementPattern(xml, "policy", String.raw`[^>]*\benforcement\s*=`, "").test(xml);
      expect(r.enforcementDeclared, `${r.file}`).toBe(declares);
    }
  });

  // This test's NAME said "declares a policy" until 2026-09-22 while its
  // assertion read the enforcement value — the same two-readings-of-one-word
  // defect the module doc now carries, restated one layer in (bean `osyc`).
  // The two oracles are not interchangeable, so the relation between them is
  // asserted rather than left to whichever sentence a reader meets first.
  it("declaring a value implies carrying an element, but not the reverse", () => {
    const element = (f: string) => {
      const xml = readFileSync(join(REPO, f), "utf-8");
      return ownElementPattern(xml, "policy", "", "").test(xml);
    };

    // Subset: every file the page calls `declared` has a policy element.
    for (const r of rows.filter((x) => x.enforcementDeclared)) {
      expect(element(r.file), `${r.file} is marked declared`).toBe(true);
    }

    // Proper subset. The corpus held a witness — a policy element carrying no
    // enforcement value — until bean `30hn` (2026-10-09, "declare explicit
    // policy enforcement on BPMN processes") gave every process an explicit
    // value, as it set out to. So the corpus can no longer show the two
    // oracles disagree, and a corpus-only assertion would now pass however
    // the oracles were merged. The witness is planted instead, from a real
    // declared file with its enforcement values struck out: still a policy
    // element to one oracle, undeclared to the other.
    const declared = rows.find((x) => x.enforcementDeclared);
    expect(declared, "a process declaring an enforcement value").toBeDefined();
    const planted = readFileSync(join(REPO, declared!.file), "utf-8").replace(/\s\benforcement\s*=\s*"[^"]*"/g, "");
    expect(element(declared!.file)).toBe(true);
    expect(ownElementPattern(planted, "policy", "", "").test(planted), "the planted policy is an element").toBe(true);
    expect(
      ownElementPattern(planted, "policy", String.raw`[^>]*\benforcement\s*=`, "").test(planted),
      "and it declares no enforcement",
    ).toBe(false);
  });
});

describe("the committed page is current", () => {
  it("resolves its path from the declaration", () => {
    const rel = pageRelPath(REPO);
    expect(rel).toBeDefined();
    // Declared under the page locale.
    expect(rel!.startsWith(`${PAGE_LOCALE}/`)).toBe(true);
  });

  // Until the committed site is regenerated (folio-assistant#2527) the page is
  // still at the address without the locale. Standing alone it is at neither:
  // it is built at publish and gitignored (bean w1gy F18).
  const declared = pageRelPath(REPO);
  const committed = declared === undefined ? [] : [declared, declared.slice(`${PAGE_LOCALE}/`.length)];
  it.skipIf(
    declared !== undefined &&
      !committed.some((r) => existsSync(join(DOCS, r))) &&
      siteNotBuilt("the processes page `processes:viz` writes at publish (gitignored)", join(DOCS, declared)),
  )("and the page is at that path", () => {
    expect(committed.some((r) => existsSync(join(DOCS, r)))).toBe(true);
  });
});

/**
 * Bean `qgjh`: "emit links wherever the target resolves". The skill → run-by
 * table printed every skill and every diagram as code — 0 links in 99 rows.
 * A skill links to its instruction page only when that page exists, and a
 * diagram links to its own process page; neither becomes a link that 404s.
 */
describe("the skill → run-by table links what resolves (qgjh)", () => {
  const ok = rows.filter((r) => r.loadError === undefined);
  const [skill, files] = [...skillToProcesses(ok)][0]!;
  const tableRow = (html: string): string => html.split("\n").find((l) => l.includes(`\`${skill}\``) && l.includes(basename(files[0]!)))!;

  it("links a skill that has a page, and each diagram to its process page", () => {
    const line = tableRow(page(rows, new Set([skill])));
    // Back to the site root from the processes page, `<locale>/cat-harness/processes/`.
    const up = siteRootFrom(pageParts({ harness: "cat-harness", visualiser: "processes" }));
    expect(line).toContain(`[\`${skill}\`](${up}reference/skill-instructions/${skill}.html)`);
    const stem = ok.find((r) => r.file === files[0])!.stem;
    expect(line).toContain(`](${stem}.html)`);
  });

  it("leaves a skill with no page as code, never a link that 404s", () => {
    const line = tableRow(page(rows, new Set()));
    expect(line.startsWith(`| \`${skill}\` |`)).toBe(true);
  });
});

describe("running instances: links and counts, never a position (bean v49e)", () => {
  const read = instancesRead({
    links: [
      { store: "cat-harness", id: "crdm--a", status: "running", processIds: ["Process_CRDM", "Process_CRDM_Needs"], route: "en/cat-harness/beans/cat-harness/workflows/crdm--a/" },
      { store: "cat-harness", id: "crdm--b", status: "completed", processIds: ["Process_CRDM"], route: "en/cat-harness/beans/cat-harness/workflows/crdm--b/" },
    ],
    unread: [],
  });

  it("links each instance page by the site root plus its declared route", () => {
    expect(instancesCell(read, "Process_CRDM", "../../../")).toBe(
      "[`crdm--a`](../../../en/cat-harness/beans/cat-harness/workflows/crdm--a/); " +
        "1 finished: [`crdm--b`](../../../en/cat-harness/beans/cat-harness/workflows/crdm--b/)",
    );
  });

  it("a subprocess lists the instances that call it", () => {
    expect(instancesCell(read, "Process_CRDM_Needs", "/")).toBe("[`crdm--a`](/en/cat-harness/beans/cat-harness/workflows/crdm--a/)");
  });

  it("says none recorded, and none running when only finished ones exist", () => {
    expect(instancesCell(NO_INSTANCES, "Process_CRDM", "/")).toBe("none recorded");
    const onlyDone = instancesRead({ links: [{ store: "s", id: "x", status: "completed", processIds: ["P"], route: "r/" }], unread: [] });
    expect(instancesCell(onlyDone, "P", "/")).toBe("none running; 1 finished: [`x`](/r/)");
  });

  it("the index carries the column, and names a store it could not read", () => {
    const md = page(rows, new Set(), instancesRead({ links: [], unread: ["cat-harness"] }));
    expect(md).toContain("| process | steps | undocumented steps | running instances |");
    expect(md).toContain("none recorded |");
    expect(md).toContain("Instances of `cat-harness` could not be read in this build");
  });
});
