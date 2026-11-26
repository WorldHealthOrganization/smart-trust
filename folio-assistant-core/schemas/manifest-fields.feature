Feature: manifestFields flattens a block manifest's literal

  @test:schemas/manifest-fields.test.ts::manifestFields::flattensPersonaWithoutIdentity
  Scenario: flattens a persona's literal, leaving out its identity
    Given a persona manifest with label, title, uses and meta
    When its fields are read
    Then title, uses "(none)" and each meta leaf appear as text
    And the label is left out

  @test:schemas/manifest-fields.test.ts::manifestFields::scalarListsAndIndexedEntries
  Scenario: reads a list of scalars as one field and indexes nested entries
    Given a manifest with a list of actors and a list of steps
    When its fields are read
    Then the actors are one field "a, b" and the steps are indexed fields

  @test:schemas/manifest-fields.test.ts::manifestFields::keepsUnreadableAsSource
  Scenario: keeps what it cannot read as source, never drops or guesses it
    Given a manifest with an identifier, a template literal and a call as values
    When its fields are read
    Then each is kept as its source text

  @test:schemas/manifest-fields.test.ts::manifestFields::undefinedWithoutBuilder
  Scenario: is undefined when there is no builder call to read
    When the fields of a module with no builder call are read
    Then the result is undefined
