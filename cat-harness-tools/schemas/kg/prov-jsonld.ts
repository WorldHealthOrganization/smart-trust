/**
 * PROV activities as PROV-JSONLD — links, not strings.
 *
 * PROV-O defines `prov:agent`, `prov:hadRole` and `prov:hadPlan` as object
 * properties; emitted as bare strings they expand to literals and nothing
 * joins an activity to its actor. The `linked-data` voice (in the content
 * core's `skills/voices/linked-data`) states the rules this module follows;
 * each is cited there to the held W3C text.
 *
 * ## What it emits
 *
 * PROV-JSONLD's shape (W3C Member Submission 2024-08-25, held at
 * `cat-harness/library/corpus/kg/w3c-2024-prov-jsonld/`): an `Activity` node, and
 * each qualified association as its own `Association` node whose `activity`,
 * `agent`, `role` and `plan` are the context's TERMS — so its coercions and
 * its `@reverse` mapping to `prov:qualifiedAssociation` apply (rule
 * `ld-coercion-belongs-to-the-term`).
 *
 * ## Where a link points
 *
 * At the node's release address, the rule `check:node-iris` enforces:
 * `<iriBase>v<major>/<path in its knowledge graph>[/<node>]`, read through
 * the OWNING layer's declaration (`releaseIris`). An actor is
 * `scenarios/actors/<id>`, a role `scenarios/roles/<id>`, a plan step
 * `<dir>/<process file stem>/<task>`. A node inside a document is a path
 * segment under it, never a `#` fragment, so each has its own page.
 *
 * **Three states, never two.** When the owner is found and declares an
 * `iriBase`, the value is a link. Otherwise the value stays a LITERAL —
 * written as an explicit `{"@value": …}` so the term's coercion cannot turn
 * it into a relative IRI — and the reason is returned, for the report to
 * carry as a finding (rule `ld-link-is-the-node-release-address`).
 *
 * `prov:used` values are catalogue items (`item/<uuid>`, a DSpace id), each
 * linked at its record's HANDLE through the global resolver
 * (`https://hdl.handle.net/<handle>`), which outlives the publishing host. A
 * record with no Handle, or an id nobody catalogues, stays a literal with its
 * reason.
 *
 * A decision record's agreement and grant are `prov:used` entities already
 * described as absolute IRIs — the agreement's DCAT 3 `dcat:Distribution`
 * with its `spdx:checksum`, and the grant's W3C VC 2.0 credential `id` — so
 * they are emitted as they are, under the `dcat`, `spdx` and `cred` prefixes.
 *
 * The hash-chain terms `cat-harness:previousHash` / `cat-harness:recordHash`
 * are a **local extension** — no open standard defines a hash-chained PROV
 * log. A document that uses them also describes each in its `@graph` as an
 * `rdf:Property` with an `rdfs:comment` saying so.
 *
 * @module schemas/prov-jsonld
 * @graphNode schema
 * @conformsTo w3c-prov-jsonld
 * @conformsTo ietf-handle-system
 * @covers schemas
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join, relative } from "node:path";

import { releaseIris, releaseIri } from "@litlfred/bootstrap-tools/schemas/release-iri.ts";
import { instanceDirectoryForGraph, layerRootsIn, readDeclaration } from "./cat-harness.ts";
import { CAT_HARNESS_NS, FOLIO_BASE } from "./namespaces.ts";
import { CRED_NS, DCAT_NS, PROV_CONTEXT, PROV_LOCAL_EXTENSION_TERMS, SPDX_NS, type ProvActivity } from "../content/prov.ts";

/**
 * Where the PROV-JSONLD context is published — the address the owner
 * downloaded it from on 2026-10-01. Documents name it; nothing fetches it.
 * Defined in `prov.ts` (the lower layer) and re-exported here by name.
 */
export const PROV_JSONLD_CONTEXT_URL = PROV_CONTEXT;

/**
 * The held copy, pinned by sha256 (rule `ld-no-context-fetched-at-run-time`).
 * Repository-relative. The submission lists `context.jsonld` among its own
 * files, so the copy sits in its library entry.
 */
export const PROV_JSONLD_CONTEXT_HELD = {
  // declared-path-literal: a PINNED copy, addressed with its sha256; the pin is to the bytes at
  // exactly this path, so resolving the directory through a declaration would unpin it.
  path: "cat-harness/library/corpus/kg/w3c-2024-prov-jsonld/context.jsonld",
  // declared-path-literal: the same pinned bytes where a harness from before the library sub-graph
  // (owner, 2026-11-04) keeps them. Transitional: remove once the move is on every pin.
  legacyPath: "cat-harness/library/kg/w3c-2024-prov-jsonld/context.jsonld",
  sha256: "811d5e94d8cb568d7dc4461ef6a247644dd0e775cdc88b65c42238d8e832be1e",
} as const;

/** The `$schema` a catalogue record declares itself with. */
const CATALOGUE_NODE_SCHEMA = "folio-catalogue-node/v1";

/** The `$schema` a tool release record declares itself with. */
const TOOL_RELEASE_SCHEMA = "folio-tool-release/v1";

/** The global Handle System resolver. */
const HANDLE_RESOLVER = "https://hdl.handle.net/";

export type AddressKind = "agent" | "role" | "plan" | "entity";

/** A value's address, or why it has none. */
export type Address = { iri: string } | { unaddressed: string };

export interface AddressBook {
  resolve(kind: AddressKind, value: string): Address;
  /**
   * The value's SUBJECT in its owner's published knowledge graph — the page
   * `<doc dir>/<kind>/<id>` serves — or `undefined` when there is none to
   * name. An agent is its `actor`, a role its `role`, a plan `stem#task` the
   * task's `process/<P>/node/<task>` (issue #959). Optional: a book that
   * cannot mint subjects publishes only the release addresses.
   */
  subject?(kind: AddressKind, value: string): string | undefined;
}

/** Mints a subject IRI in the published document of the layer at `root`. */
export type SubjectMinter = (root: string, kind: "actor" | "role" | "process", id: string) => string | undefined;

/**
 * The id of the BPMN process in `xml` that holds the element `taskId`, or
 * `undefined`. A collaboration's processes are each their own
 * `<bpmn:process>` element, so the task's process is the one whose body
 * declares the id.
 */
export function processHolding(xml: string, taskId: string): string | undefined {
  const at = xml.indexOf(`id="${taskId}"`);
  if (at === -1) return undefined;
  let holder: { id: string; end: number } | undefined;
  for (const m of xml.slice(0, at).matchAll(/<(?:[\w-]+:)?process\b[^>]*\bid="([^"]+)"[^>]*>/g)) {
    holder = { id: m[1]!, end: m.index! + m[0].length };
  }
  if (!holder) return undefined;
  // Closed before the task: the task sits outside every process.
  return /<\/(?:[\w-]+:)?process>/.test(xml.slice(holder.end, at)) ? undefined : holder.id;
}

interface Owned {
  /** Layer root, absolute. */
  root: string;
  /** Path inside the layer, without extension, `/`-separated. */
  path: string;
  fragment?: string;
  /** The file itself, absolute (plans only). */
  file?: string;
}

function* filesUnder(dir: string, ext: string): Generator<string> {
  if (!existsSync(dir)) return;
  for (const e of readdirSync(dir)) {
    if (e === "node_modules" || e.startsWith(".")) continue;
    const p = join(dir, e);
    const st = statSync(p);
    if (st.isDirectory()) yield* filesUnder(p, ext);
    else if (e.endsWith(ext)) yield p;
  }
}

const rel = (root: string, file: string): string => relative(root, file).split("\\").join("/").replace(/\.[^/.]+$/, "");

/**
 * The address book for a checkout: who owns each actor, role and process, and
 * at what release address. Built once; nested layers are their own owners
 * (`layerRootsIn`), so a process file is attributed to the DEEPEST layer
 * holding it.
 */
export function addressBook(repo: string, mint?: SubjectMinter): AddressBook {
  const roots = layerRootsIn(repo).sort((a, b) => b.length - a.length);
  const owner = (file: string): string | undefined => roots.find((r) => file.startsWith(`${r}/`));
  const actors = new Map<string, Owned>();
  const roles = new Map<string, Owned>();
  const plans = new Map<string, Owned>();

  for (const root of roots) {
    // The layer's own declared `scenarios` graph, never a composed path:
    // a layer that declares none holds no actors or roles to address.
    const scenarios = instanceDirectoryForGraph(root, "scenarios");
    if (!scenarios) continue;
    const actorDir = join(scenarios, "actors");
    for (const f of existsSync(actorDir) ? readdirSync(actorDir).filter((x) => x.endsWith(".json")) : []) {
      const id = basename(f, ".json");
      if (!actors.has(id)) actors.set(id, { root, path: rel(root, join(actorDir, f)) });
    }
    const rolesFile = join(scenarios, "roles.json");
    if (existsSync(rolesFile)) {
      const doc = JSON.parse(readFileSync(rolesFile, "utf-8")) as { roles?: { id?: string }[] };
      for (const r of doc.roles ?? []) if (r.id && !roles.has(r.id)) roles.set(r.id, { root, path: rel(root, rolesFile), fragment: r.id });
    }
  }
  // `prov:used` names catalogue items (`item/<uuid>`, a DSpace id). Each
  // layer's declared `catalogue` graph holds `folio-catalogue-node/v1`
  // records; one with a Handle is addressed at the global Handle resolver,
  // the identifier that outlives the publishing host (owner 2026-10-01,
  // option A). The same rule as `handleIri` in the content core's
  // catalogue schema, restated because importing it here would be an edge
  // from the platform up into core.
  const entities = new Map<string, Address>();
  for (const root of roots) {
    const dir = instanceDirectoryForGraph(root, "catalogue");
    if (!dir) continue;
    for (const f of filesUnder(dir, ".json")) {
      let n: { $schema?: unknown; id?: unknown; handle?: unknown };
      try {
        n = JSON.parse(readFileSync(f, "utf-8")) as typeof n;
      } catch {
        continue;
      }
      if (n.$schema !== CATALOGUE_NODE_SCHEMA || typeof n.id !== "string" || entities.has(n.id)) continue;
      entities.set(
        n.id,
        typeof n.handle === "string"
          ? { iri: `${HANDLE_RESOLVER}${n.handle}` }
          : { unaddressed: `catalogue record ${rel(repo, f)} carries no Handle` },
      );
    }
  }

  for (const f of filesUnder(repo, ".bpmn")) {
    const root = owner(f);
    if (!root) continue;
    const stem = basename(f, ".bpmn").toLowerCase();
    if (!plans.has(stem)) plans.set(stem, { root, path: rel(root, f), file: f });
  }

  const addressOf = (o: Owned, fragment?: string): Address => {
    const decl = readDeclaration(o.root);
    const r = releaseIris(decl ?? undefined);
    if (!r) return { unaddressed: `${decl?.name ?? basename(o.root)} declares no iriBase, so ${o.path} has no release address` };
    const frag = fragment ?? o.fragment;
    return { iri: `${releaseIri(r, o.path, "agent")}${frag ? `/${frag}` : ""}` };
  };

  // `prov:used` also names tool releases (`<name>@<version>` or
  // `tool-releases/<stem>`) from a layer's declared `tool-release` graph
  // (issue #2481, bean `3sbm`, step 3 of `docs/proposals/tool-releases-2026-10-07.md`).
  for (const root of roots) {
    const dir = instanceDirectoryForGraph(root, "tool-release");
    if (!dir) continue;
    for (const f of filesUnder(dir, ".json")) {
      if (f.endsWith(".profile.json")) continue;
      let n: { $schema?: unknown; name?: unknown; version?: unknown };
      try {
        n = JSON.parse(readFileSync(f, "utf-8")) as typeof n;
      } catch {
        continue;
      }
      if (n.$schema !== TOOL_RELEASE_SCHEMA || typeof n.name !== "string" || typeof n.version !== "string") continue;
      const addr = addressOf({ root, path: rel(root, f) });
      const ref = `${n.name}@${n.version}`;
      if (!entities.has(ref)) entities.set(ref, addr);
      const pathKey = rel(root, f);
      if (!entities.has(pathKey)) entities.set(pathKey, addr);
    }
  }

  return {
    resolve(kind, value) {
      if (kind === "agent") {
        const o = actors.get(value);
        return o ? addressOf(o) : { unaddressed: `no instance in this checkout declares actor "${value}"` };
      }
      if (kind === "role") {
        const o = roles.get(value);
        return o ? addressOf(o) : { unaddressed: `no instance in this checkout declares role "${value}"` };
      }
      if (kind === "entity") {
        return entities.get(value) ?? { unaddressed: `no instance in this checkout catalogues "${value}"` };
      }
      const [stem, task] = value.split("#") as [string, string | undefined];
      const o = plans.get(stem.toLowerCase());
      return o ? addressOf(o, task) : { unaddressed: `no .bpmn named ${stem} in this checkout` };
    },
    ...(mint
      ? {
          subject(kind: AddressKind, value: string): string | undefined {
            if (kind === "agent") {
              const o = actors.get(value);
              return o ? mint(o.root, "actor", value) : undefined;
            }
            if (kind === "role") {
              const o = roles.get(value);
              return o ? mint(o.root, "role", value) : undefined;
            }
            if (kind !== "plan") return undefined;
            const [stem, task] = value.split("#") as [string, string | undefined];
            const o = plans.get(stem.toLowerCase());
            if (!o?.file || !task) return undefined;
            const pid = processHolding(readFileSync(o.file, "utf-8"), task);
            return pid ? mint(o.root, "process", `${pid}/node/${task}`) : undefined;
          },
        }
      : {}),
  };
}

/** One unaddressed value, for the report to carry as a finding. */
export interface Unaddressed {
  activity: string;
  kind: AddressKind;
  value: string;
  why: string;
}

/**
 * An address book's verdict as JSON-LD: a link (`{"@id"}` under a term that
 * coerces, so a plain string) or an explicit literal that the coercion cannot
 * touch.
 */
function valueFor(a: Address, raw: string): string | { "@value": string } {
  return "iri" in a ? a.iri : { "@value": raw };
}

/**
 * The PROV-JSONLD document for one report. `@base` sits in the document's OWN
 * context, not the remote one, where JSON-LD 1.1 §4.1.3 says it is ignored
 * (rule `ld-no-base-in-a-remote-context`). `cat-harness:underPolicy` is defined
 * as a term so its absolute policy IRIs are links rather than strings.
 */
export function provJsonldDocument(
  id: string,
  activities: readonly ProvActivity[],
  book: AddressBook,
): { document: Record<string, unknown>; unaddressed: Unaddressed[] } {
  const unaddressed: Unaddressed[] = [];
  const graph: Record<string, unknown>[] = [];
  for (const a of activities) {
    const q = a["prov:qualifiedAssociation"];
    const field = (kind: AddressKind, raw: string) => {
      const ad = book.resolve(kind, raw);
      if ("unaddressed" in ad) unaddressed.push({ activity: a["@id"], kind, value: raw, why: ad.unaddressed });
      return valueFor(ad, raw);
    };
    graph.push({
      "@id": a["@id"],
      "@type": "Activity",
      startTime: a["prov:startedAtTime"],
      ...(a["prov:endedAtTime"] ? { endTime: a["prov:endedAtTime"] } : {}),
      // `prov:used` is a compact-IRI KEY, not a context term, so no coercion
      // applies: a link has to be written as `{"@id"}` explicitly (rule
      // `ld-coercion-belongs-to-the-term`).
      ...(a["prov:used"]
        ? {
            "prov:used": a["prov:used"].map((u) => {
              // A described entity (agreement distribution, grant credential)
              // is already an absolute IRI: emitted as it is.
              if (typeof u !== "string") return u;
              const v = field("entity", u);
              return typeof v === "string" ? { "@id": v } : v;
            }),
          }
        : {}),
      // Another activity, by its `@id` — written as a link for the same reason.
      ...(a["prov:wasInformedBy"] !== undefined
        ? {
            "prov:wasInformedBy": (Array.isArray(a["prov:wasInformedBy"])
              ? a["prov:wasInformedBy"]
              : [a["prov:wasInformedBy"]]
            ).map((id) => ({ "@id": id })),
          }
        : {}),
      "cat-harness:underPolicy": a["cat-harness:underPolicy"],
      ...(a["cat-harness:consent"] ? { "cat-harness:consent": a["cat-harness:consent"] } : {}),
      ...(a["cat-harness:consentBased"] !== undefined ? { "cat-harness:consentBased": a["cat-harness:consentBased"] } : {}),
      ...(a["cat-harness:previousHash"] !== undefined ? { "cat-harness:previousHash": a["cat-harness:previousHash"] } : {}),
      ...(a["cat-harness:recordHash"] ? { "cat-harness:recordHash": a["cat-harness:recordHash"] } : {}),
    });
    // Beside each release address, the subject page in the owner's knowledge
    // graph (issue #959, owner 2026-10-30: add the IRI when published). The
    // stored, hash-chained record keeps its short `stem#task` reference.
    const subjects: Record<string, string> = {};
    for (const [term, kind, raw] of [
      ["cat-harness:agentSubject", "agent", q["prov:agent"]],
      ["cat-harness:roleSubject", "role", q["prov:hadRole"]],
      ["cat-harness:planSubject", "plan", q["prov:hadPlan"]],
    ] as const) {
      const s = book.subject?.(kind, raw);
      if (s) subjects[term] = s;
    }
    graph.push({
      "@type": "Association",
      activity: a["@id"],
      agent: field("agent", q["prov:agent"]),
      role: field("role", q["prov:hadRole"]),
      plan: field("plan", q["prov:hadPlan"]),
      ...subjects,
    });
  }
  const describesEntities = activities.some((a) => (a["prov:used"] ?? []).some((u) => typeof u !== "string"));
  // Label the hash-chain terms as the local extension they are, in the data.
  for (const [term, comment] of Object.entries(PROV_LOCAL_EXTENSION_TERMS)) {
    if (activities.some((a) => (a as Record<string, unknown>)[term] !== undefined)) {
      graph.push({ "@id": term, "@type": "rdf:Property", "rdfs:comment": comment, "rdfs:isDefinedBy": { "@id": CAT_HARNESS_NS } });
    }
  }
  return {
    document: {
      "@context": [
        PROV_JSONLD_CONTEXT_URL,
        {
          "@base": FOLIO_BASE,
          "cat-harness": CAT_HARNESS_NS,
          "cat-harness:underPolicy": { "@type": "@id" },
          "cat-harness:agentSubject": { "@type": "@id" },
          "cat-harness:roleSubject": { "@type": "@id" },
          "cat-harness:planSubject": { "@type": "@id" },
          // Only a document that cites a described entity carries these, so
          // every other document is byte-for-byte what it was.
          ...(describesEntities
            ? {
                dcat: DCAT_NS,
                spdx: SPDX_NS,
                cred: CRED_NS,
                "spdx:algorithm": { "@type": "@id" },
                "spdx:checksumValue": { "@type": "xsd:hexBinary" },
                "dcat:downloadURL": { "@type": "@id" },
              }
            : {}),
        },
      ],
      "@id": id,
      "@graph": graph,
    },
    unaddressed,
  };
}

/** The held context, read and checked against its pin; throws on drift. */
export function heldProvJsonldContext(repo: string): unknown {
  const at = existsSync(join(repo, PROV_JSONLD_CONTEXT_HELD.path))
    ? PROV_JSONLD_CONTEXT_HELD.path
    : PROV_JSONLD_CONTEXT_HELD.legacyPath;
  const file = join(repo, at);
  const bytes = readFileSync(file);
  const sha = new Bun.CryptoHasher("sha256").update(bytes).digest("hex");
  if (sha !== PROV_JSONLD_CONTEXT_HELD.sha256) {
    throw new Error(`${PROV_JSONLD_CONTEXT_HELD.path} has sha256 ${sha}, pinned ${PROV_JSONLD_CONTEXT_HELD.sha256}`);
  }
  return JSON.parse(bytes.toString("utf-8"));
}
