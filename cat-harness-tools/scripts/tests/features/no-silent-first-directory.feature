# No call site takes the first directory of a graph without an accessor that
# refuses when there are several (bean a02m), and a layer declaring a kind
# twice is audited rather than crashing. Each Scenario names the test that executes it.
Feature: No silent first directory

  @test:scripts/tests/no-silent-first-directory.test.ts::a_call_site_that_wants_ONE_directory_says_so_with_an_accessor_that_refuses::the_scan_found_source_—_otherwise_the_assertion_below_proves_nothing
  Scenario: The scan found source files
    When the workspace's .ts files outside skipped directories are listed
    Then there are more than 200

  @test:scripts/tests/no-silent-first-directory.test.ts::a_call_site_that_wants_ONE_directory_says_so_with_an_accessor_that_refuses::no_module_indexes_the_first_declared_directory
  Scenario: No module indexes the first declared directory
    When every listed file other than this test is read without comments
    Then none holds directoriesForGraph(...)[0]

  @test:scripts/tests/no-silent-first-directory.test.ts::an_instance_that_declares_a_kind_twice_is_auditable,_not_a_crash::the_singular_refuses_exactly_when_the_plural_finds_several
  Scenario: The singular accessor refuses exactly when the plural finds several
    When each instance in the workspace is asked for its schemas directories both ways
    Then the singular throws exactly for those with more than one

  @test:scripts/tests/no-silent-first-directory.test.ts::an_instance_that_declares_a_kind_twice_is_auditable,_not_a_crash::an_instance_that_declares_a_kind_twice_really_is_plural,_so_the_case_above_is_live
  Scenario: An instance declaring a kind twice is plural
    Given a fixture layer declaring schemas at two directories
    Then the plural accessor finds two and the singular throws

  @test:scripts/tests/no-silent-first-directory.test.ts::an_instance_that_declares_a_kind_twice_is_auditable,_not_a_crash::kg:audit_--instance_runs_on_such_an_instance_instead_of_throwing
  Scenario: kg:audit --instance runs on such an instance instead of throwing
    Given the fixture layer declaring schemas twice
    When kg-audit runs on it with --check
    Then it does not throw the "this call site expects one" error, and it prints the audit summary
