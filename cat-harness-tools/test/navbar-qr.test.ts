/**
 * Unit and DOM tests for the navbar QR code capability — bean folio-assistant-5rmf.
 *
 * Verifies:
 * - QR icon button in LHS navbar row as a declared navbar capability
 * - Accessible button attributes (aria-label, aria-expanded, title, data-fa-tip)
 * - Sibling placement of .fa-qr-panel after .fa-nav-icons
 * - Toggle behavior: first click opens, second click hides (l4zi reachable inverse)
 * - Escape key and panel click close the panel
 * - Dynamic script loading when qrcode is not preloaded
 * - In-page hashchange updates URL
 */
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createContext, runInContext } from "node:vm";
import { HARNESS_ROOT } from "../scripts/lib/roots.ts";
import { siteFileFor } from "../schemas/kg/cat-harness.js";

const ROOT = join(HARNESS_ROOT);
const NAVBAR_ROW_JS = readFileSync(join(ROOT, siteFileFor(ROOT, "assets/js/navbar-row.js")), "utf8");
const QRCODE_JS = readFileSync(join(ROOT, siteFileFor(ROOT, "assets/js/vendor/qrcode.js")), "utf8");
const QRCODE_UTF8_JS = readFileSync(join(ROOT, siteFileFor(ROOT, "assets/js/vendor/qrcode_UTF8.js")), "utf8");

// A hand-rolled DOM mock that the vendored navbar and QR scripts run against:
// its events and elements are whatever those scripts hand it, so they stay `any`.
/* eslint-disable @typescript-eslint/no-explicit-any */
type EventHandler = (event: any) => void;

class MockElement {
  public tagName: string;
  public attributes: Record<string, string> = {};
  public children: MockElement[] = [];
  public parentNode: MockElement | null = null;
  public eventListeners: Record<string, EventHandler[]> = {};
  public textContent: string = "";
  public innerHTML: string = "";
  public classList: {
    add: (...tokens: string[]) => void;
    remove: (...tokens: string[]) => void;
    contains: (token: string) => boolean;
  };

  constructor(tagName: string) {
    this.tagName = tagName.toUpperCase();
    // eslint-disable-next-line @typescript-eslint/no-this-alias -- the classList methods below are object-literal functions with their own `this`
    const self = this;
    this.classList = {
      add(...tokens: string[]) {
        const classes = new Set((self.attributes.class || "").split(/\s+/).filter(Boolean));
        for (const t of tokens) classes.add(t);
        self.attributes.class = Array.from(classes).join(" ");
      },
      remove(...tokens: string[]) {
        const classes = new Set((self.attributes.class || "").split(/\s+/).filter(Boolean));
        for (const t of tokens) classes.delete(t);
        self.attributes.class = Array.from(classes).join(" ");
      },
      contains(token: string) {
        const classes = new Set((self.attributes.class || "").split(/\s+/).filter(Boolean));
        return classes.has(token);
      },
    };
  }

  setAttribute(k: string, v: string) {
    this.attributes[k] = String(v);
  }

  getAttribute(k: string): string | null {
    return Object.prototype.hasOwnProperty.call(this.attributes, k) ? this.attributes[k] : null;
  }

  hasAttribute(k: string): boolean {
    return Object.prototype.hasOwnProperty.call(this.attributes, k);
  }

  removeAttribute(k: string) {
    delete this.attributes[k];
  }

  appendChild(child: MockElement) {
    if (child.parentNode) child.parentNode.removeChild(child);
    this.children.push(child);
    child.parentNode = this;
    return child;
  }

  insertBefore(newChild: MockElement, refChild: MockElement | null) {
    if (newChild.parentNode) newChild.parentNode.removeChild(newChild);
    if (!refChild) return this.appendChild(newChild);
    const idx = this.children.indexOf(refChild);
    if (idx === -1) return this.appendChild(newChild);
    this.children.splice(idx, 0, newChild);
    newChild.parentNode = this;
    return newChild;
  }

  removeChild(child: MockElement) {
    const idx = this.children.indexOf(child);
    if (idx !== -1) {
      this.children.splice(idx, 1);
      child.parentNode = null;
    }
    return child;
  }

  get nextSibling(): MockElement | null {
    if (!this.parentNode) return null;
    const siblings = this.parentNode.children;
    const idx = siblings.indexOf(this);
    return idx !== -1 && idx + 1 < siblings.length ? siblings[idx + 1] : null;
  }

  get previousElementSibling(): MockElement | null {
    if (!this.parentNode) return null;
    const siblings = this.parentNode.children;
    const idx = siblings.indexOf(this);
    return idx > 0 ? siblings[idx - 1] : null;
  }

  addEventListener(type: string, handler: EventHandler) {
    if (!this.eventListeners[type]) this.eventListeners[type] = [];
    this.eventListeners[type].push(handler);
  }

  dispatchEvent(event: { type: string; [k: string]: any }): boolean {
    const list = this.eventListeners[event.type] || [];
    for (const fn of list) fn(event);
    return true;
  }

  click() {
    this.dispatchEvent({ type: "click" });
  }

  getBoundingClientRect() {
    return { top: 0, bottom: 40, left: 0, right: 200, width: 200, height: 40 };
  }

  focus() {}

  matches(sel: string): boolean {
    if (sel === ".side-bar") return this.classList.contains("side-bar");
    if (sel === "nav.fa-nav") return this.tagName === "NAV" && this.classList.contains("fa-nav");
    return false;
  }

  querySelector(sel: string): MockElement | null {
    return this.querySelectorAll(sel)[0] || null;
  }

  querySelectorAll(sel: string): MockElement[] {
    const res: MockElement[] = [];
    const check = (node: MockElement) => {
      let match = false;
      if (sel === ".side-bar" && node.classList.contains("side-bar")) match = true;
      else if (sel === "nav.fa-nav" && node.tagName === "NAV" && node.classList.contains("fa-nav")) match = true;
      else if (sel === ".fa-nav-icons" && node.classList.contains("fa-nav-icons")) match = true;
      else if (sel === ".site-header" && node.classList.contains("site-header")) match = true;
      else if (sel === ".fa-nav-in > .fa-nav-top" && node.classList.contains("fa-nav-top")) match = true;
      else if (sel.includes(".fa-qr-panel") && node.classList.contains("fa-qr-panel")) match = true;
      else if (sel.includes(".fa-nav-qr") && node.classList.contains("fa-nav-qr")) match = true;
      else if (sel.includes(".fa-qr-caption") && node.classList.contains("fa-qr-caption")) match = true;

      if (match) res.push(node);
      for (const child of node.children) check(child);
    };
    for (const child of this.children) check(child);
    return res;
  }
}

function createTestEnv(options: {
  barClass?: string;
  preloadQr?: boolean;
  icons?: string[];
  url?: string;
} = {}) {
  const barClass = options.barClass ?? "side-bar";
  const preloadQr = options.preloadQr ?? true;
  const icons = options.icons ?? ["close", "todos", "beans", "fsh-guts", "qr", "launcher"];
  const url = options.url ?? "https://example.com/folio-assistant/guides/test.html";

  const rootDoc = new MockElement("HTML");
  const head = new MockElement("HEAD");
  const body = new MockElement("BODY");
  rootDoc.appendChild(head);
  rootDoc.appendChild(body);

  const bar = barClass === "side-bar" ? new MockElement("DIV") : new MockElement("NAV");
  bar.setAttribute("class", barClass);
  body.appendChild(bar);

  if (barClass === "side-bar") {
    const header = new MockElement("DIV");
    header.setAttribute("class", "site-header");
    bar.appendChild(header);
    const nav = new MockElement("DIV");
    nav.setAttribute("class", "site-nav");
    bar.appendChild(nav);
  } else {
    const navIn = new MockElement("DIV");
    navIn.setAttribute("class", "fa-nav-in");
    const navTop = new MockElement("DIV");
    navTop.setAttribute("class", "fa-nav-top");
    navIn.appendChild(navTop);
    bar.appendChild(navIn);
  }

  // Row data script
  const rowScript = new MockElement("SCRIPT");
  rowScript.setAttribute("id", "fa-navbar-row");
  rowScript.textContent = JSON.stringify({
    icons,
    hrefs: { beans: "/beans/" },
    notes: {},
  });
  body.appendChild(rowScript);

  const windowListeners: Record<string, EventHandler[]> = {};
  const docListeners: Record<string, EventHandler[]> = {};

  const sandbox: any = {
    window: {
      location: { href: url },
      addEventListener(type: string, fn: EventHandler) {
        if (!windowListeners[type]) windowListeners[type] = [];
        windowListeners[type].push(fn);
      },
      dispatchEvent(e: any) {
        const list = windowListeners[e.type] || [];
        for (const fn of list) fn(e);
      },
    },
    location: { href: url },
    document: {
      head,
      body,
      readyState: "complete",
      createElement(tag: string) {
        const el = new MockElement(tag);
        if (tag.toLowerCase() === "script") {
          // Track script addition to head
          Object.defineProperty(el, "src", {
            set(v: string) {
              el.setAttribute("src", v);
              setTimeout(() => {
                if (v.includes("qrcode.js")) {
                  runInContext(QRCODE_JS, sandbox);
                } else if (v.includes("qrcode_UTF8.js")) {
                  runInContext(QRCODE_UTF8_JS, sandbox);
                }
                if (typeof (el as any).onload === "function") {
                  (el as any).onload();
                }
              }, 0);
            },
            get() {
              return el.getAttribute("src") || "";
            },
          });
        }
        return el;
      },
      getElementById(id: string) {
        if (id === "fa-navbar-row") return rowScript;
        return null;
      },
      querySelector(sel: string) {
        if (sel === ".side-bar" && barClass === "side-bar") return bar;
        if (sel === "nav.fa-nav" && barClass === "nav.fa-nav") return bar;
        if (sel === 'meta[name="fa-baseurl"]') return null;
        if (sel === "#fa-navbar-row") return rowScript;
        return body.querySelector(sel);
      },
      querySelectorAll(sel: string) {
        return body.querySelectorAll(sel);
      },
      addEventListener(type: string, fn: EventHandler) {
        if (!docListeners[type]) docListeners[type] = [];
        docListeners[type].push(fn);
      },
      dispatchEvent(e: any) {
        const list = docListeners[e.type] || [];
        for (const fn of list) fn(e);
      },
    },
    console,
    setTimeout,
    clearTimeout,
    Array,
    Object,
    JSON,
    String,
    Boolean,
    Set,
    Map,
    URL,
  };
  sandbox.window.document = sandbox.document;

  createContext(sandbox);

  if (preloadQr) {
    runInContext(QRCODE_JS, sandbox);
    runInContext(QRCODE_UTF8_JS, sandbox);
  }

  runInContext(NAVBAR_ROW_JS, sandbox);

  return { sandbox, bar, body };
}

describe("LHS navbar QR code capability (bean folio-assistant-5rmf)", () => {
  it("mounts the QR button in .fa-nav-icons with correct accessible attributes", () => {
    const { bar } = createTestEnv({ barClass: "side-bar" });
    const qrBtn = bar.querySelector(".fa-nav-qr");
    expect(qrBtn).not.toBeNull();
    expect(qrBtn!.tagName).toBe("BUTTON");
    expect(qrBtn!.getAttribute("type")).toBe("button");
    expect(qrBtn!.getAttribute("aria-label")).toBe("QR code for this page");
    expect(qrBtn!.getAttribute("aria-expanded")).toBe("false");
    expect(qrBtn!.getAttribute("title")).toBe("QR code for this page");
    expect(qrBtn!.getAttribute("data-fa-tip")).toBe("QR code for this page");
    expect(qrBtn!.innerHTML).toContain("<svg");
  });

  // ABOVE the row since the row moved to the navbar's foot (owner,
  // 2026-11-13: "put these controls at the bottom of the navbar"), so the
  // code opens upward and the row stays where it is.
  it("places the .fa-qr-panel as a sibling directly BEFORE .fa-nav-icons, at the navbar's foot", () => {
    const { bar } = createTestEnv({ barClass: "side-bar" });
    const host = bar.querySelector(".fa-nav-icons");
    const panel = bar.querySelector(".fa-qr-panel");
    expect(host).not.toBeNull();
    expect(panel).not.toBeNull();
    expect(panel!.parentNode).toBe(bar);
    expect(panel!.nextSibling).toBe(host);
    expect(host!.nextSibling).toBeNull();
    expect(panel!.getAttribute("data-open")).toBe("false");
    expect(panel!.getAttribute("role")).toBe("region");
    expect(panel!.getAttribute("aria-label")).toBe("QR code for this page");
  });

  it("toggles the QR code open on first click and closed on second click (l4zi reachable inverse)", () => {
    const { bar } = createTestEnv({
      barClass: "side-bar",
      url: "https://example.com/folio-assistant/guides/test.html",
    });
    const qrBtn = bar.querySelector(".fa-nav-qr")!;
    const panel = bar.querySelector(".fa-qr-panel")!;

    expect(panel.getAttribute("data-open")).toBe("false");
    expect(qrBtn.getAttribute("aria-expanded")).toBe("false");

    // Click 1: opens
    qrBtn.click();
    expect(panel.getAttribute("data-open")).toBe("true");
    expect(qrBtn.getAttribute("aria-expanded")).toBe("true");

    // Verify SVG and caption
    const art = panel.children[0];
    const caption = panel.children[1];
    expect(art.innerHTML).toContain("<svg");
    expect(caption.textContent).toBe("https://example.com/folio-assistant/guides/test.html");

    // Click 2: closes
    qrBtn.click();
    expect(panel.getAttribute("data-open")).toBe("false");
    expect(qrBtn.getAttribute("aria-expanded")).toBe("false");
  });

  it("closes the panel when the panel itself is clicked", () => {
    const { bar } = createTestEnv({ barClass: "side-bar" });
    const qrBtn = bar.querySelector(".fa-nav-qr")!;
    const panel = bar.querySelector(".fa-qr-panel")!;

    qrBtn.click();
    expect(panel.getAttribute("data-open")).toBe("true");

    panel.click();
    expect(panel.getAttribute("data-open")).toBe("false");
    expect(qrBtn.getAttribute("aria-expanded")).toBe("false");
  });

  it("closes the panel when Escape is pressed", () => {
    const { bar, sandbox } = createTestEnv({ barClass: "side-bar" });
    const qrBtn = bar.querySelector(".fa-nav-qr")!;
    const panel = bar.querySelector(".fa-qr-panel")!;

    qrBtn.click();
    expect(panel.getAttribute("data-open")).toBe("true");

    sandbox.document.dispatchEvent({ type: "keydown", key: "Escape" });
    expect(panel.getAttribute("data-open")).toBe("false");
    expect(qrBtn.getAttribute("aria-expanded")).toBe("false");
  });

  it("re-renders the QR code on hashchange when open", () => {
    const { bar, sandbox } = createTestEnv({
      barClass: "side-bar",
      url: "https://example.com/page.html",
    });
    const qrBtn = bar.querySelector(".fa-nav-qr")!;
    const panel = bar.querySelector(".fa-qr-panel")!;

    qrBtn.click();
    const caption = panel.children[1];
    expect(caption.textContent).toBe("https://example.com/page.html");

    // Change hash
    sandbox.location.href = "https://example.com/page.html#section-2";
    sandbox.window.location.href = "https://example.com/page.html#section-2";
    sandbox.window.dispatchEvent({ type: "hashchange" });

    expect(caption.textContent).toBe("https://example.com/page.html#section-2");
  });

  it("mounts and works on nav.fa-nav (the rail)", () => {
    const { bar } = createTestEnv({
      barClass: "nav.fa-nav",
      url: "https://example.com/railed.html",
    });
    const qrBtn = bar.querySelector(".fa-nav-qr");
    const panel = bar.querySelector(".fa-qr-panel");

    expect(qrBtn).not.toBeNull();
    expect(panel).not.toBeNull();

    qrBtn!.click();
    expect(panel!.getAttribute("data-open")).toBe("true");
    expect(qrBtn!.getAttribute("aria-expanded")).toBe("true");

    const caption = panel!.children[1];
    expect(caption.textContent).toBe("https://example.com/railed.html");

    qrBtn!.click();
    expect(panel!.getAttribute("data-open")).toBe("false");
    expect(qrBtn!.getAttribute("aria-expanded")).toBe("false");
  });
});
