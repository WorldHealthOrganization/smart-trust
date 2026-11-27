/**
 * Subject IRIs are paths, not `#fragment`s — litlfred/cat-harness-tools#603.
 *
 * The rule is cat-harness `skills/kg/kg-core/kg-export.md` §"Subject IRIs — a
 * path, not a `#fragment`": `<doc dir>/<kind>/<id>` for a subject, a step
 * `…/process/P/node/T`, a lane `…/process/P/lane/L`, and a flow the one
 * fragment, `…/process/P#flow/F`. Every subject must load, so kg-export writes
 * its `.jsonld` and page. Nothing forwards an old fragment (clean break, #1378).
 */
import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import {
  FRAGMENT_DOCUMENT_STUBS,
  legacyFragmentIri,
  mintsFragments,
  subjectBase,
  subjectFileStem,
  subjectIri,
  subjectPathOf,
} from "../lib/subject-iri.ts";
import { makeIri, writeSubjectDocuments } from "../kg-export.ts";
import { SEARCH_EXCLUDE_MARKER } from "../publish-verify.ts";
import { subgraphIri } from "../subgraph-node.ts";
import { diagramPages, owningProcess } from "../lib/diagram-pages.ts";

const HOST = "https://x.test/site/cat-harness.jsonld";
const CORE = "https://x.test/site/folio-assistant-core/folio-assistant-core.jsonld";
const BASE = "https://x.test/site/folio-assistant-core";

describe("the form", () => {
  test("a subject is <doc dir>/<kind>/<id> — the owner's own example", () => {
    expect(
      makeIri("https://litlfred.github.io/folio-assistant/folio-assistant-core/folio-assistant-core.jsonld", "globalTask", "GT_SeedWorkPlan"),
    ).toBe("https://litlfred.github.io/folio-assistant/folio-assistant-core/globalTask/GT_SeedWorkPlan");
  });

  test("a step and a lane are paths under their process; a flow is a fragment of its page", () => {
    expect(makeIri(CORE, "process", "P")).toBe("https://x.test/site/folio-assistant-core/process/P");
    expect(makeIri(CORE, "process", "P/node/T")).toBe("https://x.test/site/folio-assistant-core/process/P/node/T");
    expect(makeIri(CORE, "process", "P/lane/L")).toBe("https://x.test/site/folio-assistant-core/process/P/lane/L");
    expect(makeIri(CORE, "process", "P/flow/F")).toBe("https://x.test/site/folio-assistant-core/process/P#flow/F");
  });

  test("never `<doc>.jsonld/<kind>/…`, which no static host can serve beside the file", () => {
    expect(makeIri(CORE, "skill", "x")).not.toContain(".jsonld/");
    expect(subjectBase(CORE)).toBe("https://x.test/site/folio-assistant-core/");
  });

  test("only what would end or re-delimit a segment is escaped; `/` nests", () => {
    expect(makeIri(HOST, "decision", "gate/D 1")).toBe("https://x.test/site/decision/gate/D%201");
    expect(makeIri(HOST, "skill", "a#b?c")).toBe("https://x.test/site/skill/a%23b%3Fc");
  });

  test("a document-relative export mints relative subjects, as it minted relative fragments", () => {
    expect(makeIri("cat-harness.jsonld", "skill", "x")).toBe("skill/x");
  });

  test("an unknown kind is refused rather than minted", () => {
    expect(() => makeIri(HOST, "skils", "x")).toThrow(/not a subject kind/);
  });

  test("makeIri and subgraphIri are one minter", () => {
    expect(subgraphIri(CORE, "todos")).toBe(makeIri(CORE, "directory", "todos"));
    expect(subgraphIri(CORE, "todos")).toBe(subjectIri(CORE, "directory", "todos"));
  });
});

describe("telling this document's subjects from everything else", () => {
  test("the host sits at the site root, and still does not claim another instance's subjects", () => {
    expect(subjectPathOf("https://x.test/site/skill/a", HOST)).toBe("skill/a");
    expect(subjectPathOf("https://x.test/site/process/P#flow/F", HOST)).toBe("process/P#flow/F");
    expect(subjectPathOf(makeIri(CORE, "skill", "a"), HOST)).toBeUndefined();
    expect(subjectPathOf("https://x.test/site/tools/t.jsonld", HOST)).toBeUndefined();
    expect(subjectPathOf(HOST, HOST)).toBeUndefined();
    expect(subjectPathOf("https://x.test/site/ns#Skill", HOST)).toBeUndefined();
  });

  test("the pre-#603 fragment is recovered exactly, a flow's `#flow/` folded back", () => {
    expect(legacyFragmentIri(makeIri(CORE, "globalTask", "G"), CORE)).toBe(`${CORE}#globalTask/G`);
    expect(legacyFragmentIri(makeIri(CORE, "process", "P/node/T"), CORE)).toBe(`${CORE}#process/P/node/T`);
    expect(legacyFragmentIri(makeIri(CORE, "process", "P/flow/F"), CORE)).toBe(`${CORE}#process/P/flow/F`);
    expect(legacyFragmentIri("https://x.test/elsewhere", CORE)).toBeUndefined();
  });

  // #603 decision 1b (owner, 2026-10-23): the host's document moved from the
  // site root to `<site>/<name>/` in the same release, so its old fragments
  // are of the ROOT document, not the one that now holds the subject.
  test("a document that moved names its old fragments by the old document", () => {
    const moved = "https://x.test/site/cat-harness/cat-harness.jsonld";
    const iri = makeIri(moved, "skill", "a");
    expect(iri).toBe("https://x.test/site/cat-harness/skill/a");
    expect(legacyFragmentIri(iri, moved, HOST)).toBe(`${HOST}#skill/a`);
    expect(legacyFragmentIri(iri, moved)).toBe(`${moved}#skill/a`);
    expect(legacyFragmentIri(makeIri(moved, "process", "P/flow/F"), moved, HOST)).toBe(`${HOST}#process/P/flow/F`);
  });

  test("a subject's files sit at its path; a flow has none; nothing escapes the directory", () => {
    expect(subjectFileStem(makeIri(CORE, "decision", "gate/D 1"), CORE)).toBe("decision/gate/D 1");
    expect(subjectFileStem(makeIri(CORE, "process", "P/flow/F"), CORE)).toBeUndefined();
    expect(subjectFileStem("https://x.test/site/folio-assistant-core/skill/..", CORE)).toBeUndefined();
  });
});

describe("bootstrap's document mints paths too (#958)", () => {
  const BOOT = "https://x.test/site/bootstrap/bootstrap.jsonld";

  test("links into bootstrap's document name its subject paths", () => {
    expect(mintsFragments(BOOT)).toBe(false);
    expect(makeIri(BOOT, "skill", "discussion")).toBe("https://x.test/site/bootstrap/skill/discussion");
    expect(makeIri(BOOT, "process", "P/flow/F")).toBe("https://x.test/site/bootstrap/process/P#flow/F");
    expect(subjectPathOf("https://x.test/site/bootstrap/skill/discussion", BOOT)).toBe("skill/discussion");
  });

  test("no document is left on fragments", () => {
    expect([...FRAGMENT_DOCUMENT_STUBS]).toEqual([]);
  });
});

describe("every subject loads: its own .jsonld and page", () => {
  const DOC = "https://x.test/site/folio-assistant-core/folio-assistant-core.jsonld";
  const ctx = { name: "https://x.test/ns#name" };
  const node = (id: string, type: string, extra: Record<string, unknown> = {}) => ({ "@id": makeIri(DOC, ...splitKind(id)), "@type": `https://x.test/ns#${type}`, ...extra });
  function splitKind(id: string): [string, string] {
    const i = id.indexOf("/");
    return [id.slice(0, i), id.slice(i + 1)];
  }
  const graph = [
    node("skill/a", "Skill", { name: "a", title: "</script><b>A</b>" }),
    node("process/P", "Process", { name: "P" }),
    node("process/P/node/T", "ProcessNode", { partOf: makeIri(DOC, "process", "P") }),
    node("process/P/lane/L", "Lane"),
    node("process/P/flow/F", "SequenceFlow", { from: makeIri(DOC, "process", "P/node/T") }),
    // Not this document's: another layer's subject, and a Tool beside it.
    { "@id": makeIri(HOST, "skill", "z"), "@type": "https://x.test/ns#Skill" },
    { "@id": "https://x.test/site/folio-assistant-core/tools/t.jsonld", "@type": "https://x.test/ns#Tool" },
  ];
  const published = { "@context": ctx, "@id": DOC, "@graph": graph };

  test("the writer puts a .jsonld and a page at every subject's path, and nothing else", () => {
    const dir = mkdtempSync(join(tmpdir(), "subject-docs-"));
    try {
      const out = join(dir, "folio-assistant-core.jsonld");
      const written = writeSubjectDocuments(published, out).map((f) => relative(dir, f)).sort();
      expect(written).toEqual(
        [
          "folio-assistant-core.context.jsonld",
          "process/P.html",
          "process/P.jsonld",
          // A subject with subjects under it also answers as a directory.
          "process/P/index.html",
          "process/P/lane/L.html",
          "process/P/lane/L.jsonld",
          "process/P/node/T.html",
          "process/P/node/T.jsonld",
          "skill/a.html",
          "skill/a.jsonld",
        ].sort(),
      );

      // The context once, beside the document; each subject names it.
      expect(JSON.parse(readFileSync(join(dir, "folio-assistant-core.context.jsonld"), "utf-8"))).toEqual({ "@context": ctx });
      const step = JSON.parse(readFileSync(join(dir, "process/P/node/T.jsonld"), "utf-8"));
      expect(step["@context"]).toBe("https://x.test/site/folio-assistant-core/folio-assistant-core.context.jsonld");
      expect(step["@id"]).toBe("https://x.test/site/folio-assistant-core/process/P/node/T.jsonld");
      expect(step.partOf).toBe(DOC);
      expect(step["@graph"].map((n: { "@id": string }) => n["@id"])).toEqual(["https://x.test/site/folio-assistant-core/process/P/node/T"]);

      // A flow is a fragment of its process's page: in its document, and an anchor on its page.
      const proc = JSON.parse(readFileSync(join(dir, "process/P.jsonld"), "utf-8"));
      expect(proc["@graph"].map((n: { "@id": string }) => n["@id"])).toEqual([
        "https://x.test/site/folio-assistant-core/process/P",
        "https://x.test/site/folio-assistant-core/process/P#flow/F",
      ]);
      expect(readFileSync(join(dir, "process/P.html"), "utf-8")).toContain('id="flow/F"');
      expect(existsSync(join(dir, "process/P/flow"))).toBe(false);

      // The page carries the same JSON-LD, and no value can close its script early.
      const page = readFileSync(join(dir, "skill/a.html"), "utf-8");
      expect(page).toContain('<link rel="alternate" type="application/ld+json" href="a.jsonld">');
      // Excluded from the site search on purpose, with the marker the
      // publish check reads (fa#2683): a node page is not a page the index missed.
      expect(page).toContain(SEARCH_EXCLUDE_MARKER);
      const script = /<script type="application\/ld\+json">\n([^]*?)\n<\/script>/.exec(page)![1]!;
      expect(script).not.toContain("</script>");
      expect(JSON.parse(script)["@graph"][0].title).toBe("</script><b>A</b>");
      expect(page).toContain("&lt;/script&gt;&lt;b&gt;A&lt;/b&gt;");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  test("a preview's stamp is in each subject's .jsonld but not in its page (bean g196, Q-S1-1 A)", () => {
    const dir = mkdtempSync(join(tmpdir(), "subject-stamp-"));
    // input-site: inert #ffead03e — saves the environment to restore it after the test, or strips names before handing it to a child; no assertion reads the values
    const keep = { GITHUB_SHA: process.env.GITHUB_SHA, KG_BRANCH: process.env.KG_BRANCH, GITHUB_RUN_ID: process.env.GITHUB_RUN_ID };
    try {
      // input-site: inert #8a0b229e — sets the test's own variables, or hands the environment whole to a child; no value is read here
      Object.assign(process.env, { GITHUB_SHA: "feedc0de1234", KG_BRANCH: "feat/x", GITHUB_RUN_ID: "4242" });
      const stamped = { ...published, staging: { branch: "feat/x", sha: "feedc0de1234", pr: "1/merge", run: "4242" } };
      writeSubjectDocuments(stamped, join(dir, "folio-assistant-core.jsonld"));
      const data = JSON.parse(readFileSync(join(dir, "process/P/node/T.jsonld"), "utf-8"));
      expect(data.staging.sha).toBe("feedc0de1234");
      for (const f of ["process/P/node/T.html", "process/P.html", "process/P/index.html"]) {
        const page = readFileSync(join(dir, f), "utf-8");
        expect(page).not.toContain("feedc0de1234");
        expect(page).not.toContain('"staging"');
        // Positive control: the page still embeds its document.
        expect(page).toContain('"partOf"');
      }
    } finally {
      for (const [k, v] of Object.entries(keep)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
      rmSync(dir, { recursive: true, force: true });
    }
  });
  test("served somewhere its IRI does not name: a copy here, sameAs the canonical subject document (#638 option B)", () => {
    const dir = mkdtempSync(join(tmpdir(), "subject-copy-"));
    try {
      const served = "https://mirror.test/folio/folio-assistant-core/folio-assistant-core.jsonld";
      writeSubjectDocuments(published, join(dir, "folio-assistant-core.jsonld"), served);
      const step = JSON.parse(readFileSync(join(dir, "process/P/node/T.jsonld"), "utf-8"));
      // The copy is named by where it is served, and its context loads from there.
      expect(step["@id"]).toBe("https://mirror.test/folio/folio-assistant-core/process/P/node/T.jsonld");
      expect(step["@context"]).toBe("https://mirror.test/folio/folio-assistant-core/folio-assistant-core.context.jsonld");
      expect(step.partOf).toBe(served);
      expect(step.sameAs).toBe("https://x.test/site/folio-assistant-core/process/P/node/T.jsonld");
      // The node keeps its canonical identity.
      expect(step["@graph"][0]["@id"]).toBe("https://x.test/site/folio-assistant-core/process/P/node/T");
      expect(readFileSync(join(dir, "process/P/node/T.html"), "utf-8")).toContain("owl:sameAs");

      // Served where its IRI says: no copy, no sameAs.
      writeSubjectDocuments(published, join(dir, "folio-assistant-core.jsonld"), DOC);
      const same = JSON.parse(readFileSync(join(dir, "process/P/node/T.jsonld"), "utf-8"));
      expect(same["@id"]).toBe("https://x.test/site/folio-assistant-core/process/P/node/T.jsonld");
      expect(same.sameAs).toBeUndefined();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  test("a process, its steps and its lanes link to the diagram; nothing else does (#638, owner's 3a)", () => {
    const dir = mkdtempSync(join(tmpdir(), "subject-diagram-"));
    try {
      const diagram = "https://x.test/site/en/cat-harness/processes/p.html";
      writeSubjectDocuments(published, join(dir, "folio-assistant-core.jsonld"), undefined, new Map([[`${BASE}/process/P`, diagram]]));
      const link = `<a href="${diagram}">diagram</a>`;
      for (const f of ["process/P.html", "process/P/index.html", "process/P/node/T.html", "process/P/lane/L.html"]) {
        expect(readFileSync(join(dir, f), "utf-8")).toContain(link);
      }
      expect(readFileSync(join(dir, "skill/a.html"), "utf-8")).not.toContain(">diagram</a>");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  test("a page sits in the site's content column, follows the site's light/dark switch, and names its parent (owner, 2026-10-31)", () => {
    const dir = mkdtempSync(join(tmpdir(), "subject-page-"));
    try {
      writeSubjectDocuments(published, join(dir, "folio-assistant-core.jsonld"));
      const step = readFileSync(join(dir, "process/P/node/T.html"), "utf-8");
      const P = makeIri(DOC, "process", "P");
      // The content column `page-layout.css` styles beside the rail, not a bare body.
      expect(step).toContain('<main class="fa-page-main">');
      // Dark by the reader's pick as well as the OS: `data-fa-scheme`, not the media query alone.
      expect(step).toContain(':root[data-fa-scheme="dark"]');
      expect(step).not.toMatch(/@media \(prefers-color-scheme: dark\) \{ :root \{/);
      // The parent process by its NAME, linked, at the top and in its row; the IRI under it.
      expect(step).toContain(`<p>Part of <a href="${P}">P</a></p>`);
      expect(step).toContain(`<a href="${P}">P</a><br><span class="iri muted">${P}</span>`);
      // A node with no name in the graph keeps its IRI as the link text, and it wraps.
      const lane = readFileSync(join(dir, "process/P/lane/L.html"), "utf-8");
      expect(lane).not.toContain("<p>Part of");
      // Every subject page carries data-fa-pin and a pin-to-folio control (cat-harness#982).
      expect(step).toContain(`data-fa-pin="${makeIri(DOC, "process", "P/node/T")}"`);
      expect(step).toContain('data-fa-pin-kind="pin"');
      expect(step).toContain('data-fa-pin-node-kind="processes"');
      expect(step).toContain('data-fa-pin-control');
      const skill = readFileSync(join(dir, "skill/a.html"), "utf-8");
      expect(skill).toContain(`data-fa-pin="${makeIri(DOC, "skill", "a")}"`);
      expect(skill).toContain('data-fa-pin-node-kind="skills"');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("the diagram page a subject links to", () => {
  test("a step and a lane belong to their process; a skill to none", () => {
    expect(owningProcess(`${BASE}/process/P/node/T`, "process/P/node/T")).toBe(`${BASE}/process/P`);
    expect(owningProcess(`${BASE}/process/P/lane/L`, "process/P/lane/L")).toBe(`${BASE}/process/P`);
    expect(owningProcess(`${BASE}/process/P`, "process/P")).toBe(`${BASE}/process/P`);
    expect(owningProcess(`${BASE}/skill/a`, "skill/a")).toBeUndefined();
  });
  test("found from the depiction, never guessed: no published picture, no link", () => {
    const pages = diagramPages({
      "@graph": [
        { "@id": `${BASE}/process/Q`, depiction: "https://x.test/site/assets/img/workflows/no-such-diagram-xyz.svg" },
        { "@id": `${BASE}/process/R` },
      ],
    });
    expect(pages.size).toBe(0);
  });
});
