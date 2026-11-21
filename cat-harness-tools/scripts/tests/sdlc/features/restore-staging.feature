# scripts/restore-staging.ts restores previews, the render log and the retired-record store from
# gh-pages into the built site before a full-replace deploy, and verifies them after; tested against
# real git remotes with a replay of the deploy's push. Each Scenario names the test that executes it.
Feature: Restoring staging previews across a full-replace deploy

  @test:scripts/tests/sdlc/restore-staging.test.ts::a_full-replace_deploy_with_the_restore_in_front_of_it::the_previews_survive,_and_a_page_deleted_from_docs/_still_disappears
  Scenario: Previews survive and a page deleted from docs/ still disappears
    Given a gh-pages branch with a home page, "renamed-away.html" and previews "claude-pr-361" and "claude-pr-362" (with a nested api page)
    And a built site with a new home page and "about.html"
    When the previews are restored into the site and the site is published as a full replace
    Then the restore state is "restored" with previews "claude-pr-361" and "claude-pr-362" and exit code 0
    And the branch holds both preview pages, including "STAGING/claude-pr-362/api/index.html"
    And "renamed-away.html" is gone and "about.html" is present
    And the verifier reports "ok" with exit code 0

  @test:scripts/tests/sdlc/restore-staging.test.ts::a_full-replace_deploy_with_the_restore_in_front_of_it::CONTROL_—_`keep_files:_true`_keeps_the_previews_but_strands_the_deleted_page
  Scenario: Control, keeping files keeps the previews but strands the deleted page
    Given the same gh-pages branch and a built site with only a new home page
    When the site is published keeping existing files, with no restore
    Then the branch still holds "STAGING/claude-pr-361/index.html"
    And it still holds "renamed-away.html"

  @test:scripts/tests/sdlc/restore-staging.test.ts::a_full-replace_deploy_with_the_restore_in_front_of_it::CONTROL_—_with_no_restore,_a_full_replace_deletes_every_preview
  Scenario: Control, a full replace with no restore deletes every preview
    Given the same gh-pages branch and a built site with only a new home page
    When the site is published as a full replace with no restore
    Then no path under "STAGING/" remains
    And "renamed-away.html" is gone

  @test:scripts/tests/sdlc/restore-staging.test.ts::the_three_states::determined-empty:_the_branch_is_readable_and_carries_no_previews
  Scenario: A readable branch with no previews is a determined empty
    Given a gh-pages branch with only a home page
    When the previews are restored
    Then the state is "empty" with exit code 0
    And no "STAGING" directory is written into the site

  @test:scripts/tests/sdlc/restore-staging.test.ts::the_three_states::determined:_the_publish_branch_does_not_exist_at_all_—_a_first_deploy
  Scenario: A missing publish branch is a determined first deploy
    Given a remote with no gh-pages branch
    When the previews are restored
    Then the state is "no-branch" with exit code 0

  @test:scripts/tests/sdlc/restore-staging.test.ts::the_three_states::COULD_NOT_DETERMINE_is_exit_2,_never_'there_are_no_previews_to_keep'
  Scenario: A remote that cannot be read is could-not-determine, exit 2
    Given a remote path that does not exist
    When the previews are restored
    Then the state is "unknown" with exit code 2
    And no "STAGING" directory is written into the site

  @test:scripts/tests/sdlc/restore-staging.test.ts::the_three_states::a_blind_verifier_is_exit_2,_not_a_pass
  Scenario: A verifier that cannot read the branch is exit 2, not a pass
    Given a remote path that does not exist
    When the verifier is asked to find "claude-pr-361"
    Then the state is "unknown" with exit code 2

  @test:scripts/tests/sdlc/restore-staging.test.ts::the_three_states::a_preview_lost_in_the_window_is_exit_1,_and_is_named
  Scenario: A preview lost in the window is exit 1 and is named
    Given a branch with preview "kept", restored and published as a full replace
    When the verifier expects "kept" and "raced"
    Then the state is "lost", naming only "raced", with exit code 1

  @test:scripts/tests/sdlc/restore-staging.test.ts::the_three_states::a_preview_pushed_after_ours_is_added,_never_reported_lost
  Scenario: A preview pushed after ours is never reported lost
    # Gap: only checks the verifier passes; does not assert the later preview is listed as added
    Given a branch with preview "mine", restored and published as a full replace
    And a later additive publish of preview "theirs"
    When the verifier checks the restored previews
    Then the state is "ok"

  @test:scripts/tests/sdlc/restore-staging.test.ts::.github/workflows/docs-site.yml_+_publish-gh-pages.sh::the_workflow_delegates_the_publish_to_the_script,_and_still_verifies_after
  Scenario: The workflow delegates the publish to the script and verifies after it
    Given the run and uses lines of the steps in ".github/workflows/docs-site.yml"
    Then a step runs "scripts/publish-gh-pages.sh" and a step runs "restore-staging.ts --verify"
    And the verify step comes after the publish step

  @test:scripts/tests/sdlc/restore-staging.test.ts::.github/workflows/docs-site.yml_+_publish-gh-pages.sh::the_action_is_gone_—_it_is_what_made_a_retry_impossible
  Scenario: The gh-pages action is no longer used by the workflow
    Given the text of ".github/workflows/docs-site.yml"
    Then it has no "uses: peaceiris/actions-gh-pages" step

  @test:scripts/tests/sdlc/restore-staging.test.ts::.github/workflows/docs-site.yml_+_publish-gh-pages.sh::the_restore_is_the_last_thing_before_the_push,_now_inside_the_loop
  Scenario: The restore is the last thing before the push
    Given the text of "scripts/publish-gh-pages.sh"
    Then it contains "restore-staging.ts --site" and a later "git -C \"$PAGES_DIR\" push"
    And the text between them contains neither "backoff-sleep" nor "fetch"

  @test:scripts/tests/sdlc/restore-staging.test.ts::.github/workflows/docs-site.yml_+_publish-gh-pages.sh::EVERY_attempt_re-reads_and_rebuilds_—_it_must_never_rebase
  Scenario: Every attempt re-reads and rebuilds, and never rebases
    Given the text of "scripts/publish-gh-pages.sh"
    Then it contains "reset --hard FETCH_HEAD"
    And it contains no "pull --rebase" or "git rebase"
    And "restore-staging.ts --site" comes after the "for attempt in" loop starts

  @test:scripts/tests/sdlc/restore-staging.test.ts::.github/workflows/docs-site.yml_+_publish-gh-pages.sh::the_publish_is_still_a_FULL_REPLACE_—_delete-on-remove_is_the_point
  Scenario: The publish is still a full replace
    Given the text of "scripts/publish-gh-pages.sh"
    Then it contains "rm -r --ignore-unmatch"
    And its non-comment lines do not mention "keep_files"

  @test:scripts/tests/sdlc/restore-staging.test.ts::.github/workflows/docs-site.yml_+_publish-gh-pages.sh::a_restore_that_could_not_READ_the_branch_is_fatal,_never_'no_previews'
  Scenario: A restore that could not read the branch is fatal
    # Gap: only checks that "exit" appears between the restore call and "rm -r"; the exit code is not run
    Given the text of "scripts/publish-gh-pages.sh"
    Then the text from "restore-staging.ts --site" up to "rm -r" contains "exit"

  @test:scripts/tests/sdlc/restore-staging.test.ts::the_render_log_is_carried_UNCONDITIONALLY_—_the_property_previews_do_not_have::the_log_survives_a_full_replace_when_there_are_NO_previews_at_all
  Scenario: The render log survives a full replace when there are no previews
    Given a branch with a home page and the render log "_render-log/2026-09-20.jsonl"
    When the previews are restored and the site published as a full replace
    Then the restore state is "empty"
    And the render log is reported "carried", the retired stores and the public comment release "absent"
    And the branch still holds the render log

  @test:scripts/tests/sdlc/restore-staging.test.ts::the_render_log_is_carried_UNCONDITIONALLY_—_the_property_previews_do_not_have::CONTROL_—_with_no_restore,_the_full_replace_deletes_the_log
  Scenario: Control, a full replace with no restore deletes the log
    Given a branch with a home page and the render log
    When the site is published as a full replace with no restore
    Then no path under "_render-log/" remains

  @test:scripts/tests/sdlc/restore-staging.test.ts::the_render_log_is_carried_UNCONDITIONALLY_—_the_property_previews_do_not_have::entries_are_kept_byte-for-byte,_and_a_day_file_is_not_merged_into_another
  Scenario: Log entries are kept byte for byte and day files are not merged
    Given a branch with render logs for 2026-09-20 and 2026-09-19
    When the previews are restored
    Then the site's 2026-09-20 log is byte-for-byte the branch's line
    And the 2026-09-19 log exists as its own file
    And after a full-replace publish the branch holds both day files

  @test:scripts/tests/sdlc/restore-staging.test.ts::the_render_log_is_carried_UNCONDITIONALLY_—_the_property_previews_do_not_have::an_absent_log_is_a_DETERMINED_absence,_reported_rather_than_omitted
  Scenario: An absent log is reported as a determined absence
    Given a branch with a preview and no render log
    When the previews are restored
    Then the state is "restored" with exit code 0
    And the render log is reported "absent", alongside the absent retired stores and public comment release

  @test:scripts/tests/sdlc/restore-staging.test.ts::the_render_log_is_carried_UNCONDITIONALLY_—_the_property_previews_do_not_have::a_log_the_deploy_would_have_wiped_is_carried_alongside_the_previews
  Scenario: A log is carried alongside the previews
    Given a branch with preview "claude-pr-9" and the render log
    When the previews are restored and the site published as a full replace
    Then the restore state is "restored"
    And the branch holds both the render log and "STAGING/claude-pr-9/index.html"

  @test:scripts/tests/sdlc/restore-staging.test.ts::the_render_log_is_carried_UNCONDITIONALLY_—_the_property_previews_do_not_have::an_unreadable_branch_carries_nothing_and_is_exit_2_—_never_a_silent_pass
  Scenario: An unreadable branch carries nothing and is exit 2
    Given a remote path that does not exist
    When the previews are restored
    Then the state is "unknown" with nothing carried and exit code 2
    And no "_render-log" directory is written into the site

  @test:scripts/tests/sdlc/restore-staging.test.ts::the_verifier_checks_the_CARRIED_prefixes,_not_only_the_previews::a_log_the_deploy_dropped_is_reported_LOST,_where_it_used_to_pass
  Scenario: A log the deploy dropped is reported lost
    Given a branch with the render log, published as a full replace from a site that does not carry it
    When the verifier checks with the carried prefix "_render-log"
    Then the state is "lost" with lost prefix "_render-log" and exit code 1

  @test:scripts/tests/sdlc/restore-staging.test.ts::the_verifier_checks_the_CARRIED_prefixes,_not_only_the_previews::the_SAME_case_passes_when_the_prefix_is_not_passed_—_the_old_blind_spot
  Scenario: Control, the same case passes when the prefix is not passed
    Given a branch with the render log, published as a full replace from a site that does not carry it
    When the verifier checks with no carried prefixes
    Then the state is "ok"

  @test:scripts/tests/sdlc/restore-staging.test.ts::the_verifier_checks_the_CARRIED_prefixes,_not_only_the_previews::a_log_that_survived_is_not_reported_lost
  Scenario: A log that survived is not reported lost
    Given a branch with the render log, restored and published as a full replace
    When the verifier checks with the carried prefix "_render-log"
    Then the restore reported the log "carried"
    And the verifier state is "ok" with exit code 0

  @test:scripts/tests/sdlc/restore-staging.test.ts::the_verifier_checks_the_CARRIED_prefixes,_not_only_the_previews::a_DETERMINED_ABSENCE_is_never_asserted_on_—_it_was_never_there_to_lose
  Scenario: A determined absence is never asserted on
    Given a branch with no render log, restored and published as a full replace
    When the verifier checks with no carried prefixes
    Then the restore reported the log "absent"
    And the verifier state is "ok"

  @test:scripts/tests/sdlc/restore-staging.test.ts::the_verifier_checks_the_CARRIED_prefixes,_not_only_the_previews::a_loss_names_the_prefix_and_says_it_is_NOT_recoverable_by_re-running
  Scenario: A loss names the prefix and says it is not recoverable by re-running
    Given a "lost" outcome with lost prefix "_render-log"
    When the outcome is described
    Then the text contains "_render-log"
    And it contains "NOT recoverable"

  @test:scripts/tests/sdlc/restore-staging.test.ts::the_retired-record_store_is_carried_unconditionally_and_is_not_a_preview_—_bean_6pfo::with_no_previews_at_all,_the_store_survives_the_full_replace
  Scenario: With no previews, the retired-record store survives the full replace
    Given a branch with a home page and the retired record "STAGING/_retired/claude-pr-7.json"
    When the previews are restored and the site published as a full replace
    Then the restore state is "empty"
    And "STAGING/_retired" is reported "carried"
    And the branch still holds the retired record

  @test:scripts/tests/sdlc/restore-staging.test.ts::the_retired-record_store_is_carried_unconditionally_and_is_not_a_preview_—_bean_6pfo::beside_a_live_preview,_`_retired`_is_not_counted_among_the_previews
  Scenario: Beside a live preview, _retired is not counted among the previews
    Given a branch with preview "claude-pr-9" and a retired record
    When the previews are restored and the site published as a full replace
    Then the restore state is "restored" with previews only "claude-pr-9"
    And the verifier, given "claude-pr-9" and the prefix "STAGING/_retired", reports "ok"

  @test:scripts/tests/sdlc/restore-staging.test.ts::a_RETIRED_preview_is_not_restored::the_retired_slug_is_left_behind_and_the_live_one_is_carried
  Scenario: A retired preview is left behind and the live one is carried
    Given a branch with live preview "claude-live", preview "claude-gone" still present, and a retirement record for "claude-gone"
    When the previews are restored and the site published as a full replace
    Then the restore state is "restored" with previews only "claude-live"
    And the branch holds "STAGING/claude-live/index.html" but not "STAGING/claude-gone/index.html"

  @test:scripts/tests/sdlc/restore-staging.test.ts::a_RETIRED_preview_is_not_restored::the_retirement_RECORD_still_survives_the_deploy_—_it_outlives_the_preview
  Scenario: The retirement record still survives the deploy
    Given the same branch with a retired "claude-gone"
    When the previews are restored and the site published as a full replace
    Then "STAGING/_retired" is reported "carried"
    And the branch still holds "STAGING/_retired/claude-gone.json"

  @test:scripts/tests/sdlc/restore-staging.test.ts::a_RETIRED_preview_is_not_restored::the_verifier_does_not_expect_the_retired_preview_back
  Scenario: The verifier does not expect the retired preview back
    Given the same branch, restored and published as a full replace
    When the verifier checks the restored previews and the prefix "STAGING/_retired"
    Then the state is "ok"
    And "claude-gone" is not among the present previews

  @test:scripts/tests/sdlc/restore-staging.test.ts::a_RETIRED_preview_is_not_restored::EVERY_preview_retired_is_a_determined_empty,_not_a_whole-tree_archive
  Scenario: Every preview retired is a determined empty, not a whole-tree archive
    Given a branch whose only preview "claude-gone" has a retirement record
    When the previews are restored
    Then the state is "empty" with no previews and exit code 0
    And no "STAGING/claude-gone" directory is written into the site

  @test:scripts/tests/sdlc/restore-staging.test.ts::a_RETIRED_preview_is_not_restored::an_UNREADABLE_retirement_store_is_`unknown`,_never_`no_retirements`
  Scenario: An unreadable retirement store does not restore the retired previews
    Given the branch with previews "claude-live" and "claude-gone", whose "STAGING/_retired" is a file rather than a directory of records
    When the previews are restored
    Then the state is "unknown", with a reason naming "STAGING/_retired"
    And there are no previews and the exit code is not 0
    And neither "STAGING/claude-gone" nor "STAGING/claude-live" is written into the site
