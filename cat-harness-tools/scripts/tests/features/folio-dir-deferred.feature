# folioDirDeferred in schemas/kg/cat-harness.ts defers a folioDir failure from module load to first use, while a readable root
# still resolves at construction. Each Scenario names the test that executes it.
Feature: Deferred folio directory resolution

  @test:scripts/tests/folio-dir-deferred.test.ts::folioDirDeferred::the_precondition:_`folioDir`_really_does_throw_on_this_root
  Scenario: folioDir throws on a root with an unparseable declaration
    Given a root whose own declaration file holds "{ not json"
    When folioDir is called on it
    Then it throws

  @test:scripts/tests/folio-dir-deferred.test.ts::folioDirDeferred::constructing_it_does_NOT_throw,_which_is_the_whole_point
  Scenario: Constructing the deferred resolver does not throw
    Given a root whose own declaration file holds "{ not json"
    When folioDirDeferred is constructed over it
    Then no error is thrown

  @test:scripts/tests/folio-dir-deferred.test.ts::folioDirDeferred::the_first_USE_throws,_and_names_the_module_that_could_not_resolve
  Scenario: The first use throws, naming the module that could not resolve
    Given a deferred resolver over an unreadable root for the module "file:///probe-module.ts"
    When it is called
    Then it throws an error naming "probe-module.ts"

  @test:scripts/tests/folio-dir-deferred.test.ts::folioDirDeferred::the_original_failure_is_carried_as_`cause`,_not_flattened_into_a_string
  Scenario: The original failure is carried as the cause
    Given a deferred resolver over an unreadable root
    When it is called
    Then the error message contains "is not valid JSON"
    And the error has an Error as its cause

  @test:scripts/tests/folio-dir-deferred.test.ts::folioDirDeferred::a_readable_root_resolves,_and_resolves_AT_CONSTRUCTION
  Scenario: A readable root resolves at construction
    # Gap: that resolution happens at construction rather than on first use is not observed, only that results agree
    Given a deferred resolver over an empty, readable root
    When it is called
    Then it returns what folioDir returns for that root
    And a second call returns the same value
