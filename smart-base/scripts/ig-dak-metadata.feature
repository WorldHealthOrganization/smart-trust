Feature: readIgDakMetadata reads an IG's DAK metadata
  The DAK metadata of an IG repository comes from contentTypes.dak in its
  index.config.json, falling back to a legacy dak.json.

  @test:smart-base/scripts/ig-dak-metadata.test.ts::readIgDakMetadata::readsIndexConfigSection
  Scenario: reads the index section
    Given a directory whose index.config.json has contentTypes.dak with canonicalUrl "u"
    When its DAK metadata is read
    Then the data is that section and it is from "index.config.json#contentTypes.dak"

  @test:smart-base/scripts/ig-dak-metadata.test.ts::readIgDakMetadata::sectionWinsOverLegacyDakJson
  Scenario: the section wins over a legacy dak.json
    Given a directory whose index.config.json section has id "new" and whose dak.json has id "old"
    When its DAK metadata is read
    Then the id is "new"

  @test:smart-base/scripts/ig-dak-metadata.test.ts::readIgDakMetadata::fallsBackToDakJson
  Scenario: falls back to dak.json for an IG not yet migrated
    Given a directory whose index.config.json has no contentTypes.dak and whose dak.json has id "old"
    When its DAK metadata is read
    Then the data is the dak.json content and it is from "dak.json"

  @test:smart-base/scripts/ig-dak-metadata.test.ts::readIgDakMetadata::neitherMeansNotADak
  Scenario: neither: not a DAK
    Given an empty directory
    When its DAK metadata is read
    Then there is none

  @test:smart-base/scripts/ig-dak-metadata.test.ts::readIgDakMetadata::nonObjectSectionThrows
  Scenario: a non-object section throws
    Given a directory whose index.config.json has contentTypes.dak set to an array
    When its DAK metadata is read
    Then it throws "must be an object"
