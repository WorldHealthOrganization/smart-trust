# BPMN translation end to end — extract, PO, inject — on the shipped
# bean-open.bpmn: a translated diagram is still a loadable process.
Feature: A translated BPMN diagram is still a loadable process

  @test:scripts/tests/process/translate-bpmn-e2e.test.ts::bpmn_translation_end_to_end::a_translated_diagram_still_loads,_with_its_graph_and_skill_refs_intact
  Scenario: A fully translated diagram loads with the same nodes, skill refs and bean ops
    # Gap: "graph intact" is checked as the same node ids only; sequence flows and lane membership are not compared
    Given bean-open.bpmn and a PO translating every msgid the extractor offers (more than 5) to "[fr] …"
    When the PO is injected and the result is loaded
    Then it has the same node ids as the source
    And its activities carry the same skill refs and the same work-plan ops
    And more than 5 nodes have names starting "[fr]"

  @test:scripts/tests/process/translate-bpmn-e2e.test.ts::bpmn_translation_end_to_end::a_partial_PO_leaves_the_untranslated_labels_in_the_source_language
  Scenario: A partial PO leaves untranslated labels in the source language
    Given bean-open.bpmn and a PO translating only "Whose bean?"
    When the PO is injected
    Then the output contains "À qui ?"
    And it still contains the English "Already exists?"
    And no name is empty
