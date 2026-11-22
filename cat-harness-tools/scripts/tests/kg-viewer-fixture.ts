#!/usr/bin/env bun
/**
 * A viewer page with a catalogue in it, for the tests that need one.
 *
 * ## Why a fixture rather than a shipped language
 *
 * The repository ships **no translated catalogue**: every
 * `translations/<locale>/kg-viewer.po` carries the msgids with an empty
 * msgstr, awaiting a person. That is the decision, and it is the right one — a
 * machine translation into a language nobody here reads is an artefact whose
 * correctness cannot be checked here, and a header calling it unofficial does
 * not change what a reader sees.
 *
 * It leaves the switcher, the language announcement, the right-to-left flip
 * and the per-string fallback with nothing to exercise them, in a repository
 * whose own accessibility skill says that a check which does not run is a
 * habit rather than a rule. So the tests generate a page with a catalogue of
 * their own.
 *
 * **It is the real generator**, called the way the CLI calls it, with
 * different data — not a hand-written page that could agree with the tests
 * while disagreeing with what ships.
 *
 * ## The fixture locale
 *
 * `qaa` is reserved by ISO 639-3 for local use, so it names no real language
 * and cannot be mistaken for one. Its strings are the English wrapped in
 * guillemets — pseudolocalisation, legible to a reviewer who reads only
 * English and obviously not a translation.
 *
 * It is deliberately PARTIAL. The strings left out are what proves an
 * untranslated entry falls back to English rather than rendering blank, which
 * is the path EVERY shipped locale is on today.
 *
 * It declares itself right-to-left, because Arabic is a language this viewer
 * is meant for and the direction flip is the one thing no left-to-right
 * catalogue could test.
 *
 * ## The msgids are taken from the table, never retyped
 *
 * A fixture carrying its own copy of a string is a fixture that goes stale
 * silently: the page would fall back to English, the assertion would fail, and
 * the failure would look like a bug in the page. Each one is looked up, and a
 * lookup that misses throws here rather than at the assertion.
 *
 * @module scripts/tests/kg-viewer-fixture
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { viewerHtml } from "../kg-viewer.ts";
import { UI_STRINGS, type LocaleCatalogue } from "../kg-viewer-strings.ts";
import { artefactStubFor, repoRootFor } from "../../schemas/kg/cat-harness.js";
import { HARNESS_ROOT } from "../lib/roots.ts";

/** Wrap in guillemets: a translation a reader of English can still check. */
const pseudo = (s: string): string => "«" + s + "»";

/**
 * The declared string this names, or a loud failure.
 *
 * An exact match wins, because several strings share a prefix -- "Interface
 * language" is the start of "Interface language: {language}" -- and a prefix
 * that matched two would otherwise make naming the shorter one impossible.
 */
function msgid(prefix: string): string {
  const exact = UI_STRINGS.filter((s) => s.en === prefix);
  if (exact.length === 1) return exact[0].en;
  const hits = UI_STRINGS.filter((s) => s.en.startsWith(prefix));
  if (hits.length !== 1) {
    throw new Error(
      `kg-viewer fixture: ${hits.length} strings start with ${JSON.stringify(prefix)}; ` +
        "the table moved under the fixture — update scripts/tests/kg-viewer-fixture.ts.",
    );
  }
  return hits[0].en;
}

/**
 * Translated in the fixture. Everything else — "All", "Skip to results",
 * "type", "none" and the whole provenance line — is left English on purpose.
 */
const TRANSLATED = [
  "Kind",
  "Nodes",
  "Select a node.",
  "Selected node",
  "search name, id, title…",
  "Interface language",
  "Interface language: {language}",
].map(msgid);

/** The fixture locale's tag, reserved for local use and no real language. */
export const FIXTURE_LOCALE = "qaa";

export const FIXTURE_CATALOGUE: LocaleCatalogue = (() => {
  const strings: Record<string, string> = {};
  for (const en of TRANSLATED) strings[en] = pseudo(en);
  // Shortened rather than pseudolocalised whole, so a test can assert the
  // sentence exactly without restating three lines of English.
  strings[msgid("The interface is shown in")] =
    pseudo("The interface is shown in {language}; the graph is not.");
  return {
    locale: FIXTURE_LOCALE,
    name: "Qaa (fixture)",
    dir: "rtl",
    official: false,
    translated: Object.keys(strings).length,
    strings,
  };
})();

/** Where the fixture page is written, relative to the repository root. */
export const FIXTURE_PAGE = "_kg/folio-assistant-i18n-fixture/index.html";

/**
 * Write it.
 *
 * The stub is the REAL one, because the page reads its graph document from
 * the parent directory and the fixture sits one level down from the same
 * `_kg/` the rest of the suite generates into. A fixture with its own stub
 * would need its own graph, and would then be testing a document nothing else
 * has looked at.
 *
 * **It is now RESOLVED rather than spelled.** That paragraph was already the
 * intent, and the line below still read `viewerHtml("folio-assistant", ...)`
 * — so the stub was real only for as long as nobody changed it. The
 * 2026-09-21 rename (issue #649) changed it, the export began writing
 * `_kg/cat-harness.jsonld`, and this page went on fetching
 * `../folio-assistant.jsonld`: four catalogue specs failed on a 404 that had
 * nothing to do with catalogues. A comment asserting a value does not keep it
 * true; reading it does.
 *
 * The fixture DIRECTORY keeps its own name. It only has to sit one level under
 * `_kg/` for `../<stub>.jsonld` to resolve, so what it is called is
 * independent of the stub — and naming it after the fixture is what tells a
 * reader it is not a published artefact.
 */
export function writeFixture(root: string): string {
  const out = join(root, FIXTURE_PAGE);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, viewerHtml(artefactStubFor(join(root, "cat-harness")), [FIXTURE_CATALOGUE]));
  return out;
}

if (import.meta.main) {
  // The REPOSITORY root. The fixture lands under `_kg/`, which is a repository
  // build output, and the e2e specs fetch it from `test-server.mjs` — which
  // serves the repository root. Writing it to the LAYER root put it one
  // level below where every reader looks, and sixteen specs timed out waiting
  // for a page that had been written to a path nothing serves.
  const root = repoRootFor(join(HARNESS_ROOT));
  console.log("kg viewer fixture → " + writeFixture(root));
}
