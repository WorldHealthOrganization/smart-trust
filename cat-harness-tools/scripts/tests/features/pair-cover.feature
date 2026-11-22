# Regen derives a covered check's verdict from its coverers instead of
# re-running work other pairs already do (bean 8qyc), and never reports a
# covered check green while a coverer is red. Each Scenario names the test that executes it.
Feature: Folding covered checks in regen

  @test:scripts/tests/pair-cover.test.ts::when_a_check_is_folded::only_when_EVERY_coverer_is_asked_in_the_same_pass
  Scenario: A check is folded only when every coverer is asked in the same pass
    Then skill:register:check is foldable when all its coverers are asked, and not when one is dropped
    And kg:audit:check is foldable only alongside kg:audit:all:check

  @test:scripts/tests/pair-cover.test.ts::when_a_check_is_folded::a_cycle_is_never_folded_—_both_are_asked_in_full
  Scenario: A cycle is never folded
    Given two checks each covering the other
    Then neither is foldable

  @test:scripts/tests/pair-cover.test.ts::regenPass_with_folds::skill:register:check_runs_its_residual,_not_the_107-second_whole;_kg:audit:check_runs_nothing
  Scenario: A folded check runs its residual and a fully covered check runs nothing
    When a dry-run pass asks every skill pair and kg:audit:all:check
    Then skill:register:check is not asked but its declarations residual is, kg:audit:check is not asked but kg:audit:all:check is
    And every result is current, or judged for a judge check

  @test:scripts/tests/pair-cover.test.ts::regenPass_with_folds::a_red_coverer_is_NEVER_a_green_covered_check_—_through_two_levels_of_folding
  Scenario: A red coverer is never a green covered check, through two levels
    Given kg:audit:all:check is red and its writer does not repair it
    When the pass runs
    Then kg:audit:all:check and kg:audit:check are unrepaired, the latter covered by the former
    And skill:register:check is unrepaired, covered by kg:audit:check

  @test:scripts/tests/pair-cover.test.ts::regenPass_with_folds::a_stale_coverer_makes_the_covered_check_stale_too,_in_a_dry_run
  Scenario: A stale coverer makes the covered check stale in a dry run
    Given skills:docs:check is stale
    When a dry-run pass runs
    Then skill:register:check is regenerated, covered by skills:docs:check

  @test:scripts/tests/pair-cover.test.ts::regenPass_with_folds::a_red_residual_runs_the_covered_check's_OWN_writer,_then_re-asks_the_residual
  Scenario: A red residual runs the covered check's own writer, then re-asks the residual
    Given the declarations residual is red until skill:register:check's writer runs
    When the pass runs
    Then only that writer ran, the residual was asked twice, and skill:register:check is regenerated

  @test:scripts/tests/pair-cover.test.ts::regenPass_with_folds::a_residual_that_stays_red_is_reported_as_such_even_when_every_coverer_is_green
  Scenario: A residual that stays red is unrepaired though every coverer is green
    Given the declarations residual stays red
    When the pass runs
    Then skill:register:check is unrepaired

  @test:scripts/tests/pair-cover.test.ts::regenPass_with_folds::without_its_coverers_the_check_is_asked_whole
  Scenario: Without its coverers the check is asked whole
    When a dry-run pass asks only skill:register:check and kg:audit:check
    Then both are asked and the declarations residual is not

  @test:scripts/tests/pair-cover.test.ts::regenPass_with_folds::settleCovered_leaves_an_unfolded_result_alone
  Scenario: settleCovered leaves an unfolded result alone
    Then settling a result with no folds returns it unchanged

  @test:scripts/tests/pair-cover.test.ts::the_equivalences_still_hold_in_this_tree::skill:register's_residual_is_its_gate_plus_--declarations-only,_and_its_chain_names_scripts
  Scenario: skill:register's residual is its gate plus --declarations-only
    Then the declarations residual script is the gate's script with --declarations-only
    And every chain step is a bare script name

  @test:scripts/tests/pair-cover.test.ts::the_equivalences_still_hold_in_this_tree::kg:audit:all:check_runs_kg:audit:check's_audit_for_the_cat-harness_instance,_flags_and_all
  Scenario: kg:audit:all:check runs kg:audit:check's audit for the cat-harness instance
    Then kg:audit:check and kg:audit:all:check are the expected kg-audit scripts with --check --against main
    And the sweep's instance roots include the harness
    And kg-audit-all.ts passes --check and --against through and fails on any exit other than 0 or 1
