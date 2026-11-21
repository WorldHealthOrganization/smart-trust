Feature: the content change review process

  @test:scripts/tests/content-change-review.test.ts::content-change-review:_sliced_review_and_the_coverage_gate::coordinatorIngestsAndSlices
  Scenario: ingest and slicing are the coordinator's; the slices are reviewed in review-task
    When the review process is loaded
    Then ingesting, slicing and the coverage gate are the Review Coordinator's
    And the slices are reviewed through Process_Review and disputes through Process_Adjudication

  @test:scripts/tests/content-change-review.test.ts::content-change-review:_sliced_review_and_the_coverage_gate::unreviewedBlockBackToSlicing
  Scenario: an unreviewed changed block sends the review back to slicing
    When the coverage gate sees two uncovered blocks
    Then the review goes back to slicing

  @test:scripts/tests/content-change-review.test.ts::content-change-review:_sliced_review_and_the_coverage_gate::openDefectBackToSlicing
  Scenario: an open defect does too, whatever the block count says
    When the coverage gate sees an open defect
    Then the review goes back to slicing

  @test:scripts/tests/content-change-review.test.ts::content-change-review:_sliced_review_and_the_coverage_gate::unreviewedPageBackToSlicing
  Scenario: an unreviewed rendered page sends it back too (bean bnjs)
    When the coverage gate sees an unreviewed page
    Then the review goes back to slicing

  @test:scripts/tests/content-change-review.test.ts::content-change-review:_sliced_review_and_the_coverage_gate::gateComputedNotAsserted
  Scenario: the gate is computed: asserting the answer is refused
    When the coverage gate is completed with an asserted answer
    Then it throws

  @test:scripts/tests/content-change-review.test.ts::content-change-review:_sliced_review_and_the_coverage_gate::coveredToSignOff
  Scenario: covered goes on to sign-off, which ends at approval: merging is the next phase
    When the coverage gate sees nothing outstanding and the review is approved
    Then it goes through reviewing uses and impact to approval and ends there
    And the process has no merge step

  @test:scripts/tests/content-change-review.test.ts::content-change-review:_sliced_review_and_the_coverage_gate::publishOpensWithMerge
  Scenario: approve and merge are separate steps: the publish phase opens with the merge
    When the publish phase starts
    Then its first step is the merge

  @test:scripts/tests/content-change-review.test.ts::content-change-review:_sliced_review_and_the_coverage_gate::withdrawalAndDisputeSteps
  Scenario: a withdrawal and a dispute each take their own step before the gate
    When a withdrawal and a dispute are chosen
    Then the withdrawal takes its own step and the dispute goes through adjudication before the gate

  @test:scripts/tests/content-change-review.test.ts::content-change-review:_the_top_level_shows_phases,_not_steps::phasesAreCallActivities
  Scenario: each phase is a call activity to its own process
    When the top level is loaded
    Then making, staging, committee review and publishing are each calls to their own process

  @test:scripts/tests/content-change-review.test.ts::content-change-review:_the_top_level_shows_phases,_not_steps::requestedChangeRestaged
  Scenario: a requested change goes back to the agent, and every revision is staged again
    When the committee requests changes
    Then the work goes back to the agent to iterate and is staged again
