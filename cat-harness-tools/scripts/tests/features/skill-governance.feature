# Which skill governs a directory is read from the skills themselves.
# Each Scenario names the test that executes it.
Feature: Skill governance of directories

  @test:scripts/tests/skill-governance.test.ts::reading_the_declarations::a_list,_an_inline_list,_and_nothing
  Scenario: Front-matter lists are read in both forms
    Then a block list and an inline list of graph-typologies both read as a and b
    And a key outside front matter reads as empty

  @test:scripts/tests/skill-governance.test.ts::reading_the_declarations::skills_are_read_from_skills/_directories,_never_from_a_published_docs_copy
  Scenario: Skills are read only from skills/ directories
    Given skills under platform/skills and domain/skills and a copy under platform/docs/skills
    When skill governance is read
    Then the skills are ig-build, skills-and-tools and todo-manager

  @test:scripts/tests/skill-governance.test.ts::who_governs_a_directory::a_kind_claim_governs_every_directory_of_that_kind_in_reach
  Scenario: A kind claim governs every directory of that kind in reach
    Then todo-manager governs platform's beans directory
    And it governs domain's beans-kind directory, since domain reaches platform

  @test:scripts/tests/skill-governance.test.ts::who_governs_a_directory::a_kind_claim_does_not_reach_an_instance_that_does_not_depend_on_the_skill's
  Scenario: A kind claim does not reach an instance that does not depend on it
    Then platform's fhir-index directory has no governing skill

  @test:scripts/tests/skill-governance.test.ts::who_governs_a_directory::governs:_names_ONE_directory,_instance-qualified_—_the_same_id_elsewhere_is_not_it
  Scenario: governs names one instance-qualified directory
    Then domain's tools directory is governed by ig-build
    And platform's tools directory is governed by skills-and-tools
