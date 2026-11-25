# Every block schema, built-in or from a vocabulary module, must carry every
# field of BlockBaseSchema (schemas/constraints.ts), or Zod silently strips it.
# Each Scenario names the test that executes it.
Feature: Block schemas carry every base field

  @test:scripts/tests/block-base-fields.test.ts::block_schemas_vs_BlockBaseSchema::the_union_reaches_every_kind,_so_nothing_escapes_the_check_below
  Scenario: The checked schemas cover every block kind
    Given the members of BlockSchema, overridden by the schemas of every discovered vocabulary module
    When their kinds are collected and sorted
    Then they equal BLOCK_KINDS, sorted

  @test:scripts/tests/block-base-fields.test.ts::block_schemas_vs_BlockBaseSchema::BlockBaseSchema_still_carries_the_fields_this_guard_is_about
  Scenario: BlockBaseSchema still declares the guarded fields
    Given the keys of BlockBaseSchema's shape
    Then they include "authorNotes", "defines", "cites", "simulator", "computation" and "uses"

  @test:scripts/tests/block-base-fields.test.ts::block_schemas_vs_BlockBaseSchema::%s_declares_every_base_field
  Scenario: Each block kind's schema declares every BlockBaseSchema field
    Given the schema of each block kind, from BlockSchema or a vocabulary module
    When its shape keys are compared with BlockBaseSchema's
    Then no base field is missing

  @test:scripts/tests/block-base-fields.test.ts::the_four_optional-label_kinds_accept_what_they_used_to_drop::%s
  Scenario: An optional-label kind keeps cites, defines, authorNotes and computation when parsed
    Given a block of each kind prose, equation, diagram and table with a label
    And it declares cites "someref2020", defines "some-term", an author note "kept" and a not-run python computation
    When BlockSchema parses it
    Then the parsed block still has cites, defines, authorNotes and computation
