Feature: knowledgeGraphsIn — finding Knowledge Graph declarations in a directory

  @test:schemas/declaration.test.ts::knowledgeGraphsIn::skipsBuildOutputDirectory
  Scenario: does not read a build-output directory, so a build report is no writer's input
    Given a fresh temporary directory
    And every build-output directory exists inside it, each holding a JSON file named like a declaration but invalid
    When knowledgeGraphsIn reads the temporary directory
    Then it finds no Knowledge Graphs
