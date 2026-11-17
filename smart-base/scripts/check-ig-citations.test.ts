/**
 * The IG citation gate, seen failing on planted pages and passing on a
 * migrated one.
 */
import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { adopted, judge, judgePage, knownUrl, normUrl, readBibliography, type Bibliography } from "./check-ig-citations.ts";

const bib = (): Bibliography => ({
  keys: new Set(["voo2021", "w3c-did-core"]),
  pages: new Set(["references/voo2021", "references/w3c-did-core"]),
  urls: new Set([normUrl("https://www.w3.org/TR/did-core/")]),
  ids: new Set(["9789240010567", "10665/334306"]),
  dirs: ["references/"],
});
const B = "en/folio-assistant-core/bibliography/";

describe("check-ig-citations", () => {
  it("passesCitationOfEntryPage", () => {
    expect(judgePage("p.md", `As shown <a href="${B}references/voo2021/">[voo2021]</a> and [[w3c-did-core]](${B}references/w3c-did-core/).`, bib())).toEqual([]);
  });

  it("flagsDanglingEntryPage", () => {
    const f = judgePage("p.md", `See [[x]](${B}references/nope/) and [[v]](${B}catalogue/voo2021/).`, bib());
    expect(f.map((x) => x.rule)).toEqual(["dangling-citation", "dangling-citation"]);
    expect(f[1]!.detail).toBe("bibliography/catalogue/voo2021/ is no entry of the KG bibliography");
  });

  it("flagsAnchorCitationWithItsPage", () => {
    // Clean break (owner, 2026-11-08): no `#ref-` anchors, every one names the page to link instead.
    const f = judgePage("p.md", `See [[v]](${B}#ref-voo2021) and <a href="#ref-nope">(1)</a>.`, bib());
    expect(f.map((x) => x.rule)).toEqual(["anchor-citation", "anchor-citation"]);
    expect(f[0]!.detail).toBe("#ref-voo2021 is an anchor; link the entry's own page, bibliography/references/voo2021/");
    expect(f[1]!.detail).toContain("no entry");
  });

  it("flagsPageReferenceList", () => {
    const f = judgePage("p.md", "### References\n<!-- references:begin style=ul keys=voo2021 -->\n<ul><li>x</li></ul>\n<!-- references:end -->\n", bib());
    expect(f.map((x) => x.rule)).toEqual(["page-reference-list"]);
  });

  it("flagsHandWrittenAndUnlistedReferences", () => {
    const page = [
      "## References",
      "- WHO. Global strategy on digital health 2020-2025.",
      "- Implementation tools:",
      "- [DID Core](https://www.w3.org/TR/did-core)",
      "- [Elsewhere](https://example.org/x)",
      "- [DIIG](https://www.who.int/publications/i/item/9789240010567)",
      "## Next",
      "- [Elsewhere](https://example.org/y)",
    ].join("\n");
    const f = judgePage("p.md", page, bib());
    expect(f.map((x) => `${x.line}:${x.rule}`)).toEqual(["2:hand-written-reference", "5:unlisted-link"]);
  });

  it("referencesMdIsReferencesSection", () => {
    expect(judgePage("input/pagecontent/references.md", "- [x](https://example.org/x)", bib()).map((x) => x.rule)).toEqual(["unlisted-link"]);
    expect(judgePage("p.md", "## Reference Implementations\n- Set Passcode: do it", bib())).toEqual([]);
  });

  it("matchesLinkByIsbnOrIrisHandle", () => {
    expect(knownUrl(bib(), "https://iris.who.int/handle/10665/334306")).toBe(true);
    expect(knownUrl(bib(), "https://www.who.int/publications/i/item/9789241548960")).toBe(false);
  });

  it("readsDeclaredReferencesDirectory", () => {
    const root = mkdtempSync(join(tmpdir(), "igc-"));
    mkdirSync(join(root, "references"));
    mkdirSync(join(root, "input", "pagecontent"), { recursive: true });
    writeFileSync(join(root, "ig.json"), JSON.stringify({ directories: [{ id: "references", path: "references/", graphTypologies: ["references"] }] }));
    writeFileSync(join(root, "references", "k1.json"), JSON.stringify({ id: "k1", URL: "https://example.org/k1" }));
    writeFileSync(join(root, "input", "pagecontent", "a.md"), `[[k1]](${B}references/k1/) [[k2]](${B}references/k2/)\n`);
    const r = judge(root);
    expect(r.bib.dirs).toEqual(["references"]);
    expect(r.findings.map((x) => x.detail)).toEqual(["bibliography/references/k2/ is no entry of the KG bibliography"]);
  });

  it("readsLibraryEntriesAsBibliography", () => {
    const root = mkdtempSync(join(tmpdir(), "igc-lib-"));
    mkdirSync(join(root, "library", "gdhcn-framework"), { recursive: true });
    mkdirSync(join(root, "library", "who", "9789240010567-eng"), { recursive: true });
    writeFileSync(join(root, "ig.json"), JSON.stringify({ directories: [{ id: "library", path: "library/", graphTypologies: ["library"] }] }));
    writeFileSync(join(root, "library", "gdhcn-framework", "manifest.jsonld"), JSON.stringify({ sourceUrl: "https://smart.who.int/trust/Framework.pdf" }));
    writeFileSync(join(root, "library", "who", "9789240010567-eng", "manifest.jsonld"), JSON.stringify({}));
    const b = readBibliography(root);
    expect(b.keys.has("gdhcn-framework")).toBe(true);
    expect(b.keys.has("9789240010567-eng")).toBe(true);
    expect(knownUrl(b, "https://smart.who.int/trust/Framework.pdf")).toBe(true);
    expect(knownUrl(b, "https://www.who.int/publications/i/item/9789240010567")).toBe(true);
    expect(judgePage("p.md", `[[g]](${B}library/gdhcn-framework/)`, b)).toEqual([]);
  });
});

describe("ratchet", () => {
  it("adoptedOnlyWithReferencesDirectory", () => {
    const root = mkdtempSync(join(tmpdir(), "igc-ratchet-"));
    expect(adopted(readBibliography(root))).toBe(false);
    mkdirSync(join(root, "references"));
    writeFileSync(join(root, "ig.json"), JSON.stringify({ directories: [{ path: "references/", graphTypologies: ["references"] }] }));
    expect(adopted(readBibliography(root))).toBe(true);
  });

  it("libraryOnlyIsNotAdopted", () => {
    const root = mkdtempSync(join(tmpdir(), "igc-ratchet-lib-"));
    mkdirSync(join(root, "library"));
    writeFileSync(join(root, "ig.json"), JSON.stringify({ directories: [{ path: "library/", graphTypologies: ["library"] }] }));
    expect(adopted(readBibliography(root))).toBe(false);
  });
});
