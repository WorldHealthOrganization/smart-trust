# Specifies schemas/ui/theme-by-ref.ts: themeByRef, which resolves a theme
# reference against the instance that owns it (bean v8n5), the miss it
# reports when it cannot, and instanceStickyThemes, which collects every
# instance's sticky themes for the board stylesheet. Exercised over synthetic
# instances in temporary repositories.
Feature: A theme reference resolves against its owner, and each miss names its own repair

  @test:schemas/ui/theme-by-ref.test.ts::the_owner_decides_where_a_reference_resolves::{instance,_themeId}_resolves_against_that_instance's_declared_themes
  Scenario: A reference naming an instance resolves against that instance's themes
    Given a repository with instance "acme" whose themes module declares webpage theme "acme-web" with accent "#aa0000"
    When the reference instance "acme", theme "acme-web" is resolved
    Then the theme's accent is "#aa0000"
    And its owner is "acme"

  @test:schemas/ui/theme-by-ref.test.ts::the_owner_decides_where_a_reference_resolves::a_bare_id_means_the_CITING_instance's_own
  Scenario: A bare theme id resolves against the citing instance
    Given the "acme" repository with theme "acme-web"
    When the bare reference "acme-web" is resolved from citing instance "acme"
    Then the theme resolved is "acme-web"

  @test:schemas/ui/theme-by-ref.test.ts::the_owner_decides_where_a_reference_resolves::a_bare_platform_id_still_resolves_from_an_instance_that_owns_none_of_that_name_—_nothing_read_before_B8_breaks
  Scenario: A bare platform id resolves from an instance that owns no theme of that name
    Given the "acme" repository with theme "acme-web"
    When the bare id of the first platform theme is resolved from citing instance "acme"
    Then that platform theme is resolved
    And its owner is "cat-harness"

  @test:schemas/ui/theme-by-ref.test.ts::the_owner_decides_where_a_reference_resolves::no_instance_named,_or_the_platform_named,_is_the_platform's_table
  Scenario: No instance, or the platform named, resolves from the platform's table
    Given a repository with instance "acme" and no themes directory
    When the first platform theme id is resolved with no instance and no citing instance
    Then it resolves
    And with instance "cat-harness" named it resolves

  @test:schemas/ui/theme-by-ref.test.ts::each_miss_is_its_own_repair,_and_none_is_silently_the_platform's::an_explicit_instance_that_does_not_own_the_theme_does_NOT_fall_back_to_the_platform
  Scenario: An explicit instance that does not own the theme does not fall back to the platform
    Given the "acme" repository with theme "acme-web"
    When instance "acme" with the first platform theme id is resolved
    Then it does not resolve
    And the miss is "no-such-theme"

  @test:schemas/ui/theme-by-ref.test.ts::each_miss_is_its_own_repair,_and_none_is_silently_the_platform's::an_instance_nobody_declares
  Scenario: An undeclared instance is its own miss
    Given a repository with only instance "acme"
    When instance "nope" with theme "x" is resolved
    Then the miss is "no-such-instance"

  @test:schemas/ui/theme-by-ref.test.ts::each_miss_is_its_own_repair,_and_none_is_silently_the_platform's::an_instance_with_no_themes_directory
  Scenario: An instance with no themes directory is its own miss
    Given a repository with instance "acme" and no themes directory
    When instance "acme" with theme "x" is resolved
    Then the miss is "no-themes-directory"

  @test:schemas/ui/theme-by-ref.test.ts::each_miss_is_its_own_repair,_and_none_is_silently_the_platform's::a_themes_directory_with_no_conventional_module
  Scenario: A themes directory with no themes module is its own miss
    Given a repository with instance "acme" declaring a themes directory but no themes.ts
    When instance "acme" with theme "x" is resolved
    Then the miss is "no-themes-module"
    And its explanation names "INSTANCE_THEMES"

  @test:schemas/ui/theme-by-ref.test.ts::instanceStickyThemes_—_every_instance's_sticky_themes,_for_the_board_stylesheet::finds_an_instance's_STICKY_themes_by_declaration_and_leaves_its_other_kinds_out
  Scenario: Only an instance's sticky themes are collected
    Given a repository with instance "acme" declaring a webpage theme and sticky theme "acme-note"
    When the instance sticky themes are collected
    Then they are "acme:acme-note" alone
    And there are no conflicts

  @test:schemas/ui/theme-by-ref.test.ts::instanceStickyThemes_—_every_instance's_sticky_themes,_for_the_board_stylesheet::an_instance_theme_that_shadows_a_platform_id_is_REFUSED_with_a_finding,_not_emitted
  Scenario: A sticky theme shadowing a platform id is refused with a finding
    Given a repository with instance "acme" declaring sticky theme "pale-sage"
    When the instance sticky themes are collected against the platform theme ids
    Then no theme is collected
    And the one conflict is "shadows-platform" for "acme" and "pale-sage"
    And its explanation says "platform theme id"

  @test:schemas/ui/theme-by-ref.test.ts::instanceStickyThemes_—_every_instance's_sticky_themes,_for_the_board_stylesheet::two_instances_declaring_one_id_are_REFUSED_together_—_neither_wins_by_order
  Scenario: Two instances declaring one sticky id are both refused
    Given instances "acme" and "zeta" both declaring sticky theme "shared-note"
    When the instance sticky themes are collected
    Then no theme is collected
    And the one conflict is "duplicate-across-instances" for "shared-note" naming "acme" and "zeta"
