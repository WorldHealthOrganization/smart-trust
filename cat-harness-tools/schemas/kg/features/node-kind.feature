# Specifies schemas/kg/node-kind.ts (bean a1lq, issue #2195): nodeKind with
# multiple inheritance, declared overrides, versioned tags and acceptsSchemaTag,
# mixins and strict kinds; and the todo kind built with it.
Feature: A node kind composes its parents once, refuses conflicts, and stamps a versioned tag

  @test:schemas/kg/node-kind.test.ts::nodeKind::a_diamond_composes_the_shared_ancestor_once,_deepest_first
  Scenario: A diamond composes the shared ancestor once, deepest first
    Given kinds left and right each extending base, and child extending left and right
    When child is composed
    Then its order is base, left, right, child
    And its fields are id, l, r, c

  @test:schemas/kg/node-kind.test.ts::nodeKind::refuses_a_field_two_unrelated_parents_define
  Scenario: A field two unrelated parents define is refused
    Given unrelated kinds a and b that both define k
    When a kind extending a and b is made
    Then it throws "`k` is defined by `a` and `b`"

  @test:schemas/kg/node-kind.test.ts::nodeKind::refuses_it_at_different_depths_too_—_incomparable,_not_same-depth
  Scenario: The conflict is refused at different depths too
    Given a defining k, and b extending d which defines k
    When a kind extending a and b is made
    Then it throws "`k` is defined by"

  @test:schemas/kg/node-kind.test.ts::nodeKind::the_child_settles_such_a_conflict_by_redefining_the_field,_declared
  Scenario: The child settles the conflict by a declared override
    Given a and b both defining k
    When a kind extending both redefines k as a boolean and lists k in overrides
    Then it parses { k: true }

  @test:schemas/kg/node-kind.test.ts::nodeKind::refuses_an_override_the_child_did_not_declare,_and_one_that_overrides_nothing
  Scenario: Undeclared overrides and overrides of nothing are refused
    When a kind redefines base's id without listing it in overrides
    Then it throws "without being listed in `overrides`"
    And a kind listing z in overrides when no ancestor defines z throws "no ancestor defines it"

  @test:schemas/kg/node-kind.test.ts::nodeKind::refuses_two_different_kinds_under_one_id
  Scenario: Two different kinds under one id are refused
    Given base and a different kind also named base
    When a kind extending both is made
    Then it throws "two different kinds are both named `base`"

  @test:schemas/kg/node-kind.test.ts::the_todo_declares_its_parents::is_composed_carried-note,_then_themed,_then_its_own_fields
  Scenario: The todo is composed carried-note, themed, then its own fields
    When the todo node kind is read
    Then its order is carried-note, themed, todo
    And its tag is todo/1.0.0
    And its schema's fields are, in order, id, summary, comment, createdAt, updatedAt, targetLabel, anchor, alsoAbout, tags, theme, layout, status, priority, origin and $schema

  @test:schemas/kg/node-kind.test.ts::the_todo_declares_its_parents::keeps_its_static_type_—_a_field_from_each_parent_is_typed,_not_unknown
  Scenario: The todo's fields keep their static types
    Given a value typed as TodoNode
    When summary, theme and $schema are assigned to variables of type string or string-or-undefined
    Then the test compiles under the type checker
    And at run time it only asserts that the array of those values is defined

  @test:schemas/kg/node-kind.test.ts::versioned_kinds_(SemVer,_one_live_major_—_issue_#2195)::splits_the_id_into_a_NAME_and_a_version,_and_records_the_tag_a_writer_stamps
  Scenario: A versioned id splits into name, version and tag
    Given the kind "widget/1.2.3"
    Then its id is widget, its version 1.2.3 and its tag widget/1.2.3

  @test:schemas/kg/node-kind.test.ts::versioned_kinds_(SemVer,_one_live_major_—_issue_#2195)::accepts_its_own_tag_and_any_earlier_minor_or_patch_of_the_same_major
  Scenario: A kind accepts its tag and earlier minors and patches of its major
    Given the kind widget/1.2.3
    Then it accepts widget/1.2.3, widget/1.2.0 and widget/1.0.9
    And its schema parses a node tagged widget/1.1.0

  @test:schemas/kg/node-kind.test.ts::versioned_kinds_(SemVer,_one_live_major_—_issue_#2195)::refuses_a_newer_minor_or_patch,_another_major,_and_another_name
  Scenario: A kind refuses newer versions, other majors and other names
    Given the kind widget/1.2.3
    Then it refuses widget/1.2.4, widget/1.3.0, widget/2.0.0, widget/0.9.0, gadget/1.2.3 and widget/v1
    And its schema refuses a node tagged widget/2.0.0

  @test:schemas/kg/node-kind.test.ts::versioned_kinds_(SemVer,_one_live_major_—_issue_#2195)::a_subclass's_generated_$schema_replaces_its_parent's_without_an_override
  Scenario: A subclass's generated $schema replaces its parent's
    Given sub-widget/1.0.0 extending widget/1.2.3, with no override declared
    Then it parses a node tagged sub-widget/1.0.0
    And it refuses one tagged widget/1.2.3

  @test:schemas/kg/node-kind.test.ts::versioned_kinds_(SemVer,_one_live_major_—_issue_#2195)::refuses_a_hand-written_$schema_on_a_versioned_kind:_one_answer,_not_two
  Scenario: A hand-written $schema on a versioned kind is refused
    When the kind dup/1.0.0 is made with its own $schema field
    Then it throws "generates its `$schema`"

  @test:schemas/kg/node-kind.test.ts::versioned_kinds_(SemVer,_one_live_major_—_issue_#2195)::an_unversioned_id_is_a_mixin:_no_version,_no_tag,_no_generated_field
  Scenario: An unversioned kind is a mixin
    Given the kind "tinted"
    Then it has no version, no tag and no $schema field

  @test:schemas/kg/node-kind.test.ts::strict_kinds_—_a_kind_made_from_a_strict_schema's_shape_judges_as_that_schema_did::refuses_an_undeclared_key_only_when_strict
  Scenario: An undeclared key is refused only by a strict kind
    Given a strict Zod schema, a strict kind of its shape and a loose kind of its shape
    When a value with an undeclared key b is parsed by each
    Then the schema and the strict kind refuse it
    And the loose kind accepts it

  @test:schemas/kg/node-kind.test.ts::strict_kinds_—_a_kind_made_from_a_strict_schema's_shape_judges_as_that_schema_did::accepts_what_the_schema_accepts,_and_keeps_a_refinement
  Scenario: A strict kind accepts what the schema accepts and keeps a refinement
    Given the strict kind, and a strict kind with a refinement refusing a = "bad"
    Then the strict kind parses { $schema: x/v1, a: y }
    And the refined kind refuses a = "bad"
    And the refined kind refuses a = "ok" with an undeclared key b
