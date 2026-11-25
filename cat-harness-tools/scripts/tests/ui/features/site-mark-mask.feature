# The cat-harness site mark is a CSS mask painted from docs-ui.css; these checks tie its hue to the layer's declared avatar tone, its lightness to the avatar generator's targets, and its mask asset to the cat-harness.json declaration.
# Each Scenario names the test that executes it.
Feature: The site mark is themed from the declared tone

  @test:scripts/tests/ui/site-mark-mask.test.ts::the_site_mark_is_themed_from_the_DECLARED_tone::the_stylesheet's_hue_IS_cat-harness's_avatar_tone_—_not_a_second_number
  Scenario: The masked mark's hue is cat-harness's avatar tone
    Given the hsl colours in the rules following ".fa-site-mark--masked" in docs-ui.css
    When their distinct hues are collected
    Then there is at least one
    And the only hue is the avatar tone for "cat-harness"

  @test:scripts/tests/ui/site-mark-mask.test.ts::the_site_mark_is_themed_from_the_DECLARED_tone::both_schemes_are_painted,_with_the_avatar_generator's_own_targets
  Scenario: Both schemes are painted with the avatar generator's targets
    Given the hsl colours of the masked mark in docs-ui.css
    When their saturation and lightness pairs are read
    Then there are exactly 2
    And they are "42/72" and "46/34"

  @test:scripts/tests/ui/site-mark-mask.test.ts::the_site_mark_is_themed_from_the_DECLARED_tone::the_mask_asset_is_DECLARED,_not_just_present_on_disk
  Scenario: The mask asset is declared in cat-harness.json
    Given the images declared in cat-harness.json
    When the one with role "mark-mask" is found
    Then it exists
    And its src names "cat-mark-mask.svg"

  @test:scripts/tests/ui/site-mark-mask.test.ts::the_site_mark_is_themed_from_the_DECLARED_tone::the_declared_mask_file_exists_and_cuts_out_rather_than_painting_white
  Scenario: The declared mask file is a mask with no sage paint left in its drawing
    # Gap: that the face and whiskers are holes rather than white fills is not checked; only the mask element and the absence of the old sage colours are.
    Given the site's assets/img/icons/cat-mark-mask.svg
    When it is read
    Then it contains a "<mask" element and a shape using mask "url(#markMask)"
    And with comments stripped it contains neither "#6f8b66" nor "#cfe0c2"
    And the unstripped file still names "#6f8b66" in its comments
