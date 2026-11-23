/**
 * Which skill edits which declaration property: the "edit skills" column of the
 * harness config panel.
 *
 * This map is TOTAL over the declaration's keys: `property-skills.test.ts`
 * fails when a key is added to {@link CatHarnessDeclarationSchema} without a
 * row here. A row either names the skills that edit the property or records,
 * in words, that none does yet. A recorded gap is shown in the panel as a
 * finding. It is never left blank.
 *
 * Skills are named by their file stem, which is how `reference/skill-instructions/`
 * publishes them. The test checks every name resolves to a skill file.
 *
 * @module schemas/property-skills
 * @graphNode schema
 */

/** One declaration property's edit route. */
export type PropertySkills =
  | { skills: readonly [string, ...string[]]; gap?: undefined }
  | { skills: readonly []; gap: string };

/** Every key of the declaration, in the order the schema declares them. */
export const PROPERTY_SKILLS = {
  name: { skills: ["instance-kinds", "directory-conventions"] },
  title: { skills: ["harness-tiles"] },
  description: { skills: ["harness-tiles"] },
  // The one-line gloss and the other spellings shown under a harness's
  // section on the landing page (bean `ob3m` findings 4–5).
  summary: { skills: ["harness-tiles"] },
  alsoWritten: { skills: ["harness-tiles"] },
  // The layer's own avatar, moved off the table in avatars.ts (sod4 #4).
  avatar: { skills: ["harness-tiles"] },
  images: { skills: ["theme-declaration", "harness-tiles"] },
  assets: { skills: ["directory-conventions"] },
  icon: { skills: ["theme-declaration", "harness-tiles"] },
  navbarIcons: { skills: ["harness-tiles"] },
  // Which tiles the glass's bottom strip pins, in order; the rest are
  // counted on its "+N more" tile (owner's ruling, bean `ob3m` finding 10).
  glassStrip: { skills: ["harness-tiles"] },
  // The planned owner/repo and, pre-split, the host + directory it sits in
  // today (bean 6rmv); `instance-repositories.ts` derives the map from both.
  repository: { skills: ["instance-kinds", "directory-conventions"] },
  livesAt: { skills: ["instance-kinds", "directory-conventions"] },
  // Bean `bamf`: the upstream repository and commit a layer's built site
  // is staged from; feature-staging §"Built sites follow the same rule" says
  // the stager reads it from the layer's own files.
  source: { skills: ["feature-staging"] },
  // Content or tools half of the split (bean eayu); a content layer holding
  // code is a failing kg:audit finding.
  separation: { skills: ["kg-separation"] },
  // Layers seeded in the same step (owner, 2026-10-04); seed:ready does not
  // count a path into one as upward.
  seedsWith: { skills: ["kg-separation"] },
  stub: { skills: ["directory-conventions"] },
  enabled: {
    skills: [],
    gap: "no skill edits `enabled` yet: the default (enabled) and the URL cases are documented only in the schema (cat-harness.ts, schemas/kg/url-space.ts; bean nbal)",
  },
  canonicalUrl: { skills: ["directory-conventions"] },
  previewUrl: { skills: ["directory-conventions"] },
  // Where identifiers are minted, before the version — and the rule for which
  // audience gets the full version and which the major (instance-publication).
  iriBase: { skills: ["instance-publication"] },
  // The layer's Node Kinds: `$schema` tag → the published schema defining it.
  nodeSchemas: { skills: ["directory-conventions"] },
  // TWO facets, two skills: `publication.host` is what kind of thing serves
  // the rendering (document-publishing); `publication.state` is how far along
  // it is, and why "published" does not parse (instance-publication).
  publication: { skills: ["document-publishing", "instance-publication"] },
  topology: {
    skills: [],
    gap: "no skill edits `topology` yet: its axes are documented only in the schema (cat-harness.ts, TopologySchema)",
  },
  directories: { skills: ["directory-conventions", "schema-management"] },
  // Owner ruling 2026-10-10 (bean `x4mt`): the install layer reads it, and no
  // skill tells an author how to choose or change it yet.
  skillPrefix: {
    skills: [],
    gap: "no skill edits `skillPrefix` yet: the rule (applied at install, per harness, `[a-z][a-z0-9]*`) is documented only in the schema (cat-harness.ts, CatHarnessDeclarationSchema)",
  },
  // Owner, 2026-10-09: the harness declares each visualiser, at
  // `<base>/<harness>/<visualiser>/`. `harness-tiles` carries the route and
  // collision rules; `harness-requirements` the obligation it meets.
  visualisers: { skills: ["harness-tiles", "harness-requirements"] },
  // Owner, 2026-10-14 (B1): artefacts built at publish and never committed — schemas/kg/built-at-publish.ts.
  builtAtPublish: {
    skills: [],
    gap: "no skill edits `builtAtPublish` yet: the rule (commit an artefact only if every input is pinned by this commit) and its two causes are documented only in the schema (built-at-publish.ts)",
  },
  // Owner, 2026-10-14 (bean 63q4): the external vocabularies a layer's JSON-LD speaks — schemas/kg/jsonld-prefixes.ts.
  jsonldPrefixes: {
    skills: [],
    gap: "no skill edits `jsonldPrefixes` yet: the rule (declare a vocabulary in the layer that owns it; the published context is generated from what documents use, flattened over `needs`) is documented only in the schema (jsonld-prefixes.ts)",
  },
  remoteGraphs: { skills: ["library-ingestion", "materialize-remote"] },
  associatedHarnesses: { skills: ["associate-harness"] },
  // Issue #1719. Both name a large-datasets skill, as `remoteGraphs` already
  // does with `materialize-remote`: the process that walks a subscription
  // calls that layer's subprocesses, so its skill lives beside them.
  subscriptions: { skills: ["kg-subscription", "materialize-remote"] },
  knownSubstrates: { skills: ["kg-subscription"] },
  // Bean `0mpw`: the harness's defaults and the downstream's mounts are two
  // halves of one relation, and one skill walks both.
  mountDefaults: { skills: ["remote-mount"] },
  remoteMounts: { skills: ["remote-mount"] },
  mountApprovers: { skills: ["remote-mount"] },
  stickies: { skills: ["create-sticky-note"] },
  renderExemption: { skills: ["harness-tiles"] },
  needs: { skills: ["instance-kinds", "confirm-harness"] },
  // cat-harness#991 step 23.1: the opt-in sub-graphs a layer switches on for
  // itself. The skill that tells an author when to enable `sdlc`/`work-plan`
  // arrives with the move that makes them opt-in (step 23.2).
  enableSubgraphs: {
    skills: [],
    gap: "no skill edits `enableSubgraphs` yet: the rule (qualified `<instance>.<id>`, an opt-in entry of this instance or its `needs` closure, not inherited; `CAT_SUBGRAPHS` overrides) is documented only in the schema (cat-harness.ts, opt-in-subgraphs.ts)",
  },
  // folio-assistant-tsh9: paths a layer moved and still answers for while the
  // layers that link to them switch, in any order.
  moves: { skills: ["two-phase-move"] },
  // Bean `0r7u`: what a layer's own check scripts read and write, so
  // `gates` may pool them and `regen` may skip them. prepare-merge says what
  // a wrong declaration costs.
  taskIo: { skills: ["prepare-merge"] },
  // Same bean: the CI steps and scripts a layer's gate set deliberately
  // skips, with their reasons. prepare-merge runs `bun run cat gates`, which
  // reports an unclassified step.
  gateExemptions: { skills: ["prepare-merge"] },
  contentAdapters: { skills: ["content-profiles"] },
  // Bean `ec2a` step 3: the graphs `lsi:near` searches beside the beans.
  lsiUnitProviders: { skills: ["lsi-indexing"] },
  // Bean `0r7u`: each layer's translation profile per content type it owns.
  contentTranslations: { skills: ["translation-manager"] },
  liquid: { skills: ["witnessed-values"] },
  // `publishable` was here until 2026-09-24 and the field is gone — replaced
  // by `publication.state`, which is a STATE rather than a boolean. The three
  // below point at `instance-publication` rather than `directory-conventions`:
  // the conventions skill says where a directory goes, this one says what
  // publication means and why `published` does not parse.
  id: { skills: ["instance-publication", "directory-conventions"] },
  version: { skills: ["instance-publication", "directory-conventions"] },
  // Bean `ujiv` (issue #88): the declaration's own node-kind tag,
  // `cat-harness-declaration/1.0.0`. `declarations:retag` writes it and
  // `declarations:retag:check` fails an untagged declaration.
  $schema: { skills: ["schema-management"] },
} as const satisfies Record<string, PropertySkills>;

export type DeclarationProperty = keyof typeof PROPERTY_SKILLS;
