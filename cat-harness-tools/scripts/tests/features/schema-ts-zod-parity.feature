# schemas/types.ts declares the Block union and schemas/constraints.ts the Zod
# schemas that validate content; a field one side has and the other lacks is
# silently stripped. Field names are read off both sources, following
# extends, .extend() and Omit<> aliases. Each Scenario names the test that
# executes it.
Feature: TypeScript block interfaces and Zod schemas agree

  @test:scripts/tests/schema-ts-zod-parity.test.ts::schema_parity:_TS_interfaces_vs_Zod_schemas::both_sides_describe_the_same_block_kinds
  Scenario: Both sides describe the same block kinds
    When the kind literals of the TS block interfaces and of the Zod block schemas are read
    Then the two sets of kinds are equal

  @test:scripts/tests/schema-ts-zod-parity.test.ts::schema_parity:_TS_interfaces_vs_Zod_schemas::%s:_field_sets_agree
  Scenario: Each block kind's field sets agree
    Given a block kind and its TS interface
    When its inherited TS fields and its extended Zod fields are compared, ignoring "md"
    Then no field is only in TS and none only in Zod

  @test:scripts/tests/schema-ts-zod-parity.test.ts::every_block_kind_carries_the_editorial_relation::`uses`_is_declared_on_all_of_them
  Scenario: Every block kind declares uses
    # Gap: only the TS interfaces are checked; the Zod side is left to the parity test
    When the TS fields of every block kind are read
    Then each includes "uses"

  @test:scripts/tests/schema-ts-zod-parity.test.ts::every_block_kind_carries_`authorNotes`::`authorNotes`_is_declared_on_every_kind,_in_TS
  Scenario: Every block kind declares authorNotes in TS
    When the TS fields of every block kind are read
    Then each includes "authorNotes"

  @test:scripts/tests/schema-ts-zod-parity.test.ts::every_block_kind_carries_`authorNotes`::`authorNotes`_is_declared_on_every_kind,_in_Zod
  Scenario: Every block kind declares authorNotes in Zod
    When the Zod fields of every block kind are read
    Then each includes "authorNotes"

  @test:scripts/tests/schema-ts-zod-parity.test.ts::`authorNotes`_survives_validation,_not_just_declaration::%s:_an_authorNote_round-trips
  Scenario Outline: An author note survives validation
    Given a minimal <kind> block carrying one status author note
    When the <kind> Zod schema parses it
    Then the parse succeeds and the author notes come back equal

    Examples:
      | kind     |
      | prose    |
      | equation |
      | diagram  |
      | table    |

  @test:scripts/tests/schema-ts-zod-parity.test.ts::`authorNotes`_survives_validation,_not_just_declaration::granting_the_field_did_not_weaken_validation
  Scenario: An author note of an unknown kind is still rejected
    # Gap: the rejected note also lacks a date, so the rejection is not shown to come from its kind
    Given a prose block whose author note has the kind "nonsense"
    When the prose Zod schema parses it
    Then the parse fails
