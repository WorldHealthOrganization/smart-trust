# The repository's GitHub Actions workflows parse and declare a name and triggers, and
# scripts/check-workflows.ts guards gh-pages pushes, preview logging and bean-store mounts.
# Each Scenario names the test that executes it.
Feature: GitHub Actions workflows parse and publish safely

  @test:scripts/tests/sdlc/workflow-yaml.test.ts::GitHub_Actions_workflows::there_are_workflows_to_check
  Scenario: The workflow directory is not empty
    Given the .yml and .yaml files in the repository's .github/workflows directory
    When they are counted
    Then there is at least one

  @test:scripts/tests/sdlc/workflow-yaml.test.ts::GitHub_Actions_workflows::%s::parses
  Scenario: Each workflow parses as YAML
    Given each workflow file in .github/workflows
    When it is parsed as YAML
    Then parsing does not throw

  @test:scripts/tests/sdlc/workflow-yaml.test.ts::GitHub_Actions_workflows::%s::declares_a_name_and_triggers
  Scenario: Each workflow declares a name and triggers
    Given each workflow file in .github/workflows, parsed as YAML
    When its top-level keys are read
    Then "name" is a string
    And "on" (or the YAML 1.1 key "true") is defined

  @test:scripts/tests/sdlc/workflow-yaml.test.ts::GitHub_Actions_workflows::every_job_that_pushes_gh-pages_is_protected_—_by_the_queue_or_a_retry
  Scenario: Every job that pushes gh-pages is in the push queue or retries
    Given the repository's workflows
    When the workflow checks run
    Then there is no "gh-pages-ungrouped" finding

  @test:scripts/tests/sdlc/workflow-yaml.test.ts::GitHub_Actions_workflows::jobs_that_contend_SIMULTANEOUSLY_take_the_retry,_not_the_queue
  Scenario: Jobs that publish gh-pages in parallel use a retry instead of the queue
    Given discoverability-docs.yml
    When its text is read
    Then it does not contain "group: gh-pages-push"
    And it has 6 non-comment uses of peaceiris/actions-gh-pages
    And "continue-on-error: true" appears 3 times

  @test:scripts/tests/sdlc/workflow-yaml.test.ts::GitHub_Actions_workflows::the_group_is_one_literal_string,_because_a_group_matches_on_the_literal
  Scenario: The gh-pages concurrency group is one literal string
    Given the checker's gh-pages group constant
    Then it is "gh-pages-push"

  @test:scripts/tests/sdlc/workflow-yaml.test.ts::GitHub_Actions_workflows::code-quality-gates.yml_actually_triggers_on_pull_request
  Scenario: code-quality-gates.yml triggers on pull_request
    Given code-quality-gates.yml, parsed as YAML
    When its triggers are read
    Then they include "pull_request"

  @test:scripts/tests/sdlc/workflow-yaml.test.ts::GitHub_Actions_workflows::code-quality-gates.yml_has_no_paths:_filter_on_pull_request
  Scenario: code-quality-gates.yml has no paths filter on pull_request
    Given code-quality-gates.yml, parsed as YAML
    When its pull_request trigger is read
    Then it is empty or has no "paths" key

  @test:scripts/tests/sdlc/workflow-yaml.test.ts::GitHub_Actions_workflows::the_TypeScript_gate_runs_all_three_checks
  Scenario: The TypeScript gate runs tests, lint and type checks
    Given code-quality-gates.yml, parsed as YAML
    Then it has no "typescript" roll-up job and no "e2e" job
    And the run steps of "typescript-static" and "typescript-test" contain "bun test", "bun run cat lint" and "bun run cat typecheck:instances"
    And scripts/typecheck-instances.ts contains "--noEmit"
    And "typescript-test" is sharded 1 to 4 and "e2e-shard" 1 to 3

  @test:scripts/tests/sdlc/workflow-yaml.test.ts::gh-pages_full-replace_vs_the_STAGING_previews::it_fires_on_a_root_replace_with_neither_keep_files_nor_destination_dir
  Scenario: A root gh-pages replace without keep_files or destination_dir is flagged
    Given a workflow publishing ./_site to gh-pages with peaceiris/actions-gh-pages and nothing else
    When it is checked for a gh-pages wipe of the previews
    Then there is 1 "gh-pages-wipes-staging" finding
    And its detail names "branches/"

  @test:scripts/tests/sdlc/workflow-yaml.test.ts::gh-pages_full-replace_vs_the_STAGING_previews::a_restore_step_in_front_of_the_push_clears_it
  Scenario: A restore step before the push clears the wipe finding
    Given the same workflow with a step running restore-staging.ts --site ./_site before the publish
    When it is checked for a gh-pages wipe of the previews
    Then there are no findings

  @test:scripts/tests/sdlc/workflow-yaml.test.ts::gh-pages_full-replace_vs_the_STAGING_previews::a_--verify_run_is_NOT_a_restore_—_it_reports,_it_does_not_carry
  Scenario: A restore-staging.ts --verify run is not a restore
    Given the same workflow with a step running restore-staging.ts --verify before the publish
    When it is checked for a gh-pages wipe of the previews
    Then there is 1 finding

  @test:scripts/tests/sdlc/workflow-yaml.test.ts::gh-pages_full-replace_vs_the_STAGING_previews::keep_files_and_a_scoped_destination_dir_are_each_exempt
  Scenario: keep_files and a scoped destination_dir each exempt the push
    Given the same workflow with "keep_files: true" added
    When it is checked for a gh-pages wipe of the previews
    Then there are no findings
    And with "destination_dir: STAGING/x" added instead there are no findings

  @test:scripts/tests/sdlc/workflow-yaml.test.ts::gh-pages_full-replace_vs_the_STAGING_previews::no_workflow_in_this_repository_wipes_the_previews
  Scenario: No workflow in the repository wipes the previews
    Given the repository's workflows
    When the workflow checks run
    Then there is no "gh-pages-wipes-staging" finding

  @test:scripts/tests/sdlc/workflow-yaml.test.ts::every_path_that_publishes_or_removes_a_preview_also_LOGS_it::`%s`_invokes_render-log.ts
  Scenario: Each feature-staging job that changes previews invokes render-log.ts
    Given feature-staging.yml, parsed as YAML
    When the run steps of one job are read, for each of "stage", "cleanup" and "cleanup-dispatch"
    Then they contain "scripts/render-log.ts"

  @test:scripts/tests/sdlc/workflow-yaml.test.ts::every_path_that_publishes_or_removes_a_preview_also_LOGS_it::the_change_and_its_record_are_ONE_commit,_on_EVERY_path
  Scenario: The preview change and its log entry are staged by one git add on every path
    # Gap: that the staged changes then go out in a single commit is not checked
    Given feature-staging.yml, parsed as YAML
    When the run steps of "stage", "cleanup" and "cleanup-dispatch" are read
    Then each has a "git add -A" naming the preview directory and "_render-log" together

  @test:scripts/tests/sdlc/workflow-yaml.test.ts::every_path_that_publishes_or_removes_a_preview_also_LOGS_it::a_removal_names_a_reason_—_the_tool_refuses_without_one
  Scenario: Each removal path logs a removed event with a reason
    # Gap: that render-log.ts refuses a removal without a reason is not checked
    Given feature-staging.yml, parsed as YAML
    When the run steps of "cleanup" and "cleanup-dispatch" are read
    Then each contains "--event removed"
    And each contains "--reason"

  @test:scripts/tests/sdlc/workflow-yaml.test.ts::every_path_that_publishes_or_removes_a_preview_also_LOGS_it::a_refused_removal_is_recorded_too_—_`retained`_is_why_the_log_is_worth_reading
  Scenario: A refused removal is logged as retained
    Given feature-staging.yml, parsed as YAML
    When the run steps of "cleanup" are read
    Then they contain "--event retained"

  @test:scripts/tests/sdlc/workflow-yaml.test.ts::every_path_that_publishes_or_removes_a_preview_also_LOGS_it::`cleanup`_logs_the_GATE'S_OWN_reason,_never_a_restatement_of_one_branch
  Scenario: cleanup logs the reason the gate emitted
    Given the "cleanup" job of feature-staging.yml
    When its steps that run render-log.ts are read
    Then there is at least one
    And each sets env CLEANUP_REASON from "steps.check.outputs.reason"
    And each run uses "$CLEANUP_REASON"
    And none hardcodes a "closed and carried" label reason

  @test:scripts/tests/sdlc/workflow-yaml.test.ts::every_path_that_publishes_or_removes_a_preview_also_LOGS_it::every_job_that_writes_the_log_checks_out_the_publish_branch_AND_the_platform
  Scenario: Every removal job checks out both the publish branch and the platform
    # Gap: the "stage" job, which also writes the log, is not checked
    Given the "cleanup" and "cleanup-dispatch" jobs of feature-staging.yml
    When the paths of their actions/checkout steps are read
    Then each job checks out into "source" and into "pages"

  @test:scripts/tests/sdlc/workflow-yaml.test.ts::every_path_that_publishes_or_removes_a_preview_also_LOGS_it::bean-gate-unmounted::a_bean_gate_with_no_mount_in_its_job_is_a_finding
  Scenario: A bean gate in a job with no state mount is a finding
    Given a job running "bun run cat check:bean-parents" and no mount
    When it is checked for unmounted bean gates
    Then there is 1 "bean-gate-unmounted" finding
    And its detail says there is no "bun run cat state:mount" step

  @test:scripts/tests/sdlc/workflow-yaml.test.ts::every_path_that_publishes_or_removes_a_preview_also_LOGS_it::bean-gate-unmounted::a_mount_AFTER_the_gate_is_a_finding_too:_the_gate_still_ran_over_nothing
  Scenario: A state mount after the bean gate is still a finding
    Given a job running "bun run cat kg:audit:check" and then the state mount
    When it is checked for unmounted bean gates
    Then there is 1 finding
    And its detail says the gate runs BEFORE its state:mount step

  @test:scripts/tests/sdlc/workflow-yaml.test.ts::every_path_that_publishes_or_removes_a_preview_also_LOGS_it::bean-gate-unmounted::mounted_first:_clean
  Scenario: A bean gate after the state mount is clean
    Given a job running the state mount and then "bun run cat check:bean-rollup"
    When it is checked for unmounted bean gates
    Then there are no findings

  @test:scripts/tests/sdlc/workflow-yaml.test.ts::every_path_that_publishes_or_removes_a_preview_also_LOGS_it::bean-gate-unmounted::PER_JOB_—_a_sibling_job's_mount_does_not_cover_this_one
  Scenario: A sibling job's mount does not cover a bean gate
    Given job "a" running the state mount and job "b" running "bun run cat check:bean-blocks"
    When it is checked for unmounted bean gates
    Then there is 1 finding
    And its detail names job "b"

  @test:scripts/tests/sdlc/workflow-yaml.test.ts::every_path_that_publishes_or_removes_a_preview_also_LOGS_it::bean-gate-unmounted::a_COMMENT_naming_a_gate_is_not_a_gate
  Scenario: A comment naming a bean gate is not a gate
    Given a job whose only step line is a comment naming "bun run cat check:bean-parents"
    When it is checked for unmounted bean gates
    Then there are no findings

  @test:scripts/tests/sdlc/workflow-yaml.test.ts::every_path_that_publishes_or_removes_a_preview_also_LOGS_it::bean-gate-unmounted::the_real_workflows_are_clean,_and_the_rule_reaches_every_declared_reader
  Scenario: The real workflows have no unmounted bean gates
    # Gap: that the rule matches each declared reader is not checked, only the list's length
    Given every workflow file in .github/workflows
    When each is checked for unmounted bean gates
    Then none has a finding
    And more than 8 bean-store reader commands are declared

  @test:scripts/tests/sdlc/workflow-yaml.test.ts::every_path_that_publishes_or_removes_a_preview_also_LOGS_it::the_log_lives_OUTSIDE_STAGING/,_so_`rm_-rf_STAGING/$SLUG`_cannot_reach_it
  Scenario: The render log is written outside STAGING/
    Given the run steps of "stage", "cleanup" and "cleanup-dispatch" in feature-staging.yml
    Then they contain "--dir pages"
    And they do not contain "STAGING/$SLUG/_render-log"
    And no --path argument points under STAGING/<slug>/_render-log
