# The guard in scripts/tests/e2e-corpus-coupling.test.ts keeps e2e specs from inheriting a verdict from the live QA corpus:
# no raw read of a corpus path, no verdict asserted off a verbatim sidecar(), and no read of a derived results tree.
# Each Scenario names the test that executes it.
Feature: E2e specs take no verdict from the live QA corpus

  @test:scripts/tests/e2e-corpus-coupling.test.ts::the_guard_fires::on_a_raw_readFileSync_of_a_sidecar_path_—_the_78a399ee5_shape
  Scenario: A raw readFileSync of a sidecar path is reported as a raw corpus read
    Given spec source that calls readFileSync on a "test/results/witnesses/…/what-is-not-built-yet.block.json" path and asserts a chip has text "fail"
    When the coupling guard scans it
    Then a "raw-corpus-read" finding is reported
    And the first finding is on line 2, where the readFileSync call starts

  @test:scripts/tests/e2e-corpus-coupling.test.ts::the_guard_fires::through_one_and_two_lines_of_indirection
  Scenario: A corpus path reached through two constants is still caught
    Given spec source binding DIR to "test/results/witnesses", FILE to a path joined from DIR, and reading FILE with readFileSync
    When the coupling guard scans it
    Then exactly one "raw-corpus-read" finding is reported

  @test:scripts/tests/e2e-corpus-coupling.test.ts::the_guard_fires::on_the_other_corpora_too_—_kg-qa,_translation-qa,_health_results,_a_qa-index
  Scenario: Raw reads of the kg-qa, translation-qa, health results and qa-index corpora are caught
    Given a readFileSync of each of "test/results/kg-qa/processes/x.kg-qa.json", "docs/source/concepts-harness/overview.fr.translation-qa.json", "test/health/results/example.health-report.json" and "docs/assets/qa/page/qa-index.json"
    When the coupling guard scans each one
    Then each yields exactly one finding

  @test:scripts/tests/e2e-corpus-coupling.test.ts::the_guard_fires::on_a_verdict_asserted_off_a_verbatim_sidecar()_with_nothing_pinned
  Scenario: Verdict literals asserted off a verbatim sidecar() are reported
    Given spec source that loads a witness block through sidecar() with no pinning helper
    And asserts an accessible name of "2 fail, 1 warn, …" and a chip text of "critical"
    When the coupling guard scans it
    Then exactly two "verdict-from-verbatim-sidecar" findings are reported

  @test:scripts/tests/e2e-corpus-coupling.test.ts::the_guard_does_not_fire::on_the_helpers_that_pin_a_verdict
  Scenario: A verdict pinned through sidecarWithVerdicts is not a coupling
    Given spec source that loads a corpus path through sidecarWithVerdicts with a pinned "fail" result
    And asserts a chip has text "fail"
    When the coupling guard scans it
    Then no findings are reported

  @test:scripts/tests/e2e-corpus-coupling.test.ts::the_guard_does_not_fire::on_a_verbatim_sidecar()_whose_assertions_are_shape_only
  Scenario: A verbatim sidecar() with only shape assertions is not a coupling
    Given spec source that loads a kg witness through sidecar()
    And asserts only that an element has text "not recorded"
    When the coupling guard scans it
    Then no findings are reported

  @test:scripts/tests/e2e-corpus-coupling.test.ts::the_guard_does_not_fire::on_site_assets,_or_on_/assets/qa/_as_a_mocked_URL
  Scenario: Site asset reads and mocked /assets/qa/ URLs are not corpus reads
    Given spec source that reads "assets/css/docs-ui.css", names a "/assets/qa/…/qa-index.json" URL constant that is never read, and mocks an "/assets/qa/block.json" route
    And asserts a chip has text "fail"
    When the coupling guard scans it
    Then no findings are reported

  @test:scripts/tests/e2e-corpus-coupling.test.ts::the_real_e2e_specs::are_found_—_a_guard_over_zero_files_passes_vacuously
  Scenario: The real e2e specs are found
    Given the "*.e2e.ts" files under the tools layer's test directory
    When they are collected
    Then more than 10 specs are found

  @test:scripts/tests/e2e-corpus-coupling.test.ts::the_real_e2e_specs::the_known_QA-doc_readers_are_recognised_as_readers
  Scenario: The known QA-doc readers are recognised as corpus readers
    Given the real e2e specs
    When the specs that touch the corpus are picked out
    Then "sdlc/qa-badge.e2e.ts" is among them
    And both "sdlc/qa-panel.e2e.ts" and "sdlc/qa-badge.e2e.ts" contain the text "test/support/fixtures/qa-e2e/"

  @test:scripts/tests/e2e-corpus-coupling.test.ts::the_real_e2e_specs::rule_3_fires_on_a_helper_fed_a_derived-tree_path,_and_not_on_a_fixture_path
  Scenario: A helper fed a derived-tree path is a derived-tree read, a fixture path is not
    Given sidecarWithVerdicts fed a constant bound to a "test/results/witnesses/…" path
    And indexWithRows fed a "test/results/witnesses/…/qa-index.json" path
    And sidecar() fed a "test/support/fixtures/qa-e2e/kg-witness.json" path
    When each is checked for derived-tree reads
    Then the first two each yield one offending call
    And the fixture path yields none

  @test:scripts/tests/e2e-corpus-coupling.test.ts::the_real_e2e_specs::%s_reads_no_derived_results_tree_(rule_3)
  Scenario: No real e2e spec reads a derived results tree
    Given each real "*.e2e.ts" spec under the tools layer's test directory, one row per spec file
    When its source is checked for derived-tree reads
    Then no offending call is found

  @test:scripts/tests/e2e-corpus-coupling.test.ts::the_real_e2e_specs::%s_takes_no_verdict_from_the_live_corpus
  Scenario: No real e2e spec takes a verdict from the live corpus
    Given each real "*.e2e.ts" spec under the tools layer's test directory, one row per spec file
    When the coupling guard scans its source
    Then no raw corpus read and no verdict asserted off a verbatim sidecar() is found
