import { test, expect, type Page } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { siteFileAt } from "./support/site-fs.ts";
import { HARNESS_ROOT } from "../scripts/lib/roots.ts";
import { overlayPath } from "../scripts/lib/layer-output.ts";

/**
 * The UML overview's Interactive view: a DOT laid out in the browser by the
 * site's own Graphviz build, with nodes the reader can drag (skill
 * `kg-subgraph-layout`).
 *
 * Owner, 2026-10-09: *"could use the wasm-graphviz to make the graph
 * visualizers overview more dynamic. also allow users to drag nodes around
 * for better visualization."*
 *
 * The page is the COMMITTED overview page's figure markup (its Liquid
 * `relative_url` resolved, as Jekyll would on a root site), with the
 * committed `uml.css`, `kg-graph.js`, vendored Graphviz and DOT served from
 * the COMPOSED site: every path is resolved through the layer's site
 * layers (`siteFileFor`, top-most layer wins), as `compose-docs` lays them
 * down. Since cat-harness's semantic-subgraphs slice 1 (19e5d6b) the
 * stylesheet, the script and the vendored Graphviz are the site CHROME's
 * (`site-chrome/`), while the page and its DOT stay in `docs/`. Serving the
 * `siteDirFor` directory alone answered 404 for the chrome, so no view was
 * ever hidden and the interactive view never started. So the test agrees
 * with what ships, not with a stand-in (`kg-viewer` §"Verifying it").
 * Nothing is fetched from a third party: any request off the fixture origin
 * fails the test.
 */
const ROOT = join(HARNESS_ROOT);
/** A site path (no leading slash) → the file the composed site serves for it. */
// Through the layer output overlay: the page and its assets are written at publish (bean cat-tools-sm8r).
const siteFile = (rel: string) => overlayPath(join(ROOT, siteFileAt(ROOT, rel)));
const ORIGIN = "https://site.example.test";
const PAGE = "uml/overview/bootstrap";

/** The overview page's figure block, Liquid resolved, in a bare page that loads uml.css. */
function pageHtml(): string {
  const md = readFileSync(siteFile(`${PAGE}.md`), "utf8");
  const start = md.indexOf('<div class="fa-uml-views">');
  const end = md.indexOf("</script>", start) + "</script>".length;
  if (start < 0 || end < start) throw new Error(`${PAGE}.md has no interactive figure block`);
  const block = md.slice(start, end).replace(/\{\{ '([^']+)' \| relative_url \}\}/g, "$1");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>fixture</title>
<link rel="stylesheet" href="/assets/css/uml.css"></head><body><main class="main-content">${block}</main></body></html>`;
}

const TYPES: Record<string, string> = { ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".dot": "text/vnd.graphviz" };

async function open(page: Page, errors: string[], requests: string[]): Promise<void> {
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => requests.push(r.url()));
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== ORIGIN) {
      errors.push(`a request left the site: ${url.href}`);
      return route.abort();
    }
    if (url.pathname === `/${PAGE}.html`) return route.fulfill({ contentType: "text/html", body: pageHtml() });
    const file = siteFile(decodeURIComponent(url.pathname).replace(/^\/+/, ""));
    if (!existsSync(file)) return route.fulfill({ status: 404, body: "" });
    const ext = url.pathname.slice(url.pathname.lastIndexOf("."));
    return route.fulfill({ contentType: TYPES[ext] ?? "application/octet-stream", body: readFileSync(file) });
  });
  await page.goto(`${ORIGIN}/${PAGE}.html`);
}

const dotText = () => readFileSync(siteFile("assets/img/uml/overview/bootstrap.dot"), "utf8");

test.describe("UML overview, Interactive view", () => {
  test("is lazy: Graphviz is fetched only when the view is picked, then lays the DOT out", async ({ page }) => {
    const errors: string[] = [], requests: string[] = [];
    await open(page, errors, requests);
    await expect(page.locator("figure.fa-uml-portrait img")).toBeVisible();
    await expect(page.locator(".kg-graph")).toBeHidden();
    expect(requests.some((u) => u.includes("wasm-graphviz"))).toBe(false);

    await page.getByText("Interactive", { exact: true }).click();
    await expect(page.locator(".kg-graph[data-kg-state='ready']")).toBeVisible({ timeout: 60000 });
    await expect(page.locator("figure.fa-uml-portrait")).toBeHidden();
    expect(requests.some((u) => u.endsWith("/assets/js/vendor/wasm-graphviz/index.js"))).toBe(true);

    // Every class the DOT declares is drawn, and the scaffolding is not offered to the reader.
    const classes = [...dotText().matchAll(/^\s+"(\w+)" \[(?:fillcolor|style="rounded,filled,dashed")/gm)].map((m) => m[1]);
    expect(classes.length).toBeGreaterThan(0);
    const drawn = await page.locator(".kg-graph-stage g.node title").allTextContents();
    for (const c of classes) expect(drawn).toContain(c);
    const offered = await page.locator(".kg-graph-bar datalist option").evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value));
    expect(offered.some((v) => v.startsWith("grid_"))).toBe(false);
    // The family colour from uml.css, carried in the DOT, reaches the drawing, with its class.
    expect(await page.locator(".kg-graph-stage g.node.fa_uml_kind_scenarios").count()).toBeGreaterThan(0);
    expect(errors).toEqual([]);
  });

  test("find centres a node; a dragged node takes its edges; the keyboard pans", async ({ page }) => {
    const errors: string[] = [], requests: string[] = [];
    await open(page, errors, requests);
    await page.getByText("Interactive", { exact: true }).click();
    await expect(page.locator(".kg-graph[data-kg-state='ready']")).toBeVisible({ timeout: 60000 });

    // A composition: its whole is the node to drag, so its edge must follow.
    const comp = /^\s+"(\w+)" -> "(\w+)" \[dir=both, arrowtail=diamond/m.exec(dotText());
    expect(comp).not.toBeNull();
    const [, from, to] = comp!;
    // An SVG <title> is not rendered text, so the text-matching selectors do not see it: found by index.
    const nth = (sel: string, name: string) =>
      page.locator(sel).evaluateAll((gs, n) => gs.findIndex((g) => g.querySelector(":scope > title")?.textContent === n), name);
    const header = await page.locator(".kg-graph-stage g.node").evaluateAll(
      (gs, n) => gs.find((g) => g.querySelector(":scope > title")?.textContent === n)?.querySelector("text")?.textContent ?? null,
      from!,
    );
    expect(header).not.toBeNull();

    const find = page.locator(".kg-graph-bar input[type=search]");
    await find.fill(header!.trim());
    await find.dispatchEvent("change");
    const found = page.locator(".kg-graph-stage g.node.kg-found");
    await expect(found).toHaveCount(1);
    expect(await found.evaluate((g) => g.querySelector(":scope > title")?.textContent)).toBe(from);
    await page.locator(".kg-graph-stage").scrollIntoViewIfNeeded();
    const stage = await page.locator(".kg-graph-stage").boundingBox();
    const box = (await found.boundingBox())!;
    const [cx, cy] = [box.x + box.width / 2, box.y + box.height / 2];
    expect(Math.abs(cx - (stage!.x + stage!.width / 2))).toBeLessThan(stage!.width * 0.1);
    expect(Math.abs(cy - (stage!.y + stage!.height / 2))).toBeLessThan(stage!.height * 0.1);

    const edgeAt = await nth(".kg-graph-stage g.edge", `${from}->${to}`);
    expect(edgeAt).toBeGreaterThanOrEqual(0);
    const edge = page.locator(".kg-graph-stage g.edge").nth(edgeAt);
    const shape = () => edge.evaluate((g) => [g.querySelector("path")?.getAttribute("d"), g.querySelector("polygon")?.getAttribute("points")]);
    const [before, diamondBefore] = await shape();
    await page.mouse.move(cx, box.y + Math.min(12, box.height / 4));
    await page.mouse.down();
    await page.mouse.move(cx + 120, box.y + 66, { steps: 8 });
    await page.mouse.up();
    expect(await found.getAttribute("transform")).toMatch(/^translate\(/);
    const [after, diamondAfter] = await shape();
    expect(after).not.toBe(before);
    expect(diamondAfter).not.toBe(diamondBefore);

    // Reset layout puts it back.
    await page.getByRole("button", { name: "Reset layout" }).click();
    expect(await found.getAttribute("transform")).toBeNull();
    expect((await shape())[0]).toBe(before);

    // The keyboard floor: arrow keys pan the focused stage.
    const svg = page.locator(".kg-graph-stage svg");
    const vb = await svg.getAttribute("viewBox");
    await page.locator(".kg-graph-stage").focus();
    await page.keyboard.press("ArrowRight");
    expect(await svg.getAttribute("viewBox")).not.toBe(vb);
    expect(errors).toEqual([]);
  });
});

test.describe("without script", () => {
  test.use({ javaScriptEnabled: false });

  test("the page still shows its picture, and the interactive view says what it needs", async ({ page }) => {
    const errors: string[] = [], requests: string[] = [];
    await open(page, errors, requests);
    await expect(page.locator("figure.fa-uml-portrait img")).toBeVisible();
    await page.getByText("Interactive", { exact: true }).click();
    await expect(page.locator(".kg-graph-status")).toContainText("needs JavaScript");
    await expect(page.locator(".kg-graph-status a")).toHaveAttribute("href", "/assets/img/uml/overview/bootstrap.dot");
  });
});
