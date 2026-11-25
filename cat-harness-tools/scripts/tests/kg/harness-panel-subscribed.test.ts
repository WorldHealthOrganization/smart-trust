/**
 * The Harnesses panel's **Subscribed ↗ remote** group (issue #1719, after
 * bean `tmo5`): a harness a KG subscription reaches and this checkout has not
 * instantiated is listed, so turning an association into a subscription never
 * makes it vanish from the panel. Every test builds a checkout in a temporary
 * directory and subscribes through the injectable fetcher, so no network.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { readDeclaration } from "../../../schemas/kg/cat-harness.ts";
import { harnessPanel } from "../../harness-panel.ts";
import { instantiate } from "../../kg-instantiate.ts";
import { type RootFetcher, setTopLevelKey, subscribe } from "../../kg-subscribe.ts";

const SHA = "0123456789abcdef0123456789abcdef01234567";

const temps: string[] = [];
afterEach(() => {
  for (const t of temps.splice(0)) rmSync(t, { recursive: true, force: true });
});
function tmp(prefix: string): string {
  const d = mkdtempSync(join(tmpdir(), prefix));
  temps.push(d);
  return d;
}

const SUBSTRATE = {
  name: "ihris-kb",
  title: "iHRIS Knowledge Base",
  directories: [
    { id: "kb-skills", path: "skills/", graphTypologies: ["skills"] },
    { id: "plan", path: "beans/defs/", graphTypologies: ["bean-defs"] },
  ],
};

function serve(decl: Record<string, unknown>): RootFetcher {
  return () => {
    const d = mkdtempSync(join(tmpdir(), "panel-sub-root-"));
    temps.push(d);
    writeFileSync(join(d, `${decl["name"]}.json`), `${JSON.stringify(decl, null, 2)}\n`);
    return d;
  };
}

/** `<repo>/host/host.json`, with a snapshot directory, subscribed to SUBSTRATE choosing `harnesses`. */
async function checkout(harnesses: string[] = [], note?: string): Promise<{ repo: string; host: string }> {
  const repo = tmp("panel-sub-repo-");
  const host = join(repo, "host");
  mkdirSync(host);
  const file = join(host, "host.json");
  writeFileSync(
    file,
    `${JSON.stringify(
      {
        name: "host",
        livesAt: { repository: "litlfred/host", path: "host" },
        directories: [
          { id: "subscriptions", path: "subscriptions/", dependents: "skip", graphTypologies: ["substrate-snapshot"] },
          { id: "subscribed-harnesses", path: "subscribed-harnesses/", dependents: "skip", graphTypologies: ["subscribed-harnesses"] },
        ],
      },
      null,
      2,
    )}\n`,
  );
  const r = await subscribe({ target: `litlfred/ihris-kb@${SHA}`, instance: host, fetch: serve(SUBSTRATE) });
  if (!r.ok) throw new Error(r.reason);
  const raw = JSON.parse(readFileSync(file, "utf8")) as { subscriptions: Record<string, unknown>[] };
  const subs = raw.subscriptions.map((s) => ({ ...s, harnesses, ...(note ? { note } : {}) }));
  writeFileSync(file, setTopLevelKey(readFileSync(file, "utf8"), "subscriptions", subs));
  return { repo, host };
}

function panel(c: { repo: string; host: string }) {
  const decl = readDeclaration(c.host)!;
  return harnessPanel([{ dir: c.host, decl, instantiated: true }], c.repo, "https://github.com/x/here", "main", () => undefined);
}

describe("the panel's Subscribed ↗ remote group", () => {
  test("a subscribed, not-chosen harness is listed from its snapshot, with its pin", async () => {
    const c = await checkout([], "The iHRIS folio.");
    const p = panel(c);
    expect(p.subscribed).toEqual([
      {
        name: "ihris-kb",
        title: "iHRIS Knowledge Base",
        repository: "litlfred/ihris-kb",
        ref: SHA,
        url: `https://github.com/litlfred/ihris-kb/tree/${SHA}`,
        editHref: "https://github.com/litlfred/ihris-kb",
        subscription: "ihris-kb",
        chosen: false,
        note: "The iHRIS folio.",
        declaredBy: ["host"],
      },
    ]);
    expect(p.associated).toEqual([]);
    expect(p.findings.filter((f) => f.includes("subscription"))).toEqual([]);
  });

  test("a chosen harness not yet instantiated is listed, and marked chosen", async () => {
    const c = await checkout(["ihris-kb"]);
    expect(panel(c).subscribed.map((s) => [s.name, s.chosen])).toEqual([["ihris-kb", true]]);
  });

  test("once instantiated it leaves the group: it is a tile of its own then", async () => {
    const c = await checkout(["ihris-kb"]);
    expect(instantiate({ subscription: "ihris-kb", harness: "ihris-kb", instance: c.host }).ok).toBe(true);
    expect(panel(c).subscribed).toEqual([]);
  });

  test("a harness that is local is not listed as subscribed", async () => {
    const c = await checkout();
    const decl = readDeclaration(c.host)!;
    const p = harnessPanel(
      [
        { dir: c.host, decl, instantiated: true },
        { dir: join(c.repo, "ihris-kb"), decl: { ...decl, name: "ihris-kb", subscriptions: [] }, instantiated: false },
      ],
      c.repo,
      undefined,
      "main",
      () => undefined,
    );
    expect(p.subscribed).toEqual([]);
  });

  test("an unreadable snapshot is still a row, plus a finding, never silence", async () => {
    const c = await checkout();
    rmSync(join(c.host, "subscriptions", "ihris-kb.substrate.json"));
    const p = panel(c);
    expect(p.subscribed.map((s) => s.name)).toEqual(["ihris-kb"]);
    expect(p.findings.some((f) => f.startsWith("host: subscription `ihris-kb`") && f.includes("kg:subscribe"))).toBe(true);
  });

  test("no subscriptions: an empty group", () => {
    expect(harnessPanel([], "/nowhere", undefined, "main", () => undefined).subscribed).toEqual([]);
  });
});
