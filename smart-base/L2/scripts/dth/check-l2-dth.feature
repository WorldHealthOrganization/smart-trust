Feature: The L2 DTH folio checks
  The L2 DTH validator over a fixture folio: cross-instance SKOS glossary
  links, persona linkage, DMN decision-table source citations, ArchiMate-link
  QA, and L1 coverage that counts anchored BPMN tasks and DMN tables.

  @test:smart-base/L2/scripts/dth/check-l2-dth.test.ts::validateL2DthFolio::passesCompleteL2DthFixture
  Scenario: passes a complete L2 DTH fixture with cross-instance SKOS links, personas, BPMN lanes, and DMN table citing its source
    Given the complete dth-sfp fixture folio with mounted dpi-h-ra and dth-sc glossaries
    When the folio is validated
    Then there are no errors and it is ok
    And it counts 1 glossary term, 1 persona, 1 business process, 1 BPMN lane, 1 decision table and 2 decision rules

  @test:smart-base/L2/scripts/dth/check-l2-dth.test.ts::validateL2DthFolio::reportsBrokenCrossInstanceSkosMatch
  Scenario: reports a broken cross-instance SKOS match into smart-ra or dth-sc
    Given the fixture whose glossary term has a closeMatch to "nonexistent-term" in dpi-h-ra
    When the folio is validated
    Then it is not ok
    And an error says "nonexistent-term is not a term in mounted instance dpi-h-ra"

  @test:smart-base/L2/scripts/dth/check-l2-dth.test.ts::validateL2DthFolio::failsPersonaMissingLinks
  Scenario: fails a persona block missing BPMN lane, ArchiMate element, or glossary link
    Given the fixture whose persona block has only a roleId in its meta
    When the folio is validated
    Then it is not ok
    And errors say "persona is missing meta.roleId or meta.bpmnLanes", "persona is missing meta.archimate.elements" and "persona is missing glossary link"

  @test:smart-base/L2/scripts/dth/check-l2-dth.test.ts::validateL2DthFolio::failsDecisionTableWithoutSource
  Scenario: fails a DMN decision-table block that does not cite its source handbook passage
    Given the fixture whose decision-table block has a decisionId and no source
    When the folio is validated
    Then it is not ok
    And an error says "does not cite the source handbook passage"

  @test:smart-base/L2/scripts/dth/check-l2-dth.test.ts::ArchiMate-link_QA_checks::validatesArchimateIris
  Scenario: validates element, view, and figure-view IRIs against the mounted ArchiMate model
    Given an ArchiMate model index 0.2.0 with elements id-prod-reg and id-term-svc and view id-view-dhsc
    When a block links element id-prod-reg, view id-view-dhsc and a figure on that view
    Then it has no errors, 2 links and 1 figure
    When a block links element id-missing
    Then it has one error naming "id-missing.jsonld"

  @test:smart-base/L2/scripts/dth/check-l2-dth.test.ts::ArchiMate-link_QA_checks::flagsUnlinkedArchitectureMention
  Scenario: flags a narrative block that names an expected architecture element without linking to its smart-ra IRI
    Given "Product Registry" is an expected architecture element
    When a narrative naming the Product Registry links no element
    Then there is one finding
    When it links the Product Registry's IRI
    Then there are no findings

  @test:smart-base/L2/scripts/dth/check-l2-dth.test.ts::L1_coverage_with_anchored_BPMN_tasks_and_DMN_decision_tables::countsAnchoredSentencesCaptured
  Scenario: counts a normative sentence anchored to a BPMN task or DMN table as captured
    Given a page with two normative sentences
    When coverage is measured with no anchored artefacts
    Then 2 are normative, 0 captured and 2 unaccounted
    When one sentence is anchored to a BPMN task and the other to a DMN table
    Then 2 are normative, 2 captured, 0 unaccounted and 100% accounted for
    And the sentences' nodes name the bpmn-task and the dmn-table

  @test:smart-base/L2/scripts/dth/check-l2-dth.test.ts::L1_coverage_with_anchored_BPMN_tasks_and_DMN_decision_tables::recognisesSourceCitations
  Scenario: recognises source citations across meta.source, uses, .md and .dmn
    Then a decision table with no citation is not recognised as citing its source
    And one whose uses names "prose:sec-4-3" is
    And one whose meta.source names a section is
    And one whose .md says "Source: Chapter 4, Fig. 4 (page-041)" is
