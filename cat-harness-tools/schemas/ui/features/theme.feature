# Specifies schemas/ui/theme.ts: the folio-theme/v1 schema in its declared
# and resolved forms (all three layouts, a gradient's two stops, a backdrop
# that names an image role and a scrim), the CSS custom properties a theme
# contributes, resolution of a backdrop against an instance's images, and
# hexHue (bean v8n5).
Feature: A resolved theme has all three layouts, and its backdrop names a role with a scrim

  Background:
    Given a sticky theme "pale-sage" with a full palette and the same geometry for laptop, mobile and card

  @test:schemas/ui/theme.test.ts::all_three_layouts,_or_invalid::a_complete_theme_parses,_in_both_forms
  Scenario: A complete theme parses in both forms
    When it is parsed with the declared and with the resolved theme schema
    Then it parses with each

  @test:schemas/ui/theme.test.ts::all_three_layouts,_or_invalid::a_theme_missing_`%s`_is_REFUSED,_not_degraded
  Scenario: A resolved theme missing any one layout is refused
    When the theme with each one layout removed in turn is parsed with the resolved schema
    Then each is refused

  @test:schemas/ui/theme.test.ts::all_three_layouts,_or_invalid::and_the_DECLARED_form_accepts_it,_which_is_the_point_of_inheriting
  Scenario: The declared form accepts a theme with one layout
    Given the theme with only a laptop layout
    Then the declared schema accepts it
    And the resolved schema refuses it

  @test:schemas/ui/theme.test.ts::all_three_layouts,_or_invalid::the_refusal_can_say_WHICH_layout_is_missing
  Scenario: The missing layouts can be named
    When the missing layouts are asked of the theme with laptop and card only
    Then they are "mobile"
    And for an empty object and for null they are every theme layout

  @test:schemas/ui/theme.test.ts::all_three_layouts,_or_invalid::a_complete_theme_names_none
  Scenario: A complete theme is missing no layout
    When the missing layouts are asked of the complete theme
    Then there are none

  @test:schemas/ui/theme.test.ts::the_palette_is_roles,_and_a_gradient_needs_both_stops::one_gradient_stop_is_refused
  Scenario: A resolved theme with one gradient stop is refused
    Given the theme whose palette has gradientFrom but no gradientTo
    When it is parsed with the resolved schema
    Then it is refused

  @test:schemas/ui/theme.test.ts::the_palette_is_roles,_and_a_gradient_needs_both_stops::...and_the_declared_form_permits_it,_because_the_other_stop_may_be_inherited
  Scenario: The declared form permits one gradient stop
    Given the theme whose palette has gradientFrom but no gradientTo
    When it is parsed with the declared schema
    Then it parses

  @test:schemas/ui/theme.test.ts::the_palette_is_roles,_and_a_gradient_needs_both_stops::both_stops,_or_neither,_are_fine
  Scenario: Both gradient stops, or neither, parse
    When the theme with gradientFrom and gradientTo is parsed with the declared schema
    Then it parses
    And the theme with no gradient parses

  @test:schemas/ui/theme.test.ts::the_palette_is_roles,_and_a_gradient_needs_both_stops::an_unknown_palette_key_is_refused_rather_than_ignored
  Scenario: An unknown palette key is refused
    Given the theme whose palette has a misspelt key "surfase"
    When it is parsed with the declared schema
    Then it is refused

  @test:schemas/ui/theme.test.ts::ids_and_names::an_id_is_lowercase_kebab-case,_because_the_CSS_class_is_built_from_it
  Scenario: A theme id is lowercase kebab-case
    When the theme with id "Pale Sage" is parsed
    Then it is refused
    And with id "dusty-carolina-blue" it parses

  @test:schemas/ui/theme.test.ts::ids_and_names::a_theme_must_declare_its_$schema_tag
  Scenario: A theme must declare its schema tag
    When the theme with $schema undefined is parsed
    Then it is refused

  @test:schemas/ui/theme.test.ts::the_CSS_a_theme_contributes_is_roles,_not_colour_names::every_emitted_property_is_an_`--fa-sticky-*`_role
  Scenario: Every emitted CSS property is a sticky role
    When the CSS variables of the resolved theme are emitted
    Then every line starts with "--fa-sticky-"

  @test:schemas/ui/theme.test.ts::the_CSS_a_theme_contributes_is_roles,_not_colour_names::a_theme_without_a_gradient_emits_no_gradient_properties
  Scenario: A theme without a gradient emits no gradient property
    When the CSS variables of the resolved theme are emitted
    Then they do not contain "grad-from"

  @test:schemas/ui/theme.test.ts::the_CSS_a_theme_contributes_is_roles,_not_colour_names::a_gradated_theme_emits_both_stops
  Scenario: A gradated theme emits both stops
    Given the resolved theme with gradientFrom "#fff" and gradientTo "#e8eee6"
    When its CSS variables are emitted
    Then they contain "--fa-sticky-grad-from: #fff;" and "--fa-sticky-grad-to: #e8eee6;"

  @test:schemas/ui/theme.test.ts::a_backdrop_names_a_ROLE,_never_a_path::a_theme_may_carry_one,_and_it_parses
  Scenario: A theme may carry a backdrop
    When the theme with backdrop role "landing" and a scrim is parsed with the resolved schema
    Then its backdrop image role is "landing"

  @test:schemas/ui/theme.test.ts::a_backdrop_names_a_ROLE,_never_a_path::a_theme_without_one_is_ordinary,_not_invalid
  Scenario: A theme without a backdrop parses
    When the theme is parsed with the resolved schema
    Then its backdrop is undefined

  @test:schemas/ui/theme.test.ts::a_backdrop_names_a_ROLE,_never_a_path::a_`src`_on_a_backdrop_is_REFUSED
  Scenario: A backdrop with a src is refused
    When the theme whose backdrop also has a src path is parsed with the resolved schema
    Then parsing throws

  @test:schemas/ui/theme.test.ts::a_backdrop_names_a_ROLE,_never_a_path::a_backdrop_without_a_scrim_is_REFUSED
  Scenario: A backdrop without a scrim is refused
    When the theme whose backdrop has a role but no scrim is parsed with the resolved schema
    Then parsing throws

  @test:schemas/ui/theme.test.ts::the_scrim_is_what_makes_ink_over_art_legible,_and_the_number_is_measured::grumpy-cat's_ink_clears_AAA_over_its_scrim_on_the_DARKEST_possible_art
  Scenario: The shipped grumpy-cat ink clears AAA over its shipped scrim on black art
    Given the shipped "grumpy-cat" theme, which has a backdrop scrim
    And its scrim composited over pure black
    When the contrast of its palette ink on it is computed
    Then it is at least 7:1

  @test:schemas/ui/theme.test.ts::the_scrim_is_what_makes_ink_over_art_legible,_and_the_number_is_measured::...and_on_the_LIGHTEST,_since_a_scrim_cuts_both_ways
  Scenario: Ink clears AAA over the scrim on white art
    Given the same scrim composited over pure white
    When the contrast of ink "#221f1b" on it is computed
    Then it is at least 7:1

  @test:schemas/ui/theme.test.ts::the_scrim_is_what_makes_ink_over_art_legible,_and_the_number_is_measured::the_check_CAN_fire_—_a_thin_scrim_fails_it
  Scenario: A thin scrim fails the contrast check
    Given the scrim colour at alpha 0.15 composited over pure black
    When the contrast of ink "#221f1b" on it is computed
    Then it is below 7:1

  @test:schemas/ui/theme.test.ts::the_scrim_is_what_makes_ink_over_art_legible,_and_the_number_is_measured::a_theme_with_a_backdrop_emits_the_scrim_as_a_role,_and_one_without_emits_none
  Scenario: The scrim is emitted only for a theme with a backdrop
    When the CSS variables of the theme with a backdrop are emitted
    Then they contain "--fa-sticky-scrim:"
    And those of the theme without one do not contain "--fa-sticky-scrim"

  @test:schemas/ui/theme.test.ts::resolution_against_an_instance's_images_—_three_outcomes,_not_two::all_three_declared_resolves_to_all_three
  Scenario: A backdrop with every layout declared resolves to all of them
    Given images of role "landing" for every theme layout
    When the theme with a "landing" backdrop is resolved against them
    Then it is not "none", nothing is missing, and there is art for every layout

  @test:schemas/ui/theme.test.ts::resolution_against_an_instance's_images_—_three_outcomes,_not_two::no_backdrop_is_`none`,_and_NOT_a_gap
  Scenario: A theme with no backdrop resolves to none
    Given images of role "landing" for every theme layout
    When the theme without a backdrop is resolved against them
    Then it is "none"
    And nothing is missing

  @test:schemas/ui/theme.test.ts::resolution_against_an_instance's_images_—_three_outcomes,_not_two::a_missing_`%s`_refuses_the_WHOLE_backdrop
  Scenario: A missing layout refuses the whole backdrop
    When the theme with a "landing" backdrop is resolved against the images less each one layout in turn
    Then that layout alone is missing
    And there is no art at all
    And it is not "none"

  @test:schemas/ui/theme.test.ts::resolution_against_an_instance's_images_—_three_outcomes,_not_two::an_instance_declaring_NO_images_at_all_reports_all_three_missing
  Scenario: An instance declaring no images reports every layout missing
    When the theme with a "landing" backdrop is resolved against no images
    Then every theme layout is missing
    And it is not "none"

  @test:schemas/ui/theme.test.ts::resolution_against_an_instance's_images_—_three_outcomes,_not_two::images_of_ANOTHER_role_are_ignored
  Scenario: Images of another role are ignored
    Given the "landing" images plus a "mark" image for the laptop layout
    When the theme with a "landing" backdrop is resolved against them
    Then the laptop art is the landing-laptop image

  @test:schemas/ui/theme.test.ts::resolution_against_an_instance's_images_—_three_outcomes,_not_two::an_image_of_the_right_role_but_NO_layout_is_ignored
  Scenario: An image of the right role but no layout is ignored
    Given one "landing" image with no layout
    When the theme with a "landing" backdrop is resolved against it
    Then every theme layout is missing

  @test:schemas/ui/theme.test.ts::hexHue_—_a_palette_colour_as_a_tile_tone_(bean_v8n5)::the_primaries_and_secondaries_land_on_their_angles
  Scenario: Primaries and secondaries land on their angles
    When the hue of red, yellow, green, cyan, blue and magenta is computed
    Then they are 0, 60, 120, 180, 240 and 300

  @test:schemas/ui/theme.test.ts::hexHue_—_a_palette_colour_as_a_tile_tone_(bean_v8n5)::a_hue_just_below_red_wraps_to_the_high_end_rather_than_going_negative
  Scenario: A hue just below red wraps to the high end
    When the hue of "#ff0010" is computed
    Then it is 356

  @test:schemas/ui/theme.test.ts::hexHue_—_a_palette_colour_as_a_tile_tone_(bean_v8n5)::short_form,_case_and_whitespace
  Scenario: Short form, upper case and surrounding whitespace are read
    When the hue of "#F00" and of " #00F " is computed
    Then they are 0 and 240

  @test:schemas/ui/theme.test.ts::hexHue_—_a_palette_colour_as_a_tile_tone_(bean_v8n5)::a_grey_has_no_hue,_and_that_is_not_red
  Scenario: A grey has no hue
    When the hue of "#ffffff" and of "#212121" is computed
    Then each is undefined

  @test:schemas/ui/theme.test.ts::hexHue_—_a_palette_colour_as_a_tile_tone_(bean_v8n5)::a_value_that_is_not_a_hex_colour_is_not_guessed_at
  Scenario: A value that is not a hex colour has no hue
    When the hue of "rgb(0,0,255)", "#12345" and "blue" is computed
    Then each is undefined

  @test:schemas/ui/theme.test.ts::hexHue_—_a_palette_colour_as_a_tile_tone_(bean_v8n5)::a_mid-range_blue_computes_to_the_expected_angle_(#008dc9_→_198°)
  Scenario: A mid-range blue computes to its angle
    When the hue of "#008dc9" is computed
    Then it is 198
