Feature: The knowledge-graph layers above L1
  L2, L2-BPMN, L2-DMN and L3, each in its own named subgraph, migrated from
  WHO smart-kg 3f5e477, are registered base first, import only down the
  layering, and validate and survive as RDF.

  @test:smart-base/L1/schemas/test/layers.test.ts::registryHoldsEveryDeclaredLayerBaseFirst
  Scenario: the registry holds every declared layer, base first
    Then the held layer keys are l1, l1-library, l2, l2-bpmn, l2-dmn, l3 in that order
    And their directories are the L1 schemas twice, then the L2, L2-bpmn, L2-dmn and L3 schemas

  @test:smart-base/L1/schemas/test/layers.test.ts::everyLayerImportsOnlyDownTheLayering
  Scenario: every layer imports only layers below it
    Then every import of a held layer comes earlier in the registry order
    And the scope list of l3 is L3, L2-DMN, L2-BPMN, L2, L1

  @test:smart-base/L1/schemas/test/layers.test.ts::everyEdgeNamesClassesAndAPredicateInScope
  Scenario: every edge of a layer above L1 names classes and a predicate in its scope
    Given each of the l2, l2-bpmn, l2-dmn and l3 layers
    Then its ontology JSON parses as an ontology layer
    And every edge's source and target are classes in its scope and its predicate is in scope
    And every value set a class binds is in scope

  @test:smart-base/L1/schemas/test/layers.test.ts::smartKgCountsCarriedOver
  Scenario: the smart-kg class, predicate and edge counts are carried over
    Then L2 has 14 classes, 13 predicates and 47 edges (smart-kg 3.0 plus verifiedBy and three requirement edges)
    And L2-BPMN has 6, 3 and 20
    And L2-DMN has 6, 3 and 10
    And L3 has 14, 3 and 39

  @test:smart-base/L1/schemas/test/layers.test.ts::requirementStatementCarriesTypedSuccessCriteria
  Scenario: a requirement statement carries typed success criteria
    Given the L2 requirement-statement class's successCriteria property
    Then its FHIR type is BackboneElement
    And a criterion verified by "test" is accepted
    And a criterion verified by "vibes" is refused

  @test:smart-base/L1/schemas/test/layers.test.ts::l2GraphValidates
  Scenario: an L2 graph validates, and an edge the layer does not license is refused
    Given an L2 document with a data element, a requirement statement and a test scenario joined by verifiedBy
    Then it has no validation errors
    When the verifiedBy edge is reversed to run from the test scenario to the requirement statement
    Then it has validation errors

  @test:smart-base/L1/schemas/test/layers.test.ts::l2GraphSurvivesAsRdf
  Scenario: an L2 graph survives as RDF
    When the L2 document is converted to N-Quads with the offline loader
    Then the data element is typed as kg data-element
    And its "type" property is the literal kg type "Coding", not the node's class
    And its source is a Dublin Core source and its canonical an IRI
    And a statement's predicate is kg verifiedBy
    And successCriteria appears as a kg property

  @test:smart-base/L1/schemas/test/layers.test.ts::everyLayerAboveL1HasAContextThatLoads
  Scenario: every layer above L1 has a context that loads
    Given an empty document under each of the l2, l2-bpmn, l2-dmn and l3 contexts
    Then converting it to RDF with the offline loader does not reject
