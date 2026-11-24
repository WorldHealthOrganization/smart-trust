# withPlatformUi in scripts/mount-instance-docs.ts adds the platform's docs-ui.js to a page,
# but never to one that already loads it. Each Scenario names the test that executes it.
Feature: docs-ui.js is loaded once per page

  @test:scripts/tests/ui/platform-ui-once.test.ts::withPlatformUi::adds_docs-ui_to_a_page_that_has_none
  Scenario: docs-ui is added to a page that has none
    Given a page with no docs-ui script
    When the platform UI is added
    Then the page loads docs-ui.js exactly once
    And it carries the platform UI attribute

  @test:scripts/tests/ui/platform-ui-once.test.ts::withPlatformUi::adds_nothing_to_a_theme_page_whose_layout_already_loads_docs-ui.js
  Scenario: Nothing is added to a theme page that already loads docs-ui.js
    Given a theme page whose head loads /smart-trust-tools/assets/js/docs-ui.js
    When the platform UI is added
    Then the page loads docs-ui.js exactly once
    And it does not contain "./assets/js/docs-ui.js"

  @test:scripts/tests/ui/platform-ui-once.test.ts::withPlatformUi::is_idempotent_on_its_own_output
  Scenario: Adding the platform UI is idempotent
    Given a page the platform UI was already added to
    When the platform UI is added again
    Then the page is unchanged

  @test:scripts/tests/ui/platform-ui-once.test.ts::withPlatformUi::a_script_merely_named_like_docs-ui_is_not_mistaken_for_it
  Scenario: A script merely named like docs-ui is not mistaken for it
    Given a page loading docs-ui-extra.js
    When the platform UI is added
    Then the page mentions docs-ui.js exactly once
    And it carries the platform UI attribute
