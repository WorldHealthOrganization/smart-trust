# .github/workflows/layer-layers-move.yml, made self-healing (owner, card 2026-11-18; smart-ra#86, dth-sfp#2):
# the mover runs on every event that starts the full tier, so a claude/cat-layers/ branch pushed after the
# re-pin's first push still moves while layers-ref waits. Each Scenario names the test that executes it.
Feature: The layers-cache mover heals a branch pushed after the re-pin

  @test:test/layer-layers-move.test.ts::layers-move:_self-healing,_minimal_permissions::the_caller_template_runs_it_on_every_event_that_starts_the_full_tier
  Scenario: The caller template subscribes to the full tier's events
    Given the caller template in the workflow's header
    Then its pull_request types include ready_for_review and labeled, and it grants only contents: write

  @test:test/layer-layers-move.test.ts::layers-move:_self-healing,_minimal_permissions::a_`release`_label_moves_the_ref;_another_label_is_a_no-op;_a_fork's_PR_never_runs_it
  Scenario: Only a label that starts the full tier runs the mover
    Given a labeled event
    Then release and ready-to-merge run the mover, another label does not, and a fork's PR never does

  @test:test/layer-layers-move.test.ts::layers-move:_self-healing,_minimal_permissions::every_label_that_starts_the_full_tier_also_starts_the_mover
  Scenario: The mover's labels cover the full tier's
    Given the labels on which layer-pr-checks' prepare-head starts the full tier
    Then each of them starts the mover too

  @test:test/layer-layers-move.test.ts::layers-move:_self-healing,_minimal_permissions::it_asks_for_contents:_write_and_nothing_else,_never_on_pull_request_target
  Scenario: The mover's permissions stay minimal
    Given the reusable workflow
    Then it asks for contents: write only, is called by workflow_call only, and never uses pull_request_target

  @test:test/layer-layers-move.test.ts::layers-move:_self-healing,_minimal_permissions::two_runs_for_one_PR_never_race:_one_concurrency_group_per_PR,_not_cancelled
  Scenario: Two movers for one PR never race
    Given a labeled and a synchronize run of one PR
    Then they share one concurrency group that does not cancel in progress
