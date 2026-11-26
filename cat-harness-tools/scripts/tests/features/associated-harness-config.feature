# A declaration's associatedHarnesses (schemas/kg/cat-harness.ts) references harnesses that are never
# loaded; scripts/harness-panel.ts shows them on the harness panel. Each Scenario names the test that executes it.
Feature: Associated harnesses

  @test:scripts/tests/associated-harness-config.test.ts::associatedHarnesses:_the_schema::absent_is_legal,_and_stays_absent_(not_defaulted_to_[])
  Scenario: An absent associatedHarnesses parses and stays absent
    Given a declaration with no associatedHarnesses
    When it is parsed
    Then it parses
    And its associatedHarnesses is undefined rather than an empty list

  @test:scripts/tests/associated-harness-config.test.ts::associatedHarnesses:_the_schema::a_well-formed_entry_parses
  Scenario: A well-formed association parses
    Given a declaration associating the "ihris" harness with its title, url, repository and relation
    When it is parsed
    Then there are no failures

  @test:scripts/tests/associated-harness-config.test.ts::associatedHarnesses:_the_schema::an_unknown_key_is_refused_(strict):_a_misspelt_`repo`_must_not_vanish
  Scenario: An unknown key on an association is refused
    Given an association carrying a misspelt "repo" key
    When the declaration is parsed
    Then the only failure is at "associatedHarnesses.0"

  @test:scripts/tests/associated-harness-config.test.ts::associatedHarnesses:_the_schema::`url`_is_required
  Scenario: An association without a url is refused
    Given an association with no url
    When the declaration is parsed
    Then the only failure is at "associatedHarnesses.0.url"

  @test:scripts/tests/associated-harness-config.test.ts::associatedHarnesses:_the_schema::a_name_that_is_not_an_instance_name_is_refused
  Scenario: A name that is not an instance name is refused
    Given an association named "iHRIS KB"
    When the declaration is parsed
    Then the only failure is at "associatedHarnesses.0.name"

  @test:scripts/tests/associated-harness-config.test.ts::associatedHarnesses:_the_schema::the_same_name_twice_is_refused
  Scenario: The same association twice is refused
    Given the "ihris" association listed twice
    When the declaration is parsed
    Then the only failure is at "associatedHarnesses"

  @test:scripts/tests/associated-harness-config.test.ts::associatedHarnesses:_the_schema::a_name_also_in_`needs`_is_refused:_associated_is_not_loaded
  Scenario: An association also listed in needs is refused
    Given a declaration that needs "ihris" and also associates it
    When the declaration is parsed
    Then the only failure is at "associatedHarnesses.0.name"

  @test:scripts/tests/associated-harness-config.test.ts::associatedHarnesses:_the_panel::a_local_name_is_a_finding_and_is_not_listed_as_associated
  Scenario: Associating a harness in this checkout is a finding and is not listed
    Given harness "a" associating "b", and "b" a harness in the same checkout
    When the harness panel is built
    Then no harness is listed as associated
    And a finding says "`b`, which is a harness in this checkout"

  @test:scripts/tests/associated-harness-config.test.ts::associatedHarnesses:_the_panel::✎_on_an_associated_harness_is_ITS_repository,_never_this_checkout's
  Scenario: The edit link of an associated harness is its own repository
    Given harness "a" associating "ihris" in a checkout whose repository is "https://github.com/x/here"
    When the harness panel is built
    Then the associated harness's edit link is "https://github.com/litlfred/ihris"
    And harness "a"'s edit link is "https://github.com/x/here/edit/main/a"

  @test:scripts/tests/associated-harness-config.test.ts::associatedHarnesses:_the_panel::an_association_with_no_repository_has_no_✎_at_all
  Scenario: An association with no repository has no edit link
    Given an "ihris" association with no repository
    When the harness panel is built
    Then the associated harness has no edit link

  @test:scripts/tests/associated-harness-config.test.ts::associatedHarnesses:_the_panel::every_property_row_is_there,_gaps_included
  Scenario: Every property row is listed, gaps included
    When the harness panel is built over no harnesses
    Then its property rows include "associatedHarnesses"
    And every row with no skills names a gap

  @test:scripts/tests/associated-harness-config.test.ts::associatedHarnesses:_the_panel::summaries_stay_one_line
  Scenario: Summaries stay one line
    Then a list of "a" and "b" summarises as "a, b"
    And a list of objects with ids "x" and "y" summarises as "2: x, y"
    And a 200-character string summarises to at most 90 characters

  @test:scripts/tests/associated-harness-config.test.ts::associatedHarnesses:_this_tree::no_declaration_associates_a_harness_that_is_in_this_checkout
  Scenario: No declaration in this tree associates a harness in this checkout
    Given every declaration in this tree
    When the harness panel is built
    Then no finding says a harness "is a harness in this checkout"

  @test:scripts/tests/associated-harness-config.test.ts::associatedHarnesses:_this_tree::cat-harness_relates_ihris_exactly_once:_associated_(#1146)_or_subscribed_(#1719)
  Scenario: cat-harness relates ihris exactly once, as associated or subscribed
    Given the cat-harness declaration in this tree
    When its "ihris" associations and "ihris" subscriptions are counted
    Then together they number exactly one
