# The harness schemas UML draws every arrow from the dependent to the general
# node, and every class reaches its glossary definition (#1168, plan C). Each
# Scenario names the test that executes it.
Feature: The object model UML

  @test:scripts/tests/object-model-uml.test.ts::arrows_run_from_the_dependent_to_the_general_node::a_Task_realises_the_Skill_it_implements
  Scenario: A Task realises the Skill it implements
    Given the glossary page is built
    Then the schemas view has an edge from Task realising Skill as implements

  @test:scripts/tests/object-model-uml.test.ts::arrows_run_from_the_dependent_to_the_general_node::a_Voice_and_a_User_Story_point_at_their_Role,_and_the_Role_names_neither
  Scenario: A Voice and a User Story point at their Role, and the Role names neither
    Then Voice points at Role as written for, and UserStory points at Role as as a
    And no edge from Role names Voice or UserStory

  @test:scripts/tests/object-model-uml.test.ts::arrows_run_from_the_dependent_to_the_general_node::a_Skill_points_at_its_input_and_output_schemas,_and_a_Test_Run_at_the_ones_its_cases_meet
  Scenario: A Skill points at its schemas, and a Test Run at the ones its cases meet
    Then exactly two dependency edges run from Skill to JsonSchema
    And an edge runs from TestRun to JsonSchema

  @test:scripts/tests/object-model-uml.test.ts::every_class_links_to_its_glossary_definition::in_the_PlantUML
  Scenario: Every class in the PlantUML links to its glossary definition
    Given the glossary page is built
    Then there is at least one class, every class links to a glossary page, and each link's page is the instance its anchor names

  @test:scripts/tests/object-model-uml.test.ts::every_class_links_to_its_glossary_definition::and_on_the_page,_since_the_SVG_is_shown_as_an_image
  Scenario: The page lists one glossary link per class
    Given the glossary page is built
    Then the glossary links Markdown holds as many links as there are classes

  @test:scripts/tests/object-model-uml.test.ts::every_class_links_to_its_glossary_definition::a_term's_page_is_its_owning_instance's_glossary_page
  Scenario: A term's page is its owning instance's glossary page
    Then a cat-harness term's page ends in /instance/cat-harness/ and a bootstrap term's in /instance/bootstrap/
    And the page sits under the en locale

  @test:scripts/tests/object-model-uml.test.ts::every_class_links_to_its_glossary_definition::a_class_whose_term_the_page_lacks_is_reported,_and_no_page_is_could-not-determine
  Scenario: A class whose term the page lacks is reported
    Then a class whose term the glossary defines has no finding
    And with the term missing it is reported as having no glossary entry
    And with the glossary unknown the finding is could not determine
