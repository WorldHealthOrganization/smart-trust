import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { coverStateOf } from "../../library-covers.ts";
import { avatarOf, COVER_FILENAME } from "../../library-graph.ts";

describe("an entry's cover is page 1 of its held PDF (owner, 2026-10-16)", () => {
  const repo = mkdtempSync(join(tmpdir(), "lib-cover-"));
  mkdirSync(join(repo, "lib", "e1", "images"), { recursive: true });
  mkdirSync(join(repo, "uploads"), { recursive: true });
  writeFileSync(join(repo, "uploads", "e1.pdf"), "%PDF");
  writeFileSync(join(repo, "uploads", "e2.docx"), "x");
  const up = [
    { kind: "file" as const, path: "uploads/e1.pdf", ingestedBy: "e1", docId: "e1" },
    { kind: "file" as const, path: "uploads/e2.docx", ingestedBy: "e2", docId: "e2" },
  ];
  const e = (id: string, sourceFile: string) => ({ id, dir: `lib/${id}`, sourceFile, sourceSha256: "" });

  test("only a held, unwithheld PDF can have one rendered", () => {
    expect(coverStateOf(repo, e("e1", "e1.pdf"), up)).toEqual({ state: "missing", pdf: "uploads/e1.pdf", cover: "lib/e1/cover.png" });
    expect(coverStateOf(repo, e("e2", "e2.docx"), up).state).toBe("not-pdf");
    expect(coverStateOf(repo, e("e3", "e3.pdf"), up).state).toBe("not-held");
    expect(coverStateOf(repo, { ...e("e1", "e1.pdf"), withheld: true }, up).state).toBe("withheld");
    writeFileSync(join(repo, "lib", "e1", COVER_FILENAME), "png");
    expect(coverStateOf(repo, e("e1", "e1.pdf"), up).state).toBe("present");
  });

  test("the avatar is the rendered cover before any figure", () => {
    writeFileSync(join(repo, "lib", "e1", "images", "fig.png"), "png");
    const images = { images: [{ role: "figure", file: "images/fig.png" }] };
    expect(avatarOf(join(repo, "lib"), "inst", "e1", images, repo)).toEqual({
      href: "/assets/library/avatars/inst/e1.png",
      src: "lib/e1/cover.png",
      source: "cover",
    });
  });

  test("a PDF with no cover gets no avatar, never its first figure (owner, 2026-10-30)", () => {
    mkdirSync(join(repo, "lib", "e4", "images"), { recursive: true });
    writeFileSync(join(repo, "lib", "e4", "images", "fig.png"), "png");
    const images = { images: [{ role: "figure", file: "images/fig.png" }] };
    expect(avatarOf(join(repo, "lib"), "inst", "e4", images, repo, "e4.pdf")).toBeUndefined();
    // A source that is not a PDF has no page 1 to render, so its figure still serves.
    expect(avatarOf(join(repo, "lib"), "inst", "e4", images, repo, "e4.docx")?.source).toBe("figure");
    expect(avatarOf(join(repo, "lib"), "inst", "e4", images, repo)?.source).toBe("figure");
  });
});
