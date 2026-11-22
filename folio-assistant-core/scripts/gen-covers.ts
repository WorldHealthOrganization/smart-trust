#!/usr/bin/env bun
/**
 * Render a cover thumbnail for every item whose PDF this repository holds.
 *
 * @module folio-assistant-core/scripts/gen-covers
 * @covers catalogue, uploads
 *
 * ## Generic, and so in core (bean `eayu`, 2026-09-30)
 *
 * Moved from the IRIS catalogue layer's `scripts/`. Owner: *"dspace scripts generic in
 * folio-assistant"*. `THUMBNAIL` is a DSpace bundle, not an IRIS one, and the
 * node shape is core's `CatalogueNode`, so this renders covers for ANY
 * catalogue layer — the layer root is the first argument. The IRIS catalogue was
 * the first to ask for them, which is why the owner's words below are IRIS's.
 *
 * Owner, 2026-09-20: *"do the needed things like extract cover avatar igf
 * neeeded"* — the IRIS home page shows a cover beside each recent submission,
 * and a replica of it without covers is a layout rather than a replica.
 *
 * ## What is generated here is OURS, and the node has to say so
 *
 * DSpace generates a `THUMBNAIL` bundle of its own. **These are not those.**
 * `iris.who.int` is egress-blocked from this environment, so nothing upstream
 * was fetched; each cover is page 1 of a PDF we already hold, rasterised by
 * `cat-harness-tools/scripts/pdf-cover.py`. A node recording one of these without
 * recording the derivation would assert that this repository holds a
 * bitstream IRIS produced, which is false — so this script REFUSES to write a
 * cover for a node whose THUMBNAIL bitstream does not declare it (see
 * `derivedNote` below).
 *
 * That is R8 pointed the other way. R8 says never infer metadata from the PDF
 * when a record exists; this says never let something derived from the PDF
 * pass as something the record supplied.
 *
 * ## The split with the Python
 *
 * `pdf-cover.py` is generic and decides nothing: a page raster is a PDF fact,
 * not a WHO one. This file decides which documents get a cover, where the
 * bytes land, and what the catalogue must say about them. Same split as
 * `pdf-structure.py` / `gen-library-jsonld.ts`.
 *
 * ## `--check` is the thing `yl5w` says is missing
 *
 * Bean `yl5w`: three `materialized` claims in this catalogue resolve to no
 * bytes, and `check:catalogue` does not look. It still does not — that is
 * `yl5w`'s to fix for the whole catalogue. What this adds is the narrow case
 * it is responsible for: every THUMBNAIL bitstream it would write is verified
 * to exist, to match byte for byte, and to match its recorded `sha256` and
 * pixel dimensions. A claim this script makes is a claim this script checks.
 *
 * Usage:
 *   bun run folio-assistant-core/scripts/gen-covers.ts <instance-root>   (e.g. an IRIS mirror)
 *   bun run folio-assistant-core/scripts/gen-covers.ts <instance-root> --check
 */
import { createHash } from "crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "fs";
import { dirname, join, relative, resolve } from "path";

import type { CatalogueNode, MaskedRegion } from "../schemas/catalogue.js";
import { bytesFor } from "./lib/bytes.js";
import { inputSiteReached } from "@litlfred/cat-harness-tools/schemas/sdlc/input-trace.ts";

/** The platform checkout — where the renderer and the render cache live, never the layer. */
const REPO = resolve(import.meta.dir, "..", "..");
const RENDERER = join(REPO, "cat-harness-tools", "scripts", "pdf-cover.py");

/** The listing width. One number, because every cover shares a column. */
export const COVER_WIDTH = 300;

/**
 * What a THUMBNAIL bitstream must say about itself before its bytes are written.
 *
 * Checked as a SUBSTRING of the node's own note rather than generated into it,
 * because the note is authored content — a person writing the catalogue says
 * what this file is, and this script refuses to supply bytes for a claim
 * nobody made. Generating the sentence would make the check circular.
 */
export const DERIVED_MARKER = "rendered here from page 1";

type Cover = {
  node: CatalogueNode;
  /**
   * The ORIGINAL bitstream the cover is rendered from, or undefined when the
   * ORIGINAL is `referenced`: the PDF was fetched once, rendered, and not
   * kept (IRIS catalogue covers for items whose bytes wait for the IRIS CDN). Such a
   * cover is verified against its recorded digest, bytes and dimensions, and
   * never re-rendered here.
   */
  sourcePdf: string | undefined;
  /** The declared THUMBNAIL bitstream, layer-relative. */
  outPath: string;
  declaredSha: string | undefined;
  declaredBytes: number | undefined;
  declaredW: number | undefined;
  declaredH: number | undefined;
  /**
   * Regions the catalogue asks to have blanked, in output pixels.
   *
   * Read from the node rather than decided here, for the same reason the
   * cover LIST is: this script supplies bytes and the catalogue says what it
   * wants. A generator choosing its own regions would blank different things
   * as its heuristics moved and nothing would record that it had.
   */
  masks: MaskedRegion[];
};

/** Every node under `<instanceDir>/catalogue/nodes`, `_`-comments stripped. */
function nodes(instanceDir: string): CatalogueNode[] {
  const dir = join(instanceDir, "catalogue", "nodes");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => {
      const raw = JSON.parse(readFileSync(join(dir, f), "utf-8"));
      for (const k of Object.keys(raw)) if (k.startsWith("_")) delete raw[k];
      return raw as CatalogueNode;
    })
    .sort((a, b) => a.id.localeCompare(b.id, "en"));
}

/**
 * The covers the catalogue ASKS for — never the ones this script could make.
 *
 * Driven off the declared THUMBNAIL bitstream, so adding a cover is a
 * catalogue edit and this script only supplies bytes. The alternative —
 * rendering a cover for every item with a PDF — would quietly add files to the
 * repository that nobody asked for, and `deletion-requires-confirmation`'s
 * mirror image is that creation should be asked for too.
 */
export function coversWanted(all: CatalogueNode[], instanceDir: string): { covers: Cover[]; problems: string[] } {
  const covers: Cover[] = [];
  const problems: string[] = [];

  for (const n of all) {
    const thumb = n.bitstreams?.find((b) => b.bundle === "THUMBNAIL");
    if (!thumb) continue;

    const lp = thumb.materialization?.localPath;
    if (!lp) {
      problems.push(`${n.id}: THUMBNAIL "${thumb.name}" has no localPath — bytes that are here are somewhere`);
      continue;
    }
    if (!(thumb.materialization?.note ?? "").includes(DERIVED_MARKER)) {
      problems.push(
        `${n.id}: THUMBNAIL "${thumb.name}" does not declare itself derived. ` +
          `Its materialization.note must contain "${DERIVED_MARKER}" — DSpace generates its own ` +
          `THUMBNAIL bundle and a cover we rasterised must not read as one IRIS supplied.`,
      );
      continue;
    }

    const orig = n.bitstreams?.find((b) => b.bundle !== "THUMBNAIL" && b.mediaType === "application/pdf");
    if (!orig) {
      problems.push(`${n.id}: a THUMBNAIL is declared but no ORIGINAL PDF bitstream is — nothing to render from`);
      continue;
    }
    const pdf = bytesFor(instanceDir, orig.materialization?.localPath, orig.name);
    // A `referenced` ORIGINAL is one this repository says it does not hold, so
    // no bytes is the expected answer, not a broken claim. Only a claim of
    // holding the PDF that resolves to nothing is a problem (bean yl5w).
    if (!pdf && orig.materialization?.state !== "referenced") {
      problems.push(`${n.id}: the ORIGINAL "${orig.name}" resolves to no bytes — see bean yl5w`);
      continue;
    }

    covers.push({
      node: n,
      sourcePdf: pdf,
      outPath: lp,
      declaredSha: thumb.materialization?.fixity?.digest,
      declaredBytes: thumb.bytes,
      declaredW: thumb.pixelWidth,
      declaredH: thumb.pixelHeight,
      masks: thumb.maskedRegions ?? [],
    });
  }
  return { covers, problems };
}

/**
 * A PNG's own pixel dimensions, read from its header.
 *
 * **This is what lets `--check` keep its teeth where PyMuPDF is not
 * installed.** A PNG opens with the 8-byte signature and then an `IHDR` chunk
 * whose first two fields are width and height as big-endian `u32` — bytes
 * 16..24. No decoder, no dependency, and it is the FILE's answer rather than
 * the renderer's, which is the one a consumer of the committed bytes actually
 * gets.
 *
 * Returns `undefined` rather than guessing when the bytes are not a PNG, so a
 * corrupt file reports as unreadable instead of as a dimension mismatch.
 */
export function pngSize(buf: Buffer): { w: number; h: number } | undefined {
  const SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buf.length < 24 || !buf.subarray(0, 8).equals(SIG)) return undefined;
  if (buf.subarray(12, 16).toString("latin1") !== "IHDR") return undefined;
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

/** Is the PDF backend available? A determined answer, asked once. */
function backendAvailable(): boolean {
  // input-site: traced #e76de5d9 — whether pymupdf is installed is a fact about the machine
  inputSiteReached("gen-covers: probes the PDF backend");
  const r = Bun.spawnSync(["python3", "-c", "import pymupdf"]);
  return r.exitCode === 0;
}

/**
 * One render, through the generic script. Its JSON is the provenance.
 *
 * Only reached when the backend is there — see `backendAvailable`. It used to
 * be called unconditionally, and that is the defect this comment exists for:
 * `iris:covers:check` went into the CI gate job, which installs `ruff` and
 * NOTHING ELSE, so the gate threw `pymupdf is not installed` on every run and
 * turned the branch red three times. The repository already had this written
 * down — `ingest-stdlib`'s own Tool node says it "is the only one of the pair
 * that runs where nothing has been installed, which is every fresh container
 * and every CI job here" — and the gate was registered anyway.
 */
function render(c: Cover & { sourcePdf: string }): { png: Buffer; facts: Record<string, unknown> } {
  const tmp = join(REPO, "node_modules", ".cache", "who-iris-covers", `${createHash("sha256").update(c.outPath).digest("hex").slice(0, 16)}.png`);
  mkdirSync(dirname(tmp), { recursive: true });
  // The masks go to the RENDERER, not applied afterwards here. `pdf-cover.py`
  // blanks them before it computes the digests, so `facts.sha256` describes
  // the bytes that actually get written -- and `--check` re-renders with the
  // same regions, so a committed masked cover compares equal to a fresh one.
  // Masking in this script instead would leave the renderer's provenance
  // describing an image nobody has.
  // input-site: traced #0f3cf01b — renders a cover with the PDF backend, a binary outside the tree
  inputSiteReached("gen-covers: renders through python");
  const r = Bun.spawnSync([
    "python3", RENDERER, c.sourcePdf, "-o", tmp, "--width", String(COVER_WIDTH), "--json",
    ...c.masks.flatMap((m) => ["--mask", `${m.x0},${m.y0},${m.x1},${m.y1}`]),
  ]);
  if (r.exitCode !== 0) {
    throw new Error(
      `pdf-cover.py failed for ${c.node.id}: ${new TextDecoder().decode(r.stderr).trim() || "no stderr"}`,
    );
  }
  const facts = JSON.parse(new TextDecoder().decode(r.stdout)) as Record<string, unknown>;
  return { png: Buffer.from(readFileSync(tmp)), facts };
}

/**
 * Everything checkable about a committed cover WITHOUT re-rendering it.
 *
 * Four of the five claims a node makes need no PDF backend at all: the bytes
 * exist, their sha256 is the declared one, their length is the declared one,
 * and their pixel dimensions are the declared ones. Only "these bytes are what
 * that PDF renders to" needs PyMuPDF.
 *
 * So the gate does NOT degrade to could-not-determine where the backend is
 * absent — it degrades to *slightly less*, and says which part it skipped.
 * That matters because this repository's rule is that could-not-check is never
 * green, and a check that reported `unknown` on every CI run would be a check
 * nobody could read.
 */
function verifyWithoutRender(c: Cover, abs: string, problems: string[]): boolean {
  if (!existsSync(abs)) {
    problems.push(`${c.node.id}: ${relative(REPO, abs)} does not exist — a materialized claim naming no bytes (yl5w)`);
    return false;
  }
  const bytes = readFileSync(abs);
  const sha = createHash("sha256").update(bytes).digest("hex");
  let ok = true;
  if (c.declaredSha && c.declaredSha !== sha) {
    problems.push(`${c.node.id}: declared sha256 ${c.declaredSha.slice(0, 12)}… but the committed file is ${sha.slice(0, 12)}…`);
    ok = false;
  }
  if (c.declaredBytes !== undefined && c.declaredBytes !== bytes.length) {
    problems.push(`${c.node.id}: declares ${c.declaredBytes} bytes; the file is ${bytes.length}`);
    ok = false;
  }
  const size = pngSize(bytes);
  if (!size) {
    problems.push(`${c.node.id}: ${relative(REPO, abs)} is not a readable PNG`);
    ok = false;
  } else if (size.w !== c.declaredW || size.h !== c.declaredH) {
    problems.push(`${c.node.id}: declares ${c.declaredW}x${c.declaredH}; the file is ${size.w}x${size.h}`);
    ok = false;
  }
  return ok;
}

function main(): number {
  const check = process.argv.includes("--check");
  const arg = process.argv.slice(2).find((a) => !a.startsWith("-"));
  if (!arg) {
    console.error("usage: gen-covers.ts <instance-root> [--check]   (e.g. an IRIS mirror)");
    return 2;
  }
  const instanceDir = resolve(arg);
  if (!existsSync(join(instanceDir, "catalogue", "nodes"))) {
    console.error(`gen-covers: ${arg} has no catalogue/nodes — not a catalogue instance`);
    return 2;
  }
  const all = nodes(instanceDir);
  const { covers, problems } = coversWanted(all, instanceDir);

  if (covers.length === 0 && problems.length === 0) {
    console.log("gen-covers: no THUMBNAIL bitstreams declared — nothing to render.");
    return 0;
  }

  const backend = backendAvailable();

  // WITHOUT THE BACKEND THERE IS NOTHING TO WRITE, and saying so is the whole
  // answer. A plain run needs to rasterise; refusing loudly is right, because
  // the alternative is a run that reports success having produced nothing.
  if (!check && !backend) {
    console.error(
      "gen-covers: no PDF backend (pymupdf). Rendering needs one — `pip install pymupdf`.\n" +
        "  `--check` still verifies the committed bytes, digests and dimensions without it.",
    );
    return 1;
  }

  let wrote = 0;
  let stale = 0;
  let verified = 0;
  let notHeld = 0;

  for (const c of covers) {
    const abs = join(instanceDir, c.outPath);

    if (!c.sourcePdf) {
      // Nothing to render from. The committed bytes are still checked against
      // every claim the node makes about them.
      if (verifyWithoutRender(c, abs, problems)) notHeld++;
      continue;
    }

    if (!backend) {
      // Four of the five claims, checked against the committed file itself.
      if (verifyWithoutRender(c, abs, problems)) verified++;
      continue;
    }

    const { png, facts } = render(c as Cover & { sourcePdf: string });
    const sha = createHash("sha256").update(png).digest("hex");

    // The claims the node makes about these bytes, checked against the bytes.
    if (c.declaredSha && c.declaredSha !== sha) {
      problems.push(`${c.node.id}: declared sha256 ${c.declaredSha.slice(0, 12)}… but the render is ${sha.slice(0, 12)}…`);
    }
    if (c.declaredW !== facts.pixelWidth || c.declaredH !== facts.pixelHeight) {
      problems.push(
        `${c.node.id}: declares ${c.declaredW}x${c.declaredH} but the render is ${facts.pixelWidth}x${facts.pixelHeight}`,
      );
    }

    const prev = existsSync(abs) ? readFileSync(abs) : undefined;
    if (prev && prev.equals(png)) {
      verified++;
      continue;
    }
    if (check) {
      console.error(`${prev ? "stale" : "missing"}: ${relative(REPO, abs)}`);
      stale++;
      continue;
    }
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, png);
    wrote++;
    console.log(
      `  ${relative(REPO, abs)}  ${facts.pixelWidth}x${facts.pixelHeight}  ${facts.bytes} bytes  sha256 ${sha.slice(0, 12)}…`,
    );
  }

  if (problems.length) {
    console.error(`\n✗ ${problems.length} problem(s):`);
    for (const p of problems) console.error(`    ${p}`);
    return 1;
  }
  if (check) {
    if (stale) {
      console.error(`\n${stale} cover(s) stale or missing. Run: bun run folio-assistant-core/scripts/gen-covers.ts ${relative(process.cwd(), instanceDir) || "."}`);
      return 1;
    }
    // SAY WHICH CHECK RAN. "3 covers verified" would read identically whether
    // or not the re-render happened, and the two are different assurances:
    // with the backend, these bytes ARE what that PDF renders to; without it,
    // they are the bytes the catalogue says it holds.
    if (notHeld) {
      console.log(`gen-covers --check: ${notHeld} cover(s) of referenced items verified against the catalogue — bytes, sha256 and PNG dimensions match; not re-rendered, the PDF is not held.`);
    }
    console.log(
      backend
        ? `gen-covers --check: ${verified} cover(s) up to date — re-rendered and compared, digests and dimensions match.`
        : `gen-covers --check: ${verified} cover(s) verified against the catalogue — bytes, sha256 and PNG dimensions match.\n` +
            `  NOT re-rendered: no PDF backend here (pymupdf). "these bytes are what that PDF renders to" is unchecked in this run.`,
    );
    return 0;
  }
  console.log(`\n${wrote} written, ${covers.length - wrote - notHeld} already current${notHeld ? `, ${notHeld} of referenced items verified only (PDF not held)` : ""}.`);
  return 0;
}

if (import.meta.main) process.exit(main());

export { nodes };
