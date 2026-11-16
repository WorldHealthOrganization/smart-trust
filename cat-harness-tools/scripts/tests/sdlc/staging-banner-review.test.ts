/**
 * The staging banner links the preview's review page (owner, 2026-11-01,
 * Q-REV-1): a folio's at `<root>/<locale>/review/`, an IG's at
 * `<root>/review/`, and no link when the build has none. Runs the banner's
 * own client against fakes of the DOM and fetch.
 */
import { describe, expect, test } from "bun:test";
import { CLIENT } from "../../staging-banner.ts";

const js = CLIENT;

type Node = { t?: string; text?: string; attrs: Record<string, string>; kids: Node[] };
function run(pathname: string, exists: string[]) {
  const mk = (t: string): Node & Record<string, unknown> => {
    const n: Node & Record<string, unknown> = {
      t, attrs: {}, kids: [],
      setAttribute(k: string, v: string) { n.attrs[k] = v; },
      getAttribute(k: string) { return n.attrs[k] ?? ""; },
      appendChild(x: Node) { n.kids.push(x); return x; },
      removeChild() {},
      getBoundingClientRect: () => ({ height: 10 }),
    };
    Object.defineProperty(n, "firstChild", { get: () => null });
    Object.defineProperty(n, "textContent", { set: (v: string) => (n.text = v) });
    return n;
  };
  const detail = mk("div");
  const heads: string[] = [];
  const g = {
    location: { pathname },
    document: {
      readyState: "complete",
      querySelector: (q: string) => (q.includes("detail") ? detail : q.includes("banner") ? mk("div") : null),
      createElement: mk, createTextNode: (x: string) => ({ text: x, attrs: {}, kids: [] }),
      documentElement: { style: { setProperty() {} } }, addEventListener() {},
    },
    window: { addEventListener() {} },
    fetch: async (u: string, o?: { method?: string }) => {
      if (u.endsWith("staging.json")) {
        return { ok: true, json: async () => ({ branch: "b", sha: "abc1234", built: "t", pr: "1", prUrl: "p",
          branchUrl: "x", issue: null, runUrl: "u", mainSite: "m", mainPagesKnown: false, newPages: [] }) };
      }
      if (o?.method === "HEAD") { heads.push(u); return { ok: exists.includes(u) }; }
      return { ok: false };
    },
  };
  // input-site: inert #ae2239d5 — evaluates browser-side or toString'd source from this tree's own modules, already in the read set; it reads no environment
  new Function(...Object.keys(g), js)(...Object.values(g));
  return { detail, heads };
}
const tick = () => new Promise((r) => setTimeout(r, 20));
const reviewLink = (d: Node) => {
  const s = d.kids.find((k) => k.attrs?.["data-fa-staging-review"] !== undefined)!;
  return s.kids.find((k) => k.t === "a");
};

describe("staging banner: review page link", () => {
  test("an IG's review page at the preview root", async () => {
    const { detail } = run("/r/STAGING/b/concepts.html", ["/r/STAGING/b/review/index.html"]);
    await tick();
    const a = reviewLink(detail)!;
    expect(a.attrs.href).toBe("/r/STAGING/b/review/");
    expect(a.text).toBe("🔍 Review changes");
  });

  test("a folio's review page under the page's locale, asked first", async () => {
    const { detail, heads } = run("/r/STAGING/b/en/dth-pc/index.html", ["/r/STAGING/b/en/review/index.html", "/r/STAGING/b/review/index.html"]);
    await tick();
    expect(heads[0]).toBe("/r/STAGING/b/en/review/index.html");
    expect(reviewLink(detail)!.attrs.href).toBe("/r/STAGING/b/en/review/");
  });

  test("no review page, no link", async () => {
    const { detail, heads } = run("/r/STAGING/b/en/index.html", []);
    await tick();
    expect(heads.length).toBe(2);
    expect(reviewLink(detail)).toBeUndefined();
  });
});
