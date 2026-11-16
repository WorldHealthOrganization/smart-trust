/**
 * A layer's release addresses: where its identifiers live for the major
 * version it declares.
 *
 * @module schemas/release-iri
 * @graphNode schema
 *
 * ## One form, the major (owner, 2026-10-23, option "B. Major in address")
 *
 * Every address carries the MAJOR only — `<iriBase>v<major>/` — whoever reads
 * it: a namespace, a schema `$id`, a BPMN `xmlns`, a JSON-LD `@id`, and a page
 * a person reads alike.
 *
 * | audience | form | example (bootstrap `0.1.1`) |
 * |---|---|---|
 * | an agent or program — a namespace, a schema `$id`, a BPMN `xmlns` | `<iriBase>v<major>/` | `…/bootstrap/v0/ns/` |
 * | a person — a page to read | `<iriBase>v<major>/` | `…/bootstrap/v0/` |
 *
 * The exact release a reader gets is fixed by its PIN (`index.lock.json`, the
 * `needs` pins), which already names the commit, not by the address. This is
 * the promise a `$schema` tag already makes ({@link tagCompatible}: any tag of
 * the same major reads): within a major, a minor or patch adds and never
 * breaks, so only a breaking change — a new major — changes an address.
 *
 * Before this ruling (owner, 2026-09-29) the program-read form carried the
 * full semver, so every patch rewrote about a thousand literal copies across
 * the layers for no reader's benefit. `agent` and `human` are both kept so a
 * caller still says which audience it means; they are equal by the ruling.
 *
 * ## Derived, never typed
 *
 * `iriBase` and `version` are written once, in the layer's declaration.
 * Everything here is computed from them; a generator or template that needs
 * an address asks {@link releaseIris} (or reads the `release` variable it is
 * handed) instead of spelling one out. The copies that cannot be computed at
 * read time — an `xmlns` attribute in 70 BPMN files, a value in a code list —
 * are kept at the declared major by `scripts/iri-sync.ts`, whose `--check`
 * is a gate.
 */
import { join } from "node:path";

import { readKnowledgeGraphDeclaration } from "./declaration.ts";

/** MAJOR.MINOR.PATCH, nothing else: no ranges, no pre-release, no `v`. */
export const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

/** A layer's release, as both audiences address it. */
export interface ReleaseIris {
  /** The declared `iriBase`, ending in `/`. */
  readonly iriBase: string;
  /** The declared version, `MAJOR.MINOR.PATCH`. */
  readonly version: string;
  /** `MAJOR` alone, as a number. */
  readonly major: number;
  /** `<iriBase>v<major>/` — what a program reads (owner, 2026-10-23: the major, not the full version). */
  readonly agent: string;
  /** `<iriBase>v<major>/` — what a person reads; the same address as {@link agent}. */
  readonly human: string;
}

/** The release addresses a declaration implies, or `undefined` when it declares no `iriBase`. */
export function releaseIris(decl: { iriBase?: string; version?: string } | undefined): ReleaseIris | undefined {
  if (!decl?.iriBase) return undefined;
  const version = decl.version ?? "";
  const m = SEMVER.exec(version);
  if (!m) {
    throw new Error(`an iriBase needs a MAJOR.MINOR.PATCH version to mint against; found ${JSON.stringify(decl.version)}`);
  }
  const iriBase = decl.iriBase.endsWith("/") ? decl.iriBase : `${decl.iriBase}/`;
  const major = Number(m[1]);
  const at = `${iriBase}v${major}/`;
  return { iriBase, version, major, agent: at, human: at };
}

/** One path under a release, for the audience that will read it. */
export function releaseIri(r: ReleaseIris, path: string, audience: "agent" | "human"): string {
  return `${audience === "agent" ? r.agent : r.human}${path.replace(/^\/+/, "")}`;
}

/**
 * bootstrap's release, read from its declaration. `bootstrapDir` is the
 * bootstrap checkout: beside bootstrap-tools here, and wherever a consumer
 * put it after the split — a caller that knows passes it.
 */
export function bootstrapRelease(bootstrapDir: string = join(import.meta.dir, "..", "..", "bootstrap")): ReleaseIris {
  const r = releaseIris(readKnowledgeGraphDeclaration(bootstrapDir));
  if (!r) throw new Error("bootstrap/bootstrap.json declares no iriBase");
  return r;
}

/**
 * Does a `$schema` tag name this schema at a version a reader of `major`
 * understands? Semver's promise: within one major version, a newer minor or
 * patch adds and never breaks.
 */
export function tagCompatible(tag: unknown, name: string, major: number): boolean {
  if (typeof tag !== "string" || !tag.startsWith(`${name}/`)) return false;
  const m = SEMVER.exec(tag.slice(name.length + 1));
  return m !== null && Number(m[1]) === major;
}
