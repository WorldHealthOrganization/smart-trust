# A layer's config is its index.config.json entry; a root <name>.config.json is a legacy import, read only
# as a reported fallback (scripts/instance-config.ts, build-instance-site.ts, check-published-refs.ts,
# check-landing-instance.ts) and retired by index-config:migrate --inline. Each Scenario names the test that executes it.
Feature: Instance config is read index-first

  @test:scripts/tests/kg/instance-config-index-first.test.ts::readInstanceConfig:_the_index_entry_first,_the_legacy_file_only_as_a_reported_fallback::inline_only:_no_file_is_needed,_and_none_is_reported
  Scenario: Inline config only needs no file and reports none
    Given a temporary checkout declaring "demo" at its root
    And an index entry for "demo" with contentType "document" and a site.build recipe, and no legacy file
    When readInstanceConfig reads "demo"
    Then it was read via "index"
    And no legacy file is reported
    And the config is exactly the contentType and site.build from the entry

  @test:scripts/tests/kg/instance-config-index-first.test.ts::readInstanceConfig:_the_index_entry_first,_the_legacy_file_only_as_a_reported_fallback::an_entry_over_an_imported_legacy_file:_inline_wins_key_by_key,_and_the_file_is_reported
  Scenario: An entry over a legacy file wins key by key and the file is reported
    Given a temporary checkout declaring "demo" at its root
    And an index entry with contentType "document"
    And a legacy "demo.config.json" with contentType "paper" and a site.build recipe
    When readInstanceConfig reads "demo"
    Then it was read via "index+legacy"
    And the legacy file reported is "demo.config.json"
    And the config has contentType "document" and the legacy site.build

  @test:scripts/tests/kg/instance-config-index-first.test.ts::readInstanceConfig:_the_index_entry_first,_the_legacy_file_only_as_a_reported_fallback::no_index:_the_file_alone,_reported_as_legacy
  Scenario: Without an index the legacy file alone is read and reported
    Given a temporary checkout declaring "demo" at its root
    And only a legacy "demo.config.json" holding a site.build recipe
    When readInstanceConfig reads "demo"
    Then it was read via "legacy"
    And the legacy file reported is "demo.config.json"

  @test:scripts/tests/kg/instance-config-index-first.test.ts::readInstanceConfig:_the_index_entry_first,_the_legacy_file_only_as_a_reported_fallback::an_unreadable_index_throws,_rather_than_falling_back_to_the_file_it_overrides
  Scenario: An unreadable index throws instead of falling back
    Given a temporary checkout declaring "demo" at its root
    And a legacy "demo.config.json"
    And an index.config.json that is not valid JSON
    When readInstanceConfig reads "demo"
    Then it throws an error naming "index.config.json"

  @test:scripts/tests/kg/instance-config-index-first.test.ts::recipeFromConfig_reads_the_index_entry_(the_publish_path_no_longer_needs_<name>.config.json)::site.build_inline_in_the_entry,_with_no_legacy_file_at_all
  Scenario: recipeFromConfig reads site.build inline from the entry
    Given a temporary checkout declaring "demo" at its root
    And an index entry holding a site.build recipe, and no "demo.config.json"
    When recipeFromConfig and declaredRecipe read the checkout
    Then the legacy file does not exist
    And recipeFromConfig returns the recipe
    And declaredRecipe returns instance "demo" with that recipe

  @test:scripts/tests/kg/instance-config-index-first.test.ts::recipeFromConfig_reads_the_index_entry_(the_publish_path_no_longer_needs_<name>.config.json)::a_legacy_file_is_still_read,_and_SAID_on_stderr
  Scenario: recipeFromConfig still reads a legacy file and says so on stderr
    Given a temporary checkout declaring "demo" at its root
    And only a legacy "demo.config.json" holding a site.build recipe
    When recipeFromConfig reads "demo" with console.warn captured
    Then it returns the recipe
    And a warning contains "legacy config: demo.config.json"

  @test:scripts/tests/kg/instance-config-index-first.test.ts::recipeFromConfig_reads_the_index_entry_(the_publish_path_no_longer_needs_<name>.config.json)::the_refusal_names_where_the_bad_step_came_from
  Scenario: The recipe refusal names where the bad step came from
    Given a temporary checkout declaring "demo" at its root
    And an index entry whose site.build.pre is "rm -rf /"
    When recipeRead reads "demo"
    Then it throws naming the index.config.json entry "demo" and that steps must be package script names

  @test:scripts/tests/kg/instance-config-index-first.test.ts::check-published-refs_reads_instance_dependencies_index-first::an_inline_dependency_is_examined;_the_legacy_file_is_named_as_legacy
  Scenario: check-published-refs examines dependencies inline or from a legacy file
    # Gap: that the legacy file is named as legacy is not checked
    Given a dependency on "cat-harness" at ref "main" for folioAssistant
    When dependencyRefs reads a checkout holding it inline in the index entry
    Then one dependency is examined
    And reading a checkout holding it only in a legacy file also examines one

  @test:scripts/tests/kg/instance-config-index-first.test.ts::index-config:migrate_--inline_retires_<name>.config.json_with_the_effective_config_unchanged::content_moves_into_the_entry,_inline_values_still_win,_the_file_is_deleted,_and_a_re-run_is_a_no-op
  Scenario: migrate --inline moves the legacy content into the entry and deletes the file
    Given a temporary checkout declaring "demo" at its root
    And an index entry with contentType "document" and site.landing true
    And a legacy file with a "_comment", contentType "paper", a site.build recipe and a readme linkStyle
    When the migration is planned and applied with inline on
    Then the plan retires "demo.config.json" and has changes
    And the legacy file no longer exists
    And readInstanceConfig now reads via "index" with the same effective config as before
    And readHarnessConfig gives the same result as before
    And the entry keeps "_comment" as "why this exists" and has no import
    And planning again with inline on has no changes

  @test:scripts/tests/kg/instance-config-index-first.test.ts::index-config:migrate_--inline_retires_<name>.config.json_with_the_effective_config_unchanged::without_--inline_nothing_is_retired,_so_--inline_--check_stays_red_while_the_file_remains
  Scenario: Without --inline nothing is retired
    Given a temporary checkout declaring "demo" at its root
    And an empty index entry and a legacy file with contentType "document"
    When the migration is planned without inline
    Then it retires nothing
    And planning with inline on still has changes

  @test:scripts/tests/kg/instance-config-index-first.test.ts::index-config:migrate_--inline_retires_<name>.config.json_with_the_effective_config_unchanged::an_entry_with_an_explicit_`import`_of_another_file_has_that_file_folded_in
  Scenario: An explicit import of another file is folded into the entry
    Given a temporary checkout declaring "demo" at its root
    And an index entry importing "other.config.json", which holds contentType "document"
    When inlineEntries runs over the index config
    Then it retires "other.config.json"
    And the entry has name "demo", contentType "document" and no import

  @test:scripts/tests/kg/instance-config-index-first.test.ts::check:landing-instance_reports_every_legacy_import;_one_that_disagrees_with_its_entry_fails::a_pending_migration_is_said,_and_passes
  Scenario: A pending migration is reported and passes
    Given a temporary checkout declaring "demo" at its root
    And an index entry and a legacy file that agree on contentType "document", the file adding a site.build
    When legacyImports and formatLegacy report the checkout
    Then the import is "demo" from "demo.config.json" with nothing shadowed
    And the report passes and says "pending migration"

  @test:scripts/tests/kg/instance-config-index-first.test.ts::check:landing-instance_reports_every_legacy_import;_one_that_disagrees_with_its_entry_fails::a_file_whose_value_the_entry_overrides_differently_is_NOT_merely_pending,_and_fails
  Scenario: A legacy value the entry overrides differently fails
    Given a temporary checkout declaring "demo" at its root
    And an index entry with an empty site.build.pre and a legacy file with site.build.pre "check:archimate"
    When legacyImports and formatLegacy report the checkout
    Then the shadowed paths are "site.build.pre"
    And the report fails

  @test:scripts/tests/kg/instance-config-index-first.test.ts::check:landing-instance_reports_every_legacy_import;_one_that_disagrees_with_its_entry_fails::no_legacy_file:_says_so;_no_index:_says_nothing
  Scenario: No legacy file says none and no index says nothing
    Given a temporary checkout declaring "demo" at its root
    When only an index entry exists
    Then the formatted legacy report contains "none"
    And when only a legacy file exists legacyImports returns nothing

  @test:scripts/tests/kg/instance-config-index-first.test.ts::check:landing-instance_reports_every_legacy_import;_one_that_disagrees_with_its_entry_fails::shadowedPaths_compares_leaves,_recursing_through_objects
  Scenario: shadowedPaths compares leaves through nested objects
    Given an object with a.b 1, a.c 2 and d [1]
    And another with a.b 1, a.c 3, d [2] and e 1
    When shadowedPaths compares them
    Then the shadowed paths are "a.c" and "d"
