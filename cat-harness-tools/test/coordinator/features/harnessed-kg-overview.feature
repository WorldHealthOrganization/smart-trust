# Specifies the living deck's claims about the knowledge graph
# (docs/concepts/harnessed-kg-overview.md and its slide sources), each
# re-checked against the checkout.
Feature: Every claim the living deck makes about the knowledge graph still holds

  @test:test/coordinator/harnessed-kg-overview.test.ts::living_deck:_every_claim_about_the_KG_still_holds::slide_6_—_the_lifecycle_process_has_the_five_lanes,_the_work-plan_store_and_the_skills_shown
  Scenario: Slide 6 — the lifecycle process has five lanes, the work-plan store and the shown skills
    Given the content-lifecycle.bpmn diagram
    When it is read
    Then it has exactly 5 lanes
    And it has a data store reference to "work-plan"
    And it names the skills content-plan, todo-manager, content-author, content-test, content-publish, content-feedback and content-retire

  @test:test/coordinator/harnessed-kg-overview.test.ts::living_deck:_every_claim_about_the_KG_still_holds::slide_8_—_the_generated_UML_has_the_Voice_Profile_class_the_snapshot_lacks
  Scenario: Slide 8 — the generated UML has the Voice Profile class
    Given the site's harness-schemas.svg
    When it is read
    Then it contains "VoiceProfileSchema"

  @test:test/coordinator/harnessed-kg-overview.test.ts::living_deck:_every_claim_about_the_KG_still_holds::slide_2_—_the_CDN_decision_is_recorded,_MADR-shaped,_with_at_least_two_real_options
  Scenario: Slide 2 — the CDN decision is recorded with at least two options
    Given the bean store and its archive
    When the bean "folio-assistant-l9v6" is found
    Then it exists
    And its "Considered options" section lists at least 2 options
    And it has a "Decision outcome" section

  @test:test/coordinator/harnessed-kg-overview.test.ts::living_deck:_every_claim_about_the_KG_still_holds::slide_4_—_the_SMART_Base_index_holds_at_least_the_25_logical_models_the_slide_shows
  Scenario: Slide 4 — the SMART Base index holds at least 25 logical models
    Given smart-base's FHIR artifact index
    When its StructureDefinitions in the category "Structures: Logical Models" are counted
    Then there are at least 25

  @test:test/coordinator/harnessed-kg-overview.test.ts::living_deck:_every_claim_about_the_KG_still_holds::slide_10_—_the_taxonomy_still_uses_smart-kg_as_its_example,_and_says_it_is_its_own_repository
  Scenario: Slide 10 — the taxonomy uses smart-kg as its example, as its own repository
    Given the site's repo-taxonomy page
    When it is read
    Then it calls smart-kg and smart-kg-tools the worked example
    And it says smart-kg is its own repository
    And the checkout holds no smart-kg directory

  @test:test/coordinator/harnessed-kg-overview.test.ts::living_deck:_every_claim_about_the_KG_still_holds::slide_13_—_three_taskable_actor_kinds,_plus_`external`,_and_the_skill_says_so
  Scenario: Slide 13 — three actor kinds plus external, and the role-model skill says so
    Given the actor definition schema and the role-model skill
    When the actor kinds are read
    Then they are agent, external, person and system
    And the skill says an actor is one of three kinds — human, agentic, mechanical
    And it says "external" is the fourth

  @test:test/coordinator/harnessed-kg-overview.test.ts::living_deck:_every_claim_about_the_KG_still_holds::every_generated_asset_the_deck_shows_exists
  Scenario: Every generated asset the deck shows exists
    Given the deck's slide sources, and the test skipped when a publish-built asset is absent because the site is not built
    When the assets they link through relative_url are collected
    Then there is at least one
    And each exists under the site root

  @test:test/coordinator/harnessed-kg-overview.test.ts::living_deck:_every_claim_about_the_KG_still_holds::every_deck_picture_the_page_shows_exists,_and_is_the_library_entry's_own_image
  Scenario: Every deck picture the page shows exists and is the library entry's own image
    Given the deck's slide sources and the library entry kg-folio-asst-2026-09-30
    When the kg-deck pictures they show are collected
    Then there is at least one
    And each exists under the site root
    And each is one of the entry's images
