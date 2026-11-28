# scripts/ensure-landing-sticky.ts run from a separated instance's own repository composes that instance's landing:
# it declares the instance's folio graph and writes its own card, and writes nothing into a remote-mounted layer.
# Each Scenario names the test that executes it.
Feature: Landing stickies from a separated instance with a mounted layer

  @test:scripts/tests/ensure-landing-sticky-mounted.test.ts::ensureLandingSticky_from_a_separated_instance's_own_repository::the_fixture's_layer_really_reads_as_mounted_(not_vacuous)
  Scenario: The fixture's base layer reads as mounted
    Given a downstream instance "down" that needs a remote-mounted layer "base" recorded in index.lock.json
    When the mounted instance roots are read
    Then exactly "base" is mounted

  @test:scripts/tests/ensure-landing-sticky-mounted.test.ts::ensureLandingSticky_from_a_separated_instance's_own_repository::--check_counts_the_instance's_own_missing_card_and_folio_graph,_never_the_mounted_layer's
  Scenario: A check counts the instance's own missing card and folio graph, not the mounted layer's
    Given the downstream instance "down" over the mounted layer "base", each with one card
    When the landing stickies are checked
    Then the folio graph declaration is reported as "added"
    And the "down" card is reported as "written" and is not marked mounted
    And the "base" card is marked mounted

  @test:scripts/tests/ensure-landing-sticky-mounted.test.ts::ensureLandingSticky_from_a_separated_instance's_own_repository::a_run_declares_the_instance's_folio_graph_and_writes_its_card,_and_writes_nothing_into_the_mount
  Scenario: A run declares the folio graph and writes the instance's card, but nothing into the mount
    Given the downstream instance "down" over the mounted layer "base"
    When the landing stickies are ensured
    Then down.json declares a "folio/" directory with the "folio" graph typology
    And "folio/down.json" exists
    And neither "base/folio/base.json" nor "folio/base.json" exists
    And a following check reports the folio declaration "already" and no unmounted card needing work

  @test:scripts/tests/ensure-landing-sticky-mounted.test.ts::ensureLandingSticky_from_a_separated_instance's_own_repository::the_CLI_composes_the_instance_it_is_GIVEN,_not_the_one_it_sits_in
  Scenario: The CLI composes the instance root it is given
    Given the downstream instance "down" over the mounted layer "base"
    When the script is run with that root and "--check"
    Then it exits 1 and its stderr says "folio/down.json is missing" and never mentions "base.json"
    When the script is run with that root
    Then it exits 0 and its stdout says "base mounted"
    And a following "--check" exits 0
    And "--check" on a root that does not exist exits 2
