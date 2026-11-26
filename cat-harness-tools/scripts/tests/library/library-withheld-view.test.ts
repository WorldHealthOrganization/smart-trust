/**
 * The library viewer's rows and banner for a WITHHELD entry — issue #1794.
 *
 * @module scripts/tests/library-withheld-view
 *
 * Owner, 2026-10-01: each row shows the section's summary when one exists;
 * otherwise "Withheld — copyright not granted" with a link to the catalogue
 * record; a banner at the top of a withheld entry explains why.
 *
 * Evaluates the SAME browser code the page embeds (`WITHHELD_VIEW_JS`), with
 * the page's three free names supplied, and also checks the generated page
 * actually embeds it and routes every row through it — else these tests could
 * pass over a viewer that never calls the functions they exercise.
 */
import { describe, expect, test } from "bun:test";

import { WITHHELD_VIEW_JS } from "../../lib/library-withheld-view.ts";
import { VIEWER_JS } from "../../gen-library-viz.ts";

interface View {
  blockBody(b: unknown, e: unknown): string;
  withheldBanner(e: unknown, bs: unknown[]): string;
}

function load(): View {
  const esc = (s: unknown): string =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
  const summaryPanel = (s: { text?: string }): string => `<div class="sum"><p>${esc(s.text ?? "")}</p></div>`;
  // input-site: inert #b429a5e6 — evaluates browser-side or toString'd source from this tree's own modules, already in the read set; it reads no environment
  return new Function("esc", "summaryPanel", "SITE_ROOT", `${WITHHELD_VIEW_JS}\nreturn { blockBody, withheldBanner };`)(
    esc,
    summaryPanel,
    "/folio-assistant/",
  ) as View;
}

const V = load();

/** A withheld entry as `library-graph.ts` projects one from `withheld.json`. */
const WITHHELD = {
  id: "book",
  instance: "inst",
  withheld: 'item/x ORIGINAL "book.pdf": copyright refused',
  withheldBy: {
    gates: [{ gate: "copyright", verdict: "refused" }],
    record: { id: "item/x", page: "/inst/item-x.html", uri: "https://hdl.handle.net/1/2" },
  },
};
const OPEN = { id: "scan", instance: "inst" };

const empty = { title: "Page 3", kind: "prose", content: null, summary: { status: "not-summarised" } };
const summarised = {
  title: "Page 4",
  kind: "prose",
  content: null,
  summary: { status: "draft", text: "OUR ACCOUNT of page four.", draftedBy: { kind: "agent", id: "a" } },
};

describe("a row of a withheld entry", () => {
  test("with a summary renders the summary, marked as a summary", () => {
    const html = V.blockBody(summarised, WITHHELD);
    expect(html).toContain("OUR ACCOUNT of page four.");
    expect(html).toContain("not its text");
    expect(html).not.toContain("Withheld");
    expect(html).not.toContain("no content carried");
  });

  test("without one renders the gate's own words and links the catalogue record page", () => {
    const html = V.blockBody(empty, WITHHELD);
    expect(html).toContain("Withheld — copyright not granted");
    expect(html).toContain('href="/folio-assistant/inst/item-x.html"');
    expect(html).not.toContain("no content carried");
  });

  test("names every refusing gate, not only copyright", () => {
    const both = { ...WITHHELD, withheldBy: { ...WITHHELD.withheldBy, gates: [
      { gate: "copyright", verdict: "refused" }, { gate: "restrictions", verdict: "refused" }] } };
    expect(V.blockBody(empty, both)).toContain("Withheld — copyright and restrictions not granted");
  });

  test("falls back to the upstream URI when no record page is published", () => {
    const noPage = { ...WITHHELD, withheldBy: { ...WITHHELD.withheldBy, record: { uri: "https://hdl.handle.net/1/2" } } };
    expect(V.blockBody(empty, noPage)).toContain('href="https://hdl.handle.net/1/2"');
  });

  test("says the recorded sentence, and links nothing, when the list carried no structure", () => {
    const bare = { ...OPEN, withheld: "copyright refused" };
    const html = V.blockBody(empty, bare);
    expect(html).toContain("Withheld — copyright refused");
    expect(html).not.toContain("<a ");
  });
});

describe("a row of an entry that is NOT withheld", () => {
  test("an empty block keeps the neutral text — emptiness is not withholding", () => {
    const html = V.blockBody(empty, OPEN);
    expect(html).toContain("(no content carried)");
    expect(html).not.toContain("Withheld");
  });

  test("a summary with no content is still shown", () => {
    expect(V.blockBody(summarised, OPEN)).toContain("OUR ACCOUNT of page four.");
  });

  test("content is shown beside its summary, as before", () => {
    const html = V.blockBody({ ...summarised, content: "THE SOURCE TEXT" }, OPEN);
    expect(html).toContain("THE SOURCE TEXT");
    expect(html).toContain("Agent summary");
  });
});

describe("the withheld banner", () => {
  test("appears on a withheld entry: why, which gate, the record, and the summary count", () => {
    const html = V.withheldBanner(WITHHELD, [empty, summarised, empty]);
    expect(html).toContain("wh-banner");
    expect(html).toContain("not published");
    expect(html).toContain("copyright not granted");
    expect(html).toContain('href="/folio-assistant/inst/item-x.html"');
    expect(html).toContain("<b>1</b> of 3 sections summarised");
  });

  test("does not appear on any other entry, empty or not", () => {
    expect(V.withheldBanner(OPEN, [empty, empty])).toBe("");
    expect(V.withheldBanner(undefined, [empty])).toBe("");
  });
});

describe("the generated viewer uses this code", () => {
  // The page is a thin shell (#1881); the code is the shared script it loads.
  const page = VIEWER_JS;
  test("embeds it verbatim", () => {
    expect(page).toContain(WITHHELD_VIEW_JS);
  });
  test("routes every row through blockBody and puts the banner above the rows", () => {
    expect(page).toContain("var body = blockBody(b, entry);");
    expect(page).toContain("withheldBanner(entry, bs)");
    expect(page).toContain("loadBlocks(known.id, known)");
  });
});
