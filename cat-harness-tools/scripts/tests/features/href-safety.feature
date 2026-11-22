# Source checks that every href rendered by the site client (docs-ui.js), the navbar row script
# (navbar-row.js) and scripts/todo-listing.ts goes through safeHref from schemas/ui/safe-url.ts.
# Each Scenario names the test that executes it.
Feature: Every rendered href goes through the scheme check

  @test:scripts/tests/href-safety.test.ts::every_href_in_the_client_goes_through_the_check::there_ARE_href_sites,_so_this_is_not_vacuous
  Scenario: The client has href sites, so the check is not vacuous
    Given the source of the site client docs-ui.js
    When its href sites are collected, ignoring comment lines
    Then there are more than 3

  @test:scripts/tests/href-safety.test.ts::every_href_in_the_client_goes_through_the_check::each_one_calls_`safeHref`,_or_renders_a_value_that_came_from_it
  Scenario: Every client href calls safeHref or renders a value bound from it
    Given the source of the site client docs-ui.js
    When each href site is examined
    Then every site either mentions safeHref or ALLOWED_URL_SCHEMES, carries an href-safe exemption with a reason, or renders a variable assigned from safeHref
    And there are no offending lines

  @test:scripts/tests/href-safety.test.ts::every_href_in_the_client_goes_through_the_check::every_exemption_is_listed_here,_so_adding_one_is_a_visible_change
  Scenario: The client's href exemptions are pinned to a known list
    Given the source of the site client docs-ui.js
    When the href sites carrying an href-safe exemption are collected
    Then the only one is the download link built with "href: url, download: name"

  @test:scripts/tests/href-safety.test.ts::every_href_in_the_client_goes_through_the_check::the_client's_allow-list_is_the_same_list_as_the_model's
  Scenario: The client's allow-list is the model's allow-list
    Given the source of the site client docs-ui.js
    And the model's ALLOWED_URL_SCHEMES from the safe-url module, which is not empty
    Then the client declares an ALLOWED_URL_SCHEMES list
    And the client's list is the model's list, in the same order

  @test:scripts/tests/href-safety.test.ts::every_href_in_the_navbar_row's_own_script_goes_through_the_check::there_IS_an_href_site
  Scenario: The navbar row script has an href site
    Given the source of the navbar row script navbar-row.js
    When its href sites are collected
    Then there is at least one

  @test:scripts/tests/href-safety.test.ts::every_href_in_the_navbar_row's_own_script_goes_through_the_check::each_one_renders_a_value_`safeHref`_returned,_with_no_exemption
  Scenario: Every navbar row href renders a value from safeHref, with no exemption allowed
    Given the source of the navbar row script navbar-row.js
    When each href site is examined
    Then every site either mentions safeHref or ALLOWED_URL_SCHEMES or renders a variable assigned from safeHref
    And there are no offending lines

  @test:scripts/tests/href-safety.test.ts::every_href_in_the_navbar_row's_own_script_goes_through_the_check::its_allow-list_is_the_client's,_scheme_for_scheme
  Scenario: The navbar row's allow-list matches the client's
    Given the sources of navbar-row.js and docs-ui.js
    When each one's ALLOWED_URL_SCHEMES list is read
    Then the two lists are equal scheme for scheme
    And the navbar row's list is not empty

  @test:scripts/tests/href-safety.test.ts::every_href_in_the_server-rendered_listing_goes_through_the_check::there_ARE_href_sites
  Scenario: The server-rendered listing has href sites
    Given the source of scripts/todo-listing.ts
    When its href sites are collected
    Then there are more than 1

  @test:scripts/tests/href-safety.test.ts::every_href_in_the_server-rendered_listing_goes_through_the_check::each_one_renders_a_value_`safeHref`_returned
  Scenario: Every listing href emits a variable bound from safeHref
    # Gap: href sites not of the escaped-variable anchor shape are skipped
    Given the source of scripts/todo-listing.ts
    When each href site emitting an escaped variable into an anchor is examined
    Then that variable is declared with const or let from a safeHref call

  @test:scripts/tests/href-safety.test.ts::every_href_in_the_server-rendered_listing_goes_through_the_check::`escapeHtml`_is_never_the_only_thing_between_input_and_an_href
  Scenario: The listing never escapes a raw item href straight into an anchor
    # Gap: only item.* and r.* href fields are matched
    Given the source of scripts/todo-listing.ts
    Then it has no anchor whose href is escapeHtml of an item's or row's href field directly

  @test:scripts/tests/href-safety.test.ts::the_check_refuses_what_the_schemas_permit::a_scheme_no_list_allows_never_reaches_a_link
  Scenario: safeHref refuses schemes no list allows
    When safeHref is given "javascript:alert(1)", "data:text/html,x", a tab-prefixed "javascript:x" and "//evil"
    Then each returns undefined
