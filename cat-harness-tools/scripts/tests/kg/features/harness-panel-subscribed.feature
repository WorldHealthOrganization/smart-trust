# scripts/harness-panel.ts: the Harnesses panel's Subscribed remote group lists harnesses a KG subscription
# reaches that this checkout has not instantiated. Each Scenario names the test that executes it.
Feature: The Harnesses panel lists subscribed remote harnesses

  @test:scripts/tests/kg/harness-panel-subscribed.test.ts::the_panel's_Subscribed_↗_remote_group::a_subscribed,_not-chosen_harness_is_listed_from_its_snapshot,_with_its_pin
  Scenario: A subscribed, not-chosen harness is listed from its snapshot with its pin
    Given a temporary checkout "host" subscribed to "litlfred/ihris-kb" at a pinned sha through an offline fetcher
    And the subscription chooses no harnesses and carries the note "The iHRIS folio."
    When the panel is built for the instantiated host
    Then the subscribed group holds exactly one row "ihris-kb" titled "iHRIS Knowledge Base"
    And the row has repository "litlfred/ihris-kb", ref the pinned sha, and a GitHub tree url at that sha
    And the row has editHref "https://github.com/litlfred/ihris-kb", subscription "ihris-kb", chosen false, the note and declaredBy "host"
    And the associated group is empty
    And no finding mentions a subscription

  @test:scripts/tests/kg/harness-panel-subscribed.test.ts::the_panel's_Subscribed_↗_remote_group::a_chosen_harness_not_yet_instantiated_is_listed,_and_marked_chosen
  Scenario: A chosen harness not yet instantiated is listed and marked chosen
    Given a temporary checkout "host" subscribed to "litlfred/ihris-kb" at a pinned sha through an offline fetcher
    And the subscription chooses the harness "ihris-kb"
    When the panel is built
    Then the subscribed group is exactly "ihris-kb" with chosen true

  @test:scripts/tests/kg/harness-panel-subscribed.test.ts::the_panel's_Subscribed_↗_remote_group::once_instantiated_it_leaves_the_group:_it_is_a_tile_of_its_own_then
  Scenario: An instantiated harness leaves the subscribed group
    Given a temporary checkout "host" subscribed to "litlfred/ihris-kb" at a pinned sha through an offline fetcher
    And the subscription chooses the harness "ihris-kb"
    When "ihris-kb" is instantiated into the host from that subscription
    Then the instantiation succeeds
    And the panel's subscribed group is empty

  @test:scripts/tests/kg/harness-panel-subscribed.test.ts::the_panel's_Subscribed_↗_remote_group::a_harness_that_is_local_is_not_listed_as_subscribed
  Scenario: A harness that is local is not listed as subscribed
    Given a temporary checkout "host" subscribed to "litlfred/ihris-kb" at a pinned sha through an offline fetcher
    And a local, not-instantiated harness named "ihris-kb" sits beside the host
    When the panel is built over both harnesses
    Then the subscribed group is empty

  @test:scripts/tests/kg/harness-panel-subscribed.test.ts::the_panel's_Subscribed_↗_remote_group::an_unreadable_snapshot_is_still_a_row,_plus_a_finding,_never_silence
  Scenario: An unreadable snapshot still gives a row plus a finding
    Given a temporary checkout "host" subscribed to "litlfred/ihris-kb" at a pinned sha through an offline fetcher
    And the snapshot file "subscriptions/ihris-kb.substrate.json" is removed
    When the panel is built
    Then the subscribed group is exactly "ihris-kb"
    And a finding starts with "host: subscription `ihris-kb`" and mentions "kg:subscribe"

  @test:scripts/tests/kg/harness-panel-subscribed.test.ts::the_panel's_Subscribed_↗_remote_group::no_subscriptions:_an_empty_group
  Scenario: No harnesses gives an empty subscribed group
    Given no harnesses at all
    When the panel is built over "/nowhere"
    Then the subscribed group is empty
