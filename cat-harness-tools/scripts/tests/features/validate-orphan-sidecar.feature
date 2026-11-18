# no-orphan-sidecar: a QA verdict for a block that does not exist is an error,
# beside the block or in the mirrored results tree. Each Scenario names the
# test that executes it.
Feature: Orphan QA sidecars

  @test:scripts/tests/validate-orphan-sidecar.test.ts::no-orphan-sidecar::flags_a_.qa.json_whose_.ts_is_gone
  Scenario: A sidecar with no block is an orphan
    Given a chapter directory with block "alpha" and a sidecar "ghost.qa.json"
    When the directory is validated
    Then there is one orphan issue naming "ghost.qa.json"

  @test:scripts/tests/validate-orphan-sidecar.test.ts::no-orphan-sidecar::does_not_flag_a_sidecar_that_has_its_manifest
  Scenario: A sidecar with its block is not an orphan
    Given block "alpha" and its sidecar
    Then there are no orphan issues

  @test:scripts/tests/validate-orphan-sidecar.test.ts::no-orphan-sidecar::clean_chapter_with_no_sidecars_at_all_is_fine
  Scenario: No sidecars, no orphans
    Given blocks "alpha" and "beta" with no sidecars
    Then there are no orphan issues

  @test:scripts/tests/validate-orphan-sidecar.test.ts::no-orphan-sidecar::reports_every_orphan,_not_just_the_first
  Scenario: Every orphan is reported
    Given sidecars "ghost-one" and "ghost-two" with no blocks
    Then there are two orphan issues

  @test:scripts/tests/validate-orphan-sidecar.test.ts::no-orphan-sidecar::does_not_flag_a_paper-level_audit_artefact_that_shares_the_extension
  Scenario: A paper-level audit artefact is not an orphan
    Given a "section-title-audit.qa.json" that is not a block verdict
    Then there are no orphan issues

  @test:scripts/tests/validate-orphan-sidecar.test.ts::no-orphan-sidecar::still_flags_a_genuine_orphan_sitting_beside_a_paper-level_artefact
  Scenario: A real orphan beside a paper-level artefact is still flagged
    Given a paper-level audit artefact and an orphan "ghost.qa.json"
    Then there is one orphan issue naming "ghost.qa.json"

  @test:scripts/tests/validate-orphan-sidecar.test.ts::no-orphan-sidecar::flags_an_unparseable_sidecar_rather_than_excusing_it
  Scenario: An unparseable sidecar is flagged
    Given "corrupt.qa.json" holding invalid JSON
    Then there is one orphan issue naming "corrupt.qa.json"

  @test:scripts/tests/validate-orphan-sidecar.test.ts::no-orphan-sidecar::is_an_error,_not_a_warning
  Scenario: An orphan is an error
    Given an orphan sidecar
    Then its issue has level "error"

  @test:scripts/tests/validate-orphan-sidecar.test.ts::no-orphan-sidecar_in_chapter_mode::still_flags_an_orphan_when_blockNames_is_supplied
  Scenario: Chapter mode still flags an orphan
    Given a chapter directory with a chapter manifest listing "alpha" and an orphan "ghost.qa.json"
    Then there is one orphan issue naming "ghost.qa.json"

  @test:scripts/tests/validate-orphan-sidecar.test.ts::no-orphan-sidecar_in_chapter_mode::a_sidecar_whose_manifest_exists_but_was_not_requested_is_not_an_orphan
  Scenario: A sidecar of an unlisted block on disk is not an orphan
    Given a chapter manifest listing "alpha" and a block "beta" on disk with its sidecar
    Then there are no orphan issues

  @test:scripts/tests/validate-orphan-sidecar.test.ts::no-orphan-sidecar_in_the_results_tree::the_BLOCK-MOVED_case:_the_verdict_left_behind_at_the_old_path_is_flagged
  Scenario: A verdict left at a moved block's old mirror path is flagged
    Given a folio where "moved" moved from ch-a to ch-b and the ch-a mirror still holds its verdict
    When ch-a is validated from inside the folio
    Then there is one orphan issue naming "moved.qa.json" at the ch-a mirror path

  @test:scripts/tests/validate-orphan-sidecar.test.ts::no-orphan-sidecar_in_the_results_tree::...and_the_verdict_at_the_block's_NEW_path_is_not_flagged
  Scenario: The verdict at the new path is not flagged
    When ch-b is validated from inside the folio
    Then there are no orphan issues

  @test:scripts/tests/validate-orphan-sidecar.test.ts::no-orphan-sidecar_in_the_results_tree::a_verdict_in_the_results_tree_whose_block_exists_is_not_an_orphan
  Scenario: A mirrored verdict whose block exists is not an orphan
    Given block "alpha" in ch-a and its verdict in the ch-a mirror
    Then there are no orphan issues

  @test:scripts/tests/validate-orphan-sidecar.test.ts::no-orphan-sidecar_in_the_results_tree::no_mirror_for_THIS_directory,_inside_a_present_results_tree,_is_a_determined_ZERO
  Scenario: No mirror for this chapter is a determined zero
    Given a results tree holding verdicts for ch-b only
    When ch-a is validated
    Then there are no orphan issues and no "could not read" or "could not determine" notice

  @test:scripts/tests/validate-orphan-sidecar.test.ts::no-orphan-sidecar_in_the_results_tree::an_ABSENT_results_tree_is_UNKNOWN,_said_once,_never_a_clean_pass_(C7)
  Scenario: An absent results tree is unknown
    Given a folio with no results tree
    When ch-a is validated
    Then there are no orphan issues
    And there is one warning "could not determine orphans" naming "qa:fetch"

  @test:scripts/tests/validate-orphan-sidecar.test.ts::no-orphan-sidecar_in_the_results_tree::a_LEGACY_verdict_beside_its_block_is_not_flagged_for_being_legacy
  Scenario: A legacy verdict beside its block is not flagged
    Given "alpha.qa.json" beside block "alpha" in the folio
    Then there are no orphan issues

  @test:scripts/tests/validate-orphan-sidecar.test.ts::no-orphan-sidecar_in_the_results_tree::a_genuinely_orphaned_LEGACY_verdict_is_still_caught_inside_a_folio_root
  Scenario: An orphaned legacy verdict is caught
    Given "ghost.qa.json" beside the blocks in the folio with no block "ghost"
    Then there is one orphan issue naming "ghost.qa.json"

  @test:scripts/tests/validate-orphan-sidecar.test.ts::no-orphan-sidecar_in_the_results_tree::a_non-block_artefact_in_the_results_tree_keeps_the_carve-out
  Scenario: A non-block artefact in the results tree is not an orphan
    Given a "section-title-audit.qa.json" in the ch-a mirror
    Then there are no orphan issues

  @test:scripts/tests/validate-orphan-sidecar.test.ts::no-orphan-sidecar_in_the_results_tree::an_unparseable_verdict_in_the_results_tree_is_reported,_not_excused
  Scenario: An unparseable mirrored verdict is reported
    Given "corrupt.qa.json" holding invalid JSON in the ch-a mirror
    Then there is one orphan issue naming "corrupt.qa.json"

  @test:scripts/tests/validate-orphan-sidecar.test.ts::no-orphan-sidecar_third_state::a_directory_outside_the_resolved_root_reports_that_it_could_not_look
  Scenario: A directory outside the resolved root says it could not look
    Given a chapter directory outside any layer root
    Then an issue says "could not read the results tree"

  @test:scripts/tests/validate-orphan-sidecar.test.ts::no-orphan-sidecar_third_state::...and_that_notice_is_NOT_counted_as_an_orphan_finding
  Scenario: The could-not-look notice is not an orphan
    Given a chapter directory outside any layer root
    Then there are no orphan issues

  @test:scripts/tests/validate-orphan-sidecar.test.ts::no-orphan-sidecar_third_state::an_EMPTY_directory_still_reports_the_empty-corpus_error,_not_the_notice
  Scenario: An empty directory still refuses success
    # Gap: the title says the notice is not reported; the body checks only that the run is invalid and refuses success.
    When an empty directory is validated
    Then it is not valid and an issue says "refusing to report success"
