# scripts/harness-schema-export.ts reconciles the artefacts Tools declare they maintain against what
# the schema export produces, reporting undeclared, unproduced and missing-source artefacts.
# Each Scenario names the test that executes it.
Feature: Artefact declaration drift

  @test:scripts/tests/artefact-declaration-drift.test.ts::declaredArtefacts::carries_the_declaring_Tool's_own_invocation
  Scenario: Every declared artefact names its Tool and source
    # Gap: only that the Tool and source are present is checked, not that they are the Tool's invocation
    Given the artefacts declared by the Tool graph
    When they are read
    Then there is at least one
    And each names a Tool and a source

  @test:scripts/tests/artefact-declaration-drift.test.ts::declaredArtefacts::names_every_source_as_a_path_that_exists_in_the_tree
  Scenario: No declared artefact names a missing source
    When drift is computed with no produced artefacts
    Then no artefact is reported as having a missing source

  @test:scripts/tests/artefact-declaration-drift.test.ts::artefactDeclarationDrift::reports_a_produced_artefact_that_no_Tool_declares
  Scenario: A produced artefact that no Tool declares is reported
    When drift is computed with "not-declared-by-anything.schema.json" produced
    Then that artefact is reported as undeclared

  @test:scripts/tests/artefact-declaration-drift.test.ts::artefactDeclarationDrift::does_NOT_report_artefacts_produced_by_some_other_command_as_unproduced
  Scenario: Artefacts produced by another command are not reported as unproduced
    When drift is computed with no produced artefacts
    Then "cat-harness/ns.jsonld" is not reported as unproduced
    And "ns/content/v1.jsonld" is not reported as unproduced

  @test:scripts/tests/artefact-declaration-drift.test.ts::artefactDeclarationDrift::still_reports_this_command's_OWN_artefact_when_it_stops_being_produced
  Scenario: This command's own artefacts are reported when not produced
    When drift is computed with no produced artefacts
    Then at least one artefact is reported as unproduced
    And at least one of them ends in ".schema.json"
