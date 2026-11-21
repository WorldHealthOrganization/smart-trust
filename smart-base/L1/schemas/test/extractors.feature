Feature: The knowledge-graph extractors
  Each extractor ported from WHO smart-kg runs on smart-base's own real
  inputs (or, where there is none of its kind, a fixture built in the test),
  and its output passes the validator with the node classes it should emit.

  @test:smart-base/L1/schemas/test/extractors.test.ts::extractCitations:_the_BCG_table's_L1_references,_with_the_README's_coverage
  Scenario: extractCitations reads the BCG table's L1 references with the README's coverage
    Given the real input/dmn/DAK.DT.IMMZ.D2.DT.BCG.dmn
    When its citations are extracted
    Then the stats are 25 rules, 1 citation and 1 cited rule
    And the node classes are exactly citation and external-artifact
    And the document has no validation errors

  @test:smart-base/L1/schemas/test/extractors.test.ts::extractDmn:_the_BCG_table's_interior_as_the_L2-DMN_subgraph
  Scenario: extractDmn reads the BCG table's interior as the L2-DMN subgraph
    When the BCG table is extracted as DMN
    Then it has dmn-definitions, dmn-decision, dmn-decision-table, dmn-input-clause, dmn-output-clause, dmn-rule and data-element nodes
    And it has 25 dmn-rule nodes
    And it has no validation errors with the extracted citations as external nodes

  @test:smart-base/L1/schemas/test/extractors.test.ts::extractBpmn:_a_real_BPMN's_interior_as_the_L2-BPMN_subgraph
  Scenario: extractBpmn reads a real BPMN's interior as the L2-BPMN subgraph
    Given the real smart-base/processes/content/SGAuthoring.DAKLifecycle.bpmn
    When it is extracted with no persona titles
    Then it has bpmn-definitions, bpmn-process, bpmn-participant, bpmn-task and persona nodes
    And it has no validation errors

  @test:smart-base/L1/schemas/test/extractors.test.ts::extractBpmn:_a_pool_resolves_against_ActorDefinition_titles_(built_fixture)
  Scenario: extractBpmn resolves a pool against ActorDefinition titles
    Given a built ActorDefinition titled "Registered nurse" and a BPMN whose pool is named "Registered nurse"
    When the BPMN is extracted with the persona titles read from that directory
    Then its performedBy edge is resolved
    And it has no validation errors with the resolved persona supplied as external

  @test:smart-base/L1/schemas/test/extractors.test.ts::extractDak:_personas_and_requirements_from_the_real_FSH_tree
  Scenario: extractDak reads personas and requirements from the real FSH tree
    Given a minimal dak.json and the real input/fsh and input/dmn
    When the DAK is extracted
    Then it has dak, persona, functional-requirement and requirement-statement nodes
    And it found more than zero personas and requirements
    And it has no validation errors, with more than zero resolved joins

  @test:smart-base/L1/schemas/test/extractors.test.ts::extractL3:_the_IG's_FHIR_artefacts_as_the_L3_subgraph
  Scenario: extractL3 reads the IG's FHIR artefacts as the L3 subgraph
    Given the IG root with its sushi-config.yaml
    When L3 is extracted
    Then it has actor-definition, requirements, value-set, code-system, structure-definition and profile nodes
    And it counts more than zero ActorDefinitions
    And it has no validation errors
