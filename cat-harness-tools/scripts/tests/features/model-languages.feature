# A model's own word is not evidence, and a broken registry is not an empty
# one (bean 46uh). Each Scenario names the test that executes it.
Feature: Model language registry

  @test:scripts/tests/model-languages.test.ts::validatedLanguages_—_only_a_human's_check_is_acted_on::a_human-validated_list_comes_back
  Scenario: A human-validated list comes back
    Then the validated languages of a human-validated entry for fr are fr

  @test:scripts/tests/model-languages.test.ts::validatedLanguages_—_only_a_human's_check_is_acted_on::SELF-REPORTED_comes_back_undefined,_not_as_a_weaker_yes
  Scenario: A self-reported list comes back undefined
    Then the validated languages of a self-reported entry are undefined

  @test:scripts/tests/model-languages.test.ts::validatedLanguages_—_only_a_human's_check_is_acted_on::unverified_likewise
  Scenario: An unverified list comes back undefined
    Then the validated languages of an unverified entry are undefined

  @test:scripts/tests/model-languages.test.ts::validatedLanguages_—_only_a_human's_check_is_acted_on::an_EMPTY_human-validated_list_is_a_determined_empty,_not_an_absence
  Scenario: An empty human-validated list is a determined empty
    Then the validated languages of a human-validated entry with no languages are an empty list

  @test:scripts/tests/model-languages.test.ts::parseModelRegistry_—_refuses_rather_than_defaults::a_valid_registry_parses
  Scenario: A valid registry parses
    Then a registry with one valid entry parses with one model

  @test:scripts/tests/model-languages.test.ts::parseModelRegistry_—_refuses_rather_than_defaults::the_tag_is_semver:_a_newer_minor_or_patch_of_major_1_is_read,_major_2_is_not
  Scenario: The registry tag is semver
    Then model-registry/1.4.2 and the old folio-model-registry/v1 tag each parse
    And model-registry/2.0.0 is refused

  @test:scripts/tests/model-languages.test.ts::parseModelRegistry_—_refuses_rather_than_defaults::a_human_validation_with_no_name_and_no_date_is_REFUSED
  Scenario: A human validation with no name and no date is refused
    Then parsing a human-validated entry with no validatedBy or validatedOn throws naming both

  @test:scripts/tests/model-languages.test.ts::parseModelRegistry_—_refuses_rather_than_defaults::a_duplicate_model_id_is_refused
  Scenario: A duplicate model id is refused
    Then parsing a registry declaring one id twice throws saying it is declared twice

  @test:scripts/tests/model-languages.test.ts::parseModelRegistry_—_refuses_rather_than_defaults::a_missing_validation_state_is_refused_—_there_is_no_default
  Scenario: A missing validation state is refused
    Then parsing an entry with no validation throws

  @test:scripts/tests/model-languages.test.ts::parseModelRegistry_—_refuses_rather_than_defaults::the_wrong_$schema_is_refused
  Scenario: The wrong $schema is refused
    Then parsing a registry with another $schema throws

  @test:scripts/tests/model-languages.test.ts::checkModelLanguages::it_sorts_the_three_states_apart
  Scenario: The three validation states are sorted apart
    Given a registry with a human-validated, a self-reported and an unverified model
    When the model languages are checked
    Then 3 models are counted, a usable, b self-reported and c unverified

  @test:scripts/tests/model-languages.test.ts::checkModelLanguages::a_human-validated_EMPTY_list_is_reported,_so_it_is_not_read_as_a_gap
  Scenario: A human-validated empty list is reported
    Given a registry whose one human-validated entry lists no languages
    When the model languages are checked
    Then there is one problem

  @test:scripts/tests/model-languages.test.ts::checkModelLanguages::a_MALFORMED_registry_throws_—_it_is_not_'no_models'
  Scenario: A malformed registry throws
    Given a registry with no $schema and a model with no fields
    Then checking the model languages throws

  @test:scripts/tests/model-languages.test.ts::checkModelLanguages::a_missing_registry_throws_rather_than_returning_zero
  Scenario: A missing registry throws
    Given a directory with no registry
    Then checking the model languages throws saying there is no model registry

  @test:scripts/tests/model-languages.test.ts::the_real_registry::it_exists,_parses,_and_lives_in_BOOTSTRAP
  Scenario: The real registry exists, parses and lives in bootstrap
    Then the registry path of the bootstrap layer contains "bootstrap"
    And checking its model languages does not throw
    # Gap: the model count is asserted to be at least 0, which cannot fail; only the absence of a throw is checked.

  @test:scripts/tests/model-languages.test.ts::the_real_registry::every_entry_that_IS_declared_carries_a_validation_state
  Scenario: Every usable entry of the real registry names its validator and date
    When the real registry's usable entries are read
    Then each has a validatedBy and a validatedOn
    # Gap: can never fail as things stand — the real registry ships with no usable entries, so the loop asserts nothing.
