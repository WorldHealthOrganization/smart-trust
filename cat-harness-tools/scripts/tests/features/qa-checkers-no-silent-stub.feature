# No QA checker is a silent n/a stub (folio-assistant-89wq, as a class): read
# from the checker modules' source. Each Scenario names the test that
# executes it.
Feature: No QA checker is a silent n/a stub

  @test:scripts/tests/qa-checkers-no-silent-stub.test.ts::no_checker_is_a_silent_n/a_stub_(folio-assistant-89wq,_as_a_class)::the_checker_modules_are_found_and_parsed
  Scenario: The checker modules are found and parsed
    Given the pipeline's qa-checkers*.ts modules
    Then there is at least one
    And their exported checkers include checkDetanglerNoXChapterFwd, checkDetanglerArchimedeanWall and checkVoiceTitleScholarly

  @test:scripts/tests/qa-checkers-no-silent-stub.test.ts::no_checker_is_a_silent_n/a_stub_(folio-assistant-89wq,_as_a_class)::the_stub_detector_fires_on_a_stub_and_not_on_a_decline_that_looked
  Scenario: The stub detector tells a stub from a decline that looked
    Then a body that is one return of n/a is a stub
    And a body with a guarded n/a return and a pass return is not

  @test:scripts/tests/qa-checkers-no-silent-stub.test.ts::no_checker_is_a_silent_n/a_stub_(folio-assistant-89wq,_as_a_class)::every_stub_carries_the_not-implemented_sentinel
  Scenario: Every stub carries the not-implemented sentinel
    When every exported checker in the modules is read
    Then no stub lacks notes beginning "not implemented: "
