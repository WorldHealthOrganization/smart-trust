# Specifies archimate/scripts/archimate-actors.ts: reading the IG's FHIR
# ActorDefinitions (fshActors, igCanonical, igActors) and checking an
# ArchiMate model's fhir-actor tags against them (checkActors, actorTypeOf,
# backLinks).
Feature: An ArchiMate element's fhir-actor tag names an ActorDefinition of the IG it can realize

  Background:
    Given an FSH file with ActorDefinitions "ClientRegistry" (#system, whose description holds a line "* type = #person ..."), "HealthWorker" with id "health-worker" (#person) and "FacilityRegistry" (#system), and a Patient instance

  @test:archimate/scripts/archimate-actors.test.ts::the_IG's_ActorDefinitions::reads_id,_canonical_and_type_from_FSH,_and_skips_rules_inside_a_description
  Scenario: Actors are read from FSH, and a rule-like line inside a description is skipped
    When the actors are read from the FSH under the IG canonical
    Then they are "ClientRegistry" (system), "health-worker" (person) and "FacilityRegistry" (system), each with the canonical URL "<canonical>/ActorDefinition/<id>"
    And the Patient instance is not among them
    And the canonical read from a sushi config "canonical: http://smart.who.int/ra/ # the IG" is "http://smart.who.int/ra"

  @test:archimate/scripts/archimate-actors.test.ts::the_IG's_ActorDefinitions::finds_them_under_input/fsh_and_in_generated_JSON,_keyed_by_canonical
  Scenario: Actors are found in input/fsh and in generated JSON, keyed by canonical URL
    Given a throwaway IG with a sushi config, the FSH file under "input/fsh/actors", and generated ActorDefinition JSON for "ClientRegistry" (no url) and "Lab" (with url)
    When the IG's actors are read
    Then the canonical is the IG's
    And the actors are keyed by the canonical URLs of "ClientRegistry", "FacilityRegistry", "Lab" and "health-worker"

  @test:archimate/scripts/archimate-actors.test.ts::the_model's_fhir-actor_tags::resolves_a_tag_to_an_actor,_and_fails_a_bad_value,_a_missing_actor,_a_wrong_kind_and_a_type_mismatch
  Scenario: Tags resolve to actors, and a bad value, a missing actor, a wrong kind and a type mismatch are problems
    Given an ArchiMate model whose elements carry fhir-actor tags, one with a "|0.1.0" version suffix, and one element untagged
    When its tags are checked against the FSH actors
    Then the links are "id-cr" and "id-api" to ClientRegistry, and "id-hw" to health-worker
    And the problems are, in order: an application component tagged with a #person actor, a tag naming no ActorDefinition, a tag that is not a canonical URL, a DataObject tagged with an actor, and a business actor tagged with a #system actor
    And a BusinessRole realizes "person" actors, and a Goal realizes none

  @test:archimate/scripts/archimate-actors.test.ts::the_model's_fhir-actor_tags::reports_the_actors_no_element_realizes
  Scenario: Actors no element realizes are reported
    Given the same tagged model, checked against the FSH actors
    Then the only unrealized actor is FacilityRegistry

  @test:archimate/scripts/archimate-actors.test.ts::the_model's_fhir-actor_tags::gives_element_→_actors_and_actor_→_elements_for_back-links
  Scenario: Back-links run from element to actors and from actor to elements
    Given the same tagged model, checked against the FSH actors
    When the back-links are built
    Then element "id-api" lists its name, type and the ClientRegistry actor
    And actor ClientRegistry lists id "ClientRegistry", type "system" and elements "id-cr" and "id-api"
    And actor FacilityRegistry lists no elements
