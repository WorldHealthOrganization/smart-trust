/**
 * The kind declares its controls; the platform fixes the chrome.
 *
 * @module schemas/panel-chrome.test
 */
import { describe, expect, test } from "bun:test";

import {
  FIXED_CONTROLS,
  KIND_CONTROLS,
  PANEL_CONTROLS,
  controlsFor,
  servableControls,
  validateControls,
} from "./panel-chrome.js";

describe("the frame is the platform's", () => {
  test("`close` is on every panel, whatever the kind declares", () => {
    for (const kind of [...Object.keys(KIND_CONTROLS), "a-kind-nobody-declared"]) {
      expect(controlsFor(kind).map((c) => c.id)).toContain("close");
    }
  });

  test("and it is FIRST, because a control that moves is not a fixed control", () => {
    // The ordering half of "a reader learns the frame once".
    for (const kind of Object.keys(KIND_CONTROLS)) {
      expect(controlsFor(kind)[0]?.id).toBe("close");
    }
  });

  test("a kind cannot remove it by declaring an empty set", () => {
    expect(controlsFor("x", { x: [] }).map((c) => c.id)).toEqual(["close"]);
  });

  test("a kind cannot duplicate it by declaring it", () => {
    const ids = controlsFor("x", { x: ["close", "view"] }).map((c) => c.id);
    expect(ids).toEqual(["close", "view"]);
  });
});

describe("a kind absent from the table is COMPLETE, not invalid", () => {
  test("it gets the frame and nothing else", () => {
    // The frame alone is a usable panel. Requiring every kind to state an
    // empty list would make silence look like an oversight.
    expect(controlsFor("never-heard-of-it").map((c) => c.id)).toEqual(["close"]);
    expect(validateControls({})).toEqual([]);
  });
});

describe("a typo is a FINDING, which is the whole value of declaring the set", () => {
  test("a control that does not exist is reported, and names what does", () => {
    // Without this, `edti` is a control that never appears and nothing says
    // so — indistinguishable from a kind that chose not to offer it.
    const findings = validateControls({ todo: ["edti"] });
    expect(findings.length).toBe(1);
    expect(findings[0]?.control).toBe("edti");
    expect(findings[0]?.because).toContain("no control called");
    for (const known of Object.keys(PANEL_CONTROLS)) {
      expect(findings[0]?.because).toContain(known);
    }
  });

  test("re-declaring a fixed control is a DIFFERENT finding", () => {
    // Two things are wrong and they are not the same thing: naming something
    // that does not exist, and trying to move something the platform fixes.
    const findings = validateControls({ todo: ["close"] });
    expect(findings.length).toBe(1);
    expect(findings[0]?.because).toContain("the frame the platform fixes");
  });

  test("a bad entry does not take the panel down", () => {
    // The panel renders what it can; the finding says what it could not. A
    // renderer that threw would lose a whole board over one button.
    expect(controlsFor("x", { x: ["view", "edti", "edit"] }).map((c) => c.id)).toEqual([
      "close",
      "view",
      "edit",
    ]);
  });

  test("this repository's own declarations are clean", () => {
    expect(validateControls()).toEqual([]);
  });
});

describe("declared and unservable is a THIRD state, not a second", () => {
  const todo = controlsFor("todo");

  test("with no source at all, only the capability-free controls show", () => {
    const { shown, hidden } = servableControls(todo, {});
    expect(shown.map((c) => c.id)).toEqual(["close", "move", "pin", "discard", "relocate"]);
    expect(hidden.map((h) => h.control.id)).toEqual(["view", "edit"]);
  });

  test("a readable source shows View and still hides Edit", () => {
    // The two are separate capabilities, and a board can serve one without
    // the other — a public repository a reader cannot push to.
    const { shown, hidden } = servableControls(todo, { "source-read": true });
    expect(shown.map((c) => c.id)).toContain("view");
    expect(hidden.map((h) => h.control.id)).toEqual(["edit"]);
  });

  test("both capabilities show everything the kind declared", () => {
    const { shown, hidden } = servableControls(todo, {
      "source-read": true,
      "source-write": true,
    });
    expect(shown.map((c) => c.id)).toEqual([
      "close",
      "view",
      "edit",
      "move",
      "pin",
      "discard",
      "relocate",
    ]);
    expect(hidden).toEqual([]);
  });

  test("the REASON is returned, not swallowed — `pb04`", () => {
    // "This kind does not offer edit" and "this deployment cannot serve edit"
    // are different facts, and only one of them is somebody's to fix. A
    // renderer that just dropped the control would make them one outcome.
    const { hidden } = servableControls(todo, {});
    const edit = hidden.find((h) => h.control.id === "edit");
    expect(edit?.because).toContain("source-write");
    expect(edit?.because).toContain("pb04");
  });

  test("a kind that never declared it produces NO finding — absence is not a gap", () => {
    // `bean` declares only `view`, so there is no `edit` to hide and nothing
    // to report. The distinction this whole describe block exists for.
    const { hidden } = servableControls(controlsFor("bean"), {});
    expect(hidden.map((h) => h.control.id)).toEqual(["view"]);
    expect(hidden.map((h) => h.control.id)).not.toContain("edit");
  });

  test("the frame survives every capability answer", () => {
    // `[x]` needs nothing, so no environment can take away the way out.
    for (const caps of [{}, { "source-read": true }, { "source-write": true }]) {
      expect(servableControls(todo, caps).shown.map((c) => c.id)).toContain("close");
    }
  });
});

describe("every control says why it exists", () => {
  test("no entry ships without a `because` or a worded label", () => {
    // A glyph alone is a guess, and a control nobody can justify is one
    // nobody can remove either.
    for (const [id, c] of Object.entries(PANEL_CONTROLS)) {
      expect(c.id, `${id} carries its own id`).toBe(id);
      expect(c.label.length, `${id} has a worded label`).toBeGreaterThan(0);
      expect(c.because.length, `${id} says why it exists`).toBeGreaterThan(20);
    }
  });

  test("every fixed control is a real control", () => {
    for (const id of FIXED_CONTROLS) {
      expect(Object.prototype.hasOwnProperty.call(PANEL_CONTROLS, id)).toBe(true);
    }
  });
});
