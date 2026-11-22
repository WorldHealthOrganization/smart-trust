Feature: The DTH step-table schema and its BPMN swimlane derivation
  A DTH chapter's step table (inputs, steps, resources, outputs, risks and
  mitigations) is validated, its roles checked, and BPMN lanes and XML are
  derived from it mechanically.

  @test:smart-base/schemas/dth-step-table.test.ts::DthStepTableSchema::validatesFlatStepTable
  Scenario: validates a flat DTH step table with INPUTS, STEPS, RESOURCES, OUTPUTS, RISKS and MITIGATION
    Given a flat step table with declared roles, one input, two steps, a resource, an output and a risk
    When it is parsed
    Then it has 2 steps and 1 risk
    And its role ids, in order of first use, are "PC-R-01", "pers:data-steward" and "PC-R-02"

  @test:smart-base/schemas/dth-step-table.test.ts::DthStepTableSchema::supportsGroupedSteps
  Scenario: supports grouped steps for chapter/phase panels (PHC and HRH planning steps)
    Given a step table of two phase groups holding three steps and one risk
    When it is parsed
    Then its flattened steps are step-3-2-1, step-3-2-2 and step-3-3-1
    And it has 1 risk

  @test:smart-base/schemas/dth-step-table.test.ts::DthStepTableSchema::rejectsProseRoleIds
  Scenario: rejects free-text prose in roleIds and ownerRoleId
    Given a step whose role id is "Ministry of Health and all partners in the country"
    Then the step table does not parse

  @test:smart-base/schemas/dth-step-table.test.ts::DthStepTableSchema::rejectsUndeclaredRoles
  Scenario: rejects undeclared roles when declaredRoles is provided
    Given a step table declaring only PC-R-01 whose risk is owned by PC-R-99
    Then it does not parse
    And validating its roles against PC-R-01 reports a problem naming "PC-R-99"

  @test:smart-base/schemas/dth-step-table.test.ts::DthStepTableSchema::derivesBpmnLanesAndXml
  Scenario: derives BPMN 2.0 swimlane stubs and XML mechanically from a step table
    Given a step table for process PC-BP-01 with step-1 by PC-R-01 and step-2 by PC-R-01 and PC-R-02
    And a map of those roles to personas
    Then two lanes are derived: the steering committee with step-1 and step-2, and the data steward with step-2
    And the generated XML has an XML declaration, a process "Process_PC-BP-01", both partition element refs and a sequence flow
