/**
 * The covers are OURS, and the catalogue has to say so.
 *
 * @module folio-assistant-core/scripts/gen-covers.test
 *
 * DSpace generates a `THUMBNAIL` bundle of its own, so a cover this repository
 * rasterised is filed under the same bundle name as one IRIS produced and
 * nothing downstream can tell them apart from the name. The refusal below is
 * the only thing that keeps them apart, so it is the thing tested — against
 * the REAL catalogue, not a fixture, because a fixture would pass on the day
 * somebody removed the declaration from a real node.
 */
import { describe, expect, it } from "bun:test";
import { createHash } from "crypto";
import { existsSync, readFileSync } from "fs";
import { join, resolve } from "path";

import { coversWanted, nodes, pngSize, COVER_WIDTH, DERIVED_MARKER } from "./gen-covers.js";

/** The worked example: the one catalogue layer in this checkout, read as DATA (same as `source-liveness.test.ts`). */
const INSTANCE = resolve(import.meta.dir, "..", "..", "who-iris");

describe("the catalogue asks for the covers, not the script", () => {
  const all = nodes(INSTANCE);
  const { covers, problems } = coversWanted(all, INSTANCE);

  it("catalogueYieldsCovers", () => {
    expect(problems).toEqual([]);
    expect(covers.length).toBeGreaterThan(0);
  });

  it("coverBytesMatchDigest", () => {
    // R13, discharged for the case this script owns. `yl5w` is the general
    // version and is still open: three ORIGINAL bitstreams in this same
    // catalogue claim `materialized` and resolve to nothing, and
    // `check:catalogue` does not look at `localPath` at all.
    for (const c of covers) {
      const abs = join(INSTANCE, c.outPath);
      expect(existsSync(abs)).toBe(true);
      const sha = createHash("sha256").update(readFileSync(abs)).digest("hex");
      expect(c.declaredSha).toBe(sha);
    }
  });

  it("declaredWidthOwnHeight", () => {
    // Width is shared so a listing has one column; height is NOT, and that is
    // the point. The three are 2:3, 0.705:1 and a scanned page — a forced
    // height would letterbox or crop two of them.
    const ratios = new Set<string>();
    for (const c of covers) {
      expect(c.declaredW).toBe(COVER_WIDTH);
      expect(c.declaredH).toBeGreaterThan(0);
      ratios.add((c.declaredH! / c.declaredW!).toFixed(3));
    }
    expect(ratios.size).toBeGreaterThan(1);
  });
});

describe("a THUMBNAIL that does not declare itself derived is refused", () => {
  const all = nodes(INSTANCE);

  it("strippedDeclarationIsProblem", () => {
    const withCover = all.find((n) => n.bitstreams?.some((b) => b.bundle === "THUMBNAIL"));
    expect(withCover).toBeDefined();

    const stripped = JSON.parse(JSON.stringify(withCover)) as typeof withCover;
    const thumb = stripped!.bitstreams!.find((b) => b.bundle === "THUMBNAIL")!;
    thumb.materialization.note = "a cover";

    const { covers, problems } = coversWanted([stripped!], INSTANCE);
    expect(covers).toEqual([]);
    expect(problems.length).toBe(1);
    expect(problems[0]).toContain("does not declare itself derived");
  });

  it("markerInAuthoredNote", () => {
    // If the script wrote the sentence it checks for, the check would be
    // circular and would pass over any node the script had ever touched.
    for (const n of all) {
      const thumb = n.bitstreams?.find((b) => b.bundle === "THUMBNAIL");
      if (!thumb) continue;
      const note = thumb.materialization.note ?? "";
      expect(note).toContain(DERIVED_MARKER);
      // An authored note says more than the marker: which file, which tool,
      // which page, and why `of` is a local URI rather than the Handle.
      expect(note.length).toBeGreaterThan(DERIVED_MARKER.length * 4);
      expect(note).toContain("pdf-cover.py");
    }
  });

  it("noHandleAsSource", () => {
    // R12, one step on: the Handle identifies the ITEM. Putting it on a
    // rendering asserts IRIS supplied the image.
    for (const n of all) {
      const thumb = n.bitstreams?.find((b) => b.bundle === "THUMBNAIL");
      if (!thumb) continue;
      // The `local:` SCHEME is gone: a local original is now `provenance.local`,
      // asked for by name rather than distinguished from an upstream URI by its
      // prefix. This asserted the prefix because the prefix was the only thing
      // carrying the distinction — which is exactly why it was worth splitting.
      expect(thumb.materialization.provenance.local).toBeDefined();
      expect(thumb.materialization.provenance.upstream).toBeUndefined();
      expect(JSON.stringify(thumb.materialization.provenance)).not.toContain("iris.who.int");
    }
  });

  it("noArchivalCover", () => {
    for (const n of all) {
      const thumb = n.bitstreams?.find((b) => b.bundle === "THUMBNAIL");
      if (!thumb) continue;
      expect(thumb.materialization.purpose).toBe("working");
      expect(thumb.materialization.gates?.sourceLoss.verdict).not.toBe("permitted");
    }
  });
});

describe("the check keeps its teeth where PyMuPDF is not installed", () => {
  // THE DEFECT THIS IS THE RATCHET FOR. `iris:covers:check` was registered in
  // the CI gate job, which installs `ruff` and nothing else, so it threw
  // `pymupdf is not installed` on every run and turned the branch red three
  // times. The repository had already written this down — `ingest-stdlib`'s
  // Tool node says it "is the only one of the pair that runs where nothing has
  // been installed, which is every fresh container and every CI job here".
  //
  // The fix is not to install a backend in the gate job, and not to degrade to
  // could-not-determine either: four of the five claims a node makes about a
  // cover need no decoder at all. These assert that they really are checkable
  // from the committed bytes.
  const { covers } = coversWanted(nodes(INSTANCE), INSTANCE);

  it("pngHeaderDimensions", () => {
    for (const c of covers) {
      const buf = readFileSync(join(INSTANCE, c.outPath));
      const size = pngSize(buf);
      expect(size).not.toBeUndefined();
      expect(size!.w).toBe(c.declaredW!);
      expect(size!.h).toBe(c.declaredH!);
    }
  });

  it("sharedListingWidth", () => {
    for (const c of covers) expect(c.declaredW).toBe(COVER_WIDTH);
  });

  it("pngSizeRefusesNonPng", () => {
    // A corrupt file must report as unreadable, not as a dimension mismatch:
    // the two have different causes and different fixes.
    expect(pngSize(Buffer.alloc(4))).toBeUndefined();
    expect(pngSize(Buffer.from("not a png at all, but long enough to index"))).toBeUndefined();
    const real = readFileSync(join(INSTANCE, covers[0]!.outPath));
    const wrongChunk = Buffer.from(real);
    wrongChunk.write("IHDX", 12, "latin1");
    expect(pngSize(wrongChunk)).toBeUndefined();
  });

  it("flippedByteChangesDigest", () => {
    // The tamper case, asserted rather than only tried by hand: the digest is
    // what makes the backend-free path a real check instead of a file-exists
    // test wearing its clothes.
    const c = covers[0]!;
    const buf = Buffer.from(readFileSync(join(INSTANCE, c.outPath)));
    expect(createHash("sha256").update(buf).digest("hex")).toBe(c.declaredSha!);
    buf[buf.length - 5] ^= 0xff;
    expect(createHash("sha256").update(buf).digest("hex")).not.toBe(c.declaredSha!);
  });

  it("declaredBytesIsLength", () => {
    for (const c of covers) {
      expect(c.declaredBytes).toBe(readFileSync(join(INSTANCE, c.outPath)).length);
    }
  });
});

describe("a cover can outlive a PDF the repository does not hold", () => {
  // who-iris renders covers for `referenced` items on a runner that fetches the
  // PDF, checks its sha256 and throws it away. The cover is then verified from
  // its own bytes; a missing PDF is only a problem when the node claims to hold it.
  const thumb = {
    name: "x-cover.png",
    bundle: "THUMBNAIL",
    pixelWidth: 300,
    pixelHeight: 425,
    materialization: { state: "materialized", localPath: "library/x-cover.png", note: `${DERIVED_MARKER} of x.pdf` },
  };
  const node = (state: string, localPath?: string) =>
    ({
      id: "item/x",
      kind: "item",
      title: "x",
      bitstreams: [
        { name: "x.pdf", bundle: "ORIGINAL", mediaType: "application/pdf", materialization: { state, ...(localPath ? { localPath } : {}) } },
        thumb,
      ],
    }) as never;

  it("referencedOriginalNoSource", () => {
    const { covers, problems } = coversWanted([node("referenced")], INSTANCE);
    expect(problems).toEqual([]);
    expect(covers.length).toBe(1);
    expect(covers[0]!.sourcePdf).toBeUndefined();
  });

  it("materializedMissingIsProblem", () => {
    const { covers, problems } = coversWanted([node("materialized", "uploads/x/missing.pdf")], INSTANCE);
    expect(covers.length).toBe(0);
    expect(problems.length).toBe(1);
  });
});
