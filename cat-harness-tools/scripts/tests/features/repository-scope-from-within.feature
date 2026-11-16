# A repository-scoped store's nested declarations get an owner: when the
# repository root declares no layer, the declaring layer owns what the
# directory declares from within; when it does, they are not followed. The
# fixture layer "inst" declares the root's beans/ repository-scoped, and
# beans/beans.json declares "defs". Each Scenario names the test that executes
# it.
Feature: A repository-scoped entry's from-within declarations belong to its declarer only when the root declares no layer

  @test:scripts/tests/repository-scope-from-within.test.ts::a_repository-scoped_entry's_from-within_declarations::are_the_declarer's_when_the_repository_root_declares_no_instance
  Scenario: The declarer owns them when the root declares no layer
    Given a repository root that declares no layer
    When inst's directories are resolved
    Then "defs" is declared by "inst" at "beans/defs/"

  @test:scripts/tests/repository-scope-from-within.test.ts::a_repository-scoped_entry's_from-within_declarations::are_NOT_followed_when_the_repository_root_is_another,_declared_instance
  Scenario: They are not followed when the root is another declared layer
    Given a repository root that declares layer "top"
    When inst's directories are resolved
    Then "defs" is not declared by "inst"
