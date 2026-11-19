/**
 * The translation review round trip: the issue's record, the PO edit, the
 * plan the workflow writes, and the cell states the review page shows.
 *
 * @covers translation-sources
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  ADJUDICATION_SCHEMA,
  applyAdjudication,
  applySuggestion,
  candidatesProblems,
  issueBody,
  msgidHash,
  newIssueUrl,
  parseIssueBody,
  payloadProblems,
  planAdjudication,
  poEntries,
  poHash,
  sourceFilesOf,
  type AdjudicationPayload,
  type Suggestion,
} from "../lib/translation-adjudication.ts";
import { cellState, lastAdjudicatedHash, reviewBody, reviewLayer } from "../lib/translation-review-page.ts";

const PO = `# header comment
msgid ""
msgstr ""
"Language: fr\\n"

#: docs/no-such-page.md:3
msgid "Hello"
msgstr "Bonjour"

#: docs/no-such-page.md:9 docs/no-such-page2.md:2
#, python-format
msgid ""
"A long "
"string"
msgstr ""
"Une longue "
"chaîne"

#: docs/no-such-page.md:12
msgctxt "menu"
msgid "File"
msgstr "Fichier"

msgid "One"
msgid_plural "Many"
msgstr[0] "Un"
msgstr[1] "Plusieurs"
`;

const count = (t: string) => {
  const es = poEntries(t);
  return { entries: es.length, translated: es.filter((e) => e.msgstr && !e.fuzzy).length, fuzzy: es.filter((e) => e.fuzzy).length };
};

function payload(items: AdjudicationPayload["items"]): AdjudicationPayload {
  return { $schema: ADJUDICATION_SCHEMA, repository: "acme/layer", layer: "layer", translations: "translations", items };
}

function layer(): string {
  const root = mkdtempSync(join(tmpdir(), "tr-adj-"));
  mkdirSync(join(root, "translations", "fr", "docs"), { recursive: true });
  writeFileSync(join(root, "translations", "fr", "docs", "index.po"), PO);
  writeFileSync(join(root, "translations", "fr", "docs", "index.pot"), PO.replace(/msgstr "[^"]+"/g, 'msgstr ""'));
  return root;
}

const att = (cat: string, locale: string) => `test/attestations/translation-qa/${cat}.${locale}.attestations.json`;

function plan(root: string, p: AdjudicationPayload, association = "OWNER") {
  return planAdjudication({
    layerRoot: root,
    repository: "acme/layer",
    translations: "translations",
    payload: p,
    author: { login: "reviewer", association },
    issueUrl: "https://github.com/acme/layer/issues/7",
    at: "2026-11-14T10:00:00Z",
    attestationPath: att,
    attestationSubject: (c) => c,
  });
}

describe("the PO reader", () => {
  test("reads entries, multi-line strings, context and references; skips the header", () => {
    const es = poEntries(PO);
    expect(es.map((e) => e.msgid)).toEqual(["Hello", "A long string", "File", "One"]);
    expect(es[1]!.msgstr).toBe("Une longue chaîne");
    expect(es[2]!.msgctxt).toBe("menu");
    expect(es[3]!.msgidPlural).toBe("Many");
    expect(sourceFilesOf(PO)).toEqual(["docs/no-such-page.md", "docs/no-such-page2.md"]);
  });
});

describe("applying a suggestion", () => {
  test("replaces a multi-line msgstr and joins an existing flags line", () => {
    const r = applySuggestion(PO, { msgid: "A long string", current: "Une longue chaîne", suggested: 'Une "très" longue chaîne' });
    expect("text" in r).toBe(true);
    const t = (r as { text: string }).text;
    expect(t).toContain('#, python-format, fuzzy\nmsgid ""');
    expect(t).toContain('msgstr "Une \\"très\\" longue chaîne"\n\n');
    const e = poEntries(t).find((x) => x.msgid === "A long string")!;
    expect(e.msgstr).toBe('Une "très" longue chaîne');
    expect(e.fuzzy).toBe(true);
  });
  test("adds a flags line after the comments when there is none", () => {
    const t = (applySuggestion(PO, { msgid: "Hello", current: "Bonjour", suggested: "Salut" }) as { text: string }).text;
    expect(t).toContain('#: docs/no-such-page.md:3\n#, fuzzy\nmsgid "Hello"\nmsgstr "Salut"');
  });
  test("matches on context", () => {
    expect("refused" in applySuggestion(PO, { msgid: "File", current: "Fichier", suggested: "Dossier" })).toBe(true);
    expect("text" in applySuggestion(PO, { msgid: "File", msgctxt: "menu", current: "Fichier", suggested: "Dossier" })).toBe(true);
  });
  test("an adjudication writes msgstr, clears fuzzy and the previous-source lines, keeps other flags", () => {
    const po = '#: a.md:1\n#, python-format, fuzzy\n#| msgid "Helo"\nmsgid "Hello"\nmsgstr "Bonjur"\n';
    expect(poEntries(po)[0]).toMatchObject({ previousMsgid: "Helo", fuzzy: true });
    const t = (applyAdjudication(po, { msgid: "Hello", current: "Bonjur", suggested: "Bonjour" }) as { text: string }).text;
    expect(t).toBe('#: a.md:1\n#, python-format\nmsgid "Hello"\nmsgstr "Bonjour"\n');
    const bare = (applyAdjudication('#, fuzzy\nmsgid "a"\nmsgstr "b"\n', { msgid: "a", current: "b", suggested: "c" }) as { text: string }).text;
    expect(bare).toBe('msgid "a"\nmsgstr "c"\n');
    expect(applyAdjudication(PO, { msgid: "Hello", current: "Allô", suggested: "Salut" })).toEqual({ refused: expect.stringContaining("no longer says") });
  });
  test("refuses a string that changed since the reviewer saw it, and plural entries", () => {
    expect(applySuggestion(PO, { msgid: "Hello", current: "Salut", suggested: "Coucou" })).toEqual({ refused: expect.stringContaining("no longer says") });
    expect(applySuggestion(PO, { msgid: "One", current: "Un", suggested: "Une" })).toEqual({ refused: expect.stringContaining("plural") });
  });
});

describe("the issue", () => {
  const p = payload([
    { catalogue: "docs/index", locale: "fr", verdict: "acceptable", poHash: poHash(PO) },
    { catalogue: "docs/other", locale: "fr", verdict: "mistranslation", poHash: "0123456789abcdef", suggestions: [{ msgid: "a`b", current: "x", suggested: "y" }] },
  ]);
  test("the body's JSON block round-trips, whatever the summary contains", () => {
    expect(parseIssueBody(issueBody(p))).toEqual(p);
    expect(payloadProblems(p)).toEqual([]);
  });
  test("a new-issue URL is prefilled, or absent when too long", () => {
    const url = new URL(newIssueUrl(p)!);
    expect(url.pathname).toBe("/acme/layer/issues/new");
    expect(url.searchParams.get("labels")).toBe("translation-adjudication");
    const big = payload(Array.from({ length: 200 }, (_, i) => ({ catalogue: `c/${i}`, locale: "fr", verdict: "acceptable" as const, poHash: poHash(String(i)) })));
    expect(newIssueUrl(big)).toBeUndefined();
  });
  test("an untrusted record is checked field by field", () => {
    const bad = payload([{ catalogue: "../../etc/passwd", locale: "fr", verdict: "acceptable", poHash: "zz" }]);
    expect(payloadProblems(bad)).toEqual(expect.arrayContaining([expect.stringContaining("catalogue"), expect.stringContaining("poHash")]));
    expect(payloadProblems({ $schema: "nope" })).not.toEqual([]);
    expect(payloadProblems(payload([{ catalogue: "a", locale: "fr", verdict: "mistranslation", poHash: poHash("") }]))).toEqual([expect.stringContaining("at least one suggestion")]);
  });
});

describe("planning the record", () => {
  test("only a collaborator accepts a catalogue (owner, 2026-11-18)", () => {
    const r = plan(layer(), payload([{ catalogue: "docs/index", locale: "fr", verdict: "acceptable", poHash: poHash(PO) }]), "NONE");
    expect(r.writes.size).toBe(0);
    expect(r.refused[0]).toContain("only an owner, member or collaborator");
    expect(r.refused[0]).toContain("propose");
  });
  test("a catalogue that changed since the page showed it is refused", () => {
    const r = plan(layer(), payload([{ catalogue: "docs/index", locale: "fr", verdict: "acceptable", poHash: "0000000000000000" }]));
    expect(r.writes.size).toBe(0);
    expect(r.refused[0]).toContain("changed since");
  });
  test("a record for another repository is refused", () => {
    const p = { ...payload([{ catalogue: "docs/index", locale: "fr", verdict: "acceptable" as const, poHash: poHash(PO) }]), repository: "evil/other" };
    expect(plan(layer(), p).refused[0]).toContain("is for evil/other");
  });
  test("acceptable: the node is signed off by the issue's author and the audited record names the issue", () => {
    const root = layer();
    const r = plan(root, payload([{ catalogue: "docs/index", locale: "fr", verdict: "acceptable", poHash: poHash(PO) }]));
    expect(r.applied).toEqual(["fr/docs/index: accepted"]);
    expect(r.writes.has("translations/fr/docs/index.po")).toBe(false);
    const node = JSON.parse(r.writes.get("translations/fr/docs/index.json")!);
    expect(node.status).toMatchObject({ locale: "fr", official: true, signedOffBy: "reviewer", signedOffAt: "2026-11-14T10:00:00Z" });
    expect(node.sourceFile).toBe("docs/no-such-page.md");
    expect(node.potFile).toBe("translations/fr/docs/index.pot");
    const a = JSON.parse(r.writes.get(att("translations/fr/docs/index", "fr"))!);
    expect(a.criteria["human-adjudication"]).toEqual([
      { reviewer: { kind: "human", id: "github:reviewer" }, verdict: "acceptable", at: "2026-11-14T10:00:00Z", issue: "https://github.com/acme/layer/issues/7", po_hash: poHash(PO) },
    ]);
  });
  const write = (root: string, plan_: { writes: Map<string, string> }) => {
    for (const [rel, text] of plan_.writes) {
      mkdirSync(join(root, rel, ".."), { recursive: true });
      writeFileSync(join(root, rel), text);
    }
  };
  const fix = (s: Partial<Suggestion> & { suggested: string }, extra: object = {}) =>
    payload([{ catalogue: "docs/index", locale: "fr", verdict: "mistranslation", poHash: poHash(PO), suggestions: [{ msgid: "Hello", current: "Bonjour", ...s }], ...extra }]);

  test("a collaborator who chooses writes msgstr, not fuzzy, and the entry's chosen says who, when, why and which candidate", () => {
    const root = layer();
    mkdirSync(join(root, "test/attestations/translation-qa/translations/fr/docs"), { recursive: true });
    writeFileSync(join(root, att("translations/fr/docs/index", "fr")), JSON.stringify({ $schema: "qa-attestations/v1", family: "translation-qa", subject: { kind: "block", id: "s", path: "s" }, locale: "fr", criteria: { "human-adjudication": [{ reviewer: { kind: "human", id: "github:earlier" } }] } }));
    writeFileSync(join(root, "translations/fr/docs/index.json"), JSON.stringify({ label: "trans:fr/docs/index", locale: "fr", sourceFile: "docs/no-such-page.md", poFile: "x", status: { locale: "fr", official: true, signedOffBy: "earlier", signedOffAt: "2026-01-01T00:00:00Z" } }));
    const p = payload([{ catalogue: "docs/index", locale: "fr", verdict: "mistranslation", poHash: poHash(PO), note: "tone", suggestions: [{ msgid: "Hello", current: "Bonjour", suggested: "Salut", choose: true, reason: "informal register", source: { kind: "agent", id: "claude-opus-5-5" } }, { msgid: "Gone", current: "", suggested: "x" }] }]);
    const r = plan(root, p);
    expect(r.applied).toEqual(["fr/docs/index: 1 proposal(s) recorded beside the other candidates; 1 chosen as the translation by @reviewer"]);
    expect(r.refused).toEqual([expect.stringContaining("no entry")]);
    const po = r.writes.get("translations/fr/docs/index.po")!;
    expect(poEntries(po).find((e) => e.msgid === "Hello")).toMatchObject({ msgstr: "Salut", fuzzy: false });
    const side = JSON.parse(r.writes.get("translations/fr/docs/index.candidates.json")!);
    expect(candidatesProblems(side)).toEqual([]);
    const hello = side.entries.find((e: { msgid: string }) => e.msgid === "Hello");
    expect(hello.candidates).toEqual([
      { text: "Salut", source: { kind: "human", id: "github:reviewer", by: "github:reviewer", at: "2026-11-14T10:00:00Z", issue: 7 }, msgidHash: msgidHash({ msgid: "Hello" }), basedOn: { kind: "agent", id: "claude-opus-5-5" }, qa: { placeholders: { pass: true }, at: "2026-11-14T10:00:00Z" } },
    ]);
    expect(hello.chosen).toEqual({ text: "Salut", how: "adjudicated", by: "github:reviewer", at: "2026-11-14T10:00:00Z", issue: 7, reason: "informal register", candidate: { kind: "agent", id: "claude-opus-5-5" } });
    const node = JSON.parse(r.writes.get("translations/fr/docs/index.json")!);
    expect(node.status.official).toBe(false);
    expect(node.status.signedOffBy).toBeUndefined();
    expect(node.status.flaggedForReview).toBeUndefined();
    const list = JSON.parse(r.writes.get(att("translations/fr/docs/index", "fr"))!).criteria["human-adjudication"];
    expect(list).toHaveLength(2);
    expect(list[1]).toMatchObject({ verdict: "mistranslation", note: "tone", po_hash: poHash(PO), po_hash_after: poHash(po), suggestions: [{ msgid: "Hello" }] });
    expect(issueBody(p)).toContain("chooses `Hello`: `Bonjour` → `Salut` (candidate from agent `claude-opus-5-5`) because informal register");
  });
  test("a collaborator's suggestion without choose is a proposal", () => {
    const r = plan(layer(), fix({ suggested: "Salut" }));
    expect(r.writes.has("translations/fr/docs/index.po")).toBe(false);
    expect(JSON.parse(r.writes.get("translations/fr/docs/index.candidates.json")!).entries[0].chosen).toBeUndefined();
    expect(r.applied).toEqual(["fr/docs/index: 1 proposal(s) recorded beside the other candidates; msgstr is left as it was"]);
  });
  test("a non-collaborator's suggestion is appended, never refused; choose is not honoured; the catalogue is flagged for a collaborator", () => {
    const root = layer();
    const r = plan(root, fix({ suggested: "Salut", choose: true }), "NONE");
    expect(r.refused).toEqual([expect.stringContaining("only an owner, member or collaborator can choose")]);
    expect(r.applied).toEqual(["fr/docs/index: 1 proposal(s) recorded beside the other candidates; msgstr is left as it was; a collaborator chooses (@reviewer is NONE)"]);
    expect(r.writes.has("translations/fr/docs/index.po")).toBe(false);
    const side = JSON.parse(r.writes.get("translations/fr/docs/index.candidates.json")!);
    expect(side.entries[0].candidates[0]).toMatchObject({ text: "Salut", source: { kind: "human", id: "github:reviewer", issue: 7 } });
    expect(side.entries[0].chosen).toBeUndefined();
    const node = JSON.parse(r.writes.get("translations/fr/docs/index.json")!);
    expect(node.status).toMatchObject({ official: false, flaggedForReview: true, flagReason: expect.stringContaining("await a collaborator's choice") });
    const a = JSON.parse(r.writes.get(att("translations/fr/docs/index", "fr"))!).criteria;
    expect(a["human-adjudication"]).toBeUndefined();
    expect(a["human-proposal"]).toHaveLength(1);
  });
  test("a proposal for an EMPTY msgstr is auto-picked, fuzzy", () => {
    const root = layer();
    const empty = PO.replace('msgstr "Bonjour"', 'msgstr ""');
    writeFileSync(join(root, "translations/fr/docs/index.po"), empty);
    const r = plan(root, payload([{ catalogue: "docs/index", locale: "fr", verdict: "mistranslation", poHash: poHash(empty), suggestions: [{ msgid: "Hello", current: "", suggested: "Salut" }] }]), "CONTRIBUTOR");
    expect(r.applied.at(-1)).toContain("1 string(s) now show the auto-pick");
    expect(poEntries(r.writes.get("translations/fr/docs/index.po")!).find((e) => e.msgid === "Hello")).toMatchObject({ msgstr: "Salut", fuzzy: true });
    expect(JSON.parse(r.writes.get("translations/fr/docs/index.candidates.json")!).entries[0].chosen).toMatchObject({ text: "Salut", how: "auto" });
  });
  test("two different proposals are both kept, even from a page older than the catalogue", () => {
    const root = layer();
    write(root, plan(root, fix({ suggested: "Salut" }), "NONE"));
    const second = planAdjudication({
      layerRoot: root, repository: "acme/layer", translations: "translations",
      payload: payload([{ catalogue: "docs/index", locale: "fr", verdict: "mistranslation", poHash: "0000000000000000", suggestions: [{ msgid: "Hello", current: "Bonjour", suggested: "Coucou" }] }]),
      author: { login: "other", association: "NONE" }, issueUrl: "https://github.com/acme/layer/issues/8", at: "2026-11-15T10:00:00Z", attestationPath: att, attestationSubject: (c) => c,
    });
    expect(second.refused).toEqual([]);
    const side = JSON.parse(second.writes.get("translations/fr/docs/index.candidates.json")!);
    expect(side.entries[0].candidates.map((c: { text: string; source: { id: string } }) => `${c.text} ${c.source.id}`)).toEqual(["Salut github:reviewer", "Coucou github:other"]);
  });
  test("a choice against a moved catalogue or string is refused, and the proposal kept", () => {
    const moved = plan(layer(), payload([{ catalogue: "docs/index", locale: "fr", verdict: "mistranslation", poHash: "0000000000000000", suggestions: [{ msgid: "Hello", current: "Bonjour", suggested: "Salut", choose: true }] }]));
    expect(moved.refused).toEqual([expect.stringContaining("changed since the page showed it")]);
    expect(moved.writes.has("translations/fr/docs/index.po")).toBe(false);
    expect(JSON.parse(moved.writes.get("translations/fr/docs/index.candidates.json")!).entries[0].candidates).toHaveLength(1);
    const stale = plan(layer(), fix({ current: "Allô", suggested: "Salut", choose: true }));
    expect(stale.refused).toEqual([expect.stringContaining("no longer says what the reviewer saw")]);
    expect(stale.writes.has("translations/fr/docs/index.po")).toBe(false);
    expect(payloadProblems(fix({ suggested: "x", choose: "yes" as never }))).toEqual([expect.stringContaining("choose")]);
  });
  test("acceptable adjudicates each fuzzy entry as it stands", () => {
    const root = layer();
    const fuzzy = PO.replace('#: docs/no-such-page.md:3\nmsgid "Hello"', '#: docs/no-such-page.md:3\n#, fuzzy\nmsgid "Hello"');
    writeFileSync(join(root, "translations/fr/docs/index.po"), fuzzy);
    const r = plan(root, payload([{ catalogue: "docs/index", locale: "fr", verdict: "acceptable", poHash: poHash(fuzzy) }]));
    expect(r.applied).toEqual(["fr/docs/index: accepted; 1 fuzzy string(s) adjudicated as they stand"]);
    const po = r.writes.get("translations/fr/docs/index.po")!;
    expect(poEntries(po).find((e) => e.msgid === "Hello")).toMatchObject({ msgstr: "Bonjour", fuzzy: false });
    expect(JSON.parse(r.writes.get("translations/fr/docs/index.candidates.json")!).entries[0].chosen).toMatchObject({ text: "Bonjour", how: "adjudicated", by: "github:reviewer", issue: 7 });
    expect(JSON.parse(r.writes.get(att("translations/fr/docs/index", "fr"))!).criteria["human-adjudication"][0].po_hash_after).toBe(poHash(po));
  });
  test("a candidates file that will not validate is never overwritten", () => {
    const root = layer();
    writeFileSync(join(root, "translations/fr/docs/index.candidates.json"), JSON.stringify({ $schema: "nope" }));
    const r = plan(root, payload([{ catalogue: "docs/index", locale: "fr", verdict: "mistranslation", poHash: poHash(PO), suggestions: [{ msgid: "Hello", current: "Bonjour", suggested: "Salut" }] }]));
    expect(r.writes.size).toBe(0);
    expect(r.refused[0]).toContain("never overwritten");
  });
  test("an attestation that will not parse is never overwritten", () => {
    const root = layer();
    mkdirSync(join(root, "test/attestations/translation-qa/translations/fr/docs"), { recursive: true });
    writeFileSync(join(root, att("translations/fr/docs/index", "fr")), "{ not json");
    const r = plan(root, payload([{ catalogue: "docs/index", locale: "fr", verdict: "acceptable", poHash: poHash(PO) }]));
    expect(r.writes.size).toBe(0);
    expect(r.refused[0]).toContain("never overwritten");
  });
});

describe("the review page's cells", () => {
  const signed = { status: { official: true, signedOffBy: "r", signedOffAt: "2026-11-14T10:00:00Z" } };
  test("machine, reviewed, stale, flagged, official, empty, none", () => {
    expect(cellState(count, undefined, undefined, undefined, undefined, undefined).state).toBe("none");
    expect(cellState(count, 'msgid "a"\nmsgstr ""\n', undefined, undefined, undefined, undefined).state).toBe("empty");
    expect(cellState(count, PO, { status: { generatedBy: "agent" } }, undefined, undefined, undefined)).toMatchObject({ state: "machine", generatedBy: "agent" });
    expect(cellState(count, PO, signed, undefined, undefined, undefined)).toMatchObject({ state: "reviewed", by: "r" });
    const seen = (h: string) => ({ criteria: { "human-adjudication": [{ po_hash: h }] } });
    expect(cellState(count, PO, signed, undefined, seen(poHash(PO)), undefined).state).toBe("reviewed");
    expect(cellState(count, PO, signed, undefined, seen("0000000000000000"), undefined).state).toBe("stale");
    expect(cellState(count, PO, { status: { flaggedForReview: true, flagReason: "why" } }, undefined, undefined, undefined)).toMatchObject({ state: "flagged", flagReason: "why" });
    expect(cellState(count, PO, undefined, { official: true, signedOffBy: "s" }, undefined, "yes")).toMatchObject({ state: "official", by: "s" });
    expect(lastAdjudicatedHash({ criteria: { "human-adjudication": [{ po_hash: "a", po_hash_after: "b" }] } })).toBe("b");
  });
  test("the matrix lists catalogues with a .po, links their sources, and offers controls only with a repository", () => {
    const root = layer();
    const l = reviewLayer({ name: "layer", repository: "acme/layer", layerRoot: root, translationsDir: join(root, "translations"), attestationFor: () => join(root, "none"), poHeader: () => undefined, count });
    expect(l.rows.map((r) => r.catalogue)).toEqual(["docs/index"]);
    expect(l.rows[0]!.sources).toEqual(["docs/no-such-page.md", "docs/no-such-page2.md"]);
    const html = reviewBody([l], "./");
    expect(html).toContain('href="https://github.com/acme/layer/blob/main/docs/no-such-page.md"');
    expect(html).toContain(`data-hash="${poHash(PO)}"`);
    // The page's fence is the one the workflow parses.
    expect(html).toContain("\\x60\\x60\\x60json translation-adjudication");
    const without = reviewBody([{ ...l, repository: undefined }], "./");
    expect(without).not.toContain('class="tr-accept"');
  });
});

test("the fixture is read from disk as written", () => {
  expect(readFileSync(join(layer(), "translations/fr/docs/index.po"), "utf-8")).toBe(PO);
});

describe("candidate translations", () => {
  test("a candidates file names a source for every candidate", () => {
    const ok = { $schema: "translation-candidates/v1", locale: "fr", catalogue: "docs/index", entries: [{ msgid: "Hello", candidates: [{ text: "Salut", source: { kind: "open-mt", id: "opus-mt-en-fr" } }, { text: "Bonjour", source: { kind: "agent", id: "claude-opus-5-5", at: "2026-11-14T10:00:00Z" } }] }] };
    expect(candidatesProblems(ok)).toEqual([]);
    const bad = { ...ok, entries: [{ msgid: "Hello", candidates: [{ text: "Salut", source: { kind: "oracle", id: "" } }] }] };
    expect(candidatesProblems(bad)).toEqual([expect.stringContaining("kind must be one of")]);
  });
  test("a picked candidate's source travels in the issue and into the audited record", () => {
    const root = layer();
    const p = payload([{ catalogue: "docs/index", locale: "fr", verdict: "mistranslation", poHash: poHash(PO), suggestions: [{ msgid: "Hello", current: "Bonjour", suggested: "Salut", source: { kind: "web-service", id: "deepl" }, choose: true }] }]);
    expect(payloadProblems(p)).toEqual([]);
    expect(issueBody(p)).toContain("candidate from web-service `deepl`");
    const r = plan(root, p);
    const list = JSON.parse(r.writes.get(att("translations/fr/docs/index", "fr"))!).criteria["human-adjudication"];
    expect(list[0].suggestions[0].source).toEqual({ kind: "web-service", id: "deepl" });
    const side = JSON.parse(r.writes.get("translations/fr/docs/index.candidates.json")!);
    expect(side.entries[0].candidates[0].basedOn).toEqual({ kind: "web-service", id: "deepl" });
    expect(side.entries[0].chosen.candidate).toEqual({ kind: "web-service", id: "deepl" });
    const badSource = payload([{ ...p.items[0]!, suggestions: [{ msgid: "Hello", current: "Bonjour", suggested: "Salut", source: { kind: "x", id: "y" } as never }] }]);
    expect(payloadProblems(badSource)).toEqual([expect.stringContaining("source kind")]);
  });
});
