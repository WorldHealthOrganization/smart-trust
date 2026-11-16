Feature: The IG metadata index: export states, code system uses, dependency reach and its graph typology

  @test:schemas/ig-metadata-index.test.ts::a_determined_empty_is_never_a_not-found::baselineHarvestParses
  Scenario: the baseline harvest parses
    Given the baseline harvest
    Then the schema accepts it

  @test:schemas/ig-metadata-index.test.ts::a_determined_empty_is_never_a_not-found::presentWithNoRecordsAccepted
  Scenario: `present` with NO records is accepted — an IG may publish an empty export
    Given an index whose value set export is present with no records
    Then the schema accepts it

  @test:schemas/ig-metadata-index.test.ts::a_determined_empty_is_never_a_not-found::refusesRecordsUnderAbsentExport
  Scenario: records under an `absent` export are REFUSED
    Given an index with value set records under an export marked "absent"
    Then the schema refuses it

  @test:schemas/ig-metadata-index.test.ts::a_determined_empty_is_never_a_not-found::refusesRecordsUnderUnknownExport
  Scenario: records under an `unknown` export are REFUSED too
    Given an index with value set records under an export marked "unknown"
    Then the schema refuses it

  @test:schemas/ig-metadata-index.test.ts::a_determined_empty_is_never_a_not-found::unknownAndAbsentDiffer
  Scenario: `unknown` and `absent` are different states, not two spellings of one
    Given two indexes with no value set records, one whose export is "unknown" and one whose export is "absent"
    Then the verdict of the first is "unknown"
    And the verdict of the second is "finding"

  @test:schemas/ig-metadata-index.test.ts::`uses`_—_the_field_bean_`nsbb`_measured_as_declared_and_never_populated::declaredEmptyRepresentable
  Scenario: declared-empty is representable, and is the measured case
    Given a code system ref whose uses state is "declared-empty" with no uses
    Then the schema accepts it

  @test:schemas/ig-metadata-index.test.ts::`uses`_—_the_field_bean_`nsbb`_measured_as_declared_and_never_populated::notExportedIsThirdState
  Scenario: not-exported is a THIRD state, distinct from declared-empty
    Given a code system ref whose uses state is "not-exported" with no uses
    Then the schema accepts it

  @test:schemas/ig-metadata-index.test.ts::`uses`_—_the_field_bean_`nsbb`_measured_as_declared_and_never_populated::refusesPopulatedEmpty
  Scenario: `populated` with an empty list is REFUSED — it would erase the finding
    Given a code system ref whose uses state is "populated" with no uses
    Then the schema refuses it

  @test:schemas/ig-metadata-index.test.ts::`uses`_—_the_field_bean_`nsbb`_measured_as_declared_and_never_populated::refusesDeclaredEmptyWithEntries
  Scenario: `declared-empty` with entries is REFUSED — the record would lie about itself
    Given a code system ref whose uses state is "declared-empty" with one use
    Then the schema refuses it

  @test:schemas/ig-metadata-index.test.ts::`uses`_—_the_field_bean_`nsbb`_measured_as_declared_and_never_populated::refusesNotExportedWithEntries
  Scenario: `not-exported` with entries is REFUSED for the same reason
    Given a code system ref whose uses state is "not-exported" with one use
    Then the schema refuses it

  @test:schemas/ig-metadata-index.test.ts::the_measured_reach_ceiling_is_an_API,_not_a_paragraph::unreachedTypesOutOfReach
  Scenario: the decision-logic core is out of reach
    Then every unreached resource type has the dependency reach "out-of-reach"

  @test:schemas/ig-metadata-index.test.ts::the_measured_reach_ceiling_is_an_API,_not_a_paragraph::terminologyInReach
  Scenario: terminology is in reach
    Then ValueSet and CodeSystem have the dependency reach "exported"

  @test:schemas/ig-metadata-index.test.ts::the_measured_reach_ceiling_is_an_API,_not_a_paragraph::planDefinitionNotExported
  Scenario: an empty edge list over an out-of-reach type is uninformative rather than clean
    Then PlanDefinition's dependency reach is not "exported"

  @test:schemas/ig-metadata-index.test.ts::the_file_declares_what_it_is::refusesMissingSchemaTag
  Scenario: a document with no `$schema` tag is REFUSED
    Given the baseline index without its "$schema"
    Then the schema refuses it

  @test:schemas/ig-metadata-index.test.ts::the_file_declares_what_it_is::refusesUnknownTopLevelKey
  Scenario: an unknown top-level key is REFUSED — the shape is strict
    Given the baseline index with an extra top-level key "metadataExports"
    Then the schema refuses it

  @test:schemas/ig-metadata-index.test.ts::the_file_declares_what_it_is::refusesUndecidedExport
  Scenario: an export that has not decided its presence is REFUSED
    Given an index whose exports name only two of the three exports
    Then the schema refuses it

  @test:schemas/ig-metadata-index.test.ts::the_file_declares_what_it_is::refusesMissingVersion
  Scenario: a version is required — an id alone collides across publications
    Given an index whose IG has a package id and no version
    Then the schema refuses it

  @test:schemas/ig-metadata-index.test.ts::the_file_declares_what_it_is::namesThreeExports
  Scenario: all three exports are named
    Then the list of exports has 3 entries

  @test:schemas/ig-metadata-index.test.ts::the_graph_typology_it_is_held_under::typologyRegisteredDerived
  Scenario: registered, not renderable, and `derived`
    Then the graph typology "ig-metadata-index" is registered
    And it is not renderable
    And its graph layer is "derived" and it is a derived graph

  @test:schemas/ig-metadata-index.test.ts::the_graph_typology_it_is_held_under::processMayNotWrite
  Scenario: a process may NOT write it as live state — it is regenerated, not updated
    Then a process may not write "ig-metadata-index"

  @test:schemas/ig-metadata-index.test.ts::the_graph_typology_it_is_held_under::differsFromArtifactIndex
  Scenario: it is a DIFFERENT kind from `fhir-artifact-index`, on purpose
    When the typology IRIs of "fhir-artifact-index" and "ig-metadata-index" are taken
    Then they are two different IRIs
