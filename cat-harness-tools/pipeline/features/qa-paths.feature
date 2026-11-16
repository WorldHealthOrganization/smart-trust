# pipeline/qa-paths.ts holds the block-QA path contract: verdicts are written to
# the results tree, read from it first with the legacy sibling as fallback, and
# anchored at the content repository's root. Each Scenario names the test that executes it.
Feature: Block QA verdict paths

  @test:pipeline/qa-paths.test.ts::where_a_verdict_is_READ_from::prefers_the_results_tree_when_BOTH_exist_—_the_case_nothing_else_covers
  Scenario: The results-tree verdict is preferred when both exist
    Given a block with both a legacy sibling verdict and a results-tree verdict
    When the existing verdict path is looked up
    Then it is the results-tree path
    And that file's content contains "results"

  @test:pipeline/qa-paths.test.ts::where_a_verdict_is_READ_from::falls_back_to_the_legacy_sibling_when_only_that_exists
  Scenario: The legacy sibling is found when only it exists
    Given a block with only a legacy sibling verdict
    When the existing verdict path is looked up
    Then it is the legacy sibling path

  @test:pipeline/qa-paths.test.ts::where_a_verdict_is_READ_from::finds_the_results-tree_verdict_when_only_that_exists
  Scenario: The results-tree verdict is found when only it exists
    Given a block with only a results-tree verdict
    When the existing verdict path is looked up
    Then it is the results-tree path

  @test:pipeline/qa-paths.test.ts::where_a_verdict_is_READ_from::returns_undefined_when_there_is_none_—_genuinely_unaudited,_not_'looked_in_the_wrong_place'
  Scenario: A block with no verdict has no existing verdict path
    Given a block with no verdict
    When the existing verdict path is looked up
    Then it is undefined

  @test:pipeline/qa-paths.test.ts::where_a_verdict_is_READ_from::lists_both_candidates,_newest_convention_first
  Scenario: Both read candidates are listed, results tree first
    Given a block with no verdict
    When its verdict read paths are listed
    Then they are the results-tree path followed by the legacy sibling path

  @test:pipeline/qa-paths.test.ts::where_a_verdict_is_WRITTEN::is_always_the_results_tree,_never_the_legacy_sibling
  Scenario: Verdicts are written to the results tree, never the legacy sibling
    Given a block with a legacy sibling verdict
    When its write path is computed
    Then it is under the block QA results directory
    And it is not the legacy sibling path

  @test:pipeline/qa-paths.test.ts::where_a_verdict_is_WRITTEN::mirrors_the_block's_directory_rather_than_flattening_it
  Scenario: The write path mirrors the block's directory
    Given two blocks named "intro" in chapters "ch-a" and "ch-b"
    When their write paths are computed
    Then the two paths differ
    And the first contains "folio/ch-a"

  @test:pipeline/qa-paths.test.ts::the_inverse,_which_no-orphan-sidecar_depends_on::round-trips_a_results-tree_verdict_back_to_its_manifest
  Scenario: A results-tree verdict maps back to its block manifest
    Given the block "folio/ch/b"
    When its results-tree verdict path is mapped back to a block
    Then the result is "folio/ch/b.ts"

  @test:pipeline/qa-paths.test.ts::the_inverse,_which_no-orphan-sidecar_depends_on::refuses_a_path_outside_the_results_tree,_so_a_legacy_sibling_cannot_map_onto_itself
  Scenario: A path outside the results tree maps to no block
    Given the block "folio/ch/b"
    When its legacy sibling verdict path is mapped back to a block
    Then the result is undefined

  @test:pipeline/qa-paths.test.ts::findContentRepoRoot:_where_a_sweep_anchors_(s3p2)::a_sweep_of_a_scaffolded_folio's_content_graph_anchors_at_the_folio's_ROOT,_not_at_the_swept_directory
  Scenario: A sweep of a scaffolded folio's content anchors at the folio root
    Given a document folio scaffolded by init-folio
    When the content repository root is found from its "folio" directory
    Then it is the folio root
    And from a block path deep under "folio/doc/chapter" it is the same root
    And the block's verdict path is "test/results/block-qa/folio/doc/chapter/a-block.qa.json" under the root

  @test:pipeline/qa-paths.test.ts::findContentRepoRoot:_where_a_sweep_anchors_(s3p2)::a_directory_holding_`.git`_still_anchors,_as_a_legacy_folio_like_qou_does
  Scenario: A directory holding .git anchors the content repository
    Given a directory holding ".git" and "content/ch"
    When the content repository root is found from "content/ch"
    Then it is that directory
