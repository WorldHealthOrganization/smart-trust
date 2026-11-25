/**
 * The checkout's credential reaches a private store repository ONCE, whether
 * it sits in the checkout's local config (`actions/checkout`), the global one
 * (`folio-site-publish.yml`), or both. Before the fix the copy was added on
 * top of the global value the store already reads, and GitHub refused the
 * doubled header: `400 Duplicate header: "Authorization"` (aai-programme run
 * 44484831872, `state:mount --id board`).
 *
 * Real git against a local HTTP server that counts the headers it receives:
 * the doubled header is something git sends, so stubbing git would only test
 * the stub.
 *
 * @module scripts/tests/git-auth-env
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { authEnvFrom, effectiveExtraHeaders, extraHeaderEnv, parseExtraHeaders } from "../lib/git-auth-env.ts";

const LOCAL = "AUTHORIZATION: basic bG9jYWw="; // the checkout's token
const GLOBAL = "AUTHORIZATION: basic Z2xvYmFs"; // the job's global token
/** What the server receives: the header's value. */
const sent = (h: string) => h.slice(h.indexOf(":") + 1).trim();

let server: ReturnType<typeof Bun.serve>;
let seen: string[][] = [];
let tmp: string;

beforeAll(() => {
  tmp = mkdtempSync(join(tmpdir(), "git-auth-env-"));
  server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    // input-site: inert #6e4bbf88 — the handler of a loopback server this test starts; it fetches nothing
    fetch(req) {
      const all: string[] = [];
      req.headers.forEach((v, k) => {
        if (k.toLowerCase() === "authorization") all.push(...v.split(/,\s*(?=basic )/i));
      });
      seen.push(all);
      return new Response("no", { status: 404 });
    },
  });
});

afterAll(() => {
  server.stop(true);
  rmSync(tmp, { recursive: true, force: true });
});

function git(cwd: string, env: NodeJS.ProcessEnv, ...args: string[]) {
  return spawnSync("git", args, { cwd, env, encoding: "utf-8" });
}

/** A HOME (global config), a checkout (local config) and a bare store, as a job lays them out. */
function layout(name: string, where: { local?: boolean; global?: boolean }) {
  const url = `http://127.0.0.1:${server.port}/`;
  const home = join(tmp, name, "home");
  const checkout = join(tmp, name, "checkout");
  const store = join(tmp, name, "store.git");
  mkdirSync(home, { recursive: true });
  const env: NodeJS.ProcessEnv = {
    // input-site: inert #3a51c545 — hands the child git the PATH to find itself on; no assertion reads it
    PATH: process.env.PATH,
    HOME: home,
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_TERMINAL_PROMPT: "0",
    NO_PROXY: "*",
    no_proxy: "*",
  };
  writeFileSync(join(home, ".gitconfig"), where.global ? `[http "${url}"]\n\textraheader = ${GLOBAL}\n` : "");
  git(tmp, env, "init", "-q", checkout);
  if (where.local) git(checkout, env, "config", `http.${url}.extraheader`, LOCAL);
  git(tmp, env, "init", "-q", "--bare", store);
  return { url, env, checkout, store };
}

/** Run `ls-remote` from the store with the carried env, as TreeStore does, and return each request's Authorization headers. */
async function headersSent(where: { local?: boolean; global?: boolean }, name: string): Promise<string[][]> {
  const { url, env, checkout, store } = layout(name, where);
  const carried = { ...env, ...authEnvFrom(checkout, env) };
  seen = [];
  const p = Bun.spawn(["git", `--git-dir=${store}`, "ls-remote", `${url}repo.git`], { env: carried, stdout: "ignore", stderr: "ignore" });
  await p.exited;
  return seen;
}

describe("authEnvFrom carries the credential once", () => {
  test("global only (folio-site-publish.yml): one header, not the global plus a copy", async () => {
    const reqs = await headersSent({ global: true }, "global");
    expect(reqs.length).toBeGreaterThan(0);
    for (const h of reqs) expect(h).toEqual([sent(GLOBAL)]);
  });

  test("local only (actions/checkout): the local header is carried", async () => {
    const reqs = await headersSent({ local: true }, "local");
    expect(reqs.length).toBeGreaterThan(0);
    for (const h of reqs) expect(h).toEqual([sent(LOCAL)]);
  });

  test("both: one header, the local one (higher precedence)", async () => {
    const reqs = await headersSent({ local: true, global: true }, "both");
    expect(reqs.length).toBeGreaterThan(0);
    for (const h of reqs) expect(h).toEqual([sent(LOCAL)]);
  });

  test("neither: no header and no env", async () => {
    const { env, checkout } = layout("none", {});
    expect(authEnvFrom(checkout, env)).toEqual({});
    const reqs = await headersSent({}, "none2");
    for (const h of reqs) expect(h).toEqual([]);
  });
});

describe("the header list", () => {
  test("an empty value clears, a repeat is kept once, only the last Authorization survives", () => {
    const entries = parseExtraHeaders(
      ["http.extraheader X-A: 1", "http.extraheader", "http.extraheader X-B: 2", "http.extraheader X-B: 2", `http.https://github.com/.extraheader ${GLOBAL}`, `http.https://github.com/.extraheader ${LOCAL}`].join("\n"),
    );
    expect(effectiveExtraHeaders(entries)).toEqual([
      { key: "http.extraheader", value: "X-B: 2" },
      { key: "http.https://github.com/.extraheader", value: LOCAL },
    ]);
  });

  test("each key is reset before the headers, after the caller's own entries", () => {
    const env = extraHeaderEnv([{ key: "http.https://github.com/.extraheader", value: GLOBAL }], 2);
    expect(env).toEqual({
      GIT_CONFIG_KEY_2: "http.https://github.com/.extraheader",
      GIT_CONFIG_VALUE_2: "",
      GIT_CONFIG_KEY_3: "http.https://github.com/.extraheader",
      GIT_CONFIG_VALUE_3: GLOBAL,
      GIT_CONFIG_COUNT: "4",
    });
  });
});
