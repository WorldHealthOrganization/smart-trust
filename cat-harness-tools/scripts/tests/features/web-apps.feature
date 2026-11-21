# The apps visualiser's pure parts: manifest, app checks, route clashes,
# chrome-less marking, the index, and translation. Each Scenario names the test
# that executes it.
Feature: Web apps

  Background:
    Given a web-app/0.1.0 manifest for "onboarding-game" with locales en and fr

  @test:scripts/tests/web-apps.test.ts::web-app/0.1.0::defaults:_npm,_the_build_script,_dist/,_no_chrome
  Scenario: Manifest defaults
    Then the build defaults to npm, script "build" and outDir "dist", with chrome "none"
    And install is "npm ci --no-audit --no-fund" and build is "npm run build"

  @test:scripts/tests/web-apps.test.ts::web-app/0.1.0::bun_installer
  Scenario: The bun installer
    Given the build installer is "bun"
    Then the install command starts "bun" and the build is "bun run build"

  @test:scripts/tests/web-apps.test.ts::web-app/0.1.0::refuses_an_id_that_is_not_a_route_segment,_an_outDir_that_climbs_out,_and_no_locales
  Scenario: Bad ids, outDirs and locales are refused
    Then id "Onboarding Game" is refused as not kebab case
    And outDir "../site" is refused as not inside the app
    And an empty locales list is refused

  @test:scripts/tests/web-apps.test.ts::web-app/0.1.0::refuses_chrome_other_than_none,_and_unknown_fields
  Scenario: Other chrome and unknown fields are refused
    Then chrome "navbar" is refused
    And an unknown field is refused

  @test:scripts/tests/web-apps.test.ts::readApp::a_complete_app_has_no_problem
  Scenario: A complete app reads cleanly
    Given an app directory with web-app.json, a package.json with a build script, and a lockfile
    Then reading it gives the parsed app and no problem

  @test:scripts/tests/web-apps.test.ts::readApp::names_what_is_missing,_in_words
  Scenario: Missing pieces are named
    Then an empty directory says "no web-app.json"
    And one with no build script says 'no "build" script'
    And one with no lockfile says "no lockfile"

  @test:scripts/tests/web-apps.test.ts::routeClashes::two_layers_declaring_one_app_id_are_both_named
  Scenario: Two layers declaring one app id clash
    Given layers "smart-trust" and "smart-trust-demo" both declaring app "onboarding-game"
    Then the clash names "smart-trust/onboarding-game" and "smart-trust-demo/game"
    And one app alone has no clash

  @test:scripts/tests/web-apps.test.ts::markChromeless::adds_the_navbar_opt-out_and_rendered-by,_once
  Scenario: A built page is marked chrome-less once
    When a page is marked chrome-less
    Then it holds the navbar opt-out and the rendered-by meta
    And marking it again changes nothing, with the opt-out once

  @test:scripts/tests/web-apps.test.ts::markChromeless::leaves_a_fragment_with_no_head_alone
  Scenario: A fragment with no head is left alone
    Then marking "<p>hi</p>" returns it unchanged

  @test:scripts/tests/web-apps.test.ts::indexHtml::links_a_built_app_relatively,_and_flags_one_over_its_budget
  Scenario: The index links a built app and flags its budget
    Given a built app of 40 MB with a 10 MB budget
    Then the index links "onboarding-game/" and says "over its 10 MB budget"

  @test:scripts/tests/web-apps.test.ts::indexHtml::names_an_app_it_could_not_build,_without_a_link
  Scenario: An unbuilt app is named without a link
    Given an app whose build failed
    Then the index has no link to it and says "Not built:"

  @test:scripts/tests/web-apps.test.ts::indexHtml::says_so_when_nothing_is_declared
  Scenario: No apps says so
    Then the index of no apps says "No directory of kind"

  @test:scripts/tests/web-apps.test.ts::translation_through_the_harness's_process::the_template_carries_one_ui-string_per_key,_the_key_as_msgctxt
  Scenario: The template carries one entry per key
    When the French template of a two-key catalog is made
    Then it has msgctxt "title.start", msgid "Live in {domains}." and Language fr
    And a template differing only in creation date is current, and no template is not

  @test:scripts/tests/web-apps.test.ts::translation_through_the_harness's_process::a_locale:_translated,_missing,_placeholder_dropped,_stale
  Scenario: Locale strings sort translated, placeholder errors, stale and missing
    Given a .po translating "title.start", dropping the placeholder of "splash.liveIn", and holding a stale "gone"
    Then the strings are "title.start" only, "splash.liveIn" is a placeholder error and "gone" is stale
    And an empty .po leaves both keys missing

  @test:scripts/tests/web-apps.test.ts::translation_through_the_harness's_process::a_catalog_must_be_flat_strings
  Scenario: A catalog must be flat strings
    Then a numeric value is refused with "not a non-empty string at a"
    And an array is refused with "flat JSON object"

  @test:scripts/tests/web-apps.test.ts::translation_through_the_harness's_process::templates_are_written_per_target_locale_in_the_layer,_and_the_build_writes_each_locale's_JSON
  Scenario: Templates per locale and built locale JSON
    Given an app with locales en, fr and ar and an English catalog
    Then the target locales are fr and ar
    And writing templates writes two, a check-only run writes none, the ar template exists, and a second write writes none
    When a French .po translates "title.start"
    Then injecting strings reports nothing, fr.json holds the translation and ar.json is empty

  @test:scripts/tests/web-apps.test.ts::an_app_the_mount_did_not_bring::is_listed_as_unmounted_and_never_read,_while_a_held_one_is_read
  Scenario: An unmounted app is listed, not read
    Given a layer declaring "held-game" (present, empty) and "away-game" (absent)
    Then "away-game" is unmounted
    And the declared apps are "held-game" only, with problem "no web-app.json"
