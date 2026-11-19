# schemas/library/software-library.ts and schemas/library/outside-software.ts: the
# outside-software core, the software-library kind on it (1.0.0, vendored 1.1.0, held
# 1.2.0) and tool-release's rules over it. Each Scenario names the test that executes it.
Feature: The outside-software core and the software-library kind

  @test:schemas/library/software-library.test.ts::the_outside-software_core::its_digest_takes_sha256_or_sha512,_and_nothing_else
  Scenario: The outside-software digest accepts sha256 or sha512 and nothing else
    Given a sha256 digest of 64 hex characters and a sha512 digest of 128
    When each is parsed as a software digest
    Then both parse
    And a sha512 algorithm over a 64-character digest is refused
    And an "md5" algorithm is refused

  @test:schemas/library/software-library.test.ts::the_outside-software_core::a_ref_splits_at_its_LAST_`@`,_so_a_scoped_name_survives
  Scenario: A ref splits at its last "@", so a scoped name survives
    Given the refs "@types/mdast@4.0.4" and "temurin-jre@21.0.4+7"
    When each is parsed as an outside-software ref
    Then they give name "@types/mdast" version "4.0.4" and name "temurin-jre" version "21.0.4+7"
    And "zod" and "@types/mdast" with no version give no ref
    And name "@types/mdast" with version "4.0.4" formats back to "@types/mdast@4.0.4"

  @test:schemas/library/software-library.test.ts::the_outside-software_core::both_kinds_are_the_core:_a_valid_record_of_either_parses_as_one
  Scenario: A valid record of either kind parses as the outside-software core
    Given a valid software-library record and every seeded tool release in tool-releases/
    When each is parsed with the outside-software core schema
    Then each one parses

  @test:schemas/library/software-library.test.ts::tool-release_keeps_its_four_rules_on_the_core::every_seeded_release_still_parses
  Scenario: Every seeded tool release still parses as a tool release
    Given the JSON files in tool-releases/ stamped with the tool-release tag
    When each is parsed with the tool-release schema
    Then every one parses with no error
    And at least one such release exists

  @test:schemas/library/software-library.test.ts::tool-release_keeps_its_four_rules_on_the_core::a_tool_release_does_NOT_inherit_the_core's_sha512,_nor_a_scoped_name
  Scenario: A tool release does not inherit the core's sha512 or a scoped name
    Given the seeded release plantuml-1.2026.10.json
    When it is parsed with a sha512 digest, with the name "@scope/plantuml", or without its entry
    Then each variant is refused by the tool-release schema

  @test:schemas/library/software-library.test.ts::software-library/1.0.0::a_valid_library_parses
  Scenario: A valid software library parses
    Given a software-library/1.0.0 record for bpmn-moddle 10.3.1
    When it is parsed
    Then it parses

  @test:schemas/library/software-library.test.ts::software-library/1.0.0::its_digest_may_be_sha512_—_what_bun.lock_records_—_or_sha256,_and_is_required
  Scenario: A library digest may be sha512 or sha256, and is required
    Given a valid library
    When its digest is a sha256 digest
    Then it parses
    And without a digest it is refused

  @test:schemas/library/software-library.test.ts::software-library/1.0.0::a_scoped_name_is_a_name;_an_uppercase_or_`@`-less_scope_is_not
  Scenario: A scoped name is a name; an uppercase or "@"-less scope is not
    Given a valid library
    When its name is "@types/mdast"
    Then it parses
    And the names "Zod" and "types/mdast" are refused

  @test:schemas/library/software-library.test.ts::software-library/1.0.0::its_source_is_a_registry_URL_over_https,_never_an_OCI_image
  Scenario: A library source is a registry URL over https, never an OCI image
    Given a valid library
    When its source is an http URL
    Then it is refused
    And an OCI image source is refused

  @test:schemas/library/software-library.test.ts::software-library/1.0.0::range_and_dev_are_required;_a_shim_is_optional
  Scenario: Range and dev are required; a shim is optional
    Given a valid library
    When range, dev or shim is removed in turn
    Then the record without range is refused
    And the record without dev is refused
    And the record without a shim parses

  @test:schemas/library/software-library.test.ts::software-library/1.0.0::a_shim_is_a_`types/*.d.ts`_file
  Scenario: A shim must be a "types/*.d.ts" file
    Given a valid library
    When its shim is "src/bpmn-moddle.d.ts" or "types/bpmn-moddle.ts"
    Then each is refused

  @test:schemas/library/software-library.test.ts::software-library/1.0.0::`usedBy`_is_layer-relative,_sorted_and_unique
  Scenario: "usedBy" is layer-relative, sorted and unique
    Given a valid library
    When its usedBy is empty
    Then it parses
    And an unsorted list, a duplicated entry, an absolute path and a "../" path are each refused

  @test:schemas/library/software-library.test.ts::software-library/1.0.0::its_`$schema`_is_the_kind's_tag,_at_no_newer_minor_than_the_kind
  Scenario: Its "$schema" is the kind's tag at no newer minor than the kind
    Given a valid library
    When it is stamped "software-library/1.0.0", "1.1.0" or "1.2.0"
    Then each parses
    And "software-library/1.3.0" and "folio-library/v1" are refused

  @test:schemas/library/software-library.test.ts::software-library/1.0.0::an_unknown_field_is_refused
  Scenario: An unknown field is refused
    Given a valid library
    When it carries an "entry" field
    Then it is refused

  @test:schemas/library/software-library.test.ts::software-library/1.0.0::the_file_name_never_equals_the_`name`,_and_a_scope_cannot_collide_with_a_path
  Scenario: The library file name never equals the name, and a scope cannot collide with a path
    When file names are made for "zod" and "@types/mdast"
    Then "zod" gives "zod" plus the library file suffix
    And "@types/mdast" gives "types__mdast.library.json", which contains no "/"

  @test:schemas/library/software-library.test.ts::software-library/1.1.0_—_a_vendored_bundle::a_vendored_node_parses,_with_no_range_and_no_dev
  Scenario: A vendored node parses with no range and no dev
    Given a software-library/1.1.0 node for vendored jquery 3.6.0 with no range and no dev
    When it is parsed
    Then it parses with no error

  @test:schemas/library/software-library.test.ts::software-library/1.1.0_—_a_vendored_bundle::a_vendored_node_carries_neither_`range`_nor_`dev`
  Scenario: A vendored node carries neither range nor dev
    Given a valid vendored node
    When it is given a range, or a dev flag
    Then each is refused

  @test:schemas/library/software-library.test.ts::software-library/1.1.0_—_a_vendored_bundle::an_empty_`vendored`_is_not_a_way_to_drop_`range`_—_its_path_is_required,_layer-relative
  Scenario: An empty "vendored" cannot drop range; its path is required and layer-relative
    Given a valid vendored node
    When vendored is empty, has an absolute path, has a "../" path, or carries an extra "tarball" field
    Then each is refused

  @test:schemas/library/software-library.test.ts::software-library/1.1.0_—_a_vendored_bundle::`vendored`_is_a_1.1.0_field:_a_vendored_node_stamped_1.0.0_is_refused
  Scenario: A vendored node stamped 1.0.0 is refused
    Given a valid vendored node
    When it is stamped with the 1.0.0 tag
    Then it is refused

  @test:schemas/library/software-library.test.ts::software-library/1.1.0_—_a_vendored_bundle::keeps_the_core:_a_digest_and_a_registry_tarball_over_https_are_still_required
  Scenario: A vendored node still needs a digest and an https registry tarball
    Given a valid vendored node
    When its digest is removed, or its source is an http URL
    Then each is refused

  @test:schemas/library/software-library.test.ts::software-library/1.1.0_—_a_vendored_bundle::a_node_is_stamped_the_OLDEST_version_with_every_field_it_uses
  Scenario: A node is stamped the oldest version that has every field it uses
    When the schema tag is chosen for a plain library and for a vendored node
    Then the plain library gets the 1.0.0 tag
    And the vendored node gets the vendored 1.1.0 tag

  @test:schemas/library/software-library.test.ts::software-library/1.1.0_—_a_vendored_bundle::its_file_names_the_version,_and_never_collides_with_a_dependency's_node
  Scenario: A vendored file names the version and never collides with a dependency's node
    When vendored file names are made for jquery 3.6.0 and @lhncbc/ucum-lhc 8.0.0
    Then they are "jquery-3.6.0.vendored.library.json" and "lhncbc__ucum-lhc-8.0.0.vendored.library.json"
    And the jquery vendored name differs from jquery's dependency file name
    And it ends with the library file suffix

  @test:schemas/library/software-library.test.ts::software-library/1.2.0_—_a_node_held_for_a_layer_below_the_kind::a_held_node_parses,_naming_the_layer_it_describes
  Scenario: A held node parses, naming the layer it describes
    Given a library stamped with the held 1.2.0 tag and layer "bootstrap-tools"
    When it is parsed
    Then it parses with no error

  @test:schemas/library/software-library.test.ts::software-library/1.2.0_—_a_node_held_for_a_layer_below_the_kind::`layer`_is_a_1.2.0_field:_a_held_node_stamped_1.0.0_or_1.1.0_is_refused
  Scenario: A held node stamped 1.0.0 or 1.1.0 is refused
    Given a valid held node
    When it is stamped with the 1.0.0 tag or the vendored 1.1.0 tag
    Then each is refused

  @test:schemas/library/software-library.test.ts::software-library/1.2.0_—_a_node_held_for_a_layer_below_the_kind::`layer`_is_an_instance_name,_as_`needs`_names_it
  Scenario: "layer" is an instance name, as "needs" names it
    Given a valid held node
    When its layer is "Bootstrap-Tools", "../bootstrap-tools" or empty
    Then each is refused

  @test:schemas/library/software-library.test.ts::software-library/1.2.0_—_a_node_held_for_a_layer_below_the_kind::a_held_node_keeps_every_other_rule:_range_and_dev_are_still_required
  Scenario: A held node still requires range
    # Gap: only range is checked; dev and the other rules are not
    Given a valid held node
    When its range is removed
    Then it is refused

  @test:schemas/library/software-library.test.ts::software-library/1.2.0_—_a_node_held_for_a_layer_below_the_kind::a_held_node_is_stamped_1.2.0,_and_nothing_else_is
  Scenario: A held node is stamped 1.2.0, and nothing else is
    When the schema tag is chosen for a record with a layer, and for one with a layer and a vendored path
    Then both get the held 1.2.0 tag
    And a plain library gets the 1.0.0 tag

  @test:schemas/library/software-library.test.ts::one_licence_parser_for_both_kinds::the_pinned_SPDX_list_loads
  Scenario: The pinned SPDX list loads
    When the SPDX licence list is loaded from the checkout
    Then it is a list, not an error message

  @test:schemas/library/software-library.test.ts::one_licence_parser_for_both_kinds::a_library_and_a_tool_release_give_the_same_answer_for_the_same_licence
  Scenario: A library and a tool release give the same licence answer
    Given the pinned SPDX list
    When the licences "MIT", "MIT OR Apache-2.0", "BlueOak-1.0.0", "Not-A-Licence" and "MIT AND" are checked as a library and as a tool release
    Then both checks give the same answer for each
    And "MIT" has no problem while "Not-A-Licence" has one

  @test:schemas/library/software-library.test.ts::the_software-library_graph_typology::is_registered,_derived,_and_not_rendered
  Scenario: The software-library typology is registered, derived and not rendered
    When the default graph typologies are read
    Then "software-library" is among their names
    And its graph layer is "derived"
    And it is not renderable

  @test:schemas/library/software-library.test.ts::the_software-library_graph_typology::names_all_three_families_—_1.0.0,_the_vendored_1.1.0_and_the_held_1.2.0_—_as_generator_output
  Scenario: The typology names all three families as generator output
    When the "software-library" typology definition is read
    Then its node schemas are exactly the 1.0.0, vendored 1.1.0 and held 1.2.0 tags
    And each of them is marked generated
