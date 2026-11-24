/**
 * What a repository IS — the markers it carries, as a resolvable set.
 *
 * @module schemas/content-type
 * @graphNode schema
 *
 * ## A repository is a SET, and the marker is the assertion
 *
 * **A repository declares itself an instance of a content type by carrying a
 * file named after that type.** The filename is the assertion; the type's IRI
 * is the resolvable reference to what the assertion MEANS. A repository may
 * be several things at once (a DAK *and* a SUSHI project), so the answer is a
 * set, not a one-file boolean. Each marker stays
 * owned by whoever defined it — `sushi-config.yaml` is SUSHI's and is not
 * ours to rename; `dak.config.json` is ours.
 *
 * So this is a registry, not an enum, and **each type declares its own
 * filename** (`skills/kg/kg-core/directory-conventions.md`).
 *
 * ## The same shape as `GraphTypologyRegistry`
 *
 * Open, seeded with a base table, `register` refusing a conflicting redefinition
 * and tolerating an identical one (a diamond reaches the same type twice). A
 * layer that owns a type registers it at load time, as
 * `folio-graph-typology.ts` registers `folio`.
 *
 * ## Reported, never resolved
 *
 * Two markers may state the same fact differently — both naming a
 * `canonicalUrl`, say. {@link describeRepository} REPORTS the disagreement and
 * resolves nothing; ranking the markers would make one repository's truth
 * depend on which layer happened to load.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * A content type a repository can assert it is an instance of.
 *
 * Every field is required, so a type cannot be half-declared: a marker with no
 * `type` asserts membership of something un-dereferenceable, which is the
 * `blv9` shape — a link-shaped value that resolves to nothing.
 */
export interface ContentTypeDef {
  /**
   * The file whose presence at a repository root makes the assertion.
   *
   * Named by the TYPE, not computed from anything. `sushi-config.yaml` is
   * SUSHI's spelling and is YAML; `dak.config.json` is ours. A
   * convention that claimed to cover the set would still be false on arrival —
   * one marker in the set belongs to somebody else — so there is no
   * convention, there is this field.
   *
   * ## A FUNCTION where the name is the layer's, not the type's
   *
   * `folio` was the one fixed name that stopped being fixed: a harness config
   * is `<instance>.config.json` as of 2026-09-20, so the marker's spelling is
   * a property of the repository rather than of the type. It still DECLARES
   * its filename — the owner's rule is untouched — it just declares how to
   * compute it. `undefined` from the function means "this repository has no
   * name to compose one from", which is not-a-member rather than an error.
   *
   * Every other type stays a plain string, because every other type really
   * does own its spelling.
   *
   * ## A SECTION of `index.config.json` instead of a file
   *
   * {@link IndexSectionMarker}: the assertion is the key
   * `contentTypes.<indexSection>` in the root `index.config.json`, not a file
   * of its own (owner, 2026-10-24, for the DAK). Absent key, not a member,
   * exactly as an absent file.
   */
  filename: string | ((repoRoot: string) => string | undefined) | IndexSectionMarker;
  /** The `@type` IRI this membership projects to. Must dereference. */
  type: string;
  /** One line: what carrying this marker claims about the repository. */
  summary: string;
  /**
   * Facts this marker states about the repository, by name, for
   * {@link describeRepository} to cross-check against other markers.
   *
   * A fact NOT listed here is simply not compared — absent means absent, never
   * "agrees". Returning `undefined` for a fact the marker does not carry is
   * how a marker says it has no opinion, which is different from agreeing.
   */
  facts?: (declaration: unknown) => Record<string, string | undefined>;
}

/**
 * A marker that is a section of the root `index.config.json` rather than a
 * file: membership is the presence of `contentTypes.<indexSection>`, and that
 * section is the declaration `facts` reads.
 */
export interface IndexSectionMarker {
  indexSection: string;
}

/** The root file an {@link IndexSectionMarker} lives in. */
export const INDEX_SECTION_FILE = "index.config.json";

function isIndexSection(f: ContentTypeDef["filename"]): f is IndexSectionMarker {
  return typeof f === "object" && f !== null;
}

/** Raised when two definitions claim one type id and disagree. */
export class ContentTypeConflictError extends Error {
  constructor(id: string) {
    super(
      `content type "${id}" is already registered with a different definition. ` +
        `A type is registered once by whoever owns it; two definitions mean two ` +
        `layers each think they do.`,
    );
    this.name = "ContentTypeConflictError";
  }
}

function sameType(a: ContentTypeDef, b: ContentTypeDef): boolean {
  const sameMarker =
    isIndexSection(a.filename) && isIndexSection(b.filename)
      ? a.filename.indexSection === b.filename.indexSection
      : a.filename === b.filename;
  return sameMarker && a.type === b.type;
}

export class ContentTypeRegistry {
  private types = new Map<string, ContentTypeDef>();

  constructor(seed: Readonly<Record<string, ContentTypeDef>> = {}) {
    for (const [k, v] of Object.entries(seed)) this.types.set(k, v);
  }

  register(id: string, def: ContentTypeDef): void {
    const existing = this.types.get(id);
    if (existing) {
      // A diamond reaches the same type twice and that is not a conflict.
      if (sameType(existing, def)) return;
      throw new ContentTypeConflictError(id);
    }
    this.types.set(id, def);
  }

  get(id: string): ContentTypeDef | undefined {
    return this.types.get(id);
  }

  ids(): string[] {
    return [...this.types.keys()];
  }

  entries(): Array<[string, ContentTypeDef]> {
    return [...this.types];
  }
}

/** The registry every consumer shares unless it passes its own. */
export const defaultContentTypes = new ContentTypeRegistry();

/** One type a repository asserted, with what its marker said. */
export interface ContentTypeMembership {
  id: string;
  /** The IRI a consumer dereferences to learn what this membership means. */
  type: string;
  /**
   * The marker that made the assertion: a repo-relative file, or
   * `index.config.json#contentTypes.<id>` for an {@link IndexSectionMarker}.
   */
  marker: string;
  /**
   * Whether the marker PARSED.
   *
   * A marker that is present and unreadable is a THIRD state, and the one that
   * matters: it is not absent, and reporting it as membership would hand a
   * consumer a claim nothing backs. `facts` is empty in that case and
   * `parsed: false` says why — never silently, because a marker nobody could
   * read is exactly the case where silence looks like a clean answer.
   */
  parsed: boolean;
  facts: Record<string, string>;
}

/** Two markers stating one fact differently. Reported; never resolved. */
export interface ContentTypeDisagreement {
  fact: string;
  /** Each claim, by the type id that made it. */
  claims: Record<string, string>;
}

export interface RepositoryDescription {
  /** Every type whose marker is present, in registration order. */
  types: ContentTypeMembership[];
  /**
   * Facts two or more markers state differently.
   *
   * Non-empty is a finding for a PERSON, not an error and not something to
   * resolve here. See the module docs.
   */
  disagreements: ContentTypeDisagreement[];
}

/**
 * Ask a repository what it is.
 *
 * Returns the markers actually present — never a guess, and never a boolean.
 * An empty `types` means this registry knows no marker that repository
 * carries, which is different from the repository being nothing: a consumer
 * that reads it as "not a folio" has confused what was looked for with what is
 * there.
 *
 * **It reads the root only.** Closure under the dependency tree is the other
 * half of `79t3` and needs the dependency resolver, which lives a layer up;
 * doing it here would make this module import the thing that should import it.
 */
export function describeRepository(
  repoRoot: string,
  registry: ContentTypeRegistry = defaultContentTypes,
): RepositoryDescription {
  const types: ContentTypeMembership[] = [];
  for (const [id, def] of registry.entries()) {
    if (isIndexSection(def.filename)) {
      const m = sectionMembership(repoRoot, id, def, def.filename);
      if (m) types.push(m);
      continue;
    }
    const marker = typeof def.filename === "function" ? def.filename(repoRoot) : def.filename;
    // No name to compose a marker from ⇒ not a member. Distinct from "the
    // marker is absent" only in cause, and neither is a finding.
    if (marker === undefined) continue;
    const path = join(repoRoot, marker);
    if (!existsSync(path)) continue;

    let parsed = false;
    let facts: Record<string, string> = {};
    try {
      // JSON only, for now, and the limit is declared rather than hidden:
      // `sushi-config.yaml` is YAML and needs a parser this module does not
      // import. Its membership is still reported — the FILE is the assertion —
      // with `parsed: false`, which is honest and is what the third state is
      // for. A marker read as "no facts" when it has some would be worse.
      const doc: unknown = JSON.parse(readFileSync(path, "utf-8"));
      parsed = true;
      for (const [k, v] of Object.entries(def.facts?.(doc) ?? {})) {
        if (typeof v === "string" && v.length > 0) facts[k] = v;
      }
    } catch {
      parsed = false;
      facts = {};
    }
    types.push({ id, type: def.type, marker, parsed, facts });
  }

  // Cross-check every fact any two markers both state.
  const byFact = new Map<string, Record<string, string>>();
  for (const m of types) {
    for (const [fact, value] of Object.entries(m.facts)) {
      const claims = byFact.get(fact) ?? {};
      claims[m.id] = value;
      byFact.set(fact, claims);
    }
  }
  const disagreements: ContentTypeDisagreement[] = [];
  for (const [fact, claims] of byFact) {
    if (new Set(Object.values(claims)).size > 1) disagreements.push({ fact, claims });
  }

  return { types, disagreements };
}

/**
 * The membership an {@link IndexSectionMarker} asserts, or `undefined` when
 * the section is absent.
 *
 * An index that is present but unreadable reports the type with
 * `parsed: false`, rather than dropping it: the section may well be there,
 * and silence would read as "not a member". An index that is readable and
 * lacks the key is plainly not a member.
 */
function sectionMembership(
  repoRoot: string,
  id: string,
  def: ContentTypeDef,
  m: IndexSectionMarker,
): ContentTypeMembership | undefined {
  const path = join(repoRoot, INDEX_SECTION_FILE);
  if (!existsSync(path)) return undefined;
  const marker = `${INDEX_SECTION_FILE}#contentTypes.${m.indexSection}`;
  let doc: unknown;
  try {
    doc = JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return { id, type: def.type, marker, parsed: false, facts: {} };
  }
  const sections = (doc as { contentTypes?: unknown } | null)?.contentTypes;
  const section =
    sections !== null && typeof sections === "object" ? (sections as Record<string, unknown>)[m.indexSection] : undefined;
  if (section === null || typeof section !== "object" || Array.isArray(section)) return undefined;
  const facts: Record<string, string> = {};
  for (const [k, v] of Object.entries(def.facts?.(section) ?? {})) {
    if (typeof v === "string" && v.length > 0) facts[k] = v;
  }
  return { id, type: def.type, marker, parsed: true, facts };
}
