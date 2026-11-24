# scripts/lib/pin-links.ts: rewrites GitHub links at a layer's pinned commit to HEAD, tagged
# with their mount, and a browser script restores the pin from pins.json at view time.
# Each Scenario names the test that executes it.
Feature: Pin-free links resolved in the browser

  @test:scripts/tests/ui/pin-links.test.ts::unpinHtml::makes_a_link_at_a_pin_pin-free_and_names_its_mount
  Scenario: A link at a pin becomes pin-free and names its mount
    Given pins for folio-assistant-core and the checkout itself
    When a blob link to folio-assistant-core at its pinned commit is unpinned
    Then one link is counted
    And the link points at HEAD and carries data-fa-pin "folio-assistant-core"

  @test:scripts/tests/ui/pin-links.test.ts::unpinHtml::handles_the_checkout's_own_commit,_tree_URLs_and_src
  Scenario: The checkout's own commit, tree URLs and src attributes are unpinned
    Given pins for folio-assistant-core and the checkout itself
    When a tree link and an img src at the checkout's own commit are unpinned
    Then two links are counted
    And the tree href points at HEAD with data-fa-pin "."
    And the img src points at HEAD with data-fa-pin "."

  @test:scripts/tests/ui/pin-links.test.ts::unpinHtml::a_link_at_another_commit_stays,_and_so_does_a_pin's_commit_in_another_repository
  Scenario: Links at another commit or in another repository are left alone
    Given a folio-assistant-core link at an unpinned commit and a cat-harness link at core's pinned commit
    When the HTML is unpinned
    Then the HTML is unchanged and the count is 0

  @test:scripts/tests/ui/pin-links.test.ts::unpinHtml::is_idempotent
  Scenario: Unpinning is idempotent
    Given HTML already unpinned once
    When it is unpinned again
    Then it is unchanged and the count is 0

  @test:scripts/tests/ui/pin-links.test.ts::the_browser_side::pinnedHref_puts_the_pin_back,_and_leaves_an_unknown_key_alone
  Scenario: pinnedHref puts the pin back and leaves an unknown key alone
    Given the pins as JSON
    Then the JSON maps "." to the checkout commit and "folio-assistant-core" to the core commit
    And a HEAD link keyed folio-assistant-core resolves to the core commit
    And a HEAD link keyed "nope" is returned unchanged

  @test:scripts/tests/ui/pin-links.test.ts::the_browser_side::the_browser_script_and_pinnedHref_agree
  Scenario: The browser script and pinnedHref agree
    Given the browser script's faPinnedHref evaluated from its source
    When it and pinnedHref resolve a core blob link, a self tree link, a HEADER path and an unknown key
    Then both give the same address for every case
    And a self HEAD blob link resolves to an address containing the checkout commit

  @test:scripts/tests/ui/pin-links.test.ts::the_browser_side::the_script_tag_is_relative,_so_a_staging_preview_reads_its_own_pins
  Scenario: The pin script tag is relative to the page
    Given the page "index.html"
    Then its script tag loads the pin script and pins file with no prefix, deferred
    And for "docs/cat-harness/start/es/x.html" both paths are prefixed with four "../"

  @test:scripts/tests/ui/pin-links.test.ts::unpinSite::rewrites_the_pages,_adds_the_script_once,_and_writes_pins.json_and_the_script
  Scenario: unpinSite rewrites pages, adds the script once and writes pins.json and the script
    Given a site with docs/a.html holding a pinned core link and b.html with nothing pinned
    When the site is unpinned
    Then 1 page and 1 link are reported
    And docs/a.html carries data-fa-pin "folio-assistant-core" and exactly one data-fa-pins script before the closing body tag
    And b.html is unchanged
    And pins.json holds the pins JSON and the pin script file holds the browser script
    And a second pass reports 0 pages and 0 links

  @test:scripts/tests/ui/pin-links.test.ts::unpinSite::a_re-pin_leaves_the_page_bytes_the_same_and_changes_pins.json_only
  Scenario: A re-pin leaves page bytes the same and changes only pins.json
    Given one site whose page links core at the old pin and another whose page links it at the new pin
    When each is unpinned with its own pins
    Then the two pages are byte-identical
    And the two pins.json files differ

  @test:scripts/tests/ui/pin-links.test.ts::unpinSite::writes_no_file_when_no_page_carries_a_pinned_link
  Scenario: No file is written when no page carries a pinned link
    Given a site whose only page has no pinned link
    When the site is unpinned
    Then 0 pages and 0 links are reported
    And no pins.json is written
