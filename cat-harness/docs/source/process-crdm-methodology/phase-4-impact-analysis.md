Before implementation begins, assess **what the proposed changes affect** across
the platform and any active folios.

**What the agent analyses:**

1. **Content impact** — does the change affect existing folio content? If a
   schema changes, which folios need migration? The content graph
   (`content-graph.ts`) and the constraint rules (`schemas/constraints.ts`)
   make this measurable.

2. **Pipeline impact** — which pipeline scripts are affected? Does the change
   require new validators, new renderers, or modifications to existing ones?
   List every file under `content/pipeline/` that would be touched.

3. **QA impact** — does the change add, modify, or remove QA criteria? How does
   it affect the existing QA sweep results? Any criterion change must be
   registered in `qa-criteria-registry.ts`.

4. **Adapter impact** — does the change affect one adapter (paper, document,
   dak) or all? Changes to `DocumentContentAdapter` ripple into
   `PaperContentAdapter` because it extends it.

5. **Migration plan** — if existing content or configuration must change, write
   the migration steps. Include:
   - Which folios are affected
   - What the codemod or manual migration looks like
   - What breaks if the migration is not run
   - Rollback strategy

6. **Test plan** — what tests need to be added or updated? Which existing tests
   might break?

**Deliverable:** an impact assessment section in the GitHub issue listing every
affected file, folio, and workflow, with a migration plan if applicable.
