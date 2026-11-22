# scripts/check-maintained-artefacts.ts checks, once the site tree is assembled, that every artefact
# a Tool claims to maintain exists there as a file; an unbuilt tree clears nothing.
# Each Scenario names the test that executes it.
Feature: Maintained artefacts are present in the built tree

  @test:scripts/tests/check-maintained-artefacts.test.ts::checkMaintainedArtefacts::there_are_claims_to_check_—_a_green_run_over_zero_rows_is_not_coverage
  Scenario: There are maintains claims to check
    Given an empty directory
    When the maintained artefacts are checked against it
    Then at least one claim is returned

  @test:scripts/tests/check-maintained-artefacts.test.ts::checkMaintainedArtefacts::an_empty_tree_reports_every_claim_absent,_never_present
  Scenario: An empty tree reports every claim absent
    Given an empty directory
    When the maintained artefacts are checked against it
    Then no claim is present

  @test:scripts/tests/check-maintained-artefacts.test.ts::checkMaintainedArtefacts::a_claim_is_present_only_when_the_path_is_a_FILE
  Scenario: A claim is present only when its path is a file
    Given a directory created at the first claim's artefact path
    When the maintained artefacts are checked
    Then that claim is not present
    And once the directory is replaced by a file, the claim is present

  @test:scripts/tests/check-maintained-artefacts.test.ts::checkMaintainedArtefacts::a_fully_populated_tree_passes_every_claim
  Scenario: A fully populated tree passes every claim
    Given a file written at every claimed artefact path
    When the maintained artefacts are checked
    Then every claim is present

  @test:scripts/tests/check-maintained-artefacts.test.ts::checkMaintainedArtefacts::every_claim_names_a_source_module_and_a_relative_artefact_path
  Scenario: Every claim names a source and a relative artefact path
    When the maintained artefacts are listed
    Then every claim has a non-empty source
    And no artefact path starts with "/"
