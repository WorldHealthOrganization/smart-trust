# layerRootNamed in schemas/kg/instance-roots.ts finds the root of a named instance by its declaration,
# in both the monorepo and the standalone layout (bean uxn1). Each Scenario names the test that executes it.
Feature: Finding an instance root by name

  @test:schemas/instance-root-named.test.ts::layerRootNamed::monorepo:_the_instance_one_level_down_that_declares_the_name
  Scenario: In a monorepo, the instance is the subdirectory that declares the name
    Given a repository declaring "folio-assistant" with subdirectories declaring "cat-harness" and "folio-assistant-core"
    When layerRootNamed looks for "cat-harness"
    Then it returns the "cat-harness" subdirectory

  @test:schemas/instance-root-named.test.ts::layerRootNamed::standalone:_the_repository_root_itself,_when_it_declares_the_name
  Scenario: Standalone, the repository root is the instance when it declares the name
    Given a repository root that declares "cat-harness"
    When layerRootNamed looks for "cat-harness"
    Then it returns the repository root itself

  @test:schemas/instance-root-named.test.ts::layerRootNamed::a_directory_merely_NAMED_like_the_instance_is_not_it_—_the_declaration_decides
  Scenario: A directory merely named like the instance is not it
    Given a repository declaring "folio-assistant" with an undeclared "cat-harness" directory
    When layerRootNamed looks for "cat-harness"
    Then it returns undefined

  @test:schemas/instance-root-named.test.ts::layerRootNamed::absent_is_undefined,_never_a_guessed_path
  Scenario: An absent instance is undefined, never a guessed path
    Given a repository declaring only "folio-assistant"
    When layerRootNamed looks for "cat-harness"
    Then it returns undefined
