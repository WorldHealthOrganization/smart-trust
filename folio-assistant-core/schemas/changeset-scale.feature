Feature: a ChangeSet computed over a large edit (xp72)

  @test:schemas/changeset-scale.test.ts::ChangeSet_at_scale_(xp72)::isValidChangeset
  Scenario: is a valid folio-changeset/v1
    When the computed change set is validated
    Then it is a valid folio-changeset/v1

  @test:schemas/changeset-scale.test.ts::ChangeSet_at_scale_(xp72)::matchesHandDerivedCounts
  Scenario: matches the edit script's hand-derived counts
    When its summary is compared with the edit script's counts
    Then the summary equals the expected counts
    And added plus changed plus unchanged equals total minus removed plus added

  @test:schemas/changeset-scale.test.ts::ChangeSet_at_scale_(xp72)::topInsertMovesNothing
  Scenario: inserting at the top of a section moves nothing in it
    When the changed blocks in each section's sec-00 are listed
    Then they are exactly the ten def:NN-00-08 blocks

  @test:schemas/changeset-scale.test.ts::ChangeSet_at_scale_(xp72)::allAtOnceEditCarriesAspects
  Scenario: the all-at-once edit carries every aspect that applies, and only those
    When the change for def:00-08-15-renamed is found
    Then it is changed from def:00-08-15 with aspects renamed, prose and moved

  @test:schemas/changeset-scale.test.ts::ChangeSet_at_scale_(xp72)::equalsGoldenChangeset
  Scenario: equals the committed golden ChangeSet
    When the portable change set is compared with the committed golden file
    Then they are equal
    And without a golden file and without UPDATE_GOLDEN=1 the test throws
