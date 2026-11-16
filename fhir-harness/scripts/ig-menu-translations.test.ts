import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Liquid } from "liquidjs";
import { IG_TOPBAR_RE, igTopBar, stageIgSite, UNREVIEWED_MENU_CLASS } from "./build-ig-site.ts";
import { localiseMenu, menuLabels, menuLocales, menuPot, menuSource, writeMenuPots } from "./ig-menu-translations.ts";

const MENU = {
  groups: [
    { label: "Home", href: "index.html", items: [] },
    { label: "Business Requirements", items: [{ label: "Concepts", href: "concepts.html" }, { label: "Use Cases", href: "use_cases.html" }] },
  ],
};
const LABELS = menuLabels(MENU, "ACME IG");
const po = (pairs: [string, string][]) => pairs.map(([i, s]) => `msgid "${i}"\nmsgstr "${s}"`).join("\n\n") + "\n";
const FR = po([["Home", "Accueil"], ["Business Requirements", "Exigences métier"], ["Concepts", "Concepts"], ["ACME IG", "Guide ACME"]]);

function translations(menuPo?: string, node?: Record<string, unknown>): string {
  const d = mkdtempSync(join(tmpdir(), "ig-menu-tr-"));
  mkdirSync(join(d, "fr", "menu"), { recursive: true });
  if (menuPo) writeFileSync(join(d, "fr", "menu", "menu.po"), menuPo);
  if (node) writeFileSync(join(d, "fr", "menu", "menu.json"), JSON.stringify(node));
  return d;
}
const signedNode = (hash: string) => ({ sourceHash: hash, status: { official: true, signedOffBy: "A. Reviewer", signedOffAt: "2026-11-13T00:00:00Z" } });

describe("menu translations (fhir-harness#417)", () => {
  test("the labels are the title, then each group and its items, each once", () => {
    expect(LABELS).toEqual(["ACME IG", "Home", "Business Requirements", "Concepts", "Use Cases"]);
    expect(menuPot(LABELS)).toContain('msgid "Business Requirements"\nmsgstr ""');
  });

  test("a menu catalogue with no review record is not reviewed", () => {
    const fr = menuLocales(translations(FR), LABELS).get("fr")!;
    expect(fr.labels.get("Home")).toBe("Accueil");
    expect(fr.reviewed).toBe(false);
  });

  test("a sign-off against the current labels is reviewed, one against older labels is not", () => {
    const hash = createHash("sha256").update(menuSource(LABELS)).digest("hex").slice(0, 12);
    expect(menuLocales(translations(FR, signedNode(hash)), LABELS).get("fr")!.reviewed).toBe(true);
    const old = createHash("sha256").update(menuSource(["Home"])).digest("hex").slice(0, 12);
    expect(menuLocales(translations(FR, signedNode(old)), LABELS).get("fr")).toMatchObject({ reviewed: false, why: "signed off against an earlier source" });
  });

  test("a catalogue that translates nothing offers no locale", () => {
    expect(menuLocales(translations(po([["Home", ""]])), LABELS).size).toBe(0);
    expect(menuLocales(translations(), LABELS).size).toBe(0);
  });

  test("the localised menu translates labels and points links at translated pages only", () => {
    const fr = menuLocales(translations(FR), LABELS).get("fr")!;
    const m = localiseMenu(MENU, fr, new Set(["concepts.html", "index.html"]));
    expect(m.groups[0]).toMatchObject({ label: "Accueil", href: "fr/index.html" });
    expect(m.groups[1]!.label).toBe("Exigences métier");
    expect(m.groups[1]!.items).toEqual([{ label: "Concepts", href: "fr/concepts.html" }, { label: "Use Cases", href: "use_cases.html" }]);
  });

  test("the bar renders in the page's language, marked when unreviewed, and stays one liftable block", async () => {
    const fr = menuLocales(translations(FR), LABELS).get("fr")!;
    const bar = igTopBar(MENU, "/b", "ACME IG", undefined, [{ locale: "fr", menu: localiseMenu(MENU, fr, new Set(["index.html"])), title: "Guide ACME", home: "fr/index.html", unreviewed: "Non relu par une personne" }]);
    expect(IG_TOPBAR_RE.exec(bar + "\n")![0]).toBe(bar);
    const liquid = new Liquid();
    const onFr = await liquid.parseAndRender(bar, { page: { lang: "fr" } });
    expect(onFr).toContain("<summary>Exigences métier</summary>");
    expect(onFr).toContain('href="/b/fr/index.html">Guide ACME</a>');
    expect(onFr).toContain(`class="${UNREVIEWED_MENU_CLASS}"`);
    expect(onFr).not.toContain("Business Requirements");
    const onEn = await liquid.parseAndRender(bar, { page: { lang: "en" } });
    expect(onEn).toContain("<summary>Business Requirements</summary>");
    expect(onEn).not.toContain(UNREVIEWED_MENU_CLASS);
  });

  test("an unreviewed menu makes every translated page in its locale not reviewed", () => {
    const d = mkdtempSync(join(tmpdir(), "ig-menu-stage-"));
    const src = join(d, "src");
    mkdirSync(join(src, "input", "pagecontent"), { recursive: true });
    writeFileSync(join(src, "sushi-config.yaml"), "id: x.ig\ntitle: ACME IG\n");
    const SRC = "# Hi\n\nHello world.\n";
    writeFileSync(join(src, "input", "pagecontent", "index.md"), SRC);
    mkdirSync(join(src, "translations", "fr", "pagecontent"), { recursive: true });
    mkdirSync(join(src, "translations", "fr", "menu"), { recursive: true });
    writeFileSync(join(src, "translations", "fr", "pagecontent", "index.po"), po([["Hello world.", "Bonjour le monde."]]));
    // The page itself is signed off; only the menu is not.
    writeFileSync(join(src, "translations", "fr", "pagecontent", "index.json"), JSON.stringify(signedNode(createHash("sha256").update(SRC).digest("hex").slice(0, 12))));
    writeFileSync(join(src, "translations", "fr", "menu", "menu.po"), FR);
    stageIgSite(src, join(d, "out"), { menu: MENU, baseurl: "/b" });
    const page = readFileSync(join(d, "out", "fr", "index.md"), "utf-8");
    expect(page).toContain("translation_reviewed: false");
    expect(readFileSync(join(d, "out", "_layouts", "default.html"), "utf-8")).toContain('{% when "fr" %}');
  });

  test("the template is written for each locale, and --check reports a stale one", () => {
    const d = mkdtempSync(join(tmpdir(), "ig-menu-pot-"));
    mkdirSync(join(d, "translations", "fr"), { recursive: true });
    expect(writeMenuPots(d, LABELS, true)).toHaveLength(1);
    expect(writeMenuPots(d, LABELS)).toHaveLength(1);
    expect(existsSync(join(d, "translations", "fr", "menu", "menu.pot"))).toBe(true);
    expect(writeMenuPots(d, LABELS, true)).toHaveLength(0);
  });
});
