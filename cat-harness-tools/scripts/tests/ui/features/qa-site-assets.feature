# scripts/qa-site-assets.ts decides where the site's QA evidence comes from (checkout, fetched or
# unavailable), judges whether all of it was published, and writes the tree-to-commit index.
# Each Scenario names the test that executes it.
Feature: QA site assets source, shrink check and tree-commit index

  @test:scripts/tests/ui/qa-site-assets.test.ts::countResults_/_countPublished::counts_the_two_published_shapes,_and_an_absent_tree_is_zeros
  Scenario: Results are counted in both published shapes and an absent tree counts zero
    Given a results tree with three witness files, two .qa-results.json files and one kg-qa file
    When its results are counted
    Then it holds 3 witnesses, 2 results and 6 files
    And a directory that does not exist counts 0 witnesses, 0 results and 0 files

  @test:scripts/tests/ui/qa-site-assets.test.ts::countResults_/_countPublished::a_site's_top-level_index.json_and_availability.json_are_not_evidence
  Scenario: A site's top-level index.json and availability.json are not counted as evidence
    Given a site whose assets/qa holds index.json, availability.json, one results file and one witness
    When its published evidence is counted
    Then it holds 1 witness and 1 result
    And a directory that does not exist counts 0 witnesses and 0 results

  @test:scripts/tests/ui/qa-site-assets.test.ts::countResults_/_countPublished::a_top-level_file_the_witness_tree_carries_is_counted_on_both_sides_(4l4d's_translation-qa-pages.json)
  Scenario: A top-level file in the witness tree is counted on both sides
    Given a witness tree holding translation-qa-pages.json at its top and one page witness
    And a site holding the same two files beside index.json and availability.json
    When both are counted
    Then the results tree counts 2 witnesses
    And the published site counts 2 witnesses and 0 results

  @test:scripts/tests/ui/qa-site-assets.test.ts::decideSource::on_a_PR_preview,_a_checkout_holding_the_corpus_publishes_it_as_checked_out,_even_when_the_store_has_a_PR_entry
  Scenario: On a PR preview a checkout holding the corpus is published as checked out
    Given a checkout holding the corpus
    And a store hit on "pr/1/abc" with larger counts
    When the source is decided
    Then the source is "checkout"
    And the expected counts are the checkout's

  @test:scripts/tests/ui/qa-site-assets.test.ts::decideSource::on_a_main_build,_an_exact_main/<sha>_hit_wins_over_a_committed_checkout_corpus_(tfqf_precedence_rule)
  Scenario: On a main build an exact main/<sha> hit wins over a committed checkout corpus
    Given a checkout holding the corpus
    And an exact first store hit on "main/abc"
    When the source is decided
    Then the source is "fetched"
    And the expected counts are the store entry's
    And the reason says the exact main/<sha> entry for this commit wins over the checkout

  @test:scripts/tests/ui/qa-site-assets.test.ts::decideSource::on_a_main_build,_a_fallback_or_floating/non-corpus_hit_does_NOT_override_a_committed_checkout_corpus
  Scenario: A fallback, inexact or non-corpus hit does not override a committed checkout corpus
    Given a checkout holding the corpus
    When the source is decided against a fallback hit on "main/older", a "main/abc" hit marked not exact, and a "main/abc" hit marked as not a corpus
    Then each time the source is "checkout"

  @test:scripts/tests/ui/qa-site-assets.test.ts::decideSource::an_absent_corpus_with_an_exact_hit_is_`fetched`,_judged_against_the_ENTRY's_counts
  Scenario: An absent corpus with an exact hit is fetched and judged against the entry's counts
    Given a checkout with no corpus
    And an exact store hit on "main/abc"
    When the source is decided
    Then the source is "fetched" and the expected counts are the entry's

  @test:scripts/tests/ui/qa-site-assets.test.ts::decideSource::a_hit_on_a_fallback_ref_is_labelled_as_another_commit's_evidence
  Scenario: A hit on a fallback ref is labelled as another commit's evidence
    Given a checkout with no corpus
    And a store hit on the second ref "main/older"
    When the source is decided
    Then the source is "fetched-fallback"
    And the reason contains "ANOTHER commit"

  @test:scripts/tests/ui/qa-site-assets.test.ts::decideSource::no_corpus_and_no_hit_is_`unavailable`,_never_an_empty_success
  Scenario: No corpus and no hit is unavailable
    Given a checkout with no corpus and no store hit
    When the source is decided
    Then the source is "unavailable"
    And the reason contains "QA not available for this ref"

  @test:scripts/tests/ui/qa-site-assets.test.ts::holdsCorpus_—_a_build's_own_leftovers_are_not_a_corpus::one_build-written_result_is_NOT_a_corpus;_a_verdict_family_is
  Scenario: One build-written result is not a corpus but a verdict family is
    Given a results tree holding only kg-export.qa-results.json
    Then it does not hold a corpus
    And with no store hit the source is decided "unavailable"
    And once a kg-qa directory is added it holds a corpus

  @test:scripts/tests/ui/qa-site-assets.test.ts::judgePublished_—_the_C10_shrink_fails_the_step::everything_landed:_no_error,_and_the_availability_document_says_where_it_came_from
  Scenario: When everything landed there is no error and availability names the source
    Given a "checkout" fetch state for key "main/abc" expecting 3 witnesses, 2 results and 10 files
    When the publish is judged with all of them present and published
    Then there are no errors
    And the availability document has the availability schema, source "checkout" and key "main/abc"

  @test:scripts/tests/ui/qa-site-assets.test.ts::judgePublished_—_the_C10_shrink_fails_the_step::results_that_existed_at_the_start_and_did_not_publish_are_a_SHRINK
  Scenario: Results that existed at the start and did not publish are a shrink
    Given a fetch state expecting 20 results
    When the publish is judged with 1 result present and 1 published
    Then the errors mention "SHRINK"

  @test:scripts/tests/ui/qa-site-assets.test.ts::judgePublished_—_the_C10_shrink_fails_the_step::a_copy_that_dropped_files_present_NOW_is_an_error_whatever_the_source
  Scenario: A copy that dropped files present now is an error whatever the source
    Given an "unavailable" fetch state expecting nothing
    When the publish is judged with 2 witnesses and 1 result present but none published
    Then there are 2 errors

  @test:scripts/tests/ui/qa-site-assets.test.ts::judgePublished_—_the_C10_shrink_fails_the_step::`unavailable`_is_a_warning_and_a_published_state,_not_an_error
  Scenario: Unavailable is a warning and a published state, not an error
    Given an "unavailable" fetch state with reason "QA not available for this ref"
    When the publish is judged with nothing present or published
    Then there are no errors
    And the only warning is "QA not available for this ref"
    And the availability source is "unavailable"

  @test:scripts/tests/ui/qa-site-assets.test.ts::judgePublished_—_the_C10_shrink_fails_the_step::a_fallback_entry's_witness_shortfall_warns_rather_than_fails;_its_results_shortfall_still_fails
  Scenario: A fallback entry's witness shortfall warns but its results shortfall fails
    Given a "fetched-fallback" fetch state expecting 10 witnesses and 2 results
    When the publish is judged with 8 witnesses and 2 results
    Then there are no errors and one warning
    And when it is judged with 10 witnesses and 1 result the errors mention "SHRINK"

  @test:scripts/tests/ui/qa-site-assets.test.ts::tree-commits:_the_tree-to-commit_index::each_tree_keeps_the_OLDEST_first-parent_commit_carrying_it
  Scenario: Each tree keeps the oldest first-parent commit carrying it
    Given a newest-first log where tree a is on commits 1 and 3 and tree b on commit 2
    When the tree-commit index is built with origin "https://github.com/o/r"
    Then it has the tree-commits schema
    And tree a maps to commit 3 and tree b to commit 2
    And its depth is 3
    And its repo is "https://github.com/o/r"

  @test:scripts/tests/ui/qa-site-assets.test.ts::tree-commits:_the_tree-to-commit_index::each_tree_carries_its_kept_commit's_date,_so_a_verdict's_date_is_derived_from_its_tree
  Scenario: Each tree carries its kept commit's date
    Given a dated log where tree a is on commits 1 and 3 and tree b on commit 2
    When the tree-commit index is built
    Then tree a maps to commit 3
    And the dates are "2026-11-04T09:00:00Z" for tree a and "2026-11-05T10:00:00+01:00" for tree b

  @test:scripts/tests/ui/qa-site-assets.test.ts::tree-commits:_the_tree-to-commit_index::a_log_without_dates_still_reads,_and_carries_no_dates
  Scenario: A log without dates still reads and carries no dates
    Given a one-line log without a date
    When the tree-commit index is built
    Then the tree maps to its commit
    And the index has no dates

  @test:scripts/tests/ui/qa-site-assets.test.ts::tree-commits:_the_tree-to-commit_index::readTreeCommitIndex_reads_this_repository's_own_history,_with_dates
  Scenario: The tree-commit index reads this repository's own history with dates
    Given this repository's checkout
    When its tree-commit index is read to depth 3
    Then the depth is above 0
    And the first tree's date looks like an ISO timestamp

  @test:scripts/tests/ui/qa-site-assets.test.ts::tree-commits:_the_tree-to-commit_index::no_GitHub_origin:_no_repo,_so_the_panel_builds_no_link
  Scenario: Without a GitHub origin the index has no repo
    When the tree-commit index is built with no origin, a GitLab origin, or a GitHub URL with an extra path segment
    Then each time its repo is null

  @test:scripts/tests/ui/qa-site-assets.test.ts::tree-commits:_the_tree-to-commit_index::lines_that_are_not_two_full_ids_are_skipped,_never_guessed
  Scenario: Lines that are not two full ids are skipped
    Given a log of a garbage line, a lone tree id, and a tree and commit followed by a non-date word
    When the tree-commit index is built
    Then it maps no trees
    And its depth is 0

  @test:scripts/tests/ui/qa-site-assets.test.ts::tree-commits:_the_tree-to-commit_index::the_index_is_not_counted_as_QA_evidence
  Scenario: The tree-commit index is not counted as QA evidence
    Given a site whose assets/qa holds the tree-commits file and one witness
    When its published evidence is counted
    Then it holds 1 witness
