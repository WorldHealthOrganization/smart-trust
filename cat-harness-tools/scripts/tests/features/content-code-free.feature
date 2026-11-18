# scripts/check-content-code-free.ts (`check:content-code-free`): a code file in the content tree
# that the committed list does not allow is red; a listed file that is gone is only reported.
# Each Scenario names the test that executes it.
Feature: Content stays free of code outside the committed list

  @test:scripts/tests/content-code-free.test.ts::check:content-code-free::code_is_decided_by_extension
  Scenario: A file is code by its extension
    Given the paths "a.ts", "b/c.mjs", "d.py", "e.sh", "lib/f.rb" and "g.js"
    Then each is code
    And "a.json", "b.md", "c.html", "d.css", "e.yml" and "f.ts.md" are not code

  @test:scripts/tests/content-code-free.test.ts::check:content-code-free::shipped_browser_assets_are_not_code
  Scenario: Shipped browser assets are not code
    Given "site-chrome/assets/js/navbar.js", "site-chrome/_includes/mermaid_config.js" and a vendored .mjs under docs/assets/js/vendor
    Then none of them is code
    And "docs/assets/x.ts" and "tools/x.js" are code

  @test:scripts/tests/content-code-free.test.ts::check:content-code-free::a_page_built_at_publish_ships_its_script_in_an_assets/_folder_beside_it,_and_that_is_not_code
  Scenario: A script in an assets folder under a built language tree is not code
    Given "docs/en/cat-harness/openapi/smart-trust/assets/openapi.js" and "docs/fr/x/assets/a.mjs"
    Then neither is code
    And the same script outside an assets folder is code
    And "docs/source/x/assets/a.js" is code
    And a .ts file in "docs/en/x/assets/" is code

  @test:scripts/tests/content-code-free.test.ts::check:content-code-free::a_path_the_harness_declares_builtAtPublish_is_never_tracked,_so_its_code_is_not_content's
  Scenario: Paths declared built at publish are left out of the code files
    Given the built-at-publish paths "docs/en/cat-harness/processes/" and "docs/assets/processes/index.json"
    Then "docs/en/cat-harness/processes/task-panel.js" is built at publish
    And "docs/en/cat-harness/processes-x/a.js" and "schemas/x.ts" are not
    And given a temporary corpus holding that task-panel.js and "schemas/x.ts"
    When its code files are listed with no built paths
    Then both files are listed
    And when listed with the built paths only "schemas/x.ts" is listed

  @test:scripts/tests/content-code-free.test.ts::check:content-code-free::the_folio_file-list_renderer_and_the_Jekyll_plugins_are_kept_by_rule
  Scenario: The folio file-list renderer and Jekyll plugins are not code
    Given "folio-render/file-list.ts", its test, and .rb plugins under site-chrome/_plugins and docs/_plugins
    Then none of them is code
    And "_plugins/x.ts", "site-chrome/_plugins/sub/x.ts" and "render/file-list.ts" are code

  @test:scripts/tests/content-code-free.test.ts::check:content-code-free::an_unlisted_file_is_added;_a_listed_file_that_is_gone_is_only_reported
  Scenario: Unlisted code is added and missing listed code is reported as gone
    Given code files "schemas/a.ts" and "tools/new.ts"
    And a list holding "schemas/a.ts" and "skills/old.ts"
    When they are judged
    Then the added files are "tools/new.ts"
    And the gone files are "skills/old.ts"

  @test:scripts/tests/content-code-free.test.ts::check:content-code-free::the_committed_list_is_sorted_and_has_no_duplicates
  Scenario: The committed list is sorted without duplicates
    When the committed list is read
    Then it equals its sorted copy
    And it has no duplicate entries

  @test:scripts/tests/content-code-free.test.ts::check:content-code-free::the_committed_list_is_read,_and_an_empty_one_allows_nothing
  Scenario: The committed list reads as an array and an empty list allows nothing
    When the committed list is read
    Then it is an array
    And judging "tools/new.ts" against an empty list adds "tools/new.ts" and reports nothing gone
