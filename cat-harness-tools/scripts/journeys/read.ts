/**
 * Read every journey and workshop in a checkout, with what their edges point
 * at: actors, user stories, building blocks, BPMN drawings, requirements and
 * FHIR examples.
 *
 * @module scripts/journeys/read
 * @covers user-scenario, workshop, device-screen
 *
 * ## Where the journeys are: the declarations say
 *
 * A journey is a node of the `user-scenario` kind, a workshop of the
 * `workshop` kind, and a directory of either is DECLARED by its layer
 * (`<instance>.json` `directories`). So the reader asks the checkout for every
 * declared directory of those kinds (`checkoutDirectories`), across every
 * layer the checkout mounts — the root's own and each layer below it — and
 * reads the files whose `$schema` names a family of the kind. Nothing is found
 * by path convention: a folder named `user-scenarios/` that no layer
 * declares is not read, and one declared under another name is.
 *
 * The edges are resolved the same way, through the owning layer's
 * declared directories, then the rest of the checkout:
 *
 * | edge | resolved against |
 * |---|---|
 * | `personas`, `lead`, `experiences[].actor` | `actors/<id>.json` in a `scenarios` directory |
 * | a persona that is a role, a BPMN lane | `roles.json` in a `scenarios` directory (`derive.ts` derives what the file leaves out from them) |
 * | `parts[].scenario`, a step's `includes` | a journey |
 * | `stories` | `stories.json` in a `scenarios` directory |
 * | `uses[].block` | a `building-blocks/0.1.0` file (its blocks, layers and big ideas) in a directory declaring the `building-blocks` kind, wherever it is (typically `archimate/building-blocks/`, beside the ArchiMate model) |
 * | `trustLadder` | a `folio-code-list/v1` file in a `code-list` directory |
 * | `realisedBy[].process` | the BPMN file, relative to the layer root, and its drawing `<stem>.svg` beside it; `tasks` are flow-node ids in that file |
 * | `illustration.src` | the image, relative to the layer root |
 * | `requirements` | a `req:` node (`<dir>/requirements/<id>.json`) in any declared directory |
 * | `examples` | the `index.json` of a `fhir-artifact-index` directory |
 * | a persona's `avatar` | the image, relative to the actor's layer root |
 *
 * A device screen (`device-screen` kind, `device-screen.ts`) is read the same
 * way, from a directory declaring that kind; its `owner`, person cards, steps
 * and examples resolve as a journey's do.
 *
 * An edge that resolves to nothing is kept and drawn as unresolved, never
 * dropped: a missing story is a finding a reader should see. The same
 * resolution is the gate `check:journey-refs` (`journeys/check.ts`), so the
 * viewer and the check cannot disagree about what resolves.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";

import { checkoutDirectories, checkoutRootFor } from "../../schemas/kg/harness-config.js";
import { findDeclarationFile } from "../../schemas/kg/instance-roots.js";
import { checkoutInstanceRoots } from "../viewer-declarations.ts";
import { mountedInstances, readPathAt } from "../lib/layer-output.ts";
import {
  BUILDING_BLOCKS_V01,
  BuildingBlocksSchema,
  isUserScenario,
  JourneyPersonaSchema,
  parseUserScenario,
  type BuildingBlock,
  type BuildingBlocks,
  type JourneyPersona,
  type Scenario,
  type UserScenario,
} from "../../schemas/process/user-scenario.ts";
import { parseWorkshop, WORKSHOP_V01, type Workshop } from "../../schemas/process/workshop.ts";
import { DEVICE_SCREEN_V01, parseDeviceScreen, type DeviceScreen } from "../../schemas/process/device-screen.ts";
import { instanceFile, journeyById, lookup, resolveScenario } from "./derive.ts";

export { instanceFile, journeyById, lookup };

export const SCENARIO_KIND = "user-scenario";
export const WORKSHOP_KIND = "workshop";
/** Where a trust ladder is kept: a code list, read from any `code-list` directory. */
export const CODE_LIST_KIND = "code-list";
/** Where a building-block catalogue is kept: any directory declaring this kind. */
export const BUILDING_BLOCKS_KIND = "building-blocks";
/** Where device screens are kept: any directory declaring this kind. */
export const DEVICE_SCREEN_KIND = "device-screen";

/** A layer of the checkout, as the viewer needs it. */
export interface InstanceInfo {
  name: string;
  root: string;
  title?: string;
  /** `owner/repo`, for source links. */
  repository?: string;
}

/** A journey, with where it came from. */
export interface Journey {
  instance: string;
  /** Instance-relative path of its file. */
  file: string;
  /** As the viewer draws it: the derived values filled in (`derive.ts`, `resolveScenario`). */
  scenario: Scenario;
  /** As its file says it: what `check:journey-refs` holds against the derived values. */
  authored: UserScenario;
}

export interface WorkshopEntry {
  instance: string;
  file: string;
  /** The workshop file's directory, absolute: a resource `href` is relative to it. */
  dir: string;
  workshop: Workshop;
}

/** A device screen, with where it came from. */
export interface ScreenEntry {
  instance: string;
  file: string;
  screen: DeviceScreen;
}

export interface Actor {
  id: string;
  /** The layer whose `scenarios` directory holds it. */
  instance: string;
  /** Instance-relative path of its file. */
  file: string;
  title: string;
  kind?: string;
  description?: string;
  persona?: JourneyPersona;
  /** The roles it plays (`roles`), by role id. */
  roles?: string[];
}

export interface Story {
  id: string;
  role: string;
  want: string;
  soThat?: string;
}

export interface Requirement {
  id: string;
  title: string;
  statement?: string;
  instance: string;
  /** Instance-relative source path. */
  file: string;
}

export interface FhirExample {
  key: string;
  title?: string;
  /** The index's description of it, in a sentence or two. */
  description?: string;
  code?: string;
  /** Its published page (`published.html`, else `.json`). */
  url?: string;
  /** Its published JSON (`published.json`). */
  jsonUrl?: string;
  /** The canonical URLs of the profiles it claims. */
  profiles?: string[];
  /** The resource as JSON text, read from the index's local copy (`materialization.localPath`) when the checkout has it. */
  json?: string;
}

/** The largest example JSON a page carries inline for the payload drawer. */
export const EXAMPLE_JSON_MAX_BYTES = 256 * 1024;

export interface Problem {
  instance: string;
  file: string;
  message: string;
}

/** Everything the viewer draws, read from the checkout once. */
export interface JourneyCorpus {
  checkout: string;
  instances: Map<string, InstanceInfo>;
  journeys: Journey[];
  workshops: WorkshopEntry[];
  /** Device screens, every layer's. */
  screens: ScreenEntry[];
  /** Per layer: actors by id. */
  actors: Map<string, Map<string, Actor>>;
  stories: Map<string, Map<string, Story>>;
  /** Per layer: the roles of its `scenarios` directories (`roles.json`), by id: what a lane is, and what the DAK calls a persona. */
  roles: Map<string, Map<string, { title?: string; otherNames?: string[] }>>;
  /** Per layer: the catalogues' layers and blocks. */
  blocks: Map<string, { layers: BuildingBlocks["layers"]; blocks: Map<string, BuildingBlock>; ideas: NonNullable<BuildingBlocks["ideas"]> }>;
  /** Per layer: its code lists (trust ladders), by id. */
  ladders: Map<string, Map<string, { code: string; label: string; definition?: string }[]>>;
  /** Per layer: each code list's title and description, by id. */
  ladderInfo: Map<string, Map<string, { title?: string; description?: string }>>;
  /** Requirement ids, upper-cased without `req:`, across the checkout. */
  requirements: Map<string, Requirement>;
  /** `Type/id` across the checkout's artifact indexes. */
  examples: Map<string, FhirExample>;
  /**
   * Declared `fhir-artifact-index` directories (instance/path) with no
   * `index.json` on disk: the index is built at publish, so a checkout or a CI
   * runner has none, and an example it would hold can be neither found nor
   * called missing.
   */
  examplesUnbuilt: string[];
  /** Files of the two kinds that would not parse: drawn as findings, never silently skipped. */
  problems: Problem[];
  /** Why the checkout's declared directories could not be read: set, the corpus is NOT complete. */
  undetermined?: string;
}

function readJson(p: string): unknown {
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return undefined;
  }
}

function jsonFilesUnder(dir: string, depth = 4): string[] {
  const out: string[] = [];
  const walk = (d: string, left: number) => {
    let entries: import("node:fs").Dirent[];
    try {
      entries = readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (e.name.startsWith(".") || e.name === "node_modules") continue;
      const p = join(d, e.name);
      if (e.isDirectory()) {
        if (left > 0) walk(p, left - 1);
      } else if (e.name.endsWith(".json")) out.push(p);
    }
  };
  walk(dir, depth);
  return out;
}

const upper = (id: string): string => id.replace(/^req:/, "").toUpperCase();

/** An example's JSON from the index's local copy: only inside the layer, only JSON, only up to {@link EXAMPLE_JSON_MAX_BYTES}. */
function exampleJson(root: string, local: string, overlay: (abs: string) => string = (abs) => abs): string | undefined {
  const at = resolve(root, local);
  if (relative(root, at).startsWith("..")) return undefined;
  // A computed file of a mounted layer is read over its pinned bytes (bean `cat-tools-sm8r` item 4).
  const p = overlay(at);
  if ( !existsSync(p) || !statSync(p).isFile() || statSync(p).size > EXAMPLE_JSON_MAX_BYTES) return undefined;
  try {
    return JSON.stringify(JSON.parse(readFileSync(p, "utf8")), null, 2);
  } catch {
    return undefined;
  }
}

/** Read the checkout `start` is in. */
export function readJourneyCorpus(start: string): JourneyCorpus {
  const checkout = resolve(checkoutRootFor(start));
  const roots = checkoutInstanceRoots(checkout);
  const instances = new Map<string, InstanceInfo>();
  for (const root of roots) {
    const file = findDeclarationFile(root);
    if (file === undefined) continue;
    const d = readJson(join(root, file)) as { name?: string; title?: string; repository?: string } | undefined;
    if (typeof d?.name !== "string") continue;
    instances.set(d.name, { name: d.name, root: resolve(root), ...(d.title ? { title: d.title } : {}), ...(d.repository ? { repository: d.repository } : {}) });
  }
  const corpus: JourneyCorpus = {
    checkout,
    instances,
    journeys: [],
    workshops: [],
    screens: [],
    actors: new Map(),
    stories: new Map(),
    roles: new Map(),
    blocks: new Map(),
    ladders: new Map(),
    ladderInfo: new Map(),
    requirements: new Map(),
    examples: new Map(),
    examplesUnbuilt: [],
    problems: [],
  };
  let dirs: ReturnType<typeof checkoutDirectories> = [];
  try {
    dirs = checkoutDirectories(start);
  } catch (e) {
    dirs = [];
    corpus.undetermined = e instanceof Error ? e.message : String(e);
  }
  const mounted = mountedInstances(checkout);
  const overlay = (abs: string): string => readPathAt(checkout, abs, mounted);
  const seenFiles = new Set<string>();
  for (const d of dirs) {
    const instance = d.member ?? d.declaredBy;
    const info = instances.get(instance);
    if (info === undefined) continue;
    const kinds = d.graphTypologies as readonly string[];
    const rel = (p: string) => relative(info.root, p).split("\\").join("/");
    // An artifact index is BUILT AT PUBLISH: its directory, or its index.json,
    // is absent from a checkout. Recorded, so an example it would hold is
    // reported as could-not-determine rather than as missing.
    // Read through the layer output root (bean `cat-tools-sm8r` item 4): a
    // mounted layer's index is written there, over the pinned bytes.
    if (kinds.includes("fhir-artifact-index") && !existsSync(overlay(join(d.absPath, "index.json")))) {
      corpus.examplesUnbuilt.push(`${instance}/${rel(d.absPath)}`);
    }
    // Before the directory test: a mounted layer's index may sit only under
    // the layer output root, with no pinned directory beside it.
    if (kinds.includes("fhir-artifact-index")) {
      const idx = readJson(overlay(join(d.absPath, "index.json"))) as { artifacts?: unknown[]; entries?: unknown[] } | undefined;
      type Entry = { key?: string; title?: string; description?: string; code?: { text?: string }; published?: Record<string, { url?: string }>; profiles?: unknown; materialization?: { localPath?: unknown } };
      for (const a of (idx?.artifacts ?? idx?.entries ?? []) as Entry[]) {
        if (typeof a.key !== "string") continue;
        const url = a.published?.html?.url ?? a.published?.json?.url;
        const jsonUrl = a.published?.json?.url;
        const profiles = Array.isArray(a.profiles) ? a.profiles.filter((x): x is string => typeof x === "string") : [];
        const local = typeof a.materialization?.localPath === "string" ? a.materialization.localPath : undefined;
        const json = local ? exampleJson(info.root, local, overlay) : undefined;
        corpus.examples.set(a.key, {
          key: a.key,
          ...(a.title ? { title: a.title } : {}),
          ...(typeof a.description === "string" && a.description ? { description: a.description } : {}),
          ...(a.code?.text ? { code: a.code.text } : {}),
          ...(url ? { url } : {}),
          ...(jsonUrl ? { jsonUrl } : {}),
          ...(profiles.length ? { profiles } : {}),
          ...(json ? { json } : {}),
        });
      }
    }
    if (!existsSync(d.absPath) || !statSync(d.absPath).isDirectory()) continue;
    if ([SCENARIO_KIND, WORKSHOP_KIND, CODE_LIST_KIND, BUILDING_BLOCKS_KIND, DEVICE_SCREEN_KIND].some((k) => kinds.includes(k))) {
      for (const p of jsonFilesUnder(d.absPath, 2)) {
        if (seenFiles.has(p)) continue;
        const raw = readJson(p) as { $schema?: unknown; id?: unknown; codes?: unknown } | undefined;
        if (raw === undefined) continue;
        const tag = raw.$schema;
        try {
          if (kinds.includes(SCENARIO_KIND) && isUserScenario(raw)) {
            seenFiles.add(p);
            const authored = parseUserScenario(raw, rel(p));
            // Resolved once every actor, role and BPMN of the checkout is read, below.
            corpus.journeys.push({ instance, file: rel(p), authored, scenario: authored as Scenario });
          } else if (kinds.includes(BUILDING_BLOCKS_KIND) && tag === BUILDING_BLOCKS_V01) {
            seenFiles.add(p);
            const c = BuildingBlocksSchema.parse(raw);
            const into: { layers: BuildingBlocks["layers"]; blocks: Map<string, BuildingBlock>; ideas: NonNullable<BuildingBlocks["ideas"]> } = corpus.blocks.get(instance) ?? { layers: [], blocks: new Map(), ideas: [] };
            for (const l of c.layers) if (!into.layers.some((x) => x.id === l.id)) into.layers.push(l);
            for (const b of c.blocks) into.blocks.set(b.id, b);
            for (const i of c.ideas ?? []) if (!into.ideas.some((x) => x.id === i.id)) into.ideas.push(i);
            corpus.blocks.set(instance, into);
          } else if (tag === "folio-code-list/v1" && typeof raw.id === "string" && Array.isArray(raw.codes)) {
            seenFiles.add(p);
            const into = corpus.ladders.get(instance) ?? new Map();
            into.set(raw.id, raw.codes as { code: string; label: string; definition?: string }[]);
            corpus.ladders.set(instance, into);
            const info = corpus.ladderInfo.get(instance) ?? new Map();
            const r = raw as { title?: unknown; description?: unknown };
            info.set(raw.id, { ...(typeof r.title === "string" ? { title: r.title } : {}), ...(typeof r.description === "string" ? { description: r.description } : {}) });
            corpus.ladderInfo.set(instance, info);
          } else if (kinds.includes(WORKSHOP_KIND) && tag === WORKSHOP_V01) {
            seenFiles.add(p);
            corpus.workshops.push({ instance, file: rel(p), dir: dirname(p), workshop: parseWorkshop(raw, rel(p)) });
          } else if (kinds.includes(DEVICE_SCREEN_KIND) && tag === DEVICE_SCREEN_V01) {
            seenFiles.add(p);
            corpus.screens.push({ instance, file: rel(p), screen: parseDeviceScreen(raw, rel(p)) });
          }
        } catch (e) {
          corpus.problems.push({ instance, file: rel(p), message: (e instanceof Error ? e.message : String(e)).replace(`${rel(p)}: `, "") });
        }
      }
    }
    if (kinds.includes("scenarios")) {
      const actorsDir = join(d.absPath, "actors");
      const actors = corpus.actors.get(instance) ?? new Map<string, Actor>();
      for (const p of existsSync(actorsDir) ? jsonFilesUnder(actorsDir, 0) : []) {
        const a = readJson(p) as { id?: string; title?: string; kind?: string; description?: string; roles?: unknown; meta?: { persona?: unknown } } | undefined;
        if (typeof a?.id !== "string") continue;
        const persona = a.meta?.persona === undefined ? undefined : JourneyPersonaSchema.safeParse(a.meta.persona);
        actors.set(a.id, {
          id: a.id,
          instance,
          file: rel(p),
          title: a.title ?? a.id,
          ...(a.kind ? { kind: a.kind } : {}),
          ...(a.description ? { description: a.description } : {}),
          ...(persona?.success ? { persona: persona.data } : {}),
          ...(Array.isArray(a.roles) && a.roles.length ? { roles: a.roles.filter((r): r is string => typeof r === "string") } : {}),
        });
      }
      corpus.actors.set(instance, actors);
      const s = readJson(join(d.absPath, "stories.json")) as { stories?: { id: string; role?: { role?: string }; want: string; soThat?: string }[] } | undefined;
      const stories = corpus.stories.get(instance) ?? new Map<string, Story>();
      for (const st of s?.stories ?? []) {
        stories.set(st.id, { id: st.id, role: st.role?.role ?? "", want: st.want, ...(st.soThat ? { soThat: st.soThat } : {}) });
      }
      corpus.stories.set(instance, stories);
      const r = readJson(join(d.absPath, "roles.json")) as { roles?: { id?: unknown; title?: unknown; otherNames?: unknown }[] } | undefined;
      const roles = corpus.roles.get(instance) ?? new Map<string, { title?: string; otherNames?: string[] }>();
      for (const x of r?.roles ?? []) {
        if (typeof x.id !== "string") continue;
        const other = Array.isArray(x.otherNames) ? x.otherNames.filter((o): o is string => typeof o === "string") : [];
        roles.set(x.id, { ...(typeof x.title === "string" ? { title: x.title } : {}), ...(other.length ? { otherNames: other } : {}) });
      }
      corpus.roles.set(instance, roles);
    }
    // Requirements: `req:` nodes kept in a `requirements/` folder of any declared directory.
    const reqDir = join(d.absPath, "requirements");
    if (existsSync(reqDir) && statSync(reqDir).isDirectory()) {
      for (const p of jsonFilesUnder(reqDir, 0)) {
        const r = readJson(p) as { id?: string; title?: string; statements?: { requirement?: string }[] } | undefined;
        if (typeof r?.id !== "string" || !r.id.startsWith("req:")) continue;
        corpus.requirements.set(upper(r.id), {
          id: upper(r.id),
          title: r.title ?? r.id,
          ...(r.statements?.[0]?.requirement ? { statement: r.statements[0].requirement } : {}),
          instance,
          file: rel(p),
        });
      }
    }
  }
  for (const j of corpus.journeys) j.scenario = resolveScenario(corpus, j);
  corpus.journeys.sort((a, b) => a.instance.localeCompare(b.instance) || a.scenario.id.localeCompare(b.scenario.id));
  corpus.workshops.sort((a, b) => a.instance.localeCompare(b.instance) || a.workshop.id.localeCompare(b.workshop.id));
  corpus.screens.sort((a, b) => a.instance.localeCompare(b.instance) || a.screen.id.localeCompare(b.screen.id, undefined, { numeric: true }));
  return corpus;
}


/** A building block for a step of `instance`'s journey: its own catalogue first. */
export function blockFor(corpus: JourneyCorpus, instance: string, id: string): { block: BuildingBlock; layer?: string } | undefined {
  const tryIn = (name: string) => {
    const c = corpus.blocks.get(name);
    const b = c?.blocks.get(id);
    return b ? { block: b, layer: c!.layers.find((l) => l.id === b.layer)?.label } : undefined;
  };
  const own = tryIn(instance);
  if (own) return own;
  for (const name of corpus.blocks.keys()) if (name !== instance) {
    const r = tryIn(name);
    if (r) return r;
  }
  return undefined;
}


/** A requirement by the id a step names (`STT-VER-008`, `req:stt-ver-008`). */
export function requirementFor(corpus: JourneyCorpus, id: string): Requirement | undefined {
  return corpus.requirements.get(upper(id));
}

/** A persona's avatar: the image file, absolute, when the actor names one and it exists. */
export function avatarFile(corpus: JourneyCorpus, actor: Actor): string | undefined {
  const src = actor.persona?.avatar;
  return src === undefined ? undefined : instanceFile(corpus, actor.instance, src);
}


/** The ids of every element of a BPMN file a step names; undefined when the file does not exist. */
export function processElementIds(corpus: JourneyCorpus, instance: string, process: string): Set<string> | undefined {
  const file = instanceFile(corpus, instance, process);
  if (file === undefined) return undefined;
  const ids = new Set<string>();
  for (const m of readFileSync(file, "utf8").matchAll(/<(?:[A-Za-z_][\w.-]*:)?[A-Za-z_][\w.-]*\b[^>]*?\sid="([^"]+)"/g)) ids.add(m[1]!);
  return ids;
}

/** The drawing of a BPMN file a step names: `<stem>.svg` beside it, as `render:bpmn` writes it. */
export function processDrawing(corpus: JourneyCorpus, instance: string, process: string): { svg: string; file: string } | undefined {
  const info = corpus.instances.get(instance);
  if (info === undefined) return undefined;
  const bpmn = join(info.root, process);
  const svgPath = join(dirname(bpmn), `${basename(bpmn).replace(/\.bpmn$/, "")}.svg`);
  if (!existsSync(svgPath)) return undefined;
  return { svg: readFileSync(svgPath, "utf8"), file: relative(info.root, svgPath).split("\\").join("/") };
}

const XML_ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

/**
 * An XML attribute value with its entities resolved, in ONE pass: each
 * `&…;` is replaced once, so `&amp;lt;` is `&lt;`, never `<`.
 */
export function unescapeXml(text: string): string {
  return text.replace(/&(?:#x([0-9a-f]+)|#(\d+)|(amp|lt|gt|quot|apos));/gi, (whole, hex: string | undefined, dec: string | undefined, name: string | undefined) => {
    if (hex !== undefined) return String.fromCodePoint(parseInt(hex, 16));
    if (dec !== undefined) return String.fromCodePoint(Number(dec));
    return XML_ENTITIES[name!.toLowerCase()] ?? whole;
  });
}

/** The name of the process a BPMN file a step names holds (its first `process` with a `name`); undefined when there is none. */
export function processName(corpus: JourneyCorpus, instance: string, process: string): string | undefined {
  const file = instanceFile(corpus, instance, process);
  if (file === undefined) return undefined;
  const m = /<(?:[A-Za-z_][\w.-]*:)?process\b[^>]*\sname="([^"]+)"/.exec(readFileSync(file, "utf8"));
  return m ? unescapeXml(m[1]!) : undefined;
}

// ── hrefs a journey or a workshop names ───────────────────────────────────

/**
 * From a page to the site's root: the viewer's route root, then up out of the
 * route (`en/<harness>/<id>`). `root` is the page's way up to the route root.
 */
export const siteRootFrom = <L extends { route: string }>(root: string, links: L): string => root + "../".repeat(links.route.split("/").length);

/**
 * An href a journey, a step or a workshop names: a URL as it is, an absolute
 * path or a `#fragment` as it is, else a path from the SITE'S ROOT. The one
 * resolver the journey pages (`render.ts`) and the workshop pages
 * (`present.ts`) share, so a relative href (`journeys.html#j1`, `vaxlink/`)
 * reaches the same file from both.
 */
export function fromSite(href: string, siteRoot: string): string {
  return /^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith("/") || href.startsWith("#") ? href : `${siteRoot}${href}`;
}
