# How schemas/kg/jsonld.ts turns folio labels into JSON-LD node IRIs: a label looks like a compact
# IRI and is not one, so resolveLabel mints every @id itself, one IRI per block, and refuses what it
# cannot parse. Each Scenario names the test that executes it.
Feature: Resolving folio labels to JSON-LD IRIs

  @test:scripts/tests/jsonld-label-resolution.test.ts::prefix_list_stays_in_sync_with_constraints.ts::KIND_PREFIXES_mirrors_KNOWN_LABEL_PREFIXES
  Scenario: The JSON-LD kind prefixes mirror the known label prefixes
    Given the known label prefixes from schemas/constraints.ts
    When the prefix sync guard is run over them
    Then it does not throw

  @test:scripts/tests/jsonld-label-resolution.test.ts::prefix_list_stays_in_sync_with_constraints.ts::the_guard_actually_fires_when_they_diverge
  Scenario: The prefix sync guard fires when the lists diverge
    Given the known label prefixes with an extra "newkind:" added
    When the prefix sync guard is run over them
    Then it throws "out of sync"

  @test:scripts/tests/jsonld-label-resolution.test.ts::parseReference_—_the_three_authored_forms::same-paper_label
  Scenario: A same-paper label parses to its prefix and slug
    When "def:quantum-universe" is parsed as a reference
    Then it is a same-paper reference with prefix "def" and slug "quantum-universe"

  @test:scripts/tests/jsonld-label-resolution.test.ts::parseReference_—_the_three_authored_forms::cross-paper_label
  Scenario: A cross-paper label parses to its namespace, prefix and slug
    When "unital-groebner-bases:cor:pbw" is parsed as a reference
    Then it is a cross-paper reference with namespace "unital-groebner-bases", prefix "cor" and slug "pbw"

  @test:scripts/tests/jsonld-label-resolution.test.ts::parseReference_—_the_three_authored_forms::nested_namespace,_per_citesProvable's_documented_grammar
  Scenario: A nested namespace parses to every namespace segment
    When "some-ns:unital-groebner-bases:prop:foo" is parsed as a reference
    Then it is a cross-paper reference with namespaces "some-ns" and "unital-groebner-bases", prefix "prop" and slug "foo"

  @test:scripts/tests/jsonld-label-resolution.test.ts::parseReference_—_the_three_authored_forms::cross-folio_URL_passes_through_untouched
  Scenario: A cross-folio URL passes through untouched
    When "https://folio.example.org/papers/foo#def:bar" is parsed as a reference
    Then it is an absolute reference carrying that URL unchanged

  @test:scripts/tests/jsonld-label-resolution.test.ts::parseReference_—_the_three_authored_forms::a_slug_may_itself_contain_a_colon_—_first_kind_prefix_wins
  Scenario: A slug may itself contain a colon and the first kind prefix wins
    When "def:foo:bar" is parsed as a reference
    Then it is a same-paper reference with prefix "def" and slug "foo:bar"

  @test:scripts/tests/jsonld-label-resolution.test.ts::parseReference_—_refuses_to_guess::no_kind_prefix_anywhere_is_unresolvable,_not_an_absolute_IRI
  Scenario: A reference with no kind prefix anywhere is unresolvable rather than an absolute IRI
    When "unital-groebner-bases:mystery:pbw" is parsed as a reference
    Then its form is "unresolvable"
    And resolving it in paper "qou" gives no IRI

  @test:scripts/tests/jsonld-label-resolution.test.ts::parseReference_—_refuses_to_guess::a_bare_word_with_no_colon_is_a_bare_label,_not_unresolvable
  Scenario: A bare word with no colon is a bare label
    When "quantum-universe" is parsed as a reference
    Then it is a bare-label reference with label "quantum-universe"

  @test:scripts/tests/jsonld-label-resolution.test.ts::parseReference_—_refuses_to_guess::an_empty_slug_is_unresolvable
  Scenario: An empty slug is unresolvable
    When "def:" is parsed as a reference
    Then its form is "unresolvable"

  @test:scripts/tests/jsonld-label-resolution.test.ts::resolveLabel_—_one_block,_one_IRI::same-paper_and_cross-paper_forms_of_one_block_agree
  Scenario: The same-paper and cross-paper forms of one block resolve to one IRI
    Given "cor:pbw" referenced inside paper "unital-groebner-bases"
    And "unital-groebner-bases:cor:pbw" referenced from paper "qou"
    When both are resolved
    Then both give "papers/unital-groebner-bases/blocks/cor-pbw"

  @test:scripts/tests/jsonld-label-resolution.test.ts::resolveLabel_—_one_block,_one_IRI::the_same_label_in_two_papers_does_NOT_collide
  Scenario: The same label in two papers does not collide
    When "def:foo" is resolved in paper "qou" and in paper "other"
    Then the two IRIs differ

  @test:scripts/tests/jsonld-label-resolution.test.ts::resolveLabel_—_one_block,_one_IRI::nested_namespaces_become_path_segments
  Scenario: Nested namespaces become path segments
    When "some-ns:paper-dir:prop:foo" is resolved in paper "qou"
    Then the IRI is "papers/some-ns/paper-dir/blocks/prop-foo"

  @test:scripts/tests/jsonld-label-resolution.test.ts::resolveLabel_—_one_block,_one_IRI::emitted_IRIs_are_relative,_so_a_deploy-base_change_rewrites_nothing
  Scenario: Emitted IRIs are relative
    When "def:foo" is resolved in paper "qou"
    Then the IRI does not start with "http"

  @test:scripts/tests/jsonld-label-resolution.test.ts::label_↔_IRI_segment_round-trip::round-trips_a_hyphenated_slug
  Scenario: A hyphenated slug round-trips between label and segment
    When the label "def" with slug "quantum-universe" is turned into a segment
    Then the segment is "def-quantum-universe"
    And turning the segment back gives "def:quantum-universe"

  @test:scripts/tests/jsonld-label-resolution.test.ts::label_↔_IRI_segment_round-trip::round-trips_every_known_kind_prefix
  Scenario: Every known kind prefix round-trips between label and segment
    Given every kind prefix
    When each with slug "a-b-c" is turned into a segment and back
    Then the label is that prefix followed by ":a-b-c"

  @test:scripts/tests/jsonld-label-resolution.test.ts::label_↔_IRI_segment_round-trip::a_foreign_segment_yields_undefined_rather_than_a_bogus_label
  Scenario: A foreign segment yields no label rather than a bogus one
    When the segments "notaprefix-foo" and "nohyphen" are turned back into labels
    Then both give no label

  @test:scripts/tests/jsonld-label-resolution.test.ts::types::every_block_kind_has_a_folio_type
  Scenario: Every block kind has a folio type
    Given every block kind
    Then each has a folio type in the kind-to-type map
    And each has at least one type

  @test:scripts/tests/jsonld-label-resolution.test.ts::types::an_unknown_kind_yields_no_types_rather_than_a_guessed_one
  Scenario: An unknown kind yields no types rather than a guessed one
    When the types for "not-a-kind" are asked
    Then there are none

  @test:scripts/tests/jsonld-label-resolution.test.ts::types::simulator_carries_no_DoCO_co-type_—_it_has_no_counterpart
  Scenario: A simulator carries no DoCO co-type
    When the types for "simulator" are asked
    Then they are exactly "folio-assistant-core:Simulator"

  @test:scripts/tests/jsonld-label-resolution.test.ts::mintNodeId_—_a_block's_own_label_always_yields_an_id::a_prefixed_label_mints_the_same_id_resolveLabel_gives
  Scenario: A prefixed label mints the same id resolveLabel gives
    When "def:widget" is minted as a node id in paper "qou"
    Then it equals the IRI resolveLabel gives for it

  @test:scripts/tests/jsonld-label-resolution.test.ts::mintNodeId_—_a_block's_own_label_always_yields_an_id::a_prefix-less_label_still_gets_a_UNIQUE_id
  Scenario: A prefix-less label still gets a unique id
    When "tm-general-form" and "tm-knot-pairs" are minted as node ids in paper "qou"
    Then the two ids differ
    And the first is "papers/qou/blocks/tm-general-form"

  @test:scripts/tests/jsonld-label-resolution.test.ts::mintNodeId_—_a_block's_own_label_always_yields_an_id::it_never_returns_undefined,_however_odd_the_label
  Scenario: Minting a node id never returns undefined however odd the label
    Given the labels "tm-x", "weird label!", "::", an empty label and "a/b"
    When each is minted as a node id in paper "qou"
    Then each id is a non-empty string

  @test:scripts/tests/jsonld-label-resolution.test.ts::mintNodeId_—_a_block's_own_label_always_yields_an_id::a_prefix-less_REFERENCE_resolves_to_the_id_that_label_would_mint
  Scenario: A prefix-less reference resolves to the id that label would mint
    When "tm-general-form" is resolved and minted in paper "qou"
    Then both give "papers/qou/blocks/tm-general-form"

  @test:scripts/tests/jsonld-label-resolution.test.ts::mintNodeId_—_a_block's_own_label_always_yields_an_id::resolving_a_prefix-less_reference_does_not_mask_a_typo
  Scenario: Resolving a prefix-less reference keeps a typo visible
    When the misspelt "tm-genrel-form" is resolved in paper "qou"
    Then it gives "papers/qou/blocks/tm-genrel-form"
    And that differs from the id minted for "tm-general-form"

  @test:scripts/tests/jsonld-label-resolution.test.ts::mintNodeId_—_a_block's_own_label_always_yields_an_id::a_genuinely_ambiguous_reference_is_still_refused
  Scenario: A genuinely ambiguous reference is still refused
    When "unital-groebner-bases:mystery:pbw" and "def:" are resolved in paper "qou"
    Then both give no IRI

  @test:scripts/tests/jsonld-label-resolution.test.ts::contributed_label_prefixes::without_them_a_contributed_prefix_is_not_a_pivot
  Scenario: Without the contributed prefixes a contributed prefix is not a pivot
    When "dt:anc-contact" is parsed with only the built-in prefixes
    Then its form is "unresolvable"
    And it counts as a cross-paper reference

  @test:scripts/tests/jsonld-label-resolution.test.ts::contributed_label_prefixes::with_them_it_parses_as_same-paper_and_cross-paper
  Scenario: With the contributed prefixes a contributed label parses as same-paper and cross-paper
    Given the contributed prefix "dt"
    When "dt:anc-contact" is parsed with it
    Then it is a same-paper reference with prefix "dt" and slug "anc-contact"
    And "anc-dak:dt:anc-contact" is a cross-paper reference with namespace "anc-dak"
    And "dt:anc-contact" is not a cross-paper reference whether the prefix is given as "dt" or "dt:"

  @test:scripts/tests/jsonld-label-resolution.test.ts::contributed_label_prefixes::resolveLabel_threads_them_through
  Scenario: resolveLabel threads the contributed prefixes through
    When "dt:anc-contact" is resolved in paper "p" without contributed prefixes
    Then it gives no IRI
    And with the contributed prefix "dt" it gives "papers/p/blocks/" followed by the segment for "dt" and "anc-contact"
