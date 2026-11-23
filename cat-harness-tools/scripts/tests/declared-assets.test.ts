/**
 * Declared assets exist, and their links resolve.
 *
 * @module scripts/tests/declared-assets.test
 *
 * The property `v8gh` needed and nobody had: not "somebody wrote an AGENTS.md
 * checker" but "the file is declared, so a checker has a reason to look".
 */
import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { AGENT_INSTRUCTIONS_ROLE, declaredAssets, repoRootFor } from "../../schemas/kg/cat-harness.js";
import { auditInstance, isCheckable, markdownLinks } from "../check-declared-assets.js";
import { movesResolver } from "../check-agent-entry-links.js";
import { writeDeclaration } from "../../test/support/instance-fixture.js";
import { checkIndexRender, leadParagraph, renderIndex } from "../index-render.js";

const ROOT = resolve(import.meta.dir, "../..");

function instance(assets: unknown[], files: Record<string, string> = {}): string {
  const root = mkdtempSync(join(tmpdir(), "assets-"));
  writeDeclaration(root, JSON.stringify({ name: "t", assets }));
  for (const [rel, body] of Object.entries(files)) {
    mkdirSync(join(root, rel, ".."), { recursive: true });
    writeFileSync(join(root, rel), body);
  }
  return root;
}

describe("this repository's own declarations", () => {
  test("both instances declare their agent instructions", () => {
    // The gap that started this: `AGENTS.md` was the only root artefact in
    // neither `directories[]` nor `images[]`.
    for (const inst of [ROOT, join(repoRootFor(ROOT), "bootstrap")]) {
      const agents = declaredAssets(inst).filter((a) => a.role === AGENT_INSTRUCTIONS_ROLE);
      expect(agents).toHaveLength(1);
      expect(agents[0]!.exists).toBe(true);
    }
  });

  test("no declared asset is missing and no link is dead", () => {
    for (const inst of [ROOT, join(repoRootFor(ROOT), "bootstrap")]) {
      expect(auditInstance(inst).findings).toEqual([]);
    }
  });

  test("the provenance sits on the file bootstrap actually copies — and that file is RENDERED", () => {
    // Absent `source` is a THIRD STATE — authored here — and is a different
    // fact from an upstream that cannot be reached.
    //
    // Which file carries it has moved twice. In #592 cat-harness stopped
    // declaring the REPOSITORY's AGENTS.md as its own and the bootstrap
    // provenance went to the root declaration's `agent-instructions` asset,
    // because the root's is the file bootstrap copies at initialisation. Then
    // the root stopped declaring any layer at all (owner, 2026-10-08), and
    // the owner ruled on 2026-10-09 that the root AGENTS.md and README are
    // RENDERED files (option a). So the provenance is no longer a `source`
    // field anybody could forget to move: the renderer QUOTES bootstrap's
    // AGENTS.md as the cold start and names it, and the root file is checked
    // to be the renderer's current output. All three halves are asserted,
    // because moving the provenance onto the wrong file is exactly as wrong as
    // dropping it.
    const repo = repoRootFor(ROOT);
    const boot = declaredAssets(join(repo, "bootstrap")).find((a) => a.id === "agent-instructions");
    const harness = declaredAssets(ROOT).find((a) => a.id === "agent-instructions");
    expect(boot!.source).toBeUndefined();
    expect(harness!.source).toBeUndefined();

    // The root declares nothing, so nothing there carries a `source`...
    expect(declaredAssets(repo)).toEqual([]);
    // ...and the root file names bootstrap's as what it quotes, as rendered.
    const r = renderIndex(repo);
    if (r.state !== "ok") throw new Error(`index:render could not render: ${JSON.stringify(r)}`);
    expect(r.files["AGENTS.md"]).toContain("](bootstrap/AGENTS.md)");
    expect(checkIndexRender(repo)).toEqual({ state: "current" });
  });

  test("every relative link out of the rendered root files resolves", () => {
    // What `check:declared-assets` asked of the root's DECLARED AGENTS.md and
    // README while it had a declaration, asked of the rendered files now: a
    // generated link is worse than a missing one, because it asserts the
    // target exists.
    const repo = repoRootFor(ROOT);
    for (const f of ["AGENTS.md", "README.md", "CLAUDE.md", "GEMINI.md"]) {
      const text = readFileSync(join(repo, f), "utf-8");
      const dead = markdownLinks(text)
        .filter(isCheckable)
        .map((t) => t.split("#")[0]!)
        .filter((t) => t !== "" && !existsSync(join(repo, decodeURI(t))));
      expect([f, dead]).toEqual([f, []]);
    }
  });
});

describe("the gate catches what v8gh measured", () => {
  test("a link broken by a directory move is a finding", () => {
    // `docs/guides/agent-onboarding.md` is the REAL path from v8gh: it moved
    // under `docs/folio-assistant/`, and it is the one AGENTS.md's own banner
    // calls the place to start, so a cold agent following it hit a 404.
    const root = instance(
      [{ id: "a", src: "AGENTS.md", role: AGENT_INSTRUCTIONS_ROLE }],
      { "AGENTS.md": "[start here](docs/guides/agent-onboarding.md)\n" },
    );
    const { findings } = auditInstance(root);
    rmSync(root, { recursive: true, force: true });
    expect(findings.map((f) => f.kind)).toEqual(["dead-link"]);
  });

  test("a declared asset that is not on disk is a finding, never a skip", () => {
    // Unlike a conventional DIRECTORY, which may simply be one this layer
    // did not take up, a declared asset is an assertion.
    const root = instance([{ id: "gone", src: "NOPE.md" }]);
    const { findings } = auditInstance(root);
    rmSync(root, { recursive: true, force: true });
    expect(findings[0]!.kind).toBe("missing");
  });

  test("a resolving link is not a finding", () => {
    const root = instance(
      [{ id: "a", src: "AGENTS.md" }],
      { "AGENTS.md": "[there](README.md)\n", "README.md": "hi\n" },
    );
    const { findings } = auditInstance(root);
    rmSync(root, { recursive: true, force: true });
    expect(findings).toEqual([]);
  });

  test("a link into a declared directory this checkout does not mount is not checked, not dead", () => {
    // dth-hrh mounts a chosen list of smart-base's directories, leaving out
    // `smart-base-site-docs`, and smart-base's README links into it.
    const root = mkdtempSync(join(tmpdir(), "assets-unmounted-"));
    writeDeclaration(
      root,
      JSON.stringify({ name: "t", assets: [{ id: "readme", src: "README.md" }], directories: [{ id: "t-site-docs", path: "site-docs/", graphTypologies: ["docs"] }] }),
    );
    writeFileSync(join(root, "README.md"), "[guide](site-docs/source/guide/)\n[gone](elsewhere/x.md)\n");
    const r = auditInstance(root);
    rmSync(root, { recursive: true, force: true });
    expect(r.findings.map((f) => [f.kind, f.detail])).toEqual([["dead-link", "elsewhere/x.md"]]);
    expect(r.notChecked).toBe(1);
  });

  test("a dead link inside a declared directory that IS mounted is still a finding", () => {
    const root = mkdtempSync(join(tmpdir(), "assets-mounted-"));
    writeDeclaration(
      root,
      JSON.stringify({ name: "t", assets: [{ id: "readme", src: "README.md" }], directories: [{ id: "t-site-docs", path: "site-docs/", graphTypologies: ["docs"] }] }),
    );
    mkdirSync(join(root, "site-docs"), { recursive: true });
    writeFileSync(join(root, "README.md"), "[guide](site-docs/missing.md)\n");
    const { findings } = auditInstance(root);
    rmSync(root, { recursive: true, force: true });
    expect(findings.map((f) => f.kind)).toEqual(["dead-link"]);
  });

  test("an instance declaring no assets is clean, not an error", () => {
    const root = instance([]);
    expect(auditInstance(root).findings).toEqual([]);
    rmSync(root, { recursive: true, force: true });
  });
});

describe("what it will not pretend to have checked", () => {
  test("external links and anchors are NOT checkable", () => {
    // Counted as "not checked" rather than clean: could-not-determine
    // rendered as a pass is how a sweep blind on one check clears the others.
    expect(isCheckable("https://example.org")).toBe(false);
    expect(isCheckable("mailto:a@b.c")).toBe(false);
    expect(isCheckable("#section")).toBe(false);
    expect(isCheckable("docs/x.md")).toBe(true);
    expect(isCheckable("../up.md")).toBe(true);
  });

  test("links inside fenced code are not links", () => {
    // A README's shell examples are full of brackets; same reasoning as
    // `readme-links.ts`'s own fence stripping.
    const src = "real [a](a.md)\n```\nfake [b](b.md)\n```\n";
    expect(markdownLinks(src)).toEqual(["a.md"]);
  });
});

describe("leadParagraph reads headings the way a reader does", () => {
  test("a setext title and an unseparated ATX heading are not prose (smart-trust's IG README)", () => {
    const md = "<!--badges-->\n![b](x.png)\n<!--/badges-->\nWHO SMART Trust \n--- \nThis is the guide\n###\n### Publication\nPublished here.\n";
    expect(leadParagraph(md)).toBe("This is the guide");
  });

  test("a thematic break is not a lead paragraph, and an ATX h1 still opens the body", () => {
    expect(leadParagraph("# T\n\n---\n\nThe lead.\n")).toBe("The lead.");
  });
});

// folio-assistant-tsh9: an asset's link into a path the layer moved is
// `moved`, not `dead-link`, until the move's `until` (sdlc skill `two-phase-move`).
describe("a declared move", () => {
  const moved = (until: string): string => {
    const root = mkdtempSync(join(tmpdir(), "assets-moves-"));
    writeDeclaration(root, JSON.stringify({ name: "t", assets: [{ id: "a", src: "AGENTS.md" }], moves: [{ from: "old", to: "new", until }] }));
    mkdirSync(join(root, "new"), { recursive: true });
    writeFileSync(join(root, "new/x.md"), "x\n");
    writeFileSync(join(root, "AGENTS.md"), "[x](old/x.md)\n");
    return root;
  };

  test("in the window the link is reported as moved", () => {
    const root = moved("2026-12-31");
    const { findings } = auditInstance(root, movesResolver(root, "2026-11-05"));
    rmSync(root, { recursive: true, force: true });
    expect(findings.map((f) => f.kind)).toEqual(["moved"]);
  });

  test("past `until` it is a dead link again", () => {
    const root = moved("2026-11-04");
    const { findings } = auditInstance(root, movesResolver(root, "2026-11-05"));
    rmSync(root, { recursive: true, force: true });
    expect(findings.map((f) => f.kind)).toEqual(["dead-link"]);
  });
});
