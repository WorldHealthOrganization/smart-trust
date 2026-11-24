/**
 * A workflow page's drawings load lazily on screen and completely in print
 * (owner, 2026-11-14: "do lazy load content and libs"; "make sure printing
 * loads all of the content before it renders the PDF on the browser").
 *
 * @module scripts/tests/state-visualizer-lazy
 *
 * The page script `WV_SCRIPT` is run against a small stand-in for the
 * browser: figures, a `<details>`, an IntersectionObserver the test drives,
 * and a `fetch` that records what was asked for. What is checked is which
 * drawings are fetched when, and that a print waits for all of them.
 */
import { describe, expect, test } from "bun:test";

import { WV_SCRIPT } from "../state-visualizer.ts";

type Listener = (ev: Record<string, unknown>) => void;

interface El {
  tagName: string;
  open?: boolean;
  parentElement: El | null;
  attrs: Record<string, string>;
  children: unknown[];
  wvLoad?: Promise<unknown>;
  classList: Set<string> & { add(c: string): void };
  getAttribute(k: string): string | null;
  replaceChildren(...c: unknown[]): void;
  querySelectorAll(sel: string): El[];
}

function el(tagName: string, parent: El | null, attrs: Record<string, string> = {}): El {
  const self: El = {
    tagName,
    parentElement: parent,
    attrs,
    children: [],
    getAttribute: (k) => attrs[k] ?? null,
    replaceChildren: (...c) => {
      self.children = c;
    },
    querySelectorAll: () => [],
    classList: new Set<string>(),
  };
  return self;
}

/** A page with three drawings, the third inside a closed `<details>`, and the script run on it. */
function run(opts: { observer: boolean }) {
  const body = el("BODY", null);
  const details = el("DETAILS", body);
  details.open = false;
  const figs = [
    el("FIGURE", body, { "data-wv-svg": "a.svg" }),
    el("FIGURE", body, { "data-wv-svg": "b.svg" }),
    el("FIGURE", details, { "data-wv-svg": "c.svg" }),
  ];
  details.querySelectorAll = () => [figs[2]!];
  const fetched: string[] = [];
  const pending: Array<() => void> = [];
  const fetchStub = (url: URL) => {
    fetched.push(url.pathname.split("/").pop()!);
    return new Promise((ok) => pending.push(() => ok({ ok: true, text: () => Promise.resolve("<svg/>") })));
  };
  const on: Record<string, Listener[]> = {};
  const listen = (k: string, f: Listener) => (on[k] ??= []).push(f);
  const fire = (k: string, ev: Record<string, unknown> = {}) => (on[k] ?? []).forEach((f) => f(ev));
  const observed: El[] = [];
  let observerCb: ((es: Array<{ isIntersecting: boolean; target: El }>) => void) | undefined;
  class IO {
    constructor(cb: typeof observerCb) {
      observerCb = cb;
    }
    observe(t: El) {
      observed.push(t);
    }
    unobserve(t: El) {
      observed.splice(observed.indexOf(t), 1);
    }
  }
  let printed = 0;
  const win: Record<string, unknown> = { addEventListener: listen, print: () => printed++ };
  const doc = {
    baseURI: "https://example.org/w/",
    querySelectorAll: (sel: string) => (sel === "[data-wv-svg]" ? figs : []),
    addEventListener: listen,
    importNode: (n: unknown) => n,
  };
  const svg = { nodeName: "svg", querySelectorAll: () => [] };
  class DP {
    parseFromString() {
      return { documentElement: svg };
    }
  }
  const js = WV_SCRIPT.replace(/^<script[^>]*>/i, "").replace(/<\/script\s*>\s*$/i, "");
  new Function("window", "document", "fetch", "DOMParser", "CSS", "IntersectionObserver", js)(
    win,
    doc,
    fetchStub,
    DP,
    { escape: (s: string) => s },
    opts.observer ? IO : undefined,
  );
  /** Answer every fetch so far, and let the promise chains run. */
  const settle = async () => {
    while (pending.length) pending.shift()!();
    for (let i = 0; i < 10; i++) await Promise.resolve();
  };
  const drawn = () => figs.map((f) => f.children[0] === svg && f.classList.has("wv-drawn"));
  return { figs, details, fetched, observed, fire, settle, drawn, win, printed: () => printed, intersect: (t: El) => observerCb!([{ isIntersecting: true, target: t }]) };
}

describe("lazy on screen", () => {
  test("no drawing is fetched at load; each is fetched once as it nears the viewport", async () => {
    const p = run({ observer: true });
    expect(p.fetched).toEqual([]);
    expect(p.observed.length).toBe(3);
    p.intersect(p.figs[1]!);
    p.intersect(p.figs[1]!);
    await p.settle();
    expect(p.fetched).toEqual(["b.svg"]);
    expect(p.drawn()).toEqual([false, true, false]);
    expect(p.observed).not.toContain(p.figs[1]);
  });

  test("a drawing inside a closed <details> is fetched when it is opened", async () => {
    const p = run({ observer: true });
    p.details.open = true;
    p.fire("toggle", { target: p.details });
    await p.settle();
    expect(p.fetched).toEqual(["c.svg"]);
    expect(p.drawn()).toEqual([false, false, true]);
  });

  test("with no IntersectionObserver every drawing is fetched at load", async () => {
    const p = run({ observer: false });
    await p.settle();
    expect(p.fetched).toEqual(["a.svg", "b.svg", "c.svg"]);
    expect(p.drawn()).toEqual([true, true, true]);
  });
});

describe("complete in print", () => {
  test("beforeprint opens what holds a drawing and fetches every one; afterprint closes it again", async () => {
    const p = run({ observer: true });
    p.intersect(p.figs[0]!);
    p.fire("beforeprint");
    expect(p.details.open).toBe(true);
    expect(p.fetched).toEqual(["a.svg", "b.svg", "c.svg"]);
    await p.settle();
    expect(p.drawn()).toEqual([true, true, true]);
    p.fire("afterprint");
    expect(p.details.open).toBe(false);
  });

  test("Ctrl+P and a Print button's wvPrintPrep wait for every drawing before printing", async () => {
    const p = run({ observer: true });
    let prevented = false;
    p.fire("keydown", { ctrlKey: true, key: "p", preventDefault: () => (prevented = true) });
    expect(prevented).toBe(true);
    expect(p.printed()).toBe(0);
    await p.settle();
    expect(p.drawn()).toEqual([true, true, true]);
    expect(p.printed()).toBe(1);
    // The promise a Print button waits on resolves only once all are drawn.
    const q = run({ observer: true });
    let ready = false;
    (q.win.wvPrintPrep as () => Promise<unknown>)().then(() => (ready = true));
    for (let i = 0; i < 10; i++) await Promise.resolve();
    expect(ready).toBe(false);
    await q.settle();
    expect(ready).toBe(true);
    expect(q.drawn()).toEqual([true, true, true]);
  });
});
