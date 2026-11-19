/**
 * Source liveness — three states, and "could not determine" is never live (bean `08u4`).
 *
 * @module folio-assistant-core/scripts/source-liveness.test
 *
 * Every network answer is injected: a test that reached the network would
 * pass or fail with the environment, which is the exact confusion the
 * three-state rule exists to prevent.
 */
import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";

import { catalogueNodes, checkSourceLiveness, createSafeFetcher, exitCodeFor, probeLiveness, probeSnapshot, type Fetcher } from "./source-liveness.ts";

const answers = (status: number, body?: unknown): Fetcher => async () => ({ status, json: body === undefined ? undefined : async () => body });
const refuses: Fetcher = async () => {
  throw new Error("connect_rejected");
};

describe("probeLiveness", () => {
  test("liveStatuses", async () => {
    expect((await probeLiveness("https://hdl.handle.net/10665/1", answers(200))).liveness).toBe("live");
    expect((await probeLiveness("https://hdl.handle.net/10665/1", answers(302))).liveness).toBe("live");
  });

  test("goneStatuses", async () => {
    expect((await probeLiveness("https://hdl.handle.net/10665/1", answers(404))).liveness).toBe("gone");
    expect((await probeLiveness("https://hdl.handle.net/10665/1", answers(410))).liveness).toBe("gone");
  });

  test("refusalCouldNotDetermine", async () => {
    for (const f of [answers(403), answers(401), answers(500), refuses]) {
      expect((await probeLiveness("https://hdl.handle.net/10665/1", f)).liveness).toBe("could-not-determine");
    }
  });

  test("timeoutCouldNotDetermine", async () => {
    const hangs: Fetcher = (_u, { signal }) =>
      new Promise((_r, reject) => signal.addEventListener("abort", () => reject(new Error("aborted"))));
    expect((await probeLiveness("https://hdl.handle.net/10665/1", hangs, 20)).liveness).toBe("could-not-determine");
  });
});

describe("probeSnapshot", () => {
  test("snapshotFound", async () => {
    const r = await probeSnapshot("https://hdl.handle.net/10665/1", answers(200, { archived_snapshots: { closest: { available: true, url: "https://web.archive.org/web/2020/x", timestamp: "2020" } } }));
    expect(r.snapshot).toBe("found");
    expect(r.url).toContain("web.archive.org");
  });

  test("emptySnapshotNone", async () => {
    expect((await probeSnapshot("https://hdl.handle.net/10665/1", answers(200, { archived_snapshots: {} }))).snapshot).toBe("none");
  });

  test("oddSnapshotCouldNotDetermine", async () => {
    expect((await probeSnapshot("https://hdl.handle.net/10665/1", refuses)).snapshot).toBe("could-not-determine");
    expect((await probeSnapshot("https://hdl.handle.net/10665/1", answers(503))).snapshot).toBe("could-not-determine");
    expect((await probeSnapshot("https://hdl.handle.net/10665/1", answers(200, { unexpected: true }))).snapshot).toBe("could-not-determine");
  });
});

describe("over the real who-iris catalogue, with the network refused", () => {
  const nodes = catalogueNodes(resolve(import.meta.dir, "..", "..", "who-iris"));

  test("refusedNetworkExits2", async () => {
    const r = await checkSourceLiveness(nodes, refuses);
    expect(r.length).toBe(nodes.length);
    expect(r.every((x) => x.liveness === "could-not-determine")).toBe(true);
    expect(exitCodeFor(r)).toBe(2);
  });

  test("probedViaHandleElseHost", async () => {
    const r = await checkSourceLiveness(nodes, refuses);
    const items = r.filter((x) => x.kind === "item");
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((x) => x.viaHandle && x.iri!.startsWith("https://hdl.handle.net/"))).toBe(true);
    // Containers too, since the catalogue records a Handle for collections
    // and communities: the persistent identifier is preferred wherever it exists.
    const handleOf = new Map(nodes.map((n) => [n.id, Boolean(n.handle)]));
    for (const x of r.filter((x) => x.kind === "container")) {
      expect({ id: x.id, viaHandle: x.viaHandle }).toEqual({ id: x.id, viaHandle: handleOf.get(x.id)! });
    }
  });

  test("oneGoneExits1", async () => {
    const r = await checkSourceLiveness(nodes, async (u) => ({ status: u.includes("10665/36842") ? 404 : 200, json: async () => ({ archived_snapshots: {} }) }));
    expect(r.find((x) => x.iri?.includes("10665/36842"))?.liveness).toBe("gone");
    expect(exitCodeFor(r)).toBe(1);
  });

  test("allLiveExits0", async () => {
    const r = await checkSourceLiveness(nodes, answers(200, { archived_snapshots: {} }));
    expect(exitCodeFor(r)).toBe(0);
  });
});

describe("destination checks and redirect validation (bean folio-core-xpsq)", () => {
  test("refusesNonHttpsAndHosts", async () => {
    const httpRes = await probeLiveness("http://hdl.handle.net/10665/1", answers(200));
    expect(httpRes.liveness).toBe("could-not-determine");
    expect(httpRes.basis).toMatch(/https:/i);

    const hostRes = await probeLiveness("https://evil.example/10665/1", answers(200));
    expect(hostRes.liveness).toBe("could-not-determine");
    expect(hostRes.basis).toMatch(/unexpected host/i);

    const snapHostRes = await probeSnapshot("https://evil.example/10665/1", answers(200));
    expect(snapHostRes.snapshot).toBe("could-not-determine");
    expect(snapHostRes.basis).toMatch(/unexpected host/i);
  });

  test("safeFetcherRedirects", async () => {
    const okRedirectFetch: typeof fetch = (async (input: string | URL | Request) => {
      const u = String(input);
      if (u === "https://hdl.handle.net/10665/1") {
        return new Response(null, {
          status: 302,
          headers: { location: "https://iris.who.int/handle/10665/1" },
        });
      }
      if (u === "https://iris.who.int/handle/10665/1") {
        return new Response(null, { status: 200 });
      }
      throw new Error(`unexpected ${u}`);
    }) as unknown as typeof fetch;

    const okRes = await probeLiveness(
      "https://hdl.handle.net/10665/1",
      createSafeFetcher(okRedirectFetch),
    );
    expect(okRes.liveness).toBe("live");

    const evilRedirectFetch: typeof fetch = (async (input: string | URL | Request) => {
      const u = String(input);
      if (u === "https://hdl.handle.net/10665/1") {
        return new Response(null, {
          status: 302,
          headers: { location: "http://169.254.169.254/latest/meta-data/" },
        });
      }
      throw new Error(`should not follow redirect to ${u}`);
    }) as unknown as typeof fetch;

    const evilRes = await probeLiveness(
      "https://hdl.handle.net/10665/1",
      createSafeFetcher(evilRedirectFetch),
    );
    expect(evilRes.liveness).toBe("could-not-determine");
    expect(evilRes.basis).toMatch(/https:/i);
  });
});
