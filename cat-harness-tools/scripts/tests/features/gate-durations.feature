# scripts/gate-durations.ts is the pre-push time budget: it reads a gate run's times from its log, keeps this
# machine's longest times, and chooses the gates over budget to hold out.
# Each Scenario names the test that executes it.
Feature: The pre-push gate time budget

  @test:scripts/tests/gate-durations.test.ts::durationsFromLog_reads_only_the_pool's_lines,_the_longest_when_a_gate_ran_twice
  Scenario: durationsFromLog reads only the parallel pool's gate times, the longest when a gate ran twice
    Given a gate log with a timed serial step, two parallel runs of "check:a", a skipped "check:b", a timed output line and "check:c --all"
    When durationsFromLog reads it
    Then the durations are "bun run cat check:a" 80.5 and "bun run cat check:c --all" 3

  @test:scripts/tests/gate-durations.test.ts::mergeDurations_keeps_the_longest_seen,_and_starts_over_under_another_bun
  Scenario: mergeDurations keeps the longest time seen and starts over under another bun version
    Given recorded durations x 10 and y 70
    When durations x 5, y 90 and z 1 are merged under the same tools
    Then the seconds are x 10, y 90 and z 1
    And merging x 2 under bun "1.5.0" leaves only x 2

  @test:scripts/tests/gate-durations.test.ts::overBudget::a_time_here_wins_over_the_seed,_both_ways
  Scenario: A time measured here wins over the seed in either direction
    Given times here of fast 10 and slow 61, and a seed of fast 500, other 120 and small 30
    When the gates over a 60-second budget are chosen
    Then they are "other" at 120 from the seed and "slow" at 61 from here

  @test:scripts/tests/gate-durations.test.ts::overBudget::no_budget_holds_nothing_out
  Scenario: With no budget no gate is held out
    When the gates over budget are chosen with no budget
    Then none are held out

  @test:scripts/tests/gate-durations.test.ts::the_committed_seed_parses,_and_every_entry_is_over_the_default_budget
  Scenario: The committed seed parses and every entry is over the default budget
    When the committed seed is read
    Then it has at least one entry
    And every entry's seconds exceed the default budget

  @test:scripts/tests/gate-durations.test.ts::budgetSeconds:_env_first,_then_git_config,_else_60;_0_is_none;_garbage_is_refused
  Scenario: budgetSeconds reads the environment first, then git config, else the default
    Given a fresh git repository
    Then with nothing set the budget is the default
    And with git config "cat.gates.budgetSeconds" 120 the budget is 120
    And with CAT_PREPUSH_BUDGET "30" the budget is 30
    And with CAT_PREPUSH_BUDGET "0" there is no budget
    And with CAT_PREPUSH_BUDGET "soon" it throws "number of seconds"
