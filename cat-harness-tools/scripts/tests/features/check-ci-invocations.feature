# scripts/check-ci-invocations.ts reads the direct "--check" calls of TypeScript scripts out of
# workflow YAML. Each Scenario names the test that executes it.
Feature: Reading --check invocations out of workflow YAML

  @test:scripts/tests/check-ci-invocations.test.ts::ciInvocations::`bun_run_<script>.ts_--check`_is_found,_as_before
  Scenario: A "bun run" script call with --check is found
    Given a workflow line "run: bun run cat-harness-tools/scripts/gen-x.ts --strict --check"
    When its CI invocations are read
    Then the one invocation is "cat-harness-tools/scripts/gen-x.ts" with "--strict --check"

  @test:scripts/tests/check-ci-invocations.test.ts::ciInvocations::`bun_<script>.ts_--check`_with_no_`run`_is_found_too
  Scenario: A bare "bun" script call with --check is found
    Given a workflow line "run: bun input/scripts/translation-pot.ts --check"
    When its CI invocations are read
    Then the one invocation is "input/scripts/translation-pot.ts" with "--check"

  @test:scripts/tests/check-ci-invocations.test.ts::ciInvocations::the_bare_form_ends_at_a_shell_operator_or_a_comment
  Scenario: A bare call's arguments stop at a shell operator or a comment
    Given a call followed by "&& echo ok" and another followed by "# why"
    When the CI invocations are read
    Then they are "scripts/y.ts --check --quiet" and "scripts/z.ts --check"

  @test:scripts/tests/check-ci-invocations.test.ts::ciInvocations::a_bare_call_with_an_argument_it_cannot_reproduce_is_not_run_cut_short
  Scenario: A bare call with a shell-expanded argument is not taken
    Given a call inside "$(...)" passing "--repo" "$own"
    When the CI invocations are read
    Then no invocation is found
