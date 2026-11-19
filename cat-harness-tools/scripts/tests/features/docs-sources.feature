# scripts/lib/docs-sources.ts finds which docs sources one gen-docs-pages run renders: the base
# layer's own source first, then each mounted layer's declared docs-source, qualifying their page keys.
# Each Scenario names the test that executes it.
Feature: Docs sources of every mounted layer

  @test:scripts/tests/docs-sources.test.ts::declaredDocsSources::a_docs_directory_whose_docs.json_declares_a_docs-source:_pages_render_into_that_directory
  Scenario: A docs directory whose docs.json declares a docs-source renders its pages into that directory
    Given an instance "upper" with a "docs/" directory whose docs.json declares the docs-source "source/"
    When its declared docs sources are read
    Then there is exactly one source, for instance "upper", not the base
    And its source directory is "docs/source" and its output directory is "docs"

  @test:scripts/tests/docs-sources.test.ts::declaredDocsSources::any_instance-scoped_docs_directory_may_declare_one,_not_only_`docs/`
  Scenario: Any instance-scoped docs directory may declare a docs-source, not only docs/
    Given an instance "ig" with docs directories "docs/" and "site-docs/"
    And only "site-docs/" has a docs.json declaring the docs-source "source"
    When its declared docs sources are read
    Then the only output directory found is "site-docs"
    And its source directory is "site-docs/source"

  @test:scripts/tests/docs-sources.test.ts::declaredDocsSources::nothing_declared,_an_absent_source,_a_non-docs_directory_or_a_repository-scoped_one:_no_source
  Scenario: No docs-source is found when none is declared, the source is absent, the directory is not docs, or it is repository-scoped
    Given an instance whose docs.json declares no docs-source
    And an instance whose declared docs-source directory does not exist
    And an instance declaring the docs-source under a "library/" directory of the "library" typology
    And an instance declaring the docs-source under a repository-scoped docs directory
    When the declared docs sources of each are read
    Then each yields no source
    And a path with no instance at all yields no source

  @test:scripts/tests/docs-sources.test.ts::docsSources::the_base_instance_first,_unchanged;_then_each_dependent_that_declares_one,_in_the_order_given
  Scenario: The base instance's source comes first unchanged, then each dependent that declares one, in the order given
    Given a base instance and dependents "a", "silent" and "b", where "silent" declares no docs-source
    When the docs sources are listed for the base and the dependents in that order
    Then they are "base" (marked base), "a" and "b" (not base), in that order
    And the base source reads from "docs/source" and renders into "docs"

  @test:scripts/tests/docs-sources.test.ts::docsSources::a_source_reached_twice_is_read_once
  Scenario: A docs source reached twice is read once
    Given a base instance and a dependent "a", both declaring a docs-source
    When the docs sources are listed with "a" given twice and the base given again as a dependent
    Then the sources are "base" and "a", each once

  @test:scripts/tests/docs-sources.test.ts::the_same_page_in_two_sources::every_key_above_the_base_is_qualified_by_its_instance;_the_base's_are_unchanged
  Scenario: Every page key above the base is qualified by its instance, and the base's keys are unchanged
    Given a base instance and a dependent "up", both declaring a docs-source
    When page keys are qualified by each source
    Then the base's key "guides/x" stays "guides/x"
    And the "up" key "guides/x" becomes "up/guides/x"
    And the same key "guides-x" qualifies differently in the two sources

  @test:scripts/tests/docs-sources.test.ts::the_same_page_in_two_sources::a_page_in_a_lower_and_a_higher_source:_both_kept,_one_warning_naming_both_files
  Scenario: A page in both a lower and a higher source is kept in both, with one warning naming both files
    Given the page "guides-moved" in both the base and the "up" source
    And the page "guides-only-up" in the "up" source only
    When the docs sources are listed
    Then both "base" and "up" are returned
    And exactly one warning names "guides-moved"
    And it names both "base/docs/source/guides-moved" and "up/docs/source/guides-moved" and says the move is in flight
    And no warning names "guides-only-up"

  @test:scripts/tests/docs-sources.test.ts::the_same_page_in_two_sources::two_sources_of_ONE_instance_holding_one_page:_warned,_not_refused
  Scenario: Two sources of one instance holding the same page are warned about, not refused
    Given an instance "ig" whose "docs/" and "site-docs/" both declare a docs-source holding the page "same"
    When same-page duplicates of its declared sources are warned about
    Then one duplicate is returned for page "same", naming "ig (ig/docs/source/same)" and "ig (ig/site-docs/source/same)"

  @test:scripts/tests/docs-sources.test.ts::siteNodeOf_—_where_a_page's_site_JSON-LD_is_published::a_base_page:_site/<slug>/nodes/<id>.jsonld,_in_the_base's_site_directory
  Scenario: A base page's site JSON-LD is published at site/<slug>/nodes/<id>.jsonld in the base's site directory
    Given a base source holding "process-x" and an upper source holding "process-y"
    When the site node of page "process/x" with id "n" is asked for
    Then its site path is "site/process/x/nodes/n.jsonld"
    And its file is that path under the base's output directory

  @test:scripts/tests/docs-sources.test.ts::siteNodeOf_—_where_a_page's_site_JSON-LD_is_published::a_page_above_the_base:_under_its_instance,_as_gen-site-jsonld_publishes_it_—_never_site/<instance>/…
  Scenario: A page above the base is published under its instance, never at site/<instance>/
    Given a base source holding "process-x" and an upper source holding "process-y"
    When the site node of the upper source's qualified key for "process/y" with id "n" is asked for
    Then its site path is "upper/site/process/y/nodes/n.jsonld"
    And its file is "site/process/y/nodes/n.jsonld" under the upper source's output directory

  @test:scripts/tests/docs-sources.test.ts::siteNodeOf_—_where_a_page's_site_JSON-LD_is_published::a_key_that_only_LOOKS_qualified,_naming_no_page_of_that_source,_is_the_base's
  Scenario: A key that only looks qualified, naming no page of that source, is the base's
    Given a base source holding "process-x" and an upper source holding "process-y"
    When the site node of "upper/process/x" is asked for with no id
    Then its site path is "site/upper/process/x.jsonld"

  @test:scripts/tests/docs-sources.test.ts::docsPageOf_—_the_rendered_page,_from_the_source_that_holds_it::a_page_that_moved_up_is_read_from_the_layer_that_holds_it,_under_its_qualified_key
  Scenario: A page that moved up is read from the layer that holds it, under its qualified key
    Given an upper source holding "process-y" and "process-x", and a base source holding "process-x"
    When the docs page "process/y" is looked up
    Then it comes from the upper source with key "upper/process/y"
    And its file is "process/y.md" under the upper source's output directory

  @test:scripts/tests/docs-sources.test.ts::docsPageOf_—_the_rendered_page,_from_the_source_that_holds_it::a_page_in_two_layers_(a_move_in_flight)_answers_from_the_lower_one
  Scenario: A page held by two layers during a move answers from the lower one
    Given the page "process-x" in both the base and the upper source
    When the docs page "process/x" is looked up
    Then its file is "process/x.md" under the base's output directory

  @test:scripts/tests/docs-sources.test.ts::docsPageOf_—_the_rendered_page,_from_the_source_that_holds_it::a_page_no_source_holds_is_undefined,_not_a_guessed_path
  Scenario: A page no source holds is undefined, not a guessed path
    Given base and upper sources, neither holding "process-z"
    When the docs page "process/z" is looked up
    Then the result is undefined
