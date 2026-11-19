# Specifies schemas/process/methodology.ts: the name of the `uses-methodology`
# field a skill carries and the shape of its value. Whether each name resolves
# to a methodology node is not checked here.
Feature: A skill names the methodologies it uses as a non-empty list of names

  @test:schemas/process/methodology.test.ts::uses-methodology::is_the_field_skills_carry
  Scenario: The field is called uses-methodology
    Given the methodology field constant
    Then it is "uses-methodology"

  @test:schemas/process/methodology.test.ts::uses-methodology::is_a_list_of_methodology_names
  Scenario: A list of methodology names is accepted
    Given the list "wiregen", "hybrid-llm-deterministic"
    When it is parsed with the uses-methodology schema
    Then it is accepted

  @test:schemas/process/methodology.test.ts::uses-methodology::refuses_an_empty_list,_a_path,_and_a_single_string
  Scenario: An empty list, a path and a bare string are refused
    Given an empty list, a list holding "not-a-dir/wiregen.md", and the string "wiregen"
    When each is parsed with the uses-methodology schema
    Then each is refused
