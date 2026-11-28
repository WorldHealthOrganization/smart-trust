# Specifies schemas/process/user-scenario.ts: the user-scenario kind and its
# draft family 0.1.0 to 0.4.0 (parseUserScenario, UserScenarioSchema and the
# 0.1.0 draft shape), the journey persona schema, and the building-blocks
# catalogue schema.
Feature: A user scenario of any draft minor is read unchanged, and each minor adds to it

  Background:
    Given a step "J1" led by "mother", whose one experience is "mother" holding the cards with emotion 1
    And a 0.1.0 scenario "j1" with persona "mother" and that one step

  @test:schemas/process/user-scenario.test.ts::user-scenario:_the_draft_family_is_read_unchanged,_each_minor_adds_to_it::a_0.1.0_file_parses_as_it_is,_by_the_draft's_own_shape_and_by_the_kind
  Scenario: A 0.1.0 file parses by the draft's own shape and by the kind
    When the 0.1.0 scenario is parsed with the 0.1.0 shape and with the kind
    Then both accept it
    And the 0.1.0 shape refuses it with partOf added

  @test:schemas/process/user-scenario.test.ts::user-scenario:_the_draft_family_is_read_unchanged,_each_minor_adds_to_it::the_kind_refuses_a_newer_minor_and_another_major
  Scenario: The kind refuses a newer minor and another major
    When the scenario is parsed by the kind with $schema user-scenario/0.5.0, and with user-scenario/1.0.0
    Then each is refused

  @test:schemas/process/user-scenario.test.ts::user-scenario:_the_draft_family_is_read_unchanged,_each_minor_adds_to_it::0.2.0_groups_(partOf,_no_steps)_and_carries_gaps_and_views
  Scenario: A 0.2.0 group has no steps, and a 0.2.0 child carries gaps and views
    Given a 0.2.0 scenario "j" with no steps
    And a 0.2.0 scenario part of "j", with a view and a step with gap "not yet"
    When each is parsed
    Then the group is accepted
    And the child's step carries the gap "not yet"
    And the child reads back as part of "j", with its view as given
    And a view with no view id, or with an unknown key, throws
    And the 0.1.0 shape refuses a scenario with views

  @test:schemas/process/user-scenario.test.ts::user-scenario:_the_draft_family_is_read_unchanged,_each_minor_adds_to_it::0.2.0_carries_an_illustration_(alt_required)_and_the_scenario's_shared_style;_0.1.0_does_not
  Scenario: A 0.2.0 step carries an illustration with alt text; 0.1.0 does not
    Given a 0.2.0 scenario with an illustration style and a step illustrated with src, alt and prompt
    When it is parsed
    Then the step carries the illustration
    And an illustration with no alt throws mentioning alt
    And an illustration with an extra caption throws
    And the 0.1.0 shape refuses a step with an illustration

  @test:schemas/process/user-scenario.test.ts::user-scenario:_the_draft_family_is_read_unchanged,_each_minor_adds_to_it::a_step_id_twice,_an_actor_not_among_the_personas,_and_an_unknown_key_are_refused
  Scenario: A repeated step id, a lead outside the personas, and an unknown step key are refused
    When the 0.1.0 scenario is parsed with its step twice, with lead "stranger", or with a step key "mood"
    Then each throws, the first saying the step appears twice and the second that the actor is not among the scenario's personas

  @test:schemas/process/user-scenario.test.ts::user-scenario:_the_draft_family_is_read_unchanged,_each_minor_adds_to_it::0.2.0_carries_a_scene,_FHIR_changes_and_a_hand-off_in_words;_a_glyph_not_on_the_list_is_refused
  Scenario: A 0.2.0 scenario carries a scene, FHIR changes and a hand-off; an unlisted glyph is refused
    Given a 0.2.0 scenario with a "hospital" scene and a step with FHIR changes and a hand-off from "Thai hospital" to "mother"
    When it is parsed
    Then its scene, the step's FHIR changes and the step's hand-off are read back as given
    And a scene glyph "unicorn" throws
    And a FHIR change whose example is "not a key" throws
    And the 0.1.0 shape refuses a step with FHIR changes

  @test:schemas/process/user-scenario.test.ts::user-scenario:_the_draft_family_is_read_unchanged,_each_minor_adds_to_it::0.3.0_links_a_step_to_its_DAK_assets_by_artefact-index_key,_with_what_each_is_to_the_step;_0.2.0_files_still_parse
  Scenario: A 0.3.0 step links DAK assets by artefact-index key; 0.2.0 still parses
    Given a 0.3.0 scenario whose step links four DAK keys, three with a relation
    When it is parsed
    Then the step's DAK links are read back as given
    And a key "not a key", a relation "counts", and an extra "label" each throw
    And a 0.2.0 scenario with gaps is accepted by the kind
    And the 0.1.0 shape refuses a step with DAK links

  @test:schemas/process/user-scenario.test.ts::user-scenario:_the_draft_family_is_read_unchanged,_each_minor_adds_to_it::0.4.0:_a_parent_lists_its_parts_in_order,_a_step_may_include_a_journey,_and_partOf_is_refused
  Scenario: A 0.4.0 parent lists its parts, a step may include a journey, and partOf is refused
    Given a 0.4.0 scenario
    When it is parsed with parts "j1" and an optional repeating "j2", and with a step including "j2"
    Then the parts and the include are read back
    And partOf throws saying it is refused
    And a part listed twice throws saying it appears twice
    And a part with optional false throws
    And a 0.3.0 scenario keeps partOf "j"

  @test:schemas/process/user-scenario.test.ts::user-scenario:_the_draft_family_is_read_unchanged,_each_minor_adds_to_it::0.4.0_leaves_derivable_fields_out:_personas_with_parts,_steps,_a_step's_lead_and_experiences;_earlier_families_still_need_them
  Scenario: 0.4.0 leaves derivable fields out; earlier minors still need them
    Given a 0.4.0 scenario "s" with persona "caregiver" and no steps
    When it is parsed
    Then it has no steps
    And with no personas but a part, it parses with no personas
    And with no personas and no parts, it throws saying personas are required unless the journey has parts
    And a step realised by a process with no lead parses with no lead
    And a step whose actor is "mother" parses
    And a 0.3.0 scenario with no personas throws saying personas are required before 0.4.0
    And a 0.3.0 step with no lead and experiences throws saying they are required before 0.4.0

  @test:schemas/process/user-scenario.test.ts::user-scenario:_the_draft_family_is_read_unchanged,_each_minor_adds_to_it::an_emotion_outside_-2..2_is_refused
  Scenario: An emotion outside -2..2 is refused
    When the 0.1.0 scenario is parsed with an experience of emotion 3
    Then it throws

  @test:schemas/process/user-scenario.test.ts::building-blocks:_a_block_is_in_a_declared_layer,_once::valid_catalogue
  Scenario: A catalogue with one layer and one block in it is valid
    Given a building-blocks catalogue with layer "apps" and block "sdk" in layer "apps"
    When it is parsed
    Then it is accepted

  @test:schemas/process/user-scenario.test.ts::building-blocks:_a_block_is_in_a_declared_layer,_once::big_ideas_name_blocks_of_the_catalogue
  Scenario: Big ideas name blocks of the catalogue
    Given the catalogue with block "sdk"
    When it is parsed with an idea naming "sdk", and with an idea naming "ghost"
    Then the first is accepted and the second refused

  @test:schemas/process/user-scenario.test.ts::building-blocks:_a_block_is_in_a_declared_layer,_once::a_persona_may_carry_a_glyph_for_its_avatar
  Scenario: A persona may carry a listed glyph for its avatar
    When a persona is parsed with icon "baby", and with icon "dragon"
    Then the first is accepted and the second refused

  @test:schemas/process/user-scenario.test.ts::building-blocks:_a_block_is_in_a_declared_layer,_once::an_unknown_layer_and_a_duplicate_id_are_refused
  Scenario: A block in an undeclared layer, and a block twice, are refused
    When a catalogue is parsed with only layer "data" holding block "sdk" of layer "apps", and with block "sdk" twice
    Then each is refused
