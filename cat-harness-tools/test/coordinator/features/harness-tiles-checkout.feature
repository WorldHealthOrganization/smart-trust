# Specifies harnessTiles (scripts/harness-tiles.ts) over the checkout: tile
# tone from an instance's own theme, the doc-group link, and page grounds.
Feature: A harness tile takes its tone, link and page ground from the instance's own declarations

  @test:test/coordinator/harness-tiles-checkout.test.ts::an_instance's_OWN_theme_tones_its_tile_(bean_v8n5)::who-iris's_tile_tone_is_the_hue_of_its_own_theme's_accent,_not_the_avatar's
  Scenario: who-iris's tile tone is the hue of its own theme's accent
    Given the tiles for who-iris, cat-harness and bootstrap
    And the theme "iris-sticky" of the instance "who-iris", resolved by reference
    When who-iris's tile is read
    Then the theme resolves
    And the tile's tone comes from "theme"
    And its tone is the hue of that theme's accent
    And none of its findings says "not installed"

  @test:test/coordinator/harness-tiles-checkout.test.ts::a_site_sub-graph_links_where_its_index.md_is_PUBLISHED_(fa#2739)::the_Doc_group_row_opens_the_published_start_page
  Scenario: The doc-group row opens the published start page
    Given the tile for cat-harness
    When its "doc-group" visualisation is read
    Then its path is "/docs/cat-harness/start/"

  @test:test/coordinator/harness-tiles-checkout.test.ts::each_harness_carries_its_page_ground_(bean_yj32,_owner_Q-DEP-2_A)::the_site_owner's_ground_is_the_fallback,_never_a_`/`_scope
  Scenario: The site owner's ground is the default and has no "/" scope
    Given the tiles for cat-harness, folio-assistant-core and bootstrap
    When cat-harness's page ground is read
    Then it is the site default
    And its scopes do not include "/"
    And its scopes include "/cat-harness/"

  @test:test/coordinator/harness-tiles-checkout.test.ts::each_harness_carries_its_page_ground_(bean_yj32,_owner_Q-DEP-2_A)::a_ground_is_all_three_crops_or_none
  Scenario: A page ground has all three crops or none
    Given the same tiles
    When each page ground with art is read
    Then its art has exactly the crops card, laptop and mobile
    And every crop's source starts with "/"

  @test:test/coordinator/harness-tiles-checkout.test.ts::each_harness_carries_its_page_ground_(bean_yj32,_owner_Q-DEP-2_A)::the_content_core's_ground_is_its_own_theme's_art,_not_the_platform's
  Scenario: The content core's ground is not the platform's
    Given the same tiles
    When the page grounds of folio-assistant-core and cat-harness are read
    Then folio-assistant-core has art
    And its laptop crop differs from cat-harness's
