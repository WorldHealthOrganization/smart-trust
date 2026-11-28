# src/tools/skill-prompts.ts serves every skill whose front matter declares
# user_invocable as an MCP prompt carrying the skill's own body.
# Each Scenario names the test that executes it.
Feature: Skills declared user_invocable are served as MCP prompts

  @test:src/tools/skill-prompts.test.ts::the_declaration_decides,_and_nothing_else::only_front_matter_counts_—_a_body_that_MENTIONS_the_key_is_not_a_declaration
  Scenario: Only front matter declares a skill user_invocable
    Given a skill whose front matter has "user_invocable: true"
    Then it is declared user_invocable
    And the same skill without that key is not
    And a file whose body only mentions "user_invocable: true" is not

  @test:src/tools/skill-prompts.test.ts::the_declaration_decides,_and_nothing_else::invocable_skills_are_listed_by_name_across_packages;_the_rest_are_not
  Scenario: Invocable skills are listed by name across packages, the rest are not
    Given package "one" with invocable skill "a" and non-invocable skill "b"
    And package "two" with invocable skill "c"
    When the user_invocable skills are listed
    Then they are "a" from "one" and "c" from "two", in that order
    And no duplicates are reported

  @test:src/tools/skill-prompts.test.ts::the_declaration_decides,_and_nothing_else::a_declaration_with_no_name_is_skipped_—_the_name_IS_the_command
  Scenario: A user_invocable skill with no name is skipped
    Given a package with one user_invocable skill that declares no name
    When the user_invocable skills are listed
    Then the list is empty

  @test:src/tools/skill-prompts.test.ts::the_declaration_decides,_and_nothing_else::a_name_declared_twice_is_served_once_and_REPORTED
  Scenario: A name declared twice is served once and reported as a duplicate
    Given two packages that each declare user_invocable skill "a"
    When the user_invocable skills are listed
    Then one skill is listed
    And one duplicate is reported for "a", naming two paths

  @test:src/tools/skill-prompts.test.ts::the_prompt_carries_the_skill's_own_body,_never_a_paraphrase::the_body_and_the_person's_arguments
  Scenario: The prompt text carries the skill body and the person's arguments
    Given user_invocable skill "a" whose body is "Step one: measure."
    When its prompt text is built with arguments "PR 12"
    Then the text contains "Step one: measure."
    And it contains an "## Arguments" section holding "PR 12"
    And the text built with no arguments has no "## Arguments" section

  @test:src/tools/skill-prompts.test.ts::through_a_real_MCP_client::a_host_LISTS_the_prompts_and_GETS_one,_and_no_tool_is_registered
  Scenario: A real MCP client lists the prompts and gets one, and no tool is registered
    Given a package with invocable skill "a" whose body is "Step one: measure." and non-invocable skill "b"
    When the skill prompts are registered on an MCP server
    Then the registered names are just "a"
    When a client connected over an in-memory transport lists the prompts
    Then it sees only "a", described as "The a skill."
    When it gets prompt "a" with arguments "now"
    Then the first message is from the user and contains "Step one: measure."
    And listing tools fails, since no tool is registered

  @test:src/tools/skill-prompts.test.ts::over_this_repository::every_user_invocable_skill_here_is_a_prompt,_with_no_duplicate_names
  Scenario: Every user_invocable skill in this repository is a prompt, with no duplicate names
    Given the skills of this repository
    When the user_invocable skills are listed
    Then at least one is listed
    And no duplicates are reported
    And the names include "coordinate" and "prepare-merge"
