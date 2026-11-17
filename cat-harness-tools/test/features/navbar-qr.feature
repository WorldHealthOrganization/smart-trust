# The navbar QR code capability in the site's assets/js/navbar-row.js, run in a sandbox
# against a mock DOM with the vendored qrcode scripts. Each Scenario names the test that executes it.
Feature: Navbar QR code button and panel

  @test:test/navbar-qr.test.ts::LHS_navbar_QR_code_capability_(bean_folio-assistant-5rmf)::mounts_the_QR_button_in_.fa-nav-icons_with_correct_accessible_attributes
  Scenario: The QR button is mounted in the navbar icons with accessible attributes
    Given the site's navbar-row.js run against a mock DOM with a "side-bar" navbar and the vendored QR scripts
    Then the navbar holds a ".fa-nav-qr" element that is a button of type "button"
    And its aria-label, title and data-fa-tip are "QR code for this page"
    And its aria-expanded is "false"
    And its content is an SVG icon

  @test:test/navbar-qr.test.ts::LHS_navbar_QR_code_capability_(bean_folio-assistant-5rmf)::places_the_.fa-qr-panel_as_a_sibling_directly_after_.fa-nav-icons
  Scenario: The QR panel sits directly after the navbar icons
    Given the site's navbar-row.js run against a mock DOM with a "side-bar" navbar and the vendored QR scripts
    Then the ".fa-qr-panel" is a child of the navbar and the next sibling of ".fa-nav-icons"
    And the panel's data-open is "false"
    And its role is "region" with aria-label "QR code for this page"

  @test:test/navbar-qr.test.ts::LHS_navbar_QR_code_capability_(bean_folio-assistant-5rmf)::toggles_the_QR_code_open_on_first_click_and_closed_on_second_click_(l4zi_reachable_inverse)
  Scenario: The QR button opens the panel on the first click and closes it on the second
    Given the site's navbar-row.js run against a mock DOM with a "side-bar" navbar and the vendored QR scripts
    And the page URL "https://example.com/folio-assistant/guides/test.html"
    When the QR button is clicked
    Then the panel's data-open and the button's aria-expanded are "true"
    And the panel shows an SVG and the page URL as its caption
    When the QR button is clicked again
    Then the panel's data-open and the button's aria-expanded are "false"

  @test:test/navbar-qr.test.ts::LHS_navbar_QR_code_capability_(bean_folio-assistant-5rmf)::closes_the_panel_when_the_panel_itself_is_clicked
  Scenario: Clicking the open panel closes it
    Given the site's navbar-row.js run against a mock DOM with a "side-bar" navbar and the vendored QR scripts
    And the QR panel opened by clicking the button
    When the panel itself is clicked
    Then the panel's data-open and the button's aria-expanded are "false"

  @test:test/navbar-qr.test.ts::LHS_navbar_QR_code_capability_(bean_folio-assistant-5rmf)::closes_the_panel_when_Escape_is_pressed
  Scenario: Pressing Escape closes the open panel
    Given the site's navbar-row.js run against a mock DOM with a "side-bar" navbar and the vendored QR scripts
    And the QR panel opened by clicking the button
    When a keydown of "Escape" is dispatched on the document
    Then the panel's data-open and the button's aria-expanded are "false"

  @test:test/navbar-qr.test.ts::LHS_navbar_QR_code_capability_(bean_folio-assistant-5rmf)::re-renders_the_QR_code_on_hashchange_when_open
  Scenario: The open panel follows a hash change
    Given the site's navbar-row.js run against a mock DOM with a "side-bar" navbar and the vendored QR scripts
    And the QR panel opened on "https://example.com/page.html"
    When the location becomes "https://example.com/page.html#section-2" and a hashchange fires
    Then the caption is "https://example.com/page.html#section-2"

  @test:test/navbar-qr.test.ts::LHS_navbar_QR_code_capability_(bean_folio-assistant-5rmf)::mounts_and_works_on_nav.fa-nav_(the_rail)
  Scenario: The QR capability mounts and toggles on the nav.fa-nav rail
    Given the site's navbar-row.js run against a mock DOM with a "nav.fa-nav" rail
    And the page URL "https://example.com/railed.html"
    Then the rail holds the QR button and the QR panel
    When the QR button is clicked
    Then the panel is open, aria-expanded is "true" and the caption is the page URL
    When the QR button is clicked again
    Then the panel is closed and aria-expanded is "false"
