# scripts/journeys/assets/gap-report.js summarises a workshop's gap strip answers into
# a gap report: gaps by urgency then module, counts per moment and per module, and a
# CSV. Each Scenario names the test that executes it.
Feature: The workshop gap report

  @test:scripts/tests/journeys-gap-report.test.ts::summarise:_the_gaps,_by_urgency_then_module::a_gap_is_a_rated_capability_whose_standing_is_not_the_first_option
  Scenario: A gap is a rated capability whose standing is not the first option
    Given six capabilities answered absent, exists, partial, absent, partial and an unknown status
    When the report is summarised
    Then there are 4 gaps

  @test:scripts/tests/journeys-gap-report.test.ts::summarise:_the_gaps,_by_urgency_then_module::urgency_groups_in_the_scale's_order,_not-set_last;_modules_in_the_workshop's_order,_none_last
  Scenario: Gaps group by urgency in the scale's order with not-set last, and by module in workshop order with none last
    Given the same answers
    When the report is summarised
    Then the urgency groups are "Blocks us now", "Needed within 12 months", "Can wait", "Urgency not set"
    And the first group holds only module M1 with capability c
    And the "Can wait" group's first module is titled "Rights"
    And the not-set group's first module is null, titled "No module"
    And the first row carries status label "Partial", urgency label "Blocks us now" and moment J2

  @test:scripts/tests/journeys-gap-report.test.ts::summarise:_the_gaps,_by_urgency_then_module::counts_per_moment_(teaching_order)_and_per_module_(workshop_order),_unrated_counted_apart
  Scenario: Counts are per moment and per module, with unrated counted apart
    Given the same answers
    When the report is summarised
    Then per moment J1 counts exists 1 and absent 1, J2 partial 1 and absent 1, and J3 partial 1 with 1 unrated
    And per module M1 has 3 with 1 unrated, M2 has 2, and no module has 1
    And the totals are 6, with 1 unrated, 1 exists, 2 partial and 2 absent

  @test:scripts/tests/journeys-gap-report.test.ts::summarise:_the_gaps,_by_urgency_then_module::nothing_answered:_no_gaps,_every_capability_unrated
  Scenario: With nothing answered there are no gaps and every capability is unrated
    Given no answers at all
    When the report is summarised
    Then there are 0 gaps and no gap groups
    And all 6 capabilities are unrated

  @test:scripts/tests/journeys-gap-report.test.ts::summarise:_the_gaps,_by_urgency_then_module::a_workshop_with_one_scale_(no_urgency):_every_gap_under_one_group
  Scenario: A workshop with one scale puts every gap under one group
    Given the workshop with no urgency scale
    When the report is summarised
    Then there is one group, "Urgency not set", holding gaps c, d, a and e in that order

  @test:scripts/tests/journeys-gap-report.test.ts::csv:_one_row_per_gap,_quoted_where_needed,_links_made_absolute::header,_order_and_escaping
  Scenario: The CSV has a header, one row per gap, quoting where needed and absolute links
    Given one partial, urgent gap whose capability label contains quotes and a comma
    When the CSV is made against base "https://example.org/site/workshops/w/discuss/"
    Then the header is "Urgency,Module,Moment,Moment title,Capability,Where we stand,Link"
    And the row quotes the label with doubled quotes and links to the absolute walkthrough URL of J2
    And lines are CRLF-separated with a trailing empty line
