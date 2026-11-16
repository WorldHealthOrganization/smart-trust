/**
 * The linear floor renders every note, in document order, with no JavaScript.
 *
 * The unit half. `test/content/linear-floor.e2e.ts` is the other half: it serves this
 * function's output to a browser with `javaScriptEnabled: false` and asserts a
 * reader can read it. Both are needed and neither replaces the other — this
 * one pins WHAT is emitted, that one pins that a browser given only those
 * bytes shows it.
 *
 * @module scripts/tests/todo-listing.test
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";

import { escapeHtml, groupTodosByPage, renderTodoListing, todoListingFileFor } from "../todo-listing.js";
import { TodoIndexItemSchema } from "../../schemas/sdlc/todo-index.js";
import { HARNESS_ROOT } from "../lib/roots.ts";
import { todoBoardPage } from "../state-visualizer.ts";
import { siteFileFor } from "../../schemas/kg/cat-harness.js";

/** The minimum a note needs to be a valid `TodoIndexItem`. */
function item(over: Record<string, unknown> = {}) {
  return TodoIndexItemSchema.parse({
    id: "a",
    summary: "Decide the thing",
    comment: "First paragraph.\n\nSecond paragraph.",
    status: "open",
    priority: "high",
    createdAt: "2026-09-19",
    tags: { roles: [], processes: [], tasks: [], identities: [], references: [], artefacts: [] },
    relations: [],
    ...over,
  });
}

describe("escapeHtml", () => {
  test("closes every hole a note's prose could open", () => {
    expect(escapeHtml(`<script>alert("x")</script>`)).toBe(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;",
    );
    // `&` FIRST, or every other replacement's output is re-escaped. Pinned
    // because the order is invisible in the source and fatal when wrong.
    expect(escapeHtml("&lt;")).toBe("&amp;lt;");
    // Single quotes too: an attribute in this file may be single-quoted by a
    // later edit, and an escaper correct only for today's quoting style is
    // one refactor from a hole.
    expect(escapeHtml("it's")).toBe("it&#39;s");
  });
});

describe("the listing", () => {
  test("renders every note", () => {
    const html = renderTodoListing([item({ id: "a" }), item({ id: "b" }), item({ id: "c" })]);
    for (const id of ["a", "b", "c"]) {
      expect(html).toContain(`data-fa-todo="${id}"`);
    }
  });

  test("in DOCUMENT ORDER — the input's order, never sorted", () => {
    // The board stacks by BPMN subprocess depth. The floor deliberately does
    // not: document order is the property a screen reader and a printout
    // depend on, and a floor that reordered would be a second answer to
    // "what comes next".
    const html = renderTodoListing([
      item({ id: "zeta", summary: "Zeta" }),
      item({ id: "alpha", summary: "Alpha" }),
      item({ id: "mid", summary: "Mid" }),
    ]);
    expect(html.indexOf("Zeta")).toBeLessThan(html.indexOf("Alpha"));
    expect(html.indexOf("Alpha")).toBeLessThan(html.indexOf("Mid"));
  });

  test("the count on the section matches the number of items rendered", () => {
    const items = [item({ id: "a" }), item({ id: "b" })];
    const html = renderTodoListing(items);
    expect(html).toContain(`data-fa-todo-count="2"`);
    expect(html).toContain("Open notes (2)");
    expect(html.match(/data-fa-todo="/g)?.length).toBe(2);
  });

  test("zero notes is a DETERMINED empty and says so", () => {
    // Not the same fact as "the index failed to load", which `docs-ui.js`
    // reports separately. A listing that rendered nothing at all would make
    // the two indistinguishable.
    const html = renderTodoListing([]);
    expect(html).toContain("No notes are open in this folio.");
    expect(html).toContain(`data-fa-todo-count="0"`);
    expect(html).not.toContain("<ol");
  });

  test("a note's prose cannot close a tag", () => {
    const html = renderTodoListing([
      item({
        id: "x",
        summary: `</h3><img src=x onerror="alert(1)">`,
        comment: `</div><script>alert(2)</script>`,
      }),
    ]);
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<script");
    expect(html).toContain("&lt;img");
  });

  test("the attachment is rendered from `target`'s PARTS, never from the label", () => {
    // `sec:<page>-<node>` is ambiguous to split — node ids contain `-` — which
    // is exactly why `target` exists. A renderer that parsed the composite
    // would reintroduce the burden `schemas/sdlc/todo-index.ts` removed.
    const html = renderTodoListing([
      item({
        id: "x",
        targetLabel: "sec:beans-and-todos-human-todos",
        target: { page: "beans-and-todos", node: "human-todos", label: "sec:beans-and-todos-human-todos" },
      }),
    ]);
    expect(html).toContain("beans-and-todos &rsaquo; human-todos");
  });

  test("a label that resolves to no block is REPORTED, not dropped and not guessed", () => {
    const html = renderTodoListing([
      item({ id: "x", targetLabel: "sec:gone-away" }),
    ]);
    expect(html).toContain("sec:gone-away");
    expect(html).toContain("no block in this build carries this label");
  });

  test("no href is produced when the caller cannot resolve one — `pb04`", () => {
    // A dead link is worse than no link. With no `pageHref` the attachment is
    // still NAMED; it just is not clickable.
    const html = renderTodoListing([
      item({
        id: "x",
        target: { page: "p", node: "n", label: "sec:p-n" },
      }),
    ]);
    expect(html).toContain("p &rsaquo; n");
    expect(html).not.toContain("<a href");
  });

  test("an unresolved relation is text, a resolved one is a link", () => {
    const html = renderTodoListing([
      item({
        id: "x",
        relations: [
          { axis: "bean", label: "folio-assistant-29ij", href: "https://example.invalid/b" },
          { axis: "bean", label: "folio-assistant-gone" },
        ],
      }),
    ]);
    expect(html).toContain(`<a href="https://example.invalid/b">bean: folio-assistant-29ij</a>`);
    expect(html).toContain("<li>bean: folio-assistant-gone</li>");
  });

  test("the caller's `pageHref` is interpolated verbatim, which is how Liquid survives", () => {
    // `gen-docs-pages.ts` passes a Liquid `relative_url` call, because
    // `baseurl` is Jekyll's and a root-relative href would 404 on a site
    // published under a path. The renderer must not escape it.
    const html = renderTodoListing(
      [item({ id: "x", target: { page: "p", node: "n", label: "sec:p-n" } })],
      { pageHref: (page, node) => `{{ '/${page}.html' | relative_url }}#${node}` },
    );
    expect(html).toContain(`href="{{ '/p.html' | relative_url }}#n"`);
    // SINGLE quotes inside a double-quoted attribute. The first version of
    // the generator used double quotes and produced `href="{{ "` — valid
    // Liquid, an attribute terminated after two characters.
    expect(html).not.toContain(`href="{{ "`);
  });
});

describe("linear floor on todos/index.html (folio-assistant-dm4j)", () => {
  test("todos/index.html serves the linear floor in its own bytes via layout and footer include", () => {
    // The todos dashboard (docs/todos/index.html) is a themed page using
    // layout: default. The linear floor (generated/todo-listing.html) is
    // included in the footer of every default layout page (footer_custom.html),
    // ensuring todos/index.html serves the notes listing in its own bytes.
    //
    // The page is GENERATED (`todoBoardPage`, written at build by the state
    // visualiser) and not committed, so this asks the generator — reading a
    // committed copy failed with ENOENT once the page left main, and said
    // nothing about the page the site actually serves.
    const footer = readFileSync(join(HARNESS_ROOT, siteFileFor(HARNESS_ROOT, "_includes/footer_custom.html")), "utf8");
    expect(footer).toContain("include generated/todo-listing.html");

    const todosPage = todoBoardPage({ description: "A person's outstanding items." });
    expect(todosPage).toContain("layout: default");
    expect(todosPage).toContain('<h1 id="todos">Todos</h1>');
  });
});

describe("each page lists only its own notes (bean lwjc)", () => {
  const at = (page: string, node = "n") => ({ target: { page, node, label: `sec:${page}-${node}` }, targetLabel: `sec:${page}-${node}` });
  const notes = [
    item({ id: "p1", ...at("guides/beans-and-todos") }),
    item({ id: "u1", targetLabel: "sec:gone-x" }),
    item({ id: "q1", ...at("concepts/agentic-harness") }),
    item({ id: "p2", ...at("guides/beans-and-todos", "m") }),
  ];

  test("groups by the page each note is attached to, keeping input order", () => {
    const { pages, unplaced } = groupTodosByPage(notes);
    expect([...pages.keys()]).toEqual(["guides/beans-and-todos", "concepts/agentic-harness"]);
    expect(pages.get("guides/beans-and-todos")!.map((i) => i.id)).toEqual(["p1", "p2"]);
    expect(pages.get("concepts/agentic-harness")!.map((i) => i.id)).toEqual(["q1"]);
    // A label no page carries is UNPLACED, never folded into a page.
    expect(unplaced.map((i) => i.id)).toEqual(["u1"]);
  });

  test("a page with no note gets no entry -- an absence, not an empty list", () => {
    const { pages } = groupTodosByPage(notes);
    expect(pages.has("guides/writing-a-document")).toBe(false);
    expect(groupTodosByPage([]).pages.size).toBe(0);
  });

  test("a page's count is its own cardinality, never the folio's", () => {
    const { pages } = groupTodosByPage(notes);
    const html = renderTodoListing(pages.get("guides/beans-and-todos")!, { scope: "page" });
    expect(html).toContain(`data-fa-todo-count="2"`);
    expect(html).toContain(`data-fa-todo-scope="page"`);
    expect(html).toContain("Notes on this page (2)");
    expect(html).not.toContain("Every note in this folio, in document order");
  });

  test("the folio listing is unchanged by default", () => {
    const html = renderTodoListing(notes);
    expect(html).toContain(`data-fa-todo-scope="folio"`);
    expect(html).toContain("Open notes (4)");
  });

  test("one fragment file per page, flat", () => {
    expect(todoListingFileFor("guides/beans-and-todos")).toBe("guides__beans-and-todos.html");
    expect(todoListingFileFor("index")).toBe("index.html");
  });

  test("the todos board keeps the whole listing: its page says so in front matter", () => {
    const board = todoBoardPage({ description: "A person's outstanding items." });
    expect(board).toMatch(/^fa_todo_listing: all$/m);
  });
});
