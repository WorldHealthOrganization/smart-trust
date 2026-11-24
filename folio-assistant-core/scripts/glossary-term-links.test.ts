import { describe, expect, test } from "bun:test";
import { renderDocumentHtml } from "./build-document-site.ts";
import type { TermLink } from "./glossary-term-links.ts";

const links: TermLink[] = [
  { label: "Regulated Trade Item", href: "g/#rti" },
  { label: "Trade Item", href: "g/#ti" },
  { label: "NPC", href: "g/#npc" },
  { label: "Registry", href: "g/#registry" },
].sort((a, b) => b.label.length - a.label.length);

const render = (md: string) => renderDocumentHtml(md, { math: false, termLinks: links });
const hrefs = (html: string) => [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);

describe("glossary term links", () => {
  test("longestLabelWins", async () => {
    const html = await render("A Regulated Trade Item authorises Trade Items.");
    expect(hrefs(html)).toEqual(["g/#rti", "g/#ti"]);
    expect(html).toContain('class="fa-term">Trade Items</a>');
  });

  test("oncePerSection", async () => {
    const html = await render("The NPC holds data. The NPC is a tool.\n\n# Next\n\nThe NPC again.");
    expect(hrefs(html)).toEqual(["g/#npc", "g/#npc"]);
  });

  test("leavesNonProseAlone", async () => {
    const html = await render("# Trade Item\n\na trade item, NPCs-like, `Trade Item`, [Trade Item](x)");
    expect(hrefs(html)).toEqual(["x"]);
  });

  test("oneWordNotAtSentenceStart", async () => {
    expect(hrefs(await render("Registry entries vary. See the Registry."))).toEqual(["g/#registry"]);
    expect(hrefs(await render('<a id="b"></a>\nRegistry entries vary.'))).toEqual([]);
  });

  test("iriLinkPointsAtEntry", async () => {
    const withIri: TermLink[] = [...links, { label: "Stakeholder", href: "g/#stakeholder", iri: "https://x/ns#stakeholder", prose: false }];
    const html = await renderDocumentHtml("**Concepts:** [Stakeholder](https://x/ns#stakeholder), [NPC](https://x/ns#npc)\n\nA Stakeholder uses the NPC.", {
      math: false,
      termLinks: withIri,
    });
    expect(hrefs(html)).toEqual(["g/#stakeholder", "https://x/ns#npc", "g/#npc"]);
  });

  test("noLinksUnchanged", async () => {
    const md = "A Trade Item.";
    expect(await renderDocumentHtml(md, { math: false })).toBe(await renderDocumentHtml(md, { math: false, termLinks: [] }));
  });
});
