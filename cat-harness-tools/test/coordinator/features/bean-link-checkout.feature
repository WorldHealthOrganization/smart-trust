# Specifies that the shipped BPMN diagrams name a work-plan operation on every
# activity they mark as touching the work plan.
Feature: Every bean-marked activity in the shipped diagrams names a work-plan operation

  @test:test/coordinator/bean-link-checkout.test.ts::the_diagrams_declare_which_operation_each_step_performs::every_bean-marked_activity_in_the_shipped_diagrams_names_an_op
  Scenario: Every activity that touches the work plan names a known operation
    Given the diagrams editing-hci-validation, draft-to-publication, content-lifecycle, authoring-a-paper, l2-dak-authoring and l3-fhir-pipeline, found through the declared processes graphs
    When each diagram's process model is loaded
    Then every node that touches the work plan has a defined work-plan operation
    And that operation is one of the known work-plan operations
    And there are exactly 8 such nodes across the diagrams
