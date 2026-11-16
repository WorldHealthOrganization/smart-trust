Feature: The knowledge-graph layers are consistent and their generated files current
  src/l1.ts is the source of truth for L1; the ontology JSON, linked data and
  FSH generated from it are committed and must match what is emitted.

  @test:smart-base/L1/schemas/test/generated.test.ts::migrationRecordsSourceCommit
  Scenario: the migration records the commit it was taken from
    Then the recorded migration commit is a 40-character hex SHA

  @test:smart-base/L1/schemas/test/generated.test.ts::bothLayersInternallyConsistent
  Scenario: both layers are internally consistent
    Then the L1 ontology JSON parses as an ontology layer
    And the l1-library ontology's first import is "l1"

  @test:smart-base/L1/schemas/test/generated.test.ts::packageGeneratedFilesCurrent
  Scenario: every committed generated file of the package is current
    Then no emitted artefact outside input/ is missing or differs from its committed file

  @test:smart-base/L1/schemas/test/generated.test.ts::generatedFshCurrentNoneOrphaned
  Scenario: every committed generated FSH file is current, and none is orphaned
    Given input/fsh/ exists in this checkout (otherwise the test is skipped as not applicable)
    Then no emitted artefact under input/ is missing or differs from its committed file
    And there are no orphaned generated files

  @test:smart-base/L1/schemas/test/generated.test.ts::publicationAndTerminologyCodeReuseParents
  Scenario: reuse is real: publication derives from DublinCore, terminology-code from Coding
    Given the emitted input/fsh/models/KGL1.fsh
    Then KGPublication has parent DublinCore and KGTerminologyCode has parent Coding
    And KGPublication does not restate the inherited title element
    And KGPublication declares identifiers 0..* BackboneElement

  @test:smart-base/L1/schemas/test/generated.test.ts::specialisationEmittedAsLinkedData
  Scenario: the specialisation ruling is emitted as linked data
    Given the committed l1-library.jsonld
    Then kg publication is a subclass of the harness's SourceDocument
    And kg publication-section is a subclass of doco Section
