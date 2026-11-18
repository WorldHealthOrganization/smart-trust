# `scripts/check-l1-complete.ts` treats image-descriptions as a QA finding: unmet
# stays unmet in the verdict, but only the other requirements block.
# Each Scenario names the test that executes it.
Feature: QA-only L1 requirements

  @test:scripts/tests/l1-qa-only.test.ts::QA-only_L1_requirements::image-descriptions_is_QA-only,_nothing_else_is
  Scenario: image-descriptions is the only QA-only requirement
    Then the QA-only set is exactly "image-descriptions"

  @test:scripts/tests/l1-qa-only.test.ts::QA-only_L1_requirements::an_unmet_image-descriptions_alone_blocks_nothing
  Scenario: An unmet image-descriptions alone blocks nothing
    Given "structure" is met and "image-descriptions" is unmet
    When the blocking unmet requirements are computed
    Then there are none

  @test:scripts/tests/l1-qa-only.test.ts::QA-only_L1_requirements::any_other_unmet_requirement_still_blocks
  Scenario: Any other unmet requirement still blocks
    Given "image-descriptions" and "sections" are unmet and "blocks" is met
    When the blocking unmet requirements are computed
    Then only "sections" blocks
