Feature: The terminology index built from an IG's caches and expansions

  @test:scripts/terminology-index.test.ts::the_Publisher's_txcache::txcacheCodesAndValueSets
  Scenario: validations give codes; errors and unparseable entries are skipped; expansions give value sets
    Given a Publisher txcache with a validation, an error, an expansion and an unparseable entry
    When it is parsed
    Then the one validated code and the one expanded value set are read

  @test:scripts/terminology-index.test.ts::buildIndex::buildIndexCodesAndValueSets
  Scenario: codes from both sources, once each; value sets by url and url|version
    When the index is built from the txcache and the expansions
    Then codes from both sources are each listed once, without the group code
    And a value set is keyed by url with version and by url alone, listing its codes in order
    And the yes-no value set has 2 codes and the sources count 2 value sets and 1 txcache file

  @test:scripts/terminology-index.test.ts::buildIndex::noCacheEmptyIndex
  Scenario: no cache at all: an empty index, not an error
    Then building from a missing cache gives no codes

  @test:scripts/terminology-index.test.ts::writeIndex::smallIndexPlainJson
  Scenario: small: plain JSON, with no machine path in it
    When a small index is written
    Then it is "index.json", naming its expansions source and holding no machine path

  @test:scripts/terminology-index.test.ts::writeIndex::largeIndexGzipped
  Scenario: large: gzipped
    When an index larger than the gzip threshold is written
    Then it is "index.json.gz" and decompresses to all its codes

  @test:scripts/terminology-index.test.ts::fullUcumList
  Scenario: the full UCUM list from the vendored definitions
    Given the vendored UCUM definitions
    Then they give more than 700 rows, with "g" as "gram" and "mm[Hg]" present

  @test:scripts/terminology-index.test.ts::preExpand:_the_rendered_copy_only::preExpandRenderedCopy
  Scenario: held value sets become answerOption; others are listed; the source is unchanged
    Given a Questionnaire with items bound to held value sets, one bound to an absent value set and one with its own answer options
    When it is pre-expanded
    Then the held items are expanded and the absent one is listed as missing
    And the first item carries its answer options and no longer names the value set
    And the item with its own answer options keeps them
    And the source Questionnaire is unchanged
