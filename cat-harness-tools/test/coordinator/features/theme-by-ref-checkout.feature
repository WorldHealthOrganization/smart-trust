# Specifies themeByRef and instanceStickyThemes (schemas/ui/theme-by-ref.ts)
# over who-iris's own themes in the checkout.
Feature: An instance's own theme resolves by reference, and its sticky theme is found

  @test:test/coordinator/theme-by-ref-checkout.test.ts::over_this_repository::who-iris's_own_theme_resolves_by_reference,_with_no_WHO_value_in_the_platform
  Scenario: who-iris's iris-web resolves by reference and is not a platform theme
    Given the checkout
    When the theme "iris-web" of the instance "who-iris" is resolved
    Then it resolves, with kind "webpage"
    And the platform's themes include no "iris-web"

  @test:test/coordinator/theme-by-ref-checkout.test.ts::instanceStickyThemes_—_every_instance's_sticky_themes,_for_the_board_stylesheet::over_this_repository:_who-iris's_iris-sticky_is_found,_and_holds_iris-web's_accent
  Scenario: who-iris's iris-sticky is found and carries iris-web's accent
    Given the instance sticky themes of the checkout for cat-harness
    When who-iris's "iris-sticky" is found
    Then there are no conflicts
    And it is found
    And its accent equals the accent of who-iris's "iris-web"
