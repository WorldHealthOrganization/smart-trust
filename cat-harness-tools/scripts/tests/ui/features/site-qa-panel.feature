# scripts/site-qa-panel.ts shows a site's build QA reports (assets/site-qa/parity.json, build.json,
# links.json) on its QA pages, read in the browser. Each Scenario names the test that executes it.
Feature: A site's QA page shows what its build published with

  @test:scripts/tests/ui/site-qa-panel.test.ts::which_pages_carry_the_panel::a_QA_visualiser's_own_page_and_its_page_for_the_site's_layer,_no_other
  Scenario: A QA visualiser's own page and the site's own layer page carry the panel
    Given expected pages for a qa visualiser with pages for layer-a and layer-b, and a beans page
    Then for the site's layer layer-a the routes are the qa page and its layer-a page
    And with no own layer only the qa page
    And with no qa visualiser none

  @test:scripts/tests/ui/site-qa-panel.test.ts::which_pages_carry_the_panel::the_path_up_to_the_site_root_is_relative,_one_step_per_route_segment
  Scenario: The path to the site root is relative, one step per segment
    Then "en/cat-harness/qa/layer-a/" goes up "../../../.."
    And "qa/" goes up ".."
    And the site root itself is "."

  @test:scripts/tests/ui/site-qa-panel.test.ts::adding_the_panel::it_goes_before_</body>,_once,_reading_the_reports_relative_to_the_page
  Scenario: The panel goes before the closing body tag once
    Given a QA page at "en/qa/"
    When the panel is added
    Then it sits before </body> and reads "../../assets/site-qa"
    And adding it again leaves the page unchanged

  @test:scripts/tests/ui/site-qa-panel.test.ts::adding_the_panel::it_holds_nothing_Liquid_would_evaluate,_and_links_the_reports_for_a_reader_without_JavaScript
  Scenario: The panel holds no Liquid and links the reports without JavaScript
    Then the panel holds no "{{" and no "{%"
    And it links "../assets/site-qa/parity.json" for a reader without JavaScript

  @test:scripts/tests/ui/site-qa-panel.test.ts::adding_the_panel::only_pages_the_site_holds_are_changed;_a_missing_route_is_not_created
  Scenario: Only pages the site holds get the panel
    Given a built site holding "en/qa/" and not "en/qa/missing/"
    When the panel is placed on both
    Then only "en/qa/" is reported and changed

  @test:scripts/tests/ui/site-qa-panel.test.ts::the_panel's_script::reads_the_three_reports_from_the_page's_relative_path
  Scenario: The script reads the three reports relative to the page
    When the script runs on a page whose reports are at "../../assets/site-qa"
    Then it fetches parity.json, build.json and links.json there

  @test:scripts/tests/ui/site-qa-panel.test.ts::the_panel's_script::draws_each_shortfall,_the_findings_grouped_by_check,_and_the_links
  Scenario: The script draws the shortfall, the findings by check and the links
    Given a parity report lacking the icon row with one ruling, three findings and one unresolved link
    When the script runs
    Then it names the icon row shortfall and the ruling
    And it groups the findings as "coverage (2)" and "inline-scripts (1)"
    And it counts and lists the unresolved link

  @test:scripts/tests/ui/site-qa-panel.test.ts::the_panel's_script::a_build_that_lost_nothing,_and_published_with_nothing_to_report,_says_so
  Scenario: A clean build says so
    Given a parity report that carries everything and a build report with no findings
    When the script runs
    Then it says the build carries everything and published with nothing to report

  @test:scripts/tests/ui/site-qa-panel.test.ts::the_panel's_script::a_missing_report_is_unknown,_not_zero,_and_says_why_it_may_be_missing
  Scenario: A missing report is unknown, not zero
    Given only the link report is present
    When the script runs
    Then parity.json and build.json are each said to be missing, with the likely reason, and unknown, not zero
    And it never says "No findings"

  @test:scripts/tests/ui/site-qa-panel.test.ts::the_panel's_script::an_unreachable,_failing,_malformed_or_foreign_report_is_unknown,_not_zero
  Scenario: An unreachable, failing, malformed or foreign report is unknown, not zero
    Given parity.json unreachable, build.json answering HTTP 500 and links.json not JSON
    When the script runs
    Then each is said, with its reason, to be unknown, not zero
    And a parity.json of another schema is said not to be a site-parity-report/v1
