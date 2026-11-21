Feature: l1-extraction is declared KG content
  Every l1-extractions/<entry>/ directory is declared in smart-base.json with
  the l1-extraction typology, and every such declaration names a directory
  that is there.

  @test:smart-base/scripts/l1-extraction-declared.test.ts::l1-extraction_is_declared_KG_content::typologyNodeWithinLibraryDerived
  Scenario: the typology node exists, is a sub-graph of library, and is derived
    Given typologies/l1-extraction.json
    Then it is a folio-graph-typology/v1 node of kind "l1-extraction"
    And it is within "library" and holds "derived"
    And it has no nodeSchemas and a string validatorNotApplicable

  @test:smart-base/scripts/l1-extraction-declared.test.ts::l1-extraction_is_declared_KG_content::atLeastOneExtractionOnDisk
  Scenario: at least one entry holds extraction output (the test is not vacuous)
    Then there is at least one directory under l1-extractions/

  @test:smart-base/scripts/l1-extraction-declared.test.ts::l1-extraction_is_declared_KG_content::everyExtractionOnDiskDeclared
  Scenario: every l1-extractions/<entry>/ on disk is declared with the l1-extraction typology
    Then the paths declared with the l1-extraction typology are exactly the directories under l1-extractions/

  @test:smart-base/scripts/l1-extraction-declared.test.ts::l1-extraction_is_declared_KG_content::noExtractionLeftInLibrary
  Scenario: no extraction is left inside a library entry, where it reads as a second copy of the entry
    Then no library entry has an l1-extraction directory

  @test:smart-base/scripts/l1-extraction-declared.test.ts::l1-extraction_is_declared_KG_content::declarationsInExtractionsDirOnly
  Scenario: each declaration sits in l1-extractions/ and names that typology alone
    Then every declaration with the l1-extraction typology has a path under l1-extractions/
    And its only typology is l1-extraction

  @test:smart-base/scripts/l1-extraction-declared.test.ts::l1-extraction_is_declared_KG_content::declaredL1GraphDocumentExists
  Scenario: the declared L1 graph document is there to publish
    Then every declared extraction directory holds an l1.json whose "@context" is a string
