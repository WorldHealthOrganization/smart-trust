# The subscriptions field of a layer declaration (schemas/kg/cat-harness.ts) and the
# known-substrates registry drawn by scripts/subscriptions-viz.ts.
# Each Scenario names the test that executes it.
Feature: Subscriptions to external knowledge graphs

  @test:scripts/tests/kg/kg-subscriptions.test.ts::subscriptions:_the_schema::absent_is_legal,_and_stays_absent_(not_defaulted_to_[])
  Scenario: A declaration without subscriptions is legal and stays without them
    Given a minimal declaration with no subscriptions
    When the declaration schema parses it
    Then it parses
    And subscriptions is left undefined rather than defaulted to an empty list

  @test:scripts/tests/kg/kg-subscriptions.test.ts::subscriptions:_the_schema::a_well-formed_entry_parses
  Scenario: A well-formed subscription parses
    Given a declaration subscribing to who-iris with a full SHA, one subgraph, an on-demand asset policy and one harness
    When the declaration schema parses it
    Then there are no failing paths

  @test:scripts/tests/kg/kg-subscriptions.test.ts::subscriptions:_the_schema::the_minimum_is_id_+_repository_+_ref:_choosing_nothing_is_a_legal_subscription_(all_referenced)
  Scenario: A subscription of only id, repository and ref is legal
    Given a declaration subscribing to "ihris" with only id, repository and a full SHA ref
    When the declaration schema parses it
    Then there are no failing paths

  @test:scripts/tests/kg/kg-subscriptions.test.ts::subscriptions:_the_schema::`ref`_must_be_a_FULL_SHA_—_a_branch,_a_tag_or_an_abbreviation_is_refused
  Scenario: A subscription ref must be a full lowercase SHA
    Given the who-iris subscription with ref set in turn to "main", "v1.0.0", an 11-character abbreviation and the SHA in upper case
    When the declaration schema parses each
    Then each fails only at "subscriptions.0.ref"

  @test:scripts/tests/kg/kg-subscriptions.test.ts::subscriptions:_the_schema::`repository`_is_owner/repo,_not_a_URL
  Scenario: A subscription repository is owner/repo, not a URL
    Given the who-iris subscription with repository "https://github.com/litlfred/who-iris"
    When the declaration schema parses it
    Then it fails only at "subscriptions.0.repository"

  @test:scripts/tests/kg/kg-subscriptions.test.ts::subscriptions:_the_schema::an_unknown_key_is_refused_(strict):_a_misspelt_`subgraph`_must_not_vanish
  Scenario: An unknown key in a subscription is refused
    Given the who-iris subscription with a misspelt "subgraph" key
    When the declaration schema parses it
    Then it fails only at "subscriptions.0"

  @test:scripts/tests/kg/kg-subscriptions.test.ts::subscriptions:_the_schema::an_unknown_asset_policy_is_refused
  Scenario: An unknown asset policy is refused
    Given the who-iris subscription with asset policy "some"
    When the declaration schema parses it
    Then it fails only at "subscriptions.0.assets.policy"

  @test:scripts/tests/kg/kg-subscriptions.test.ts::subscriptions:_the_schema::a_subgraph_or_harness_chosen_twice_is_refused
  Scenario: A subgraph or harness chosen twice is refused
    Given the who-iris subscription with subgraphs ["a", "a"]
    Then it fails only at "subscriptions.0.subgraphs"
    And with harnesses ["h", "h"] it fails only at "subscriptions.0.harnesses"

  @test:scripts/tests/kg/kg-subscriptions.test.ts::subscriptions:_the_schema::the_same_id_twice_is_refused
  Scenario: The same subscription id twice is refused
    Given a declaration listing the who-iris subscription twice
    When the declaration schema parses it
    Then it fails only at "subscriptions"

  @test:scripts/tests/kg/kg-subscriptions.test.ts::subscriptions:_the_schema::an_id_also_in_`needs`_is_refused:_a_subscription_is_consumed_part_by_part,_not_loaded
  Scenario: A subscription id also in needs is refused
    Given a declaration that needs "who-iris" and also subscribes to who-iris
    When the declaration schema parses it
    Then it fails only at "subscriptions.0.id"

  @test:scripts/tests/kg/kg-subscriptions.test.ts::subscriptions:_the_schema::an_id_also_in_`associatedHarnesses`_is_refused:_one_relation_per_remote_thing
  Scenario: A subscription id also in associatedHarnesses is refused
    Given a declaration associating a "who-iris" harness and also subscribing to who-iris
    When the declaration schema parses it
    Then it fails only at "subscriptions.0.id"

  @test:scripts/tests/kg/kg-subscriptions.test.ts::the_known-substrates_registry_(subscriptions-viz)::iHRIS_is_derived_as_exists,_with_its_repository_(associated,_or_subscribed_since_bean_tmo5)
  Scenario: iHRIS is derived as an existing substrate with its repository
    Given the real checkout
    When the known substrates are derived
    Then the "ihris" row has status "exists"
    And its repository is "litlfred/ihris"

  @test:scripts/tests/kg/kg-subscriptions.test.ts::the_known-substrates_registry_(subscriptions-viz)::a_hand_row_OVERRIDES_a_derived_one_by_name_(planned_->_exists)
  Scenario: A hand row overrides a derived row of the same name
    # Gap: the derived row's own status before the override is not asserted
    Given a synthetic checkout with a "staged" layer living in o/host
    And a "host" layer whose hand-entered knownSubstrates row names "staged" as existing at o/staged
    When the known substrates are derived
    Then the "staged" row has status "exists"
    And its source is "hand-entered"
    And its repository is "o/staged"

  @test:scripts/tests/kg/kg-subscriptions.test.ts::the_known-substrates_registry_(subscriptions-viz)::a_subscription_is_derived_as_exists,_titled_from_its_cached_snapshot
  Scenario: A subscription is derived as an existing substrate titled from its snapshot
    Given a synthetic checkout whose host layer subscribes to "kb" at o/kb
    And a cached kb.substrate.json snapshot titled "The KB"
    When the known substrates are derived
    Then the "kb" row has status "exists", repository "o/kb", source "subscription" and title "The KB"

  @test:scripts/tests/kg/kg-subscriptions.test.ts::the_known-substrates_registry_(subscriptions-viz)::repoFromUrl_takes_only_a_github_repository_URL
  Scenario: repoFromUrl takes only a GitHub repository URL
    When repoFromUrl reads "https://github.com/litlfred/ihris" with and without a trailing slash
    Then both give "litlfred/ihris"
    And a github.io pages URL gives nothing
    And an undefined URL gives nothing

  @test:scripts/tests/kg/kg-subscriptions.test.ts::the_known-substrates_registry_(subscriptions-viz)::a_subscription_card_draws_chosen_parts_as_NOT_YET_HELD_—_never_as_held
  Scenario: A subscription card draws chosen parts as not yet held
    Given no substrate rows and the who-iris subscription of "demo"
    When the registry is rendered
    Then the catalogue subgraph is shown as chosen, not yet held
    And the who-iris harness is shown as chosen, not yet instantiated
    And everything else the substrate offers is shown as referenced
    And no held marker "⬇" appears

  @test:scripts/tests/kg/kg-subscriptions.test.ts::the_known-substrates_registry_(subscriptions-viz)::an_empty_registry_says_so_rather_than_rendering_an_empty_table
  Scenario: An empty registry says so rather than rendering an empty table
    When the registry is rendered with no rows and no subscriptions
    Then it contains "_No substrate is known"
