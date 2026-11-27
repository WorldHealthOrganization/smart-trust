/**
 * `publication.host` — the declared axis, its third state, and the one
 * cross-file conflict it makes possible.
 *
 * Bean `folio-assistant-1lfx`, issue #363. The owner chose to make the
 * publication host its own declared axis rather than overload
 * `readme.linkStyle`, on the stated understanding that two fields in two
 * files can then disagree. These are the tests for that cost.
 *
 * @module scripts/tests/publication-host.test
 */
import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { PUBLICATION_HOSTS, publicationHost, publicationLinkStyleConflict } from "../../schemas/kg/cat-harness.ts";
import { resolveHarnessConfigPath } from "../../schemas/kg/harness-config.ts";
import {  } from "../../schemas/kg/cat-harness.js";
import { writeDeclaration } from "../../test/support/instance-fixture.js";
import { HARNESS_ROOT } from "../lib/roots.ts";

const ROOT = resolve(HARNESS_ROOT);
const temps: string[] = [];

/** A layer root whose declaration is exactly `body`. */
function instance(body: string): string {
  const dir = mkdtempSync(join(tmpdir(), "publication-host-"));
  temps.push(dir);
  // The stem is supplied because several callers pass a body that is
  // deliberately malformed or nameless: there is no name to read out of it,
  // and the filename has to come from somewhere. `publicationHost` reads the
  // file discovery finds, so any stem does — what is under test is the body.
  writeDeclaration(dir, body, "probe");
  return dir;
}

afterAll(() => {
  for (const d of temps) rmSync(d, { recursive: true, force: true });
});

describe("reading the declared host", () => {
  test.each(PUBLICATION_HOSTS.map((h) => [h] as const))("%s round-trips", (host) => {
    expect(publicationHost(instance(JSON.stringify({ name: "x", publication: { host } })))).toBe(
      host,
    );
  });

  test("`none` is a declared answer, not an absent one", () => {
    // The distinction the whole field exists for: a developer checkout that
    // publishes nowhere has SAID so, and that is not the same as silence.
    const declared = publicationHost(
      instance(JSON.stringify({ name: "x", publication: { host: "none" } })),
    );
    const silent = publicationHost(instance(JSON.stringify({ name: "x" })));
    expect(declared).toBe("none");
    expect(silent).toBeUndefined();
    expect(declared).not.toBe(silent);
  });

  test.each([
    ["no publication block", JSON.stringify({ name: "x" })],
    ["an unknown host", JSON.stringify({ name: "x", publication: { host: "carrier-pigeon" } })],
    ["a non-string host", JSON.stringify({ name: "x", publication: { host: 7 } })],
    ["malformed JSON", "{ not json"],
  ])("%s reads as undefined, never as github-pages", (_label, body) => {
    // Every one of these is "has not said". Defaulting any of them to Pages
    // would put the original defect one layer lower, where nobody looks.
    expect(publicationHost(instance(body))).toBeUndefined();
  });

  test("a missing harness.json is undefined rather than a throw", () => {
    const dir = mkdtempSync(join(tmpdir(), "publication-host-empty-"));
    temps.push(dir);
    expect(publicationHost(dir)).toBeUndefined();
  });
});

describe("the host / linkStyle conflict", () => {
  test.each([["local-server"], ["jurisdiction-endpoint"], ["none"]] as const)(
    "%s with linkStyle pages is a conflict, and the message says how to fix it",
    (host) => {
      const msg = publicationLinkStyleConflict(host, "pages");
      expect(msg).toBeDefined();
      expect(msg).toContain(host);
      expect(msg).toContain("linkStyle");
      // A finding that does not say what to do is a complaint.
      expect(msg).toContain("blob");
    },
  );

  test("github-pages with linkStyle pages is exactly right", () => {
    expect(publicationLinkStyleConflict("github-pages", "pages")).toBeUndefined();
  });

  test.each([["blob"], ["raw"], [undefined]] as const)(
    "linkStyle %s is not ruled on for any host",
    (style) => {
      for (const host of PUBLICATION_HOSTS) {
        expect(publicationLinkStyleConflict(host, style)).toBeUndefined();
      }
    },
  );

  test("an undeclared host never conflicts", () => {
    // Silence cannot contradict anything. Reporting a conflict here would be
    // reading "has not said" as an assertion.
    expect(publicationLinkStyleConflict(undefined, "pages")).toBeUndefined();
  });

  test("`raw` is unruled because visibility is not declarable", () => {
    // Recorded as a test so the gap is checked rather than remembered: `raw`
    // resolves through raw.githubusercontent.com and depends on the forge and
    // on repo visibility, neither of which this schema carries. If that
    // changes, this test is where the rule gets added.
    expect(publicationLinkStyleConflict("local-server", "raw")).toBeUndefined();
  });
});

describe("this repository's own declaration", () => {
  test("its host and link style do not contradict each other", () => {
    // The live assertion. folio-assistant publishes to Pages and its README
    // defaults to `blob`, so this must stay quiet — and will speak up if
    // either side is changed without the other.
    // RESOLVED, not composed. This repository instantiates more than one
    // harness, so there is no single config filename to join onto the repo
    // root any more — `resolveHarnessConfigPath` walks out from `ROOT` and
    // answers with the config of the layer `ROOT` actually sits in.
    const cfgPath = resolveHarnessConfigPath(ROOT)?.path;
    let linkStyle: string | undefined;
    if (cfgPath && existsSync(cfgPath)) {
      const cfg = JSON.parse(readFileSync(cfgPath, "utf-8")) as {
        readme?: { linkStyle?: string };
      };
      linkStyle = cfg.readme?.linkStyle;
    }
    expect(publicationLinkStyleConflict(publicationHost(ROOT), linkStyle)).toBeUndefined();
  });
});
