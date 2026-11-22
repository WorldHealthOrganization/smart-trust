Feature: the tabular Tool nodes

  @test:tools/tabular-tools.test.ts::tabular_Tool_nodes::bothDeclaredNotStub
  Scenario: both are declared, and neither is a stub
    When the tabular tools are listed
    Then they are tabular-csv and tabular-xlsx
    And neither is manual nor titled as a stub

  @test:tools/tabular-tools.test.ts::tabular_Tool_nodes::scriptsExist
  Scenario: each invokes a script that exists in this repository
    When each tool's shell command is read
    Then the script it runs exists in this repository

  @test:tools/tabular-tools.test.ts::tabular_Tool_nodes::satisfyTabularMetadata
  Scenario: each satisfies the tabular-metadata skill
    When each tool's satisfied skills are read
    Then they include tabular-metadata
