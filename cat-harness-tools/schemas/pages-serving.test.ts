/**
 * The pages-serving observation (bean `folio-assistant-1dre`): what a CI job
 * with egress saw of the published site, read offline by `pages-publish-health`.
 */
import { describe, expect, test } from "bun:test";

import { PAGES_SERVING_SCHEMA, PagesServingObservationSchema } from "./sdlc/health-report.js";

const ok = {
  $schema: PAGES_SERVING_SCHEMA,
  observedAt: "2026-10-11T06:00:00Z",
  site: "https://litlfred.github.io/folio-assistant/",
  urls: [{ url: "https://litlfred.github.io/folio-assistant/", status: 200, bytes: 18000, expectedPage: true }],
};

describe("PagesServingObservationSchema", () => {
  test("a dated observation of at least one URL parses", () => {
    expect(PagesServingObservationSchema.parse(ok).urls).toHaveLength(1);
  });

  test("an observation of nothing is refused — it would count as an instrument over no evidence", () => {
    expect(PagesServingObservationSchema.safeParse({ ...ok, urls: [] }).success).toBe(false);
  });

  test("an undated observation is refused — staleness is judged from the date", () => {
    const { observedAt: _drop, ...undated } = ok;
    expect(PagesServingObservationSchema.safeParse(undated).success).toBe(false);
    expect(PagesServingObservationSchema.safeParse({ ...ok, observedAt: "yesterday" }).success).toBe(false);
  });

  test("Pages' own 404 is expressible apart from the status", () => {
    const r = PagesServingObservationSchema.parse({
      ...ok,
      urls: [{ url: "https://litlfred.github.io/folio-assistant/STAGING/x/", status: 404, bytes: 9000, expectedPage: false }],
    });
    expect(r.urls[0]!.expectedPage).toBe(false);
  });

  test("an unknown field is refused, so a writer's typo cannot pass silently", () => {
    expect(PagesServingObservationSchema.safeParse({ ...ok, observed_at: ok.observedAt }).success).toBe(false);
  });
});
