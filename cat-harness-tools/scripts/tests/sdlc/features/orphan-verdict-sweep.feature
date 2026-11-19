# pipeline/orphan-verdict-sweep.ts (`check:orphan-verdicts`) finds block QA verdicts whose block
# manifest is gone, which no per-directory check can reach. Each Scenario names the test that executes it.
Feature: Orphaned block verdict sweep

  @test:scripts/tests/sdlc/orphan-verdict-sweep.test.ts::orphanVerdicts::reports_an_ABANDONED_verdict_—_the_case_no_per-directory_check_can_reach
  Scenario: A verdict whose chapter directory is gone is reported as abandoned
    Given a QA verdict for folio/gone/b with no manifest and no chapter directory
    When orphan verdicts are found
    Then there is one, of kind "abandoned"
    And it expects the manifest "folio/gone/b.ts"

  @test:scripts/tests/sdlc/orphan-verdict-sweep.test.ts::orphanVerdicts::distinguishes_MOVED,_where_the_directory_survives_and_validate_sees_it_too
  Scenario: A verdict whose chapter survives but whose manifest is gone is reported as moved
    Given chapter folio/ch with a kept block and a verdict for a block with no manifest
    When orphan verdicts are found
    Then there is one, of kind "moved"

  @test:scripts/tests/sdlc/orphan-verdict-sweep.test.ts::orphanVerdicts::says_nothing_about_a_verdict_whose_block_is_present
  Scenario: A verdict whose block is present is not reported
    Given a QA verdict for folio/ch/b with its manifest
    When orphan verdicts are found
    Then there are none

  @test:scripts/tests/sdlc/orphan-verdict-sweep.test.ts::orphanVerdicts::an_ABSENT_results_tree_finds_nothing_—_and_says_it_EXAMINED_nothing
  Scenario: An absent results tree finds nothing and says it examined nothing
    Given a folio directory with no QA verdicts at all
    When orphan verdicts are found
    Then there are none
    And the sweep reports no orphans, 0 examined and the results tree not present

  @test:scripts/tests/sdlc/orphan-verdict-sweep.test.ts::orphanVerdicts::counts_every_verdict_it_examined,_orphaned_or_not
  Scenario: The sweep counts every verdict it examined, orphaned or not
    Given verdicts for a kept block and for a block with no manifest
    When the sweep runs
    Then it examined 2, the results tree is present, and there is 1 orphan

  @test:scripts/tests/sdlc/orphan-verdict-sweep.test.ts::orphanVerdicts::finds_orphans_nested_at_any_depth,_and_reports_them_sorted
  Scenario: Orphans nested at any depth are found and reported sorted
    Given orphaned verdicts for folio/a/deep/z and folio/a/b
    When orphan verdicts are found
    Then there are 2
    And their verdict paths are in sorted order

  @test:scripts/tests/sdlc/orphan-verdict-sweep.test.ts::check:orphan-verdicts,_the_CLI::refuses_with_exit_2_over_an_absent_results_tree,_and_prints_no_pass
  Scenario: The CLI refuses with exit 2 over an absent results tree and prints no pass
    Given a layer root with a folio directory and no QA verdicts
    When the orphan-verdict-sweep CLI is run there
    Then it exits 2
    And its output has no "✓"
    And it says "examined 0 members" and names "qa:fetch"
