# schemas/content/attribution.ts defines who wrote a block (script, agent or human) and a block's
# provenance; scripts/check-l1-complete.ts gates narrative provenance per library entry. Each Scenario names the test that executes it.
Feature: Narrative attribution and provenance

  @test:scripts/tests/attribution.test.ts::the_vocabulary_is_one_set,_not_two::`QA_REVIEWER_KINDS`_IS_`ATTRIBUTION_KINDS`
  Scenario: The QA reviewer kinds are the attribution kinds themselves
    Then the QA reviewer kinds are the same object as the attribution kinds, not an equal copy

  @test:scripts/tests/attribution.test.ts::the_vocabulary_is_one_set,_not_two::the_order_is_the_one_block-qa_always_exported
  Scenario: The attribution kinds keep block-qa's order
    Then the attribution kinds are "script", "agent", "human" in that order

  @test:scripts/tests/attribution.test.ts::an_agent_must_name_its_model::an_`agent`_with_no_model_is_rejected
  Scenario: An agent attribution with no model is rejected
    When an agent attribution with an id and no model is parsed
    Then it fails
    And the issues mention "model"

  @test:scripts/tests/attribution.test.ts::an_agent_must_name_its_model::an_empty-string_model_is_rejected_too_—_it_is_an_absence_spelled_differently
  Scenario: An agent attribution with an empty model is rejected
    When an agent attribution with model "" is parsed
    Then it fails

  @test:scripts/tests/attribution.test.ts::an_agent_must_name_its_model::a_human_and_a_script_need_no_model
  Scenario: Human and script attributions need no model
    When a human attribution and a script attribution, each with only an id, are parsed
    Then both parse

  @test:scripts/tests/attribution.test.ts::provenance_is_a_CLOSED_union::"ingested"_is_the_one_bare_string_that_parses
  Scenario: "ingested" is the one bare string provenance that parses
    Then the provenance "ingested" parses
    And "derived", "generated", "" and "unknown" do not

  @test:scripts/tests/attribution.test.ts::provenance_is_a_CLOSED_union::a_well-formed_attribution_parses;_a_malformed_one_does_not
  Scenario: A well-formed attribution is a valid provenance and a malformed one is not
    Then an agent attribution with id and model parses as a provenance
    And an attribution of kind "wizard" does not
    And a human attribution with no id does not

  @test:scripts/tests/attribution.test.ts::provenance_is_a_CLOSED_union::`attributionOf`_gives_null_for_extracted_text_and_never_throws
  Scenario: attributionOf gives null for extracted text
    # Gap: "never throws" is shown only for these inputs
    Then attributionOf "ingested" and of undefined are null
    And attributionOf a human attribution gives that human's id
    And "ingested" is ingested while a human attribution is not

  @test:scripts/tests/attribution.test.ts::the_origin_registry_is_total_over_what_actually_exists::every_kind_in_library/_is_classified
  Scenario: Every block kind in the library is classified by origin
    Given every block file of every declared library entry
    When each block's top-level kind is read
    Then there is at least one block and at least one kind
    And each kind has an entry in the library block origin registry

  @test:scripts/tests/attribution.test.ts::the_origin_registry_is_total_over_what_actually_exists::today's_corpus_is_all_extracted,_and_that_is_a_determined_answer
  Scenario: Prose and description are not narrative kinds today
    # Gap: that the whole corpus is extracted is not checked here
    Then "prose" is not a narrative kind
    And "description" is not a narrative kind

  @test:scripts/tests/attribution.test.ts::the_gate_fires_on_an_unattributed_narrative::an_authored_block_claiming_"ingested"_is_UNMET_—_nobody_is_credited
  Scenario: An authored block claiming "ingested" is unmet
    Given "description" registered as an authored kind
    And an entry whose one block is a description with provenance "ingested"
    When the entry is checked
    Then narrative-provenance is "unmet" with a detail mentioning "nobody is credited"

  @test:scripts/tests/attribution.test.ts::the_gate_fires_on_an_unattributed_narrative::the_same_block_with_an_agent_attribution_is_MET,_and_is_counted_as_narrative
  Scenario: An authored block with an agent attribution is met and counted as narrative
    Given "description" registered as an authored kind
    And an entry whose description block is attributed to an agent with a model
    When the entry is checked
    Then narrative-provenance is "met" with a detail mentioning "1 narrative"

  @test:scripts/tests/attribution.test.ts::the_gate_fires_on_an_unattributed_narrative::an_agent_attribution_with_no_model_does_not_rescue_it
  Scenario: An agent attribution with no model does not make an authored block met
    Given "description" registered as an authored kind
    And an entry whose description block is attributed to an agent with no model
    When the entry is checked
    Then narrative-provenance is "unmet"

  @test:scripts/tests/attribution.test.ts::the_gate_fires_on_an_unattributed_narrative::a_human_attribution_is_enough
  Scenario: A human attribution makes an authored block met
    Given "description" registered as an authored kind
    And an entry whose description block is attributed to a human
    When the entry is checked
    Then narrative-provenance is "met"

  @test:scripts/tests/attribution.test.ts::what_the_gate_refuses_to_wave_through::an_unclassified_kind_is_unmet,_never_skipped
  Scenario: An unclassified block kind is unmet
    Given an entry whose one block has kind "mystery" and provenance "ingested"
    When the entry is checked
    Then narrative-provenance is "unmet" with a detail mentioning "not classified"

  @test:scripts/tests/attribution.test.ts::what_the_gate_refuses_to_wave_through::an_open_string_is_unmet_even_on_an_extracted_kind
  Scenario: An open-string provenance is unmet even on an extracted kind
    Given an entry whose prose block has provenance "generated"
    When the entry is checked
    Then narrative-provenance is "unmet"

  @test:scripts/tests/attribution.test.ts::what_the_gate_refuses_to_wave_through::a_missing_provenance_is_unmet,_not_absent-and-fine
  Scenario: A missing provenance is unmet
    Given an entry whose prose block has no provenance
    When the entry is checked
    Then narrative-provenance is "unmet"

  @test:scripts/tests/attribution.test.ts::what_the_gate_refuses_to_wave_through::no_blocks_at_all_is_unmet_—_there_is_nothing_to_have_attributed
  Scenario: An entry with no blocks is unmet
    Given an entry holding only an empty structure.json
    When the entry is checked
    Then narrative-provenance is "unmet"

  @test:scripts/tests/attribution.test.ts::the_real_corpus::every_block_is_extracted_prose_with_a_valid_provenance
  Scenario: Every non-referenced entry of the real corpus has met provenance with no narrative
    # Gap: that every block is prose is not checked directly
    Given the real library declared under the harness root
    When every entry is checked
    Then the library is declared and has at least one entry
    And for each entry that is not a referenced record, narrative-provenance is "met" with a detail mentioning "0 narrative"

  @test:scripts/tests/attribution.test.ts::MODEL_NOT_DISCLOSED_—_the_declared_non-identifier_(owner,_2026-09-30)::an_agent_that_may_not_name_its_model_says_so,_and_must_give_its_session
  Scenario: An agent that may not name its model says so and gives its session
    Given an agent attribution whose model is the not-disclosed marker and which gives a session
    Then it parses
    And without the session it fails
    And its model is reported as not disclosed

  @test:scripts/tests/attribution.test.ts::MODEL_NOT_DISCLOSED_—_the_declared_non-identifier_(owner,_2026-09-30)::model_stays_REQUIRED_for_an_agent:_not-disclosed_is_an_answer,_silence_is_not
  Scenario: An agent attribution with neither model nor marker is rejected
    When an agent attribution with an id and a session but no model is parsed
    Then it fails
