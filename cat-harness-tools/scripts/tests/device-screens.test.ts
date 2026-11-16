/**
 * Device screens in the journeys viewer, over a fixture checkout: one
 * layer holding actors (one with an avatar), two journeys, a workshop that
 * still names an app to frame, and `device-screen` nodes for its steps.
 *
 * What is asserted is what the owner asked for (2026-11-06): the screens are
 * drawn from the nodes, as static device mocks with their owner beside them,
 * linked both ways with the walkthrough; the framed app is a fallback only;
 * check:journey-refs resolves a screen's references and a persona's avatar;
 * and a persona's picture is drawn wherever the persona appears.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { parseDeviceScreen } from "../../schemas/process/device-screen.ts";
import { checkJourneyRefs } from "../journeys/check.ts";
import { presentationOf, screensFor } from "../journeys/present.ts";
import { readJourneyCorpus } from "../journeys/read.ts";
import { renderJourneyPages, ROOT_MARK, type PageFile, type PersonaView } from "../journeys/render.ts";
import { blockHtml, demoScreensOf, qrMatrix, qrSvg, renderDevice, rowsFromExample, stateSwitch, statusBar, type ScreenContext } from "../journeys/screens.ts";
import { clearDeclaredVisualisers } from "../viewer-declarations.ts";

const REPO = mkdtempSync(join(tmpdir(), "device-screens-"));
afterAll(() => rmSync(REPO, { recursive: true, force: true }));
const put = (rel: string, body: string | object): void => {
  mkdirSync(join(REPO, dirname(rel)), { recursive: true });
  writeFileSync(join(REPO, rel), typeof body === "string" ? body : JSON.stringify(body, null, 2));
};

put("demo/demo.json", {
  name: "demo",
  title: "Demo",
  directories: [
    { id: "scenarios", path: "scenarios/", graphTypologies: ["scenarios"] },
    { id: "user-scenarios", path: "scenarios/user-scenarios/", graphTypologies: ["user-scenario"] },
    { id: "device-screens", path: "scenarios/device-screens/", graphTypologies: ["device-screen"] },
    { id: "workshops", path: "workshops/", graphTypologies: ["workshop"] },
  ],
  visualisers: [{ id: "journeys", renderedBy: "journeys-viewer", coversKinds: ["user-scenario", "workshop", "device-screen"], subgraphs: "instance" }],
});
put("demo/scenarios/actors/kamal.json", { id: "kamal", title: "Kamal (pilgrim)", kind: "person", meta: { persona: { name: "Kamal", role: "Pilgrim", color: "#0d9488", avatar: "scenarios/avatars/kamal.webp" } } });
put("demo/scenarios/actors/reem.json", { id: "reem", title: "Nurse Reem", kind: "person", meta: { persona: { name: "Reem", role: "Nurse" } } });
put("demo/scenarios/actors/ghost.json", { id: "ghost", title: "Ghost", kind: "person", meta: { persona: { name: "Ghost", avatar: "scenarios/avatars/missing.webp" } } });
put("demo/scenarios/avatars/kamal.webp", "RIFF fixture WEBP");
const step = (id: string, lead: string, extra: object = {}) => ({ id, title: `Step ${id}`, lead, experiences: [{ actor: lead, doing: `does ${id}`, emotion: 1 }], ...extra });
put("demo/scenarios/user-scenarios/p2.json", { $schema: "user-scenario/0.2.0", id: "p2-signed", title: "P2 — Signed", description: "d", personas: ["kamal"], steps: [step("P2", "kamal")] });
put("demo/scenarios/user-scenarios/p4.json", {
  $schema: "user-scenario/0.2.0",
  id: "p4-scanned",
  title: "P4 — Scanned",
  description: "d",
  personas: ["kamal", "reem"],
  follows: "p2-signed",
  steps: [step("P4", "reem", { experiences: [{ actor: "reem", doing: "scans" }, { actor: "kamal", doing: "shows" }], handoff: { summary: "The summary moves", from: "kamal", to: "reem" } })],
});
put("demo/workshops/w.json", {
  $schema: "workshop/0.1.0",
  id: "w",
  title: "W",
  description: "d",
  scenarios: ["p2-signed", "p4-scanned"],
  modules: [{ id: "M1", title: "One" }],
  // An app to frame: the nodes below replace it.
  presentation: { deviceDemo: { href: "app/", label: "Device Demo", screens: [{ id: "OLD", title: "Framed", steps: ["P2"] }] } },
});
const screen = (id: string, extra: object) => ({ $schema: "device-screen/0.1.0", id, title: `Screen ${id}`, device: "phone", owner: "kamal", ...extra });
put("demo/scenarios/device-screens/p4-scanner.json", screen("P4-scanner", {
  device: "scanner",
  owner: "reem",
  steps: [{ scenario: "p4-scanned", step: "P4" }],
  blocks: [{ type: "qr", payload: "HC1:TEST", mode: "scan" }, { type: "statusBadge", status: "verified", text: "Signature valid" }],
}));
put("demo/scenarios/device-screens/p2.json", screen("P2", {
  steps: [{ scenario: "p2-signed", step: "P2" }, { scenario: "p4-scanned", step: "P4" }],
  blocks: [
    { type: "header", app: "Health wallet" },
    { type: "qr", payload: "https://example.org/shl#x", title: "Signed summary", example: "Bundle/kamal-ips" },
    { type: "personCard", actor: "nobody" },
  ],
  try: "Show the code",
}));
// A screen for a step no workshop teaches: drawn by no workshop.
put("demo/scenarios/device-screens/elsewhere.json", screen("X1", { steps: [{ scenario: "p2-signed", step: "P9" }], blocks: [{ type: "note", text: "x" }] }));
clearDeclaredVisualisers();

const corpus = readJourneyCorpus(join(REPO, "demo"));
const files = renderJourneyPages(corpus, { route: "en/demo/journeys", title: "Demo" }, "demo");
const at = (path: string): string => {
  const f = files.find((x: PageFile) => x.path === path);
  if (f === undefined) throw new Error(`no page ${path}; have ${files.map((x) => x.path).filter((p) => p.includes("demo/")).join(", ")}`);
  return String(f.content);
};
const base = "demo/workshops/w";

describe("device screens: read, ordered, linked", () => {
  test("the reader finds the screens a directory declares", () => {
    expect(corpus.screens.map((s) => s.screen.id)).toEqual(["P2", "P4-scanner", "X1"]);
    expect(corpus.problems).toEqual([]);
  });
  test("the nodes replace the framed app; ordered by the first step they show", () => {
    const p = presentationOf(corpus, corpus.workshops[0]!);
    expect(p.demo).toBe("screens");
    expect(p.screens.map((x) => x.id)).toEqual(["P2", "P4-scanner"]);
    expect(p.screens[0]!.steps.map((s) => s.step.id)).toEqual(["P2", "P4"]);
    const p4 = p.steps.find((s) => s.step.id === "P4")!;
    expect(screensFor(p, p4).map((x) => x.id)).toEqual(["P2", "P4-scanner"]);
  });
  test("with no node for its steps, a workshop frames its app; with neither, it has no demo", () => {
    const bare = { ...corpus, screens: [] };
    const w = corpus.workshops[0]!;
    const p = presentationOf(bare, w);
    expect(demoScreensOf(bare, w, p.steps)).toMatchObject({ source: "frame", screens: [{ id: "OLD" }] });
    const none = { ...w, workshop: { ...w.workshop, presentation: undefined } };
    expect(demoScreensOf(bare, none, p.steps)).toEqual({ source: "none", screens: [] });
  });
  test("JV-15: the journey stages are pills in the header band, labelled by step and title, the current one on", () => {
    const page = at(`${base}/demo/P4-scanner/index.html`);
    const band = /<\/header>\n<nav class="jp-stagebar"[^]*?<\/nav>/.exec(page)?.[0];
    expect(band).toBeDefined();
    expect(band).toMatch(/<a class="jp-stage-pill is-on" href="\.\.\/P4-scanner\/"[^>]*aria-current="page"><code>P4<\/code> /);
    expect(page.indexOf("jp-stagebar")).toBeLessThan(page.indexOf("jp-note"));
  });
  test("JV-17: every device has a status bar; wider ones name the app and its version from the screen's client", () => {
    for (const f of files.filter((x) => /\/demo\/[^/]+\/index\.html$/.test(x.path) && String(x.content).includes("ds-device"))) expect(String(f.content)).toContain('class="ds-statusbar');
    const screen = corpus.screens[0]!.screen;
    const wide = { ...screen, device: "tablet" as const, client: { name: "OHS Facility Client", version: "2.4.1", time: "10:14 AM", config: "Tablet EMR" } };
    const bar = statusBar(wide);
    expect(bar).toContain('<span class="ds-client"><b>OHS Facility Client</b><small>v2.4.1</small></span>');
    expect(bar).toContain("<span>10:14 AM</span>");
    expect(statusBar({ ...screen, device: "phone" })).toContain('class="ds-notch"');
    expect(parseDeviceScreen({ ...screen, $schema: "device-screen/0.1.0", client: wide.client }).client?.version).toBe("2.4.1");
  });
  test("a screen's page draws the device, its owner, and the moments it shows; no iframe", () => {
    const page = at(`${base}/demo/P4-scanner/index.html`);
    expect(page).toContain('<figure class="ds-device ds-scanner" data-screen="P4-scanner">');
    // JV-16: whose screen it is, in VaxLink's line rather than a chip over the device.
    expect(page).toContain("You are looking at what Reem (Nurse) sees at this moment.");
    expect(page).not.toContain('class="ds-owner');
    expect(page).toContain('<a class="jp-back" href="../../walkthrough/P4/">');
    expect(page).toContain("Handheld scanner");
    expect(page).toContain("data-jp-expand");
    expect(page).toContain('href="../../walkthrough/P4/"');
    expect(page).toContain("Moments this screen shows");
    expect(page).not.toContain("<iframe");
    expect(page).not.toContain(ROOT_MARK);
    expect(files.some((f) => f.path.endsWith("/demo/OLD/index.html"))).toBe(false);
    expect(files.some((f) => f.path.endsWith("/demo/X1/index.html"))).toBe(false);
  });
  test("the step links to each screen that shows it, named for whose device it is", () => {
    const p4 = at(`${base}/walkthrough/P4/index.html`);
    expect(p4).toContain('href="../../demo/P4-scanner/"');
    expect(p4).toMatch(/See what Reem sees <small>\(screen P4-scanner\)/);
    expect(p4).toMatch(/See what Kamal sees <small>\(screen P2\)/);
    // JV-10: at the right column's foot, after the facilitator cue, as VaxLink's full-width button.
    const right = p4.slice(p4.indexOf('<div class="jp-walk-r">'), p4.indexOf('<div class="jp-hood-toggle">'));
    expect(right).toContain('<div class="jp-sees"><a class="jp-see"');
    expect(p4.slice(0, p4.indexOf('<div class="jp-walk-r">'))).not.toContain("jp-see");
  });
  test("the demo index lists each screen with its device and owner", () => {
    const idx = at(`${base}/demo/index.html`);
    expect(idx).toContain('href="P2/"');
    expect(idx).toContain("Kamal · Phone");
    expect(idx).toContain("Reem · Scanner");
    expect(idx).not.toContain("open the app");
  });
});

describe("avatars", () => {
  test("a persona's picture is copied once and drawn wherever the persona appears, from each page's root", () => {
    expect(files.filter((f) => f.path === "avatars/demo/kamal.webp")).toHaveLength(1);
    const p4 = at(`${base}/walkthrough/P4/index.html`);
    expect(p4).toContain('<span class="jp-av jp-av-md jp-av-img" style="--c:#0d9488" title="Kamal" aria-hidden="true"><img src="../../../../../avatars/demo/kamal.webp"');
    // The hand-off ends wear their avatars.
    expect(p4).toMatch(/<span class="jp-end"><span class="jp-av jp-av-sm jp-av-img"[^>]*><img src="..\/..\/..\/..\/..\/avatars\/demo\/kamal.webp"/);
    // The journey page (the plain viewer) too, from its own depth.
    expect(at("demo/p4-scanned/index.html")).toContain('<img src="../../avatars/demo/kamal.webp"');
    // Reem has no picture: her initials on her colour.
    expect(p4).toMatch(/<span class="jp-av jp-av-md" style="--c:[^"]+" title="Reem" aria-hidden="true">R<\/span>/);
    for (const f of files) if (typeof f.content === "string") expect(f.content.includes(ROOT_MARK), f.path).toBe(false);
  });
});

describe("check:journey-refs over screens and avatars", () => {
  test("every unresolved reference is a finding", () => {
    const r = checkJourneyRefs(corpus);
    expect(r.screens).toBe(3);
    const msgs = r.findings.map((f) => `${f.file} · ${f.at}: ${f.message}`);
    expect(msgs).toContain('scenarios/device-screens/p2.json · personCard: actor "nobody" is no actor (actors/nobody.json in a declared scenarios directory)');
    expect(msgs).toContain('scenarios/device-screens/p2.json · blocks: FHIR example "Bundle/kamal-ips" is in no declared fhir-artifact-index');
    expect(msgs).toContain("scenarios/device-screens/elsewhere.json · steps[0]: step \"P9\" is no step of journey p2-signed (demo/scenarios/user-scenarios/p2.json)");
    expect(msgs).toContain('scenarios/actors/ghost.json · meta.persona.avatar: avatar "scenarios/avatars/missing.webp" is no file of instance demo');
    expect(msgs.filter((m) => m.includes("kamal.webp"))).toEqual([]);
    expect(msgs.filter((m) => m.includes("p4-scanner"))).toEqual([]);
  });
});

describe("drawing a screen", () => {
  const people: Record<string, PersonaView> = { kamal: { id: "kamal", name: "Kamal", initials: "K", color: "#0d9488", role: "Pilgrim" } };
  const ctx: ScreenContext = {
    person: (id) => people[id],
    exampleHref: (k) => (k === "Bundle/ips" ? "https://ig.example/Bundle-ips.html" : undefined),
    exampleJson: (k) =>
      k === "Bundle/ips"
        ? JSON.stringify({
            resourceType: "Bundle",
            entry: [
              { resource: { resourceType: "Composition" } },
              { resource: { resourceType: "MedicationStatement", status: "active", medicationCodeableConcept: { text: "Insulin glargine", coding: [{ code: "A10AE04" }] } } },
              { resource: { resourceType: "AllergyIntolerance", code: { coding: [{ code: "764146007", display: "Penicillin" }] } } },
            ],
          })
        : undefined,
  };
  test("a record list takes its rows from the example: the Composition aside, an allergy struck through", () => {
    const html = blockHtml(parseDeviceScreen({ $schema: "device-screen/0.1.0", id: "S", title: "t", device: "tablet", owner: "kamal", steps: [{ scenario: "a", step: "A" }], blocks: [{ type: "recordList", title: "Record", example: "Bundle/ips" }] }).blocks[0]!, ctx);
    expect(html).toContain('<b>Insulin glargine</b><span class="ds-chip ds-tone-neutral">active</span></div><code>A10AE04</code>');
    expect(html).toContain('<li class="is-struck">');
    expect(html).toContain("<b>Penicillin</b>");
    expect(html).not.toContain("Composition");
    expect(html).toContain('href="https://ig.example/Bundle-ips.html"');
  });
  test("Inspect JSON on a QR code and a record list opens the page's drawer on that example, only when the drawer has it", () => {
    const screen = parseDeviceScreen({
      $schema: "device-screen/0.1.0", id: "S", title: "t", device: "phone", owner: "kamal", steps: [{ scenario: "a", step: "A" }],
      blocks: [{ type: "qr", payload: "x", example: "Bundle/ips" }, { type: "recordList", title: "Record", example: "Bundle/ips" }, { type: "qr", payload: "y", example: "Bundle/none" }],
    });
    const on = { ...ctx, inspectable: (k: string) => ctx.exampleJson(k) !== undefined };
    const html = screen.blocks.map((b) => blockHtml(b, on));
    expect(html[0]).toContain('<button type="button" class="jp-inspect ds-inspect" data-jp-inspect="Bundle/ips">Inspect JSON</button>');
    expect(html[1]).toContain('data-jp-inspect="Bundle/ips"');
    expect(html[2]).not.toContain("data-jp-inspect");
    expect(blockHtml(screen.blocks[0]!, ctx)).not.toContain("data-jp-inspect");
  });
  test("rowsFromExample reads a lone resource, and nothing from what is not JSON", () => {
    expect(rowsFromExample(JSON.stringify({ resourceType: "Immunization", status: "completed", vaccineCode: { text: "Hep B" }, occurrenceDateTime: "2025-10-28", lotNumber: "TH-4821" }))).toEqual([
      { icon: "syringe", label: "Hep B", detail: "2025-10-28 · Lot TH-4821", status: { text: "completed", tone: "neutral" } },
    ]);
    expect(rowsFromExample("not json")).toEqual([]);
  });
  test("text is escaped; a passcode hides its digits unless shown", () => {
    const one = (b: object) => blockHtml(parseDeviceScreen({ $schema: "device-screen/0.1.0", id: "S", title: "t", device: "phone", owner: "kamal", steps: [{ scenario: "a", step: "A" }], blocks: [b] }).blocks[0]!, ctx);
    expect(one({ type: "note", text: "<script>x</script>" })).toContain("&lt;script&gt;");
    expect(one({ type: "passcode", label: "Code", digits: "4829" })).not.toContain("4829");
    expect(one({ type: "passcode", label: "Code", digits: "4829", shown: true })).toContain('<span class="ds-digit">4</span>');
    expect(one({ type: "consent", who: "Dr A", what: "All", granted: false })).toContain("Not shared");
    expect(one({ type: "statusBadge", status: "emergency", text: "Break the glass" })).toContain("ds-tone-danger ds-status-emergency");
  });
  test("a wide device splits the side blocks into a second column; a phone does not", () => {
    const s = (device: string) =>
      parseDeviceScreen({
        $schema: "device-screen/0.1.0",
        id: "S",
        title: "t",
        device,
        owner: "kamal",
        steps: [{ scenario: "a", step: "A" }],
        blocks: [{ type: "header", app: "App" }, { type: "note", text: "main" }, { type: "note", text: "side", column: "side" }, { type: "actions", buttons: [{ label: "Go" }] }],
      });
    const tablet = renderDevice(s("tablet"), ctx);
    expect(tablet).toMatch(/<div class="ds-split"><div class="ds-col">.*main.*<\/div><div class="ds-col ds-col-side">.*side/);
    expect(tablet.indexOf("ds-hdr")).toBeLessThan(tablet.indexOf("ds-split"));
    expect(tablet.indexOf("ds-actions")).toBeGreaterThan(tablet.indexOf("ds-split"));
    const phone = renderDevice(s("phone"), ctx);
    expect(phone).not.toContain("ds-split");
    expect(phone).toContain("ds-statusbar");
    expect(phone.indexOf("main")).toBeLessThan(phone.indexOf("side"));
  });
  test("a screen with states draws every state, the first shown, and a switch that waits for the script", () => {
    const s = parseDeviceScreen({
      $schema: "device-screen/0.1.0",
      id: "S4",
      title: "t",
      device: "tablet",
      owner: "kamal",
      steps: [{ scenario: "a", step: "A" }],
      blocks: [{ type: "statusBadge", id: "v", status: "verified", text: "VALID SIG" }, { type: "note", text: "main" }],
      stateLabel: "Valid card",
      states: [{ id: "tampered", label: "Tampered card", blocks: [{ type: "statusBadge", id: "v", status: "failed", text: "SIG MISMATCH" }], try: "Ask the room" }],
    });
    const html = renderDevice(s, ctx);
    expect(html).toContain('<div class="ds-state" data-ds-state="default">');
    expect(html).toContain('<div class="ds-state" data-ds-state="tampered" hidden>');
    expect(html.indexOf("VALID SIG")).toBeLessThan(html.indexOf("SIG MISMATCH"));
    expect(html.match(/class="ds-statusbar/g)!.length).toBe(1);
    const sw = stateSwitch(s);
    expect(sw).toContain('data-ds-switch="S4" hidden');
    expect(sw).toContain('data-ds-show="default" aria-pressed="true">Valid card');
    expect(sw).toContain('data-ds-show="tampered" aria-pressed="false">Tampered card');
    expect(sw).toContain('data-ds-state="tampered" hidden>');
    const plain = { ...s, states: undefined, stateLabel: undefined };
    expect(stateSwitch(plain)).toBe("");
    expect(renderDevice(plain, ctx)).not.toContain("ds-state");
  });
  test("a QR code is a real one: finder patterns at three corners, the size of a QR version", () => {
    const m = qrMatrix("https://example.org/shl#x");
    const n = m.length;
    expect((n - 17) % 4).toBe(0);
    const finder = (r: number, c: number) => [0, 6].every((k) => m[r + k]!.slice(c, c + 7).every(Boolean)) && m[r + 2]![c + 1] === false && m[r + 3]![c + 3] === true;
    expect(finder(0, 0) && finder(0, n - 7) && finder(n - 7, 0)).toBe(true);
    expect(m[n - 1]![n - 1]).toBeDefined();
    const svg = qrSvg(m);
    expect(svg).toContain(`viewBox="0 0 ${n + 4} ${n + 4}"`);
    expect(svg.match(/h1v1h-1z/g)!.length).toBe(m.flat().filter(Boolean).length);
  });
});
