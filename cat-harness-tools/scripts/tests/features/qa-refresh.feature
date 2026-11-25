# qa-refresh and the publish's completeness guard (bean 3hk4): the writers'
# declaration, the completeness rule, the mode, the publish refusing an
# incomplete tree, and the restore of committed files a writer rewrote. The
# publish half runs against a real bare repository over file://. Each
# Scenario names the test that executes it.
Feature: qa:refresh accounts for the QA tree and restores what writers rewrote

  @test:scripts/tests/qa-refresh.test.ts::the_declaration::ids_are_unique,_and_every_writer_names_a_script_package.json_or_the_tree_has
  Scenario: Writer ids are unique and every applicable writer names something runnable
    Then the QA writers' ids are unique
    And every writer that is neither external nor not applicable here starts with an npm script of the repository or an existing file

  @test:scripts/tests/qa-refresh.test.ts::the_declaration::every_family_is_under_a_declared_qa_directory_—_a_writer_cannot_claim_outside_the_record
  Scenario: Every family is under a declared qa directory
    Given the repository's declared qa roots
    Then there is at least one
    And every glob a writer writes starts under one of them, or under a layer's or the root's test/results/

  @test:scripts/tests/qa-refresh.test.ts::the_declaration::one_path_per_family_of_the_2026-10-02_inventory_is_claimed_by_exactly_one_writer
  Scenario: One path per inventory family is claimed by exactly one writer
    Given one representative path from each family of the 2026-10-02 inventory and the writer expected for it
    Then each path is claimed by exactly that writer

  @test:scripts/tests/qa-refresh.test.ts::the_declaration::no_writer_claims_a_README_inside_a_`qa`_directory_any_more_(bean_`f3bh`)
  Scenario: No writer claims a README inside a qa directory
    Then "smart-dak/test/results/README.md" and "cat-harness/test/results/README.md" are claimed by nobody

  @test:scripts/tests/qa-refresh.test.ts::the_declaration::the_two_folded_instances'_orphans_are_claimed_by_nobody_—_the_record_loses_them,_and_says_so
  Scenario: The two folded instances' orphans are claimed by nobody
    Then files under "cat-harness/test/results/agent-skills/" and "cat-harness/test/results/large-datasets/" are claimed by nobody

  @test:scripts/tests/qa-refresh.test.ts::the_declaration::a_content_root's_own_hosted_instance_is_claimed_by_kg:audit:all_without_globbing_orphans_(bean_rn24)
  Scenario: A content root's own hosted instance is claimed by kg:audit:all without orphans
    Given a content root declaring "sample-folio"
    When its hosted kg writes are derived
    Then they include "cat-harness/test/results/sample-folio/**"
    And they do not include "cat-harness/test/results/agent-skills/**"

  @test:scripts/tests/qa-refresh.test.ts::the_declaration::globs:_`*`_is_one_segment,_`**`_any_depth,_and_dots_are_literal
  Scenario: Writer globs: one-segment star, any-depth double star, literal dots
    Then "*/test/results/README.md" matches "smart-l1/test/results/README.md" but not "a/b/test/results/README.md"
    And "a/**" matches "a/b/c/d.json"
    And "a/x.json" does not match "a/xxjson"

  @test:scripts/tests/qa-refresh.test.ts::completeness::every_family_written,_every_file_claimed,_every_exit_declared:_COMPLETE
  Scenario: Every family written, every file claimed, every exit declared is complete
    Given writers "one" (writes r/one/**) and "two" (writes r/two.json, ok exits 0 and 1), with exits 0 and 1
    When a computed tree of r/one/a.json, r/one/b/c.json and r/two.json is assessed
    Then it is complete with families one 2 and two 1 and no reasons
    And the publish reads the report as complete

  @test:scripts/tests/qa-refresh.test.ts::completeness::a_file_no_writer_claims_is_INCOMPLETE_—_the_declaration_is_out_of_date
  Scenario: A file no writer claims is incomplete
    When a computed tree including "r/stray.json" is assessed
    Then it is incomplete with "r/stray.json" unclaimed

  @test:scripts/tests/qa-refresh.test.ts::completeness::a_writer_that_produced_nothing_is_INCOMPLETE,_even_when_it_exited_0
  Scenario: A writer that produced nothing is incomplete even at exit 0
    When a computed tree holding only "r/one/a.json" is assessed
    Then it is incomplete with "two" empty

  @test:scripts/tests/qa-refresh.test.ts::completeness::a_writer_that_exited_outside_its_okExits_is_INCOMPLETE,_and_a_killed_one_(null)_too
  Scenario: A writer exiting outside its ok exits, or killed, has failed
    Then a run where "one" exited 2 lists "one" as failed
    And a run where "two" exited null lists "two" as failed

  @test:scripts/tests/qa-refresh.test.ts::completeness::an_empty_tree_is_never_complete,_in_either_mode
  Scenario: An empty tree is never complete
    Then an empty tree is incomplete in tracked mode and in computed mode

  @test:scripts/tests/qa-refresh.test.ts::completeness::tracked:_the_commit's_own_copy_is_the_record_—_no_family_is_required_of_it
  Scenario: A tracked tree needs no family
    When a tracked tree with one arbitrary file and no runs is assessed
    Then it is complete with no families

  @test:scripts/tests/qa-refresh.test.ts::completeness::the_publish's_reading:_foreign_or_incomplete_reports_are_refused_with_their_reason
  Scenario: The publish refuses a foreign or incomplete report with its reason
    Then no report, and a report of another schema, are not complete
    And an incomplete report's refusal reason contains "failed: one"

  @test:scripts/tests/qa-refresh.test.ts::mode,_from_what_version_control_tracks::tracked_files_under_a_root_→_tracked;_an_ignored_working_copy_alone_→_computed
  Scenario: Only files version control tracks under a root make the checkout tracked
    Given a git checkout with an untracked "i/test/results/a.json"
    Then no QA file is tracked under "i/test/results"
    When the file is staged
    Then "i/test/results/a.json" is tracked

  @test:scripts/tests/qa-refresh.test.ts::qa:publish_--completeness::a_report_that_accounts_for_the_tree_is_carried_into_the_manifest
  Scenario: A complete report is carried into the manifest
    Given a checkout with two result files and a completeness of computed, 2 files
    When it is published at main/<sha>
    Then the publish is "published"
    And the manifest read back carries that completeness

  @test:scripts/tests/qa-refresh.test.ts::qa:publish_--completeness::a_tree_that_changed_after_it_was_accounted_for_is_INCOMPLETE,_and_nothing_is_written
  Scenario: A tree that changed after it was accounted for is not published
    Given a checkout with two result files and a completeness claiming 3 files
    When it is published
    Then the publish is "incomplete"
    And the qa-reports branch does not exist

  @test:scripts/tests/qa-refresh.test.ts::qa:publish_--completeness::CLI:_an_INCOMPLETE_report_is_refused_(exit_4)_and_the_branch_is_untouched
  Scenario: The CLI refuses an incomplete report with exit 4
    Given an incomplete refresh report saying "1 writer(s) produced nothing: two"
    When qa-store publish runs with --completeness of that report
    Then it exits 4 and stderr says "INCOMPLETE" and "produced nothing"
    And the qa-reports branch does not exist

  @test:scripts/tests/qa-refresh.test.ts::qa:publish_--completeness::CLI:_--github_with_no_report_is_refused_—_a_CI_publish_states_what_produced_its_tree
  Scenario: The CLI refuses a --github publish with no report
    Given a GitHub push event to main
    When qa-store publish --github runs with no --completeness
    Then it exits 4 and stderr names "--completeness"
    And the qa-reports branch does not exist

  @test:scripts/tests/qa-refresh.test.ts::producing_the_working_copy_leaves_the_committed_tree_as_the_commit_has_it_(bean_72a8)::a_committed_file_a_writer_rewrote_is_restored
  Scenario: A committed file a writer rewrote is restored
    Given nothing dirty before, and "cat-harness/docs/assets/beans/index.json" dirty after
    Then the writer's side effects are exactly that file

  @test:scripts/tests/qa-refresh.test.ts::producing_the_working_copy_leaves_the_committed_tree_as_the_commit_has_it_(bean_72a8)::a_file_the_person_had_already_edited_is_theirs,_and_is_never_touched
  Scenario: A file already edited before the writer ran is never touched
    Given "a.ts" dirty before, and "a.ts" and "b.json" dirty after
    Then the writer's side effects are exactly "b.json"

  @test:scripts/tests/qa-refresh.test.ts::producing_the_working_copy_leaves_the_committed_tree_as_the_commit_has_it_(bean_72a8)::nothing_rewritten,_nothing_restored
  Scenario: Nothing rewritten, nothing restored
    Given "a.ts" dirty before and after
    Then there are no side effects

  @test:scripts/tests/qa-refresh.test.ts::the_restore_window_is_ONE_writer's_run,_not_the_whole_refresh_(bean_7how)::an_edit_made_BETWEEN_writers_is_not_charged_to_either,_and_is_kept
  Scenario: An edit made between writers is kept
    Given writer w1 dirties "side.json", and a person's edit to "fix.ts" lands after w1's restore
    When writers w1 and w2 run, restoring after each
    Then only "side.json" is restored, charged to w1, and nothing to w2
    And "fix.ts" is still dirty

  @test:scripts/tests/qa-refresh.test.ts::the_restore_window_is_ONE_writer's_run,_not_the_whole_refresh_(bean_7how)::each_restored_path_is_charged_to_the_writer_it_changed_under
  Scenario: Each restored path is charged to the writer it changed under
    Given writers "a" and "b" each dirtying "<id>.json"
    When they run, restoring after each
    Then "a.json" is restored for "a" and "b.json" for "b"

  @test:scripts/tests/qa-refresh.test.ts::only_what_a_writer_declares_it_rewrites_is_restored,_and_each_restore_is_backed_up_first_(2026-10-07)::an_edit_that_lands_while_a_writer_runs,_in_a_file_it_does_not_declare,_is_LEFT
  Scenario: An undeclared edit landing during a writer's run is left
    Given writer "docs:pages" declaring it rewrites "cat-harness/docs/assets/beans/*.json"
    And during its run its beans index and an unrelated script both become dirty
    When it runs, restoring only what it declares
    Then only the beans index is restored, after being backed up
    And the script is left dirty and reported as left

  @test:scripts/tests/qa-refresh.test.ts::only_what_a_writer_declares_it_rewrites_is_restored,_and_each_restore_is_backed_up_first_(2026-10-07)::the_backup_is_taken_before_the_restore,_never_after
  Scenario: The backup is taken before the restore
    Given a writer declaring "x.json" that dirties it
    When it runs with a backup and a restore
    Then the backup happens before the restore

  @test:scripts/tests/qa-refresh.test.ts::only_what_a_writer_declares_it_rewrites_is_restored,_and_each_restore_is_backed_up_first_(2026-10-07)::the_declared_rewrites_cover_every_path_the_2026-10-07_restore_log_charged_to_its_writer,_and_none_of_the_lost_edits
  Scenario: Declared rewrites cover the 2026-10-07 restores and none of the lost edits
    Then every path the 2026-10-07 restore log charged to its writer may be restored by that writer
    And none of the three edits lost that day may be restored by the writer charged with it

  @test:scripts/tests/qa-refresh.test.ts::carriedByMount_—_a_mounted_instance's_committed_qa_files_are_not_`unclaimed`::only_paths_under_a_mounted_root_are_carried,_and_a_prefix_is_not_a_root
  Scenario: Only paths under a mounted root are carried
    Given mounts "who-iris" and "cat-harness/"
    Then paths under "who-iris/" and "cat-harness/" are carried
    And "who-iris-extra/…" and the root's "test/results/root.json" are not

  @test:scripts/tests/qa-refresh.test.ts::carriedByMount_—_a_mounted_instance's_committed_qa_files_are_not_`unclaimed`::no_mounts_carries_nothing
  Scenario: No mounts carries nothing
    Then with no mounts no path is carried

  @test:scripts/tests/qa-refresh.test.ts::carriedByMount_—_a_mounted_instance's_committed_qa_files_are_not_`unclaimed`::a_carried_path_passed_as_tracked_is_not_reported_unclaimed
  Scenario: A carried path passed as tracked is not unclaimed
    Given a who-iris result file carried by the "who-iris" mount
    When a computed tree holding it is assessed with it as tracked
    Then nothing is unclaimed
