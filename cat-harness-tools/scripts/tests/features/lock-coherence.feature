# lock:coherence:check: a lock's harness pins agree with the pinned harnesses'
# own locks, and each pin is fresh against its repository's main (owner,
# 2026-11-11). Each Scenario names the test that executes it.
Feature: Lock coherence and freshness

  @test:scripts/tests/lock-coherence.test.ts::the_rule:_this_lock's_pin_of_X_contains_every_pinned_harness's_pin_of_X::a_matched_lock_passes:_every_pin_equal_to,_or_newer_than,_what_the_lower_locks_pin
  Scenario: A matched lock passes
    Given a lock pinning core, harness and tools at or after what core's and harness's locks pin
    When its coherence is judged
    Then there are no disagreements and nothing undetermined, three pins are compared and agree, tools has no lock, and the exit code is 0

  @test:scripts/tests/lock-coherence.test.ts::the_rule:_this_lock's_pin_of_X_contains_every_pinned_harness's_pin_of_X::a_mismatched_lock_fails:_tools_pinned_older_than_core's_own_lock_pins_it
  Scenario: Tools pinned older than core's lock pins it fails
    Given a lock pinning tools at t1 while core's lock pins t3
    When its coherence is judged with agreement enforced
    Then the exit code is 1 with one disagreement: tools, behind, via core, with a fix to re-pin to t3 or later
    And the report says FAILED and names both SHAs

  @test:scripts/tests/lock-coherence.test.ts::the_rule:_this_lock's_pin_of_X_contains_every_pinned_harness's_pin_of_X::diverged_pins_fail_too:_neither_contains_the_other
  Scenario: Diverged pins fail
    Given tools pinned at a commit on another line than core's pin
    When coherence is judged with agreement enforced
    Then the only disagreement is via core and diverged, and the exit code is 1

  @test:scripts/tests/lock-coherence.test.ts::the_rule:_this_lock's_pin_of_X_contains_every_pinned_harness's_pin_of_X::every_disagreeing_pair_is_reported,_each_with_both_SHAs
  Scenario: Every disagreeing pair is reported with both SHAs
    Given harness and tools both pinned behind the lower locks
    When coherence is judged
    Then harness via core, tools via core and tools via harness are each reported with the layer's and the lower lock's SHAs

  @test:scripts/tests/lock-coherence.test.ts::the_rule:_this_lock's_pin_of_X_contains_every_pinned_harness's_pin_of_X::a_lower_lock_that_could_not_be_read_is_undetermined,_never_agreement
  Scenario: A lower lock that could not be read is undetermined
    Given lower locks that cannot be read
    When coherence is judged with agreement enforced
    Then both pins are undetermined and the exit code is 2

  @test:scripts/tests/lock-coherence.test.ts::the_rule:_this_lock's_pin_of_X_contains_every_pinned_harness's_pin_of_X::an_unknown_ancestry_is_undetermined,_never_agreement
  Scenario: An unknown ancestry is undetermined
    Given tools pinned at a commit the history does not know
    When coherence is judged with agreement enforced
    Then nothing agrees, tools is undetermined, and the exit code is 2

  @test:scripts/tests/lock-coherence.test.ts::the_rule:_this_lock's_pin_of_X_contains_every_pinned_harness's_pin_of_X::pins_are_matched_by_repository,_so_a_renamed_harness_is_still_compared
  Scenario: Pins are matched by repository, so a renamed harness is compared
    Given tools pinned under another harness name by a differently spelled URL of the same repository
    When coherence is judged
    Then the renamed harness is the one disagreement

  @test:scripts/tests/lock-coherence.test.ts::the_rule:_this_lock's_pin_of_X_contains_every_pinned_harness's_pin_of_X::pinsOf_reads_mounts[]_and_refuses_a_malformed_entry
  Scenario: pinsOf reads mounts and refuses a malformed entry
    Then a lock's mounts are its pins
    And a lock with no mounts throws naming mounts, and a mount with no repository or ref throws naming mounts[]

  @test:scripts/tests/lock-coherence.test.ts::freshness:_every_pin_at_its_repository's_main,_or_ahead_of_it::pins_at_main,_or_descending_from_it,_are_fresh
  Scenario: Pins at main or ahead of it are fresh
    Given tools pinned ahead of main and harness at main
    When freshness is judged
    Then both are checked and fresh, and the exit code is 0

  @test:scripts/tests/lock-coherence.test.ts::freshness:_every_pin_at_its_repository's_main,_or_ahead_of_it::a_pin_behind_main_fails,_naming_the_harness,_both_SHAs_and_the_re-pin
  Scenario: A pin behind main fails, naming the harness, both SHAs and the re-pin
    Given harness pinned behind main
    When freshness is judged
    Then harness alone is stale, behind, with a fix to re-pin to main's SHA, and the exit code is 1
    And the freshness report says FAILED and names both SHAs

  @test:scripts/tests/lock-coherence.test.ts::freshness:_every_pin_at_its_repository's_main,_or_ahead_of_it::the_a43a4d27_shape:_lower_layers_ahead_of_core's_pins_agree,_but_a_stale_core_fails_freshness
  Scenario: Lower layers ahead of core's pins agree, but a stale core fails freshness
    Given a lock pinning harness and tools ahead of core's own lock, and core behind its main
    When coherence and freshness are judged
    Then there are no disagreements, core alone is stale, and the exit code is 1

  @test:scripts/tests/lock-coherence.test.ts::freshness:_every_pin_at_its_repository's_main,_or_ahead_of_it::a_pin_diverged_from_main_fails
  Scenario: A pin diverged from main fails
    When freshness is judged for a pin on another line than main
    Then it is stale as diverged

  @test:scripts/tests/lock-coherence.test.ts::freshness:_every_pin_at_its_repository's_main,_or_ahead_of_it::a_main_that_cannot_be_read_is_undetermined_(exit_2),_never_fresh
  Scenario: A main that cannot be read is undetermined
    When freshness is judged with no readable main
    Then nothing is fresh, one pin is undetermined, and the exit code is 2

  @test:scripts/tests/lock-coherence.test.ts::freshness:_every_pin_at_its_repository's_main,_or_ahead_of_it::an_ancestry_against_main_that_cannot_be_evaluated_is_undetermined_(exit_2)
  Scenario: An ancestry against main that cannot be evaluated is undetermined
    When freshness is judged for a pin the history does not know
    Then one pin is undetermined and the exit code is 2

  @test:scripts/tests/lock-coherence.test.ts::freshness:_every_pin_at_its_repository's_main,_or_ahead_of_it::a_disagreement_still_fails_with_every_pin_fresh
  Scenario: A disagreement fails with every pin fresh when agreement is enforced
    Given tools pinned behind core's lock but every pin at its main
    When coherence and freshness are judged with agreement enforced
    Then nothing is stale and the exit code is 1

  @test:scripts/tests/lock-coherence.test.ts::only_the_top-level_lock_decides_(owner,_2026-11-13)::by_default_a_disagreement_is_reported,_not_a_failure,_when_every_pin_is_fresh
  Scenario: By default a disagreement is reported, not a failure, when every pin is fresh
    Given tools pinned behind core's lock but every pin at its main
    When coherence and freshness are judged by default
    Then there is one disagreement and the exit code is 0
    And the report says DIFFERS and not FAILED

  @test:scripts/tests/lock-coherence.test.ts::only_the_top-level_lock_decides_(owner,_2026-11-13)::by_default_an_undetermined_lower_lock_does_not_fail_either
  Scenario: By default an undetermined lower lock does not fail
    Given core's lock cannot be read
    When coherence is judged by default
    Then one pin is undetermined and the exit code is 0

  @test:scripts/tests/lock-coherence.test.ts::only_the_top-level_lock_decides_(owner,_2026-11-13)::a_stale_pin_still_fails_by_default
  Scenario: A stale pin fails by default
    Given tools pinned behind its main
    When coherence and freshness are judged by default
    Then the exit code is 1

  @test:scripts/tests/lock-coherence.test.ts::fresh_at_re-pin_time_(owner,_2026-11-13,_card_"Lock_gate")::a_pin_behind_main_is_fresh_when_every_commit_main_gained_after_it_is_newer_than_T
  Scenario: A pin behind main is fresh at re-pin time when everything main gained since is newer than T
    Given harness pinned at "a", main at "b", and the lock written at T
    And main's only commit after the pin is dated after T
    When freshness is judged at re-pin time
    Then the pin is fresh at re-pin time, naming its ref and main
    And the exit code is 0
    And the report says main moved after the lock was written, and the pin was fresh at re-pin time

  @test:scripts/tests/lock-coherence.test.ts::fresh_at_re-pin_time_(owner,_2026-11-13,_card_"Lock_gate")::a_pin_behind_main_is_stale_when_main_already_had_a_commit_dated_at_or_before_T
  Scenario: A pin behind main is stale when main already had a commit dated at or before T
    Given harness pinned at "a", main at "b", and the lock written at T
    And main's commit after the pin is dated exactly T
    When freshness is judged at re-pin time
    Then the pin is stale, behind, naming the commit main already had at T
    And the exit code is 1
    And the report says the lock was written behind main

  @test:scripts/tests/lock-coherence.test.ts::fresh_at_re-pin_time_(owner,_2026-11-13,_card_"Lock_gate")::a_diverged_pin_is_stale_whatever_the_dates
  Scenario: A diverged pin is stale at re-pin time whatever the dates
    Given a pin on a side branch that main does not contain
    And main's commits after it are all dated after T
    When freshness is judged at re-pin time
    Then the pin is stale, diverged, and the exit code is 1

  @test:scripts/tests/lock-coherence.test.ts::fresh_at_re-pin_time_(owner,_2026-11-13,_card_"Lock_gate")::a_T_that_cannot_be_found_is_undetermined_(exit_2),_never_fresh
  Scenario: A T that cannot be found is undetermined, never fresh
    Given a pin behind main and no time the lock was written ("not a git repository")
    When freshness is judged at re-pin time
    Then no pin is fresh, one is undetermined, and the exit code is 2

  @test:scripts/tests/lock-coherence.test.ts::fresh_at_re-pin_time_(owner,_2026-11-13,_card_"Lock_gate")::main's_history_after_the_pin_that_cannot_be_read_is_undetermined_(exit_2)
  Scenario: Main's history after the pin that cannot be read is undetermined
    Given a pin behind main, the lock written at T, and main's history unreadable ("offline")
    When freshness is judged at re-pin time
    Then one pin is undetermined and the exit code is 2

  @test:scripts/tests/lock-coherence.test.ts::fresh_at_re-pin_time_(owner,_2026-11-13,_card_"Lock_gate")::at_run_time_(--at-run-time)_the_same_pin_is_stale:_the_old_rule
  Scenario: At run time the same pin behind main is stale, as under the old rule
    Given a pin behind main
    When freshness is judged at run time, with no re-pin time
    Then the pin is stale, no write time is recorded, and the exit code is 1

  @test:scripts/tests/lock-coherence.test.ts::the_git_reader:_real_commits,_real_locks::matched:_tools_pinned_where_core's_lock_pins_it_passes
  Scenario: Over real repositories, tools pinned where core's lock pins it passes
    Given local tools and core repositories, core's lock pinning tools at t2
    When a lock pinning core and tools at t2 is judged
    Then there are no disagreements, one pin agrees, tools has no lock, and the exit code is 0

  @test:scripts/tests/lock-coherence.test.ts::the_git_reader:_real_commits,_real_locks::mismatched:_tools_pinned_older_than_core's_lock_pins_it_fails,_naming_both_SHAs
  Scenario: Over real repositories, tools pinned older than core's lock pins it fails
    When a lock pinning tools at t1 is judged with agreement enforced
    Then the exit code is 1 and the one disagreement is tools behind, naming t1 and t2

  @test:scripts/tests/lock-coherence.test.ts::the_git_reader:_real_commits,_real_locks::freshness:_a_pin_at_main_passes,_one_behind_main_fails,_naming_main's_SHA
  Scenario: Over real repositories, a pin at main is fresh and one behind it is stale
    When freshness is judged for tools at t2, its main
    Then it is fresh
    And for tools at t1 it is stale, behind, naming main's t2

  @test:scripts/tests/lock-coherence.test.ts::the_git_reader:_real_commits,_real_locks::freshness:_a_repository_whose_main_cannot_be_fetched_is_undetermined
  Scenario: Over real repositories, a main that cannot be fetched is undetermined
    Given a reader whose repository URL does not exist
    When freshness is judged
    Then one pin is undetermined and the exit code is 2

  @test:scripts/tests/lock-coherence.test.ts::the_git_reader:_real_commits,_real_locks::at_re-pin_time:_T_from_the_lock's_own_repository,_against_main's_dated_first-parent_chain
  Scenario: Over real repositories, T is read from the lock's own repository and judged against main's dated chain
    Given a repository with commits p1 at 10:00, p2 at 10:10 and p3 at 10:20 on main
    And a layer whose lock pinning p2 is committed at 10:15, followed by an unrelated commit at 10:30
    Then T is 10:15, at the commit that wrote the lock
    When freshness is judged at re-pin time
    Then p2 is fresh at re-pin time, main p3 being the first commit after it, at 10:20
    And p1 is stale, behind, since main already had p2 at T
    And at run time p2 is stale
    When the lock is rewritten and not committed
    Then T is now, at "uncommitted"

  @test:scripts/tests/lock-coherence.test.ts::the_git_reader:_real_commits,_real_locks::T_of_a_lock_outside_any_git_repository_is_unknown
  Scenario: The write time of a lock outside any git repository is unknown
    Given a lock in a directory that is not in a git repository
    When the time it was written is read
    Then it is unknown, because the lock is not in a git repository

  @test:scripts/tests/lock-coherence.test.ts::the_git_reader:_real_commits,_real_locks::a_pin_that_cannot_be_fetched_is_undetermined
  Scenario: Over real repositories, a pin that cannot be fetched is undetermined
    When a lock pinning tools at a commit that does not exist is judged with agreement enforced
    Then there are no disagreements and the exit code is 2
