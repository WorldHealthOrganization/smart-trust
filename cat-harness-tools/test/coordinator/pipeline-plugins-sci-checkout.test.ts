/**
 * `pipeline-plugins` tests whose subject is folio-assistant-sci's contribution
 * — that this layer fills every pipeline-plugin slot — moved here from
 * `cat-harness/content/pipeline/pipeline-plugins.test.ts` (bean `ho66`). The
 * code under test is cat-harness's, imported DOWN; what it is held against is
 * this layer's, so standing alone cat-harness has nothing for these to
 * read. The rest of that file's tests stay there.
 *
 * Then moved up again, to the aggregate's `test/` (bean `7zz1`, owner ruling
 * 2026-10-06 "Top-level instance"): "loaded lazily from the running folio"
 * is a claim about the RUNNING checkout, and only the aggregate's root
 * depends on sci. Standing alone, folio-assistant-sci is no folio that
 * depends on itself (`seed:ready --layer folio-assistant-sci --rehearse`,
 * 2026-10-07); `contribution-nodes.test.ts` there holds the slots against a
 * folio that does.
 */
import { afterEach, describe, expect, it } from "bun:test";

import {
  PIPELINE_PLUGIN_KINDS,
  pipelinePlugin,
  usePipelinePluginRegistry,
} from "../../pipeline/pipeline-plugins.ts";

afterEach(() => usePipelinePluginRegistry(undefined));

describe("this repository", () => {
  // folio-assistant-sci fills most slots and folio-assistant-core fills
  // `tabular-csvw` (bean `urat`); between them the running checkout fills all.
  it("the running checkout fills every slot, loaded lazily from the running folio", () => {
    usePipelinePluginRegistry(undefined);
    for (const kind of PIPELINE_PLUGIN_KINDS) {
      expect(() => pipelinePlugin(kind)).not.toThrow();
    }
  });
});
