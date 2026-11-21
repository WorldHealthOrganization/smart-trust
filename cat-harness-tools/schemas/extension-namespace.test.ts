/**
 * Our BPMN extension elements are recognised by NAMESPACE, never by the prefix
 * a diagram binds (bean `12s9`, stage 1).
 *
 * The owner's ruling is that a prefix names the Subgraph that declares the
 * element (`bootstrap.processes:`). Until 2026-09-24 every reader matched the
 * text `folio:`, so that rename would have parsed cleanly and silently dropped
 * every Skill, Role and decision. These tests pin the property the rename
 * needs: same address, any prefix, same model.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";

import { gitCorpus } from "./sdlc/git-corpus.ts";

import { loadProcessModel } from "../src/workflow/process-model.ts";
import { BOOTSTRAP_PROCESSES_NS, CAT_HARNESS_PROCESSES_NS, FOLIO_BPMN_NS, ownElementPattern, ownExtensionPrefixes } from "./kg/namespaces.ts";

const REPO_ROOT = join(import.meta.dir, "..", "..");
const DIAGRAM = join("processes", "initialize-harness.bpmn");

const tmp = mkdtempSync(join(tmpdir(), "extension-ns-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

/** A copy of bootstrap with its main diagram rewritten by `edit`, so relative refs still resolve. */
function variant(name: string, edit: (xml: string) => string): string {
  const root = join(tmp, name);
  cpSync(join(REPO_ROOT, "bootstrap"), root, { recursive: true });
  const file = join(root, DIAGRAM);
  writeFileSync(file, edit(readFileSync(file, "utf-8")));
  return file;
}

/** The model as data — Maps included, which JSON would drop — with the copy's location taken out so two copies compare. */
async function modelOf(file: string, root: string): Promise<unknown> {
  const m = await loadProcessModel(file);
  const text = JSON.stringify(m, (_k, v: unknown) => (v instanceof Map ? Object.fromEntries(v) : v));
  return JSON.parse(text.split(root).join("<root>"));
}

/** Every skill any node names. */
function skillsOf(model: unknown): string[] {
  const nodes = (model as { nodes: Record<string, { skills?: string[] }> }).nodes;
  return Object.values(nodes).flatMap((n) => n.skills ?? []);
}

describe("the parser follows the namespace, not the prefix", () => {
  test("bootstrap's diagram, written bootstrap.processes:, binds bootstrap's own address (stage 2)", () => {
    const xml = readFileSync(join(REPO_ROOT, "bootstrap", DIAGRAM), "utf-8");
    expect(ownExtensionPrefixes(xml)).toEqual(["bootstrap.processes"]);
    expect(xml).toContain(`xmlns:bootstrap.processes="${BOOTSTRAP_PROCESSES_NS}"`);
    expect(xml).not.toMatch(/<\/?folio:/);
  });

  test("the same address under any other prefix loads into the same model", async () => {
    const same = variant("same", (x) => x);
    const renamed = variant("renamed", (x) =>
      x.replace(/xmlns:bootstrap\.processes=/g, "xmlns:x=").replace(/(<\/?)bootstrap\.processes:/g, "$1x:"),
    );
    expect(readFileSync(renamed, "utf-8")).not.toContain("bootstrap.processes:skill");
    const a = await modelOf(same, join(tmp, "same"));
    const b = await modelOf(renamed, join(tmp, "renamed"));
    // Vacuity: the original must carry extensions for "identical" to mean anything.
    expect(skillsOf(a)).toContain("confirm-harness");
    expect(b).toEqual(a);
  });

  test("the retired single address is no longer ours (stage 4)", async () => {
    // It was read until 2026-09-24 so folios could move; once none bound it,
    // it retired. A diagram still on it now loses its extensions rather than
    // having them read, and external-schemas names it as drift.
    const older = variant("older", (x) =>
      x
        .replace(`xmlns:bootstrap.processes="${BOOTSTRAP_PROCESSES_NS}"`, `xmlns:folio="${FOLIO_BPMN_NS}"`)
        .replace(/(<\/?)bootstrap\.processes:/g, "$1folio:"),
    );
    expect(readFileSync(older, "utf-8")).toContain("<folio:skill");
    expect(skillsOf(await modelOf(older, join(tmp, "older")))).toEqual([]);
  });

  test("folio: bound to someone else's namespace is not ours, whatever it spells", async () => {
    const foreign = variant("foreign", (x) =>
      x
        .replace(`xmlns:bootstrap.processes="${BOOTSTRAP_PROCESSES_NS}"`, 'xmlns:folio="urn:somebody-else"')
        .replace(/(<\/?)bootstrap\.processes:/g, "$1folio:"),
    );
    expect(readFileSync(foreign, "utf-8")).toContain("<folio:skill");
    const control = await modelOf(variant("control", (x) => x), join(tmp, "control"));
    expect(skillsOf(control).length).toBeGreaterThan(0);
    expect(skillsOf(await modelOf(foreign, join(tmp, "foreign")))).toEqual([]);
  });
});

describe("raw-XML readers follow the namespace too", () => {
  const doc = (bindings: string, body: string) => `<bpmn:definitions ${bindings}>${body}</bpmn:definitions>`;

  test("the prefixes bound to our namespace are found, dotted ones included", () => {
    const xml = doc(`xmlns:bootstrap.processes="${BOOTSTRAP_PROCESSES_NS}" xmlns:folio="urn:other"`, "");
    expect(ownExtensionPrefixes(xml)).toEqual(["bootstrap.processes"]);
  });

  test("a pattern matches our element under any prefix, and never a foreign folio:", () => {
    const xml = doc(
      `xmlns:bootstrap.processes="${BOOTSTRAP_PROCESSES_NS}" xmlns:folio="urn:other"`,
      '<bootstrap.processes:skill ref="a"/><folio:skill ref="b"/>',
    );
    const refs = [...xml.matchAll(ownElementPattern(xml, "skill", String.raw`\s+ref="([^"]+)"`))].map((m) => m[1]);
    expect(refs).toEqual(["a"]);
  });

  test("a document that binds none of our namespaces has none of our elements", () => {
    const xml = doc("", '<folio:skill ref="a"/>');
    expect([...xml.matchAll(ownElementPattern(xml, "skill"))]).toEqual([]);
  });
});

describe("nothing matches our elements by the text folio: again", () => {
  /**
   * A regex LITERAL containing `folio:<element>` in code or in a test (not a
   * comment, not an error-message matcher) is a reader matching the prefix
   * text — the defect stage 1 removed. Tests are included since stage 3: two
   * test files read the real diagrams this way and, once the diagrams moved to
   * the new prefixes, counted zero and still passed.
   * `$type === "folio:…"` is fine: the parser has already normalised it by
   * namespace. Use `ownElementPattern` from `schemas/kg/namespaces.ts` instead.
   */
  const ELEMENTS =
    "skill|role|precondition|bean|policy|adjudication|no-skill|no-call|job|implements|judgement|fulfilment|raci|involvement|link|decision|log|convention";
  const LITERAL = new RegExp(String.raw`(^|[\s(=,!&|?:])\/(?:[^/\\\n]|\\.)*folio:(?:${ELEMENTS})\b`);
  /** A regex that only matches an ERROR MESSAGE naming an element is not a reader of diagrams. */
  const MESSAGE = /toThrow\(|rejects|toMatch\(/;
  const offenders: string[] = [];
  const walk = (d: string) => {
    for (const f of readdirSync(d)) {
      if (f === "node_modules" || f.startsWith(".")) continue;
      const p = join(d, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (f.endsWith(".ts") && !f.endsWith(".d.ts")) {
        const lines = readFileSync(p, "utf-8").split("\n");
        lines.forEach((line, i) => {
          const t = line.trimStart();
          if (t.startsWith("*") || t.startsWith("/*") || t.startsWith("//")) return;
          // A matcher's argument often sits on the line after `toThrow(`.
          const message = MESSAGE.test(line) || MESSAGE.test(lines[i - 1] ?? "");
          if (LITERAL.test(line) && !message) offenders.push(`${p.slice(REPO_ROOT.length + 1)}:${i + 1}`);
        });
      }
    }
  };
  for (const top of ["cat-harness", "folio-assistant-core"]) walk(join(REPO_ROOT, top));

  test("no regex literal matches folio:<element> in raw text", () => {
    expect(offenders).toEqual([]);
  });
});

describe("every diagram writes each element under the Subgraph that defines it (stage 3)", () => {
  // `gitCorpus`, not a bare `git ls-files`: in the composed checkout every
  // layer is a REMOTE MOUNT, ignored by the index repository's git, so
  // `ls-files` from the root listed no diagram, and split("\n") on the empty
  // answer handed the loop below one empty path (EISDIR). `gitCorpus` counts
  // a mount's files as a submodule's were counted.
  const diagrams = (gitCorpus(REPO_ROOT, ["*.bpmn"]) ?? []).map((f) => relative(REPO_ROOT, f));
  /** Element names an `ns.jsonld` vocabulary defines, keyed by its namespace. */
  const defined = new Map<string, Set<string>>();
  for (const [ns, file] of [
    [BOOTSTRAP_PROCESSES_NS, "bootstrap/processes/ns.jsonld"],
    [CAT_HARNESS_PROCESSES_NS, "cat-harness/processes/ns.jsonld"],
  ] as const) {
    const doc = JSON.parse(readFileSync(join(REPO_ROOT, file), "utf-8")) as { "@graph": { "@id": string; label: string }[] };
    for (const g of doc["@graph"]) expect(g["@id"]).toBe(`${ns}${g.label}`);
    defined.set(ns, new Set(doc["@graph"].map((g) => g.label)));
  }

  test("no diagram binds the older single address any more", () => {
    expect(diagrams.length).toBeGreaterThan(70);
    expect(diagrams.filter((f) => readFileSync(join(REPO_ROOT, f), "utf-8").includes(`"${FOLIO_BPMN_NS}"`))).toEqual([]);
  });

  test("each element used is defined by the vocabulary of the address it is written under", () => {
    const wrong: string[] = [];
    let used = 0;
    for (const f of diagrams) {
      const xml = readFileSync(join(REPO_ROOT, f), "utf-8");
      const bound = new Map([...xml.matchAll(/\bxmlns:([\w.-]+)="([^"]*)"/g)].map((m) => [m[1]!, m[2]!]));
      for (const m of xml.matchAll(/<([\w.-]+):([a-z-]+)\b/g)) {
        const vocab = defined.get(bound.get(m[1]!) ?? "");
        if (vocab === undefined) continue;
        used++;
        if (!vocab.has(m[2]!)) wrong.push(`${f}: ${m[1]}:${m[2]}`);
      }
    }
    // Vacuity: hundreds of elements are checked, not none.
    expect(used).toBeGreaterThan(500);
    expect(wrong).toEqual([]);
  });
});
