# Specifies the themes stylesheet (built by ensureThemesCss when absent) and
# instanceStickyThemes (schemas/ui/theme-by-ref.ts) over the checkout.
Feature: The themes stylesheet carries every instance sticky theme with its accent

  @test:test/coordinator/gen-themes-css-checkout.test.ts::the_committed_stylesheet_carries_every_instance_sticky_theme_here::there_is_at_least_one_to_check,_and_no_collision
  Scenario: There are instance sticky themes and no collision
    Given the checkout's instance sticky themes for cat-harness
    When they are collected
    Then there is at least one
    And there are no conflicts

  @test:test/coordinator/gen-themes-css-checkout.test.ts::the_committed_stylesheet_carries_every_instance_sticky_theme_here::%s_has_a_block_with_its_own_accent_—_a_card_citing_it_does_not_fall_back_to_the_default
  Scenario: Each instance sticky theme has a block with its own accent
    Given the themes stylesheet and each instance sticky theme, one test per theme
    When the stylesheet's block for that theme's id is found
    Then it exists
    And it sets "--fa-sticky-accent" to the theme's accent colour
