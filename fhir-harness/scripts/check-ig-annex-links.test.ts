import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { annexLinkTargets, checkAnnexLinks, pageIds } from "./check-ig-annex-links";

/** An IG with two pages and a markdown annex on each, as smart-immunizations#81 has. */
function ig(annexes: Record<string, string>): string {
  const at = join(mkdtempSync(join(tmpdir(), "annex-links-")), "an-ig");
  mkdirSync(join(at, "input", "pagecontent"), { recursive: true });
  mkdirSync(join(at, "annexes"), { recursive: true });
  mkdirSync(join(at, "fsh-generated", "resources"), { recursive: true });
  writeFileSync(
    join(at, "an-ig.json"),
    JSON.stringify({ name: "an-ig", version: "0.1.0", directories: [{ id: "an-ig-annexes", path: "annexes/", graphTypologies: ["ig-annex"] }] }),
  );
  writeFileSync(join(at, "input", "pagecontent", "personas.md"), "### Targeted generic personas\n\nText.\n");
  // A no-break space after the enumerator, as the IG's own heading has it.
  writeFileSync(join(at, "input", "pagecontent", "business-processes.md"), "####  A.  Vaccination location registration\n\n####  H .  Resolve duplicates  \n");
  writeFileSync(join(at, "fsh-generated", "resources", "ActorDefinition-HW.json"), "{}");
  const pages: Record<string, string> = { "personas-swimlanes.md": "personas.md", "processes-swimlanes.md": "business-processes.md" };
  writeFileSync(
    join(at, "annexes", "annexes.json"),
    JSON.stringify({ $schema: "ig-annexes/v1", annexes: Object.keys(annexes).map((file) => ({ page: pages[file], file })) }),
  );
  for (const [file, text] of Object.entries(annexes)) writeFileSync(join(at, "annexes", file), text);
  return at;
}

describe("a markdown annex's links are judged from its HOST page", () => {
  test("resolvesHostAndAnnexLinks", () => {
    const at = ig({
      "personas-swimlanes.md": '| <span id="persona-hw"></span>HW | [A](business-processes.html#a--vaccination-location-registration), [H](business-processes.html#h--resolve-duplicates) |\n',
      "processes-swimlanes.md": "| lane | [HW](personas.html#persona-hw) [top](#a--vaccination-location-registration) [actor](ActorDefinition-HW.html) [qa](qa.html) |\n",
    });
    const r = checkAnnexLinks(at);
    expect(r.annexes).toBe(2);
    expect(r.checked).toBe(6);
    expect(r.findings).toEqual([]);
    rmSync(join(at, ".."), { recursive: true, force: true });
  });

  test("missingTargetsAreFindings", () => {
    const at = ig({
      "processes-swimlanes.md": "[a](nowhere.html) [b](personas.html#persona-nobody) [c](#no-such-heading) [d](images/x.png)\n",
    });
    const r = checkAnnexLinks(at);
    expect(r.findings.map((f) => f.target)).toEqual(["nowhere.html", "personas.html#persona-nobody", "#no-such-heading"]);
    expect(r.findings.every((f) => f.annex === "annexes/processes-swimlanes.md" && f.page === "business-processes.md")).toBe(true);
    expect(r.notJudged).toEqual(["annexes/processes-swimlanes.md -> images/x.png"]);
    rmSync(join(at, ".."), { recursive: true, force: true });
  });

  test("noAnnexDirNothingToJudge", () => {
    const at = mkdtempSync(join(tmpdir(), "annex-none-"));
    expect(checkAnnexLinks(at)).toEqual({ annexes: 0, checked: 0, notJudged: [], findings: [] });
    rmSync(at, { recursive: true, force: true });
  });
});

describe("the pieces", () => {
  test("linkTargetsSkipAbsolute", () => {
    expect(annexLinkTargets('[a](x.html#y) [b](https://e.org) [c](/root) [d]({{site.data}}) <a href="z.html">z</a>')).toEqual(["x.html#y", "z.html"]);
  });
  test("pageIdsFromHeadingsAndAttrs", () => {
    expect([...pageIds('### 1. Intro\n## Named {#chosen}\n<span id="s"></span><a name="n"></a>\n')].sort()).toEqual(["chosen", "intro", "n", "s"]);
  });
});
