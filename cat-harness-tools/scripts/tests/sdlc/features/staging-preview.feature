# schemas/sdlc/staging-preview.ts creates, enriches, retires and round-trips the
# staging-preview node, a kind of fsh-guts trashcan node, and pins the trashcan
# limits that shaped it. Each Scenario names the test that executes it.
Feature: The staging-preview node

  @test:scripts/tests/sdlc/staging-preview.test.ts::createStagingPreview::is_a_valid_fsh-guts_node,_so_generic_trashcan_readers_keep_working
  Scenario: A created staging preview is a valid fsh-guts node
    Given deploy facts for slug "claude-sleepy-babbage-ls90iz"
    When a staging preview is created from them
    Then it satisfies the fsh-guts node schema
    And its $schema is the fsh-guts schema id
    And its kind is the staging-preview kind

  @test:scripts/tests/sdlc/staging-preview.test.ts::createStagingPreview::carries_the_facts_only_the_deploy_knows
  Scenario: A created staging preview carries the deploy's PR, issue and branch
    Given deploy facts with PR 435, issue 223 and branch "claude/sleepy-babbage-ls90iz"
    When a staging preview is created from them
    Then its staging block holds PR 435, issue 223 and that branch

  @test:scripts/tests/sdlc/staging-preview.test.ts::createStagingPreview::movedFrom_is_the_URL_it_was_served_from,_when_the_host_is_known
  Scenario: movedFrom is the preview URL when the host is known
    Given deploy facts with host "https://litlfred.github.io/folio-assistant"
    When a staging preview is created from them
    Then movedFrom is "https://litlfred.github.io/folio-assistant/branches/claude-sleepy-babbage-ls90iz/"

  @test:scripts/tests/sdlc/staging-preview.test.ts::createStagingPreview::a_deploy_that_cannot_determine_its_host_says_nothing_rather_than_guessing_gh-pages
  Scenario: A deploy with no host leaves movedFrom unset
    Given deploy facts with the host removed
    When a staging preview is created from them
    Then movedFrom is undefined

  @test:scripts/tests/sdlc/staging-preview.test.ts::createStagingPreview::no_observation_until_a_sweep_has_looked
  Scenario: A new staging preview has no observation
    When a staging preview is created from the deploy facts
    Then its staging block has no observed entry

  @test:scripts/tests/sdlc/staging-preview.test.ts::enrichStagingPreview::adds_what_only_the_sweep_can_measure,_keeping_the_deploy_facts
  Scenario: Enrichment adds the sweep's measurements and keeps the deploy facts
    Given a created staging preview
    When it is enriched with an observation of 39845112 bytes
    Then the observed bytes are 39845112
    And the PR is still 435

  @test:scripts/tests/sdlc/staging-preview.test.ts::enrichStagingPreview::does_not_mutate_its_input
  Scenario: Enrichment does not mutate its input
    Given a created staging preview
    When it is enriched with an observation
    Then the original node still has no observation

  @test:scripts/tests/sdlc/staging-preview.test.ts::enrichStagingPreview::a_later_sweep_replaces_the_earlier_observation_—_a_stale_size_is_not_evidence
  Scenario: A later sweep replaces the earlier observation
    Given a staging preview enriched with an observation of 39845112 bytes
    When it is enriched again with 1 byte observed at "2026-09-20T16:00:00Z"
    Then the observed bytes are 1
    And the observedAt is "2026-09-20T16:00:00Z"

  @test:scripts/tests/sdlc/staging-preview.test.ts::enrichStagingPreview::liveness_keeps_its_third_state_—_`unknown`_is_not_collapsed_into_dead
  Scenario: An "unknown" liveness is kept, not collapsed into dead
    When a staging preview is enriched with liveness "unknown"
    Then the observed liveness is "unknown"

  @test:scripts/tests/sdlc/staging-preview.test.ts::retireStagingPreview::retirement_is_a_state,_not_a_deletion_—_the_record_survives_it
  Scenario: A retired preview keeps its record
    Given a created staging preview
    When it is retired with reason "PR #435 merged"
    Then it reads as retired
    And its slug and PR 435 are kept

  @test:scripts/tests/sdlc/staging-preview.test.ts::retireStagingPreview::a_retired_record_still_says_what_the_preview_was_for
  Scenario: A retired preview still says what it was for
    When a staging preview is retired with reason "PR #435 merged"
    Then its summary contains the branch "claude/sleepy-babbage-ls90iz"
    And its retired reason is "PR #435 merged"

  @test:scripts/tests/sdlc/staging-preview.test.ts::retireStagingPreview::idempotent_—_a_cleanup_that_runs_twice_cannot_rewrite_when_the_preview_went
  Scenario: Retiring twice keeps the first retirement
    Given a preview retired with reason "PR merged" on "2026-09-20T09:00:00Z"
    When it is retired again with another reason on a later date
    Then its retiredOn is still "2026-09-20T09:00:00Z"
    And its retired reason is still "PR merged"

  @test:scripts/tests/sdlc/staging-preview.test.ts::retireStagingPreview::refuses_a_retirement_with_no_reason,_naming_the_slug
  Scenario: A retirement with a blank reason is refused, naming the slug
    When a staging preview is retired with a reason of only spaces
    Then it throws an error naming "claude-sleepy-babbage-ls90iz"

  @test:scripts/tests/sdlc/staging-preview.test.ts::round_trip::serialize_then_read_returns_the_same_node
  Scenario: Serializing then reading returns the same node
    Given an enriched staging preview with liveness "dead"
    When it is serialized and read back
    Then the node read equals the original

  @test:scripts/tests/sdlc/staging-preview.test.ts::round_trip::a_node_of_another_kind_is_refused_with_a_reason_naming_that_kind
  Scenario: A node of another kind is refused with a reason naming that kind
    Given a fsh-guts JSON node of kind "proposal"
    When it is read as a staging preview
    Then no node is returned
    And the reason contains "proposal"

  @test:scripts/tests/sdlc/staging-preview.test.ts::round_trip::a_malformed_staging_block_is_a_defect,_not_a_clean_skip
  Scenario: A malformed staging block is refused as a defect
    Given a staging-preview JSON node whose staging block holds only a slug
    When it is read as a staging preview
    Then no node is returned
    And the reason contains "does not satisfy it"

  @test:scripts/tests/sdlc/staging-preview.test.ts::round_trip::non-JSON_is_refused_rather_than_throwing
  Scenario: Non-JSON input is refused without throwing
    When markdown front matter is read as a staging preview
    Then no node is returned

  @test:scripts/tests/sdlc/staging-preview.test.ts::the_trashcan_constraints_—_one_fixed,_one_still_real::FIXED_—_the_base_schema_no_longer_strips_a_kind's_own_fields
  Scenario: The fsh-guts base schema keeps a kind's own fields
    Given a fsh-guts node of the staging-preview kind with a staging block
    When it is parsed by the fsh-guts node schema
    Then the staging block survives as given

  @test:scripts/tests/sdlc/staging-preview.test.ts::the_trashcan_constraints_—_one_fixed,_one_still_real::STILL_TRUE_—_front_matter_is_FLAT,_so_a_nested_block_does_not_survive_it
  Scenario: Flat front matter does not keep a nested staging block
    Given markdown front matter with a nested "staging:" block holding a slug
    When the front matter is parsed
    Then "staging" is an empty array
    And no "slug" key appears

  @test:scripts/tests/sdlc/staging-preview.test.ts::the_trashcan_constraints_—_one_fixed,_one_still_real::so_the_markdown_carrier_still_cannot_hold_the_staging_facts
  Scenario: The markdown carrier still cannot hold the staging facts
    Given a markdown staging-preview node with a nested staging block
    When it is read by the fsh-guts reader
    Then a node is returned
    And its staging field is an empty array

  @test:scripts/tests/sdlc/staging-preview.test.ts::a_staging-preview_record_now_reaches_the_published_document::the_trashcan's_own_reader_keeps_the_staging_block
  Scenario: The trashcan's own reader keeps the staging block
    Given a created staging preview, serialized
    When it is read by the fsh-guts reader
    Then a node is returned
    And its staging block holds PR 435 and the deploy's slug

  @test:scripts/tests/sdlc/staging-preview.test.ts::a_staging-preview_record_now_reaches_the_published_document::an_enriched_record_round-trips_through_it_too,_liveness_and_all
  Scenario: An enriched record round-trips through the fsh-guts reader
    Given a staging preview enriched with liveness "unknown" and 39845112 bytes
    When it is serialized and read by the fsh-guts reader
    Then the observed liveness is "unknown"
    And the observed bytes are 39845112

  @test:scripts/tests/sdlc/staging-preview.test.ts::a_staging-preview_record_now_reaches_the_published_document::a_retired_record_survives_the_round_trip_—_retirement_is_a_state,_not_a_deletion
  Scenario: A retired record survives the fsh-guts round trip
    Given a staging preview retired with reason "PR #435 merged"
    When it is serialized and read by the fsh-guts reader
    Then the staging block's retired reason is "PR #435 merged"
    And its slug is the deploy's slug
