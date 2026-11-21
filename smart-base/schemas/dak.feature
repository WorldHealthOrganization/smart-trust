Feature: The DAK declaration placeholder
  What the DAK declaration in an index's contentTypes.dak promises, and what
  it refuses to invent while WHO's logical model is being finalised.

  @test:smart-base/schemas/dak.test.ts::the_marker::markerIsDakSectionOfIndex
  Scenario: is the `dak` section of the root index.config.json
    Then the DAK index file is "index.config.json" and its section is "dak"

  @test:smart-base/schemas/dak.test.ts::the_marker::projectsToWhoLogicalModel
  Scenario: projects to WHO's own logical model, not a folio-local type
    Then the DAK type is "http://smart.who.int/base/StructureDefinition/DAK"

  @test:smart-base/schemas/dak.test.ts::the_marker::absentIsNotAnError
  Scenario: absent is not an error: no index, or an index without the section
    Then a repository with no index.config.json has no DAK declaration
    And a repository whose index has no dak section has none

  @test:smart-base/schemas/dak.test.ts::the_marker::readsSectionAsDeclaration
  Scenario: the section is read as the declaration
    Given an index whose dak section names "smart-immunizations"
    Then the declaration read has name "smart-immunizations"

  @test:smart-base/schemas/dak.test.ts::the_marker::unreadableOrMalformedThrows
  Scenario: an unreadable index or a malformed section throws, rather than reading as absent
    Then reading an index that is not JSON throws "not valid JSON"
    And reading a dak section with no name throws "not a valid DAK declaration"

  @test:smart-base/schemas/dak.test.ts::the_marker::dakJsonNotRead
  Scenario: a dak.json beside it is not read: one spelling, so 'migrated' stays visible
    Given a repository with only a dak.json
    Then it has no DAK declaration

  @test:smart-base/schemas/dak.test.ts::what_it_refuses_to_invent::inlineInstanceCarriedUntouched
  Scenario: an inline INSTANCE is carried through untouched
    Given a declaration with a health intervention holding an arbitrary inline instance
    When it is parsed
    Then the health interventions are unchanged

  @test:smart-base/schemas/dak.test.ts::what_it_refuses_to_invent::entryIsExactlyOneSourceWrapper
  Scenario: a formalized component's entry is WHO's source wrapper: exactly one of three
    Then a persona entry with only url, only canonical, or only instance is accepted
    And an empty entry, one with both url and canonical, or one with none of the three is refused

  @test:smart-base/schemas/dak.test.ts::what_it_refuses_to_invent::wrapperKeepsUnknownKeys
  Scenario: a wrapper keeps keys it does not know
    Given an indicator entry with url "u" and note "kept"
    When the declaration is parsed
    Then the indicator entry is unchanged

  @test:smart-base/schemas/dak.test.ts::what_it_refuses_to_invent::unformalizedComponentTakesAnything
  Scenario: the unformalized component takes anything, having no wrapper to follow
    Then for every unformalized component, an entry of any shape is accepted

  @test:smart-base/schemas/dak.test.ts::what_it_refuses_to_invent::cardinalityEnforced
  Scenario: but the CARDINALITY is enforced, because 0..* is settled
    Then personas given as a string are refused
    And personas given as an empty list are accepted

  @test:smart-base/schemas/dak.test.ts::what_it_refuses_to_invent::unknownKeysSurviveRoundTrip
  Scenario: unknown keys survive a round trip — a placeholder must not destroy data
    Given a declaration with unknown keys somethingWHOAdded and anotherThing
    When it is parsed
    Then both keys keep their values

  @test:smart-base/schemas/dak.test.ts::the_component_fields_come_from_the_vocabulary,_not_from_this_module::everyComponentAcceptedByName
  Scenario: every declared component is accepted by name
    Given a declaration with an empty list for every DAK component's field
    Then it is accepted

  @test:smart-base/schemas/dak.test.ts::the_component_fields_come_from_the_vocabulary,_not_from_this_module::componentEntriesByComponentName
  Scenario: componentEntries never needs a caller to hardcode a field name
    Given a declaration with two persona entries
    Then the entries of component "generic-personas" are those two
    And the entries of "test-scenarios" are none

  @test:smart-base/schemas/dak.test.ts::coverage_distinguishes_three_states,_not_two::absentEmptyPopulatedDistinct
  Scenario: absent, declared-and-empty, and populated are different facts
    Given declarations with no personas, an empty personas list, and one persona entry
    Then only the last has "generic-personas" populated
    And personas is absent from the first and present in the second

  @test:smart-base/schemas/dak.test.ts::labels::dakCarriesTitleAndDescription
  Scenario: a DAK carries the same title/description as every other KG node
    Given a declaration with title "Immunizations" and a description
    When it is parsed
    Then its title is "Immunizations" and its description contains "immunization"
