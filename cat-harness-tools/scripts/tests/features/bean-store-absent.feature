# scripts/bean-store-read.ts and scripts/beans.ts tell a bean store a mount determined absent from
# this checkout, which reads as unreachable and throws a typed error, apart from one merely not mounted.
# Each Scenario names the test that executes it.
Feature: A bean store absent from this checkout

  @test:scripts/tests/bean-store-absent.test.ts::the_readers::a_recorded_absence_reads_as_`unreachable`_with_`absent`,_and_the_readers_throw_the_typed_error
  Scenario: A recorded absence reads as unreachable and absent, and the readers throw the typed error
    Given a scratch checkout declaring a tip-kept beans graph with a recorded absence
    When the bean store is resolved and read
    Then the bean definitions resolve to no directory, marked absent
    And the store reads as "unreachable" and absent
    And reading the bean files and reading the beans each throw BeanStoreAbsentError
    And BeanStoreAbsentError is a StoreAbsentError

  @test:scripts/tests/bean-store-absent.test.ts::the_readers::NOT_MOUNTED_is_not_absent:_no_flag,_and_a_plain_error
  Scenario: A store not mounted is not absent, with no flag and a plain error
    Given a scratch checkout declaring a tip-kept beans graph with no recorded absence
    When the bean store is resolved and read
    Then the bean definitions carry no absent flag
    And the store reads as "unreachable" without being absent
    And reading the bean files throws an Error that is not a StoreAbsentError

  @test:scripts/tests/bean-store-absent.test.ts::the_gates::%s:_absent_exits_78;_not_mounted_stays_red
  Scenario: Each bean gate exits 78 on an absent store and stays red on one not mounted
    Given the gates check-bean-parents.ts, check-draft-beans.ts, check-bean-issues.ts, check-bean-rollup.ts and check-harness-dirs.ts
    When each gate runs in a scratch checkout with a recorded absence
    Then it exits 78 and prints "NOT APPLICABLE"
    And when it runs in a checkout where the store is merely not mounted it exits neither 0 nor 78
