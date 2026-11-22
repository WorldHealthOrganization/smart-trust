/**
 * The Skills hub `gen-skill-docs` writes at the route of the visualiser
 * `skill-docs` draws (owner card "Skills hub", option A, 2026-11-18): a page
 * that forwards to the skill-instructions index, and names its Tool so
 * `check:visualiser-routes` reads it as the route's own page.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { skillsHub, skillsHubPage } from "../gen-skill-docs.ts";
import { PAGE_LOCALE, renderedByOf } from "../viewer-declarations.ts";

const dirs: string[] = [];
afterAll(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

/** A standalone harness `demo`, declaring `visualisers` as given. */
function harness(visualisers: unknown[]): { root: string; site: string } {
  const co = mkdtempSync(join(tmpdir(), "skills-hub-"));
  dirs.push(co);
  mkdirSync(join(co, ".git"));
  const root = join(co, "demo");
  const site = join(root, "docs");
  mkdirSync(join(site, "reference", "skill-instructions"), { recursive: true });
  writeFileSync(join(root, "demo.json"), JSON.stringify({ name: "demo", directories: [{ id: "skills", path: "skills/", graphTypologies: ["skills"] }], visualisers }));
  return { root, site };
}

describe("skillsHubPage", () => {
  test("names skill-docs as the Tool that drew it", () => {
    expect(renderedByOf(skillsHubPage("../../../reference/skill-instructions/index.html"))).toBe("skill-docs");
  });

  test("forwards to the index, carrying the query and fragment", () => {
    const page = skillsHubPage("../../../reference/skill-instructions/index.html");
    expect(page).toContain(`<link rel="canonical" href="../../../reference/skill-instructions/index.html">`);
    expect(page).toContain(`location.replace("../../../reference/skill-instructions/index.html" + location.search + location.hash)`);
  });

  test("escapes the href in attributes and cannot close its script", () => {
    const page = skillsHubPage(`x"</script><b>&`);
    expect(page).not.toContain(`</script><b>`);
    expect(page).toContain(`href="x&quot;&lt;/script>&lt;b>&amp;"`);
  });
});

describe("skillsHub", () => {
  test("no visualiser drawn by skill-docs: no route, no page", () => {
    const { root, site } = harness([]);
    expect(skillsHub(site, root, "reference/skill-instructions/index")).toBeUndefined();
  });

  test("a declared visualiser: the hub sits at its route and links back up to the index", () => {
    const { root, site } = harness([{ id: "skills", renderedBy: "skill-docs", covers: ["skills"] }]);
    const hub = skillsHub(site, root, "reference/skill-instructions/index");
    expect(hub?.dir).toBe(`${PAGE_LOCALE}/demo/skills`);
    expect(hub?.href).toMatch(/^\.\.\/\.\.\/\.\.\/reference\/skill-instructions\//);
  });
});
