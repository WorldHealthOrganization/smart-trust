# scripts/lib/ig-render-row.ts: finds where a FHIR IG render sits on the site and adds a "[fhir]"
# row linking its index page to the rail's Harnesses list. Each Scenario names the test that executes it.
Feature: The IG render row in the rail

  @test:scripts/tests/ig-render-row.test.ts::where_the_IG_render_is::an_IG_repository's_own_site:_the_root,_when_it_holds_the_IG's_toc
  Scenario: On an IG repository's own site the render is the root when the root holds the toc
    Given a site holding index.html and toc.html at its root
    When the IG render directory is found for owner "acme" at the root
    Then it is the empty path

  @test:scripts/tests/ig-render-row.test.ts::where_the_IG_render_is::prefers_ig/_over_the_root,_since_the_root_is_then_the_instance's_own_pages
  Scenario: On an IG repository's own site ig/ is preferred over the root
    Given a site holding index.html and toc.html both at its root and under ig/
    When the IG render directory is found for owner "acme" at the root
    Then it is "ig/"

  @test:scripts/tests/ig-render-row.test.ts::where_the_IG_render_is::on_the_platform's_site:_<owner>/ig/_then_<owner>/
  Scenario: On the platform's site the render is <owner>/ig/, else <owner>/
    Given a site holding acme/index.html and acme/toc.html
    When the IG render directory is found for owner "acme" not at the root
    Then it is "acme/"
    And with acme/ig/index.html and acme/ig/toc.html also present it is "acme/ig/"

  @test:scripts/tests/ig-render-row.test.ts::where_the_IG_render_is::no_toc_beside_the_index_is_no_render:_a_folio's_landing_is_not_an_IG
  Scenario: An index with no toc beside it is no IG render
    Given a site holding index.html and ig/index.html with no toc
    When the IG render directory is found for owner "acme" at the root
    Then there is none

  @test:scripts/tests/ig-render-row.test.ts::the_row::goes_right_after_the_owner's_row_and_links_the_render's_index.html
  Scenario: The row follows the owner's row and links the render's index.html
    Given rail rows "SMART Base", "Acme IG" and "FHIR IG Harness"
    And a site rendering the IG at its root
    When the IG render row is added for owner label "Acme IG" with root path ".."
    Then the labels are "SMART Base", "Acme IG", "[fhir]", "FHIR IG Harness"
    And the new row links "../index.html" with the IG render glyph and tone

  @test:scripts/tests/ig-render-row.test.ts::the_row::goes_first_when_no_row_carries_the_owner's_label
  Scenario: The row goes first when no row carries the owner's label
    Given rail rows with no owner label given
    And a site rendering the IG under acme/ig/
    When the IG render row is added for owner "acme" with root path "."
    Then the first row is "[fhir]" linking "./acme/ig/index.html"

  @test:scripts/tests/ig-render-row.test.ts::the_row::is_absent_when_the_site_renders_no_IG_for_the_owner
  Scenario: No row is added when the site renders no IG for the owner
    Given a site holding only index.html
    When the IG render row is added
    Then the rows are unchanged

  @test:scripts/tests/ig-render-row.test.ts::the_row::wears_the_flame_mark,_a_24x24_path_the_rail_strokes
  Scenario: The row wears the flame glyph, a closed path, and the IG tone
    # Gap: the 24x24 view box and the rail's stroking are not checked
    Given a site rendering the IG at its root
    When the IG render row is added
    Then the row's glyph path is the IG render glyph
    And it is an SVG path starting with "M" made of closed subpaths
    And its tone is the IG render tone

  @test:scripts/tests/ig-render-row.test.ts::the_row::is_added_once
  Scenario: The row is added only once
    Given a site rendering the IG at its root
    When the IG render row is added twice over
    Then exactly one row is labelled "[fhir]"
