# src/core/edit-links.ts is the one recipe for every page's edit, source and feedback
# links, in TypeScript and in the published browser runtime, plus the suggest editor's
# token rules. Each Scenario names the test that executes it.
Feature: Edit and feedback links from one recipe

  @test:src/core/tests/edit-links.test.ts::edit-links:_one_recipe_for_every_page's_edit_and_feedback_links_(bean_v433)::the_published_runtime_is_the_generated_one_(run_--write-asset_after_changing_the_recipe)
  Scenario: The published edit-links runtime is the generated one
    Given the site's committed "assets/js/edit-links.js"
    Then it is byte for byte the asset the recipe generates

  @test:src/core/tests/edit-links.test.ts::edit-links:_one_recipe_for_every_page's_edit_and_feedback_links_(bean_v433)::a_source_line_and_a_submodule's_repository_reach_every_URL,_in_both_halves
  Scenario: A source line and a submodule's repository reach every URL, in both halves
    Given a block from "input/pagecontent/index.md" line 12 in repository "who/smart-base", on a site "o/r" branch "main"
    When the browser half computes its URLs
    Then its source, edit and feedback URLs equal the TypeScript half's
    And the source URL is "https://github.com/who/smart-base/blob/main/input/pagecontent/index.md#L12"
    And the feedback URL opens a new issue on the site's repository "o/r"

  @test:src/core/tests/edit-links.test.ts::edit-links:_one_recipe_for_every_page's_edit_and_feedback_links_(bean_v433)::a_single_link_carries_its_facts,_and_edit_keeps_a_plain_href_for_readers_without_JavaScript
  Scenario: A single link carries its facts, and an edit link keeps a plain href for readers without JavaScript
    When an edit link is written for "docs/a b.md" line 3 on "o/r"
    Then it carries data-fa-link "edit" and data-src "docs/a b.md"
    And its href is "https://github.com/o/r/edit/main/docs/a%20b.md"
    And a feedback link for "x.md" has no href

  @test:src/core/tests/edit-links.test.ts::edit-links:_one_recipe_for_every_page's_edit_and_feedback_links_(bean_v433)::the_suggest_editor's_own_tokens_are_Liquid_and_directives,_and_no_content_type's
  Scenario: The suggest editor's own tokens are Liquid and directives, and no content type's
    Given the suggest tokens with no profile rules
    When a text with a Liquid output, a :term directive, a \name command and an @cite is wrapped
    Then only the Liquid output and the directive are shielded
    And "{{ x | }}" and ":term[open" are reported as errors
    And an unclosed \name or @cite is not an error

  @test:src/core/tests/edit-links.test.ts::edit-links:_one_recipe_for_every_page's_edit_and_feedback_links_(bean_v433)::a_profile's_token_rules,_serialised_as_the_page_config_carries_them,_are_shielded_and_checked
  Scenario: A profile's token rules, serialised as the page config carries them, are shielded and checked
    Given an "at-ref" rule whose patterns are serialised regexes
    When the tokens are built with that rule
    Then "@cite{b}" is shielded alongside "{{ v }}"
    And "@cite{b}," and "@ref{c})." raise no errors, while "@cite{b" and "@ref." do
    And with ownOnly, the rule's syntax is neither shielded nor checked

  @test:src/core/tests/edit-links.test.ts::edit-links:_one_recipe_for_every_page's_edit_and_feedback_links_(bean_v433)::the_runtime_includes_the_gutter_bookmark_control_and_folio_pin_attributes_(cat-harness#982)
  Scenario: The runtime includes the gutter bookmark control and folio pin attributes
    Given the generated edit-links runtime
    Then its text contains "ba-bookmark", the bookmark pin-kind attribute, and "data-fa-pin-control"
