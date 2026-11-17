# scripts/staging-rotate.ts caps the staging previews on gh-pages at a 3 GB size
# budget, removing the oldest first and never the preview being staged, _retired/
# or non-preview entries. Each Scenario names the test that executes it.
Feature: Rotating staging previews under the size budget

  @test:scripts/tests/sdlc/staging-rotate.test.ts::the_cap_is_the_owner's_number::3_GB_of_previews_in_total,_defined_once
  Scenario: The preview budget is 3 GB
    Then the maximum preview bytes is 3 × 1024³

  @test:scripts/tests/sdlc/staging-rotate.test.ts::planRotation_—_pure::under_the_budget,_nothing_is_removed
  Scenario: Under the budget nothing is removed
    Given previews "a", "b" and "c" of 100 bytes each and a budget of 1000
    When the rotation is planned with "a" current
    Then nothing is removed
    And all three are kept

  @test:scripts/tests/sdlc/staging-rotate.test.ts::planRotation_—_pure::exactly_at_the_budget,_nothing_is_removed_—_the_current_preview_counts
  Scenario: Exactly at the budget nothing is removed, counting the current preview
    Given ten previews of 100 bytes each and a budget of 1000
    When the rotation is planned with "s0" current
    Then nothing is removed

  @test:scripts/tests/sdlc/staging-rotate.test.ts::planRotation_—_pure::over_the_budget,_the_OLDEST_are_removed
  Scenario: Over the budget the oldest are removed
    Given thirteen 100-byte previews "s00" to "s12", aged 0 to 12 hours, and a budget of 1000
    When the rotation is planned with "s00" current
    Then "s10", "s11" and "s12" are removed
    And ten are kept

  @test:scripts/tests/sdlc/staging-rotate.test.ts::planRotation_—_pure::size_decides_how_many_fit:_one_large_preview_displaces_several_small_ones
  Scenario: Size decides how many previews fit
    Given current "cur" of 300 bytes, "big" of 500 bytes, and "a", "b", "c" of 100 bytes each from newest to oldest, with a budget of 1000
    When the rotation is planned
    Then "cur", "big", "a" and "b" are kept
    And "c" is removed

  @test:scripts/tests/sdlc/staging-rotate.test.ts::planRotation_—_pure::strictly_by_recency:_an_older_small_preview_never_outlives_a_newer_one_that_did_not_fit
  Scenario: An older small preview never outlives a newer one that did not fit
    Given current "cur" of 600 bytes, "newer" of 500 bytes and "older" of 100 bytes, with a budget of 1000
    When the rotation is planned
    Then only "cur" is kept
    And "newer" and "older" are removed

  @test:scripts/tests/sdlc/staging-rotate.test.ts::planRotation_—_pure::the_current_preview_is_never_removed,_even_when_it_is_the_oldest
  Scenario: The current preview is never removed, even when oldest
    Given current "cur" 9999 hours old and twelve newer 100-byte previews, with a budget of 1000
    When the rotation is planned
    Then "cur" is kept and not removed
    And ten previews are kept

  @test:scripts/tests/sdlc/staging-rotate.test.ts::planRotation_—_pure::a_current_preview_over_the_whole_budget_is_kept,_and_everything_else_goes
  Scenario: A current preview over the whole budget is kept and everything else goes
    Given current "cur" of 5000 bytes and previews "a" and "b", with a budget of 1000
    When the rotation is planned
    Then only "cur" is kept
    And "a" and "b" are removed

  @test:scripts/tests/sdlc/staging-rotate.test.ts::planRotation_—_pure::the_current_preview_not_yet_on_the_tree_takes_no_bytes
  Scenario: A current preview not yet on the tree takes no bytes
    Given ten 100-byte previews "o0" to "o9" and a current slug "new" not among them
    When the rotation is planned with a budget of 1000
    Then nothing is removed
    And with a budget of 900 only "o9" is removed

  @test:scripts/tests/sdlc/staging-rotate.test.ts::planRotation_—_pure::unknown_ages_sort_oldest;_ties_break_by_slug
  Scenario: Unknown ages sort oldest and ties break by slug
    Given current "cur", "b" and "z" both 5 hours old, and "u" of unknown age, with a budget of 200
    When the rotation is planned
    Then "cur" and "b" are kept
    And "z" then "u" are removed

  @test:scripts/tests/sdlc/staging-rotate.test.ts::planRotation_—_pure::a_budget_that_is_not_a_positive_number_of_bytes_is_refused
  Scenario: A budget that is not a positive number of bytes is refused
    Then planning with a budget of 0 throws
    And planning with a budget of NaN throws

  @test:scripts/tests/sdlc/staging-rotate.test.ts::what_counts_as_a_preview::_retired,_dot-_and_underscore-entries_and_non-slugs_are_not_previews
  Scenario: _retired, dot- and underscore-entries and non-slugs are not preview names
    Then "_retired", ".git", "_reserved" and "has space" are not preview names
    And "claude-foo-bar" is a preview name

  @test:scripts/tests/sdlc/staging-rotate.test.ts::rotate_—_on_a_checkout::under_the_budget,_nothing_is_removed_and_the_current_preview_is_stamped
  Scenario: On a checkout under the budget nothing is removed and the current preview is stamped
    Given a gh-pages checkout with unstamped "cur" and previews "a" and "b"
    When the rotation runs with "cur" current
    Then nothing is removed
    And "a", "b" and "cur" remain under branches
    And the current preview's staged-at stamp is the current time

  @test:scripts/tests/sdlc/staging-rotate.test.ts::rotate_—_on_a_checkout::over_the_budget,_the_oldest_go,_each_with_a_render-log_entry_and_a_retired_record
  Scenario: On a checkout over the budget the oldest go with a render-log entry and a retired record
    Given a gh-pages checkout with "cur" and eleven previews "p00" to "p10", the oldest with a staging-preview record
    When the rotation runs with "cur" current and a budget of 1300
    Then "p09" and "p10" are removed from the tree and "cur" remains
    And the first output line says "rotated off branches/p09: 10.0h old"
    And "_retired/p10.json" is a record retired now with a reason naming "#1868"
    And the day's render log has a "removed" event for "branches/p09" and "branches/p10"

  @test:scripts/tests/sdlc/staging-rotate.test.ts::rotate_—_on_a_checkout::_retired_and_non-preview_entries_are_untouched,_and_do_not_count_toward_the_budget
  Scenario: _retired and non-preview entries are untouched and do not count toward the budget
    Given a gh-pages checkout with "cur", "a", "b", a "_retired/old.json", a "README.txt" and a ".hidden" directory
    When the rotation runs with "cur" current and a budget of 300
    Then only "b" is removed
    And ".hidden", "README.txt", "_retired", "a" and "cur" remain
    And "_retired/old.json" still holds "{}"

  @test:scripts/tests/sdlc/staging-rotate.test.ts::rotate_—_on_a_checkout::a_missing_stamp_falls_back:_render_log,_then_record,_then_git
  Scenario: A missing stamp falls back to the render log, then the record, then git
    Given unstamped previews "cur", "logged" with a render-log entry, "recorded" with a staging-preview record, and "gitonly" known only to git
    When the previews are read
    Then their age sources are "render-log", "record", "git" and "unknown" respectively
    And when the rotation runs with a budget of 250, "cur" and "logged" are kept
    And "recorded" and "gitonly" are removed

  @test:scripts/tests/sdlc/staging-rotate.test.ts::rotate_—_on_a_checkout::refuses_a_current_slug_that_is_not_a_preview_name
  Scenario: A current slug that is not a preview name is refused
    Given an empty gh-pages checkout
    Then rotating with current "_retired" throws
    And rotating with current ".." throws

  @test:scripts/tests/sdlc/staging-rotate.test.ts::the_stage_job_runs_the_rotation_where_a_lost_race_re-applies_it::inside_the_attempt_loop,_after_the_re-read_and_before_the_push
  Scenario: The stage job rotates inside the attempt loop, after the re-read and before the push
    # Gap: checks the workflow text only; the job is not run
    Given the deploy step of feature-staging.yml
    Then the attempt loop, the reset to FETCH_HEAD, the rotation and the push all appear
    And they appear in that order

  @test:scripts/tests/sdlc/staging-rotate.test.ts::the_stage_job_runs_the_rotation_where_a_lost_race_re-applies_it::passes_no_budget_of_its_own_—_the_number_lives_once,_in_the_script
  Scenario: The stage job passes no budget of its own
    Given feature-staging.yml and its deploy step
    Then the rotation call passes no "--max" or "--budget" option
    And the workflow defines no MAX_PREVIEWS or MAX_PREVIEW_BYTES variable
