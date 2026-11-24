# scripts/derive-cache.ts gives derive:publish a per-writer cache, restoring a writer's recorded
# outputs instead of rebuilding them, and a scheduler that runs unordered writers in parallel.
# Each Scenario names the test that executes it.
Feature: The derive cache restores writers and schedules them in parallel

  @test:scripts/tests/derive-cache.test.ts::settings::the_cache_directory_is_CAT_DERIVE_CACHE_DIR,_else_build/derive-cache
  Scenario: The cache directory defaults to build/derive-cache and follows CAT_DERIVE_CACHE_DIR
    Given the repository root "/r"
    When the cache directory is resolved
    Then with no setting it is "/r/build/derive-cache"
    And with CAT_DERIVE_CACHE_DIR "c" it is "/r/c"
    And with CAT_DERIVE_CACHE_DIR "/abs" it is "/abs"

  @test:scripts/tests/derive-cache.test.ts::settings::reuse_is_off_under_--no-cache,_and_under_CI_unless_a_cache_directory_is_named
  Scenario: Reuse is off under --no-cache and under CI unless a cache directory is named
    Given various arguments and environments
    When whether the cache is on is decided
    Then it is on with no arguments and no environment
    And it is off with "--no-cache"
    And it is off with CI "true"
    And it is on with CI "true" and CAT_DERIVE_CACHE_DIR set
    And it is on with CI "false"

  @test:scripts/tests/derive-cache.test.ts::settings::CAT_DERIVE_JOBS_bounds_the_pool;_the_default_is_the_cores;_nonsense_is_refused
  Scenario: CAT_DERIVE_JOBS bounds the pool, defaults to the core count, and refuses nonsense
    Given 6 cores
    When the job count is resolved
    Then with no setting it is 6
    And with CAT_DERIVE_JOBS "2" it is 2
    And CAT_DERIVE_JOBS "0" or "x" throws a "positive integer" error

  @test:scripts/tests/derive-cache.test.ts::what_a_writer_owns,_and_what_it_is_keyed_on::an_entry_naming_several_writers_is_each_one's_output;_a_directory_keeps_its_slash
  Scenario: An output with several writers belongs to each, and a directory keeps its slash
    Given a plan with "docs/beans/" by "state:visualizer" and "docs/_data/harness.json" by "docs:pages" and "docs:harness"
    When outputs are grouped by writer
    Then "state:visualizer" owns "i/docs/beans/"
    And "docs:pages" and "docs:harness" each own "i/docs/_data/harness.json"

  @test:scripts/tests/derive-cache.test.ts::what_a_writer_owns,_and_what_it_is_keyed_on::another_writer's_output_nested_inside_one's_own_is_named,_so_a_restore_spares_it
  Scenario: Another writer's output nested in a writer's own directory is named
    Given a plan where "other" writes "docs/beans/inner/" inside "state:visualizer"'s "docs/beans/"
    When each writer's nested foreign outputs are listed
    Then "state:visualizer" has "i/docs/beans/inner"
    And "other" has none
    And "docs:harness", sharing one entry with "docs:pages", has none

  @test:scripts/tests/derive-cache.test.ts::what_a_writer_owns,_and_what_it_is_keyed_on::predecessors_are_transitive_over_the_declared_edges
  Scenario: Predecessors are transitive over the declared edges
    Given the edges a before b, b before c, and x before c
    When the predecessors are computed
    Then "c" has "a", "b" and "x"
    And "a" has none

  @test:scripts/tests/derive-cache.test.ts::what_a_writer_owns,_and_what_it_is_keyed_on::the_key_moves_with_the_fingerprint_and_with_the_predecessors'_outputs
  Scenario: The writer key changes with the fingerprint, the predecessors' outputs and the writer
    Given a predecessor output file whose content changes from "one" to "two"
    When the outputs are digested before and after
    Then the two digests differ
    And excluding "k/p/out.txt" digests the same as excluding "k/p"
    And the writer key differs when the fingerprint, the digest or the writer name differs

  @test:scripts/tests/derive-cache.test.ts::record_and_restore::a_staged_result_is_not_reusable_until_committed;_a_restore_puts_the_bytes_back_and_spares_nested_foreign_outputs
  Scenario: A staged result is reusable only once committed, and a restore spares nested foreign outputs
    Given a writer's site output with a nested foreign output, and an output it never wrote
    When the result is staged
    Then no entry exists yet
    And once committed the entry exists, without the nested foreign file
    When the checkout changes and the entry is restored
    Then the restore succeeds
    And the recorded files are back with their recorded bytes
    And a stale extra file is removed
    And the nested foreign file keeps its newer content
    And the output the recorded run never wrote is removed

  @test:scripts/tests/derive-cache.test.ts::record_and_restore::an_unknown_key,_or_another_writer's_entry,_restores_nothing
  Scenario: An unknown key or another writer's entry restores nothing
    Given a cache holding an entry for "w:pages" at key "k1"
    When "w:pages" is restored at key "nope", or "w-pages" at key "k1"
    Then each restore reports false

  @test:scripts/tests/derive-cache.test.ts::record_and_restore::a_newer_key_replaces_the_writer's_older_entry
  Scenario: A newer key replaces the writer's older entry
    Given a writer committed at key "old" and then at key "new"
    Then no entry exists at "old"
    And an entry exists at "new"

  @test:scripts/tests/derive-cache.test.ts::schedule::unordered_writers_run_side_by_side,_never_more_than_the_jobs_allow
  Scenario: Unordered writers run in parallel up to the job limit
    Given four writers with no edges
    When they are scheduled with 2 jobs
    Then at most 2 run at once
    And with 8 jobs all 4 run at once

  @test:scripts/tests/derive-cache.test.ts::schedule::one_job_is_the_sequential_order_exactly
  Scenario: One job runs the writers strictly in order
    Given writers "a", "b" and "c" with no edges
    When they are scheduled with 1 job
    Then each one starts only after the previous one ends

  @test:scripts/tests/derive-cache.test.ts::schedule::a_declared_edge_holds:_the_reader_starts_after_its_source_ENDS,_even_when_that_source_failed
  Scenario: A writer waits for its declared predecessor to end, even when it failed
    Given "bad" declared before "docs:harness", and "bad" fails
    When "docs:harness", "bad" and "other" are scheduled with 4 jobs
    Then "docs:harness" starts after "bad" ends
    And "other" starts before "bad" ends

  @test:scripts/tests/derive-cache.test.ts::schedule::every_writer's_result_comes_back
  Scenario: The schedule returns every writer's result
    Given writers "a" and "b" with "a" before "b"
    When they are scheduled with a run that upper-cases the name
    Then the results are "a" to "A" and "b" to "B"

  @test:scripts/tests/derive-cache.test.ts::the_tree_digest_leaves_out_exactly_the_declared_outputs::an_excluded_output_moving_keeps_the_digest;_any_other_file_moving_changes_it
  Scenario: The tree digest ignores changes to excluded outputs and sees any other change
    Given a git repository with excluded outputs "docs/site/" and "untracked-out.json"
    When only the excluded outputs change
    Then the digest is unchanged
    And when another ignored file under "docs/other/" changes the digest changes
    And when the tracked "src.ts" changes the digest changes again
