/**
 * A web app a layer holds as source and publishes as a page of its own: one
 * `web-app.json` at the root of a directory of kind `web-app`.
 *
 * @graphNode schema
 * @module schemas/web-app
 *
 * ## Why a kind, and not an app per repository
 *
 * Owner, 2026-11-11 (cards Q-GAME-5 A and Q-GAME-7 A): a content layer that
 * carries an interactive app (the GDHCN onboarding game in smart-trust) must
 * not become a harness to publish it, and the one-off route the VaxLink app
 * used (`web/` + its own `publish.sh` + `site.build.keep`) is retired. So the
 * harness owns the kind and one visualiser over it (`apps`, rendered by the
 * `web-app-build` Tool), and a layer only declares the directory.
 *
 * | field | what |
 * |---|---|
 * | `id` | the app's URL segment under the visualiser: `<locale>/<harness>/apps/<id>/` |
 * | `title`, `description` | what the `apps` index lists |
 * | `build` | how to install and build it, and where the build lands (`dist/` by default) |
 * | `chrome` | always `none`: the app draws its own frame, so its pages carry the navbar opt-out |
 * | `locales` | the languages it ships, BCP 47; the site's locales are the target |
 * | `contentFrom` | the layer's own directory ids it reads at build time, so a change there rebuilds it |
 * | `sizeBudgetMB` | the size its build may reach before the size review flags it |
 * | `license`, `source` | an SPDX id and where the code came from, for a copied app |
 *
 * ## Loaded only when opened
 *
 * The app is its own route. No other page embeds it or loads its scripts: a
 * tile, an IG page or a journey links to it, and only a reader who opens the
 * route downloads it. Inside the app, splitting heavy parts behind a dynamic
 * `import()` is the app's own business.
 */
import { z } from "zod";

import { nodeKind } from "../kg/node-kind.ts";

export const WEB_APP_V01 = "web-app/0.1.0";

/** The file a `web-app` directory holds at its root. */
export const WEB_APP_FILE = "web-app.json";

/** An app id: lower-case kebab, so it is a route segment as it stands. */
export const WebAppId = z.string().regex(/^[a-z0-9][a-z0-9-]*$/, "an app id is lower-case kebab");
const Text = z.string().min(1);
/** A path inside the app's directory: relative, never climbing out. */
const InnerPath = z
  .string()
  .min(1)
  .refine((p) => !p.startsWith("/") && !p.split("/").includes(".."), "a path inside the app, relative, with no `..`");

/** The package managers the build Tool knows how to run, by the lockfile they read. */
export const INSTALLERS = ["npm", "bun"] as const;

export const WebAppBuildSchema = z
  .object({
    /** Which installer reads the lockfile: `npm ci` or `bun install --frozen-lockfile`. */
    installer: z.enum(INSTALLERS).default("npm"),
    /** The `package.json` script that builds it. */
    // input-site: inert #383ca95b — the default NAME of the app's own package.json build script, written into the node; nothing here reads a build output
    script: z.string().regex(/^[a-z0-9:_-]+$/).default("build"),
    /** Where the build writes, relative to the app's directory. */
    // input-site: inert #86fd5190 — the default directory the app's own build writes to, written into the node; nothing here reads it
    outDir: InnerPath.default("dist"),
  })
  .strict();

/** `web-app/0.1.0`, as a node kind. */
export const WebAppKind = nodeKind(
  WEB_APP_V01,
  [],
  {
    id: WebAppId,
    title: Text,
    description: Text,
    // input-site: inert #6f3e26dd — the same two defaults, as the node's default build block; nothing here reads a build output
    build: WebAppBuildSchema.default({ installer: "npm", script: "build", outDir: "dist" }),
    /** The app draws its own frame. Only `none` is defined: an app inside the site's chrome is a page, not an app. */
    chrome: z.literal("none").default("none"),
    /** BCP 47 tags of the languages it ships. */
    locales: z.array(z.string().regex(/^[a-z]{2,3}(-[A-Za-z0-9]+)*$/)).min(1),
    /**
     * Its UI strings, translated through the harness's translation process
     * (`multi-locale-translation`, `translation-refresh`) like any other
     * template: `catalog` is a flat JSON object `{ key: text }` in the first of
     * `locales`; `web-apps:build --extract` writes it to
     * `translations/<locale>/apps/<id>.pot` in the declaring layer; the build
     * writes each locale's translated strings to `<out>/<locale>.json` before
     * the app builds, so building IS the injection. The app falls back to the
     * source text per string.
     */
    i18n: z.object({ catalog: InnerPath, out: InnerPath }).strict().optional(),
    /** The declaring layer's directory ids it reads at build time. */
    contentFrom: z.array(z.string().min(1)).default([]),
    /** The size its build may reach, in MB, before the size review flags it. */
    sizeBudgetMB: z.number().positive().optional(),
    /** SPDX licence id of the app's code. */
    license: Text.optional(),
    /** Where a copied app came from: a repository URL and commit. */
    source: z.object({ repository: z.string().url(), commit: z.string().regex(/^[0-9a-f]{7,40}$/) }).strict().optional(),
  },
  { strict: true },
);
export const WebAppSchema = WebAppKind.schema;
export type WebApp = z.infer<typeof WebAppSchema>;

/** Parse a `web-app.json`; throws with every issue. */
export function parseWebApp(raw: unknown, where = WEB_APP_FILE): WebApp {
  const r = WebAppSchema.safeParse(raw);
  if (!r.success) throw new Error(`${where}: ${r.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ")}`);
  return r.data;
}

/** The install command for an app's installer, as argv. */
export function installCommand(app: WebApp): string[] {
  return app.build.installer === "bun" ? ["bun", "install", "--frozen-lockfile"] : ["npm", "ci", "--no-audit", "--no-fund"];
}

/** The build command for an app, as argv. */
export function buildCommand(app: WebApp): string[] {
  return app.build.installer === "bun" ? ["bun", "run", app.build.script] : ["npm", "run", app.build.script];
}
