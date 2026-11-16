# The "site.build" block of a layer's config in schemas/kg/harness-config.ts: the package scripts that build the layer's site, read by build-instance-site.ts and stage-local.ts.
# Each Scenario names the test that executes it.
Feature: The site build recipe

  @test:schemas/site-build-recipe.test.ts::site.build::holds_the_three_step_lists_and_an_optional_home_page
  Scenario: A site build holds the pre, source and site step lists and a home page
    Given a site build with home "README.md", pre "check:archimate", source step "site:document" and site step "site:node-kinds"
    When it is parsed
    Then the build holds exactly those values

  @test:schemas/site-build-recipe.test.ts::site.build::an_omitted_list_is_empty,_not_absent
  Scenario: An omitted step list parses as an empty list
    Given a site build naming only the source step "site:document"
    When it is parsed
    Then its pre and site step lists are empty and no home is set

  @test:schemas/site-build-recipe.test.ts::site.build::a_step_is_a_package_script_NAME:_a_command_is_refused
  Scenario: A step that is a shell command rather than a script name is refused
    When a site build with the pre step "rm -rf /" is parsed, it is refused
    And a site build with the site step "a; b" is refused

  @test:schemas/site-build-recipe.test.ts::site.build::a_site_with_no_build_is_unchanged
  Scenario: A site with no build parses unchanged
    Given a site holding only "landing" true
    When it is parsed
    Then it is unchanged
