/**
 * The ✍ Questionnaire mode's pure half: the checker, the change request and
 * the Form Builder hand-back. A synthetic Questionnaire: this layer names no
 * real IG.
 */
import { describe, expect, test } from "bun:test";

// @ts-expect-error -- a plain ES module, deliberately untyped (no build step).
import { annotatedPatch, builderStep, builderUrl, check, instanceLine, issue, issueUrl, itemTable, jsonPatch, open, URL_CAP, withWhy } from "./questionnaire-mode.js";

const q = (...item: object[]) => ({ resourceType: "Questionnaire", id: "intake", url: "http://example.org/ig/Questionnaire/intake", item });
const name = { linkId: "1", type: "string", text: "Name", definition: "http://example.org/ig/StructureDefinition/Client#name" };
const dob = { linkId: "2", type: "date", text: "Date of birth", code: [{ code: "DE2" }] };
const text = (o: object) => JSON.stringify(o, null, 2);

describe("check: findings in the registry's shape", () => {
  test("checkErrorsSyntaxOnly", () => {
    expect(check(text(q(name)), "{nope")).toEqual([{ severity: "error", message: expect.stringMatching(/^not JSON/) }]);
    expect(check(text(q(name)), '{"resourceType":"Patient"}')[0].severity).toBe("error");
  });
  test("checkWarnsIntroducedOnly", () => {
    const before = text(q(name, { ...dob, enableWhen: [{ question: "9" }] }));
    const after = text(q(name, { ...dob, linkId: "1", enableWhen: [{ question: "9" }] }));
    expect(check(before, after)).toEqual([
      { severity: "warning", message: 'linkId "1" is used by more than one item' },
      { severity: "warning", message: 'item "1" has enableWhen on "9", which is no item\'s linkId' },
    ]);
    expect(check(before, before)).toEqual([]);
  });
  test("wireframeAddsFidelityWarning", () => {
    const f = check(text(q(name, dob)), text(q(dob, name)), { wireframe: '<input data-element="name"><input data-element="DE2">' });
    expect(f).toHaveLength(1);
    expect(f[0].message).toContain("order differs");
  });
});

describe("the JSON Patch", () => {
  test("changedTextOneReplace", () => {
    const p = annotatedPatch(q(name, dob), q(name, { ...dob, text: "Birth date" }));
    expect(p).toEqual([{ op: "replace", path: "/item/1/text", value: "Birth date", linkId: "2" }]);
  });
  test("addedRemovedItemsAndKeys", () => {
    expect(jsonPatch(q(name), q(name, dob))).toEqual([{ op: "add", path: "/item/1", value: dob }]);
    expect(jsonPatch(q(name, dob), q(name))).toEqual([{ op: "remove", path: "/item/1" }]);
    expect(jsonPatch({ a: 1, "b/c": 2 }, { a: 1 })).toEqual([{ op: "remove", path: "/b~1c" }]);
  });
});

describe("issue: the change request", () => {
  const cfg = { repo: "o/ig", branch: "main", suggest: { source: "input/fsh/intake.fsh#L12", slug: "example.ig" } };
  test("issueTitleAndBodyOnly", () => {
    const r = issue(text(q(name, dob)), text(q(name, { ...dob, required: true })), { repo: "o/ig", branch: "dev", config: cfg, edited: "wireframe", why: "Birth date is mandatory.", page: "https://o.github.io/ig/Questionnaire-intake-form.html" });
    expect(Object.keys(r).sort()).toEqual(["body", "title"]);
    expect(r.title).toBe("Suggested edit [example.ig]: Questionnaire/intake");
    expect(r.body).toContain("**Questionnaire:** http://example.org/ig/Questionnaire/intake");
    expect(r.body).toContain("the L2 wireframe — bring the Questionnaire in line with it");
    expect(r.body).toContain("**Source:** [input/fsh/intake.fsh#L12](https://github.com/o/ig/blob/dev/input/fsh/intake.fsh#L12)");
    expect(r.body).toContain("**Page:** https://o.github.io/ig/Questionnaire-intake-form.html");
    // The Why is the host's to append (the runtime does), never the mode's.
    expect(r.body).not.toContain("Birth date is mandatory.");
    expect(r.body).not.toContain("Why");
    expect(r.body).toContain("| `2` | date · Date of birth | date · Date of birth · required |");
    const patch = /```json\n([\s\S]*?)\n```/.exec(r.body)![1]!;
    expect(JSON.parse(patch)).toEqual([{ op: "add", path: "/item/1/required", value: true, linkId: "2" }]);
  });
  test("sideDefaultsQuestionnaire", () => {
    const r = issue(text(q(name)), text(q({ ...name, text: "Full name" })));
    expect(r.body).toContain("the Questionnaire — bring the L2 wireframe in line with it");
    expect(r.title).toBe("Suggested edit: Questionnaire/intake");
  });
  test("sourceAnchoredOnInstanceLine", () => {
    const fsh = "Alias: $x = http://x\n\nInstance:   intake\nInstanceOf: Questionnaire\n";
    const r = issue(text(q(name)), text(q({ ...name, text: "Full name" })), { repo: "o/ig", branch: "main", config: cfg, sourcePath: "input/fsh/q.fsh", sourceText: fsh });
    expect(r.body).toContain("**Source:** [input/fsh/q.fsh#L3](https://github.com/o/ig/blob/main/input/fsh/q.fsh#L3)");
    const plain = issue(text(q(name)), text(q({ ...name, text: "Full name" })), { repo: "o/ig", sourcePath: "input/fsh/q.fsh", sourceText: "Instance: other\n" });
    expect(plain.body).toContain("**Source:** [input/fsh/q.fsh](https://github.com/o/ig/blob/main/input/fsh/q.fsh)");
    expect(instanceLine(undefined, "intake")).toBeUndefined();
  });
  test("withWhyAppendsOnce", () => {
    expect(withWhy("body", "  Reads better.  ")).toBe("body\n\n**Why:**\nReads better.\n");
    expect(withWhy("body", "")).toBe("body");
    expect(withWhy(withWhy("body", "Reads better."), "Reads better.")).toBe("body\n\n**Why:**\nReads better.\n");
  });
  test("unchangedItemsSaysSo", () => {
    expect(itemTable(q(name), { ...q(name), title: "New" })).toStartWith("No item changed");
  });
  test("fallbackLinkMirrorsRuntime", () => {
    const small = issueUrl("o/r", issue(text(q(name)), text(q({ ...name, text: "Full name" }))));
    expect(small.clipboard).toBeUndefined();
    const u = new URL(small.url);
    expect(u.origin + u.pathname).toBe("https://github.com/o/r/issues/new");
    expect(u.searchParams.get("template")).toBeNull();
    expect(u.searchParams.get("body")).toContain("JSON Patch");
    expect(new URL(issueUrl("o/r", { title: "t", body: "b", template: "x.md" }).url).searchParams.get("template")).toBe("x.md");
    const big = issueUrl("o/r", issue(text(q(name)), text(q({ ...name, text: "x".repeat(URL_CAP) }))));
    expect(big.url.length).toBeLessThan(URL_CAP);
    expect(new URL(big.url).searchParams.get("body")).toBe("The suggested change is on the clipboard: paste it here.");
    expect(big.clipboard).toContain("JSON Patch");
  });
});

/** Just enough DOM for `open`: elements that nest, find a checked radio, and leave. */
class El {
  kids: El[] = [];
  parent: El | null = null;
  attrs: Record<string, string> = {};
  listeners: Record<string, Array<(e: unknown) => void>> = {};
  [k: string]: unknown;
  constructor(public tagName: string, public ownerDocument: unknown) {}
  append(...ks: Array<El | string>) {
    for (const k of ks) if (k instanceof El) { k.parent = this; this.kids.push(k); }
  }
  setAttribute(k: string, v: string) { this.attrs[k] = v; }
  addEventListener(t: string, f: (e: unknown) => void) { (this.listeners[t] ??= []).push(f); }
  click() { for (const f of this.listeners.click ?? []) f({}); }
  remove() { if (this.parent) this.parent.kids = this.parent.kids.filter((k) => k !== this); this.parent = null; }
  all(): El[] { return this.kids.flatMap((k) => [k, ...k.all()]); }
  querySelector(sel: string) {
    if (sel === 'input[name="fa-q-edited"]:checked') return this.all().find((e) => e.tagName === "input" && e.checked) ?? null;
    return null;
  }
  closest(sel: string): El | null { return sel === "dialog" ? (this.tagName === "dialog" ? this : (this.parent?.closest(sel) ?? null)) : null; }
}
function page() {
  const win = { location: { href: "https://o.github.io/ig/Questionnaire-intake-form.html#x" }, addEventListener() {}, removeEventListener() {}, open: () => null, navigator: {} };
  const doc = { defaultView: win, createElement: (t: string) => new El(t, doc) };
  const dialog = new El("dialog", doc);
  const host = new El("div", doc);
  dialog.append(host);
  return { host, dialog };
}

describe("open: the mode the runtime calls", () => {
  const original = text(q(name, dob));
  test("untouchedEditorHandsBack", async () => {
    const { host } = page();
    const said: string[] = [];
    const h = open(host, { text: original, status: (m: string) => said.push(m) });
    expect(await h.get()).toBe(original);
    expect(said[0]).toBe("Not edited yet.");
    h.dispose();
    expect(host.kids).toHaveLength(0);
  });
  test("rawEditReachesIssue", async () => {
    const { host } = page();
    const ctx = { text: original, sourcePath: "input/fsh/intake.fsh", sourceText: "Instance: intake\n", why: "Reads better.", repo: "o/ig", status: () => {}, config: { suggest: {} } };
    const h = open(host, ctx);
    const panel = host.kids[0]!;
    const [rawBtn] = panel.all().filter((e) => e.tagName === "button" && e.textContent === "Edit the JSON");
    rawBtn!.click();
    const ta = panel.all().find((e) => e.tagName === "textarea")!;
    ta.value = text(q(name, { ...dob, text: "Birth date" }));
    for (const r of panel.all().filter((e) => e.tagName === "input")) r.checked = r.value === "wireframe";
    const after = await h.get();
    expect(JSON.parse(after).item[1].text).toBe("Birth date");
    expect(check(original, after)).toEqual([]);
    const r = issue(original, after, ctx);
    expect(r.body).toContain("the L2 wireframe — bring the Questionnaire in line with it");
    expect(r.body).toContain("input/fsh/intake.fsh#L1");
    expect(r.body).not.toContain("Reads better.");
    expect(withWhy(r.body, ctx.why).match(/\*\*Why:\*\*/g)).toHaveLength(1);
    expect(r.body).toContain('"path": "/item/1/text"');
    h.dispose();
  });
  test("refusesNonQuestionnaire", () => {
    expect(() => open(page().host, { text: "# a page", src: "x.json" })).toThrow("x.json is not a Questionnaire as JSON");
  });
});

describe("the Form Builder hand-back (formbuilder-lhcforms API.md)", () => {
  const Q = q(name);
  test("initializedAnsweredWithQ", () => {
    expect(builderStep({ status: "opening" }, { type: "initialized" }, Q)).toEqual({ state: { status: "editing" }, reply: { type: "initialQuestionnaire", questionnaire: Q } });
  });
  test("updatesKeepLatest", () => {
    let s = builderStep({ status: "editing" }, { type: "updateQuestionnaire", questionnaire: q(dob) }, Q).state;
    expect(s.latest).toEqual(q(dob));
    s = builderStep(s, { type: "closed", questionnaire: q(name, dob) }, Q).state;
    // The first version the builder sent is its round-trip, kept as the baseline.
    expect(s).toEqual({ status: "closed", latest: q(name, dob), roundTrip: q(dob) });
    expect(builderStep(s, { type: "canceled" }, Q).state.status).toBe("canceled");
    expect(builderStep(s, { type: "aborted", error: "bad" }, Q).state).toMatchObject({ status: "aborted", error: "bad" });
    expect(builderStep(s, { type: "other" }, Q)).toEqual({ state: s });
  });
  test("builderOpenedSameSite", () => {
    const u = new URL(builderUrl("assets/formbuilder/index.html", "https://o.github.io/ig/Questionnaire-intake-form.html"));
    expect(u.origin + u.pathname).toBe("https://o.github.io/ig/assets/formbuilder/index.html");
    expect(u.searchParams.get("referrer")).toBe("https://o.github.io/ig/Questionnaire-intake-form.html");
    expect(u.searchParams.get("fhirVersion")).toBe("R4");
  });
});
