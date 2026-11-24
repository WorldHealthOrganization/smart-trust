# Three ways an agent-run publish used to fail on an IG's first publish, each
# now handled by the publisher, against local bare repositories.
# Each Scenario names the test that executes it.
Feature: Robust local staging

  @test:scripts/tests/stage-local-robust.test.ts::1._origin_has_no_gh-pages:_it_is_started_as_an_orphan_holding_.nojekyll::ensurePublishBranch_starts_the_branch_once,_and_leaves_an_existing_one_alone
  Scenario: A missing gh-pages is started once as an orphan
    Given a bare origin with no gh-pages
    When the publish branch is ensured
    Then it is "created", the log says "orphan", and the branch holds only the new-branch file in one commit
    And ensuring it again says "exists" and leaves its tip unchanged

  @test:scripts/tests/stage-local-robust.test.ts::1._origin_has_no_gh-pages:_it_is_started_as_an_orphan_holding_.nojekyll::a_remote_that_does_not_answer_is_never_read_as_'no_branch'
  Scenario: An unreachable remote is unknown, not branchless
    Given a remote path that does not exist
    Then whether it has gh-pages is unknown
    And ensuring the branch throws "could not read gh-pages"

  @test:scripts/tests/stage-local-robust.test.ts::1._origin_has_no_gh-pages:_it_is_started_as_an_orphan_holding_.nojekyll::stage-local's_push_publishes_onto_the_branch_it_started,_instead_of_failing
  Scenario: stage-local publishes onto the branch it started
    Given a clone of a bare origin with no gh-pages, on a feature branch, with a stand-in publisher composing a preview
    When stage-local runs
    Then it pushes, the log says "orphan"
    And gh-pages holds the new-branch file and the feature preview in two commits

  @test:scripts/tests/stage-local-robust.test.ts::2._a_mount_an_earlier_attempt_left_modified::is_named,_with_the_exact_command_that_re-lays_it
  Scenario: An edited mount is named with the command that re-lays it
    Given a checkout whose mounted core has an extra file a build wrote
    Then the edited mounts are core
    And the advice names "core (core/)", the cd-and-remote-mount --fresh command, and --fresh for stage-local.ts

  @test:scripts/tests/stage-local-robust.test.ts::2._a_mount_an_earlier_attempt_left_modified::a_plan_prints_the_advice;_without_--fresh_nothing_is_re-laid
  Scenario: A plan prints the advice and nothing is re-laid without --fresh
    Then a plan with --fresh re-lays nothing and logs "--fresh"
    And a run without --fresh re-lays nothing
    And the re-lay callback is never called

  @test:scripts/tests/stage-local-robust.test.ts::2._a_mount_an_earlier_attempt_left_modified::--fresh_re-lays_it,_and_the_mount_matches_the_lock_again
  Scenario: --fresh re-lays the mount
    When edited mounts are re-laid with --fresh
    Then core is re-laid and the log says "re-laying 1 mount(s)"
    And the build-written file is gone, no mount is edited, and core is not "missing"

  @test:scripts/tests/stage-local-robust.test.ts::2._a_mount_an_earlier_attempt_left_modified::the_build_refuses_before_its_mount_step,_saying_how_to_re-lay
  Scenario: The build refuses an edited mount
    When the instance site is built with mounting on and no --fresh
    Then it rejects naming "remote-mount.ts --fresh"

  @test:scripts/tests/stage-local-robust.test.ts::3._render:bpmn's_beside-source_drawings_go_out_of_the_checkout_during_a_build::beside_the_source_by_default;_under_the_build's_directory,_at_the_repository-relative_path,_when_set
  Scenario: Beside-source drawings go under the build directory when set
    Then a BPMN's drawing is beside it by default
    And under an output directory it is at the repository-relative path
    And a source outside the repository goes under _outside/

  @test:scripts/tests/stage-local-robust.test.ts::3._render:bpmn's_beside-source_drawings_go_out_of_the_checkout_during_a_build::the_build_hands_every_step_a_directory_outside_the_checkout_for_them
  Scenario: The build gives steps a drawing directory outside the checkout
    Given an IG whose render:bpmn step records the drawing directory it is told and fails
    When the instance site is built
    Then it rejects with "pre: render:bpmn failed"
    And the recorded directory is beside-source-drawings under the build output, outside the checkout
