Feature: the fixity of materialized copies

  @test:scripts/materialized-fixity.test.ts::the_corpus_verifies::corpusHasArtefacts
  Scenario: finds materialized artefacts at all
    When the corpus is checked
    Then there are verdicts

  @test:scripts/materialized-fixity.test.ts::the_corpus_verifies::nothingEditedInPlace
  Scenario: nothing has been edited in place
    When the verdicts are read
    Then none is a mismatch

  @test:scripts/materialized-fixity.test.ts::the_corpus_verifies::verdictOneOfFive
  Scenario: every verdict is exactly one of the five kinds
    When each verdict is read
    Then it is verified, mismatch, absent, unverifiable or covered-by-parts

  @test:scripts/materialized-fixity.test.ts::the_corpus_verifies::unverifiableNeverVerified
  Scenario: an unverifiable artefact is never counted as verified
    When each verified verdict is read
    Then it has a digest

  @test:scripts/materialized-fixity.test.ts::verify()_keeps_the_four_facts_apart::matchingBytesVerified
  Scenario: bytes that match their digest are verified
    When bytes matching their digest are verified
    Then the verdict is verified

  @test:scripts/materialized-fixity.test.ts::verify()_keeps_the_four_facts_apart::nonMatchingIsMismatch
  Scenario: bytes that do NOT match are a mismatch, not an error about fixity
    When bytes not matching their digest are verified
    Then the verdict is mismatch with the actual digest

  @test:scripts/materialized-fixity.test.ts::verify()_keeps_the_four_facts_apart::absentBytesAbsent
  Scenario: ABSENT BYTES ARE ABSENT, even when no digest was recorded
    When a missing file with no digest is verified
    Then the verdict is absent

  @test:scripts/materialized-fixity.test.ts::verify()_keeps_the_four_facts_apart::noDigestUnverifiable
  Scenario: a file with no digest is unverifiable, not verified
    When a file with no digest is verified
    Then the verdict is unverifiable

  @test:scripts/materialized-fixity.test.ts::verify()_keeps_the_four_facts_apart::unsupportedAlgorithmUnverifiable
  Scenario: an unsupported algorithm is unverifiable rather than a pass
    When a file with an md5 digest is verified
    Then the verdict is unverifiable

  @test:scripts/materialized-fixity.test.ts::verify()_keeps_the_four_facts_apart::directoryCoveredByParts
  Scenario: a directory is covered by its node's verified parts, not called a gap
    When a directory whose node has a verified part is verified
    Then the verdict is covered-by-parts

  @test:scripts/materialized-fixity.test.ts::verify()_keeps_the_four_facts_apart::directoryWithoutPartsUnverifiable
  Scenario: a directory whose node declares no verified part is unverifiable
    When a directory whose node has no verified part is verified
    Then the verdict is unverifiable

  @test:scripts/materialized-fixity.test.ts::materializationsIn_walks_rather_than_reading_a_fixed_shape::findsNestedRecord
  Scenario: finds a record nested at any depth
    When a document with a record nested deep is walked
    Then the one record is found with its id

  @test:scripts/materialized-fixity.test.ts::materializationsIn_walks_rather_than_reading_a_fixed_shape::ignoresNonMaterialized
  Scenario: ignores states that are not materialized
    When a referenced record is walked
    Then nothing is found

  @test:scripts/materialized-fixity.test.ts::materializationsIn_walks_rather_than_reading_a_fixed_shape::findsNodeAndChildren
  Scenario: finds BOTH a node's own record and its children's
    When a node with its own record and a bitstream's is walked
    Then both are found

  @test:scripts/materialized-fixity.test.ts::the_backfill_records_a_baseline,_and_says_so::backfillOnlyUndigested
  Scenario: only offers to fill FILES that have no digest
    When the backfillable records are listed
    Then each has no digest and has a localPath

  @test:scripts/materialized-fixity.test.ts::the_backfill_records_a_baseline,_and_says_so::backfillWritesDatedDigest
  Scenario: writes a digest, and dates it with the field the schema already has
    When the backfill is applied to a record
    Then one digest is written with sha256 and a valid verifiedAt

  @test:scripts/materialized-fixity.test.ts::the_backfill_records_a_baseline,_and_says_so::backfillSchemaValid
  Scenario: writes NOTHING the schema does not permit
    When the backfill is applied
    Then the fixity it writes validates

  @test:scripts/materialized-fixity.test.ts::the_backfill_records_a_baseline,_and_says_so::backfillNeverOverwrites
  Scenario: never overwrites a digest that is already there
    When the backfill is applied to a record that has a digest
    Then nothing is written and the digest is kept

  @test:scripts/materialized-fixity.test.ts::a_mounted_instance's_bytes_outside_its_declared_directories::mountedOutsideUnverifiable
  Scenario: are unverifiable here, with the reason, not absent
    When bytes of a mounted layer outside its directories are verified
    Then they are unverifiable, saying the checkout does not mount them

  @test:scripts/materialized-fixity.test.ts::a_mounted_instance's_bytes_outside_its_declared_directories::notMountAbsent
  Scenario: are still absent when the layer is not a mount
    When the same bytes of a layer that is not a mount are verified
    Then they are absent

  @test:scripts/materialized-fixity.test.ts::a_mounted_instance's_bytes_outside_its_declared_directories::collectMarksOnlyMountedOutside
  Scenario: collect() marks them only for a mounted layer, and only outside its directories
    Given a layer with records inside and outside its declared directories
    When the records are collected before and after it is listed as a mount
    Then standalone, none is marked outside the mount
    And mounted, only the one outside its directories is marked, and the inside one is absent
