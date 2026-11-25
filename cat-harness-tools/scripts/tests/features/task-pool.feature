# The regen/gates worker pool and input-hash skipping (beans xpcu, f017, 0r7u).
# Each Scenario names the test that executes it.
Feature: Task pool and input-hash skipping

  @test:scripts/tests/task-pool.test.ts::input-hash_skipping::an_unchanged_tree_hashes_the_same,_so_the_recorded_pair_is_SKIPPED
  Scenario: An unchanged tree is skipped
    Given a scratch tree with a script importing a module, a markdown input and an output
    When its pair is fingerprinted, recorded, and fingerprinted again unchanged
    Then the decision is to skip, saying "unchanged"

  @test:scripts/tests/task-pool.test.ts::input-hash_skipping::a_changed_input,_output,_script,_or_IMPORTED_module_changes_the_hash,_so_it_runs
  Scenario: Any changed input, output, script or imported module makes the pair run
    Given the pair's hash is recorded
    When the input, the output, the script or the imported module is edited
    Then each time the decision is not to skip, saying "changed"

  @test:scripts/tests/task-pool.test.ts::input-hash_skipping::a_new_file_under_a_declared_glob_changes_the_hash
  Scenario: A new file under a declared glob makes the pair run
    Given the pair's hash is recorded
    When a new markdown file is added under "src/"
    Then the decision is not to skip

  @test:scripts/tests/task-pool.test.ts::input-hash_skipping::the_closure_follows_relative_imports_and_records_the_script_itself
  Scenario: The source closure follows relative imports
    Then the entry files of "x:check" are "scripts/x.ts"
    And its closure is "scripts/x.ts" and "scripts/y.ts"

  @test:scripts/tests/task-pool.test.ts::input-hash_skipping::an_import_written_inside_a_template_literal_is_text,_not_an_edge
  Scenario: An import inside a template literal is not an edge
    Given the imported module holds an "export * from" inside a template literal
    Then the closure is still just "scripts/x.ts" and "scripts/y.ts"

  @test:scripts/tests/task-pool.test.ts::input-hash_skipping::an_unresolvable_literal_import_still_makes_the_closure_undetermined
  Scenario: An unresolvable import leaves the closure undetermined
    Given the imported module imports "./nowhere.ts"
    Then the closure is undetermined, saying "imports unresolvable ./nowhere.ts"

  @test:scripts/tests/task-pool.test.ts::input-hash_skipping::COULD_NOT_DETERMINE_is_never_clean_—_the_pair_runs::no_input_declaration
  Scenario: No input declaration is undetermined and runs
    When a pair with no io declaration is fingerprinted
    Then it is undetermined, and the decision is not to skip, saying "could not be determined"

  @test:scripts/tests/task-pool.test.ts::input-hash_skipping::COULD_NOT_DETERMINE_is_never_clean_—_the_pair_runs::a_declared_glob_that_matches_nothing
  Scenario: A glob matching nothing is undetermined and runs
    When a pair declaring input "nowhere/**/*.md" is fingerprinted
    Then it is undetermined with "declared glob nowhere/**/*.md matches no file" and is not skipped

  @test:scripts/tests/task-pool.test.ts::input-hash_skipping::COULD_NOT_DETERMINE_is_never_clean_—_the_pair_runs::a_command_that_is_not_a_readable_script_(a_binary)
  Scenario: A binary command is undetermined
    # Gap: the title's "the pair runs" is not checked here; only that the fingerprint is undetermined.
    When a pair whose check is "tsc --noEmit" is fingerprinted
    Then it is undetermined

  @test:scripts/tests/task-pool.test.ts::input-hash_skipping::COULD_NOT_DETERMINE_is_never_clean_—_the_pair_runs::a_non-literal_dynamic_import,_whose_target_cannot_be_followed
  Scenario: A non-literal dynamic import is undetermined
    Given the imported module does a dynamic import of a template string
    Then the fingerprint is undetermined, saying "non-literal dynamic import"

  @test:scripts/tests/task-pool.test.ts::input-hash_skipping::COULD_NOT_DETERMINE_is_never_clean_—_the_pair_runs::an_unreadable_cache_is_an_EMPTY_cache:_everything_runs
  Scenario: An unreadable cache is empty
    Given the input-hash cache file holds invalid JSON
    When the cache is loaded
    Then it has no pairs and the pair is not skipped

  @test:scripts/tests/task-pool.test.ts::input-hash_skipping::an_--against_baseline_is_an_input_the_tree_does_not_hold::the_refs_a_command_passes_are_found,_through_`bun_run`_nesting_and_`=`
  Scenario: The --against refs of a command are found
    Then "b:check" passes ref "main" and "b" passes none
    And a script nesting "bun run inner" and "--against=pr/7" passes "main" and "pr/7"
    And "--against" followed by a flag yields an empty ref

  @test:scripts/tests/task-pool.test.ts::input-hash_skipping::an_--against_baseline_is_an_input_the_tree_does_not_hold::a_MOVED_baseline_changes_the_hash_although_no_file_did,_so_the_pair_runs
  Scenario: A moved baseline makes the pair run
    Given the pair's hash is recorded with baseline "main" at one id
    Then with the same id the pair is skipped
    And with another id it is not

  @test:scripts/tests/task-pool.test.ts::input-hash_skipping::an_--against_baseline_is_an_input_the_tree_does_not_hold::a_baseline_that_cannot_be_resolved_is_undetermined,_never_clean
  Scenario: An unresolvable baseline is undetermined
    When the resolver has no entry for "main"
    Then the fingerprint is undetermined, saying "baseline --against main", and the pair is not skipped

  @test:scripts/tests/task-pool.test.ts::input-hash_skipping::an_--against_baseline_is_an_input_the_tree_does_not_hold::no_resolver_at_all_is_undetermined_too_—_the_pair_runs
  Scenario: No resolver is undetermined
    # Gap: the title's "the pair runs" is not checked; only that the fingerprint is undetermined.
    When a pair passing --against is fingerprinted with no resolver
    Then it is undetermined, saying "no resolver"

  @test:scripts/tests/task-pool.test.ts::input-hash_skipping::an_--against_baseline_is_an_input_the_tree_does_not_hold::a_pair_that_passes_no_--against_is_unaffected_by_the_resolver
  Scenario: A pair with no --against ignores the resolver
    Then its fingerprint with an empty resolver equals its fingerprint with none

  @test:scripts/tests/task-pool.test.ts::input-hash_skipping::the_cache_round-trips_through_build/_(ignored_by_version_control)
  Scenario: The cache round-trips
    # Gap: the title says build/ is ignored by version control; nothing checks the location or the ignore.
    When a cache with pair "k" is saved and loaded
    Then the loaded pairs are the saved ones

  @test:scripts/tests/task-pool.test.ts::input-hash_skipping::CI_and_--no-cache_disable_the_cache,_so_CI_behaviour_is_unchanged
  Scenario: CI and --no-cache disable the cache
    Then the cache is on with no arguments and no CI, and with CI "false"
    And it is off with CI "true", CI "1", or "--no-cache"
    And with no cache a pair is not skipped

  @test:scripts/tests/task-pool.test.ts::regen_with_skipping_wired_in::a_skipped_pair_is_reported_current+skipped_and_its_check_is_NOT_run
  Scenario: A skipped pair is reported and its check not run
    Given two pairs where the first is skipped
    When a regen pass runs
    Then only "b:check" ran
    And the first result is "current" and skipped

  @test:scripts/tests/task-pool.test.ts::regen_with_skipping_wired_in::hashes_are_recorded_only_for_green_pairs_in_a_SETTLED_run
  Scenario: Hashes are recorded only for green pairs in a settled run
    Given three pairs: one current, one unrepaired, one current but undetermined, with old hashes for the last two
    When hashes are recorded for a settled run
    Then only the first pair's hash is recorded
    And an unsettled run records nothing

  @test:scripts/tests/task-pool.test.ts::overlap_serialization::glob_prefixes_decide_overlap,_conservatively
  Scenario: Glob prefixes decide overlap
    Then "docs/a/*.md" overlaps "docs/**" and a file overlaps itself
    And "docs/a/**" and "docs/b/**" do not overlap, nor do two different files in "out/"

  @test:scripts/tests/task-pool.test.ts::overlap_serialization::an_UNDECLARED_output_conflicts_with_everything;_a_reader_conflicts_with_a_writer_of_its_inputs
  Scenario: Undeclared outputs and reader-writer pairs conflict
    Then undeclared outputs conflict with empty outputs, and two empty outputs do not
    And a writer of "a/**" conflicts with a reader of "a/x.json", in either order

  @test:scripts/tests/task-pool.test.ts::overlap_serialization::disjoint_declared_outputs_DO_run_concurrently
  Scenario: Disjoint outputs run concurrently
    When three tasks with disjoint outputs run in a pool of 3
    Then three were live at once

  @test:scripts/tests/task-pool.test.ts::overlap_serialization::overlapping_outputs_never_run_together,_and_keep_their_order
  Scenario: Overlapping outputs are serialized in order
    When writers to "docs/**" and "docs/page.md" and an unrelated task run in a pool of 4
    Then the two writers never overlapped and the first finished before the second
    And the unrelated task overlapped the first writer

  @test:scripts/tests/task-pool.test.ts::overlap_serialization::an_UNDECLARED_task_runs_alone:_a_barrier_with_nothing_beside_it
  Scenario: An undeclared task is a barrier
    When a task with undeclared outputs runs between two declared ones in a pool of 4
    Then no tasks overlapped at all

  @test:scripts/tests/task-pool.test.ts::overlap_serialization::regen:_a_WRITER_never_runs_beside_a_check_or_another_writer,_and_writers_keep_pair_order
  Scenario: A regen writer runs alone and writers keep order
    Given four read-only pairs of which "b" and "d" are stale
    When a regen pass runs with 4 jobs
    Then nothing ran beside a writer, the writers ran as "b" then "d"
    And the outcomes are current, regenerated, current, regenerated

  @test:scripts/tests/task-pool.test.ts::overlap_serialization::regen_pairs_without_declarations_reproduce_the_serial_order_exactly
  Scenario: Undeclared regen pairs run in serial order
    Given three undeclared pairs where "b:check" fails until "b" has run
    When a regen pass runs with 4 jobs
    Then the calls are "a:check", "b:check", "b", "b:check", "c:check"

  @test:scripts/tests/task-pool.test.ts::output_order_is_the_original_order::orderedEmitter_holds_a_fast_late_task_until_every_earlier_one_has_printed
  Scenario: The ordered emitter holds later results
    When results 2 and 1 are pushed
    Then nothing is emitted
    When result 0 is pushed
    Then 0, 1, 2 are emitted, and 3 follows when pushed

  @test:scripts/tests/task-pool.test.ts::output_order_is_the_original_order::runPool_resolves_in_INPUT_order_though_tasks_finish_in_reverse
  Scenario: The pool resolves in input order
    When four tasks that finish in reverse order run in a pool of 4
    Then they finished 3, 2, 1, 0
    But printed and resolved as 0, 1, 2, 3

  @test:scripts/tests/task-pool.test.ts::output_order_is_the_original_order::regen's_per-pair_report_is_in_pair_order_under_a_parallel_pool
  Scenario: Regen reports in pair order
    When three pairs with different check delays run with 3 jobs
    Then they are reported "a:check", "b:check", "c:check"

  @test:scripts/tests/task-pool.test.ts::output_order_is_the_original_order::the_fixpoint_still_holds_under_a_parallel_pool
  Scenario: The fixpoint holds in parallel
    Given pair "b" writes what pair "a" reads, both read-only
    When regen runs to a fixpoint with 2 jobs
    Then it settles and a's output equals b's

  @test:scripts/tests/task-pool.test.ts::output_order_is_the_original_order::v3nf:_SERIAL_and_PARALLEL_give_the_same_verdicts_and_the_same_tree
  Scenario: Serial and parallel regen agree
    Given a chain of three pairs in reverse order, an undeclared barrier, a stale pair, a broken writer and a red check with no writer, with seeded random delays
    When regen runs to a fixpoint with 1, 2, 3 and 8 jobs
    Then every parallel run equals the serial one in results, settlement and tree
    And the outcomes are regenerated, regenerated, current, regenerated, regenerated, writer-failed, no-writer

  @test:scripts/tests/task-pool.test.ts::gates:_read-only_gates_are_batched,_everything_else_is_a_barrier::consecutive_read-only_gates_form_one_segment;_a_writer_splits_them
  Scenario: Read-only gates are batched between barriers
    Given gates r1, r2, "bun test", r3 where only the r gates are read-only
    Then the segments are parallel [r1, r2], serial ["bun test"], parallel [r3]

  @test:scripts/tests/task-pool.test.ts::gates:_read-only_gates_are_batched,_everything_else_is_a_barrier::an_undeclared_gate_is_never_read-only
  Scenario: An undeclared gate is not read-only
    Then "bun test" and an unknown "bun run" script are not read-only

  @test:scripts/tests/task-pool.test.ts::--jobs::parses_both_spellings_and_refuses_nonsense_rather_than_defaulting
  Scenario: --jobs is parsed strictly
    Then "--jobs 3" gives 3, "--jobs=2" gives 2, and nothing gives the default 9
    And "--jobs abc" and "--jobs 0" throw

  @test:scripts/tests/task-pool.test.ts::task-io_declarations::an_undeclared_check_has_no_io,_so_its_pair_runs_alone_and_is_never_skipped
  Scenario: An undeclared check has no io
    # Gap: only that the io is undefined is checked; running alone and never skipping are asserted elsewhere.
    Then the io of "no-such:check" is undefined

  @test:scripts/tests/task-pool.test.ts::task-io_declarations::every_declared_check_that_may_share_the_pool_is_a_READ-ONLY_declaration
  Scenario: Every declared task with outputs declares none
    Then every task-io row that declares outputs declares an empty list

  @test:scripts/tests/task-pool.test.ts::f017:_check-level_records_—_skipped_only_on_a_hash_a_passing_run_left::a_passing,_undisturbed_run_is_recorded,_and_the_next_run_on_the_same_inputs_SKIPS
  Scenario: A passing run is recorded and the next run skips
    Given a committed scratch git tree and a gate skipper
    When "x:check" passes once and is recorded
    Then the next decision skips it, saying "unchanged since this check last passed"

  @test:scripts/tests/task-pool.test.ts::f017:_check-level_records_—_skipped_only_on_a_hash_a_passing_run_left::%s_→_it_RUNS
  Scenario Outline: A changed read makes a recorded check run
    Given "x:check" passed once and was recorded
    When <change>
    Then the next decision does not skip it

    Examples:
      | change                           |
      | a declared input is edited       |
      | a new file is added under a glob |
      | the script itself is edited      |
      | a module it imports is edited    |

  @test:scripts/tests/task-pool.test.ts::f017:_check-level_records_—_skipped_only_on_a_hash_a_passing_run_left::{tracked}:_editing_ANY_file_in_the_tree_—_even_one_no_glob_names_—_makes_it_run
  Scenario: A whole-tree reader runs when any file changes
    Given "t:check" declares the tracked tree and passed once
    Then it is skipped
    When a file no glob names is edited
    Then it is not skipped
    When that file is restored with git
    Then it is skipped again
    When an untracked file is added
    Then it is not skipped

  @test:scripts/tests/task-pool.test.ts::f017:_check-level_records_—_skipped_only_on_a_hash_a_passing_run_left::a_moved_--against_baseline_makes_it_run,_though_no_file_changed
  Scenario: A moved baseline makes a recorded check run
    Given "x:check" passes --against main, resolved to "entry-1", and passed once
    Then it is skipped
    When the baseline resolves to "entry-2"
    Then it is not skipped

  @test:scripts/tests/task-pool.test.ts::f017:_check-level_records_—_skipped_only_on_a_hash_a_passing_run_left::a_RED_run_records_nothing_—_and_forgets_an_earlier_pass
  Scenario: A red run forgets the earlier pass
    Given "x:check" passed once
    When it is recorded as failed
    Then the cache holds no entry for it and it is not skipped

  @test:scripts/tests/task-pool.test.ts::f017:_check-level_records_—_skipped_only_on_a_hash_a_passing_run_left::inputs_that_MOVED_while_it_ran_record_nothing,_though_it_passed
  Scenario: Inputs that moved during the run record nothing
    When "x:check" is decided, its input edited, and then recorded as passed
    Then the cache holds no entry for it

  @test:scripts/tests/task-pool.test.ts::f017:_check-level_records_—_skipped_only_on_a_hash_a_passing_run_left::never_skipped:_undeclared,_not_exactly_one_script,_undetermined,_or_the_cache_off
  Scenario: Checks that are never skipped
    Given "x:check" passed once
    Then an undeclared check, a command with extra arguments, a non-script command, and the cache off give no decision
    When the glob's only file is removed
    Then the decision is not to skip, saying "could not be determined"

  @test:scripts/tests/task-pool.test.ts::f017:_check-level_records_—_skipped_only_on_a_hash_a_passing_run_left::the_cache_off_records_nothing_either
  Scenario: The cache off records nothing
    When a skipper with the cache off records a pass and saves
    Then the cache's checks are empty

  @test:scripts/tests/task-pool.test.ts::f017:_check-level_records_—_skipped_only_on_a_hash_a_passing_run_left::save()_keeps_entries_another_process_wrote_since_this_one_loaded
  Scenario: Saving merges another process's entries
    Given a skipper loaded, then another process saved "other:check"
    When this skipper records and saves "x:check"
    Then the cache holds both "other:check" and "x:check"

  @test:scripts/tests/task-pool.test.ts::f017:_check-level_records_—_skipped_only_on_a_hash_a_passing_run_left::recordCheckRun:_only_passed_AND_before_===_after_records
  Scenario: Only a pass with unchanged hashes records
    Then a pass with equal before and after hashes records the hash
    And a pass with different hashes, a pass with undetermined hashes, and a failure each remove the entry

  @test:scripts/tests/task-pool.test.ts::f017:_regen_records_and_reads_the_CHECK's_own_entry::only_a_check_that_RAN_and_came_back_green_in_a_settled_run_is_recorded
  Scenario: Regen records only checks that ran green in a settled run
    Given results run-regenerated, skipped, assumed, derived and unrepaired, with old entries for red and derived
    When hashes are recorded for a settled run with check fingerprints
    Then the checks are "run:check" with its new hash and "derived:check" kept

  @test:scripts/tests/task-pool.test.ts::f017:_regen_records_and_reads_the_CHECK's_own_entry::an_unsettled_run_records_no_check_and_drops_the_ones_it_asked
  Scenario: An unsettled run records no check
    When hashes are recorded for an unsettled run
    Then only the kept "derived:check" entry remains

  @test:scripts/tests/task-pool.test.ts::f017:_regen_records_and_reads_the_CHECK's_own_entry::without_fpCheck_the_check_entries_are_carried_through_untouched
  Scenario: Without check fingerprints the entries carry through
    When hashes are recorded with no check fingerprint function
    Then the check entries equal the previous ones

  @test:scripts/tests/task-pool.test.ts::f017:_regen_records_and_reads_the_CHECK's_own_entry::pairSkip:_a_check-level_record_skips_the_pair;_a_stale_one_does_not
  Scenario: A check-level record skips its pair
    Given a cache with a check entry for "g:check"
    Then a matching check fingerprint skips the pair
    And a moved fingerprint, no cache, or an undetermined fingerprint does not

  @test:scripts/tests/task-pool.test.ts::f017:_regen_records_and_reads_the_CHECK's_own_entry::a_folded_check's_result_is_marked_derived,_so_it_records_no_check_entry
  Scenario: A folded check's result is derived
    # Gap: the title says it records no check entry; the body checks only the derived flag.
    Given pairs "kg:audit:all:check" and "kg:audit:check"
    When a regen pass runs
    Then only "kg:audit:all:check" ran
    And the second result is derived and the first is not

  @test:scripts/tests/task-pool.test.ts::task-io:_each_instance_declares_its_own_tasks_(bean_0r7u)::standalone,_with_no_instance_above,_the_result_is_the_own_rows_alone
  Scenario: Standalone task io is the own rows
    Given an instance "acme" declaring no task io
    Then the collected task io is the own rows alone

  @test:scripts/tests/task-pool.test.ts::task-io:_each_instance_declares_its_own_tasks_(bean_0r7u)::a_declared_row_is_collected_from_the_instance_that_owns_it
  Scenario: An instance's declared row is collected
    Given "acme" declares "acme:check" with inputs, outputs and a "because"
    Then the collected row has its inputs and outputs, without "because"

  @test:scripts/tests/task-pool.test.ts::task-io:_each_instance_declares_its_own_tasks_(bean_0r7u)::a_task_declared_by_two_owners_is_refused,_not_silently_resolved
  Scenario: A task with two owners is refused
    Given "acme" and the own table both declare "x:check"
    Then collecting throws "one task, one owner"

  @test:scripts/tests/task-pool.test.ts::task-io:_each_instance_declares_its_own_tasks_(bean_0r7u)::no_instance_above_cat-harness-tools_is_named_in_the_own_table
  Scenario: The own table names no task of a higher layer
    Then no key of the own task-io table matches a smart-, iris:, ig-ast:, p2: or upper-layer check: name
