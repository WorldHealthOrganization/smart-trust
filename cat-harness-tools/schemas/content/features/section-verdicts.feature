# Specifies schemas/content/section-verdicts.ts: specimenSections, which reads
# a directory's section verdicts file (bean fnqn). The checkout-reading tests
# are specified with test/section-verdicts-checkout.test.ts.
Feature: Section verdicts: an absent file is empty, an invalid one throws

  @test:schemas/content/section-verdicts.test.ts::section_verdicts_(bean_fnqn)::an_absent_file_is_an_empty_answer
  Scenario: An absent verdicts file is an empty answer
    Given an empty temporary directory
    When its specimen sections are read
    Then they are the empty set

  @test:schemas/content/section-verdicts.test.ts::section_verdicts_(bean_fnqn)::a_present_file_that_does_not_validate_THROWS_—_never_'nothing_is_a_specimen'
  Scenario: A present verdicts file that does not validate throws
    Given a directory whose verdicts file has one verdict, given only the role "decorative"
    When its specimen sections are read
    Then it throws
