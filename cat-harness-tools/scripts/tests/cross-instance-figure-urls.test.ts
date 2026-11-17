/**
 * Cross-instance figure edit URLs must be repo-root-relative with no `..` segment.
 *
 * Bean `folio-assistant-4z5o`. Generated pages compose GitHub URLs by joining
 * an instance-relative path that leaves the layer root, producing broken links
 * with `/main/../` in them (e.g. `https://github.com/.../edit/main/../folio-assistant-core/...`).
 * GitHub does not normalise `..` in that position.
 *
 * @module scripts/tests/cross-instance-figure-urls.test
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { WebPage, WebPageAsset, WebPageNode } from "../../schemas/ui/webpage.ts";
import { editTarget } from "../gen-docs-pages.ts";
import { HARNESS_ROOT } from "../lib/roots.ts";

const DOCS_DIR = join(HARNESS_ROOT, "docs");

function walkMdFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkMdFiles(full));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      out.push(full);
    }
  }
  return out;
}

describe("cross-instance figure edit URLs (bean 4z5o)", () => {
  const dummyPage: WebPage = {
    slug: "test-page",
    title: "Test Page",
    nodes: [],
  };

  test("a figure whose source is in a nested instance resolves to repo-root-relative with no .. segment", () => {
    const node: WebPageNode = {
      id: "fig-nested",
      title: "Nested Instance Figure",
      asset: {
        kind: "bpmn",
        source: "../folio-assistant-core/processes/library/l1-document-ingestion.bpmn",
        rendered: "assets/img/workflows/l1-document-ingestion.svg",
        alt: "Nested instance figure",
      },
    };

    const target = editTarget(dummyPage, node);
    expect(target).toBe("folio-assistant-core/processes/library/l1-document-ingestion.bpmn");
    expect(target).not.toContain("..");
  });

  test("a figure whose source is local to the instance remains unchanged", () => {
    const asset: WebPageAsset = {
      kind: "bpmn",
      // declared-path-literal: fixture data for editTarget, never read — it only has to look instance-local.
      source: "sdlc/processes/bean-lifecycle.bpmn",
      rendered: "assets/img/workflows/bean-lifecycle.svg",
      alt: "Local figure",
    };
    const node: WebPageNode = { id: "fig-local", title: "Local Figure", asset };

    const target = editTarget(dummyPage, node);
    expect(target).toBe(asset.source);
    expect(target).not.toContain("..");
  });

  test("the generated docs corpus carries zero edit/main/../ links across all markdown pages", () => {
    const mdFiles = walkMdFiles(DOCS_DIR);
    expect(mdFiles.length).toBeGreaterThan(10);

    const escapingLinks: Array<{ file: string; line: number; match: string }> = [];
    const pattern = /edit\/main\/\.\.\/[a-z0-9_-]*/g;

    for (const file of mdFiles) {
      const content = readFileSync(file, "utf-8");
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const matches = lines[i].match(pattern);
        if (matches) {
          for (const m of matches) {
            escapingLinks.push({ file, line: i + 1, match: m });
          }
        }
      }
    }

    expect(escapingLinks).toEqual([]);
  });
});
