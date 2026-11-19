# scripts/check-qa-corpus.ts validates a fetched qa-reports tree: every kg-qa home's sidecars and
# manifest, and the witness tree the site's badge pages fetch from. Run over fixture trees, never
# the committed corpus. Each Scenario names the test that executes it.
Feature: Checking the QA corpus and its witness tree

  @test:scripts/tests/check-qa-corpus.test.ts::the_layout_it_walks_comes_from_the_declarations,_hosted_homes_included::names_cat-harness's_own_qa_directory_and_every_hosted_kg-qa_home
  Scenario: The walked layout names the own qa directory and every hosted kg-qa home
    Given this checkout's declarations
    When the corpus layout is derived
    Then its directories include "cat-harness/test/results"
    And its hosted homes include the bootstrap, bootstrap-tools and cat-harness-tools result directories

  @test:scripts/tests/check-qa-corpus.test.ts::validateQaTree_over_a_fixture::a_clean_tree_is_ok,_and_the_hosted_home's_sidecar_is_counted
  Scenario: A clean tree is ok and the hosted home's sidecar is counted
    Given a fixture tree with an own home and a hosted home, each holding a manifest and one clean sidecar
    When the tree is validated
    Then there are no findings
    And the report is judged "ok"
    And the hosted home counts 1 sidecar

  @test:scripts/tests/check-qa-corpus.test.ts::validateQaTree_over_a_fixture::FAILS_on_a_planted_conflict_marker_in_a_hosted_home
  Scenario: A planted conflict marker in a hosted home fails the tree
    Given a clean fixture tree plus a hosted sidecar holding 8-wide rename/rename conflict markers
    When the tree is validated
    Then the report is judged "finding"
    And the only finding is "conflict-marker" on that hosted sidecar's path

  @test:scripts/tests/check-qa-corpus.test.ts::validateQaTree_over_a_fixture::fails_on_a_schema_break,_an_unknown_criterion,_a_fail_without_findings_and_a_failing_critical
  Scenario: Schema breaks, unknown criteria, fails without findings and failing criticals are findings
    Given a clean fixture tree plus four own sidecars: one breaking the schema, one naming an unknown criterion, one failing with no findings, and one leaving a critical criterion "unknown"
    When the tree is validated
    Then the findings are, in order, "schema", "unknown-criterion", "fail-without-findings" and "critical-failing" on those four files

  @test:scripts/tests/check-qa-corpus.test.ts::validateQaTree_over_a_fixture::a_home_holding_sidecars_with_no_manifest_beside_them_is_a_finding
  Scenario: A home holding sidecars with no manifest is a finding
    Given a clean fixture tree with the hosted home's manifest removed
    When the tree is validated
    Then the only finding is "manifest-missing" at the hosted home's manifest path

  @test:scripts/tests/check-qa-corpus.test.ts::validateQaTree_over_a_fixture::an_empty_tree_is_UNKNOWN,_never_ok_—_a_miss_is_not_a_clean_corpus
  Scenario: An empty tree is judged unknown, never ok
    Given an empty directory
    When the tree is validated
    Then no files are examined
    And the report is judged "unknown"

  @test:scripts/tests/check-qa-corpus.test.ts::the_witness_tree_the_site_publishes,_against_the_pages_that_fetch_from_it::a_tree_holding_the_index,_every_row_and_every_projection_is_clean
  Scenario: A witness tree with the index, every row and every projection is clean
    Given a page with two badges fetching from a demo witness tree
    And the tree holds an index listing both badge keys and a projection for each
    When the witnesses are judged against the page
    Then there are no findings
    And validating the tree with that page counts 1 page

  @test:scripts/tests/check-qa-corpus.test.ts::the_witness_tree_the_site_publishes,_against_the_pages_that_fetch_from_it::names_a_missing_index,_a_missing_row,_a_missing_projection_and_a_`_`-prefixed_path
  Scenario: Missing index rows, missing projections, underscore paths and a missing index are named
    Given a page with badges "overview.block" and "other.block"
    And a witness tree whose index lists only "overview.block", with no "other.block" projection and a "_hidden.json" file
    When the witnesses are judged against the page
    Then the findings are "witness-index-row-missing" on the index, "witness-url-missing" on the other.block projection and "witness-underscore-path" on "_hidden.json"
    And a tree holding no witness index at all gets a "witness-index-missing" finding

  @test:scripts/tests/check-qa-corpus.test.ts::the_witness_tree_the_site_publishes,_against_the_pages_that_fetch_from_it::a_key_the_index_lists_as_`unswept`_needs_no_row_and_no_projection_(bean_`4l4d`)
  Scenario: A key the index lists as unswept needs no row and no projection
    Given a page with badges "overview.block" and "other.block"
    And an index with corpus "present", a row for "overview.block" only, and "other.block" listed as unswept
    And a projection for "overview.block" only
    When the witnesses are judged against the page
    Then there are no findings

  @test:scripts/tests/check-qa-corpus.test.ts::the_witness_tree_the_site_publishes,_against_the_pages_that_fetch_from_it::an_index_written_WITHOUT_the_corpus_is_a_finding_in_a_published_tree
  Scenario: An index written without the corpus is a finding
    Given a page with two badges
    And a witness index with corpus "absent", no badge rows and nothing unswept
    When the witnesses are judged against the page
    Then the findings include "witness-index-corpus-absent"
    And they include "witness-index-row-missing"

  @test:scripts/tests/check-qa-corpus.test.ts::the_witness_tree_the_site_publishes,_against_the_pages_that_fetch_from_it::finds_this_checkout's_generated_badge_pages_—_a_filter_over_nothing_would_pass
  Scenario: The checker finds this checkout's generated badge pages
    Given this checkout
    When its badge pages are listed
    Then there are at least 2

  @test:scripts/tests/check-qa-corpus.test.ts::the_CLI::exits_1_on_the_planted_marker_and_0_on_the_clean_fixture
  Scenario: The CLI exits 1 on a planted marker and 0 on a clean fixture
    Given a fixture tree with a planted conflict marker and a clean fixture tree
    When the CLI is run with "--dir" over each
    Then it exits 1 on the planted marker
    And it exits 0 on the clean tree with "--no-pages"
    And it exits 1 on the clean tree without "--no-pages", since the checkout's badge pages find no witnesses there

  @test:scripts/tests/check-qa-corpus.test.ts::the_CLI::refuses_an_ambiguous_invocation_with_exit_2
  Scenario: The CLI refuses an invocation with no arguments
    When the CLI is run with no arguments
    Then it exits 2
