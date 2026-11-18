/**
 * Resolve a content profile's render target from its declaration.
 *
 * The renderer half of `qa-checker-discovery.ts`, and the same three
 * properties: the module specifier is a VARIABLE so this module depends on
 * neither renderer and `repo-partition` records no edge; resolution happens
 * once rather than per block; and "there is no target" is a determined,
 * reportable state rather than a silent pass.
 *
 * Contributed targets win over the built-in table. A dependency that brings a
 * render target for a profile has said something more specific than the
 * platform default, and the platform's own entry is the fallback — which is
 * the opposite of the block-kind rule next door, where a contributed kind may
 * never shadow a platform one. The difference is what shadowing COSTS: a
 * shadowed `theorem` changes what every existing folio validates against,
 * while a shadowed render target changes only how this folio typesets, which
 * is the folio's business.
 *
 * @module pipeline/render-discovery
 */

import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

import type { ContentProfile } from "../schemas/content/block-kinds.ts";
import type { ContributionRegistry } from "../schemas/content/contributions.ts";
import { RENDER_TARGETS } from "../schemas/ui/render-targets.ts";
import { implementingRootFor } from "../schemas/kg/harness-config.ts";
import { HARNESS_ROOT } from "../scripts/lib/roots.ts";
import { resolveAdapterPreamble } from "../src/builtin-adapters.ts";

const ROOT = resolve(HARNESS_ROOT);

/** A resolved render target, normalised to one call shape. */
export interface ResolvedRenderTarget {
  format: string;
  render: (block: unknown, markdown: string) => string;
  /**
   * `undefined` means this target has NO structural check. Callers report
   * that as not-checked; treating it as a pass would give a folio a clean
   * validation record over output nobody examined.
   */
  validate?: (rendered: string) => { valid: boolean; errors: string[] };
  /**
   * Default print preamble template supplied by the adapter or renderer
   * contribution for this profile, if any (bean `4dj5`, #2117 P2).
   */
  preamblePath?: string;
}

/** Why no target came back. Never collapsed into "the folio is fine". */
export type RenderTargetMiss =
  | { reason: "no-profile"; detail: string }
  | { reason: "no-target"; detail: string }
  | { reason: "unloadable"; detail: string };

export type RenderTargetLookup =
  | { target: ResolvedRenderTarget; miss?: undefined }
  | { target?: undefined; miss: RenderTargetMiss };

/**
 * The render target for a profile, from the registry first and the platform's
 * declaration second.
 *
 * @param profile - The folio's declared content profile. `undefined` is not
 *   defaulted to `paper`: a folio that has not said what it is gets
 *   `no-profile`, because guessing `paper` is what made the LaTeX AST check
 *   generic in the first place.
 */
export async function resolveRenderTarget(
  profile: ContentProfile | undefined,
  registry?: ContributionRegistry,
): Promise<RenderTargetLookup> {
  if (!profile) {
    return {
      miss: {
        reason: "no-profile",
        detail:
          "the folio declares no content profile, so which render target its " +
          "blocks should be checked against is undetermined",
      },
    };
  }

  const contributed = registry?.renderer(RENDER_TARGETS[profile]?.format ?? profile);
  if (contributed) {
    const preamblePath =
      (contributed as { preamblePath?: string }).preamblePath ??
      (await resolveAdapterPreamble(profile));
    return {
      target: {
        format: contributed.format,
        render: contributed.render,
        validate: contributed.validate,
        ...(preamblePath !== undefined ? { preamblePath } : {}),
      },
    };
  }

  const decl = RENDER_TARGETS[profile];
  if (!decl) {
    return {
      miss: {
        reason: "no-target",
        detail: `profile "${profile}" declares no render target, built-in or contributed`,
      },
    };
  }

  // Read from the layer that implements the declared path (ruling T1,
  // bean `70lx`): the declaration names it as written, the code may have moved.
  const abs = join(implementingRootFor(ROOT, decl.module), decl.module);
  if (!existsSync(abs)) {
    return {
      miss: {
        reason: "unloadable",
        detail: `profile "${profile}" declares ${decl.module}, which does not exist`,
      },
    };
  }

  let mod: Record<string, unknown>;
  try {
    // VARIABLE specifier — the target comes from the declaration, so this
    // module names neither renderer.
    mod = (await import(abs)) as Record<string, unknown>;
  } catch (e) {
    return {
      miss: {
        reason: "unloadable",
        detail: `${decl.module} did not load: ${e instanceof Error ? e.message : String(e)}`,
      },
    };
  }

  const renderFn = mod[decl.renderExport];
  if (typeof renderFn !== "function") {
    return {
      miss: {
        reason: "unloadable",
        detail: `${decl.module} exports no ${decl.renderExport}()`,
      },
    };
  }

  const render =
    decl.argStyle === "entry"
      ? (block: unknown, markdown: string) =>
          (renderFn as (e: { block: unknown; mdContent: string }) => string)({
            block,
            mdContent: markdown,
          })
      : (block: unknown, markdown: string) =>
          (renderFn as (b: unknown, m: string) => string)(block, markdown);

  let validate: ResolvedRenderTarget["validate"];
  if (decl.validateExport) {
    const fn = mod[decl.validateExport];
    if (typeof fn !== "function") {
      // A DECLARED validator that is not there is a wiring failure, not an
      // absent check: the declaration says this output is verifiable, so
      // quietly downgrading to not-checked would hide a broken target.
      return {
        miss: {
          reason: "unloadable",
          detail: `${decl.module} declares ${decl.validateExport}() and exports none`,
        },
      };
    }
    validate = fn as ResolvedRenderTarget["validate"];
  }

  const preamblePath = await resolveAdapterPreamble(profile);
  return {
    target: {
      format: decl.format,
      render,
      validate,
      ...(preamblePath !== undefined ? { preamblePath } : {}),
    },
  };
}
