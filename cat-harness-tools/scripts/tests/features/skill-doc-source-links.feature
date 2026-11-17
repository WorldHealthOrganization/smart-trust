# Generated skill pages' source links resolve to a file in this repository;
# this part pins the repository-relative path. Each Scenario names the test
# that executes it.
Feature: Skill page source links

  @test:scripts/tests/skill-doc-source-links.test.ts::repoRelative::a_directory_inside_the_checkout_is_named_repository-relative
  Scenario: A directory inside the checkout is repository-relative
    Then /repo/cat-harness/skills/folio-core under /repo is "cat-harness/skills/folio-core"

  @test:scripts/tests/skill-doc-source-links.test.ts::repoRelative::a_directory_outside_the_checkout_has_no_path,_rather_than_a_`..`_one
  Scenario: A directory outside the checkout has no path
    Then a directory elsewhere has no repository-relative path
    And the checkout root itself has none

  @test:scripts/tests/skill-doc-source-links.test.ts::repoRelative::a_name_that_merely_starts_with_two_dots_is_still_inside
  Scenario: A name starting with two dots is inside
    Then /repo/..hidden/x is "..hidden/x"
