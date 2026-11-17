# scripts/check-bean-parent-prose.ts reports beans whose body places them under a parent their
# front matter does not carry, run here against the live store and read as source text.
# Each Scenario names the test that executes it.
Feature: Bean parent named in prose

  @test:scripts/tests/bean-parent-prose.test.ts::the_store_is_clean_as_committed::`--check`_passes
  Scenario: The parent-prose check passes on the store as committed
    Given the bean store as committed
    When check:bean-parent-prose runs with "--check"
    Then its output says "beans read"
    And it exits 0

  @test:scripts/tests/bean-parent-prose.test.ts::the_scope_is_justified_by_a_measured_ratio::placement_claims_are_a_tiny_fraction_of_id_mentions
  Scenario: Placement claims are a tiny fraction of id mentions
    Given the bean store as committed
    When check:bean-parent-prose runs
    Then the "...in a PLACEMENT phrase" row reads N of M with M above 100
    And N times 10 is below M plus 10

  @test:scripts/tests/bean-parent-prose.test.ts::the_scope_is_justified_by_a_measured_ratio::the_bodies-with-ids_row_carries_its_denominator
  Scenario: The bodies-with-ids row carries its denominator
    Given the bean store as committed
    When check:bean-parent-prose runs
    Then the "...naming any bean id" row reads N of M with M greater than N and N above 0

  @test:scripts/tests/bean-parent-prose.test.ts::an_empty_domain_says_so::zero_placement_claims_is_reported_as_a_determined_empty,_not_a_pass
  Scenario: Zero placement claims is reported as a determined empty, not a pass
    # Gap: only the branch matching the live store's placement count is checked on each run
    Given the bean store as committed
    When check:bean-parent-prose runs
    Then with zero placement claims the output says "determined empty rather than a clean sweep" and not "✓ no drift"
    And with any placement claims the output says "✓ no drift"
    And it exits 0

  @test:scripts/tests/bean-parent-prose.test.ts::quotations_are_not_claims::blockquote_and_fenced_lines_are_dropped_before_matching
  Scenario: Blockquote and fenced lines are dropped before matching
    # Gap: checked on the source text, not by running against a quoting bean
    Given the source of scripts/check-bean-parent-prose.ts
    Then it contains "assertedProse"
    And it holds a blockquote guard and a code-fence guard

  @test:scripts/tests/bean-parent-prose.test.ts::one_reader_of_the_store::it_uses_`readBeans`_rather_than_walking_the_directory
  Scenario: The check reads the store through readBeans rather than walking the directory
    # Gap: checked on the source text only
    Given the source of scripts/check-bean-parent-prose.ts
    Then it imports readBeans from "./beans.ts"
    And it does not contain "readdirSync"

  @test:scripts/tests/bean-parent-prose.test.ts::one_reader_of_the_store::a_store_it_cannot_open_refuses_rather_than_reporting_no_drift
  Scenario: A store it cannot open refuses rather than reporting no drift
    # Gap: checked on the source text, not by running against a store with no declaration
    Given the source of scripts/check-bean-parent-prose.ts
    Then it contains "no bean-defs node declared"
    And it contains "rather than reporting no drift"
