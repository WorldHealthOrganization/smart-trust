import { describe, expect, test } from "bun:test";

import { dspaceToRecord, fetchItem, licenceFromRecord } from "./fetch-dspace-item.ts";

// The shape WHO IRIS returned for 10665/340749 on 2026-10-06, cut down.
const META = {
  "dc.title": [{ value: "Leave no one behind: guidance for planning and implementing catch-up vaccination", language: "en", authority: null }],
  "dc.identifier.isbn": [
    { value: "9789240016514 (electronic version)", language: "", authority: null },
    { value: "9789240016521 (print version)", language: "", authority: null },
  ],
  "dc.identifier.uri": [{ value: "https://iris.who.int/handle/10665/340749", language: null, authority: null }],
  "dc.rights": [{ value: "CC BY-NC-SA 3.0 IGO", language: "", authority: null }],
  "dc.rights.uri": [{ value: "https://creativecommons.org/licenses/by-nc-sa/3.0/igo", language: null, authority: null }],
  "dc.subject.mesh": [{ value: "Vaccination", language: "en", authority: "D014611" }],
  "dc.description": [{ value: "  ", language: null, authority: null }],
};

describe("dspaceToRecord", () => {
  const rec = dspaceToRecord("58333fc5-9ec5-4d14-b341-5ae257dd0ad1", META, "https://iris.who.int/server/api/core/items/x", "2026-10-06T00:00:00Z");
  test("qualifiedNamesSplit", () => {
    expect(rec.fields.find((f) => f.element === "identifier" && f.qualifier === "isbn")?.values.length).toBe(2);
  });
  test("emptyLanguageAuthorityAbsent", () => {
    const isbn = rec.fields.find((f) => f.qualifier === "isbn")!.values[0]!;
    expect("language" in isbn).toBe(false);
    expect(rec.fields.find((f) => f.qualifier === "mesh")!.values[0]!.authority).toBe("D014611");
  });
  test("blankOnlyFieldDropped", () => {
    expect(rec.fields.some((f) => f.element === "description")).toBe(false);
  });
});

describe("licenceFromRecord", () => {
  const url = "https://iris.who.int/items/58333fc5";
  test("recognisedRightsStated", () => {
    const l = licenceFromRecord(dspaceToRecord("u", META, "s", "t"), url);
    expect(l.status).toBe("stated");
    expect(l.id).toBe("CC-BY-NC-SA-3.0-IGO");
    expect(l.basis).toContain("dc.rights = 'CC BY-NC-SA 3.0 IGO'");
  });
  test("nearMissNotMapped", () => {
    const l = licenceFromRecord(dspaceToRecord("u", { ...META, "dc.rights": [{ value: "CC BY-NC-SA 3.0" }] }, "s", "t"), url);
    expect(l.status).toBe("unknown");
    expect(l.searched?.[0]?.result).toContain("not a licence this recognises");
  });
  test("noRightsUnknown", () => {
    const { "dc.rights": _r, ...rest } = META;
    expect(licenceFromRecord(dspaceToRecord("u", rest, "s", "t"), url).searched?.[0]?.where).toContain("dc.rights");
  });
});

describe("fetchItem destination checks (bean folio-core-xpsq)", () => {
  const UUID = "58333fc5-9ec5-4d14-b341-5ae257dd0ad1";
  const HANDLE_URL = "https://iris.who.int/handle/10665/340749";

  test("refusesBadHandleUrl", async () => {
    const neverCalled: typeof fetch = (async () => {
      throw new Error("should not be called");
    }) as unknown as typeof fetch;

    await expect(
      fetchItem("http://iris.who.int/handle/10665/340749", new Date(), neverCalled),
    ).rejects.toThrow(/https:/i);

    await expect(
      fetchItem("https://evil.example/handle/10665/340749", new Date(), neverCalled),
    ).rejects.toThrow(/unexpected host/i);
  });

  test("refusesForeignBitstreamHref", async () => {
    const makeStub = (contentHref: string): typeof fetch =>
      (async (input: string | URL | Request) => {
        const u = String(input);
        if (u === HANDLE_URL) {
          return new Response(null, {
            status: 302,
            headers: { location: `https://iris.who.int/items/${UUID}` },
          });
        }
        if (u === `https://iris.who.int/server/api/core/items/${UUID}`) {
          return Response.json({ metadata: META });
        }
        if (u === `https://iris.who.int/server/api/core/items/${UUID}/bundles`) {
          return Response.json({
            _embedded: {
              bundles: [
                {
                  name: "ORIGINAL",
                  _links: {
                    bitstreams: {
                      href: `https://iris.who.int/server/api/core/bundles/b1/bitstreams`,
                    },
                  },
                },
              ],
            },
          });
        }
        if (u === "https://iris.who.int/server/api/core/bundles/b1/bitstreams") {
          return Response.json({
            _embedded: {
              bitstreams: [
                {
                  name: "9789240016514-eng.pdf",
                  _links: { content: { href: contentHref } },
                },
              ],
            },
          });
        }
        throw new Error(`unexpected fetch to ${u}`);
      }) as unknown as typeof fetch;

    await expect(
      fetchItem(
        HANDLE_URL,
        new Date("2026-10-06T00:00:00Z"),
        makeStub("http://169.254.169.254/latest/meta-data/"),
      ),
    ).rejects.toThrow(/https:/i);

    await expect(
      fetchItem(
        HANDLE_URL,
        new Date("2026-10-06T00:00:00Z"),
        makeStub("https://evil.example/9789240016514-eng.pdf"),
      ),
    ).rejects.toThrow(/unexpected host/i);
  });

  test("refusesForeignRedirect", async () => {
    const redirectStub: typeof fetch = (async (input: string | URL | Request) => {
      const u = String(input);
      if (u === HANDLE_URL) {
        return new Response(null, {
          status: 302,
          headers: { location: `/items/${UUID}` },
        });
      }
      if (u === `https://iris.who.int/server/api/core/items/${UUID}`) {
        return Response.json({ metadata: META });
      }
      if (u === `https://iris.who.int/server/api/core/items/${UUID}/bundles`) {
        return Response.json({
          _embedded: {
            bundles: [
              {
                name: "ORIGINAL",
                _links: {
                  bitstreams: {
                    href: "https://iris.who.int/server/api/core/bundles/b1/bitstreams",
                  },
                },
              },
            ],
          },
        });
      }
      if (u === "https://iris.who.int/server/api/core/bundles/b1/bitstreams") {
        return Response.json({
          _embedded: {
            bitstreams: [
              {
                name: "9789240016514-eng.pdf",
                _links: {
                  content: {
                    href: "https://iris.who.int/server/api/core/bitstreams/bs1/content",
                  },
                },
              },
            ],
          },
        });
      }
      if (u === "https://iris.who.int/server/api/core/bitstreams/bs1/content") {
        return new Response(null, {
          status: 302,
          headers: { location: "https://evil.example/payload.pdf" },
        });
      }
      throw new Error(`unexpected fetch to ${u}`);
    }) as unknown as typeof fetch;

    await expect(
      fetchItem(HANDLE_URL, new Date("2026-10-06T00:00:00Z"), redirectStub),
    ).rejects.toThrow(/unexpected host/i);
  });
});
