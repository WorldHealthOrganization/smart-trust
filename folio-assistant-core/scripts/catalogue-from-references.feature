Feature: planning catalogue entries from a folio's references

  @test:scripts/catalogue-from-references.test.ts::planCatalogue::joinsOnlyUnambiguousEntries
  Scenario: joins only entries with exactly one ledger row naming a known, titled reference
    When the catalogue is planned
    Then only milnor-1982 and neumann-zagier-1985 are joined
    And every other entry is skipped with its reason

  @test:scripts/catalogue-from-references.test.ts::planCatalogue::writesNodeAndRecord
  Scenario: writes a valid node and Dublin Core record per joined entry
    When the catalogue is planned
    Then a node and a Dublin Core record are created for each joined entry
    And the node carries its own id, library id, record and an unknown copyright gate
    And the record carries the title, author, DOI and provenance

  @test:scripts/catalogue-from-references.test.ts::planCatalogue::rerunWritesNothing
  Scenario: a re-run over its own output writes nothing, even on a later day
    When the plan runs again over its own output on a later day
    Then nothing is written or removed and four files are unchanged

  @test:scripts/catalogue-from-references.test.ts::planCatalogue::changedReferenceUpdates
  Scenario: a changed reference updates the record and its retrievedAt
    When a reference's title changes and the plan runs on a later day
    Then its record is updated with the new retrievedAt

  @test:scripts/catalogue-from-references.test.ts::planCatalogue::neverOverridesForeignNode
  Scenario: never overrides a node it did not write, and removes its own stale ones
    Given a node it did not write and a stale node of its own
    When the catalogue is planned
    Then the foreign one is skipped as already catalogued and not written
    And its own stale node and record are removed
