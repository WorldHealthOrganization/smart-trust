/**
 * `uml:overview` in a checkout that MOUNTS the harness (bean `cat-tools-sm8r`,
 * item 4): it lists its roots through the layer output overlay, and renders a
 * stale SVG at the output root, never inside the pinned mount.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { jobsToRender, walkOverlay } from "../gen-uml-overview.ts";
import { sha256 } from "../plantuml-render.ts";
import { LAYER_OUTPUT_ROOT } from "../lib/layer-output.ts";

const dirs: string[] = [];
afterAll(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

/** A checkout whose lock mounts `some-layer`, with `files` written relative to the root. */
function checkout(files: Record<string, string>, mounted = true): string {
  const root = mkdtempSync(join(tmpdir(), "uml-overview-output-root-"));
  dirs.push(root);
  if (mounted) writeFileSync(join(root, "index.lock.json"), JSON.stringify({ instances: [{ instance: "some-layer", path: "some-layer" }] }));
  for (const [rel, text] of Object.entries(files)) {
    mkdirSync(join(root, rel, ".."), { recursive: true });
    writeFileSync(join(root, rel), text);
  }
  return root;
}

const stamped = (text: string) => `<svg><!-- puml-sha256: ${sha256(text)} --></svg>`;

describe("uml:overview through the layer output root", () => {
  test("walkOverlay names the pinned and the computed files at their pinned paths, once each", () => {
    const root = checkout({
      "some-layer/uml/overview/a.puml": "pinned",
      "some-layer/uml/overview/b.puml": "pinned",
      [`${LAYER_OUTPUT_ROOT}/some-layer/uml/overview/b.puml`]: "computed",
      [`${LAYER_OUTPUT_ROOT}/some-layer/uml/overview/c.puml`]: "computed",
    });
    const dir = join(root, "some-layer/uml/overview");
    expect(walkOverlay(dir, root).sort()).toEqual(["a.puml", "b.puml", "c.puml"].map((f) => join(dir, f)));
  });

  test("a stale SVG of a mounted layer is rendered at the output root; a current pinned one is not rendered", () => {
    const root = checkout({ "some-layer/docs/img/current.svg": stamped("current source") });
    const at = (f: string) => join(root, "some-layer/docs/img", f);
    const jobs = [
      { source: "x.puml", text: "current source", svg: at("current.svg") },
      { source: "y.puml", text: "new source", svg: at("stale.svg") },
    ];
    expect(jobsToRender(jobs, root).map((j) => j.svg)).toEqual([join(root, LAYER_OUTPUT_ROOT, "some-layer/docs/img/stale.svg")]);
  });

  test("an SVG already rendered at the output root is read there, so it is not rendered again", () => {
    const root = checkout({
      "some-layer/docs/img/d.svg": stamped("old source"),
      [`${LAYER_OUTPUT_ROOT}/some-layer/docs/img/d.svg`]: stamped("new source"),
    });
    expect(jobsToRender([{ source: "d.puml", text: "new source", svg: join(root, "some-layer/docs/img/d.svg") }], root)).toEqual([]);
  });

  test("a local layer's stale SVG is rendered in place, as before", () => {
    const root = checkout({ "some-layer/docs/img/e.svg": stamped("old source") }, false);
    const svg = join(root, "some-layer/docs/img/e.svg");
    expect(jobsToRender([{ source: "e.puml", text: "new source", svg }], root).map((j) => j.svg)).toEqual([svg]);
  });
});
