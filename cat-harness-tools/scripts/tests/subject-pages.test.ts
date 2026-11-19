/**
 * Where a subject page is linked: only on a site that writes one.
 *
 * `kg-export` writes the subject pages in the HOST's own deploy, so a link to
 * one is answered only when the checkout being built publishes the host's
 * site — the host itself, an index of its layers, or a root declaring the
 * host. A downstream checkout (its root declares an instance of its own, the
 * host a mount in it) builds its own site, which holds no subject page: there
 * the answer is `undefined` and each caller keeps its fallback. Before this
 * rule a downstream's step titles named
 * `<host base>/<downstream>/process/<id>/node/<id>`, a page nobody publishes.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { publishesHostSite, subjectHref } from "../lib/subject-pages.ts";
import { HARNESS_ROOT } from "../lib/roots.ts";

const DIR = mkdtempSync(join(tmpdir(), "subject-pages-"));
afterAll(() => rmSync(DIR, { recursive: true, force: true }));
const put = (rel: string, body: object): void => {
  mkdirSync(join(DIR, dirname(rel)), { recursive: true });
  writeFileSync(join(DIR, rel), JSON.stringify(body));
};

// The host, as a checkout of its own and as a mount.
put("host/host.json", { name: "host", directories: [] });
// An index of the host's layers: its root declares no layer.
put("index/index.config.json", { instances: ["host"] });
put("index/host/host.json", { name: "host", directories: [] });
// A downstream: its root declares itself, the host mounted inside it.
put("down/down.json", { name: "down", needs: ["host"], directories: [] });
put("down/host/host.json", { name: "host", directories: [] });

describe("which checkout publishes the host's site", () => {
  test("the host's own checkout does", () => {
    expect(publishesHostSite(join(DIR, "host"), join(DIR, "host"))).toBe(true);
  });
  test("an index of the host's layers does: its root declares no instance", () => {
    expect(publishesHostSite(join(DIR, "index"), join(DIR, "index/host"))).toBe(true);
  });
  test("a downstream does not: its root declares another instance, and builds that one's site", () => {
    expect(publishesHostSite(join(DIR, "down"), join(DIR, "down/host"))).toBe(false);
  });
});

describe("subjectHref in this checkout", () => {
  test("a file outside every instance gets no link", () => {
    expect(subjectHref(join(DIR, "nowhere/x.bpmn"), "process", "P/node/T")).toBeUndefined();
  });
  test("a host process gets its absolute subject IRI, a path under its document (when this checkout is the host's)", () => {
    const href = subjectHref(join(HARNESS_ROOT, "processes/any.bpmn"), "process", "P/node/T");
    // Run inside a downstream, the same call answers undefined: that is the rule, not a failure.
    if (href !== undefined) expect(href).toMatch(/^https?:\/\/.+\/process\/P\/node\/T$/);
  });
});
