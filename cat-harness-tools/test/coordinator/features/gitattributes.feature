# Specifies, by asking git check-attr in the checkout, which generated files
# are marked -merge and which must stay textually mergeable, and that the
# gates covering -merge paths run in CI.
Feature: -merge covers only files whose producer owns them outright, and those files are gated

  @test:test/coordinator/gitattributes.test.ts::.gitattributes_exists_and_is_read_by_git::the_high-churn_generated_files_are_marked
  Scenario: The high-churn generated pages are marked -merge
    Given the checkout's .gitattributes exists
    When git resolves the merge attribute of the glossary pages, the auto-docs index and the beans index
    Then each is "unset"

  @test:test/coordinator/gitattributes.test.ts::a_file_whose_producer_reads_it_back_is_NOT_marked::the_attestation_store_stays_textually_mergeable
  Scenario: The attestation store is not marked -merge
    Given kg-audit.ts contains "readAttestations"
    When git resolves the merge attribute of an attestation file under test/attestations/kg-qa/
    Then it is not "unset"

  @test:test/coordinator/gitattributes.test.ts::a_file_whose_producer_reads_it_back_is_NOT_marked::`harness.json`_stays_textually_mergeable_because_its_producer_carries_state_forward
  Scenario: harness.json is not marked -merge
    Given the checkout
    When git resolves the merge attribute of "cat-harness/docs/_data/harness.json"
    Then it is not "unset"

  @test:test/coordinator/gitattributes.test.ts::every_-merge_path_is_gated_in_CI::each_path_git_marks_-merge_has_its_covering_gate_named_in_CI
  Scenario: Each path marked -merge has its covering gate in the CI workflow
    Given the text of code-quality-gates.yml
    And the two glossary pages paired with "check:glossary", the auto-docs index with "auto:docs:check" and the beans index JSON with "docs:pages:check"
    When git is asked each path's merge attribute
    Then every one of those paths is marked -merge
    And the workflow names the gate paired with each
