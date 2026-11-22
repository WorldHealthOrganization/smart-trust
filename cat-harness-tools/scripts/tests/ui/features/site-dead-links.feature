# scripts/site-dead-links.ts checks a built site for internal links that resolve to nothing, and with --fix repoints those with one answer: a missing translation to its untranslated target, a source file to GitHub, a sibling .html, or a preview link to the published site.
# Each Scenario names the test that executes it.
Feature: Built-site dead-link check and repointing

  @test:scripts/tests/ui/site-dead-links.test.ts::which_links_are_checked::skips_external,_anchor,_Liquid,_ellipsis-placeholder_and_script-template_values
  Scenario: Only internal link values are checked
    Given the values "https://x.org/a", "mailto:a@b", "#top", "//cdn/x.js", a Liquid relative_url expression, "viewer/${a.url}", "…" and two script string-concatenation fragments
    When each is tested for being internal
    Then none is internal
    And "../a/b.html" is internal

  @test:scripts/tests/ui/site-dead-links.test.ts::which_links_are_checked::ignores_escaped_HTML_inside_<code>/<pre>_and_template_strings_inside_<script>,_while_still_checking_<script_src>
  Scenario: Escaped HTML in code and pre and template strings in scripts are ignored, but a script src is checked
    Given a page with an escaped img in code, an escaped link in pre, a link inside a script template string, and a script src "missing.js"
    When the site is checked
    Then the only dead target is "missing.js"

  @test:scripts/tests/ui/site-dead-links.test.ts::which_links_are_checked::resolves_relative_and_base-path-absolute_links_to_site_paths
  Scenario: Relative and base-path-absolute links resolve to site paths
    Given links from built pages
    When their targets are resolved
    Then "../y/z.md#s" from "docs/x/page.html" is "docs/y/z.md"
    And "/folio-assistant/b/c.svg" with base path "/folio-assistant" is "b/c.svg"
    And "../../out.html" from "a.html", which leaves the site, resolves to nothing

  @test:scripts/tests/ui/site-dead-links.test.ts::which_links_are_checked::drops_only_translated-locale_segments
  Scenario: Only translated-locale segments are dropped
    Given site paths with locale segments
    When the locale is removed from each
    Then "es/assets/img/x.svg" becomes "assets/img/x.svg"
    And "docs/process/fr/p.html" becomes "docs/process/p.html"
    And "en/cat-harness/x/" has no untranslated form

  @test:scripts/tests/ui/site-dead-links.test.ts::--fix_repoints_what_has_one_answer_and_reports_the_rest::a_missing_translation_falls_back_to_the_untranslated_target
  Scenario: A missing translation falls back to the untranslated target
    Given a site with "assets/img/x.svg" and a Spanish page linking "es/assets/img/x.svg" and "nowhere.html"
    When the site is checked with fix
    Then one link is repointed for reason "locale"
    And the page now points at "../../assets/img/x.svg"
    And "nowhere.html" is reported dead

  @test:scripts/tests/ui/site-dead-links.test.ts::--fix_repoints_what_has_one_answer_and_reports_the_rest::a_link_into_a_carried_directory_is_not_judged:_the_deploy_lays_that_tree_back_after_the_check
  Scenario: Links into carried directories are not judged
    Given a page linking into "STAGING/pr-1/", "_render-log/" and "gone/"
    When the site is checked
    Then only "gone/" is reported dead

  @test:scripts/tests/ui/site-dead-links.test.ts::--fix_repoints_what_has_one_answer_and_reports_the_rest::a_source_file_goes_to_GitHub_at_the_pinned_commit
  Scenario: A source file is repointed to GitHub at the pinned commit
    Given a tail index of checkout files including "cat-harness/sdlc/skills/crdm/crdm-detect.md"
    When the source for "docs/sdlc/skills/crdm/crdm-detect.md" is found
    Then it is "cat-harness/sdlc/skills/crdm/crdm-detect.md"
    And its blob URL at ref "abc" is "https://github.com/litlfred/cat-harness/blob/abc/sdlc/skills/crdm/crdm-detect.md"

  @test:scripts/tests/ui/site-dead-links.test.ts::--fix_repoints_what_has_one_answer_and_reports_the_rest::an_unrendered_page_is_looked_up_as_its_.md,_a_folder_as_its_README,_a_translation_as_its_source
  Scenario: Source lookup tries the .md, the folder README and the untranslated path
    Given site paths for an unrendered page, a folder and a .bpmn file
    When their source candidates are listed
    Then "proposals/x.html" yields itself and "proposals/x.md"
    And "docs/skills/tools/t/" yields its README.md and index.md
    And "a/b.bpmn" yields only itself
    And when a Spanish page's dead link "es/proposals/x.html" is checked with fix, the resolver is asked for "es/proposals/x.html" then "proposals/x.html"
    And the link is repointed to the GitHub blob of "proposals/x.md" for reason "source"
    And nothing is left dead

  @test:scripts/tests/ui/site-dead-links.test.ts::--fix_repoints_what_has_one_answer_and_reports_the_rest::an_ambiguous_source_is_left_dead
  Scenario: An ambiguous source is left unresolved
    Given a tail index holding "docs/AGENTS.md" under two instances
    When the source for "docs/AGENTS.md" is found
    Then there is none

  @test:scripts/tests/ui/site-dead-links.test.ts::--fix_repoints_what_has_one_answer_and_reports_the_rest::a_directory_link_whose_section_page_is_published_as_a_sibling_.html_repoints_to_that_.html
  Scenario: A directory link repoints to its sibling .html page
    Given a site with "concepts/architecture.html" and a README page linking "architecture/"
    When the site is checked with fix
    Then nothing is dead
    And the README now links "architecture.html"

  @test:scripts/tests/ui/site-dead-links.test.ts::--fix_repoints_what_has_one_answer_and_reports_the_rest::a_relative_link_from_docs/<instance>/<chapter>/_that_landed_at_docs/<tail>_resolves_<instance>/<tail>_in_the_checkout
  Scenario: A relative link that landed at docs/<tail> resolves to the instance's file in the checkout
    Given a tail index holding "cat-harness/README.md" among others
    And a page "docs/cat-harness/start/README.html" linking "../../README.md"
    When the site is checked with fix, resolving sources through the candidates and the tail index
    Then nothing is dead
    And the page now links "https://github.com/litlfred/cat-harness/blob/abc/README.md"

  @test:scripts/tests/ui/site-dead-links.test.ts::--fix_repoints_what_has_one_answer_and_reports_the_rest::without_--fix_nothing_is_rewritten
  Scenario: Without fix nothing is rewritten
    Given a Spanish page linking a missing translated asset whose untranslated copy exists
    When the site is checked without fix
    Then nothing is repointed
    And one link is reported dead

  @test:scripts/tests/ui/site-dead-links.test.ts::in_a_preview,_a_page_of_an_instance_the_preview_does_not_carry_goes_to_the_published_site::reads_the_published_root_off_a_preview_base_path,_and_none_off_a_canonical_one
  Scenario: The published root is read off a preview base path only
    Given base paths
    When the published root of each is read
    Then "/folio-assistant/STAGING/repin-train-1" yields "/folio-assistant"
    And "/folio-assistant" and "" yield none

  @test:scripts/tests/ui/site-dead-links.test.ts::in_a_preview,_a_page_of_an_instance_the_preview_does_not_carry_goes_to_the_published_site::repoints_only_when_the_instance's_composed_directory_holds_the_page's_source
  Scenario: A page is sent to the published site only when its instance's composed directory holds its source
    Given an instance "an-ig" whose composed directory holds "concepts/who.md"
    When published targets are looked up under "/folio-assistant"
    Then "an-ig/concepts/who.html" maps to "/folio-assistant/an-ig/concepts/who.html"
    And "an-ig/concepts/nobody-wrote-this.html" maps to nothing
    And a page of another instance maps to nothing

  @test:scripts/tests/ui/site-dead-links.test.ts::in_a_preview,_a_page_of_an_instance_the_preview_does_not_carry_goes_to_the_published_site::checkSite_takes_the_rule_only_when_it_is_given_one,_so_a_canonical_build_still_reports
  Scenario: The published-site rule applies only when it is given
    Given an instance "an-ig" whose composed directory holds "guides/dak.md" and a page linking "an-ig/guides/dak.html#a"
    When the site is checked with fix and no published rule
    Then "an-ig/guides/dak.html" is reported dead
    And when it is checked with a preview base path and the published rule, nothing is dead
    And the link is repointed to "/folio-assistant/an-ig/guides/dak.html#a" for reason "published"
    And the page on disk carries that link
