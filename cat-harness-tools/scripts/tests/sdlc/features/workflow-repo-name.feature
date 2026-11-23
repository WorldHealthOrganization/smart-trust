# The workflows under .github/workflows/ never spell this repository's name in a
# Jekyll baseurl; the first path segment must be an expression, not a literal.
# Each Scenario names the test that executes it.
Feature: Workflows compose the Jekyll baseurl from the repository name

  @test:scripts/tests/sdlc/workflow-repo-name.test.ts::workflows_do_not_spell_the_repository_name::every_Jekyll_baseurl_is_composed,_not_hardcoded
  Scenario: Every Jekyll baseurl in a workflow starts with an expression, not a literal
    Given every .yml and .yaml file under .github/workflows, including untracked ones
    When each non-comment line that sets "baseurl:" is read
    Then the first path segment of every baseurl is a "${{ }}", "${VAR}" or "$VAR" expression
    And no line is reported as an offender

  @test:scripts/tests/sdlc/workflow-repo-name.test.ts::workflows_do_not_spell_the_repository_name::the_guard_can_actually_fire
  Scenario: The guard matches the pre-fix hardcoded baseurl line
    Given the pre-fix line writing baseurl "/folio-assistant/STAGING/${SLUG}"
    When the baseurl pattern is applied to it
    Then it matches
    And its first path segment is "folio-assistant"
    And that segment is not read as an expression

  @test:scripts/tests/sdlc/workflow-repo-name.test.ts::workflows_do_not_spell_the_repository_name::a_composed_baseurl_passes
  Scenario: A baseurl composed from a variable passes
    Given a line writing baseurl "/${REPO}/STAGING/${SLUG}"
    When the baseurl pattern is applied to it
    Then it matches
    And its first path segment is read as an expression
