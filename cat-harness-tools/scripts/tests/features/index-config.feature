# schemas/kg/index-config.ts and schemas/kg/harness-config.ts: index.config.json, its schema, the
# instantiated set and landing it decides, the one read/write path for remote mounts, the
# index-config:migrate converter, index.lock.json and the generated .gitignore block. Each Scenario names the test that executes it.
Feature: The index config

  @test:scripts/tests/index-config.test.ts::the_schema::accepts_local,_remote_and_inline-override_entries,_and_a_landing_it_lists
  Scenario: The schema accepts local, remote and inline-override entries with a listed landing
    Given an index listing a local root, an inline-override cat-harness entry, a pinned remote who-iris with overrides and a note, and a smart-base import
    And a site landing of "cat-harness"
    When it is validated against the index config schema
    Then it is accepted

  @test:scripts/tests/index-config.test.ts::the_schema::the_remote_source_IS_RemoteMountSchema_minus_`harness`:_strict,_and_a_pin_is_a_full_SHA
  Scenario: A remote source is strict and pinned to a full SHA
    When an index is validated whose remote source has ref "main"
    Then it is refused
    And a remote source carrying a "harness" field is refused
    And a source naming both local and remote is refused

  @test:scripts/tests/index-config.test.ts::the_schema::`index`_is_reserved,_`hub`_is_the_landing_keyword,_and_a_name_appears_once
  Scenario: "index" and "hub" are reserved names and a name appears once
    Then an index with an instance named "index" is refused
    And an index with an instance named "hub" is refused
    And an index listing "a" twice is refused

  @test:scripts/tests/index-config.test.ts::the_schema::`site.agentRun`_is_a_boolean_the_repository_declares_beside_`landing`_(owner,_2026-10-14,_Q7)
  Scenario: site.agentRun is a strict boolean beside landing
    Then an index with site agentRun true is accepted
    And one with landing "a" and agentRun false is accepted
    And one with agentRun "yes" is refused
    And one with a misspelt "agentrun" flag is refused

  @test:scripts/tests/index-config.test.ts::the_schema::a_landing_that_names_an_instance_the_index_does_not_list_is_refused
  Scenario: A landing naming an unlisted instance is refused
    Given an index listing "a" and "b"
    Then a site landing of "c" is refused
    And a site landing of "hub" is accepted

  @test:scripts/tests/index-config.test.ts::the_schema::an_import_is_a_root_`<name>.config.json`,_never_the_index_itself_or_a_path
  Scenario: An import must be a root <name>.config.json other than the index
    Then an import of "index.config.json" is refused
    And an import of "x/a.config.json" is refused
    And an import of "a.json" is refused

  @test:scripts/tests/index-config.test.ts::the_schema::init-folio's_starting_index_validates
  Scenario: init-folio's starting index validates
    When init-folio builds a new index for "my-folio"
    Then it is accepted by the index config schema

  @test:scripts/tests/index-config.test.ts::the_instantiated_set,_with_and_without_an_index::without_an_index:_every_root_`<name>.config.json`,_the_legacy_and_reserved_names_excluded_(unchanged)
  Scenario: Without an index every root config is instantiated except the legacy name
    Given a root holding a.config.json, b.config.json and harness.config.json and no index
    When the instantiated harness names are read
    Then they are "a" and "b"

  @test:scripts/tests/index-config.test.ts::the_instantiated_set,_with_and_without_an_index::with_an_index:_its_instances,_and_nothing_else
  Scenario: With an index only its instances are instantiated
    Given a root holding a.config.json and stray.config.json
    And an index listing "a" and a remote "m"
    When the instantiated harness names are read
    Then they are "a" and "m"

  @test:scripts/tests/index-config.test.ts::the_instantiated_set,_with_and_without_an_index::an_unreadable_index_throws_rather_than_falling_back_to_the_file_scan
  Scenario: An unreadable index throws instead of falling back to the file scan
    Given a root holding a.config.json and an index.config.json that is not JSON
    When the instantiated harness names are read
    Then it throws naming "index.config.json"
    And the index config's state is "unreadable"

  @test:scripts/tests/index-config.test.ts::the_instantiated_set,_with_and_without_an_index::agreement:_a_root_config_the_index_does_not_list,_and_a_missing_import,_are_reported
  Scenario: Index agreement reports unlisted configs, missing imports and entries without config
    Given a root holding a.config.json and stray.config.json
    And an index listing "a", "b" importing "gone.config.json", and "c"
    When the index agreement is computed
    Then "stray" is unlisted
    And "b" has the missing import "gone.config.json"
    And "c" is without config
    And with no index there is no agreement result
    And an index listing "a" and "c" over a.config.json has nothing unlisted and no missing import

  @test:scripts/tests/index-config.test.ts::import,_then_override::inline_fields_override_the_imported_config;_objects_merge,_the_rest_is_replaced
  Scenario: Inline index fields override the imported config, merging objects and replacing the rest
    Given a.config.json with contentType "paper", site landing true and translation defaultLocale "en" with locales "en" and "fr"
    And an index entry for "a" with contentType "document", site landing false and supported locales "es"
    When the effective config for "a" is computed
    Then its contentType is "document"
    And its site is landing false
    And its defaultLocale is still "en"
    And its supported locales are only "es"

  @test:scripts/tests/index-config.test.ts::import,_then_override::`import`_names_another_file;_an_entry_with_nothing_to_import_is_its_inline_fields_alone
  Scenario: An import names another file and an entry with nothing to import is its inline fields
    Given an index entry "a" importing legacy-a.config.json with contentType "paper"
    And an entry "b" with inline contentType "document" and no config file
    Then the effective contentType of "a" is "paper"
    And the effective contentType of "b" is "document"
    And an unlisted name "zzz" has no effective config

  @test:scripts/tests/index-config.test.ts::import,_then_override::readHarnessConfig_returns_the_effective_config_for_an_indexed_instance,_and_the_file_otherwise
  Scenario: readHarnessConfig gives the effective config for an indexed instance and the file otherwise
    Given instances "a" and "b" each with a config file of contentType "paper"
    And an index listing only "a" with inline contentType "document"
    When each instance's harness config is read
    Then "a" has contentType "document"
    And "b" has contentType "paper"

  @test:scripts/tests/index-config.test.ts::which_harness_`/`_is::the_index's_`site.landing`_decides,_ahead_of_any_flag
  Scenario: The index's site landing decides ahead of any flag
    Given a.config.json flagged as landing
    And an index listing "a" and "b" with site landing "b"
    When the landing instance is resolved
    Then it is instance "b" decided by the index

  @test:scripts/tests/index-config.test.ts::which_harness_`/`_is::`hub`_is_the_neutral_hub
  Scenario: A "hub" landing is the neutral hub
    Given an index listing "a" and "b" with site landing "hub"
    When the landing instance is resolved
    Then it is the hub over names "a" and "b"

  @test:scripts/tests/index-config.test.ts::which_harness_`/`_is::a_landing_naming_an_instance_that_is_not_instantiated_is_an_ERROR,_never_a_fallback_to_the_flags
  Scenario: A landing naming an uninstantiated instance is invalid, never a fallback to flags
    Given a.config.json flagged as landing
    And an index listing "a" and "b" with site landing "c"
    When the landing instance is resolved
    Then its kind is "invalid"

  @test:scripts/tests/index-config.test.ts::which_harness_`/`_is::no_`site.landing`:_the_flags_decide,_over_the_EFFECTIVE_configs_(an_inline_flag_counts)
  Scenario: With no site landing the effective configs' flags decide
    Given an index listing "a" and "b" where "b" carries an inline landing flag
    When the landing instance is resolved
    Then it is instance "b" decided by flag
    And with no flags on two instances the result is "ambiguous"
    And with a single instance "a" it is decided as the sole instance

  @test:scripts/tests/index-config.test.ts::which_harness_`/`_is::without_an_index,_behaviour_is_unchanged
  Scenario: Without an index the landing flag decides as before
    Given a.config.json flagged as landing and b.config.json, and no index
    When the landing instance is resolved
    Then it is instance "a" decided by flag

  @test:scripts/tests/index-config.test.ts::the_reserved_`index`_stem::no_root_scan_reads_`index.config.json`_or_`index.lock.json`_as_a_harness_or_a_declaration
  Scenario: Root scans never read the reserved index files as a harness or declaration
    Given a root with real.json and real.config.json
    And index.json carrying the name "index", and unparseable index.config.json and index.lock.json
    Then the root config stems are only "real"
    And the declaration file found is "real.json"
    And index.config.json, index.lock.json and index.json are reserved index files
    And "indexer.config.json" is not reserved

  @test:scripts/tests/index-config.test.ts::remote_mounts:_one_read_path,_one_write_path::index_only:_read_from_the_index
  Scenario: Mounts declared only in the index are read from the index
    Given an index with a remote instance "m" carrying overrides
    When the declared mounts are read
    Then they come from "index"
    And they are the single mount "m" with its repository, pin, consent and overrides

  @test:scripts/tests/index-config.test.ts::remote_mounts:_one_read_path,_one_write_path::declaration_only_(today):_read_from_`remoteMounts`,_unchanged
  Scenario: Mounts declared only in the declaration are read from remoteMounts
    Given a declaration whose remoteMounts holds "m"
    When the declared mounts are read
    Then they come from "declaration" and name "m"
    And a declaration with no remoteMounts and no index reads from "none"

  @test:scripts/tests/index-config.test.ts::remote_mounts:_one_read_path,_one_write_path::a_declaration_naming_a_kind_only_its_mounts_supply_still_yields_its_mounts_(bean_qump)
  Scenario: A declaration naming a typology only its mounts supply still yields its mounts
    Given a declaration with a directory of the unknown typology "qump-not-yet-mounted" and remoteMounts "m"
    Then reading the declaration throws naming the unknown graph typology
    And the declared mounts are still "m"
    And the mount fields read name "down" with directory path "lib/"

  @test:scripts/tests/index-config.test.ts::remote_mounts:_one_read_path,_one_write_path::a_mount_field_that_does_not_parse_still_throws,_naming_the_file
  Scenario: A remoteMounts entry that does not parse throws naming the file
    Given a declaration whose remoteMounts entry has only a harness
    When the declared mounts are read
    Then it throws naming "down.json: remoteMounts"

  @test:scripts/tests/index-config.test.ts::remote_mounts:_one_read_path,_one_write_path::both_carrying_mounts_is_an_error_naming_both_files
  Scenario: Mounts in both the index and the declaration are an error naming both files
    Given a declaration with remoteMounts "m" and an index with remote instance "m"
    When the declared mounts are read
    Then it throws
    And the message names both "index.config.json" and "down.json"

  @test:scripts/tests/index-config.test.ts::remote_mounts:_one_read_path,_one_write_path::the_writer_targets_the_index,_writes_the_ignore_block,_and_drops_a_mount's_source
  Scenario: The mount writer targets the index, writes the ignore block and drops removed mounts
    Given a declaration "down" with a config and an index listing "down" locally
    When mounts "m" and "p" at path "deep/p" are written
    Then the declared mounts are "m" and "p"
    And .gitignore holds the generated block with "/m/" and "/deep/p/"
    And after writing only "m" the index instances are "down" and "m"
    And the ignore block is current

  @test:scripts/tests/index-config.test.ts::remote_mounts:_one_read_path,_one_write_path::the_writer_refuses_while_the_declaration_still_carries_`remoteMounts`,_and_seeds_an_index_when_there_is_none
  Scenario: The mount writer refuses while the declaration carries remoteMounts and seeds a missing index
    Given a declaration still carrying remoteMounts
    When mounts are written
    Then it throws pointing to "index-config:migrate"
    And for a declaration with a config and no index, writing mount "m" makes the instantiated names "down" and "m"

  @test:scripts/tests/index-config.test.ts::remote_mounts:_one_read_path,_one_write_path::addIndexInstance_records_a_newly_instantiated_harness_(kg:instantiate)
  Scenario: addIndexLayer records a newly instantiated harness once
    Given an index listing "a"
    When instance "b" is added
    Then the add reports true
    And adding "b" again reports false
    And the instantiated names are "a" and "b"
    And adding to a root with no index reports false

  @test:scripts/tests/index-config.test.ts::index-config:migrate::moves_`remoteMounts`_losslessly,_keeps_the_root_first,_imports_matching_configs,_renames_the_lock
  Scenario: Migration moves remoteMounts losslessly, root first, imports matching configs and renames the lock
    Given a declaration "down" with remoteMounts "bootstrap" and "tools", a local instance "cat" flagged as landing, a bootstrap.config.json, a legacy down.mount-lock.json and a .gitignore
    When the migration is planned
    Then the instances are "down", "cat", "bootstrap", "tools" in that order
    And the site landing is "cat"
    And there are no findings
    And after applying it the mounts are read from the index unchanged
    And the declaration has no remoteMounts
    And index.lock.json exists and down.mount-lock.json does not
    And .gitignore keeps its line and gains the block with "/bootstrap/" and "/tools/"
    And planning again finds no changes

  @test:scripts/tests/index-config.test.ts::index-config:migrate::a_re-run_merges_what_the_declaration_gained,_and_refuses_a_conflicting_duplicate
  Scenario: A migration re-run merges new declaration mounts and refuses a conflicting duplicate
    Given a migrated root with mount "a"
    When the declaration gains mount "b" and migration runs again
    Then the mounts are "a" and "b"
    And an identical "b" in the declaration is dropped with the mounts unchanged
    And a "b" pointing at another repository makes planning throw naming "BOTH"
    And planning with the declaration preferred takes the declaration's repository "o/other"

  @test:scripts/tests/index-config.test.ts::index-config:migrate::a_standalone_separated_repository:_its_own_instance,_and_an_inherited_fork_config_is_a_FINDING,_not_an_import
  Scenario: A standalone separated repository becomes its own instance with an inherited fork config as a finding
    Given a root holding smart-trust.json, smart-trust.config.json and an inherited smart-base.config.json
    When the migration is planned
    Then the only instance is "smart-trust" with a local source at "."
    And there is one "unmatched-config" finding naming "smart-base.config.json"
    And after applying it index.config.json validates
    And .gitignore holds an empty generated block

  @test:scripts/tests/index-config.test.ts::index.lock.json,_and_the_legacy_name::readers_take_index.lock.json,_else_the_legacy_name_—_the_schema-side_and_node-only_rules_agree
  Scenario: Readers take index.lock.json, else the legacy lock name, and both rule sets agree
    Given one root with index.lock.json and another with down.mount-lock.json, each locking instance "a"
    Then in each, the schema-side lock files equal the node-only lock names
    And the mounted instance roots are "a"
    And the locks read without error
    And the lock path for "down" is index.lock.json in the first and down.mount-lock.json in the second
    And a root with neither is told index.lock.json

  @test:scripts/tests/index-config.test.ts::index.lock.json,_and_the_legacy_name::both_present_is_an_error_naming_both,_never_a_merge
  Scenario: Both lock files present is an error naming both, never a merge
    Given a root with both index.lock.json and down.mount-lock.json
    Then the lock files list is empty with a conflict naming both files
    And the node-only reader reports the same conflict
    And computing the lock path throws "both exist"
    And reading the locks gives an error containing "both exist"
    And there are no mounted instance roots

  @test:scripts/tests/index-config.test.ts::index.lock.json,_and_the_legacy_name::the_lock_is_never_read_as_a_declaration
  Scenario: The lock is never read as a declaration
    Given a root holding only index.lock.json
    When its instance roots are listed
    Then there are none

  @test:scripts/tests/index-config.test.ts::the_generated_.gitignore_block::one_line_per_remote_instance,_then_the_locked_closure
  Scenario: The ignore block lists each remote instance, then the locked closure
    Given an index with a local root, a remote "m" and a remote "p" at path "x/p/"
    Then the ignore block lines are the begin marker, "/m/", "/x/p/" and the end marker
    And with locked instances "m", "z" and "dep" the block adds "/dep/" and "/z/" after them

  @test:scripts/tests/index-config.test.ts::the_generated_.gitignore_block::written_in_place_between_its_markers,_and_the_gate_reports_missing_and_drift
  Scenario: The ignore block is written in place and the gate reports missing and drift
    Given a .gitignore holding "a" and "# keep me"
    Then the block check is "missing"
    And syncing writes it and the check is "current"
    And syncing again changes nothing
    And removing "/m/" by hand makes the check "drift"
    And syncing again keeps the original lines first with a single block

  @test:scripts/tests/index-config.test.ts::the_new_form:_layers_+_harnesses_(cat-harness#1138)::only_the_declared_harnesses_are_instantiated;_every_layer_is_still_mounted
  Scenario: In the new form only declared harnesses are instantiated while every layer is mounted
    Given a new-form index with layers "base", remote "dep" and "me", harness "base" and landing "base"
    Then the instantiated names are only "base"
    And the index reads ok with instances "base", "dep" and "me"
    And the landing is instance "base" decided by the index over names "base"

  @test:scripts/tests/index-config.test.ts::the_new_form:_layers_+_harnesses_(cat-harness#1138)::the_landing_must_be_a_harness,_not_a_layer_only_mounted
  Scenario: The landing must be a harness, not a layer only mounted
    When a new-form index with harness "base" and landing "dep" is validated
    Then it is refused

  @test:scripts/tests/index-config.test.ts::the_new_form:_layers_+_harnesses_(cat-harness#1138)::a_harness_must_be_a_listed_layer,_and_so_must_its_definedBy
  Scenario: A harness and its definedBy must be listed layers
    Then a new-form harness "nowhere" is refused
    And a harness "me" defined by "nowhere" is refused
    And a harness "me" defined by "base" is accepted

  @test:scripts/tests/index-config.test.ts::the_new_form:_layers_+_harnesses_(cat-harness#1138)::`layers`_needs_`harnesses`,_and_`layers`_with_`instances`_is_refused
  Scenario: layers needs harnesses, and layers with instances is refused
    Then an index with layers and no harnesses is refused
    And an index with layers, instances and harnesses is refused

  @test:scripts/tests/index-config.test.ts::the_new_form:_layers_+_harnesses_(cat-harness#1138)::a_file_keeps_its_form:_the_new_one_is_written_back_as_layers_+_harnesses,_the_old_one_as_instances
  Scenario: An index config keeps its form when written back
    Given a parsed new-form index
    When it is formatted
    Then it has layers "base", "dep", "me" and harness "base" and no instances
    And formatting its reparse gives the same text
    And an old-form index formats with three instances and no layers

  @test:scripts/tests/index-config.test.ts::the_new_form:_layers_+_harnesses_(cat-harness#1138)::migration_lists_only_what_is_instantiated:_the_landing,_entries_with_config,_nothing_only_mounted
  Scenario: Migrating to the new form declares only instantiated entries as harnesses
    Given a root holding me.config.json
    And an old-form index of "base" as landing, remote "dep", "styled" with a theme, and "me"
    When harnesses are declared from it
    Then they are "base", "styled" and "me"
    And a single-instance index declares that instance
    And a new-form index is returned unchanged

  @test:scripts/tests/index-config.test.ts::the_new_form:_layers_+_harnesses_(cat-harness#1138)::addIndexInstance_records_a_new_harness_in_both_lists_in_the_new_form
  Scenario: addIndexLayer in the new form records the new harness
    # Gap: that "fresh" is also added to the layers list is not checked
    Given a new-form index with harness "base"
    When instance "fresh" is added
    Then the add reports true
    And the instantiated names are "base" and "fresh"
