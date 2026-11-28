# scripts/changed-paths.ts measures a change set from git and decides which check/writer pairs it affects, so
# regen --changed and the narrowed fixpoint in scripts/regen-after-merge.ts never skip a pair whose input changed.
# Each Scenario names the test that executes it.
Feature: Narrowing regen to the pairs a change affects

  @test:scripts/tests/changed-paths.test.ts::an_undeclared_or_{tracked}_pair_is_never_skipped::no_input_declaration:_always_asked,_even_when_nothing_changed
  Scenario: A pair with no input declaration is always asked
    Given a pair with no declared inputs
    When an empty change set is tested against its footprint
    Then it is affected
    And the reason mentions "no input declaration"

  @test:scripts/tests/changed-paths.test.ts::an_undeclared_or_{tracked}_pair_is_never_skipped::{tracked}:_asked_whenever_ANY_path_changed
  Scenario: A tracked pair is asked whenever any path changed
    Given a pair whose inputs are the tracked tree
    When the change set holds "anything/at/all.txt"
    Then it is affected

  @test:scripts/tests/changed-paths.test.ts::an_undeclared_or_{tracked}_pair_is_never_skipped::{tracked}_with_nothing_changed_is_the_one_honest_skip_—_the_tree_it_read_is_the_tree
  Scenario: A tracked pair with nothing changed is skipped
    Given a pair whose inputs are the tracked tree
    When the change set is empty
    Then it is not affected

  @test:scripts/tests/changed-paths.test.ts::an_undeclared_or_{tracked}_pair_is_never_skipped::a_change_set_that_could_not_be_measured_asks_every_pair
  Scenario: An unmeasured change set asks every pair
    Given a footprint over "a/*" holding "a/b"
    When it is tested against an unmeasured change set
    Then it is affected

  @test:scripts/tests/changed-paths.test.ts::an_undeclared_or_{tracked}_pair_is_never_skipped::a_footprint_that_cannot_be_computed_is_always_asked_(glob_over_nothing)
  Scenario: A footprint whose glob matches nothing is always asked
    Given a fixture repository and a pair whose only input is "nothing/**/*.x"
    When its footprint is computed
    Then the footprint is marked always
    And a change to "unrelated.md" affects it

  @test:scripts/tests/changed-paths.test.ts::an_undeclared_or_{tracked}_pair_is_never_skipped::FALSIFIER:_a_narrowly_declared_pair_passing_--against_is_asked_with_NO_path_changed
  Scenario: A narrowly declared pair that passes --against is asked with no path changed
    Given a fixture repository and narrow pairs whose commands pass "--against main", one nested through bun run with "--against=refs/heads/main"
    When an empty change set is tested against each
    Then each is affected because it "judges against a qa-reports baseline, which is not a path"
    And the same narrow pair without --against is not affected

  @test:scripts/tests/changed-paths.test.ts::an_undeclared_or_{tracked}_pair_is_never_skipped::hasAgainstRef:_both_spellings,_quoted,_and_absent
  Scenario: hasAgainstRef recognises both spellings, quoted, and absence
    Given the commands "bun x.ts --against main", 'bun x.ts "--against=main"', "bun x.ts --againstish" and none
    When each is tested for an against ref
    Then the first two have one
    And "--againstish" and the absent command do not

  @test:scripts/tests/changed-paths.test.ts::an_undeclared_or_{tracked}_pair_is_never_skipped::a_command_that_is_not_a_script_file_is_always_asked
  Scenario: A command that is not a script file is always asked
    Given a fixture repository and a pair whose command is "tsc --noEmit"
    When its footprint is computed
    Then the footprint is marked always

  @test:scripts/tests/changed-paths.test.ts::intersection_selection_over_a_declared_footprint::the_footprint_holds_the_declared_files_AND_the_script's_import_closure
  Scenario: A declared footprint holds the declared files and the script's import closure
    Given the fixture pair "p:check" with inputs "data/**/*.json" running src/check.ts, which imports src/lib.ts
    When its footprint is computed
    Then its files are exactly "data/a.json", "src/check.ts" and "src/lib.ts"

  @test:scripts/tests/changed-paths.test.ts::intersection_selection_over_a_declared_footprint::an_unrelated_change_is_not_asked,_and_says_why
  Scenario: An unrelated change does not ask the pair and says why
    Given the fixture pair's declared footprint
    When the change set is "unrelated.md" and "src/other.ts"
    Then it is not affected
    And the reason says "none of 2 changed path"

  @test:scripts/tests/changed-paths.test.ts::intersection_selection_over_a_declared_footprint::a_declared_input_changed:_asked
  Scenario: A changed declared input asks the pair
    Given the fixture pair's declared footprint
    When the change set holds "unrelated.md" and "data/a.json"
    Then it is affected

  @test:scripts/tests/changed-paths.test.ts::intersection_selection_over_a_declared_footprint::an_IMPORTED_module_changed:_asked_(the_closure,_not_just_the_entry)
  Scenario: A changed imported module asks the pair
    Given the fixture pair's declared footprint
    When the change set holds "src/lib.ts"
    Then it is affected

  @test:scripts/tests/changed-paths.test.ts::intersection_selection_over_a_declared_footprint::a_NEW_or_DELETED_file_under_a_declared_glob:_asked,_though_it_is_not_in_today's_expansion
  Scenario: A new or deleted file under a declared glob asks the pair
    Given the fixture pair's declared footprint
    When the change set holds "data/new/deep.json", which is not in the current expansion
    Then it is affected

  @test:scripts/tests/changed-paths.test.ts::intersection_selection_over_a_declared_footprint::a_changed_directory_or_gitlink_holding_declared_files:_asked
  Scenario: A changed directory holding declared files asks the pair
    Given the fixture pair's declared footprint
    When the change set holds the directory "data"
    Then it is affected

  @test:scripts/tests/changed-paths.test.ts::intersection_selection_over_a_declared_footprint::bun.lock_changed:_asked
  Scenario: A changed bun.lock asks the pair
    Given the fixture pair's declared footprint
    When the change set holds "bun.lock"
    Then it is affected

  @test:scripts/tests/changed-paths.test.ts::intersection_selection_over_a_declared_footprint::package.json:_asked_only_when_a_command_the_pair_runs_changed_—_and_when_that_cannot_be_told
  Scenario: A changed package.json asks the pair only when its commands changed or that cannot be told
    Given the fixture pair's declared footprint and a change set holding "package.json"
    When it is tested with no way to tell whether its scripts changed
    Then it is affected
    And it is affected when its scripts changed
    And it is not affected when its scripts did not change

  @test:scripts/tests/changed-paths.test.ts::patternHits::glob,_plain_file,_path_under_a_plain_directory,_and_a_directory_above_one
  Scenario: patternHits matches globs, plain files and directories either way round
    Given patterns and paths
    When each pair is matched
    Then "a/**/*.md" hits "a/b/c.md" but not "a/b/c.ts"
    And "a/b.md" hits "a/b.md"
    And "a/dir" hits "a/dir/x.ts", and "a/dir/x.ts" hits the directory "a/dir"
    And "a/dir" does not hit "a/dirt"

  @test:scripts/tests/changed-paths.test.ts::the_change_set_is_MEASURED_from_git::changedSince:_committed_since_the_base,_the_working_tree,_and_untracked_files
  Scenario: changedSince measures committed, working-tree and untracked changes
    Given a fixture repository with a commit changing src/lib.ts after the base
    And an uncommitted edit to data/a.json and an untracked data/new.json
    When the paths changed since the base are measured
    Then they are exactly "data/a.json", "data/new.json" and "src/lib.ts"

  @test:scripts/tests/changed-paths.test.ts::the_change_set_is_MEASURED_from_git::changedSince:_an_unknown_base_is_UNDETERMINED,_never_an_empty_change
  Scenario: changedSince with an unknown base is undetermined
    Given a fixture repository
    When the paths changed since "no-such-ref" are measured
    Then the result is undetermined

  @test:scripts/tests/changed-paths.test.ts::the_change_set_is_MEASURED_from_git::snapshots:_what_a_writer_changed,_including_reverting_a_dirty_file_to_HEAD
  Scenario: Snapshots show what a writer changed, including a revert to HEAD
    Given a fixture repository with unrelated.md dirtied before the first snapshot
    When unrelated.md is restored to HEAD's content and data/a.json is edited, then a second snapshot is taken
    Then the snapshots differ in exactly "data/a.json" and "unrelated.md"
    And a further snapshot with no edits differs in nothing

  @test:scripts/tests/changed-paths.test.ts::merge:main_hands_regen_the_fork_point,_or_nothing::a_fork_point_becomes_--changed;_none_(shallow,_--full-regen)_is_the_full_run
  Scenario: merge:main hands regen the fork point as --changed, or nothing
    Given a fork point "abc123" and no fork point
    When the regen arguments are built
    Then with the fork point they are "--no-mount", "--changed", "abc123"
    And without one they are only "--no-mount"

  @test:scripts/tests/changed-paths.test.ts::merge:main_hands_regen_the_fork_point,_or_nothing::the_fork-point_union_sees_a_path_EITHER_side_changed_(bean_lxpq's_case)
  Scenario: The change since the fork point includes paths changed on either side
    Given a fixture repository where a side branch changes data/a.json and main changes src/lib.ts after the fork
    And the side branch merged into main without committing
    When the paths changed since the fork point are measured
    Then they are exactly "data/a.json" and "src/lib.ts"

  @test:scripts/tests/changed-paths.test.ts::--changed_argv::both_spellings,_absent,_and_a_missing_value
  Scenario: The --changed argument is read in both spellings
    Given command lines
    When the changed base is read from each
    Then "--changed abc" and "--changed=abc" both give "abc"
    And "--explain" alone gives none
    And "--changed" followed by "--explain" throws

  @test:scripts/tests/changed-paths.test.ts::the_fixpoint_with_--changed_and_narrowing::the_second_pass_asks_only_what_the_first_pass's_writes_touched_—_and_still_settles
  Scenario: The second pass asks only the pairs the first pass's writes touched
    Given pairs a, b and c where b writes what a reads and c reads only its own input
    When regen runs to a fixpoint with narrowing
    Then it settles in 3 passes with a's output equal to b's
    And c:check is asked only once
    And the outcomes are regenerated, regenerated and current, with c not marked assumed

  @test:scripts/tests/changed-paths.test.ts::the_fixpoint_with_--changed_and_narrowing::an_unmeasurable_change_re-asks_everyone
  Scenario: An unmeasurable change re-asks every pair
    Given pairs a, b and c and a narrowing whose change set is never measured
    When regen runs to a fixpoint
    Then it settles
    And c:check is asked once in every pass

  @test:scripts/tests/changed-paths.test.ts::the_fixpoint_with_--changed_and_narrowing::--changed:_an_untouched_pair_is_not_asked_and_is_marked_ASSUMED;_a_touched_one_is
  Scenario: With --changed an untouched pair is skipped and marked assumed
    Given pairs a, b and c and a first-pass change set of "bIn"
    When regen runs to a fixpoint with narrowing
    Then it settles
    And c:check is never asked and c's result is "current" and assumed
    And b:check is asked and a's output ends equal to b's

  @test:scripts/tests/changed-paths.test.ts::the_fixpoint_with_--changed_and_narrowing::FALSIFIER:_--changed_naming_a_pair's_input_never_skips_it,_even_when_every_other_pair_is_skipped
  Scenario: A --changed set naming a pair's input never skips it
    Given pair c made stale, and each of the keys bIn, bOut, aOut, cIn and cOut in turn as the first-pass change set
    When regen runs to a fixpoint with narrowing
    Then for cIn and cOut, c's output is repaired to 5
    And for the other keys, c:check is never asked

  @test:scripts/tests/changed-paths.test.ts::the_fixpoint_with_--changed_and_narrowing::a_pass_whose_writers_repaired_nothing_and_changed_nothing_settles::a_writer_that_FAILS_and_changes_nothing:_settled_at_the_first_barren_pass,_verdict_kept
  Scenario: A failing writer that changes nothing settles at the first barren pass
    Given pairs a, b, c and an always-asked d whose check always fails and whose writer fails without writing
    When regen runs to a fixpoint with narrowing
    Then it settles, reporting exactly one barren pass, in fewer than 6 passes
    And d's outcome is "writer-failed"
    And the exit code is 1

  @test:scripts/tests/changed-paths.test.ts::the_fixpoint_with_--changed_and_narrowing::a_pass_whose_writers_repaired_nothing_and_changed_nothing_settles::an_UNREPAIRED_writer_(exits_0,_check_still_red)_that_changes_nothing_settles_too
  Scenario: An unrepaired writer that changes nothing settles too
    Given pairs a, b, c and an always-asked d whose writer exits 0 without writing while its check stays red
    When regen runs to a fixpoint with narrowing
    Then it settles
    And d's outcome is "unrepaired"

  @test:scripts/tests/changed-paths.test.ts::the_fixpoint_with_--changed_and_narrowing::a_pass_whose_writers_repaired_nothing_and_changed_nothing_settles::FALSIFIER:_a_failing_writer_that_CHANGES_the_tree_is_not_barren_—_the_run_goes_on
  Scenario: A failing writer that changes the tree is not barren
    Given pairs a, b, c and an always-asked d whose writer fails after changing cIn
    When regen runs to a fixpoint with narrowing and a cap of 4 passes
    Then it does not settle
    And it runs all 4 passes

  @test:scripts/tests/changed-paths.test.ts::the_fixpoint_with_--changed_and_narrowing::a_pass_whose_writers_repaired_nothing_and_changed_nothing_settles::FALSIFIER:_an_unmeasurable_change_set_never_settles_a_pass_that_ran_a_writer
  Scenario: An unmeasurable change set never settles a pass that ran a writer
    Given pairs a, b, c and an always-asked d whose writer fails without writing
    And a narrowing whose change set is never measured
    When regen runs to a fixpoint with a cap of 4 passes
    Then it does not settle

  @test:scripts/tests/changed-paths.test.ts::the_fixpoint_with_--changed_and_narrowing::a_pass_whose_writers_repaired_nothing_and_changed_nothing_settles::FALSIFIER:_a_pass_that_REPAIRED_something_is_never_barren,_even_with_no_measured_change
  Scenario: A pass that repaired something is not barren even with no measured change
    Given a single pair whose writer turns its check green without any measured change
    When regen runs to a fixpoint with narrowing
    Then it settles in 2 passes
    And the check is asked 3 times

  @test:scripts/tests/changed-paths.test.ts::the_fixpoint_with_--changed_and_narrowing::without_hooks_every_pass_asks_every_pair_—_the_old_behaviour
  Scenario: Without narrowing hooks every pass asks every pair
    Given pairs a, b and c
    When regen runs to a fixpoint with no hooks
    Then c:check is asked once in every pass

  @test:scripts/tests/changed-paths.test.ts::FALSIFIER_over_the_real_declaration_table:_no_declared_input_can_change_unseen::%s:_each_declared_file,_changed_alone,_asks_it
  Scenario: For every narrow declaration, changing any one of its files asks the check
    Given each check in the real task-io table whose inputs are declared and not {tracked}
    And its footprint over the repository's package scripts
    # A footprint with no file list (always asked, or {tracked}) passes with nothing checked
    When the footprint has a file list
    Then the expansion of its declared inputs and outputs is a non-empty file list
    And each expanded file, changed alone, affects the check
    And each file in the footprint, changed alone, affects the check
