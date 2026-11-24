#!/usr/bin/env bun
/**
 * check-wireframe-questionnaire.ts — a Questionnaire says what the wireframe
 * it was derived from says, field for field.
 *
 * When a data-entry form is DESIGNED first, as a mid-fidelity wireframe
 * (`wireframe-design-review`), and the Questionnaire is derived from the
 * chosen candidate, the Questionnaire's review checks fidelity, not design.
 * This is that check. It renders nothing: it compares two ordered lists of
 * data element ids. Skill: `fhir-questionnaire-wireframe`.
 *
 * - **wireframe** — every element carrying `data-element="<id>"`, in document
 *   order. When the wireframe draws its web and mobile layouts as separate
 *   subtrees, each subtree carries `data-layout="<name>"` and is checked on
 *   its own; otherwise the whole document is one layout.
 * - **Questionnaire** — every item that is not a `group` or `display`, in
 *   depth-first order. An item names its data element by `definition` (the
 *   whole URL, or the element path after `#`) or by any `code[].code`.
 *
 * Findings: a field with no item, an item with no field, an item that names
 * no data element, a data element twice in one layout, and the first place
 * where the shared ids are in a different order.
 *
 *   bun run fhir-harness/scripts/check-wireframe-questionnaire.ts <wireframe.html> <questionnaire.json>
 *
 * The Questionnaire is the built JSON (an IG build's
 * `fsh-generated/resources/Questionnaire-*.json`), not FSH.
 *
 * Exit: 0 faithful, 1 a finding, 2 an input could not be read.
 *
 * ## For a suggested edit
 *
 * `checkSuggestion(before, after, ctx)` is the same judge in the shape an
 * editor's checker takes: `{ errors, warnings }` for a suggested change to a
 * Questionnaire, where `before` is the editor's own round-trip of the
 * original. Errors are syntax only (not JSON, not a Questionnaire). Warnings
 * never block, and only what the edit INTRODUCES is reported: a duplicate
 * `linkId`, an `enableWhen.question` naming no item, and — when `ctx.wireframe`
 * is given — a fidelity finding against that wireframe. It is ready to be
 * declared as an editor-checker profile once that graph typology is
 * reachable from this layer.
 *
 * Nothing here imports a Node module at load time, so the same file runs in a
 * browser once its types are stripped.
 *
 * @module fhir-harness/scripts/check-wireframe-questionnaire
 */

/** One layout's fields: the data element ids, in document order. */
export interface Layout {
  name: string;
  fields: string[];
}

const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);

function attr(attrs: string, name: string): string | undefined {
  const m = new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, "i").exec(attrs);
  return m ? (m[1] ?? m[2] ?? m[3]) : undefined;
}

/**
 * The wireframe's fields, by layout. A mid-fidelity wireframe is plain HTML,
 * so a tag scanner with an open-element stack is enough; comments, scripts and
 * styles are dropped first so an id inside them is not read as a field.
 */
export function wireframeLayouts(html: string): Layout[] {
  const body = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style)\b[\s\S]*?<\/\1\s*>/gi, "");
  const whole: Layout = { name: "(whole document)", fields: [] };
  const named = new Map<string, Layout>();
  const stack: { tag: string; layout?: string }[] = [];
  const tagRe = /<(\/?)([a-zA-Z][\w-]*)([^>]*?)(\/?)>/g;
  for (let m; (m = tagRe.exec(body)); ) {
    const [, closing, rawTag, attrs, selfClose] = m;
    const tag = rawTag.toLowerCase();
    if (closing) {
      const i = stack.map((e) => e.tag).lastIndexOf(tag);
      if (i >= 0) stack.length = i;
      continue;
    }
    const layout = attr(attrs, "data-layout");
    const current = layout ?? [...stack].reverse().find((e) => e.layout)?.layout;
    const id = attr(attrs, "data-element");
    if (id) {
      if (current) {
        if (!named.has(current)) named.set(current, { name: current, fields: [] });
        named.get(current)!.fields.push(id.trim());
      } else whole.fields.push(id.trim());
    } else if (layout && !named.has(layout)) named.set(layout, { name: layout, fields: [] });
    if (!selfClose && !VOID.has(tag)) stack.push({ tag, layout });
  }
  if (named.size === 0) return [whole];
  const layouts = [...named.values()];
  // A field outside every layout belongs to all of them (a shared header, say).
  if (whole.fields.length) for (const l of layouts) l.fields.unshift(...whole.fields);
  return layouts;
}

/** The parts of a Questionnaire item this module reads. */
export interface QItem {
  linkId?: string;
  type?: string;
  definition?: string;
  code?: { code?: string }[];
  enableWhen?: { question?: string }[];
  item?: QItem[];
}

/** One answerable item, with every id it may be named by. */
export interface Item {
  linkId: string;
  ids: string[];
}

/** The Questionnaire's answerable items, depth first. */
export function questionnaireItems(q: { item?: QItem[] }): Item[] {
  const out: Item[] = [];
  const walk = (items: QItem[] | undefined) => {
    for (const it of items ?? []) {
      if (it.type !== "group" && it.type !== "display") {
        const ids = new Set<string>();
        if (it.definition) {
          ids.add(it.definition);
          const hash = it.definition.indexOf("#");
          if (hash >= 0 && hash < it.definition.length - 1) ids.add(it.definition.slice(hash + 1));
        }
        for (const c of it.code ?? []) if (c.code) ids.add(c.code);
        out.push({ linkId: it.linkId ?? "(no linkId)", ids: [...ids] });
      }
      walk(it.item);
    }
  };
  walk(q.item);
  return out;
}

/** Every finding for one layout against the Questionnaire. */
export function judgeLayout(layout: Layout, items: Item[]): string[] {
  const f: string[] = [];
  const at = `[${layout.name}]`;
  const seen = new Set<string>();
  for (const id of layout.fields) {
    if (seen.has(id)) f.push(`${at} data element "${id}" appears twice in this layout`);
    seen.add(id);
  }
  // Each field is matched to the first unused item that names its id.
  const used = new Set<number>();
  const matched: { field: string; item: number }[] = [];
  for (const id of new Set(layout.fields)) {
    const i = items.findIndex((it, k) => !used.has(k) && it.ids.includes(id));
    if (i < 0) f.push(`${at} field "${id}" has no Questionnaire item`);
    else {
      used.add(i);
      matched.push({ field: id, item: i });
    }
  }
  items.forEach((it, k) => {
    if (used.has(k)) return;
    if (it.ids.length === 0) f.push(`${at} item "${it.linkId}" names no data element (no definition, no code)`);
    else f.push(`${at} item "${it.linkId}" (${it.ids.join(" | ")}) has no field in the wireframe`);
  });
  // Order: the matched fields, in wireframe order, should have rising item indexes.
  for (let k = 1; k < matched.length; k++) {
    if (matched[k].item < matched[k - 1].item) {
      f.push(
        `${at} order differs: field "${matched[k].field}" follows "${matched[k - 1].field}" in the wireframe, ` +
          `but item "${items[matched[k].item].linkId}" comes before "${items[matched[k - 1].item].linkId}"`,
      );
      break;
    }
  }
  return f;
}

export function judge(html: string, questionnaire: { item?: QItem[] }): string[] {
  const items = questionnaireItems(questionnaire);
  return wireframeLayouts(html).flatMap((l) => judgeLayout(l, items));
}

/**
 * Structural warnings on one Questionnaire, independent of any wireframe: a
 * `linkId` used twice, and an `enableWhen.question` that names no item.
 */
export function structureWarnings(q: { item?: QItem[] }): string[] {
  const all: QItem[] = [];
  const walk = (items: QItem[] | undefined) => {
    for (const it of items ?? []) {
      all.push(it);
      walk(it.item);
    }
  };
  walk(q.item);
  const w: string[] = [];
  const ids = new Set<string>();
  const twice = new Set<string>();
  for (const it of all) {
    if (it.linkId === undefined) continue;
    if (ids.has(it.linkId)) twice.add(it.linkId);
    ids.add(it.linkId);
  }
  for (const id of twice) w.push(`linkId "${id}" is used by more than one item`);
  for (const it of all)
    for (const ew of it.enableWhen ?? [])
      if (ew.question !== undefined && !ids.has(ew.question))
        w.push(`item "${it.linkId ?? "(no linkId)"}" has enableWhen on "${ew.question}", which is no item's linkId`);
  return w;
}

/** What the suggestion check is told besides the two texts. */
export interface SuggestionContext {
  /** The L2 wireframe's HTML, when the Questionnaire was derived from one. */
  wireframe?: string;
}

/** The result in the editor-checker shape: errors block, warnings never do. */
export interface SuggestionResult {
  errors: string[];
  warnings: string[];
}

function parseQuestionnaire(text: string): { q?: { resourceType?: string; item?: QItem[] }; error?: string } {
  let q: unknown;
  try {
    q = JSON.parse(text);
  } catch (e) {
    return { error: `not JSON: ${(e as Error).message}` };
  }
  if (q === null || typeof q !== "object" || (q as { resourceType?: unknown }).resourceType !== "Questionnaire")
    return { error: `not a Questionnaire (resourceType ${String((q as { resourceType?: unknown } | null)?.resourceType ?? "missing")})` };
  return { q: q as { resourceType?: string; item?: QItem[] } };
}

function warningsOf(q: { item?: QItem[] }, ctx: SuggestionContext): string[] {
  const w = structureWarnings(q);
  if (ctx.wireframe !== undefined && wireframeLayouts(ctx.wireframe).some((l) => l.fields.length))
    w.push(...judge(ctx.wireframe, q));
  return w;
}

/**
 * A suggested change to a Questionnaire, checked. `before` is the editor's
 * own round-trip of the original, so a warning the original already had is
 * not reported again: only what the edit introduces is.
 */
export function checkSuggestion(before: string, after: string, ctx: SuggestionContext = {}): SuggestionResult {
  const a = parseQuestionnaire(after);
  if (!a.q) return { errors: [a.error!], warnings: [] };
  const b = parseQuestionnaire(before);
  const had = new Set(b.q ? warningsOf(b.q, ctx) : []);
  return { errors: [], warnings: warningsOf(a.q, ctx).filter((w) => !had.has(w)) };
}

if (import.meta.main) {
  const { readFileSync } = await import("node:fs");
  const [wf, qPath] = process.argv.slice(2);
  if (!wf || !qPath) {
    console.error("usage: check-wireframe-questionnaire.ts <wireframe.html> <questionnaire.json>");
    process.exit(2);
  }
  let html: string, q: { resourceType?: string; item?: QItem[] };
  try {
    html = readFileSync(wf, "utf8");
    q = JSON.parse(readFileSync(qPath, "utf8"));
  } catch (e) {
    console.error(`could not read input: ${(e as Error).message}`);
    process.exit(2);
  }
  if (q.resourceType !== "Questionnaire") {
    console.error(`${qPath} is not a Questionnaire (resourceType ${q.resourceType ?? "missing"})`);
    process.exit(2);
  }
  const fields = wireframeLayouts(html).reduce((n, l) => n + l.fields.length, 0);
  if (fields === 0) {
    console.error(`${wf} has no data-element fields: nothing to compare`);
    process.exit(2);
  }
  const findings = judge(html, q);
  for (const x of findings) console.log(x);
  console.log(findings.length ? `${findings.length} finding(s)` : "faithful: every field has its item, in order");
  process.exit(findings.length ? 1 : 0);
}
