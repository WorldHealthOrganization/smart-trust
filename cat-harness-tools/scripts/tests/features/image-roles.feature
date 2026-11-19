# scripts/check-image-roles.ts: the image-role gate judges whether each declared image role is
# named by a consumer that can match its images, and checks its own permit list.
# Each Scenario names the test that executes it.
Feature: The image-role gate's judgements

  @test:scripts/tests/image-roles.test.ts::half_one_—_is_the_role_named_at_all::nothing_names_it,_nothing_reaches_it:_ORPHAN
  Scenario: A role nothing names or reaches is an orphan
    Given a role "x" with one image, no mentions, not reached by id and no dynamic lookup
    When it is judged
    Then the verdict is "orphan"

  @test:scripts/tests/image-roles.test.ts::half_one_—_is_the_role_named_at_all::a_theme's_declared_`imageRole`_counts_as_a_consumer
  Scenario: A theme's declared imageRole counts as a consumer
    Given the role "landing-analyst" with an image of layout "card"
    And a mention through a theme's declared imageRole
    When it is judged
    Then the verdict is "consumed"

  @test:scripts/tests/image-roles.test.ts::half_one_—_is_the_role_named_at_all::reached_by_a_declared_id_but_not_by_role:_BY-ID,_and_not_a_failure
  Scenario: A role reached only by a declared id is by-id and does not fail
    Given the role "mark" with no mentions, reached by a declared id
    When it is judged
    Then the verdict is "by-id"
    And a by-id finding does not fail the gate

  @test:scripts/tests/image-roles.test.ts::half_one_—_is_the_role_named_at_all::a_dynamic_lookup_exists_and_nothing_names_it:_DECLINED,_never_clean
  Scenario: A role nothing names while a dynamic lookup exists is declined and does not fail
    Given a role "x" with no mentions, not reached by id, and a dynamic lookup in the corpus
    When it is judged
    Then the verdict is "declined"
    And a declined finding does not fail the gate

  @test:scripts/tests/image-roles.test.ts::half_one_—_is_the_role_named_at_all::being_reached_by_id_OUTRANKS_declined_—_the_stronger_fact_wins
  Scenario: Being reached by id outranks declined
    Given the role "mark" reached by id while a dynamic lookup exists
    When it is judged
    Then the verdict is "by-id"

  @test:scripts/tests/image-roles.test.ts::half_two_—_can_the_consumer_MATCH_what_is_declared::layout-keyed_consumer,_layout-less_images:_UNREACHABLE
  Scenario: A layout-keyed consumer of layout-less images leaves the role unreachable
    Given the role "browser-icon" whose image has no layout
    And its only mention is an imagesForRole lookup
    When it is judged
    Then the verdict is "unreachable"
    And the reason names "imagesForRole"
    And an unreachable finding fails the gate

  @test:scripts/tests/image-roles.test.ts::half_two_—_can_the_consumer_MATCH_what_is_declared::layout-keyed_consumer,_images_that_DO_carry_a_layout:_consumed
  Scenario: A layout-keyed consumer of images with a layout consumes the role
    Given the role "landing" whose image has layout "card"
    And an imagesForRole lookup mentioning it
    When it is judged
    Then the verdict is "consumed"

  @test:scripts/tests/image-roles.test.ts::half_two_—_can_the_consumer_MATCH_what_is_declared::a_non-layout-keyed_consumer_rescues_a_layout-less_role
  Scenario: A non-layout-keyed consumer rescues a layout-less role
    Given the role "browser-icon" whose image has no layout
    And an imageForRole lookup mentioning it
    When it is judged
    Then the verdict is "consumed"

  @test:scripts/tests/image-roles.test.ts::half_two_—_can_the_consumer_MATCH_what_is_declared::ONE_reachable_consumer_is_enough,_even_beside_a_layout-keyed_one
  Scenario: One reachable consumer is enough beside a layout-keyed one
    Given the role "browser-icon" whose image has no layout
    And mentions by both imagesForRole and imageForRole
    When it is judged
    Then the verdict is "consumed"

  @test:scripts/tests/image-roles.test.ts::what_counts_as_a_mention::both_forms_are_found,_and_attributed_to_the_right_function
  Scenario: Both lookup forms and a theme imageRole are found and attributed
    Given source calling imageForRole for "browser-icon", imagesForRole for "landing" and declaring imageRole "landing-analyst"
    When its mentions are collected
    Then "browser-icon" is attributed to imageForRole
    And "landing" is attributed to imagesForRole
    And "landing-analyst" is found via imageRole

  @test:scripts/tests/image-roles.test.ts::what_counts_as_a_mention::PROSE_IS_NOT_EVIDENCE_—_a_comment_naming_a_lookup_is_stripped
  Scenario: A lookup named only in a comment is not evidence
    Given another module whose only text is a block comment calling imagesForRole
    When it is checked for a dynamic lookup
    Then it has none
    And stripping a source to code removes the commented imagesForRole

  @test:scripts/tests/image-roles.test.ts::what_counts_as_a_mention::the_module_that_DEFINES_the_lookups_is_never_a_consumer_of_them
  Scenario: The module defining the lookups is never a consumer of them
    Given the source "const byLayout = imagesForRole(images, role);"
    When it is checked for a dynamic lookup as schemas/kg/kg-node.ts
    Then it has none
    And as scripts/other.ts it has one

  @test:scripts/tests/image-roles.test.ts::the_permit_list_is_itself_checked::a_permitted_orphan_does_not_fail_the_gate
  Scenario: A permitted orphan does not fail the gate
    Given a fixture permit list naming "cat-harness/some-role"
    And an orphan finding for role "some-role" in cat-harness
    Then the finding's permit key is "cat-harness/some-role"
    And with the permit list the gate has no failures
    And with an empty permit list the finding fails the gate

  @test:scripts/tests/image-roles.test.ts::the_permit_list_is_itself_checked::a_permit_whose_finding_is_GONE_is_itself_a_finding
  Scenario: A permit whose finding is gone is stale
    Given a fixture permit list naming "cat-harness/some-role"
    And no findings
    When stale permits are listed
    Then "cat-harness/some-role" is stale

  @test:scripts/tests/image-roles.test.ts::the_permit_list_is_itself_checked::...and_is_NOT_stale_while_its_finding_stands
  Scenario: A permit is not stale while its finding stands
    Given a fixture permit list naming "cat-harness/some-role"
    And an orphan finding for that role
    When stale permits are listed
    Then there are none

  @test:scripts/tests/image-roles.test.ts::the_permit_list_is_itself_checked::the_real_list_has_no_stale_permit_today
  Scenario: The real permit list has no stale permit
    Given the real permit list
    And the real gate run over the checkout, which examines at least one role
    When stale permits are listed against its findings
    Then there are none
    And a fixture permit naming no finding is stale against the same findings

  @test:scripts/tests/image-roles.test.ts::the_permit_list_is_itself_checked::every_permit_carries_a_REASON,_not_just_a_name
  Scenario: Every real permit carries a dated reason
    Given a fixture permit list with one dated, full reason, one short reason and one undated reason
    Then exactly the short and the undated entries lack a reason longer than 80 characters that names a date
    And no entry of the real permit list lacks one
