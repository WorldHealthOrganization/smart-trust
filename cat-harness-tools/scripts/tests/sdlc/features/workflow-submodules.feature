# scripts/check-workflow-submodules.ts flags a workflow job that runs a platform script
# from a checkout no lock replay has mounted, reading the workflow YAML as text.
# Each Scenario names the test that executes it.
Feature: Workflow jobs run platform scripts only from mounted checkouts

  @test:scripts/tests/sdlc/workflow-submodules.test.ts::the_rule::a_job_running_a_platform_script_from_a_submodule-less_checkout_is_a_finding
  Scenario: A job running a platform script from an unmounted checkout is a finding
    Given the "cleanup" job that checks out into "source" and runs source/cat-harness/scripts/staging-record.ts
    When the workflow is audited
    Then there is 1 finding
    And it names job "cleanup"
    And its detail names "staging-record.ts"

  @test:scripts/tests/sdlc/workflow-submodules.test.ts::the_rule::a_lock_replay_into_the_checkout's_path_clears_it
  Scenario: A lock replay into the checkout's path clears the finding
    Given the same job with a step running mount-from-lock.ts with --root "source" before the script
    When the workflow is audited
    Then there are no findings

  @test:scripts/tests/sdlc/workflow-submodules.test.ts::the_rule::the_index_checkout's_`.github/mount-from-lock.sh`_wrapper_is_a_lock_replay_too
  Scenario: The .github/mount-from-lock.sh wrapper counts as a lock replay
    Given the job with a step running ./.github/mount-from-lock.sh with --root "source"
    When the workflow is audited
    Then there are no findings
    And with the wrapper run with --root "other" instead there is 1 finding

  @test:scripts/tests/sdlc/workflow-submodules.test.ts::the_rule::`submodules:_true`_alone_no_longer_clears_it_—_there_is_no_`.gitmodules`_to_read
  Scenario: A checkout with submodules true but no lock replay is still a finding
    Given the broken job whose checkout also sets "submodules: true"
    When the workflow is audited
    Then there is 1 finding

  @test:scripts/tests/sdlc/workflow-submodules.test.ts::the_rule::a_replay_into_a_DIFFERENT_path_does_not_clear_it
  Scenario: A lock replay into a different path does not clear the finding
    Given the job with a mount-from-lock.ts replay whose paths name "elsewhere"
    When the workflow is audited
    Then there is 1 finding

  @test:scripts/tests/sdlc/workflow-submodules.test.ts::the_rule::a_step-output_path_reached_through_`env:`_is_followed_to_its_value_(folio-staging.yml)
  Scenario: A step-output checkout path reached through env is followed to its value
    Given a checkout at the step output "steps.platform.outputs.checkout"
    And a mount step whose env PLATFORM_CHECKOUT holds that same output and replays with --root "$PLATFORM_CHECKOUT"
    And a later step running "$PLATFORM_CHECKOUT/cat-harness/scripts/x.ts"
    When the workflow is audited
    Then there are no findings
    And when PLATFORM_CHECKOUT holds "inputs.other" instead there is 1 finding

  @test:scripts/tests/sdlc/workflow-submodules.test.ts::the_rule::a_job_that_runs_NO_platform_script_is_not_a_finding,_however_it_checked_out
  Scenario: A job that runs no platform script is not a finding
    Given the broken job with its script step replaced by "echo hello"
    When the workflow is audited
    Then there are no findings

  @test:scripts/tests/sdlc/workflow-submodules.test.ts::what_it_must_NOT_flag::a_PUBLISH-branch_checkout_is_exempt_—_it_holds_built_output,_not_the_platform
  Scenario: A checkout of the publish branch is exempt
    Given a job checking out ref "gh-pages" into "pages" and running pages/whatever.ts
    When the workflow is audited
    Then there are no findings

  @test:scripts/tests/sdlc/workflow-submodules.test.ts::what_it_must_NOT_flag::the_`publish_branch`_input_is_exempt_for_the_same_reason
  Scenario: A checkout of the publish_branch input is exempt
    Given a job checking out ref "inputs.publish_branch" into "pages" and running pages/whatever.ts
    When the workflow is audited
    Then there are no findings

  @test:scripts/tests/sdlc/workflow-submodules.test.ts::what_it_must_NOT_flag::a_`package.json`_script_name_is_not_a_platform_script_path
  Scenario: A package.json script name is not a platform script path
    Given the broken job with its script step replaced by "bun run cat gates"
    When the workflow is audited
    Then there are no findings

  @test:scripts/tests/sdlc/workflow-submodules.test.ts::however_the_path_is_spelled::%s_is_still_seen_as_a_platform_script
  Scenario: Each spelling of a platform script path is still seen as a platform script
    Given the broken job running the script spelled one of three ways: plain "source/cat-harness/scripts/x.ts", parent-relative "../source/...", or through the shell variable "$PLATFORM_DIR"
    When the workflow is audited
    Then there is 1 finding for each spelling

  @test:scripts/tests/sdlc/workflow-submodules.test.ts::the_readers::jobs_are_split_by_their_two-space_header,_and_carry_a_line_number
  Scenario: Jobs are split by their two-space header and carry a line number
    Given the broken workflow
    When its jobs are read
    Then the only job is "cleanup"
    And it starts on line 4

  @test:scripts/tests/sdlc/workflow-submodules.test.ts::the_readers::a_non-indented_key_ends_the_jobs_block,_so_trailing_YAML_is_not_a_job
  Scenario: A non-indented key ends the jobs block
    Given the broken workflow followed by a top-level "concurrency:" block
    When its jobs are read
    Then the only job is "cleanup"

  @test:scripts/tests/sdlc/workflow-submodules.test.ts::the_readers::a_checkout's_`with:`_keys_stop_at_the_next_step
  Scenario: A checkout's with keys stop at the next step
    Given a job with a checkout into "source", a checkout into "other", and a lock replay into "other"
    When its checkouts are read
    Then there are 2 checkouts
    And the first is not mounted
    And the second is mounted

  @test:scripts/tests/sdlc/workflow-submodules.test.ts::the_readers::every_platform_script_in_a_job_is_found,_not_just_the_first
  Scenario: Every platform script in a job is found
    Given the broken job running source/a.ts, source/b.ts and source/c.ts
    When its bun runs are read
    Then 3 are found

  @test:scripts/tests/sdlc/workflow-submodules.test.ts::the_blind_spot_is_reported_rather_than_implied::a_composite-action_call_from_a_submodule-less_checkout_is_named
  Scenario: A composite-action call from an unmounted checkout is reported, not flagged
    Given a job checking out into "source" and then using ./.github/actions/do-a-thing
    When the workflow is audited
    Then there are no findings
    And 1 composite call is reported
    And its detail names ".github/actions/do-a-thing"

  @test:scripts/tests/sdlc/workflow-submodules.test.ts::a_checkout_of_the_repository's_own_CI_scripts_alone::is_not_a_finding,_inline_or_as_a_block
  Scenario: A checkout of only the repository's own CI scripts is not a finding
    Given a job checking out main with sparse-checkout ".github/scripts" and running a .github/scripts script
    When the workflow is audited
    Then there are no findings
    And the same holds for a block sparse-checkout of ".github/scripts" and ".github/actions"

  @test:scripts/tests/sdlc/workflow-submodules.test.ts::a_checkout_of_the_repository's_own_CI_scripts_alone::a_sparse_checkout_that_also_takes_platform_source_still_is
  Scenario: A sparse checkout that also takes platform source is still a finding
    Given a job checking out main with block sparse-checkout ".github/scripts" and "cat-harness"
    When the workflow is audited
    Then there is 1 finding

  @test:scripts/tests/sdlc/workflow-submodules.test.ts::a_local_composite_action_that_mounts_the_lock_(ci-setup,_bean_ay33)::an_action_that_runs_`mount:lock:check`_clears_the_root_checkout
  Scenario: A local action that runs mount:lock:check clears the root checkout
    Given a job checking out at the workspace root, using ./.github/actions/ci-setup, then running a cat-harness-tools script
    And the ci-setup action runs "bun run cat mount:lock:check"
    When the workflow is audited with that action readable
    Then there are no findings

  @test:scripts/tests/sdlc/workflow-submodules.test.ts::a_local_composite_action_that_mounts_the_lock_(ci-setup,_bean_ay33)::an_action_that_replays_the_lock_with_`--root_.`_clears_it
  Scenario: A local action that replays the lock with --root . clears the root checkout
    Given the same job and a ci-setup action running .github/mount-from-lock.sh with "--root ."
    When the workflow is audited with that action readable
    Then there are no findings

  @test:scripts/tests/sdlc/workflow-submodules.test.ts::a_local_composite_action_that_mounts_the_lock_(ci-setup,_bean_ay33)::an_action_that_neither_replays_nor_checks_the_lock_does_not
  Scenario: A local action that neither replays nor checks the lock does not clear it
    Given the same job and a ci-setup action that only runs "bun install --frozen-lockfile"
    When the workflow is audited with that action readable
    Then there is 1 finding

  @test:scripts/tests/sdlc/workflow-submodules.test.ts::a_local_composite_action_that_mounts_the_lock_(ci-setup,_bean_ay33)::an_action_that_cannot_be_read_does_not_—_the_job's_own_text_is_all_there_is
  Scenario: An unreadable local action does not clear the finding
    Given the same job
    When the workflow is audited with a reader that returns nothing for the action
    Then there is 1 finding
    And with no reader at all there is 1 finding

  @test:scripts/tests/sdlc/workflow-submodules.test.ts::a_local_composite_action_that_mounts_the_lock_(ci-setup,_bean_ay33)::it_serves_only_a_checkout_at_the_workspace_root:_one_at_`source`_is_still_a_finding
  Scenario: A lock-mounting local action does not clear a checkout at source
    Given the job with its checkout at path "source" and a ci-setup action running mount:lock:check
    When the workflow is audited with that action readable
    Then there is 1 finding

  @test:scripts/tests/sdlc/workflow-submodules.test.ts::a_remote_action_pinned_to_the_commit_the_lock_mounts::only_whole-repository_mounts_are_read_from_the_lock
  Scenario: Only whole-repository mounts are read from the lock
    Given a lock with a whole mount of "litlfred/cat-harness-tools" and a mount of "litlfred/part" from upstream root "sub"
    When its pinned mounts are read
    Then the only key is "litlfred/cat-harness-tools"

  @test:scripts/tests/sdlc/workflow-submodules.test.ts::a_remote_action_pinned_to_the_commit_the_lock_mounts::at_the_locked_sha_it_is_read_from_the_mount
  Scenario: A remote action pinned to the locked sha is read from the mount
    Given a job using litlfred/cat-harness-tools/.github/actions/ci-setup at the locked sha
    When its action directory is resolved
    Then it is "cat-harness-tools/.github/actions/ci-setup"
    And with that mounted action running mount:lock:check the audit has no findings

  @test:scripts/tests/sdlc/workflow-submodules.test.ts::a_remote_action_pinned_to_the_commit_the_lock_mounts::at_another_sha,_a_branch,_or_with_no_lock,_it_clears_nothing
  Scenario: A remote action at another sha, a branch, or with no lock clears nothing
    Given the same job and a mounted ci-setup action running mount:lock:check
    When the action is pinned to another sha
    Then there is 1 finding
    And pinned to "main" there is 1 finding
    And at the locked sha but with no pinned mounts there is 1 finding

  @test:scripts/tests/sdlc/workflow-submodules.test.ts::a_remote_action_pinned_to_the_commit_the_lock_mounts::a_repository_the_lock_mounts_only_in_part_is_not_read
  Scenario: A repository the lock mounts only in part is not read
    Given a "uses:" line naming litlfred/part's ci-setup at the locked sha
    When its action directory is resolved
    Then it resolves to nothing

  @test:scripts/tests/sdlc/workflow-submodules.test.ts::a_remote_action_pinned_to_the_commit_the_lock_mounts::a_local_action_still_resolves_to_its_own_directory
  Scenario: A local action still resolves to its own directory
    Given the line "uses: ./.github/actions/ci-setup"
    When its action directory is resolved
    Then it is ".github/actions/ci-setup"
