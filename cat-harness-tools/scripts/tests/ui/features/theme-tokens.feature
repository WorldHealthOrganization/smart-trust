# Every --fa-sticky-* token scripts/gen-themes-css.ts emits is read by the site's docs-ui.css,
# and no theme recolours the sticky-note priority stripe. Each Scenario names the test that executes it.
Feature: Theme tokens are consumed and the priority signal survives theming

  @test:scripts/tests/ui/theme-tokens.test.ts::no_token_is_emitted_and_unread::there_are_tokens_to_check_—_otherwise_this_proves_nothing
  Scenario: The generated themes stylesheet emits enough tokens for the check to mean something
    Given the rendered themes stylesheet
    When its distinct --fa-sticky-* role names are collected
    Then there are more than 4

  @test:scripts/tests/ui/theme-tokens.test.ts::no_token_is_emitted_and_unread::`--fa-sticky-%s`_is_consumed_by_the_stylesheet
  Scenario: Each emitted sticky token is consumed by the stylesheet
    Given each distinct --fa-sticky-* token the themes stylesheet emits
    When docs-ui.css is read
    Then it contains a var(--fa-sticky-<token> reference for that token

  @test:scripts/tests/ui/theme-tokens.test.ts::the_priority_signal_is_not_a_theme's_to_recolour::critical_and_high_keep_their_own_hue
  Scenario: Critical and high priorities keep their own hue under a theme
    Given docs-ui.css
    When the .fa-sticky-p-critical and .fa-sticky-p-high rules are read
    Then neither reads var(--fa-sticky-accent

  @test:scripts/tests/ui/theme-tokens.test.ts::the_priority_signal_is_not_a_theme's_to_recolour::the_stripe_keeps_a_non-colour_channel
  Scenario: The priority stripe keeps a width as a non-colour channel
    Given docs-ui.css
    Then it contains "border-left-width: 5px;"
