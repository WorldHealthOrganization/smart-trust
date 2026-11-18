# Specifies specimenSections (schemas/content/section-verdicts.ts) over
# who-iris's committed section verdicts.
Feature: The committed who-iris section verdicts load and name six WPRO pages

  @test:test/coordinator/section-verdicts-checkout.test.ts::section_verdicts_(bean_fnqn)::the_committed_who-iris_verdicts_load,_and_name_six_WPRO_pages
  Scenario: The verdicts name pages 14, 15 and 28 to 31, and not 20 to 22
    Given who-iris's library
    When its specimen sections are read
    Then there are exactly 6
    And they include wpr-rdo-2020-003-eng pages 014, 015, 028, 029, 030 and 031
    And they do not include pages 020, 021 or 022
