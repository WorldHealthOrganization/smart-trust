/**
 * The content types this layer owns, registered at load time.
 *
 * @module schemas/content-types-base
 * @graphNode schema
 *
 * Separate from `content-type.ts` as `folio-graph-typology.ts` is separate
 * from `cat-harness.ts`: the registry is a mechanism and the entries are a
 * layer's opinion, declared only by the layer that owns them.
 *
 * Two are registered here — `harness` and `folio`.
 *
 * ## They are NOT the same type
 *
 * `harness` says *this is a layer*: a name, a stub, the directories it
 * holds. `folio` says *this authors folio content*: it carries `contentType`,
 * and `folio_init` writes it.
 *
 * ```
 *                        declared   contentType
 *   cat-harness/            yes         NO
 *   the repository root     yes         yes
 * ```
 *
 * Both are stated by one `<name>.config.json`, so the discriminator is its
 * CONTENT: `folioMarkerFilename` returns the file only when it declares a
 * `contentType`. A bare `{"name":"x"}` is an instance and not a folio. This
 * is what `isFolio` in `folio-intent.dmn` means.
 *
 * ## `dak`, `sushi` and `ig` are NOT here
 *
 * The DAK layer depends on core, so core recognising a DAK would be core
 * importing downstream (`check:partition:edges` refuses it). `dak` and `sushi`
 * live in {@link module:schemas/dak-content-type}, registered by the layer that
 * owns the model. `ig` is registered nowhere: nothing declares an IG
 * layer, so there is no marker file to recognise.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { defaultContentTypes, type ContentTypeRegistry } from "./content-type";
import { CONFIG_SUFFIX, findDeclarationFile } from "../kg/cat-harness";
import { layerConfigFilename, instanceConfigFor } from "../kg/harness-config";
import { isReservedIndexFile } from "../kg/instance-roots";
import { termIri } from "../kg/namespaces";

/** The `@type` a harness declaration projects to. */
export const HARNESS_TYPE = termIri("Instance");

/**
 * The folio marker's filename, resolved from the layer that declares it.
 *
 * HOISTED to module scope, and that is not tidiness. `sameType` compares
 * `filename` by `===`, so a resolver defined inline inside
 * {@link registerBaseContentTypes} is a fresh closure on every call and a
 * second call — which `content-type.test.ts` makes deliberately, and which a
 * diamond makes by accident — reads as a CONFLICTING redefinition of `folio`.
 * The literal it replaced was equal to itself for free; a function has to be
 * given that property on purpose.
 *
 * `undefined` on an unreadable declaration, NOT a throw. This resolver runs
 * inside `describeRepository`, whose whole subject is markers that may be
 * absent, present-and-unparseable, or present-and-invalid — and
 * `readDeclaration` throws on the last two. Letting that escape turned "the
 * harness marker is unreadable, so the folio marker's NAME is undetermined"
 * into a crash that reported nothing at all about either marker, which is the
 * third state collapsed in the loudest possible direction.
 */
function folioMarkerFilename(repoRoot: string): string | undefined {
  let inst: ReturnType<typeof instanceConfigFor>;
  try {
    inst = instanceConfigFor(repoRoot);
  } catch {
    return undefined;
  }
  if (inst === undefined) return undefined;
  const file = layerConfigFilename(inst.name);

  // IT MUST ACTUALLY DECLARE A CONTENT TYPE, which this did not have to check
  // while `harness.json` existed: the declaration and the config were two
  // files, so the mere presence of `<name>.config.json` meant somebody had
  // configured a folio. They are ONE file since 2026-09-21, and a bare
  // `{"name":"x"}` is an instance that is not a folio — asserting both
  // memberships off one marker made every declared layer a folio.
  //
  // This type's own summary is the rule: "it declares a content type". The
  // `harness` marker still reports the file, so nothing is lost — the two
  // memberships are simply no longer the same question.
  try {
    const raw = JSON.parse(readFileSync(join(repoRoot, file), "utf-8")) as { contentType?: unknown };
    return typeof raw.contentType === "string" ? file : undefined;
  } catch {
    // Unreadable: `harness` reports the membership it can see. Claiming folio
    // membership off a file nothing could parse would be inventing the one
    // fact this marker exists to carry.
    return undefined;
  }
}

/**
 * The harness marker — any `<name>.config.json` at this root.
 *
 * A FUNCTION rather than a constant because `harness.json` was excised
 * (2026-09-21) and the filename now carries the layer's name, so there is
 * no fixed string to look for.
 *
 * It falls back to any `*.config.json` when none is a valid declaration, and
 * that is deliberate: a marker PRESENT AND UNREADABLE is its own state — the
 * membership is asserted whether or not this module can parse the assertion.
 * Dropping it would under-report what the repository says about itself, which
 * is the third-state rule this file already applies to `sushi-config.yaml`.
 */
/**
 * `.config.json` filenames that a content type OTHER than `harness`/`folio`
 * claims, so the fallback above cannot report one of them as a harness marker.
 *
 * ## Why this exists, 2026-09-22
 *
 * The fallback's premise was written down as *"`.config.json` names a harness
 * artefact and nothing else"*. The owner's rename of the DAK marker from
 * `dak.json` to `dak.config.json` — for consistency with `<name>.config.json`,
 * and legitimate because the DAK type is ours (bean `cz17`) — **falsified that
 * premise**, and the repository's own tests caught it: a DAK repository was
 * reported as `["dak", "harness", "sushi"]` where it is `["dak", "sushi"]`.
 *
 * ## Derived, never listed
 *
 * It reads the registry rather than naming `dak.config.json`. A literal here
 * would have to be edited every time a type takes a config-suffixed marker,
 * and the edit that did not happen is invisible: the fallback would go on
 * asserting a harness membership nobody declared, and nothing would fail.
 *
 * This layer therefore stays ignorant of the DAK type, which is the split this
 * module's header insists on — `dak-content-type.ts` registers it, and all
 * this reads is that SOME type claimed the name.
 *
 * `harness` is excluded because it is this function's own caller, and `folio`
 * because its marker IS `<name>.config.json` — the two memberships are
 * deliberately asserted off one file.
 */
function configSuffixedMarkersOfOtherTypes(): ReadonlySet<string> {
  const out = new Set<string>();
  for (const [id, def] of defaultContentTypes.entries()) {
    if (id === "harness" || id === "folio") continue;
    // Only a LITERAL filename can be excluded. A computed one is a function of
    // the repository, so asking it here would mean resolving every type's
    // marker against a root this function has not been given — and a function
    // that returned a name for a DIFFERENT root would exclude the wrong file.
    if (typeof def.filename === "string" && def.filename.endsWith(CONFIG_SUFFIX)) {
      out.add(def.filename);
    }
  }
  return out;
}

function harnessMarkerFilename(repoRoot: string): string | undefined {
  let found: string | undefined;
  try {
    found = findDeclarationFile(repoRoot);
  } catch {
    // Several declarations, or only broken ones — either way the directory
    // plainly carries the marker, and the fallback below names it.
  }
  if (found !== undefined) return found;
  try {
    // CONFIG_SUFFIX, not DECLARATION_SUFFIX. This fallback exists for the
    // directory that plainly carries the marker while its declaration is
    // broken or duplicated, and `.config.json` names a harness artefact and
    // nothing else. The declaration suffix became a bare `.json` on
    // 2026-09-21, at which point this matched `dak.json`, `package.json` and
    // every other JSON file — so a DAK repository was reported as carrying a
    // harness marker it does not have. `findDeclarationFile` above is safe
    // under the same suffix because it additionally requires the stem to equal
    // the declared `name`; a bare suffix filter has no such guard, which is
    // exactly why it cannot use the bare suffix.
    const owned = configSuffixedMarkersOfOtherTypes();
    return readdirSync(repoRoot)
      .filter(
        (e) =>
          e.endsWith(CONFIG_SUFFIX) &&
          e.length > CONFIG_SUFFIX.length &&
          !owned.has(e) &&
          // `index.config.json` is the platform's, never a harness marker: an
          // IG repository may carry only an index (and, since 2026-10-24, a
          // DAK section in it), and reading that as "a harness" was wrong.
          !isReservedIndexFile(e),
      )
      .sort()[0];
  } catch {
    return undefined;
  }
}

export function registerBaseContentTypes(registry: ContentTypeRegistry = defaultContentTypes): void {
  registry.register("harness", {
    filename: harnessMarkerFilename,
    type: HARNESS_TYPE,
    summary:
      "An instance of the harness — it declares a name, a stub and the directories it holds.",
    facts: (d) => {
      const doc = d as { name?: unknown; stub?: unknown; canonicalUrl?: unknown };
      return {
        name: typeof doc.name === "string" ? doc.name : undefined,
        stub: typeof doc.stub === "string" ? doc.stub : undefined,
        canonicalUrl: typeof doc.canonicalUrl === "string" ? doc.canonicalUrl : undefined,
      };
    },
  });

  registry.register("folio", {
    // COMPUTED, because the marker's name is the layer's own as of
    // 2026-09-20 — `<name>.config.json` at the instantiation root. A literal
    // here would have gone on testing for a file no layer writes, and
    // `describeRepository` would have reported every folio as not-a-folio
    // while looking perfectly healthy.
    filename: folioMarkerFilename,
    type: termIri("Folio"),
    summary:
      "A repository that authors folio content — it declares a content type, and `folio_init` wrote this file.",
    facts: (d) => {
      const doc = d as { contentType?: unknown };
      return {
        // NOT cross-checked against anything today, and that is the honest
        // state: no other marker here states a content type, so this fact has
        // nobody to disagree with. It is carried because a consumer asking
        // "what are you?" wants `paper` or `document`, not just `folio` — and
        // because the day a second marker states it, the cross-check is
        // already wired.
        contentType: typeof doc.contentType === "string" ? doc.contentType : undefined,
      };
    },
  });
}

registerBaseContentTypes();
