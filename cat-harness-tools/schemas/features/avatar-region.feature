# schemas/avatar-region.test.ts checks an image's "avatarRegion" in schemas/kg/kg-node.ts:
# a box declared per image that must be square in pixels and inside the image, and this
# repository's declared boxes. Each Scenario names the test that executes it.
Feature: Image avatar regions

  @test:schemas/avatar-region.test.ts::this_repository's_seven_measured_boxes::every_card_crop_carries_one_—_the_set_is_complete,_not_partial
  Scenario: Every card crop in this repository carries an avatar region
    Given the images of this repository's own declaration
    When the images with layout "card" are selected
    Then there is at least one card image
    And no card image lacks an avatar region

  @test:schemas/avatar-region.test.ts::this_repository's_seven_measured_boxes::only_CARD_crops_carry_one
  Scenario: Only card crops carry an avatar region
    Given the images of this repository's declaration that carry an avatar region
    Then none of them has a layout other than "card"

  @test:schemas/avatar-region.test.ts::this_repository's_seven_measured_boxes::each_one_validates,_which_is_squareness_and_bounds_together
  Scenario: Each declared avatar region validates
    Given the images of this repository's declaration that carry an avatar region
    When each is parsed with the image schema
    Then no image produces a validation issue

  @test:schemas/avatar-region.test.ts::this_repository's_seven_measured_boxes::each_names_a_file_that_exists
  Scenario: Each image with an avatar region names a file that exists
    Given the images of this repository's declaration that carry an avatar region
    Then each image's "src" exists as a file under the repository root

  @test:schemas/avatar-region.test.ts::this_repository's_seven_measured_boxes::no_box_is_the_whole_frame
  Scenario: No declared avatar region is the whole frame
    Given the images of this repository's declaration that carry an avatar region
    Then no region has both its width and its height at 1 or more

  @test:schemas/avatar-region.test.ts::a_box_that_is_not_square_is_refused::wider_than_tall
  Scenario: A box wider than tall is refused as not square
    Given a square 1254px card image
    When it declares an avatar region 0.5 wide and 0.25 tall
    Then the image schema refuses it
    And the first issue's message contains "not square"

  @test:schemas/avatar-region.test.ts::a_box_that_is_not_square_is_refused::taller_than_wide
  Scenario: A box taller than wide is refused
    Given a square 1254px card image
    When it declares an avatar region 0.25 wide and 0.5 tall
    Then the image schema refuses it

  @test:schemas/avatar-region.test.ts::a_box_that_is_not_square_is_refused::square_IS_accepted_—_the_assertions_above_pass_for_a_schema_that_refuses_everything
  Scenario: A square box is accepted
    Given a square 1254px card image
    When it declares an avatar region at x 0, y 0.46, 0.5 wide and 0.5 tall
    Then the image schema accepts it

  @test:schemas/avatar-region.test.ts::a_box_that_is_not_square_is_refused::equal_fractions_on_a_NON-square_image_are_refused
  Scenario: Equal fractions on a non-square image are refused
    Given a 1671 by 941 pixel card image
    When it declares an avatar region 0.4 wide and 0.4 tall
    Then the image schema refuses it

  @test:schemas/avatar-region.test.ts::a_box_that_is_not_square_is_refused::and_the_matching_PIXEL-square_box_on_that_image_is_accepted
  Scenario: A pixel-square box on a non-square image is accepted
    Given a 1671 by 941 pixel card image
    When it declares an avatar region 0.4 wide and 0.7103 tall
    Then the image schema accepts it

  @test:schemas/avatar-region.test.ts::a_box_that_is_not_square_is_refused::the_tolerance_is_a_pixel,_and_it_is_not_a_licence
  Scenario: The squareness tolerance is under a pixel's worth, not a licence
    Given a square 1254px card image
    When its avatar region is 0.5 wide and taller by half the pixel tolerance
    Then the image schema accepts it
    And a region 0.5 wide and 0.52 tall is refused

  @test:schemas/avatar-region.test.ts::an_unverifiable_box_is_refused,_not_accepted_unchecked::no_width
  Scenario: An avatar region on an image with no width is refused
    Given an image with a height of 1254 but no width
    When it declares a 0.5 by 0.5 avatar region
    Then the image schema refuses it
    And the first issue's message names "`width` and `height`"

  @test:schemas/avatar-region.test.ts::an_unverifiable_box_is_refused,_not_accepted_unchecked::no_dimensions_at_all
  Scenario: An avatar region on an image with no dimensions is refused
    Given an image with neither width nor height
    When it declares a 0.5 by 0.5 avatar region
    Then the image schema refuses it

  @test:schemas/avatar-region.test.ts::an_unverifiable_box_is_refused,_not_accepted_unchecked::but_an_image_with_NO_avatarRegion_needs_no_dimensions
  Scenario: An image with no avatar region needs no dimensions
    Given an image "mark" with src "m.svg" and no width, height or avatar region
    Then the image schema accepts it

  @test:schemas/avatar-region.test.ts::it_does_not_disturb_textRegion::a_wide_shallow_textRegion_is_still_fine_—_squareness_is_avatar-only
  Scenario: A wide, shallow text region is still accepted
    Given a square 1254px card image
    When it declares a text region 0.58 wide and 0.235 tall
    Then the image schema accepts it

  @test:schemas/avatar-region.test.ts::it_does_not_disturb_textRegion::both_regions_on_one_image,_each_judged_by_its_own_rule
  Scenario: Text and avatar regions on one image are each judged by their own rule
    Given a square 1254px card image
    When it declares a wide, shallow text region and a square avatar region
    Then the image schema accepts it

  @test:schemas/avatar-region.test.ts::it_does_not_disturb_textRegion::out_of_bounds_is_still_refused,_and_the_message_names_neither_field
  Scenario: An out-of-bounds avatar region is refused with a field-neutral message
    Given a square 1254px card image
    When it declares a 0.5 by 0.5 avatar region starting at x 0.8
    Then the image schema refuses it
    And the first issue's message is "region extends past the edge of the image"
