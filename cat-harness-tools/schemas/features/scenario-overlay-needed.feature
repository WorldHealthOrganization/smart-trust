# schemas/process/scenario-overlay.ts resolves the actors, roles and policies a layer may name from the platform, the layers it needs and itself, never a sibling or a dependent.
# A redeclaration that only adds is accepted as a move in flight with a warning; one that changes or drops anything is refused. Each Scenario names the test that executes it.
Feature: Actors, roles and policies overlaid from the layers below

  @test:schemas/scenario-overlay-needed.test.ts::neededActors_—_the_actors_one_instance_may_name::the_platform's,_every_needed_instance's_and_its_own;_not_a_sibling's
  Scenario: A layer's actors come from the platform, the layers it needs and itself, not a sibling
    Given a throwaway checkout where "top" needs "mid", "mid" needs "cat-harness", and "sibling" also needs "cat-harness"
    When the actors "top" may name are resolved
    Then they are "admin", "vhl-receiver" and "vhl-sharer"

  @test:schemas/scenario-overlay-needed.test.ts::neededActors_—_the_actors_one_instance_may_name::an_extension_in_the_audited_instance_adds_roles_to_an_actor_a_needed_instance_declares
  Scenario: An extension in the audited layer adds roles to an actor declared below
    Given "mid" declares "vhl-sharer" with the role "sharer"
    And "top" extends "vhl-sharer" with the role "key-holder"
    When the actors "top" may name are resolved
    Then "vhl-sharer" has the roles "sharer" and "key-holder"

  @test:schemas/scenario-overlay-needed.test.ts::neededActors_—_the_actors_one_instance_may_name::a_needed_instance_sees_nothing_of_the_instance_above_it
  Scenario: A needed layer sees no actor of the layer above it
    Given the throwaway checkout
    When the actors "mid" may name are resolved
    Then they are "admin" and "vhl-sharer"

  @test:schemas/scenario-overlay-needed.test.ts::neededActors_—_the_actors_one_instance_may_name::the_layers_are_deepest_first,_the_audited_instance_last
  Scenario: The scenario layers are listed deepest first with the audited layer last
    Given the throwaway checkout
    When the scenario layers below "top" are listed
    Then they are "cat-harness", "mid", "top" in that order

  @test:schemas/scenario-overlay-needed.test.ts::policies_travel_with_the_actors_they_grant::an_instance's_own_audit_reads_the_platform's,_every_needed_instance's_and_its_own;_not_a_sibling's
  Scenario: A layer's policies come from the platform, the layers it needs and itself, not a sibling
    Given the throwaway checkout with policies in "cat-harness", "mid" and "sibling"
    When the policies for "top" are resolved
    Then their uids are "urn:p:defaults" and "urn:p:mid"
    And the policies for "mid" are the same two

  @test:schemas/scenario-overlay-needed.test.ts::policies_travel_with_the_actors_they_grant::the_platform's_checkout_reads_every_dependent's
  Scenario: The platform's checkout reads every dependent layer's policies
    Given the throwaway checkout
    When the checkout policies of "cat-harness" are resolved
    Then their uids are "urn:p:defaults", "urn:p:mid" and "urn:p:sibling"

  @test:schemas/scenario-overlay-needed.test.ts::policies_travel_with_the_actors_they_grant::a_higher_instance_redeclaring_a_lower_policy's_uid_and_dropping_its_rules_is_refused,_not_merged
  Scenario: A higher layer redeclaring a lower policy's uid with its rules dropped is refused
    Given "top" declares the uid "urn:p:defaults" with no permissions
    When the policies for "top" are resolved
    Then it fails with "already declared below"

  @test:schemas/scenario-overlay-needed.test.ts::a_move_in_flight_—_a_redeclaration_that_only_adds::onlyAdds:_equal_scalars,_superset_arrays,_nested_objects_by_the_same_rule;_`_`-keys_ignored
  Scenario: A redeclaration only adds when scalars match, arrays are supersets and nested objects follow the same rule
    Then an object with equal scalars, a superset array, a nested addition and a new key only adds
    And a changed "_comment" key is ignored
    And a changed scalar does not only add
    And an emptied array does not only add
    And a dropped key does not only add
    And a changed nested value does not only add
    And an array rule that gains a constraint does not only add

  @test:schemas/scenario-overlay-needed.test.ts::a_move_in_flight_—_a_redeclaration_that_only_adds::an_actor_redeclared_identically_by_a_higher_instance_is_accepted,_with_a_warning_naming_both_layers
  Scenario: An actor redeclared identically by a higher layer is accepted with a warning naming both layers
    Given "top" redeclares the "admin" actor exactly as "cat-harness" declares it
    When the actors "top" may name are resolved
    Then there is one "admin", read from "top/scenarios/actors"
    And one warning about actor "admin" names "cat-harness" and "top"
    And it says "move in flight" and "removing the copy"

  @test:schemas/scenario-overlay-needed.test.ts::a_move_in_flight_—_a_redeclaration_that_only_adds::an_actor_redeclared_with_an_added_role_and_field_is_accepted,_and_keeps_what_a_lower_extension_added
  Scenario: An actor redeclared with an added role and field keeps what a higher extension added
    Given "mid" redeclares "admin" with the added role "auditor" and a description
    And "top" extends "admin" with the role "key-holder"
    When the checkout actors of "cat-harness" are resolved
    Then "admin" has the roles "administrator", "auditor" and "key-holder"
    And its description is "Now with a description."
    And a "move in flight" warning names actor "admin"

  @test:schemas/scenario-overlay-needed.test.ts::a_move_in_flight_—_a_redeclaration_that_only_adds::an_actor_redeclared_with_a_changed_field_or_a_dropped_role_is_refused
  Scenario: An actor redeclared with a changed field or a dropped role is refused
    Given "top" redeclares "admin" with kind "agent", with no roles, or with title "Admin"
    When the actors "top" may name are resolved
    Then each fails with "already declared below"

  @test:schemas/scenario-overlay-needed.test.ts::a_move_in_flight_—_a_redeclaration_that_only_adds::a_role_redeclared_identically_is_accepted,_with_a_warning
  Scenario: A role redeclared identically is accepted with a warning
    Given a base role graph with the roles "mover" and "stayer"
    When "upper" redeclares "mover" unchanged and the graphs are overlaid
    Then the roles are "mover" and "stayer"
    And a warning about role "mover" names "base" and "upper"

  @test:schemas/scenario-overlay-needed.test.ts::a_move_in_flight_—_a_redeclaration_that_only_adds::a_role_redeclared_with_added_skills_is_accepted,_and_keeps_what_a_lower_extension_added
  Scenario: A role redeclared with added skills keeps what a lower extension added
    Given "middle" extends "stayer" with the skill "wait"
    And "upper" redeclares "stayer" with the skill "sit" and a persona
    When the graphs are overlaid
    Then "stayer" has the skills "sit" and "wait"
    And a warning about role "stayer" names "upper"

  @test:schemas/scenario-overlay-needed.test.ts::a_move_in_flight_—_a_redeclaration_that_only_adds::a_role_redeclared_with_a_changed_title_or_a_dropped_skill_is_refused
  Scenario: A role redeclared with a changed title or a dropped skill is refused
    Given "upper" redeclares "mover" with the title "Carrier", or with no skills
    When the graphs are overlaid
    Then each fails with "already declared by base"

  @test:schemas/scenario-overlay-needed.test.ts::a_move_in_flight_—_a_redeclaration_that_only_adds::a_policy_redeclared_identically,_or_with_an_added_rule,_is_accepted_with_a_warning
  Scenario: A policy redeclared with an added rule, or identically, is accepted
    # Gap: the warning is checked for the added-rule case only, not the identical one
    Given "top" redeclares "urn:p:defaults" with its rule plus a rule for "vhl-receiver"
    When the policies for "top" are resolved
    Then "urn:p:defaults" has 2 permissions
    And a "move in flight" warning names policy "urn:p:defaults" and "top"
    And when "top" redeclares it with only the original rule, it resolves with 1 permission

  @test:schemas/scenario-overlay-needed.test.ts::a_move_in_flight_—_a_redeclaration_that_only_adds::a_policy_redeclared_with_a_changed_rule_is_refused
  Scenario: A policy redeclared with a changed rule is refused
    Given "top" redeclares "urn:p:defaults" with the action "content-authoring" in place of "role-management"
    When the policies for "top" are resolved
    Then it fails with "already declared below"
