# scripts/init-folio.ts scaffolds a folio that is QA'd from its first commit: its AGENTS.md documents the sweep, verdicts land at the folio's root, and the QA summary reads them.
# Each Scenario names the test that executes it.
Feature: A new folio is QA'd from its first commit

  @test:scripts/tests/init-folio-qa.test.ts::a_new_folio_is_QA'd_from_its_first_commit::AGENTS.md_documents_the_sweep_and_where_its_verdicts_go
  Scenario: The scaffolded AGENTS.md documents the QA sweep and where verdicts go
    Given a document folio "qa-doc" scaffolded with assistant path "folio-assistant"
    When its AGENTS.md is read
    Then it contains "bun run folio-assistant/cat-harness-tools/pipeline/qa-sweep.ts folio"
    And it contains "test/results/block-qa/"
    And it does not teach the old sibling layout "<chapter>/<root>.qa.json"

  @test:scripts/tests/init-folio-qa.test.ts::a_new_folio_is_QA'd_from_its_first_commit::swept_from_the_repository_root,_as_CI_does,_a_subfolder_folio's_verdicts_land_at_ITS_root_and_the_summary_finds_them
  Scenario: A subfolder folio swept from the repository root keeps its verdicts at its own root
    Given a document folio "qa-sub" scaffolded in the repo subfolder "handbook", with the platform linked as a sibling
    When qa-sweep.ts is run from the repository root on "handbook/folio" with a test-owned script sidecar root
    Then the sweep exits with status 0
    And at least one ".script.json" sidecar is written under the test-owned sidecar root
    And the verdict handbook/test/results/block-qa/folio/qa-sub/introduction/overview.qa.json exists
    And no test directory is created at the repository root or inside handbook/folio
    And publish-block-qa.ts for "handbook/folio" exits 0 with a summary counting no unaudited blocks
    And the summary counts more than zero passing or failing blocks
