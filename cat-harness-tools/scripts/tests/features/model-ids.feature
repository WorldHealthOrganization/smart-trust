# Model ids are typed, and ids the registry does not declare are reported,
# never auto-registered (#1168 B10c). Each Scenario names the test that executes it.
Feature: Model ids

  @test:scripts/tests/model-ids.test.ts::ModelIdSchema::accepts_runtime_ids_and_the_declared_not-disclosed
  Scenario: Runtime ids and not-disclosed are accepted
    Then claude-opus-5, a dated haiku id, a Bedrock-prefixed id and the not-disclosed value each parse as a model id

  @test:scripts/tests/model-ids.test.ts::ModelIdSchema::refuses_a_display_name_or_an_empty_id
  Scenario: A display name or an empty id is refused
    Then "Claude Opus 5", the empty string and an id with a leading space are each refused

  @test:scripts/tests/model-ids.test.ts::ModelIdSchema::an_agent_attribution's_model_is_checked
  Scenario: An agent attribution's model is checked
    Then an agent attribution with a display-name model is refused
    And one with claude-opus-5 is accepted

  @test:scripts/tests/model-ids.test.ts::unregistered_model_ids_are_reported,_advisory::the_corpus_records_model_ids,_so_the_report_is_not_vacuous
  Scenario: The corpus records model ids
    When the unregistered model ids are read with nothing registered
    Then there is at least one

  @test:scripts/tests/model-ids.test.ts::unregistered_model_ids_are_reported,_advisory::not-disclosed_is_never_reported,_and_a_registered_id_drops_out
  Scenario: not-disclosed is never reported, and a registered id drops out
    Then the unregistered ids do not include not-disclosed
    And registering the first one removes it from the report

  @test:scripts/tests/model-ids.test.ts::unregistered_model_ids_are_reported,_advisory::every_recorded_id_has_the_model-id_shape
  Scenario: Every recorded id has the model-id shape
    Then no unregistered id fails the model-id schema

  @test:scripts/tests/model-ids.test.ts::an_identity-only_entry_lets_an_id_resolve_without_a_language_claim::unverified_may_omit_preferredLanguages;_a_language_claim_may_not
  Scenario: An unverified entry may omit preferred languages; a language claim may not
    Then an unverified entry with no preferred languages is accepted
    And a self-reported or human-validated entry with none is refused

  @test:scripts/tests/model-ids.test.ts::an_identity-only_entry_lets_an_id_resolve_without_a_language_claim::every_model_id_the_corpus_records_resolves_to_a_registry_entry
  Scenario: Every recorded model id resolves to a registry entry
    When the ids the registry knows as usable, self-reported or unverified are registered
    Then no model id in the corpus is unregistered

  @test:scripts/tests/model-ids.test.ts::an_identity-only_entry_lets_an_id_resolve_without_a_language_claim::no_identity-only_entry_is_read_as_language_evidence
  Scenario: No identity-only entry is read as language evidence
    Then the model language check lists no usable models
