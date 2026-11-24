# The declared-recipe path: a repository whose <instance>.config.json carries
# site.build is built from its own package scripts. Each Scenario names the
# test that executes it.
Feature: Staging a site from its declared recipe

  @test:scripts/tests/stage-local-declared.test.ts::recipeFromConfig::reads_site.build,_with_an_omitted_list_read_as_empty
  Scenario: site.build is read with omitted lists empty
    Given a config whose site.build declares a home and one source step
    Then the recipe has that home and source step, with empty pre and site steps

  @test:scripts/tests/stage-local-declared.test.ts::recipeFromConfig::finalSteps:_read_when_declared,_absent_when_not,_held_to_package_script_names
  Scenario: finalSteps are read when declared and must be script names
    Given a config declaring site steps and final steps
    Then the recipe carries finalSteps ["site:bar"]
    And a final step that is a shell command throws "package script names"

  @test:scripts/tests/stage-local-declared.test.ts::recipeFromConfig::no_config,_or_a_config_with_no_site.build,_is_undefined
  Scenario: No config or no site.build gives no recipe
    Then a checkout with no config has no recipe
    And a config with only site.landing has no recipe

  @test:scripts/tests/stage-local-declared.test.ts::recipeFromConfig::a_step_that_is_a_command,_not_a_package_script_name,_is_refused
  Scenario: A command as a step is refused
    Then a pre step "rm -rf /" throws "package script names"

  @test:scripts/tests/stage-local-declared.test.ts::declaredRecipe::names_the_instance_the_checkout_declares_and_its_recipe
  Scenario: The declared recipe names its instance
    Given a checkout declaring demo with a site.build recipe
    Then the declared recipe is instance demo with that recipe

  @test:scripts/tests/stage-local-declared.test.ts::declaredRecipe::a_checkout_with_no_recipe_is_left_to_the_workflow-described_path
  Scenario: A checkout with no recipe has no declared recipe
    Given a checkout whose config has no site.build
    Then there is no declared recipe

  @test:scripts/tests/stage-local-declared.test.ts::stageDeclared_--plan::the_default_branch_plans_the_publish_root_and_builds_nothing
  Scenario: On the default branch the plan targets the publish root
    Given a git checkout on main with a declared recipe
    When the declared stage is planned
    Then the result is a folio via site.build targeting main at https://o.github.io/demo/, not pushed
    And the plan names the site step site:node-kinds

  @test:scripts/tests/stage-local-declared.test.ts::stageDeclared_--plan::another_branch_plans_a_branches/_preview
  Scenario: Another branch plans a preview
    When the declared stage is planned for branch claude/x
    Then the target is "preview" at https://o.github.io/demo/branches/claude-x/

  @test:scripts/tests/stage-local-declared.test.ts::stageDeclared_--plan::--artifact_is_refused_rather_than_ignored
  Scenario: --artifact is refused
    When the declared stage is run with --artifact
    Then it rejects with "--artifact"
