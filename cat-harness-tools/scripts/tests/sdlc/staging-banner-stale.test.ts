/**
 * The staging banner's live staleness check (owner, 2026-10-31, option C):
 * the page asks GitHub for the branch head and says "stale" when it has moved
 * past the commit the preview was built from. Runs the banner's own client
 * against fakes of the DOM and fetch.
 */
import { describe, expect, test } from "bun:test";
import { CLIENT } from "../../staging-banner.ts";

const js = CLIENT;

type Node = { t?: string; text?: string; attrs: Record<string, string>; kids: Node[] };
function run(head: string | null) {
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
  const urls: string[] = [];
  const g = {
    location: { pathname: "/r/STAGING/b/en/index.html" },
    document: {
      readyState: "complete",
      querySelector: (q: string) => (q.includes("detail") ? detail : q.includes("banner") ? mk("div") : null),
      createElement: mk, createTextNode: (x: string) => ({ text: x, attrs: {}, kids: [] }),
      documentElement: { style: { setProperty() {} } }, addEventListener() {},
    },
    window: { addEventListener() {} },
    fetch: async (u: string) => {
      urls.push(u);
      if (u.endsWith("staging.json")) {
        return { ok: true, json: async () => ({ branch: "claude/x y", sha: "abc1234", built: "t", pr: "1", prUrl: "p",
          branchUrl: "https://github.com/o/r/tree/claude/x", issue: null, runUrl: "u", mainSite: "m", mainPagesKnown: false, newPages: [] }) };
      }
      return head === null ? { ok: false } : { ok: true, text: async () => head };
    },
  };
  // input-site: inert #ae2239d5 — evaluates browser-side or toString'd source from this tree's own modules, already in the read set; it reads no environment
  new Function(...Object.keys(g), js)(...Object.values(g));
  return { detail, urls };
}
const tick = () => new Promise((r) => setTimeout(r, 20));
const stale = (d: Node) => d.kids.find((k) => k.attrs?.["data-fa-staging-stale"] !== undefined);

describe("staging banner: live staleness", () => {
  test("says stale when the branch head moved past the built commit", async () => {
    const { detail, urls } = run("def5678" + "0".repeat(33));
    await tick();
    expect(urls[1]).toBe("https://api.github.com/repos/o/r/commits/claude%2Fx%20y");
    const s = stale(detail)!;
    expect(s.text).toBe("⚠ stale: the branch is now at ");
    expect(s.kids[0].text).toBe("def5678");
  });

  test("says nothing when the head is the built commit, or GitHub cannot be asked", async () => {
    const same = run("abc1234" + "0".repeat(33));
    const failed = run(null);
    const junk = run("<html>rate limited</html>");
    await tick();
    for (const r of [same, failed, junk]) expect(stale(r.detail)).toBeUndefined();
  });

});
