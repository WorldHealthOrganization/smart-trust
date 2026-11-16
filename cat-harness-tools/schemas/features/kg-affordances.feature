# The four affordances of a conformant knowledge graph (browse, materialise, instantiate, copy-into-folio) as written in
# cat-harness's kg-core skills, tools, capabilities and copy-into-folio.bpmn, and KgAsset.source in schemas/kg/kg-node.ts
# (bean folio-assistant-dp1j). Each Scenario names the test that executes it.
Feature: Knowledge-graph affordances

  @test:schemas/kg-affordances.test.ts::bean_dp1j_—_KG_affordances:_browse,_materialise,_instantiate,_copy-into-folio::1._the_four_verbs_are_written_down_in_kg-affordances_and_registered_in_kg-core
  Scenario: The four verbs are written down in kg-affordances and registered in kg-core
    Given the cat-harness kg-core package manifest
    Then its skills include "kg-affordances" and "folio-init"
    And its skills are in sorted order
    And kg-affordances.md exists and names "browse", "materialise", "instantiate" and "copy-into-folio" as code

  @test:schemas/kg-affordances.test.ts::bean_dp1j_—_KG_affordances:_browse,_materialise,_instantiate,_copy-into-folio::2._folio-init_skill_exists_and_the_folio-init_Tool_satisfies_it
  Scenario: The folio-init skill exists and the folio-init Tool satisfies it
    Given the kg-core folio-init.md skill
    Then it exists and contains "name: folio-init" and "--dry-run"
    When the folio-init and declaration-resolution Tool definitions are read as data
    Then the folio-init Tool has id "folio-init" and satisfies "folio-init"
    And the declaration-resolution Tool satisfies "kg-affordances"

  @test:schemas/kg-affordances.test.ts::bean_dp1j_—_KG_affordances:_browse,_materialise,_instantiate,_copy-into-folio::3._write_capabilities_exist_and_each_writing_verb_declares_its_capability_requirement_and_degradation
  Scenario: Write capabilities exist and the writing verbs name their capability requirements
    # Gap: checks that the capabilities are mentioned in the skill text, not that each writing verb is tied to its own requirement and degradation
    Given the capabilities "git-read", "git-push", "github-api" and "github-connector"
    Then each has a capability file whose id is its name
    And kg-affordances.md and folio-init.md each mention "git-push", "github-api" and "github-connector"
    And kg-affordances.md shows browse requiring "none"
    And kg-affordances.md says "zero write capabilities"

  @test:schemas/kg-affordances.test.ts::bean_dp1j_—_KG_affordances:_browse,_materialise,_instantiate,_copy-into-folio::4._copy-into-folio.bpmn_checks_write_capability,_copies_the_asset,_stamps_KgAsset.source,_and_lets_the_author_edit/comment/raise_todos
  Scenario: copy-into-folio.bpmn holds the copy steps and its lanes' roles carry the skills
    # Gap: checks only that the element ids and "KgAsset.source" appear in the XML, not the flow between them
    Given the processes/kg/copy-into-folio.bpmn file exists
    Then it contains the process "Process_CopyIntoFolio"
    And it contains the write-capability probe, the "GW_CanWrite" gateway and the read-only inspection and degraded end
    And it contains reading the upstream asset, copying and declaring it, stamping its source, validating it, working on the copy and the editable end
    And it mentions "KgAsset.source"
    And in the role graph, "author" carries "kg-affordances" and "todo-manager"
    And "authoring-agent" carries "kg-affordances", "directory-conventions" and "folio-init"
    And "corpus" and "validation-pipeline" each carry "kg-affordances"

  @test:schemas/kg-affordances.test.ts::bean_dp1j_—_KG_affordances:_browse,_materialise,_instantiate,_copy-into-folio::5._KgAsset.source_stamps_provenance_and_keeps_copied_assets_distinct_from_locally_authored_ones
  Scenario: KgAsset.source stamps provenance and distinguishes copied from authored assets
    Given a KgAsset with source instance "litlfred/smart-base", a path and a commit ref
    When it is parsed
    Then its source is kept exactly
    And a KgAsset with no source parses with source undefined
    And an asset source with instance "not-a-repo-slug" is refused
