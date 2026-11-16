# A simulator block's html: target is checked, and present, absent and
# undetermined are kept apart. Each Scenario names the test that executes it.
Feature: Simulator HTML assets

  @test:scripts/tests/simulator-assets.test.ts::the_three_states,_and_the_third_is_the_point::present_—_resolved_and_on_disk
  Scenario: A target on disk is present
    Given a repository holding simulators/ok.html
    Then that target is "present"

  @test:scripts/tests/simulator-assets.test.ts::the_three_states,_and_the_third_is_the_point::absent_—_resolved_and_not_there
  Scenario: A missing target is absent
    Then simulators/gone.html in an empty repository is "absent"

  @test:scripts/tests/simulator-assets.test.ts::the_three_states,_and_the_third_is_the_point::undetermined_—_a_remote_target_is_NOT_fetched,_so_NOT_verified
  Scenario: A remote target is undetermined
    Then an https target is "undetermined" with a detail saying "UNKNOWN"

  @test:scripts/tests/simulator-assets.test.ts::the_three_states,_and_the_third_is_the_point::undetermined_—_a_path_escaping_the_repository
  Scenario: A path escaping the repository is undetermined
    Then "../outside.html" is "undetermined"

  @test:scripts/tests/simulator-assets.test.ts::the_three_states,_and_the_third_is_the_point::a_missing_`html:`_field_is_an_absence,_not_a_pass
  Scenario: A missing or blank html field is absent
    Then an undefined target and a blank target are both "absent"

  @test:scripts/tests/simulator-assets.test.ts::todo-html_is_a_claim,_and_a_claim_is_still_an_absence::an_untagged_dangling_target_is_an_ERROR
  Scenario: An untagged dangling target is an error
    When a simulator block naming a missing file is validated
    Then its issue is an error and one target is dangling

  @test:scripts/tests/simulator-assets.test.ts::todo-html_is_a_claim,_and_a_claim_is_still_an_absence::a_tagged_one_is_a_WARNING,_and_is_COUNTED_rather_than_dropped
  Scenario: A deferred-tagged dangling target is a counted warning
    When a simulator block tagged deferred naming a missing file is validated
    Then its issue is a warning, one is deferred and none is dangling

  @test:scripts/tests/simulator-assets.test.ts::todo-html_is_a_claim,_and_a_claim_is_still_an_absence::losing_the_tag_while_keeping_the_dead_path_escalates_to_error
  Scenario: Without the deferred tag a dead path is an error
    Then a block tagged only "other" is not deferred
    And validating it with a missing file gives an error

  @test:scripts/tests/simulator-assets.test.ts::todo-html_is_a_claim,_and_a_claim_is_still_an_absence::a_present_target_produces_no_issue_at_all
  Scenario: A present target produces no issue
    When a simulator block naming an existing file is validated
    Then there are no issues and one target is present

  @test:scripts/tests/simulator-assets.test.ts::todo-html_is_a_claim,_and_a_claim_is_still_an_absence::non-simulator_blocks_are_untouched
  Scenario: Non-simulator blocks are ignored
    When a prose block is validated
    Then there are no issues
