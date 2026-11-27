# libraries:derive and libraries:check (bean jbvi) over a fixture layer built
# in a temporary directory, each refusal shown on an input made to trigger it.
# Each Scenario names the test that executes it.
Feature: Deriving and checking a layer's software-library nodes

  @test:scripts/tests/libraries.test.ts::the_small_readers::bun.lock_parses_with_its_trailing_commas
  Scenario: bun.lock parses with its trailing commas
    When JSON with trailing commas in arrays and objects is parsed as a bun.lock
    Then it reads as the same JSON without them

  @test:scripts/tests/libraries.test.ts::the_small_readers::a_sha512_integrity_becomes_128_hex_characters;_anything_else_is_undefined
  Scenario: A sha512 integrity becomes 128 hex characters
    When the fixture's sha512 integrity is converted
    Then it is the 128-character hex of its bytes
    And a sha1 integrity or no integrity converts to nothing

  @test:scripts/tests/libraries.test.ts::the_small_readers::a_specifier_names_its_package,_and_a_types_package_is_found_for_it
  Scenario: A specifier names its package and its types package
    Then @scope/b/sub names @scope/b and pkg-a/deep/x.js names pkg-a
    And the types package for c is @types/c and for @scope/b is @types/scope__b

  @test:scripts/tests/libraries.test.ts::the_small_readers::the_tarball_URL_is_the_registry's,_with_the_default_for_an_empty_one
  Scenario: The tarball URL is the registry's, defaulting to npm
    Then an empty registry gives the registry.npmjs.org tarball URL
    And a named registry gives the tarball under it, with the scope dropped from the file name

  @test:scripts/tests/libraries.test.ts::the_small_readers::a_licence_is_read_from_`license`_in_either_form,_or_the_old_`licenses`_array
  Scenario: A licence is read from license in either form or the old licenses array
    Then a string license and an object license read as their id
    And a licenses array reads as the OR of its ids
    And no licence field reads as none

  @test:scripts/tests/libraries.test.ts::the_small_readers::imports_are_read_from_the_syntax_tree:_never_from_a_comment_or_a_string
  Scenario: Imports are read from the syntax tree, never from a comment or a string
    Given source with an import in a comment, one in a string, a static import, a require and a type import
    When its module references are read
    Then the imports are c, d and e

  @test:scripts/tests/libraries.test.ts::deriving_a_layer::one_node_per_outside_dependency;_the_platform's_own_layers_get_none
  Scenario: One node per outside dependency; the platform's own layers get none
    When the fixture layer is derived
    Then there are no problems and the nodes are pkg-a, scope__b and types__c, each valid against the software-library schema

  @test:scripts/tests/libraries.test.ts::deriving_a_layer::each_field_comes_from_where_the_module_says
  Scenario: Each field comes from where the module says
    When the fixture layer is derived
    Then pkg-a's node has the locked version, the declared range, dev false, the hex digest, the npm tarball URL, licence MIT, its shim and its one user
    And @scope/b's node has licence Apache-2.0, its one user and no shim

  @test:scripts/tests/libraries.test.ts::deriving_a_layer::an_import_of_`c`_is_satisfied_by_`@types/c`,_a_dev_dependency
  Scenario: An import of c is satisfied by the dev dependency @types/c
    When the fixture layer is derived
    Then the types__c node is dev and used by src/a.ts

  @test:scripts/tests/libraries.test.ts::deriving_a_layer::an_installed_version_that_differs_from_the_locked_one_is_noted,_never_refused
  Scenario: An installed version differing from the locked one is noted, not refused
    When the fixture layer is derived
    Then a note names @types/c with installed 1.1.0 and locked 1.2.0
    And the node records the locked 1.2.0

  @test:scripts/tests/libraries.test.ts::--check::a_freshly_written_layer_has_no_findings
  Scenario: A freshly written layer has no findings
    When the derived layer is written and checked
    Then there are no findings

  @test:scripts/tests/libraries.test.ts::--check::a_hand-edited_node_is_stale
  Scenario: A hand-edited node is stale
    Given pkg-a's node edited to a different licence
    When the layer is checked
    Then a finding names pkg-a.library.json as stale

  @test:scripts/tests/libraries.test.ts::--check::a_node_no_dependency_names_is_stale,_and_a_dependency_with_no_node_is_missing
  Scenario: An unnamed node is stale and a dependency with no node is missing
    Given an extra ghost node and the @scope/b node removed
    When the layer is checked
    Then ghost.library.json is stale and scope__b.library.json is missing

  @test:scripts/tests/libraries.test.ts::--check::an_import_that_names_no_node_is_a_finding
  Scenario: An import that names no node is a finding
    Given a source file importing an undeclared package
    When the layer is checked
    Then a finding names the package and the file

  @test:scripts/tests/libraries.test.ts::--check::a_nested_package_with_its_own_lockfile_is_its_own_package:_its_imports_are_not_the_layer's
  Scenario: A nested package with its own lockfile is not part of the layer
    Given a nested package with its own package.json and bun.lock importing vitest
    Then its files are not the layer's code files and vitest is not an unknown import
    And once its bun.lock is removed, vitest is an unknown import

  @test:scripts/tests/libraries.test.ts::--check::a_shim_that_names_no_node_is_a_finding
  Scenario: A shim that names no node is a finding
    Given a declaration file declaring a module no dependency names
    When the layer is checked
    Then a finding names the shim file and the module

  @test:scripts/tests/libraries.test.ts::--check::a_licence_off_the_pinned_SPDX_list_is_a_finding
  Scenario: A licence off the pinned SPDX list is a finding
    Given pkg-a installed with a licence not on the SPDX list, derived and written
    When the layer is checked
    Then a finding names pkg-a.library.json's licence

  @test:scripts/tests/libraries.test.ts::--check::what_the_writer_could_not_determine_is_a_finding,_never_a_skipped_node
  Scenario: What the writer could not determine is a finding, never a skipped node
    Given @scope/b is not installed
    When the layer is derived
    Then it has no @scope/b node and a check finding says @scope/b is not installed

  @test:scripts/tests/libraries.test.ts::--check::a_layer_with_no_bun.lock_could_not_be_determined
  Scenario: A layer with no bun.lock could not be determined
    Given a directory with a package.json and no bun.lock
    When it is derived
    Then a problem names bun.lock

  @test:scripts/tests/libraries.test.ts::a_vendored_bundle_(owner,_2026-10-26:_record_as_vendored)::each_`vendor/<name>/<version>/`_is_a_bundle,_and_its_files_are_not_read_for_imports
  Scenario: Each vendor/<name>/<version>/ is a bundle whose files are not read for imports
    Given two vendored bundles, one importing promise-polyfill
    Then the bundles are listed by path, none of their files is a code file, and promise-polyfill is not an unknown import

  @test:scripts/tests/libraries.test.ts::a_vendored_bundle_(owner,_2026-10-26:_record_as_vendored)::one_1.1.0_node_per_bundle,_marked_vendored,_with_no_range_or_dev;_the_other_nodes_stay_1.0.0
  Scenario: One 1.1.0 node per bundle, marked vendored, with no range or dev
    When the layer with bundles is derived
    Then there are no problems and the bundle's node is valid, at software-library/1.1.0, vendored at its path, with no range or dev
    And it carries the bundle's version, digest, tarball URL and no users
    And pkg-a's node stays at software-library/1.0.0

  @test:scripts/tests/libraries.test.ts::a_vendored_bundle_(owner,_2026-10-26:_record_as_vendored)::the_licence_is_read_from_the_bundle's_own_files:_a_recognised_text_is_its_id,_any_other_a_LicenseRef
  Scenario: A bundle's licence is read from its own files
    When the layer with bundles is derived
    Then the bundle with the MIT text is MIT, sourced from its LICENSE.txt
    And the bundle with its own terms is LicenseRef-own-terms, sourced from its LICENSE.md
    And the MIT text with one more term is not recognised
    And the LicenseRef for @lhncbc/ucum-lhc is LicenseRef-lhncbc-ucum-lhc

  @test:scripts/tests/libraries.test.ts::a_vendored_bundle_(owner,_2026-10-26:_record_as_vendored)::a_font's_OFL.txt_is_OFL-1.1_when_it_is_the_licence_whole,_under_its_copyright_line_and_the_standard_notice
  Scenario: A font's OFL.txt is OFL-1.1 only when it is the licence whole
    Given the Plus Jakarta Sans OFL.txt fixture
    Then it is recognised as OFL-1.1, and so is the licence text alone
    And with a term added after it, any other text before it, or a word dropped, it is not recognised

  @test:scripts/tests/libraries.test.ts::a_vendored_bundle_(owner,_2026-10-26:_record_as_vendored)::a_written_layer_with_bundles_is_clean,_and_its_licences_parse_on_the_pinned_list
  Scenario: A written layer with bundles is clean
    When the layer with bundles is derived, written and checked
    Then there are no findings

  @test:scripts/tests/libraries.test.ts::a_vendored_bundle_(owner,_2026-10-26:_record_as_vendored)::a_kept_file_whose_bytes_changed_is_a_finding,_and_the_bundle_gets_no_node
  Scenario: A kept file whose bytes changed gets the bundle no node
    Given a bundle's lib.js changed after its manifest was written
    When the layer is derived
    Then the bundle has no node and a problem names lib.js and its sha256

  @test:scripts/tests/libraries.test.ts::a_vendored_bundle_(owner,_2026-10-26:_record_as_vendored)::a_bundle_with_no_manifest,_or_one_that_disagrees_with_its_directory,_could_not_be_determined
  Scenario: A bundle with no manifest, or one disagreeing with its directory, could not be determined
    Given a bundle directory with no vendored.json and one whose manifest version differs from its directory
    When the layer is derived
    Then a problem names the first's missing vendored.json and another the second's 2.0.1

  @test:scripts/tests/libraries.test.ts::the_layers_this_checkout_judges::cat-harness-tools_declares_its_own_libraries_directory
  Scenario: cat-harness-tools declares its own libraries directory
    When this checkout's library layers are listed
    Then they include cat-harness-tools

  @test:scripts/tests/libraries.test.ts::a_layer_below_the_kind_is_held_by_the_writer's_layer_(owner,_2026-10-30,_bootstrap-tools#44)::the_held_set_is_derived:_a_layer_with_a_package.json_that_does_not_reach_the_kind's_owner
  Scenario: The held set is derived
    Given a checkout with a layer lacking a package.json, one below the kind, the kind's owner, the holder, and one above
    When the held layers are derived for the holder
    Then only the layer below the kind is held, under the holder's libraries/held/, held by the holder

  @test:scripts/tests/libraries.test.ts::a_layer_below_the_kind_is_held_by_the_writer's_layer_(owner,_2026-10-30,_bootstrap-tools#44)::with_no_holder_in_the_checkout,_nothing_is_held
  Scenario: With no holder in the checkout nothing is held
    When the held layers are derived with no library layers
    Then there are none

  @test:scripts/tests/libraries.test.ts::a_layer_below_the_kind_is_held_by_the_writer's_layer_(owner,_2026-10-30,_bootstrap-tools#44)::a_layer_that_declares_its_own_libraries_directory_is_never_held
  Scenario: A layer that declares its own libraries directory is never held
    Given the layer below the kind declares its own libraries directory
    When the held layers are derived
    Then there are none

  @test:scripts/tests/libraries.test.ts::a_layer_below_the_kind_is_held_by_the_writer's_layer_(owner,_2026-10-30,_bootstrap-tools#44)::a_held_node_names_its_layer_and_is_stamped_1.2.0;_usedBy_stays_relative_to_that_layer
  Scenario: A held node names its layer and is stamped 1.2.0
    When the fixture layer's nodes are made held
    Then each names the fixture layer, is software-library/1.2.0 and is valid
    And pkg-a's users are unchanged from the unheld derivation

  @test:scripts/tests/libraries.test.ts::a_layer_below_the_kind_is_held_by_the_writer's_layer_(owner,_2026-10-30,_bootstrap-tools#44)::a_held_directory_for_a_layer_the_checkout_does_not_hold_is_reported,_never_deleted
  Scenario: A held directory for a layer the checkout does not hold is reported
    Given a libraries/held/gone directory under the holder
    When the stray held directories are listed
    Then they are exactly "gone"

  @test:scripts/tests/libraries.test.ts::a_layer_below_the_kind_is_held_by_the_writer's_layer_(owner,_2026-10-30,_bootstrap-tools#44)::this_layer_is_the_holder
  Scenario: This layer is the holder
    Then the holder is cat-harness-tools

  @test:scripts/tests/libraries.test.ts::npm's_`SEE_LICENSE_IN_<file>`::the_named_file_is_read:_a_listed_licence's_text_is_its_id,_any_other_a_LicenseRef
  Scenario: npm's SEE LICENSE IN <file> reads the named file
    Given a dependency whose license is SEE LICENSE IN LICENSE and whose LICENSE holds its own terms
    When the layer is derived
    Then there are no problems and the node's licence is LicenseRef-custom, sourced from LICENSE
    And with the LICENSE file removed, a problem says there is no such file
    # Gap: the title says a listed licence's text becomes its id; only an unlisted text (giving a LicenseRef) is exercised.
