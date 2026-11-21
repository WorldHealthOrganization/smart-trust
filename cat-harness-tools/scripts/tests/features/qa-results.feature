# QA results: one declared home (test/results/), two renderings of one
# computation, provenance never fabricated, pages that carry structure but no
# verdict, and a writer that does not churn. Each Scenario names the test
# that executes it.
Feature: QA results have one declared home and cannot disagree with their source

  @test:scripts/tests/qa-results.test.ts::the_results_directory_is_DECLARED,_not_merely_created::`cat-harness.json`_declares_`test/results/`_as_a_`qa`_graph
  Scenario: The harness declaration declares test/results/ as a qa graph
    When the harness layer's declaration is read
    Then a directory entry at "test/results" carries the "qa" graph typology

  @test:scripts/tests/qa-results.test.ts::the_results_directory_is_DECLARED,_not_merely_created::...and_the_directory_it_declares_exists_—_or_is_a_kind_that_leaves_`main`
  Scenario: The declared results directory exists or is a kind that may leave main
    Given the declared "test/results" entry
    Then either the directory exists, or the entry is a kind allowed to leave main

  @test:scripts/tests/qa-results.test.ts::the_result_and_the_document_are_two_renderings_of_ONE_computation::every_family_in_a_freshly_rendered_result_matches_the_export's_own_field
  Scenario: Every family of a fresh result matches the export's own field
    When the knowledge-graph export is built and rendered as a QA result
    Then the result's schema is "qa-results/v1"
    And its undeclaredTerms, undeclaredSchemaModules, danglingLinks and problems families hold exactly the export's fields

  @test:scripts/tests/qa-results.test.ts::the_result_and_the_document_are_two_renderings_of_ONE_computation::`total`_is_the_sum,_and_`count`_is_never_derived_on_read
  Scenario: total is the sum of the family counts
    When a result is built with family "a" of two entries and family "b" of none
    Then "a" counts 2, "b" counts 0, and the total is 2

  @test:scripts/tests/qa-results.test.ts::the_result_and_the_document_are_two_renderings_of_ONE_computation::families_are_emitted_in_sorted_order,_so_a_rerun_does_not_churn_the_diff
  Scenario: Families are emitted in sorted order
    When a result is built with families "zeta" and "alpha"
    Then its families are in the order "alpha", "zeta"

  @test:scripts/tests/qa-results.test.ts::provenance_is_never_fabricated::an_unreadable_producer_hashes_to_`unknown`,_not_to_the_empty_string
  Scenario: An unreadable producer hashes to unknown
    Then the source hash of a missing file is "unknown"
    And the source hash of kg-export.ts is 12 hex digits

  @test:scripts/tests/qa-results.test.ts::the_witnesses_are_committed_in_one_place_and_published_in_another::they_live_under_the_declared_results_tree,_not_under_docs/
  Scenario: Witnesses live under the results tree, not under docs/
    # Gap: the check that the witnesses directory exists is skipped whenever the results tree is absent, so only the docs/ half is then asserted.
    Given the harness layer
    Then if the results tree exists its witnesses directory exists
    And the site's assets/qa directory holds nothing but index.json and no witness-shaped file

  @test:scripts/tests/qa-results.test.ts::the_witnesses_are_committed_in_one_place_and_published_in_another::the_badges_still_point_at_`/assets/qa/`,_unchanged_by_the_move
  Scenario: The badges still point at /assets/qa/
    When the generated page concepts/agentic-harness.md is read
    Then it contains a data-qa-src under '/assets/qa/'

  @test:scripts/tests/qa-results.test.ts::a_generated_page_carries_structure,_never_a_verdict::finds_the_generated_pages_at_all
  Scenario: The generated pages are found
    When every generated docs page carrying a QA badge is collected
    Then there are more than 5

  @test:scripts/tests/qa-results.test.ts::a_generated_page_carries_structure,_never_a_verdict::no_page_names_a_verdict_state
  Scenario: No generated page names a verdict state
    Then no generated page carries "fa-qa-pass", "fa-qa-fail", "fa-qa-warn" or "fa-qa-empty"

  @test:scripts/tests/qa-results.test.ts::a_generated_page_carries_structure,_never_a_verdict::no_page_names_a_count,_and_every_openable_badge_says_it_is_still_loading
  Scenario: No page names a count, and every badge starts pending
    Then no generated page holds a counts line like " 0 fail, 0 warn,"
    And every badge button carries "fa-qa-pending"

  @test:scripts/tests/qa-results.test.ts::a_generated_page_carries_structure,_never_a_verdict::every_badge_that_opens_names_the_index_it_is_painted_from
  Scenario: Every badge names the index it is painted from
    Then every badge button carries data-qa-key, data-qa-index, data-qa-label and data-qa-src

  @test:scripts/tests/qa-results.test.ts::writeQaResult_does_not_churn::identical_findings_leave_the_file_untouched
  Scenario: Identical findings leave the file untouched
    Given a result written with no findings
    When the same result is written again
    Then the file's text is unchanged

  @test:scripts/tests/qa-results.test.ts::writeQaResult_does_not_churn::CHANGED_findings_do_rewrite
  Scenario: Changed findings are rewritten
    Given a result written with no findings
    When a result with finding "new" is written
    Then the file contains "new"

  @test:scripts/tests/qa-results.test.ts::writeQaResult_does_not_churn::the_document_carries_no_timestamp,_so_two_branches_cannot_collide_on_one_(y7b3)
  Scenario: The result carries no timestamp
    Then a built result has no updated_at

  @test:scripts/tests/qa-results.test.ts::writeQaResult_does_not_churn::an_old_file_that_still_carries_a_timestamp_reads_STALE,_so_it_is_regenerated_away
  Scenario: A file still carrying a timestamp is stale and regenerated away
    Given a written result to which updated_at has been added
    Then its state against the same result is "stale"
    When the result is written again
    Then the file no longer contains "updated_at"
