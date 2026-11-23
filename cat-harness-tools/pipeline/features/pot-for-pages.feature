# pipeline/pot-for-pages.ts generates the translation templates (.pot) for site
# pages, deriving the page set from the translation gate's findings and owning
# only a locale's top-level templates. Each Scenario names the test that executes it.
Feature: Page translation templates

  @test:pipeline/pot-for-pages.test.ts::the_English_source_is_resolved_against_the_instance_root::sourceFor_is_ABSOLUTE_and_inside_the_instance
  Scenario: A page's English source path is absolute and inside the instance
    Given the harness checkout as the instance
    When the source of page "getting-started" is resolved
    Then the path is absolute
    And it starts with the instance root

  @test:pipeline/pot-for-pages.test.ts::the_English_source_is_resolved_against_the_instance_root::and_it_composes_the_DECLARED_site_root,_not_a_`docs`_literal
  Scenario: The source path is composed from the declared site directory
    Given the harness checkout as the instance
    When the source of page "x" is resolved
    Then it is the instance root, joined with the declared site directory and "x.md"

  @test:pipeline/pot-for-pages.test.ts::the_page_set_is_derived,_never_written_down::every_derived_pair_names_a_locale_and_a_page
  Scenario: Every derived locale and page pair is complete
    Given the pages the real corpus's gate says need a catalogue
    Then each pair has a non-empty locale and a non-empty page
    And no page ends in ".pot"

  @test:pipeline/pot-for-pages.test.ts::the_page_set_is_derived,_never_written_down::the_derived_set_is_a_SUBSET_of_what_the_module_owns
  Scenario: Every page that needs a catalogue is owned by the module
    Given the pages the real corpus's gate says need a catalogue
    And the locale and page pairs the module owns
    Then every needing pair is among the owned pairs

  @test:pipeline/pot-for-pages.test.ts::the_page_set_is_derived,_never_written_down::ownership_is_strictly_WIDER_than_the_trigger_set_on_the_real_corpus
  Scenario: The module owns more pairs than currently need a catalogue
    Given the real corpus
    Then the count of owned pairs is greater than the count of pairs needing a catalogue

  @test:pipeline/pot-for-pages.test.ts::the_page_set_is_derived,_never_written_down::no_pair_is_listed_twice
  Scenario: No owned pair is listed twice
    Given the locale and page pairs the module owns on the real corpus
    Then every pair is distinct

  @test:pipeline/pot-for-pages.test.ts::the_ownership_boundary_with_translate-bpmn::nothing_under_`processes/`_is_adopted
  Scenario: No template under processes/ is owned
    Given the locale and page pairs the module owns on the real corpus
    Then no page starts with "processes/"

  @test:pipeline/pot-for-pages.test.ts::the_ownership_boundary_with_translate-bpmn::and_the_real_corpus_has_such_templates_to_be_wrong_about
  Scenario: The corpus holds processes/ templates, and the plan adopts none of them
    Given the harness root's translations directory
    Then at least one locale holds a processes/ directory with a .pot template
    And no planned template path contains "processes/"

  @test:pipeline/pot-for-pages.test.ts::a_template_whose_source_is_gone_is_REPORTED::`sourceExists`_is_false_and_the_entry_survives_in_the_plan
  Scenario: A template whose source is gone stays in the plan, reported
    Given the plan for the real corpus
    Then at least one entry has no existing source
    And every such entry is marked not current

  @test:pipeline/pot-for-pages.test.ts::a_fixture_instance,_so_the_traversal_is_tested_and_not_just_the_corpus::a_locale's_top-level_.pot_is_owned_and_its_subdirectory_is_not
  Scenario: A locale's top-level template is owned and its subdirectory's is not
    Given a fixture with "translations/es/page.pot" and "translations/es/processes/proc.pot"
    When the owned pairs are listed
    Then they are exactly "es/page"
