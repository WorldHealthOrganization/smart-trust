import { describe, expect, it } from "bun:test";
import { compose, localeData, localizedArchimateFiles, potEntries, scriptStrings, translateModel, type SiteFile } from "./archimate-locales.ts";

const TITLE = "Demo on the RA";
const model = {
  name: TITLE,
  elements: [
    { id: "e1", type: "BusinessActor", name: "Clinic", documentation: "A clinic.", folder: ["Business", "Actors"] },
    { id: "e2", type: "ApplicationComponent", name: "Registry" },
  ],
  relationships: [{ id: "r1", type: "Serving", source: "e2", target: "e1" }],
  views: [{ id: "v1", name: "Overview" }],
  inViews: {},
  slugs: {},
};
const page = (path: string, title: string, h1: string, body = "", typeOf = "archimate:BusinessActor") =>
  `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><title>${title}</title></head><body>` +
  `<main class="am" typeof="${typeOf}" data-kg-model="../../../../../archimate/m/model.json"${path.includes("/view/") ? ' data-kg-svg="../../../../../archimate/m/view/v1.svg"' : ""}>` +
  `<h1>${h1}</h1>${body}<div class="am-body"><p>Loading the element…</p></div></main></body></html>`;
const files: SiteFile[] = [
  { path: "en/demo/archimate/m/index.html", page: true, content: page("m", TITLE, TITLE, "", "archimate:Model") },
  { path: "en/demo/archimate/m/element/clinic/index.html", page: true, content: page("e", `Clinic — ${TITLE}`, "Clinic", '<p class="am-kind">Business Actor · Business</p>') },
  { path: "en/demo/archimate/m/relationship/r1/index.html", page: true, content: page("r", `Serving: Registry → Clinic — ${TITLE}`, "Serving") },
  { path: "en/demo/archimate/m/view/overview/index.html", page: true, content: page("/view/", `Overview — ${TITLE}`, "Overview", "", "archimate:Diagram") },
  { path: "archimate/m/model.json", content: JSON.stringify(model) },
  {
    path: "archimate/m/view/v1.svg",
    content: '<svg xmlns="http://www.w3.org/2000/svg"><a href="../../../en/demo/archimate/m/element/clinic/"><title>Clinic (Business Actor)</title><text x="10" y="10">Clinic</text></a><title>id-0123456789abcdef0123456789abcdef</title></svg>',
  },
  { path: "archimate/m/element/e1.html", content: "<!doctype html><html><head><title>Clinic</title></head><body>stub</body></html>" },
];
const fr = new Map([
  [TITLE, "Démo sur l’AR"],
  ["Clinic", "Clinique"],
  ["Registry", "Registre"],
  ["Serving", "Service"],
  ["Business Actor", "Acteur métier"],
  ["Overview", "Vue d’ensemble"],
  ["A clinic.", "Une clinique."],
  ["Views", "Vues"],
]);

describe("the words archimate.js writes", () => {
  it("are its T() and F() strings, those with no words left out", () => {
    const got = scriptStrings('T("Views"); F("{0} views · {1} elements", a, b); F("{0} ({1})", x, y); T("None.")');
    expect(got).toEqual(["Views", "{0} views · {1} elements", "None."]);
  });
  it("are all wrapped in the shipped script", () => {
    const got = scriptStrings();
    expect(got).toContain("Relationships ({0})");
    expect(got).toContain("No documentation.");
    expect(got).toContain("Could not load {0}: {1}");
  });
});

describe("compose", () => {
  const types = new Set(["Serving", "Business Actor"]);
  const get = (x: string) => fr.get(x);
  it("translates a page title, a relationship and a typed name part by part", () => {
    expect(compose(`Clinic — ${TITLE}`, get, types, TITLE)).toBe("Clinique — Démo sur l’AR");
    expect(compose(`Serving: Registry → Clinic — ${TITLE}`, get, types, TITLE)).toBe("Service: Registre → Clinique — Démo sur l’AR");
    expect(compose("Clinic (Business Actor)", get, types)).toBe("Clinique (Acteur métier)");
  });
  it("gives nothing when a part has no translation, or the type is not the model's", () => {
    expect(compose("Serving: Registry → Pharmacy", get, types)).toBeUndefined();
    expect(compose("Strategy: what it can do", get, types)).toBeUndefined();
  });
});

describe("the template", () => {
  const ids = potEntries(files).map((e) => e.msgid);
  it("holds the pages' words, the model's, the drawings' and the script's", () => {
    for (const id of [TITLE, "Clinic", "Registry", "A clinic.", "Actors", "Business Actor", "Serving", "Views", "Relationships ({0})"]) expect(ids).toContain(id);
  });
  it("leaves out what is composed of other entries, and Archi ids", () => {
    expect(ids).not.toContain(`Clinic — ${TITLE}`);
    expect(ids).not.toContain(`Serving: Registry → Clinic — ${TITLE}`);
    expect(ids).not.toContain("Clinic (Business Actor)");
    expect(ids.some((i) => i.startsWith("id-"))).toBe(false);
  });
});

describe("localizedArchimateFiles", () => {
  const { files: out, reports } = localizedArchimateFiles(files, new Map([["fr", fr]]));
  const at = (p: string) => out.find((f) => f.path === p)?.content ?? "";
  it("writes each page under the locale, translated, its title composed", () => {
    const el = at("fr/demo/archimate/m/element/clinic/index.html");
    expect(el).toContain('<html lang="fr"');
    expect(el).toContain("<title>Clinique — Démo sur l’AR</title>");
    expect(el).toContain("<h1>Clinique</h1>");
    expect(at("fr/demo/archimate/m/relationship/r1/index.html")).toContain("<title>Service: Registre → Clinique — Démo sur l’AR</title>");
    expect(reports[0]).toMatchObject({ locale: "fr", pages: 4 });
  });
  it("points the page at the locale's model and drawing, and carries the script's catalogue", () => {
    const v = at("fr/demo/archimate/m/view/overview/index.html");
    expect(v).toContain('data-kg-model="../../../../../archimate/m/model.fr.json"');
    expect(v).toContain('data-kg-svg="../../../../../archimate/m/view/v1.fr.svg"');
    expect(v).toMatch(/<script type="application\/json" id="am-i18n">\{[^<]*"Views":"Vues"/);
    expect(v).toContain('hreflang="en" href="../../../../../../en/demo/archimate/m/view/overview/"');
  });
  it("translates the model's words and leaves its ids and types", () => {
    const m = JSON.parse(at(localeData("archimate/m/model.json", "fr")));
    expect(m.elements[0]).toMatchObject({ id: "e1", type: "BusinessActor", name: "Clinique", documentation: "Une clinique.", folder: ["Business", "Actors"] });
    expect(m.views[0].name).toBe("Vue d’ensemble");
    expect(translateModel(model, new Map())).toEqual({ ...model });
  });
  it("draws the drawing's labels in the locale, its links into the locale's pages", () => {
    const svg = at("archimate/m/view/v1.fr.svg");
    expect(svg).toContain(">Clinique</text>");
    expect(svg).toContain("<title>Clinique (Acteur métier)</title>");
    expect(svg).toContain('href="../../../fr/demo/archimate/m/element/clinic/"');
  });
  it("gives the English pages their language links, and leaves the thin pages at the IRIs alone", () => {
    expect(at("en/demo/archimate/m/index.html")).toContain('hreflang="fr" href="../../../../fr/demo/archimate/m/"');
    expect(at("archimate/m/element/e1.html")).toBe(files[6].content);
    expect(out.some((f) => f.path === "fr/archimate/m/element/e1.html")).toBe(false);
  });
  it("with no catalogue, writes the files as they are", () => {
    expect(localizedArchimateFiles(files, new Map()).files).toEqual(files);
  });
});
