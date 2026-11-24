# The topic level of a skills directory: a topic directory holds packages,
# and skills.json says which are topics. Each Scenario names the test that
# executes it.
Feature: Skill topics

  Background:
    Given a skills directory holding crdm, kg/graph-management, kg/kg-core and memory

  @test:scripts/tests/skill-topics.test.ts::packageDirsIn::with_no_skills.json_every_direct_subdirectory_is_a_candidate,_and_nothing_is_descended_into
  Scenario: Without skills.json every direct subdirectory is a package
    Then the packages are crdm, kg and memory

  @test:scripts/tests/skill-topics.test.ts::packageDirsIn::a_declared_topic_is_replaced_by_its_subdirectories,_which_keep_their_own_names
  Scenario: A declared topic is replaced by its subdirectories
    Given skills.json declares the topic kg
    Then the packages are crdm, kg/graph-management, kg/kg-core and memory
    And kg/graph-management is named graph-management under topic kg

  @test:scripts/tests/skill-topics.test.ts::packageDirsIn::an_absent_skills_directory_has_no_packages
  Scenario: An absent skills directory has no packages
    Then a directory that does not exist has no packages

  @test:scripts/tests/skill-topics.test.ts::topicsOf_refuses_what_it_cannot_verify::malformed_JSON_throws
  Scenario: Malformed skills.json throws
    Given skills.json is not valid JSON
    Then reading topics throws "not valid JSON"

  @test:scripts/tests/skill-topics.test.ts::topicsOf_refuses_what_it_cannot_verify::a_file_that_is_not_the_skill-topics/v1_family_throws
  Scenario: A file without the skill-topics schema throws
    Given skills.json lists topics with no $schema
    Then reading topics throws naming $schema

  @test:scripts/tests/skill-topics.test.ts::topicsOf_refuses_what_it_cannot_verify::a_topic_missing_a_field_throws
  Scenario: A topic missing a field throws
    Given a topic with no description
    Then reading topics throws naming description

  @test:scripts/tests/skill-topics.test.ts::topicsOf_refuses_what_it_cannot_verify::a_declared_topic_that_does_not_exist_throws_—_declare_only_what_exists
  Scenario: A declared topic that does not exist throws
    Given a topic at path "library", which does not exist
    Then reading topics throws "does not exist"

  @test:scripts/tests/skill-topics.test.ts::topicsOf_refuses_what_it_cannot_verify::a_path_that_is_not_one_plain_segment_throws
  Scenario: A topic path of more than one segment throws
    Given a topic at path "kg/deeper"
    Then reading topics throws "one plain segment"
