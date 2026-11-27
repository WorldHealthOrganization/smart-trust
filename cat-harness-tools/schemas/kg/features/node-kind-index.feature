# Specifies schemas/kg/node-kind-index.ts (issue #2195): node kinds found
# through the typologies, the unkinded families and their per-layer ratchet,
# who owns a family, and the baseline file.
Feature: Node kinds are indexed through the typologies, and unkinded families are ratcheted per layer

  @test:schemas/kg/node-kind-index.test.ts::nodeKindIndex::a_family_whose_validator_is_a_nodeKind()_is_a_node_kind,_holding_that_family
  Scenario: A family validated by a nodeKind is a node kind holding that family
    Given a registry whose "widgets" typology validates "child/v1" with the nodeKind Child in kinds.ts
    When the node kind index is built
    Then child/v1 is held by widgets for the family child/v1
    And its module is kinds.ts

  @test:schemas/kg/node-kind-index.test.ts::nodeKindIndex::a_typology_with_no_families_is_judged_on_its_kind-level_validator
  Scenario: A typology with no families is judged on its kind-level validator
    Given the "solo" typology whose kind-level validator is the nodeKind Base
    When the node kind index is built
    Then base/v1 is held by solo with no family

  @test:schemas/kg/node-kind-index.test.ts::nodeKindIndex::parents_and_subclasses_are_both_recorded,_so_the_tree_reads_either_way
  Scenario: Parents and subclasses are both recorded
    Given Base, Child of Base, and Grandchild of Child
    When the node kind index is built
    Then child/v1's parents are base/v1
    And base/v1's subclasses are child/v1
    And base/v1 with its subclasses is base/v1, child/v1, grandchild/v1

  @test:schemas/kg/node-kind-index.test.ts::nodeKindIndex::a_bare_Zod_schema_and_a_missing_validator_are_UNKINDED,_each_with_its_reason
  Scenario: A bare Zod schema and a missing validator are unkinded, with reasons
    Given the widgets families none/v1 with no validator and plain/v1 validated by a bare Zod object
    When the node kind index is built
    Then the unkinded list is none/v1 for "no-validator" and plain/v1 for "zod-schema" with its ref

  @test:schemas/kg/node-kind-index.test.ts::nodeKindIndex::an_external_standard_and_a_typology_with_nothing_to_type_are_not_counted_at_all
  Scenario: External standards and typologies with nothing to type are not unkinded
    Given a widgets family that is an external JSON Schema, and the "prose" typology with no validator
    When the node kind index is built
    Then neither appears in the unkinded list

  @test:schemas/kg/node-kind-index.test.ts::nodeKindIndex::no_collisions_when_one_kind_is_reached_twice
  Scenario: A kind reached twice is one entry and no collision
    Given the registry of widgets, solo and prose, in which base/v1 is reached both as solo's validator and as child/v1's parent
    When the node kind index is built
    Then base/v1 is one entry, held by solo, and child/v1's parent is base/v1
    And its collisions are empty
    And for a registry whose typologies left and right both name the Child kind as validator
    Then child/v1 is one entry holding left and right
    And that index's collisions are empty too

  @test:schemas/kg/node-kind-index.test.ts::the_ratchet::a_family_unkinded_now_and_absent_from_the_baseline_is_NEW
  Scenario: An unkinded family absent from the baseline is new
    Given a baseline holding only widgets#plain/v1
    When the new unkinded families are computed
    Then they are widgets#none/v1

  @test:schemas/kg/node-kind-index.test.ts::the_ratchet::a_baselined_family_is_not_new,_and_one_that_became_a_kind_simply_leaves
  Scenario: Baselined families are not new, and a family since kinded is not reported
    Given a baseline holding every current unkinded family plus widgets#child/v1, which is now a kind
    When the new unkinded families are computed
    Then there are none

  @test:schemas/kg/node-kind-index.test.ts::who_owns_a_family::a_typology_declared_in_an_instance's_typologies/_graph_belongs_to_that_instance
  Scenario: A typology declared in an instance's typologies/ belongs to that instance
    Given a checkout whose instance alpha declares the typology "gadgets"
    When the owner of "gadgets" is asked
    Then it is alpha

  @test:schemas/kg/node-kind-index.test.ts::who_owns_a_family::a_typology_this_layer_lists_in_code_belongs_to_this_module's_own_instance
  Scenario: A base typology belongs to this module's own instance
    Given a registry seeded in code with "widgets", which is not a base typology
    Then "widgets" has no owner
    And in the default registry "beans" belongs to this harness's own instance

  @test:schemas/kg/node-kind-index.test.ts::who_owns_a_family::a_typology_a_FIXTURE_instance_declares_belongs_to_that_instance,_not_to_the_one_containing_the_fixture_(bean_w1gy)
  Scenario: A typology a fixture instance declares belongs to the fixture instance
    Given a fixture checkout under alpha/test/fixtures/checkout whose instance beta declares "sprockets"
    And FOLIO_FIXTURE_CHECKOUT pointing at it
    When a registry over the checkout is built
    Then "sprockets" is declared by beta's file and owned by beta
    And "gadgets" is still owned by alpha
    And "sprockets" is owned outside the checkout while "gadgets" is not

  @test:schemas/kg/node-kind-index.test.ts::who_owns_a_family::one_registered_in_code_by_a_module_nothing_here_knows_is_NOT_attributed_to_a_guess
  Scenario: A typology registered in code by an unknown module has no owner
    Given a registry over the checkout with "coded" registered in code
    When the owner of "coded" is asked
    Then there is none

  @test:schemas/kg/node-kind-index.test.ts::the_per-layer_ratchet::a_layer_whose_baseline_holds_its_own_families_passes
  Scenario: Layers whose baselines hold their own families pass
    Given unkinded a1#x/v1 and a2 owned by alpha, and b1#y/v1 owned by beta
    And each layer's baseline holding exactly its own
    When the per-layer ratchet runs
    Then nothing is unattributed
    And no layer has fresh, gone or foreign families

  @test:schemas/kg/node-kind-index.test.ts::the_per-layer_ratchet::a_NEW_family_fails_in_its_OWN_layer,_and_another_layer's_baseline_does_not_excuse_it
  Scenario: A new family fails in its own layer, whatever another layer's baseline holds
    Given a new unkinded family b1#z/v1, owned by beta but listed in alpha's baseline
    When the per-layer ratchet runs
    Then beta's fresh families are b1#z/v1
    And alpha has nothing fresh but lists b1#z/v1 as foreign

  @test:schemas/kg/node-kind-index.test.ts::the_per-layer_ratchet::an_instance_that_declares_no_baseline_owns_an_empty_one
  Scenario: An instance with no baseline is judged against an empty one
    Given baselines for alpha only
    When the per-layer ratchet runs
    Then beta's fresh families are b1#y/v1

  @test:schemas/kg/node-kind-index.test.ts::the_per-layer_ratchet::a_baselined_family_that_became_a_kind_is_GONE,_and_the_writer_drops_it
  Scenario: A baselined family that is no longer unkinded is gone and dropped
    Given alpha's baseline of a1#x/v1 and a2, and only a2 still unkinded
    When the per-layer ratchet runs
    Then alpha has a1#x/v1 gone and nothing fresh
    And alpha keeps only a2

  @test:schemas/kg/node-kind-index.test.ts::the_per-layer_ratchet::--accept-unkinded_keeps_a_new_family_in_its_owner's_baseline,_and_only_there
  Scenario: Accepting unkinded families keeps each in its owner's baseline
    Given empty baselines for alpha and beta
    When the per-layer ratchet runs accepting unkinded families
    Then alpha keeps a1#x/v1 and a2, and beta keeps b1#y/v1

  @test:schemas/kg/node-kind-index.test.ts::the_per-layer_ratchet::a_family_no_instance_can_own_is_unattributed,_not_filed_under_a_guess
  Scenario: A family with no owner is unattributed
    Given an unkinded typology "orphan" that no instance owns, and no baselines
    When the per-layer ratchet runs
    Then "orphan" is unattributed
    And there are no layers

  @test:schemas/kg/node-kind-index.test.ts::the_per-layer_ratchet::MIGRATION:_splitting_one_shared_baseline_by_owner_passes_and_fails_exactly_what_it_did
  Scenario: Splitting a shared baseline by owner changes no verdict
    Given four unkinded families and every subset of them as a shared baseline
    When each subset is split by owner and the per-layer ratchet runs
    Then the union of the layers' fresh families equals the shared ratchet's new families
    And no layer has gone or foreign families

  @test:schemas/kg/node-kind-index.test.ts::the_baseline_file::is_keys_only,_sorted_and_de-duplicated,_under_its_kind's_tag
  Scenario: The baseline file is sorted, de-duplicated keys under its tag
    Given the keys b#y/v1, a, and b#y/v1 again
    When the baseline is rendered and parsed back
    Then it is { $schema: "unkinded-baseline/1.0.0", unkinded: [a, b#y/v1] }
    And it parses with the unkinded-baseline kind's schema

  @test:schemas/kg/node-kind-index.test.ts::the_baseline_file::refuses_a_field_that_would_drift_with_another_layer_(a_validator_ref)
  Scenario: The baseline file refuses a validator ref
    Given a baseline entry carrying a ref
    When it is parsed with the unkinded-baseline kind's schema
    Then it is refused
