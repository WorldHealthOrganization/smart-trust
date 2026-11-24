# scripts/gen-themes-css.ts writes the sticky-theme stylesheet from the platform's themes and the sticky themes an instance declares, holding no instance's name or colour itself.
# Each Scenario names the test that executes it.
Feature: Instance sticky themes in the generated stylesheet

  @test:scripts/tests/ui/gen-themes-css.test.ts::an_instance_sticky_theme_passed_in_is_emitted::its_selector,_its_palette_roles_and_its_owner
  Scenario: An instance sticky theme passed in is emitted with its selector, palette and owner
    Given the sticky theme "acme-note" declared by the instance acme with accent "#aa0000"
    When the themes stylesheet is rendered with it
    Then it has a rule for the "acme-note" sticky theme
    And it sets the sticky accent to "#aa0000"
    And it labels the theme as declared by instance acme
    And it has a rule for the theme's card layout

  @test:scripts/tests/ui/gen-themes-css.test.ts::an_instance_sticky_theme_passed_in_is_emitted::with_none_passed,_the_output_is_the_platform's_alone_—_nothing_else_changed
  Scenario: With no instance theme passed in, the output is the platform's alone
    When the themes stylesheet is rendered with no instance themes
    Then it has a rule for every platform sticky theme
    And it labels nothing as declared by an instance

  @test:scripts/tests/ui/gen-themes-css.test.ts::the_generator_holds_no_instance's_name_or_colour::no_instance_literal_and_no_hex_value_in_the_source
  Scenario: The generator's source names no instance and holds no colour value
    Given the source of gen-themes-css.ts
    Then it does not mention who-iris, iris-sticky or iris-web
    And it holds no six-digit hex colour
