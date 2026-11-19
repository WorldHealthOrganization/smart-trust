# Specifies DEPLOY_ONLY_STEP and parseMergeMainDispatches
# (scripts/merge-guard.ts) against the checkout's feature-staging.yml and
# merge-main.yml.
Feature: The merge guard's step name and dispatch parser match the real workflows

  @test:test/coordinator/merge-guard-workflows.test.ts::the_deploy-only_step_name_is_the_one_the_staging_workflow_runs
  Scenario: The deploy-only step name is a step feature-staging.yml runs
    Given feature-staging.yml
    When it is read
    Then it contains a "- name:" line with exactly the deploy-only step name

  @test:test/coordinator/merge-guard-workflows.test.ts::check_5_—_a_held_run_on_a_bot-merged_head_is_judged_by_its_dispatch::parseMergeMainDispatches_reads_today's_merge-main.yml,_and_refuses_a_line_it_cannot_read
  Scenario: The dispatch parser reads merge-main.yml and refuses lines it cannot read
    Given merge-main.yml
    When its dispatches are parsed
    Then they are code-quality-gates.yml and jsonld-gen-check.yml
    And a for-loop over "a.yml b.yml" running gh workflow run parses as a.yml and b.yml
    And a for-loop over "$WORKFLOWS" does not parse
    And a bare "gh workflow run code-quality-gates.yml" does not parse
