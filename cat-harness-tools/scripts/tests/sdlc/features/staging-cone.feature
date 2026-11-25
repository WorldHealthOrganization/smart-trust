# scripts/staging-cone.ts works out which derived directories and built sites a change
# carries into a staging build, on planted trees and on this checkout.
# Each Scenario names the test that executes it.
Feature: Staging cone of a change

  @test:scripts/tests/sdlc/staging-cone.test.ts::the_cone,_on_a_planted_tree::no_file_list_carries_everything
  Scenario: No file list carries everything
    Given a planted tree where "a/pages" is derived from "a/index" and written by gen/pages.ts
    When the cone is taken with no file list
    Then "a/index" and "a/pages" are both carried

  @test:scripts/tests/sdlc/staging-cone.test.ts::the_cone,_on_a_planted_tree::an_empty_list_carries_nothing_—_a_determined_answer,_not_a_doubt
  Scenario: An empty file list carries nothing
    Given the planted tree
    When the cone is taken with an empty file list
    Then nothing is carried

  @test:scripts/tests/sdlc/staging-cone.test.ts::the_cone,_on_a_planted_tree::a_change_to_the_source_reaches_what_is_derived_from_it
  Scenario: A change to the source reaches what is derived from it
    Given the planted tree
    When "a/index/x.json" changes
    Then "a/index" and "a/pages" are carried

  @test:scripts/tests/sdlc/staging-cone.test.ts::the_cone,_on_a_planted_tree::a_change_in_the_writer's_import_closure_reaches_the_pages_only
  Scenario: A change in the writer's import closure reaches the pages only
    Given the planted tree, where gen/pages.ts imports lib/util.ts
    When "lib/util.ts" changes
    Then only "a/pages" is carried

  @test:scripts/tests/sdlc/staging-cone.test.ts::the_cone,_on_a_planted_tree::a_change_under_a_writer_directory_reaches_the_pages
  Scenario: A change under a writer directory reaches the pages
    Given the planted tree, where gen/templates/ is a writer of "a/pages"
    When "gen/templates/t.liquid" changes
    Then only "a/pages" is carried

  @test:scripts/tests/sdlc/staging-cone.test.ts::the_cone,_on_a_planted_tree::an_unrelated_change_reaches_nothing
  Scenario: An unrelated change reaches nothing
    Given the planted tree
    When "skills/x.md" changes
    Then nothing is carried

  @test:scripts/tests/sdlc/staging-cone.test.ts::the_cone,_on_a_planted_tree::a_computed_import_carries_on_a_changed_module,_never_on_a_page
  Scenario: A computed import carries on a changed module, never on a page
    Given every writer closure reports a computed import
    When "other/mod.ts" changes
    Then "a/pages" is carried
    When "skills/x.md" changes
    Then "a/pages" is not carried

  @test:scripts/tests/sdlc/staging-cone.test.ts::the_cone,_on_a_planted_tree::an_unreadable_closure_carries,_and_says_why
  Scenario: An unreadable closure carries, and says why
    Given every writer closure has a doubt
    When "z" changes
    Then "a/pages" is carried
    And its reason says the closure "cannot be read"

  @test:scripts/tests/sdlc/staging-cone.test.ts::importClosure,_on_this_checkout::reaches_gen-ig-pages'_own_imports
  Scenario: The import closure of gen-ig-pages.ts reaches its own imports
    # Skipped: unless fhir-harness, smart-base and smart-trust are in the checkout
    When the import closure of fhir-harness/scripts/gen-ig-pages.ts is read
    Then it includes gen-ig-pages.ts itself
    And it includes fhir-harness/schemas/ig-chrome.ts

  @test:scripts/tests/sdlc/staging-cone.test.ts::importClosure,_on_this_checkout::a_missing_entry_is_a_doubt,_never_an_empty_closure_read_as_clean
  Scenario: A missing entry is a doubt, never an empty closure read as clean
    # Skipped: unless fhir-harness, smart-base and smart-trust are in the checkout
    When the import closure of "no/such.ts" is read
    Then its doubt says it "does not exist"

  @test:scripts/tests/sdlc/staging-cone.test.ts::the_Done-when_measurements,_on_this_checkout::a_skill-only_change_carries_no_IG
  Scenario: A skill-only change carries no IG
    # Skipped: unless fhir-harness, smart-base and smart-trust are in the checkout
    Given the cone over this checkout's real derivation tree
    When only "cat-harness/skills/kg/kg-core/directory-conventions.md" changes
    Then no IG docs directory is carried

  @test:scripts/tests/sdlc/staging-cone.test.ts::the_Done-when_measurements,_on_this_checkout::an_unrelated_script_change_carries_no_IG
  Scenario: An unrelated script change carries no IG
    # Skipped: unless fhir-harness, smart-base and smart-trust are in the checkout
    Given the cone over this checkout's real derivation tree
    When only "cat-harness/scripts/check-ci-health.ts" changes
    Then no IG docs directory is carried

  @test:scripts/tests/sdlc/staging-cone.test.ts::the_Done-when_measurements,_on_this_checkout::a_gen-ig-pages.ts_change_carries_every_IG
  Scenario: A gen-ig-pages.ts change carries every IG
    # Skipped: unless fhir-harness, smart-base and smart-trust are in the checkout
    Given the cone over this checkout's real derivation tree
    When "fhir-harness/scripts/gen-ig-pages.ts" changes
    Then exactly "smart-base/smart-base-docs" and "smart-trust/smart-trust-docs" are carried

  @test:scripts/tests/sdlc/staging-cone.test.ts::the_Done-when_measurements,_on_this_checkout::a_chrome_change_carries_every_IG,_through_derivedFrom
  Scenario: A chrome change carries every IG through derivedFrom
    # Skipped: unless fhir-harness, smart-base and smart-trust are in the checkout
    Given the cone over this checkout's real derivation tree
    When "smart-base/themes/chrome.json" changes
    Then 2 IG docs directories are carried

  @test:scripts/tests/sdlc/staging-cone.test.ts::a_BUILT_site_(IG_Jekyll,_AST):_siteInCone::no_file_list_carries
  Scenario: No file list carries a built site
    Given a built site rooted at "a" with writer gen/site.ts and an uncarried cone directory
    When no file list is given
    Then the site is carried

  @test:scripts/tests/sdlc/staging-cone.test.ts::a_BUILT_site_(IG_Jekyll,_AST):_siteInCone::the_build_environment_carries_every_site
  Scenario: The build environment carries every site
    Given the built site
    When "cat-harness/site-chrome/Gemfile.lock" changes
    Then the site is carried

  @test:scripts/tests/sdlc/staging-cone.test.ts::a_BUILT_site_(IG_Jekyll,_AST):_siteInCone::a_change_under_the_instance_carries_it
  Scenario: A change under the instance carries its site
    Given the built site rooted at "a"
    When "a/fhir-artifact-index/menu.json" changes
    Then the site is carried

  @test:scripts/tests/sdlc/staging-cone.test.ts::a_BUILT_site_(IG_Jekyll,_AST):_siteInCone::the_cone_reaching_one_of_its_directories_carries_it
  Scenario: The cone reaching one of its directories carries the site
    Given the built site whose cone directory "a/pages" is carried
    When "themes/x.json" changes
    Then the site is carried

  @test:scripts/tests/sdlc/staging-cone.test.ts::a_BUILT_site_(IG_Jekyll,_AST):_siteInCone::a_change_in_a_writer's_closure_carries_it
  Scenario: A change in a writer's closure carries the site
    Given the built site whose writer gen/site.ts imports lib/s.ts
    When "lib/s.ts" changes
    Then the site is carried

  @test:scripts/tests/sdlc/staging-cone.test.ts::a_BUILT_site_(IG_Jekyll,_AST):_siteInCone::an_unrelated_change_does_not
  Scenario: An unrelated change does not carry the site
    Given the built site
    When "skills/x.md" changes
    Then the site is not carried
