/**
 * The PlantUML jar download retries (a layer's PR, 2026-11-17): one refused
 * request to Maven Central failed `uml:overview` on a head whose diagrams it had
 * nothing to do with, and the log said only "could not fetch".
 */
import { describe, expect, test } from "bun:test";

import { fetchWithRetry } from "../plantuml-render.ts";

const noDelay = () => 0;

describe("fetchWithRetry", () => {
  test("a refused request then a good one returns the bytes", async () => {
    let calls = 0;
    const got = await fetchWithRetry("https://example.test/a.jar", {
      delayMs: noDelay,
      fetchImpl: async () => {
        calls++;
        if (calls === 1) throw new Error("ECONNREFUSED");
        return new Response("jar-bytes");
      },
    });
    expect(calls).toBe(2);
    expect("bytes" in got && got.bytes.toString()).toBe("jar-bytes");
  });

  test("every attempt failing returns the last reason and the attempt count", async () => {
    let calls = 0;
    const got = await fetchWithRetry("https://example.test/a.jar", {
      tries: 3,
      delayMs: noDelay,
      fetchImpl: async () => {
        calls++;
        return new Response("", { status: 503, statusText: "Service Unavailable" });
      },
    });
    expect(calls).toBe(3);
    expect(got).toEqual({ error: "HTTP 503 Service Unavailable after 3 attempt(s)" });
  });
});
