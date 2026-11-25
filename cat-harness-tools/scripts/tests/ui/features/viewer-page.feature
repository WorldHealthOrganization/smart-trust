# scripts/viewer-page.ts is the common fixture of standalone viewer pages (navbar opt-out, site
# position, narrow-viewport rules, saved scheme), and scripts/check-viewer-nav.ts audits and gates
# their rails. Each Scenario names the test that executes it.
Feature: Viewer page fixture and navbar audit

  @test:scripts/tests/ui/viewer-page.test.ts::the_opt-out_is_a_declaration_in_the_page::the_marker_this_module_documents_is_the_marker_it_reads
  Scenario: The documented opt-out marker is the one that is read
    Given a page whose head carries the navbar opt-out marker
    When it is asked whether it declines the navbar
    Then it does

  @test:scripts/tests/ui/viewer-page.test.ts::the_opt-out_is_a_declaration_in_the_page::attribute_order_does_not_decide_it
  Scenario: Attribute order does not decide an opt-out
    Given a page with a "folio-navbar" meta whose content "none" comes before its name
    When it is asked whether it declines the navbar
    Then it does

  @test:scripts/tests/ui/viewer-page.test.ts::the_opt-out_is_a_declaration_in_the_page::a_page_that_says_nothing_has_not_declined
  Scenario: A page that says nothing has not declined
    Given a page with only an h1 and no folio-navbar meta
    When it is asked whether it declines the navbar
    Then it does not

  @test:scripts/tests/ui/viewer-page.test.ts::the_opt-out_is_a_declaration_in_the_page::a_DIFFERENT_folio-navbar_value_is_not_a_decline
  Scenario: A different folio-navbar value is not a decline
    Given a page with a "folio-navbar" meta of content "auto"
    When it is asked whether it declines the navbar
    Then it does not

  @test:scripts/tests/ui/viewer-page.test.ts::which_pages_are_in_the_family::a_standalone_document_is
  Scenario: A standalone document is in the viewer-page family
    Given a full HTML document
    Then it is a standalone page

  @test:scripts/tests/ui/viewer-page.test.ts::which_pages_are_in_the_family::a_Jekyll_source_page_is_NOT
  Scenario: A Jekyll source page is not in the viewer-page family
    Given a markdown page with front matter
    Then it is not a standalone page

  @test:scripts/tests/ui/viewer-page.test.ts::where_the_page_thinks_it_is::a_page_at_the_root_goes_nowhere_to_reach_the_root
  Scenario: A page at the site root goes nowhere to reach the root
    Given a page at the site root's index.html
    Then its path to the root is "."
    And its site path is "/"

  @test:scripts/tests/ui/viewer-page.test.ts::where_the_page_thinks_it_is::depth_is_counted_in_directories,_not_segments
  Scenario: Depth to the root is counted in directories, not segments
    Given pages at "beans/index.html" and "cat-harness/library/agent-skills/index.html"
    Then their paths to the root are ".." and "../../.."
    And the deeper page's site path is "/cat-harness/library/agent-skills/"

  @test:scripts/tests/ui/viewer-page.test.ts::the_audit_records_a_verdict_per_page::three_verdicts,_and_the_Jekyll_source_page_is_not_one_of_them
  Scenario: The audit gives three verdicts and skips the Jekyll source page
    Given a site with a railed page, a declined page, an unwired page and a Jekyll source page
    When the site is audited
    Then the totals are 3 pages, 1 railed, 1 declined, 0 linked, 1 missing and 1 flagged
    And the pages are "/declined/", "/railed/" and "/unwired/"

  @test:scripts/tests/ui/viewer-page.test.ts::the_audit_records_a_verdict_per_page::everything_but_`railed`_carries_a_reason
  Scenario: Every verdict but railed carries a reason
    Given the same audited site
    Then a railed page has no reason
    And every other page has one

  @test:scripts/tests/ui/viewer-page.test.ts::the_audit_records_a_verdict_per_page::pages_are_sorted,_so_the_committed_diff_is_about_the_change
  Scenario: Audited pages are sorted
    Given the same audited site
    Then the page paths are already in sorted order

  @test:scripts/tests/ui/viewer-page.test.ts::the_gate_refuses_a_REGRESSION,_not_an_absence::railed_→_missing_is_the_regression_the_gate_exists_for
  Scenario: A railed page going missing is a regression
    Given a page "/a/" railed before and missing now
    When regressions are sought
    Then there is one, naming "/a/"

  @test:scripts/tests/ui/viewer-page.test.ts::the_gate_refuses_a_REGRESSION,_not_an_absence::railed_→_declined_is_ALSO_a_regression
  Scenario: A railed page being declined is also a regression
    Given a page "/a/" railed before and declined now
    When regressions are sought
    Then there is one

  @test:scripts/tests/ui/viewer-page.test.ts::the_gate_refuses_a_REGRESSION,_not_an_absence::a_NEW_page_with_no_rail_is_not_a_regression
  Scenario: A new page with no rail is not a regression
    Given "/a/" railed before, and now "/a/" railed with a new "/b/" missing
    When regressions are sought
    Then there are none

  @test:scripts/tests/ui/viewer-page.test.ts::the_gate_refuses_a_REGRESSION,_not_an_absence::a_page_that_was_never_railed_and_still_is_not_is_not_a_regression
  Scenario: A page never railed and still not railed is not a regression
    Given "/a/" missing before and now
    When regressions are sought
    Then there are none

  @test:scripts/tests/ui/viewer-page.test.ts::the_gate_refuses_a_REGRESSION,_not_an_absence::a_page_that_GAINS_a_rail_is_not_a_regression
  Scenario: A page that gains a rail is not a regression
    Given "/a/" missing before and railed now
    When regressions are sought
    Then there are none

  @test:scripts/tests/ui/viewer-page.test.ts::the_gate_refuses_a_REGRESSION,_not_an_absence::a_railed_page_that_DISAPPEARS_is_not_reported_here
  Scenario: A railed page that disappears is not reported as a regression
    Given "/a/" railed before and absent now
    When regressions are sought
    Then there are none

  @test:scripts/tests/ui/viewer-page.test.ts::the_narrow-viewport_rules_ride_on_the_fixture_—_bean_`2r2n`::inlined_into_the_head,_from_the_one_file_the_themed_pages_link
  Scenario: The narrow-viewport rules are inlined into the head from the themed pages' file
    Given a page holding a table
    When the narrow-viewport rules are added
    Then its head contains the whole of "assets/css/narrow-viewport.css"

  @test:scripts/tests/ui/viewer-page.test.ts::the_narrow-viewport_rules_ride_on_the_fixture_—_bean_`2r2n`::idempotent:_a_second_pass_adds_nothing
  Scenario: Adding the narrow-viewport rules twice adds nothing
    Given a page with the narrow-viewport rules added once
    When they are added again
    Then the page is unchanged

  @test:scripts/tests/ui/viewer-page.test.ts::the_narrow-viewport_rules_ride_on_the_fixture_—_bean_`2r2n`::the_rules_keep_wide_content_in_its_own_box,_never_the_page
  Scenario: The narrow-viewport rules keep wide content in its own box
    # Gap: only the stylesheet text is checked, not how a page lays out
    Given the narrow-viewport stylesheet
    Then it contains "overflow-x: auto" and a "max-width: 799.98px" query
    And it excludes ".table-wrapper > table" and ".fa-nav table"

  @test:scripts/tests/ui/viewer-page.test.ts::the_reader's_saved_scheme_reaches_a_standalone_viewer_—_bean_`dc64`::the_key_is_the_one_docs-ui.js_stores_the_scheme_under
  Scenario: The scheme key is the one docs-ui.js stores the scheme under
    Given the site's "assets/js/docs-ui.js"
    Then it declares "SCHEME_KEY" with the same key the fixture uses

  @test:scripts/tests/ui/viewer-page.test.ts::the_reader's_saved_scheme_reaches_a_standalone_viewer_—_bean_`dc64`::a_script_in_the_HEAD_decides_the_scheme_before_first_paint_—_stored,_else_the_OS,_else_light_(2026-10-15)
  Scenario: A head script decides the scheme before first paint
    # Gap: the script's text is checked, not its run in a browser
    Given a page with the saved-scheme script added
    Then its head reads the scheme key from localStorage
    And it defaults to "light"
    And it consults "(prefers-color-scheme: dark)"
    And it sets the "data-fa-scheme" attribute

  @test:scripts/tests/ui/viewer-page.test.ts::the_reader's_saved_scheme_reaches_a_standalone_viewer_—_bean_`dc64`::idempotent:_a_second_pass_adds_nothing
  Scenario: Adding the saved-scheme script twice adds nothing
    Given a page with the saved-scheme script added once
    When it is added again
    Then the page is unchanged
