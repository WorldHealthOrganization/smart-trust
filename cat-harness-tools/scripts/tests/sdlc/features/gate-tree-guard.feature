# scripts/gate-tree-guard.ts reads the working tree with git status between gates, reports
# every entry a gate wrote, changed or reverted, and names which gates were running when a
# path was written. Each Scenario names the test that executes it.
Feature: The between-gates tree guard

  @test:scripts/tests/sdlc/gate-tree-guard.test.ts::parsePorcelain::keys_on_the_line_after_the_fixed-width_status,_and_reads_the_code_from_the_first_two_chars
  Scenario: Porcelain lines are keyed by path with the two-character status code
    Given porcelain output with " M cat-harness/a.ts", "?? new.txt" and "MM both.ts"
    When it is parsed
    Then the three paths map to " M", "??" and "MM"
    And there are exactly three entries

  @test:scripts/tests/sdlc/gate-tree-guard.test.ts::parsePorcelain::keeps_a_rename's_whole_`old_->_new`_as_the_key_rather_than_splitting_on_an_arrow_a_filename_may_contain
  Scenario: A rename keeps its whole "old -> new" text as the key
    Given the porcelain line "R  old/path.ts -> new/path.ts"
    When it is parsed
    Then the key "old/path.ts -> new/path.ts" maps to "R "

  @test:scripts/tests/sdlc/gate-tree-guard.test.ts::parsePorcelain::keeps_a_quoted_path_quoted,_and_does_not_try_to_unescape_it
  Scenario: A quoted path is kept quoted and not unescaped
    Given a porcelain line whose path is quoted with an escaped tab
    When it is parsed
    Then the only key is the quoted path verbatim

  @test:scripts/tests/sdlc/gate-tree-guard.test.ts::parsePorcelain::skips_blank_and_too-short_lines_instead_of_minting_an_empty_key_they_would_all_share
  Scenario: Blank and too-short lines are skipped
    Given porcelain output with two blank lines, the line "x" and " M ok.ts"
    When it is parsed
    Then the only key is "ok.ts"

  @test:scripts/tests/sdlc/gate-tree-guard.test.ts::parsePorcelain::tolerates_CRLF,_which_a_checkout_on_Windows_produces
  Scenario: CRLF line endings are tolerated
    Given the porcelain line " M a.ts" ending in CRLF
    When it is parsed
    Then "a.ts" maps to " M"

  @test:scripts/tests/sdlc/gate-tree-guard.test.ts::isUntracked::is_true_only_for_`??`
  Scenario: Only the code "??" is untracked
    When status codes are tested for being untracked
    Then "??" is untracked
    And " M", "MM", "R " and a lone "?" are not

  @test:scripts/tests/sdlc/gate-tree-guard.test.ts::diffReadings_—_all_three_directions,_because_a_`got_dirtier?`_check_misses_one::reports_an_entry_that_APPEARED,_with_no_`before`
  Scenario: An entry that appeared is reported with no before
    Given an empty reading before and "a.ts" as " M" after
    When the readings are diffed
    Then the one change is "a.ts" with after " M" and no before

  @test:scripts/tests/sdlc/gate-tree-guard.test.ts::diffReadings_—_all_three_directions,_because_a_`got_dirtier?`_check_misses_one::reports_an_entry_whose_status_CHANGED_as_one_change,_not_an_add_plus_a_delete
  Scenario: An entry whose status changed is one change
    Given "a.ts" as " M" before and "MM" after
    When the readings are diffed
    Then there is exactly one change, from " M" to "MM"

  @test:scripts/tests/sdlc/gate-tree-guard.test.ts::diffReadings_—_all_three_directions,_because_a_`got_dirtier?`_check_misses_one::reports_an_entry_that_DISAPPEARED_—_a_gate_that_reverted_an_author's_edit
  Scenario: An entry that disappeared is reported with no after
    Given "a.ts" as " M" before and an empty reading after
    When the readings are diffed
    Then the one change is "a.ts" with before " M" and no after

  @test:scripts/tests/sdlc/gate-tree-guard.test.ts::diffReadings_—_all_three_directions,_because_a_`got_dirtier?`_check_misses_one::is_EMPTY_when_the_author's_own_uncommitted_work_is_unchanged_—_the_normal_case
  Scenario: Unchanged uncommitted work gives no changes
    Given a reading with a modified file and an untracked note
    When it is diffed against an identical reading
    Then there are no changes

  @test:scripts/tests/sdlc/gate-tree-guard.test.ts::diffReadings_—_all_three_directions,_because_a_`got_dirtier?`_check_misses_one::sorts,_so_two_runs_over_one_defect_produce_byte-identical_reports
  Scenario: Changes are sorted by key
    Given "z.ts", "a.ts" and "m.ts" appearing
    When the readings are diffed
    Then the changes are in the order a.ts, m.ts, z.ts

  @test:scripts/tests/sdlc/gate-tree-guard.test.ts::diffReadings_—_all_three_directions,_because_a_`got_dirtier?`_check_misses_one::anti-vacuity:_the_same_inputs_that_yield_[]_for_no_change_yield_a_finding_for_one
  Scenario: The same before reading gives no change unchanged and one change with an added entry
    Given a reading with "a.ts" as " M"
    When it is diffed against itself
    Then there are no changes
    When it is diffed against a reading that also has "b.ts"
    Then there is one change

  @test:scripts/tests/sdlc/gate-tree-guard.test.ts::formatMutations::is_SILENT_for_a_clean_run,_so_there_is_no_self-congratulating_line_to_skip_past
  Scenario: A clean run formats to no lines
    When no mutations are formatted
    Then the output is empty

  @test:scripts/tests/sdlc/gate-tree-guard.test.ts::formatMutations::names_the_gate_that_did_it,_which_is_the_whole_reason_snapshots_are_per-gate
  Scenario: The report names the gate and the path it wrote
    Given gate "bun test" wrote "x/a.detangle.json"
    When the mutations are formatted
    Then the output contains "bun test" and "x/a.detangle.json"

  @test:scripts/tests/sdlc/gate-tree-guard.test.ts::formatMutations::distinguishes_wrote_/_changed_/_reverted_rather_than_calling_all_three_`modified`
  Scenario: Wrote, changed and reverted are told apart
    Given a gate that wrote wrote.ts, changed changed.ts from " M" to "MM", and reverted reverted.ts
    When the mutations are formatted
    Then the output has a "wrote" line with the new code, a "changed" line with both codes and a "reverted" line with the old code

  @test:scripts/tests/sdlc/gate-tree-guard.test.ts::formatMutations::counts_previously-untracked_paths_separately,_and_says_so_only_when_there_are_some
  Scenario: Previously untracked paths are counted only when there are some
    Given a gate that wrote a previously untracked "new.json"
    When the mutations are formatted
    Then the output says "1 of them previously untracked"
    And a tracked-only mutation's output does not mention "previously untracked"

  @test:scripts/tests/sdlc/gate-tree-guard.test.ts::formatMutations::states_the_elision_rather_than_silently_truncating_—_`5_of_218`_is_not_`5`
  Scenario: A long list states how many paths were elided
    Given a gate that wrote 12 paths
    When the mutations are formatted with a cap of 8
    Then the output says "…and 4 more path(s) not listed"
    And it still gives the true count "12 path(s)"

  @test:scripts/tests/sdlc/gate-tree-guard.test.ts::formatMutations::explains_the_consequence,_not_just_the_fact_—_a_later_gate_read_a_repaired_copy
  Scenario: The report explains the consequence for later gates
    Given one gate mutation
    When the mutations are formatted
    Then the output contains "makes every LATER gate" and "Regenerate and COMMIT what is stale"

  @test:scripts/tests/sdlc/gate-tree-guard.test.ts::formatMutations::names_the_reader's_OWN_edit_as_the_first_thing_to_rule_out
  Scenario: The report tells the reader to rule out their own edit first
    Given one gate mutation
    When the mutations are formatted
    Then the output contains "First rule out YOURSELF" and "the gate named is innocent"

  @test:scripts/tests/sdlc/gate-tree-guard.test.ts::formatUndetermined::carries_the_reason,_and_says_an_unanswered_question_is_not_a_clean_answer
  Scenario: An undetermined reading carries its reason and is not a pass
    When the reason "git status exited 128" is formatted as undetermined
    Then the output contains the reason and "not a clean answer"
    And it contains no check mark

  @test:scripts/tests/sdlc/gate-tree-guard.test.ts::readTree_—_against_real_git,_not_a_stub::reads_a_clean_repository_as_ok_and_empty
  Scenario: A clean repository reads as ok and empty
    Given a fresh git repository with one committed file
    When the tree is read
    Then the reading is ok with no entries

  @test:scripts/tests/sdlc/gate-tree-guard.test.ts::readTree_—_against_real_git,_not_a_stub::sees_a_modification_to_a_tracked_file,_and_a_new_untracked_file,_with_git's_own_codes
  Scenario: A modified tracked file and a new untracked file are read with git's codes
    Given a repository where tracked.txt is modified and fresh.txt is new
    When the tree is read
    Then tracked.txt is " M" and fresh.txt is "??"

  @test:scripts/tests/sdlc/gate-tree-guard.test.ts::readTree_—_against_real_git,_not_a_stub::honours_.gitignore,_which_is_what_lets_a_gate_write_its_own_scratch_files
  Scenario: Ignored scratch files are not read
    Given a repository that ignores "scratch/" and holds scratch/tmp.json
    When the tree is read
    Then the reading is ok with no entries

  @test:scripts/tests/sdlc/gate-tree-guard.test.ts::readTree_—_against_real_git,_not_a_stub::returns_ok:false_with_a_reason_outside_a_repository,_rather_than_throwing_or_reporting_clean
  Scenario: Outside a repository the reading is not ok and names git
    # Gap: when an ancestor of the temp directory is a git repository, only that entries exist is checked
    Given a temporary directory that is not a git repository
    When the tree is read
    Then the reading is not ok and its reason mentions git

  @test:scripts/tests/sdlc/gate-tree-guard.test.ts::readTree_—_against_real_git,_not_a_stub::END_TO_END:_a_write_between_two_readings_is_what_diffReadings_reports
  Scenario: A real write between two readings is the reported diff
    Given a fresh repository read once
    When it is read again with nothing changed
    Then the diff is empty
    When tracked.txt is rewritten with different bytes and read again
    Then the diff is exactly tracked.txt appearing as " M"

  @test:scripts/tests/sdlc/gate-tree-guard.test.ts::readTree_—_against_real_git,_not_a_stub::END_TO_END:_rewriting_IDENTICAL_bytes_is_invisible_—_the_property_that_makes_this_shippable
  Scenario: Rewriting a file with identical bytes is invisible
    Given a fresh repository read once
    When tracked.txt is rewritten with its committed content and read again
    Then the diff is empty

  @test:scripts/tests/sdlc/gate-tree-guard.test.ts::readTree_—_against_real_git,_not_a_stub::cleans_up_its_throwaway_repositories
  Scenario: The throwaway repositories are removed
    Given the repositories made by the earlier tests
    When each is removed
    Then at least one repository had been made

  @test:scripts/tests/sdlc/gate-tree-guard.test.ts::pathOfKey::returns_a_plain_key_as_its_path,_and_drops_an_untracked_directory's_trailing_slash
  Scenario: A plain key is its path and a directory key loses its trailing slash
    When paths are taken from keys
    Then "cat-harness/a.ts" is itself
    And "scratch/" is "scratch"

  @test:scripts/tests/sdlc/gate-tree-guard.test.ts::pathOfKey::refuses_a_quoted_key_and_a_rename_rather_than_guessing_at_them
  Scenario: A quoted key and a rename have no path
    When paths are taken from a quoted key and from "old.ts -> new.ts"
    Then both are undefined

  @test:scripts/tests/sdlc/gate-tree-guard.test.ts::attributeWrite::names_only_the_gates_whose_window_contains_the_write
  Scenario: A write is attributed to the gates whose window contains it
    Given gate windows A 1000–2000, B 1500–3000 and C 5000–6000
    When writes at 1200, 1800 and 5500 are attributed
    Then they name A, then A and B, then C, each as running

  @test:scripts/tests/sdlc/gate-tree-guard.test.ts::attributeWrite::calls_a_write_between_windows_idle_—_no_gate_was_running_—_instead_of_blaming_a_neighbour
  Scenario: A write outside every window is idle
    Given gate windows A 1000–2000, B 1500–3000 and C 5000–6000
    When writes at 4000 and 500 are attributed
    Then each is idle at its time

  @test:scripts/tests/sdlc/gate-tree-guard.test.ts::attributeWrite::tolerates_only_the_stated_slack_at_a_window's_edge
  Scenario: Only the stated slack is tolerated at a window's edge
    Given the same gate windows and a slack of 5
    When a write at 3005 is attributed
    Then it is running
    And a write at 3006 is idle

  @test:scripts/tests/sdlc/gate-tree-guard.test.ts::attributeChanges::is_unknown_—_not_idle_—_for_a_deleted_path_and_for_a_key_it_will_not_resolve
  Scenario: A deleted path and an unresolvable key are unknown, not idle
    Given a deleted "gone.ts", a rename key "a -> b", one gate spanning all time, and a stat that throws ENOENT
    When the changes are attributed
    Then both are "unknown"

  @test:scripts/tests/sdlc/gate-tree-guard.test.ts::attributeChanges::END_TO_END:_a_pooled_gate's_real_write_names_it,_and_a_write_after_the_pool_names_no_gate
  Scenario: A pooled gate's real write names it and a write after the pool names none
    Given three gates run in a pool, where "writer" writes written.txt after 150 ms, "slow-reader" sleeps 300 ms and "late-reader" returns at once
    And outside.txt is written 150 ms after the pool ends
    When the two changes are attributed from the recorded windows
    Then written.txt is running, naming "writer" and not "late-reader"
    And outside.txt is idle

  @test:scripts/tests/sdlc/gate-tree-guard.test.ts::formatMutations_with_attribution::prints_the_who-was-running_line_under_its_change,_and_the_reading_note_once
  Scenario: An attributed mutation prints who was running and the reading note
    # Gap: the line's position under its change and the note appearing only once are not checked
    Given a mutation of x.json attributed as idle
    When the mutations are formatted
    Then the output contains "NO gate was running" and "settles it"

  @test:scripts/tests/sdlc/gate-tree-guard.test.ts::formatMutations_with_attribution::prints_neither_without_attribution_—_the_old_report_is_unchanged
  Scenario: Without attribution neither line is printed
    Given a mutation of x.json with no attribution
    When the mutations are formatted
    Then the output contains no "↳" and no "settles it"
