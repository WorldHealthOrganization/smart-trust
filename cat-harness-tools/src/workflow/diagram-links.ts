/**
 * The links in a rendered BPMN drawing, each on the part of the shape it
 * names: a step's TITLE links to the step's own page, and a call activity's
 * [+] MARKER links to the process it calls.
 *
 * @module src/workflow/diagram-links
 *
 * Owner, 2026-11-03 (litlfred/cat-harness#991): *"linked tasks should be on
 * the task title only, not the whole box. the subprocess should be opened by
 * the [+] not the whole box."* Before this the whole call-activity shape was
 * one `<a>` (bootstrap-tools' `wrapShapeInLink`), so the box had a single
 * target, a focus ring the size of the box, and nothing else drawn on the box
 * (a badge, the ⓘ) could be told apart from the link under it.
 *
 * Each link is an SVG `<a>`, so it is keyboard-focusable where the drawing is
 * inlined (docs-ui.js) and inert inside an `<img>`, as before. Each carries an
 * `aria-label` and a `<title>` (its accessible name and tooltip), and its
 * focus ring is its own bounding box: the title's text, or the [+] marker and
 * a 24 × 24 hit area around it (WCAG 2.2 target size, 2.5.8).
 *
 * The functions return the SVG unchanged when the markup they expect is not
 * there; the caller counts the links afterwards, so a bpmn-js change fails the
 * render rather than silently dropping a link.
 */

/** The class of a step's title link. */
export const TITLE_LINK_CLASS = "fa-task-link";
/** The class of a call activity's [+] link. The site's CSS and tests select it. */
export const EXPAND_LINK_CLASS = "fa-subprocess-link";

/** The smallest hit area a link gets, in drawing units (WCAG 2.2 SC 2.5.8). */
export const MIN_TARGET = 24;

const attr = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const text = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
/**
 * A step's name as one line of plain text. A name read straight from BPMN XML
 * still carries its character references (`member&#x27;s`); they are decoded
 * here, once, because `attr` and `text` escape again, and an undecoded one
 * reached the accessible name as the literal "&#x27;".
 */
const oneLine = (s: string): string =>
  s
    .replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (m, e: string) => {
      const k = e.toLowerCase();
      if (k[0] === "#") {
        const cp = k[1] === "x" ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10);
        return Number.isFinite(cp) ? String.fromCodePoint(cp) : m;
      }
      return ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" } as Record<string, string>)[k] ?? m;
    })
    .replace(/\s+/g, " ")
    .trim();

/** Where shape `id`'s `<g>` opens and closes in `svg`, counting nested `<g>`s. */
export function shapeSpan(svg: string, id: string): { start: number; end: number } | undefined {
  const esc = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = new RegExp(`<g class="djs-element[^"]*" data-element-id="${esc}"[^>]*>`).exec(svg);
  if (!m) return undefined;
  let depth = 1;
  const tag = /<g\b|<\/g>/g;
  tag.lastIndex = m.index + m[0].length;
  let t: RegExpExecArray | null;
  while (depth > 0 && (t = tag.exec(svg)) !== null) {
    depth += t[0] === "</g>" ? -1 : 1;
    if (depth === 0) return { start: m.index, end: t.index + t[0].length };
  }
  return undefined;
}

/** Replace the first match of `re` inside shape `id` with `wrap(match)`. */
function inShape(svg: string, id: string, re: RegExp, wrap: (m: RegExpExecArray) => string): string {
  const span = shapeSpan(svg, id);
  if (!span) return svg;
  const body = svg.slice(span.start, span.end);
  const m = re.exec(body);
  if (!m) return svg;
  const at = span.start + m.index;
  return svg.slice(0, at) + wrap(m) + svg.slice(at + m[0].length);
}

function open(cls: string, href: string, label: string): string {
  return `<a class="${cls}" href="${attr(href)}" target="_top" aria-label="${attr(label)}"><title>${text(label)}</title>`;
}

/**
 * Link the TITLE of step `id` — its `text.djs-label`, and nothing else of the
 * box — to `href`. `name` is the step's name, for the accessible name.
 */
export function linkTitle(svg: string, id: string, href: string, name: string): string {
  const label = `Open step: ${oneLine(name)}`;
  return inShape(svg, id, /<text\b[^>]*class="djs-label"[^>]*>[\s\S]*?<\/text>/, (m) => `${open(TITLE_LINK_CLASS, href, label)}${m[0]}</a>`);
}

/**
 * Link the [+] MARKER of call activity `id` to `href`: bpmn-js's marker box
 * (a 14 × 14 `<rect>` placed by a transform) and its cross
 * (`<path data-marker="sub-process">`), with a transparent hit area of
 * {@link MIN_TARGET} around them drawn first so the marker stays on top.
 */
export function linkExpandMarker(svg: string, id: string, href: string, name: string): string {
  const label = `Open subprocess: ${oneLine(name)}`;
  return inShape(svg, id, /(<rect\b[^>]*\/>)(<path data-marker="sub-process"[^>]*\/>)/, (m) => {
    const rect = m[1]!;
    const num = (a: string): number | undefined => {
      const v = new RegExp(`\\s${a}="(-?[\\d.]+)"`).exec(rect)?.[1];
      return v === undefined ? undefined : Number(v);
    };
    const tf = /transform="matrix\(1 0 0 1 (-?[\d.]+) (-?[\d.]+)\)"/.exec(rect);
    const w = num("width") ?? 14;
    const h = num("height") ?? 14;
    const x = (num("x") ?? 0) + (tf ? Number(tf[1]) : 0);
    const y = (num("y") ?? 0) + (tf ? Number(tf[2]) : 0);
    const side = Math.max(MIN_TARGET, w, h);
    const hit =
      `<rect class="fa-link-hit" x="${x + w / 2 - side / 2}" y="${y + h / 2 - side / 2}" ` +
      `width="${side}" height="${side}" fill="transparent" stroke="none"/>`;
    return `${open(EXPAND_LINK_CLASS, href, label)}${hit}${m[1]}${m[2]}</a>`;
  });
}

/**
 * The drawing's own link styles, so a link is visible however the drawing is
 * shown: a pointer, an underline on a title, and a focus ring around the link
 * alone. Inserted once, after the opening `<svg>` tag; `fa-` classes are left
 * unscoped when docs-ui.js inlines the drawing.
 */
export const LINK_STYLE =
  `<style>` +
  `.${TITLE_LINK_CLASS},.${EXPAND_LINK_CLASS}{cursor:pointer}` +
  `.${TITLE_LINK_CLASS} text{text-decoration:underline}` +
  `.${TITLE_LINK_CLASS}:focus-visible,.${EXPAND_LINK_CLASS}:focus-visible{outline:2px solid #2563eb;outline-offset:2px}` +
  `.${EXPAND_LINK_CLASS}:hover rect:not(.fa-link-hit),.${EXPAND_LINK_CLASS}:focus-visible rect:not(.fa-link-hit){stroke-width:2.5px}` +
  `</style>`;

/** Every step's title and every call activity's [+] linked, and the style added when any link was. */
export function linkSteps(
  svg: string,
  titles: ReadonlyMap<string, { href: string; name: string }>,
  expands: ReadonlyMap<string, { href: string; name: string }>,
): string {
  let out = svg;
  for (const [id, l] of titles) out = linkTitle(out, id, l.href, l.name);
  for (const [id, l] of expands) out = linkExpandMarker(out, id, l.href, l.name);
  if (out === svg) return svg;
  return out.replace(/(<svg\b[^>]*>)/, `$1${LINK_STYLE}`);
}

/** How many links of `cls` the drawing carries. */
export function countLinks(svg: string, cls: string): number {
  return (svg.match(new RegExp(`<a class="${cls}"`, "g")) ?? []).length;
}

/** The activity kinds whose title links to the step's page. */
const STEP_KINDS = "task|userTask|serviceTask|manualTask|scriptTask|sendTask|receiveTask|businessRuleTask|callActivity|subProcess|adHocSubProcess|transaction";

/**
 * Every activity in `xml` with the process that holds it and its name:
 * `{ id, process, name }`. Read from each `<bpmn:process>` block, nested
 * subprocesses included.
 */
export function stepsOf(xml: string): { id: string; process: string; name: string }[] {
  const out: { id: string; process: string; name: string }[] = [];
  for (const p of xml.matchAll(/<(?:bpmn:)?process\b([^>]*)>([\s\S]*?)<\/(?:bpmn:)?process>/g)) {
    const pid = /\sid="([^"]+)"/.exec(p[1]!)?.[1];
    if (!pid) continue;
    for (const s of p[2]!.matchAll(new RegExp(`<(?:bpmn:)?(?:${STEP_KINDS})\\b([^>]*)>`, "g"))) {
      const id = /\sid="([^"]+)"/.exec(s[1]!)?.[1];
      const name = /\sname="([^"]*)"/.exec(s[1]!)?.[1];
      if (id && name) out.push({ id, process: pid, name: unescapeXml(name) });
    }
  }
  return out;
}

function unescapeXml(s: string): string {
  return s.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#10;/g, " ").replace(/&amp;/g, "&");
}
