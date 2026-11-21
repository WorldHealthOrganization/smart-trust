# Specifies schemas/process/actor-reach.ts: effectiveReach (how a deployment's
# network reach and an actor's own reach compose, asymmetrically), canReachOut,
# and reachConflict (which reports only an actor claiming more than its
# deployment grants).
Feature: An actor's effective network reach composes its deployment's and its own, asymmetrically

  @test:schemas/process/actor-reach.test.ts::effectiveReach_composes_two_levels,_asymmetrically::an_air-gapped_deployment_determines_an_undeclared_actor
  Scenario: An air-gapped deployment determines an undeclared actor
    Given a deployment declared "air-gapped" and an actor that declares nothing
    When the effective reach is composed
    Then it is "air-gapped"

  @test:schemas/process/actor-reach.test.ts::effectiveReach_composes_two_levels,_asymmetrically::a_CONNECTED_deployment_determines_nothing_about_an_undeclared_actor
  Scenario: A connected deployment determines nothing about an undeclared actor
    Given a deployment declared "internet", or one declared "egress-restricted", and an actor that declares nothing
    When the effective reach is composed
    Then it is the unknown reach in both cases

  @test:schemas/process/actor-reach.test.ts::effectiveReach_composes_two_levels,_asymmetrically::nothing_declared_is_unknown,_not_a_default
  Scenario: Nothing declared on either side is unknown
    Given neither the deployment nor the actor declares a reach
    When the effective reach is composed
    Then it is the unknown reach

  @test:schemas/process/actor-reach.test.ts::effectiveReach_composes_two_levels,_asymmetrically::an_actor's_own_declaration_stands_when_the_deployment_is_silent
  Scenario: An actor's own reach stands when the deployment is silent
    Given a deployment that declares nothing
    When the effective reach is composed with each reach in the vocabulary as the actor's
    Then each time it is the actor's own reach

  @test:schemas/process/actor-reach.test.ts::effectiveReach_composes_two_levels,_asymmetrically::with_both_declared,_the_more_restrictive_wins
  Scenario: With both declared, the more restrictive reach wins
    Given pairs of an "internet" reach with "air-gapped" or "egress-restricted", on either side
    When the effective reach is composed
    Then it is the more restrictive of the two each time

  @test:schemas/process/actor-reach.test.ts::effectiveReach_composes_two_levels,_asymmetrically::agreement_is_idempotent
  Scenario: Agreeing declarations compose to themselves
    Given each reach in the vocabulary, declared the same by deployment and actor
    When the effective reach is composed
    Then it is that reach

  @test:schemas/process/actor-reach.test.ts::effectiveReach_composes_two_levels,_asymmetrically::every_value_in_the_vocabulary_has_an_answer_—_no_silent_gap
  Scenario: Every pair of declarations yields a value in the vocabulary
    Given every pairing of undeclared or each reach, for deployment and actor
    When the effective reach is composed
    Then it is always one of the reaches or the unknown reach

  @test:schemas/process/actor-reach.test.ts::canReachOut::unknown_does_NOT_count_as_reachable
  Scenario: Only internet and egress-restricted reach out
    Given the unknown reach, "air-gapped", "internet" and "egress-restricted"
    When each is asked whether it can reach out
    Then unknown and "air-gapped" cannot
    And "internet" and "egress-restricted" can

  @test:schemas/process/actor-reach.test.ts::reachConflict_reports_one_direction_only::an_actor_claiming_more_than_its_deployment_grants_is_a_conflict
  Scenario: An actor claiming more than its deployment grants is a conflict
    Given the actor "signer" claiming "internet" in an "air-gapped" deployment
    When the reach conflict is checked
    Then a conflict is reported for "signer"
    And its reason mentions "BOUNDS"

  @test:schemas/process/actor-reach.test.ts::reachConflict_reports_one_direction_only::an_air-gapped_actor_inside_a_connected_deployment_is_NOT_a_conflict
  Scenario: An air-gapped actor inside a connected deployment is not a conflict
    Given an "air-gapped" actor in an "internet" deployment, and in an "egress-restricted" one
    When the reach conflict is checked
    Then no conflict is reported in either case

  @test:schemas/process/actor-reach.test.ts::reachConflict_reports_one_direction_only::an_undeclared_side_is_never_a_conflict
  Scenario: An undeclared side is never a conflict
    Given an undeclared deployment with an "internet" actor, and an "air-gapped" deployment with an undeclared actor
    When the reach conflict is checked
    Then no conflict is reported in either case

  @test:schemas/process/actor-reach.test.ts::reachConflict_reports_one_direction_only::a_conflict_is_exactly_the_complement_of_the_clamp_being_a_no-op
  Scenario: A conflict is reported exactly when composing lowers the actor's reach
    Given every pairing of undeclared or each reach, for deployment and actor
    When the effective reach is composed and the reach conflict checked
    Then where both sides are declared, a conflict is reported exactly when the composed reach differs from the actor's
    And where either side is undeclared, no conflict is reported
