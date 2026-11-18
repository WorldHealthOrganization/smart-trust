# scripts/check-navbar-consistency.ts (check:navbar-consistency) checks each harness's
# navbar icons and themes, keeping the instance-image and tile-glyph namespaces apart.
# Each Scenario names the test that executes it.
Feature: Navbar consistency check

  @test:scripts/tests/ui/navbar-consistency.test.ts::the_repository_is_clean_under_the_blocking_families::`--check`_finds_no_blocking_defect_as_committed_—_and_is_never_0_while_blind
  Scenario: The committed repository has no blocking navbar defect and never passes while blind
    When the check is run with "--check" on the repository
    Then its output contains "instances read"
    And it does not exit 1
    And if the output shows an unknown marker it exits 2
    And if it exits 2 the output says "could not be made"

  @test:scripts/tests/ui/navbar-consistency.test.ts::the_repository_is_clean_under_the_blocking_families::every_count_in_the_report_carries_its_denominator
  Scenario: The report's resolving-icon count carries its denominator
    # Gap: only the "...with a resolving icon" line is checked, not every count
    When the check is run on the repository
    Then the output reads "...with a resolving icon N of M"

  @test:scripts/tests/ui/navbar-consistency.test.ts::the_two_namespaces_stay_separate::an_unloadable_declaration_REFUSES_and_is_not_re-judged_here
  Scenario: An unloadable declaration makes the check refuse rather than re-judge it
    Given a copy of the tree where cat-harness.json's icon is "no-such-image"
    When the check is run with "--check" on the copy
    Then it exits 2
    And the output says "cannot read the declaration"
    And it does not mention "dangling-instance-icon" or "✓ no finding"

  @test:scripts/tests/ui/navbar-consistency.test.ts::the_two_namespaces_stay_separate::a_resolving_instance_icon_is_NOT_reported_as_a_glyph_miss
  Scenario: A resolving instance icon is not reported as a glyph miss
    When the check is run on the repository
    Then the output mentions neither "unregistered-tile-icon" nor "dangling-instance-icon"

  @test:scripts/tests/ui/navbar-consistency.test.ts::the_two_namespaces_stay_separate::an_unregistered_TILE_icon_fails_(a_name_absent_from_the_registry)
  Scenario: A tile icon absent from the glyph registry fails
    Given a copy of the tree where the beans tile's icon is "no-such-glyph"
    When the check is run with "--check" on the copy
    Then the output reports "unregistered-tile-icon"
    And it exits 1

  @test:scripts/tests/ui/navbar-consistency.test.ts::the_fallback_is_measured,_not_graded::tiles_naming_no_glyph_are_reported_per_instance,_with_a_denominator
  Scenario: Tiles naming no glyph are reported per instance with a denominator, as advisory
    Given a copy of the tree where cat-harness's tools tile names no icon
    When the check is run on the copy
    Then the output reports "tile-without-icon: cat-harness"
    And it reads "N of M declared tile(s) name no icon"
    And it exits 0

  @test:scripts/tests/ui/navbar-consistency.test.ts::the_fallback_is_measured,_not_graded::it_fails_under_--strict,_so_the_gate_can_opt_in_later
  Scenario: A tile naming no glyph fails under strict mode
    Given a copy of the tree where cat-harness's tools tile names no icon
    When the check is run with "--strict" on the copy
    Then it exits 1

  @test:scripts/tests/ui/navbar-consistency.test.ts::the_fallback_is_measured,_not_graded::the_real_corpus_has_no_declared_tile_on_the_fallback
  Scenario: No declared tile in the real corpus falls back to the default glyph
    When the check is run on the repository
    Then the output does not mention "tile-without-icon"

  @test:scripts/tests/ui/navbar-consistency.test.ts::the_fallback_is_measured,_not_graded::the_declared-tile_denominator_is_NOT_the_rendered_one
  Scenario: The declared-tile count stays below the rendered count
    When the check is run on the repository
    Then the output has a "declared tiles" count
    And that count is less than 20

  @test:scripts/tests/ui/navbar-consistency.test.ts::one_artefact,_one_glyph,_across_both_registries::a_row/tile_disagreement_fails
  Scenario: A row and tile glyph disagreement fails
    Given a copy of the tree where navbar-row.js maps "beans" to the net glyph
    When the check is run with "--check" on the copy
    Then the output reports "registry-disagreement"
    And it exits 1

  @test:scripts/tests/ui/navbar-consistency.test.ts::could-not-determine_is_never_green::a_renamed_%s_REFUSES_(exit_2),_it_does_not_pass
  Scenario: A renamed glyph registry makes the check refuse
    Given a copy of the tree where the registry variable is renamed, for each of "TILE_GLYPHS" and "ROW_GLYPHS"
    When the check is run with "--check" on the copy
    Then it exits 2, not 1
    And the output says "could not locate"

  @test:scripts/tests/ui/navbar-consistency.test.ts::the_themes_set_is_iterated,_not_hardcoded::it_reports_the_denominator_and_NAMES_the_whole_set
  Scenario: The themes report gives its denominator and names every theming instance
    When the check is run on the repository
    Then the output reads "declaring a themes graph N of M"
    And it names "who-iris" and "smart-base"
    And it exits 0

  @test:scripts/tests/ui/navbar-consistency.test.ts::the_themes_set_is_iterated,_not_hardcoded::the_size-1_NOTE_is_gone,_and_the_comparison_it_promised_now_runs
  Scenario: The size-1 note is gone and the kind-for-kind comparison runs
    When the check is run on the repository
    Then the output does not contain "issues no verdict" or "covered the day it declares one"
    And it reads "kind for kind N (instance, kind) pair(s) judged, M could not be"

  @test:scripts/tests/ui/navbar-consistency.test.ts::the_themes_set_is_iterated,_not_hardcoded::the_themes_denominator_is_read_from_`graphTypologies`,_not_a_guessed_key
  Scenario: The themes count is non-zero on the real corpus
    # Gap: the source key graphTypologies is not inspected; only a count above 0 is asserted
    When the check is run on the repository
    Then the "declaring a themes graph" count is greater than 0

  @test:scripts/tests/ui/navbar-consistency.test.ts::the_denominator_comes_from_the_declared_enumerator::`layerRootsIn`_excludes_the_repository_root_and_graph_declarations
  Scenario: The instance enumerator excludes the repository root and graph declarations
    When the instance roots of the repository are enumerated
    Then the repository root is not among them
    And there is more than one
    And none is named "beans", "interaction" or "todos"

  @test:scripts/tests/ui/navbar-consistency.test.ts::the_denominator_comes_from_the_declared_enumerator::the_report's_denominator_equals_what_the_enumerator_returns
  Scenario: The report's instance count equals the enumerator's
    Given the number of instance roots the enumerator returns
    When the check is run on the repository
    Then the output reads "instances read" followed by that number

  @test:scripts/tests/ui/navbar-consistency.test.ts::kind_for_kind_—_`pnn5`,_the_owner's_option_1::a_declared_webpage_theme_that_the_pages_select_is_clean
  Scenario: A declared webpage theme the pages select is clean
    Given instance "iris" declaring webpage theme "iris-web" and wiring that selects it
    When the theme kinds are judged
    Then there are no findings and no unknowns
    And 1 pair is judged

  @test:scripts/tests/ui/navbar-consistency.test.ts::kind_for_kind_—_`pnn5`,_the_owner's_option_1::FALSIFICATION:_a_declared_webpage_theme_with_no_data_entry_falls_back,_and_blocks
  Scenario: A declared webpage theme with no data entry is a blocking fallback
    Given instance "iris" declaring webpage theme "iris-web" and webpage data with no entry
    When the theme kinds are judged
    Then there is one blocking "theme-fallback" finding for "iris · webpage"

  @test:scripts/tests/ui/navbar-consistency.test.ts::kind_for_kind_—_`pnn5`,_the_owner's_option_1::FALSIFICATION:_the_pages_wearing_ANOTHER_theme_is_a_fallback_too
  Scenario: Pages wearing another theme is a blocking fallback
    Given instance "iris" declaring webpage theme "iris-web" and webpage data selecting "old-web"
    When the theme kinds are judged
    Then the first finding is a blocking "theme-fallback"
    And its detail names "old-web"

  @test:scripts/tests/ui/navbar-consistency.test.ts::kind_for_kind_—_`pnn5`,_the_owner's_option_1::FALSIFICATION:_head_custom_no_longer_reading_the_data_is_a_fallback_for_every_instance
  Scenario: A head include that no longer reads the data is a blocking fallback
    # Gap: only one instance is judged, so "every instance" is not shown
    Given instance "iris" declaring webpage theme "iris-web" and wiring whose head does not consume the data
    When the theme kinds are judged
    Then the first finding is a blocking "theme-fallback"

  @test:scripts/tests/ui/navbar-consistency.test.ts::kind_for_kind_—_`pnn5`,_the_owner's_option_1::a_declared_kind_with_no_instance-scoped_surface_is_reported,_not_passed
  Scenario: A declared theme kind with no instance-scoped surface is reported
    Given instance "iris" declaring webpage, sticky and publication themes
    When the theme kinds are judged
    Then 3 pairs are judged
    And the findings are non-blocking "theme-kind-unconsumed" for "iris · sticky" and "iris · publication"

  @test:scripts/tests/ui/navbar-consistency.test.ts::kind_for_kind_—_`pnn5`,_the_owner's_option_1::a_kind_the_instance_does_NOT_declare_is_not_judged_—_the_default_is_allowed_there
  Scenario: A kind the instance does not declare is not judged
    Given instance "plain" declaring no themes
    When the theme kinds are judged
    Then there are no findings, no unknowns and 0 pairs

  @test:scripts/tests/ui/navbar-consistency.test.ts::kind_for_kind_—_`pnn5`,_the_owner's_option_1::an_unreadable_themes_module_is_UNKNOWN,_never_clean
  Scenario: An unreadable themes module is unknown
    Given instance "iris" whose themes module is unreadable with "Cannot find module"
    When the theme kinds are judged
    Then there are no findings
    And the one unknown is "iris" with a reason containing "Cannot find module"

  @test:scripts/tests/ui/navbar-consistency.test.ts::kind_for_kind_—_`pnn5`,_the_owner's_option_1::unreadable_webpage_data_is_UNKNOWN_for_a_webpage-declaring_instance,_not_a_fallback
  Scenario: Unreadable webpage data is unknown for a webpage-declaring instance
    Given instance "iris" declaring webpage theme "iris-web" and no webpage data
    When the theme kinds are judged
    Then there are no findings
    And there is one unknown
