# Specifies schemas/kg/kg-node.ts: displayTitle, the image and image-region
# schemas, imagesForRole and pickLayout (landing backdrops in several layouts),
# and the images and description of this instance's own declaration.
Feature: A node's images come in layout variants, and a renderer can tell which one it got

  @test:schemas/kg/kg-node.test.ts::displayTitle::title,_else_name,_else_id_—_never_blank_for_a_node_with_an_id
  Scenario: A node's display title is its title, else name, else id
    Given nodes with id, name and title; with id and name; and with id alone
    When their display titles are read
    Then they are the title, the name and the id respectively

  @test:schemas/kg/kg-node.test.ts::landing_backdrops_—_layout_variants::variants_are_grouped_by_role_and_keyed_by_layout
  Scenario: Variants of a role are keyed by layout
    Given a landing image for laptop, a landing image for mobile, and a mark with no layout
    When the images for the role "landing" are grouped
    Then the keys are laptop and mobile

  @test:schemas/kg/kg-node.test.ts::landing_backdrops_—_layout_variants::a_layout-independent_image_is_not_a_variant_of_anything
  Scenario: An image with no layout is not a variant
    Given only the mark, which has no layout
    When the images for the role "mark" are grouped
    Then there are none

  @test:schemas/kg/kg-node.test.ts::landing_backdrops_—_layout_variants::an_exact_layout_match_reports_NO_substitution
  Scenario: An exact layout match reports no substitution
    Given the laptop and mobile landing images
    When the "mobile" layout of "landing" is picked
    Then the landing-mobile image is returned
    And no substitution is reported

  @test:schemas/kg/kg-node.test.ts::landing_backdrops_—_layout_variants::a_missing_layout_falls_back_AND_says_which_it_used
  Scenario: A missing layout falls back and says which layout it used
    Given only the laptop landing image
    When the "mobile" layout of "landing" is picked
    Then the landing-laptop image is returned
    And the substitution reported is "laptop"

  @test:schemas/kg/kg-node.test.ts::landing_backdrops_—_layout_variants::no_variant_at_all_is_a_THIRD_state,_not_a_substitution
  Scenario: No variant at all returns nothing and reports no substitution
    Given only the mark
    When the "laptop" layout of "landing" is picked
    Then no image is returned
    And no substitution is reported

  @test:schemas/kg/kg-node.test.ts::landing_backdrops_—_layout_variants::a_region_running_off_the_edge_is_rejected,_not_clamped
  Scenario: A text region running off the image is refused
    Given a region with x 0.8 and w 0.5, and a region with y 0.9 and h 0.5
    When each is parsed with the image region schema
    Then each throws
    And the region x 0.205, y 0.285, w 0.625, h 0.235 parses

  @test:schemas/kg/kg-node.test.ts::landing_backdrops_—_layout_variants::a_zero-width_region_is_rejected
  Scenario: A zero-width region is refused
    Given a region of width 0
    When it is parsed
    Then it throws

  @test:schemas/kg/kg-node.test.ts::landing_backdrops_—_layout_variants::the_declared_laptop_variant_parses_with_its_region
  Scenario: The laptop variant parses with its text region
    Given the laptop landing image with its width, height and text region
    When it is parsed with the image schema
    Then it parses

  @test:schemas/kg/kg-node.test.ts::this_instance's_own_declaration::all_three_layouts_are_declared,_each_with_its_own_region
  Scenario: This instance declares three landing layouts, each with its own region
    Given this instance's declaration
    When its landing images are grouped by layout
    Then the layouts are card, laptop and mobile
    And their three text regions all differ
    And each has a positive width and height and a text region

  @test:schemas/kg/kg-node.test.ts::this_instance's_own_declaration::the_laptop_backdrop_is_declared,_with_its_measured_text_region_pinned
  Scenario: The laptop backdrop's region is pinned
    Given this instance's declaration
    When the "laptop" layout of "landing" is picked
    Then its src contains "landing-laptop"
    And its text region is x 0.33, y 0.25, w 0.53, h 0.28

  @test:schemas/kg/kg-node.test.ts::the_description_survives_Jekyll's_markdown_renderer::blocks_are_separated_by_BLANK_lines,_not_single_newlines
  Scenario: The description's blocks are separated by blank lines
    Given this instance's declared description
    Then it contains a blank line
    And no single newline stands outside a blank-line pair

  @test:schemas/kg/kg-node.test.ts::the_description_survives_Jekyll's_markdown_renderer::the_last_rung's_leading_character_is_U+00A0,_not_a_space
  Scenario: The last rung, c@t-harness, starts with a no-break space
    Given this instance's declared description split into blocks
    When the last block is taken
    Then it contains "c@t-harness"
    And it starts with U+00A0

  @test:schemas/kg/kg-node.test.ts::the_description_survives_Jekyll's_markdown_renderer::the_lead_block_comes_first,_since_typography_is_by_position
  Scenario: The lead block comes first
    Given this instance's declared description split into blocks
    Then the first block contains "computable adjudication"
    And there are five blocks
