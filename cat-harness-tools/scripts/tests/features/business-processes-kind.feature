# The business-processes graph typology (schemas/kg/graph-typology-registry.ts) and the BPMN listers in
# scripts/known-skills.ts: businessProcessFiles reads its diagrams, workflowFiles never does. Each Scenario names the test that executes it.
Feature: The business-processes kind

  @test:scripts/tests/business-processes-kind.test.ts::the_business-processes_kind::is_registered,_as_content_that_nothing_renders_as_a_page_by_itself
  Scenario: The business-processes kind is registered as non-renderable content
    Given the default graph typologies
    When the "business-processes" kind is looked up
    Then it holds "content"
    And it is not renderable

  @test:scripts/tests/business-processes-kind.test.ts::the_business-processes_kind::its_diagrams_are_read_by_businessProcessFiles_and_never_by_workflowFiles
  Scenario: Business-process diagrams are listed by businessProcessFiles and not by workflowFiles
    Given a declaration with a directory "input/business-processes/" of kind "business-processes" holding A.bpmn
    When the business-process files and the workflow files are listed
    Then the business-process files are exactly "/input/business-processes/A.bpmn"
    And no workflow file ends with "A.bpmn"

  @test:scripts/tests/business-processes-kind.test.ts::business-processes_sits_within_processes::declares_within:_processes_(display_only,_no_inheritance)
  Scenario: The business-processes kind sits within processes
    # Gap: does not check that nothing is inherited from processes
    Given the default graph typologies
    When the "business-processes" kind is looked up
    Then its within is "processes"

  @test:scripts/tests/business-processes-kind.test.ts::a_BPMN_held_as_a_folio_block::is_a_business_process:_listed_by_businessProcessFiles,_never_by_workflowFiles
  Scenario: A BPMN held as a folio block is a business process, not a workflow
    Given a declaration with a folio directory holding "folio/ig/intro/bp-01.bpmn"
    When the business-process files and the workflow files are listed
    Then the business-process files are exactly "/folio/ig/intro/bp-01.bpmn"
    And no workflow file ends with "bp-01.bpmn"
    And with folio excluded, the business-process files are empty
