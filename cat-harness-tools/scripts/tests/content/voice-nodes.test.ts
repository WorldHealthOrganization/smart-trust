/**
 * Voices are nodes (owner, 2026-11-13, node-kind audit: every listed node kind
 * has an IRI, a JSON-LD document, a row and a page, no waivers). The export
 * mints `<doc dir>/voice/<id>` for each voice its layer holds
 * (`lib/voice-nodes.ts`); the voices viewer lists each one, links that IRI and
 * draws the voice's own page under its layer's subject page.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { VOICE_SUBJECT_KIND, voiceNodes } from "../../lib/voice-nodes.ts";
import { SUBJECT_KINDS, subjectIri } from "../../lib/subject-iri.ts";
import { VOICE_PAGE_MARKER, projection, voicePageHtml, voicePagePath } from "../../gen-voices-viz.ts";
import { CLASS_GLOSSES } from "../../../schemas/content/vocabulary.ts";
import type { VoiceView } from "../../voices-graph.ts";

describe("a voice's IRI", () => {
  test("is a subject kind kg-export may mint, and its class is glossed", () => {
    expect(SUBJECT_KINDS).toContain(VOICE_SUBJECT_KIND);
    expect(subjectIri("https://e.org/fa/cat-harness/cat-harness.jsonld", VOICE_SUBJECT_KIND, "secure-code-authoring")).toBe(
      "https://e.org/fa/cat-harness/voice/secure-code-authoring",
    );
    expect(CLASS_GLOSSES.Voice?.gloss).toBeTruthy();
  });
});

describe("the voices a layer holds", () => {
  test("one node per declared voice, named by its directory, read from its voice.json", () => {
    const root = mkdtempSync(join(tmpdir(), "voice-nodes-"));
    try {
      writeFileSync(
        join(root, "cat-harness.json"),
        JSON.stringify({ name: "x", directories: [{ id: "voices", path: "skills/voices", graphTypologies: ["voices"] }] }),
      );
      mkdirSync(join(root, "skills", "voices", "plain"), { recursive: true });
      writeFileSync(join(root, "skills", "voices", "plain", "voice.json"), JSON.stringify({ id: "plain", title: "Plain", description: "Say it plainly." }));
      const nodes = voiceNodes(root);
      expect(nodes.map((n) => [n.id, n.sourcePath, n.title, n.description])).toEqual([
        ["plain", "skills/voices/plain/voice.json", "Plain", "Say it plainly."],
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a layer that declares no voices holds no voice nodes", () => {
    const root = mkdtempSync(join(tmpdir(), "voice-nodes-"));
    try {
      writeFileSync(join(root, "cat-harness.json"), JSON.stringify({ name: "x", directories: [] }));
      expect(voiceNodes(root)).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

const VOICE = {
  id: "plain",
  title: "Plain <voice>",
  description: "Say it plainly.",
  instance: "x",
  path: "x/skills/voices/plain/voice.json",
  provenance: "library",
  overlaySeverity: "minor",
  criterion: "voice-plain",
  sources: [],
  hasInstructions: false,
  provenanceFlags: [],
  rules: [
    {
      id: "r1",
      title: "Short",
      description: "Short sentences.",
      category: "style",
      severity: "minor",
      patterns: 0,
      terminology: 0,
      judgementOnly: true,
      citation: "library",
      cites: "lib#s1",
      quote: "Keep it short.",
      pages: "3",
    },
  ],
} as unknown as VoiceView;

describe("each voice is a row and a page", () => {
  test("the projection carries each voice's page and IRI", () => {
    const g = { directories: [], totals: { voices: 1 }, voices: [VOICE] };
    const out = projection(g as never, undefined, undefined, (v) => ({ page: voicePagePath("en/cat-harness/voices/", v.instance, v.id), iri: "https://e.org/x/voice/plain" })) as {
      voices: { page?: string; iri?: string }[];
    };
    expect(out.voices[0]).toMatchObject({ page: "en/cat-harness/voices/x/plain/", iri: "https://e.org/x/voice/plain" });
  });

  test("its page names its JSON-LD as the alternate, links its IRI, and lists every rule with its passage", () => {
    const html = voicePageHtml(VOICE, "https://e.org/x/voice/plain");
    expect(html).toContain('alternate_jsonld: "https://e.org/x/voice/plain.jsonld"');
    expect(html).toContain(VOICE_PAGE_MARKER);
    expect(html).toContain('<a class="iri" href="https://e.org/x/voice/plain">');
    expect(html).toContain("Plain &lt;voice&gt;");
    expect(html).toContain("<blockquote>Keep it short.</blockquote>lib#s1, p3");
  });

  test("a voice whose layer's export is not served has a page and no IRI", () => {
    const html = voicePageHtml(VOICE, undefined);
    expect(html).not.toContain("alternate_jsonld");
    expect(html).not.toContain('class="iri"');
  });
});
