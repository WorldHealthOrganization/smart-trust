# scripts/gen-document-kinds-viz.ts draws the document-kinds viewer: one themed page per instance
# declaring a document-kinds directory, showing what each kind declares and refusing an invalid one.
# Each Scenario names the test that executes it.
Feature: Document kinds viewer

  @test:scripts/tests/document-kinds-viz.test.ts::an_invalid_kind_is_refused,_not_drawn::throws_naming_the_file
  Scenario: An invalid document kind is refused with an error naming its file
    Given a scratch instance with a document-kinds directory "kinds/"
    And it holds "bad.json", a fixed kind with no sections
    When the document kinds of the checkout are read
    Then reading throws an error naming "bad.json"

  @test:scripts/tests/document-kinds-viz.test.ts::the_page_is_THEMED,_so_it_carries_the_site's_top_band_(2026-10-07)::is_on_the_default_layout,_not_a_standalone_document
  Scenario: The viewer page is on the default layout, not a standalone document
    Given the viewer page drawn for "scratch" with no kinds
    Then it starts with front matter "layout: default"
    And its title is "Document kinds — scratch"
    And it carries no doctype, html, head or body tag
    And it has the heading with id "dk-title"

  @test:scripts/tests/document-kinds-viz.test.ts::the_page_is_THEMED,_so_it_carries_the_site's_top_band_(2026-10-07)::styles_nothing_outside_its_own_wrapper
  Scenario: The viewer page styles nothing outside its own wrapper
    Given the viewer page drawn for "scratch" with no kinds
    When its style selectors are checked against the ".dk-page" wrapper
    Then no selector is unscoped

  @test:scripts/tests/document-kinds-viz.test.ts::every_instance_declaring_a_document-kinds_directory_gets_a_page_(fa#2739)::draws_a_subject_with_no_kind_of_its_own
  Scenario: A subject with no kind of its own still gets a page
    Given a kind "dak" in instance "base" reporting coverage of "ig"
    And document-kinds directories in "base", "ig" and "empty"
    When the subject entries are built
    Then the subjects with pages are "base", "empty" and "ig"

  @test:scripts/tests/document-kinds-viz.test.ts::every_instance_declaring_a_document-kinds_directory_gets_a_page_(fa#2739)::shows_a_subject_the_kinds_it_reports_coverage_of
  Scenario: A subject's page shows the kinds that report coverage of it
    Given a kind "dak" in instance "base" reporting coverage of "ig"
    When the subject entries are built
    Then the "ig" page lists the kind "dak"
    And the "empty" page lists no kind

  @test:scripts/tests/document-kinds-viz.test.ts::every_instance_declaring_a_document-kinds_directory_gets_a_page_(fa#2739)::says_why_an_empty_subject's_page_is_empty
  Scenario: An empty subject's page says why it is empty
    When the viewer page is drawn for "empty" with no kinds
    Then it says "empty declares a document-kinds directory, and it holds no kind or coverage report yet."
