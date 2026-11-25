# Specifies, by reading the text of the checkout's code-quality-gates.yml,
# that the catalogue gate has a path that can pass outside a pull_request
# event, and that each pull_request-fed env var is branched on.
Feature: A gate can pass on every event its workflow declares

  @test:test/coordinator/dispatch-gates-can-pass.test.ts::the_catalogue_gate_can_pass_on_a_non-pull_request_event::the_no-base_branch_names_a_base_instead_of_falling_back_to_three_dots
  Scenario: The no-base branch finds a merge base and passes it
    Given the text of code-quality-gates.yml
    When it is read
    Then it contains 'bun run cat translation:catalogue:check -- --base "$base"'
    And it contains "git merge-base origin/main HEAD"
    And the merge-base call comes before the "--base" call
    And no "translation:catalogue:check" call lies between the two

  @test:test/coordinator/dispatch-gates-can-pass.test.ts::the_catalogue_gate_can_pass_on_a_non-pull_request_event::a_base_that_still_cannot_be_found_stays_exit_2,_never_a_pass
  Scenario: A base that cannot be found exits 2
    Given the text of code-quality-gates.yml
    When the message "no merge base against origin/main after deepening" is found
    Then it is present
    And "exit 2" appears within the 200 characters that follow it

  @test:test/coordinator/dispatch-gates-can-pass.test.ts::the_catalogue_gate_can_pass_on_a_non-pull_request_event::every_trigger_the_workflow_declares_is_still_declared
  Scenario: The pull_request, merge_group and workflow_dispatch triggers are still declared
    Given the text of code-quality-gates.yml
    When it is read
    Then it contains "pull_request:", "merge_group:" and "workflow_dispatch:"

  @test:test/coordinator/dispatch-gates-can-pass.test.ts::the_general_rule:_a_pull_request-only_input_declares_its_other_events::each_env_var_fed_from_github.event.pull_request.*_is_branched_on
  Scenario: Every env var fed from the pull_request payload is branched on
    Given the text of code-quality-gates.yml
    When the env vars set from "github.event.pull_request." are collected
    Then there is at least one
    And for each, the text contains a -n or -z test on it
