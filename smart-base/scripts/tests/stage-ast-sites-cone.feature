Feature: The AST sites a preview stages, under the staging cone
  On this checkout, whether a change carries the smart-trust AST site through
  the staging cone's site filter.

  @test:smart-base/scripts/tests/stage-ast-sites-cone.test.ts::the_AST_sites,_on_this_checkout::skillOnlyChangeStagesNoAstSite
  Scenario: a skill-only change stages no AST site
    When only "cat-harness/skills/kg/kg-core/directory-conventions.md" changes
    Then the smart-trust AST site is not carried

  @test:smart-base/scripts/tests/stage-ast-sites-cone.test.ts::the_AST_sites,_on_this_checkout::genIgPagesChangeStagesAstSite
  Scenario: a gen-ig-pages.ts change stages it
    When "fhir-harness/scripts/gen-ig-pages.ts" changes
    Then the smart-trust AST site is carried

  @test:smart-base/scripts/tests/stage-ast-sites-cone.test.ts::the_AST_sites,_on_this_checkout::chromeChangeStagesAstSite
  Scenario: a chrome change stages it, through derivedFrom
    When "smart-base/themes/chrome.json" changes
    Then the smart-trust AST site is carried

  @test:smart-base/scripts/tests/stage-ast-sites-cone.test.ts::the_AST_sites,_on_this_checkout::buildEnvironmentStagesAstSite
  Scenario: the build environment stages it
    When the site chrome's Gemfile.lock in cat-harness changes
    Then the smart-trust AST site is carried
