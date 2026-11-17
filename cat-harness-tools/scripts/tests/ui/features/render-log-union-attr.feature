# scripts/render-log-union-attr.sh marks the render log's .jsonl files merge=union in a checkout,
# so two jobs appending to the same day's log rebase cleanly. Each Scenario names the test that executes it.
Feature: Union merge attribute for the render log

  @test:scripts/tests/ui/render-log-union-attr.test.ts::render-log-union-attr.sh::WITHOUT_it_the_retry's_rebase_conflicts_—_the_CI_failure,_reproduced
  Scenario: Without the attribute the retry's rebase conflicts
    Given two clones of a gh-pages branch that each appended a line to the same day's render log, the first already pushed
    When the second pulls with rebase
    Then the rebase fails
    And the render log is left unmerged

  @test:scripts/tests/ui/render-log-union-attr.test.ts::render-log-union-attr.sh::WITH_it_the_rebase_succeeds_and_BOTH_sides'_lines_survive
  Scenario: With the attribute the rebase succeeds and both sides' lines survive
    Given the same interleaved clones
    When the script is run on the second clone and it pulls with rebase
    Then the rebase succeeds
    And the render log holds 3 lines, including the line from each side

  @test:scripts/tests/ui/render-log-union-attr.test.ts::render-log-union-attr.sh::it_is_idempotent_—_the_rule_is_not_appended_twice
  Scenario: Running the script twice adds the rule once
    Given the interleaved clones
    When the script is run twice on the second clone
    Then .git/info/attributes names "_render-log" exactly once

  @test:scripts/tests/ui/render-log-union-attr.test.ts::render-log-union-attr.sh::it_is_SCOPED_to_the_render_log,_never_to_.jsonl_at_large
  Scenario: The rule is scoped to the render log, not every .jsonl file
    Given the script's source text
    Then it contains "_render-log/*.jsonl merge=union"
    And it has no line writing a rule for "*.jsonl" at large

  @test:scripts/tests/ui/render-log-union-attr.test.ts::render-log-union-attr.sh::it_FAILS_rather_than_no-ops_when_the_attribute_does_not_take_effect
  Scenario: The script fails when the attribute does not take effect
    Given the interleaved clones
    And a copy of the script whose attribute write is replaced by a no-op
    When the neutered copy is run on the second clone
    Then it fails
    And the unchanged script run on the same clone succeeds
