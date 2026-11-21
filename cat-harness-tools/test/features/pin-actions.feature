# scripts/pin-actions.ts pins third-party GitHub Actions in workflows to a full commit SHA
# labelled with its ref, and checks that the workflows here stay pinned. Each Scenario names
# the test that executes it.
Feature: Pinning GitHub Actions to labelled SHAs

  @test:test/pin-actions.test.ts::pin-actions::an_annotated_tag_pins_to_its_PEELED_commit,_never_the_tag_object
  Scenario: An annotated tag resolves to its peeled commit, not the tag object
    Given a stubbed ls-remote where "owner/annotated" has tag "v5" as tag object A peeling to commit B, and "owner/branchy" has branch "release/v1" at C
    When "v5" of "owner/annotated" is resolved
    Then the SHA is the peeled commit B

  @test:test/pin-actions.test.ts::pin-actions::a_branch_ref_resolves_to_its_head
  Scenario: A branch ref resolves to its head commit
    Given a stubbed ls-remote where "owner/annotated" has tag "v5" as tag object A peeling to commit B, and "owner/branchy" has branch "release/v1" at C
    When "release/v1" of "owner/branchy" is resolved
    Then the SHA is C

  @test:test/pin-actions.test.ts::pin-actions::an_unknown_ref_is_REFUSED,_not_guessed
  Scenario: An unknown ref is refused
    Given a stubbed ls-remote where "owner/annotated" has tag "v5" as tag object A peeling to commit B, and "owner/branchy" has branch "release/v1" at C
    When "v9" of "owner/none" is resolved
    Then the result is a refusal

  @test:test/pin-actions.test.ts::pin-actions::rewrites_to_@<sha>_#_<ref>,_skips_staging-only_workflows,_and_is_idempotent
  Scenario: pinWorkflows rewrites to a labelled SHA, skips staging-only workflows and is idempotent
    Given a stubbed ls-remote where "owner/annotated" has tag "v5" as tag object A peeling to commit B, and "owner/branchy" has branch "release/v1" at C
    And a ci.yml using "owner/annotated@v5" and a local action, and a feature-staging.yml using "owner/annotated@v5"
    When the workflows are pinned
    Then ci.yml uses "owner/annotated@B # v5"
    And feature-staging.yml still uses "owner/annotated@v5"
    And pinning again changes nothing
    And the rewritten line parses as pinned

  @test:test/pin-actions.test.ts::parseUses:_the_stricter_pin_rule_(roast_1ygp_L4.6)::a_SHA_needs_a_#_<ref>_to_count_as_pinned
  Scenario: A SHA counts as pinned only with a ref comment
    Then "owner/x@<sha> # v5" is "pinned" with label "v5"
    And "owner/x@<sha>" with no comment, or with an empty "#", is "unpinned-unlabelled"
    And "owner/x@v5 # v5" is "unpinned"
    And a quoted "owner/x@<sha>" with "# v5" is "pinned" with action "owner/x"

  @test:test/pin-actions.test.ts::parseUses:_the_stricter_pin_rule_(roast_1ygp_L4.6)::the_flow-mapping_form_is_parsed
  Scenario: The flow-mapping form of uses is parsed
    Then "{uses: owner/x@main, with: {a: 1}}" parses as action "owner/x", ref "main", flow, not pinned
    And a flow mapping with a quoted "uses" key and a SHA, commented "# v1", is "pinned" with label "v1"
    And a flow mapping with no uses key is not an action

  @test:test/pin-actions.test.ts::parseUses:_the_stricter_pin_rule_(roast_1ygp_L4.6)::local_and_docker_references_are_not_actions;_docker_digests_are_read
  Scenario: Local and docker references are not actions, and docker images and digests are read
    Then a local "./.github/actions/local" and a "docker://alpine:3" reference are not parsed as actions
    And "docker://alpine:latest" reads as image "alpine:latest"
    And a flow-mapping "docker://alpine@sha256:<digest>" reads as image "alpine" with that digest
    And "owner/x@v1" is not a docker reference

  @test:test/pin-actions.test.ts::parseUses:_the_stricter_pin_rule_(roast_1ygp_L4.6)::a_flow-mapping_line_is_rewritten_in_place_with_the_ref_as_its_comment
  Scenario: A uses line is rewritten in place with the ref as its comment
    When "{uses: owner/x@v5, with: {a: 1}} # old" is rewritten to SHA B for "v5"
    Then it becomes "{uses: owner/x@B, with: {a: 1}} # v5"
    And a plain "uses: owner/x@v5" becomes "uses: owner/x@B # v5"

  @test:test/pin-actions.test.ts::parseUses:_the_stricter_pin_rule_(roast_1ygp_L4.6)::pinWorkflows_refuses_an_unlabelled_SHA_rather_than_guessing_its_ref,_and_pins_flow_mappings
  Scenario: pinWorkflows refuses an unlabelled SHA and pins a flow mapping
    Given a stubbed ls-remote where "owner/annotated" has tag "v5" as tag object A peeling to commit B, and "owner/branchy" has branch "release/v1" at C
    And a ci.yml using an unlabelled "owner/x@A" and a flow mapping "{uses: owner/annotated@v5}"
    When the workflows are pinned
    Then one use is pinned and one is refused as "unpinned-unlabelled"
    And ci.yml holds "{uses: owner/annotated@B} # v5"

  @test:test/pin-actions.test.ts::--verify-refs:_a_SHA_is_checked_against_its_#_<ref>_only_on_request::a_matching_SHA_passes,_a_wrong_one_and_an_unresolvable_ref_are_findings
  Scenario: verify-refs passes a matching SHA and reports a wrong one and an unresolvable ref
    Given a stubbed ls-remote where "owner/annotated" has tag "v5" as tag object A peeling to commit B, and "owner/branchy" has branch "release/v1" at C
    And a ci.yml with "owner/annotated@B # v5", "owner/annotated@A # v5", "owner/none@C # v9" and an unpinned "owner/x@main"
    When the refs are verified
    Then 3 uses are checked
    And 2 are mismatched: the first says "v5 is B", the second says "could not verify"

  @test:test/pin-actions.test.ts::every_workflow_in_this_repository_passes_the_stricter_pin_rule::no_unlabelled_SHA_and_no_flow-mapping_action_escapes
  Scenario: Every workflow in the checkout above passes the stricter pin rule
    Given the .github/workflows of the checkout above this layer
    When each line is parsed for a uses
    Then no third-party action is unpinned

  @test:test/pin-actions.test.ts::this_layer's_own_workflows_and_composite_actions_are_SHA-pinned_(bean_a1p9)::every_third-party_uses:_here_carries_a_full_SHA_and_a_#_<ref>
  Scenario: This layer's workflows and composite actions pin every third-party action
    Given this layer's .github/workflows files and its .github/actions composite action files
    When each line is parsed for a uses
    Then at least one file was read
    And no third-party action is unpinned

  @test:test/pin-actions.test.ts::stagingExempt:_decided_from_what_a_workflow_can_do_(owner_2026-10-07,_roast_1ygp_L4.1)::a_listed_staging_workflow_with_no_write_token_and_no_pull_request_target_is_exempt
  Scenario: A listed staging workflow with no write token and no pull_request_target is exempt
    When "feature-staging.yml" triggers on pull_request with contents read permission
    Then it is staging-exempt

  @test:test/pin-actions.test.ts::stagingExempt:_decided_from_what_a_workflow_can_do_(owner_2026-10-07,_roast_1ygp_L4.1)::a_write_permission_anywhere_removes_the_exemption
  Scenario: A write permission anywhere removes the staging exemption
    Then "feature-staging.yml" is not exempt with top-level contents write
    And not with a job-level pages write
    And not with permissions write-all

  @test:test/pin-actions.test.ts::stagingExempt:_decided_from_what_a_workflow_can_do_(owner_2026-10-07,_roast_1ygp_L4.1)::a_pull_request_target_trigger_removes_it;_a_comment_that_mentions_it_does_not
  Scenario: A pull_request_target trigger removes the exemption, but a comment mentioning it does not
    Then "folio-staging.yml" triggered by pull_request_target is not exempt
    And "folio-staging.yml" triggered by pull_request with a comment mentioning pull_request_target is exempt

  @test:test/pin-actions.test.ts::stagingExempt:_decided_from_what_a_workflow_can_do_(owner_2026-10-07,_roast_1ygp_L4.1)::an_unlisted_file_is_never_exempt,_whatever_its_name_says
  Scenario: An unlisted file is never staging-exempt
    When "my-staging.yml" triggers only on pull_request
    Then it is not exempt
