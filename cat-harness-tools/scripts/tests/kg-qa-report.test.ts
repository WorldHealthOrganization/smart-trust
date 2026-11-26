/**
 * The KG half of a site's QA report (`kg-qa-report.ts`): records read off
 * the declared `qa` directories, the subject listed first even when it
 * declares none, and the view linked only where a declaration names one.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { copyKgQaRecords, kgQaMarkdown, kgQaReport, readQaRecords } from "../kg-qa-report.ts";
import { clearDeclaredVisualisers } from "../viewer-declarations.ts";

const made: string[] = [];
afterAll(() => {
  for (const d of made) rmSync(d, { recursive: true, force: true });
});

function checkout(withView: boolean): string {
  const repo = mkdtempSync(join(tmpdir(), "kg-qa-report-"));
  made.push(repo);
  const files: Record<string, unknown> = {
    "base/cat-harness.json": {
      name: "cat-harness",
      directories: [{ id: "qa", path: "test/results/", graphTypologies: ["qa"] }],
      visualisers: withView ? [{ id: "qa", renderedBy: "state-viewer", coversKinds: ["qa"], subgraphs: "instance", title: "QA" }] : [],
    },
    "top/top.json": { name: "top", needs: ["cat-harness"], directories: [] },
    "base/test/results/links.qa-results.json": {
      $schema: "qa-results/v1",
      producer: { script: "check-links.ts" },
      families: { dead: { summary: "links to nothing", count: 1, entries: [{ page: "a.html", href: "b|c.html" }] } },
    },
    "base/test/results/broken.qa-results.json": "{ not json",
  };
  for (const [f, body] of Object.entries(files)) {
    mkdirSync(join(repo, dirname(f)), { recursive: true });
    writeFileSync(join(repo, f), typeof body === "string" ? body : JSON.stringify(body));
  }
  clearDeclaredVisualisers();
  return repo;
}

describe("kg-qa-report", () => {
  test("a record that does not parse is listed as unreadable, never dropped", () => {
    const repo = checkout(true);
    const r = readQaRecords([join(repo, "base/test/results")]);
    expect(r.map((x) => [x.file.split("/").pop(), x.unreadable === undefined])).toEqual([
      ["broken.qa-results.json", false],
      ["links.qa-results.json", true],
    ]);
  });

  test("the subject comes first, and says it declares no qa directory", () => {
    const repo = checkout(true);
    const rep = kgQaReport(repo, "top");
    expect(rep.instances.map((i) => i.instance)).toEqual(["top", "cat-harness"]);
    expect(rep.view).toBe("en/cat-harness/qa/");
    expect(rep.instances[1]!.page).toBe("en/cat-harness/qa/cat-harness/");
    expect(rep.instances[0]!.page).toBeUndefined();
    const md = kgQaMarkdown(rep, { assets: "assets/kg-qa", up: "../" }).join("\n");
    expect(md).toContain("| `top` | declares no `qa` directory | — | — |");
    expect(md).toContain("[Every instance's QA](../en/cat-harness/qa/)");
    expect(md).toContain("1 finding(s), written by `check-links.ts`");
    expect(md).toContain("[Record (JSON)](../assets/kg-qa/cat-harness/links.qa-results.json)");
    expect(md).toContain("b\\|c.html");
    expect(md).toContain("**broken: unreadable.**");
  });

  test("no declared view: nothing is linked", () => {
    const repo = checkout(false);
    const rep = kgQaReport(repo, "top");
    expect(rep.view).toBeUndefined();
    expect(rep.instances.every((i) => i.page === undefined)).toBe(true);
    expect(kgQaMarkdown(rep).join("\n")).not.toContain("en/cat-harness/qa");
  });

  test("records are copied per instance", () => {
    const repo = checkout(true);
    const site = join(repo, "_site");
    expect(copyKgQaRecords(kgQaReport(repo, "top"), site, "assets/kg-qa")).toBe(1);
    expect(existsSync(join(site, "assets/kg-qa/cat-harness/links.qa-results.json"))).toBe(true);
  });
});
