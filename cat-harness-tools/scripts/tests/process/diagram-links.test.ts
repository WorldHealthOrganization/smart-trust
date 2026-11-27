/**
 * The links in a rendered BPMN drawing (`src/workflow/diagram-links.ts`): a
 * step's title links to its page, a call activity's [+] to the process it
 * calls, and neither wraps the whole box (owner, 2026-11-03, cat-harness#991).
 *
 * The shape markup is bpmn-js's own, copied from a rendered
 * `test-plan-execution.svg`.
 */
import { describe, expect, test } from "bun:test";
import {
  countLinks,
  EXPAND_LINK_CLASS,
  linkExpandMarker,
  linkSteps,
  linkTitle,
  shapeSpan,
  stepsOf,
  TITLE_LINK_CLASS,
} from "../../../src/workflow/diagram-links.ts";

const CALL =
  `<g class="djs-group"><g class="djs-element djs-shape" data-element-id="Call_Sign" style="display: block;" transform="matrix(1 0 0 1 1965 781)">` +
  `<g class="djs-visual"><rect x="0" y="0" width="120" height="120" rx="10" ry="10" style="stroke-width: 5px; fill: white;"/>` +
  `<text lineHeight="1.2" class="djs-label" style="font-size: 16px;"><tspan x="30.6" y="55.2">Sign the </tspan><tspan x="19.5" y="74.4">certification</tspan></text>` +
  `<rect x="0" y="0" width="14" height="14" rx="0" ry="0" style="stroke-width: 1px; fill: white;" transform="matrix(1 0 0 1 52.5 100)"/>` +
  `<path data-marker="sub-process" d="m52.5,100 m 7,2 l 0,10 m -5,-5 l 10,0" style="stroke-width: 2px;"/></g>` +
  `<rect class="djs-hit djs-hit-all" x="0" y="0" width="120" height="120" style="fill: none;"/></g></g>`;
const TASK =
  `<g class="djs-group"><g class="djs-element djs-shape" data-element-id="A_Request" style="display: block;" transform="matrix(1 0 0 1 580 90)">` +
  `<g class="djs-visual"><rect x="0" y="0" width="150" height="80" rx="10" ry="10"/>` +
  `<text lineHeight="1.2" class="djs-label"><tspan x="45" y="16">Request &amp; sign</tspan></text></g>` +
  `<rect class="djs-hit djs-hit-all" x="0" y="0" width="150" height="80" style="fill: none;"/></g></g>`;
const SVG = `<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2200 1000">${TASK}${CALL}</svg>`;

/** The `<a>…</a>` of class `cls`, as written. */
const linkOf = (svg: string, cls: string): string => {
  const at = svg.indexOf(`<a class="${cls}"`);
  return at < 0 ? "" : svg.slice(at, svg.indexOf("</a>", at) + 4);
};

describe("a step's title link", () => {
  const out = linkTitle(SVG, "A_Request", "https://x.org/process/P/node/A_Request", "Request & sign");
  const a = linkOf(out, TITLE_LINK_CLASS);

  test("wraps the title text and nothing else of the box", () => {
    expect(a).toMatch(/^<a class="fa-task-link" href="https:\/\/x\.org\/process\/P\/node\/A_Request" target="_top"/);
    expect(a).toContain(`<text lineHeight="1.2" class="djs-label">`);
    expect(a).not.toContain("<rect");
    // The box and its hit rect stay outside the link.
    expect(out).toContain(`<g class="djs-visual"><rect x="0" y="0" width="150" height="80" rx="10" ry="10"/><a class="fa-task-link"`);
  });

  test("has an accessible name, escaped", () => {
    expect(a).toContain(`aria-label="Open step: Request &amp; sign"`);
    expect(a).toContain(`<title>Open step: Request &amp; sign</title>`);
  });

  test("leaves the SVG alone when the shape is not there", () => {
    expect(linkTitle(SVG, "Nope", "x", "y")).toBe(SVG);
  });

  test("decodes a name's character references once, so they are not escaped twice", () => {
    const b = linkOf(linkTitle(SVG, "A_Request", "x", "Sign with Country B&#x27;s key &amp; go"), TITLE_LINK_CLASS);
    expect(b).toContain(`aria-label="Open step: Sign with Country B's key &amp; go"`);
    expect(b).not.toContain("&amp;#x27;");
  });
});

describe("a call activity's [+] link", () => {
  const out = linkExpandMarker(SVG, "Call_Sign", "https://x.org/process/Q", "Sign the certification");
  const a = linkOf(out, EXPAND_LINK_CLASS);

  test("wraps only the marker box and its cross, not the title or the shape", () => {
    expect(a).toContain(`<path data-marker="sub-process"`);
    expect(a).toContain(`transform="matrix(1 0 0 1 52.5 100)"`);
    expect(a).not.toContain("djs-label");
    expect(a).not.toContain(`width="120"`);
    expect(out).not.toMatch(/<a [^>]*><g class="djs-element/);
  });

  test("gets a 24 × 24 hit area centred on the marker, drawn under it", () => {
    expect(a).toContain(`<rect class="fa-link-hit" x="47.5" y="95" width="24" height="24" fill="transparent" stroke="none"/>`);
    expect(a.indexOf("fa-link-hit")).toBeLessThan(a.indexOf("data-marker"));
  });

  test("has an accessible name", () => {
    expect(a).toContain(`aria-label="Open subprocess: Sign the certification"`);
  });
});

describe("linkSteps", () => {
  test("both links on one call activity, separate, plus the style once", () => {
    const out = linkSteps(
      SVG,
      new Map([["Call_Sign", { href: "n", name: "Sign the certification" }], ["A_Request", { href: "m", name: "Request" }]]),
      new Map([["Call_Sign", { href: "q", name: "Sign the certification" }]]),
    );
    expect(countLinks(out, TITLE_LINK_CLASS)).toBe(2);
    expect(countLinks(out, EXPAND_LINK_CLASS)).toBe(1);
    expect(out.match(/<style>/g)?.length).toBe(1);
    expect(out).toContain(":focus-visible");
    // No link is nested in another, and every shape <g> still closes inside its group.
    expect(out).not.toMatch(/<a [^>]*>(?:(?!<\/a>)[\s\S])*<a /);
    expect(shapeSpan(out, "Call_Sign")).toBeDefined();
  });

  test("no links → the SVG unchanged, no style", () => {
    expect(linkSteps(SVG, new Map(), new Map())).toBe(SVG);
  });
});

describe("stepsOf", () => {
  test("every named activity with the process that holds it", () => {
    const xml =
      `<bpmn:definitions><bpmn:process id="P"><bpmn:startEvent id="S" name="go"/>` +
      `<bpmn:userTask id="T" name="Do &amp; check"/><bpmn:callActivity id="C" name="Call" calledElement="Q"/>` +
      `<bpmn:subProcess id="SP" name="Inner"><bpmn:task id="T2" name="Nested"/></bpmn:subProcess></bpmn:process>` +
      `<bpmn:process id="Q"><bpmn:serviceTask id="U" name="Other"/><bpmn:task id="Unnamed"/></bpmn:process></bpmn:definitions>`;
    expect(stepsOf(xml)).toEqual([
      { id: "T", process: "P", name: "Do & check" },
      { id: "C", process: "P", name: "Call" },
      { id: "SP", process: "P", name: "Inner" },
      { id: "T2", process: "P", name: "Nested" },
      { id: "U", process: "Q", name: "Other" },
    ]);
  });
});
