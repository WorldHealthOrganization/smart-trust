Feature: The knowledge graph's JSON-LD contexts
  The generated L1 and l1-library contexts, served offline by the document
  loader, turn an l1-library graph into RDF.

  @test:smart-base/L1/schemas/test/context.test.ts::loaderServesEveryHeldLayersContextOnly
  Scenario: the loader serves every held layer's context and refuses any other URL
    Given the document loader's contexts
    Then they are exactly the l1, l1-library, l2, l2-bpmn, l2-dmn and l3 context URLs
    And loading "https://example.org/other.context.jsonld" is rejected

  @test:smart-base/L1/schemas/test/context.test.ts::propertyNameIsOneTermAcrossClasses
  Scenario: a property name is one term across classes, or the build refuses
    When the extension context is built from the l1-library and L1 layers
    Then it does not throw

  @test:smart-base/L1/schemas/test/context.test.ts::l1LibraryGraphSurvivesAsRdf
  Scenario: an l1-library graph survives as RDF: classes, named properties, Dublin Core, PROV
    Given an l1-library document with a publication, one section and a library node, a specializationOf edge and a contains edge
    When it is converted to N-Quads with the offline loader
    Then the publication and the section are typed as kg publication and publication-section
    And the publication's title is a Dublin Core title, the section has a pageRange "2-4" and the publication a url IRI
    And a statement's predicate is prov:specializationOf
    And an identifier's type is "isbn" under identifiers.type
    And no triple uses the predicate kg properties
