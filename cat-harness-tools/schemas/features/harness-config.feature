# schemas/kg/harness-config.ts: the instance config schema, cross-instance dependency
# resolution in overlay order, and the declared directories a dependent instance
# materialises in its own root. Each Scenario names the test that executes it.
Feature: Harness config and cross-instance dependencies

  @test:schemas/harness-config.test.ts::FolioAssistantDependencySchema::validates_a_dependency_with_path
  Scenario: A dependency with a path is valid
    Given a dependency "test-dep" with path "./deps/test"
    When it is parsed with the dependency schema
    Then parsing succeeds

  @test:schemas/harness-config.test.ts::FolioAssistantDependencySchema::validates_a_dependency_with_git
  Scenario: A dependency with a git URL is valid
    Given a dependency "test-dep" with git "https://github.com/test/repo.git"
    When it is parsed with the dependency schema
    Then parsing succeeds

  @test:schemas/harness-config.test.ts::FolioAssistantDependencySchema::rejects_a_dependency_with_neither_path_nor_git
  Scenario: A dependency with neither path nor git is refused
    Given a dependency "test-dep" with no path and no git
    When it is parsed with the dependency schema
    Then parsing fails

  @test:schemas/harness-config.test.ts::FolioAssistantDependencySchema::validates_provides_array
  Scenario: A dependency may list what it provides
    Given a dependency with path "./test" providing "skills" and "translations"
    When it is parsed with the dependency schema
    Then parsing succeeds

  @test:schemas/harness-config.test.ts::HarnessConfigSchema::parses_minimal_config
  Scenario: An empty harness config is valid
    Given an empty config object
    When it is parsed with the harness config schema
    Then parsing succeeds

  @test:schemas/harness-config.test.ts::HarnessConfigSchema::parses_full_config
  Scenario: A full harness config is valid
    Given a config with contentType and adapter "document", locales "en" and "fr", and dependency "dep-a" at "./dep-a"
    When it is parsed with the harness config schema
    Then parsing succeeds

  @test:schemas/harness-config.test.ts::readHarnessConfig::reads_a_valid_config
  Scenario: readHarnessConfig reads an instance's config
    Given a root instance whose config has contentType "document"
    When its config is read
    Then a config is returned with contentType "document"

  @test:schemas/harness-config.test.ts::readHarnessConfig::returns_null_for_missing_directory
  Scenario: readHarnessConfig returns null for a missing directory
    When the config of "/nonexistent/path" is read
    Then the result is null

  @test:schemas/harness-config.test.ts::resolveDependencyPath::resolves_an_absolute_path
  Scenario: A dependency's absolute path resolves to itself
    Given dependency "dep-a" with the absolute path of an existing directory
    When its path is resolved from the root
    Then it is that same path

  @test:schemas/harness-config.test.ts::resolveDependencyPath::returns_null_for_nonexistent_path
  Scenario: A dependency path that does not exist resolves to null
    Given dependency "ghost" with path "/nonexistent/path"
    When its path is resolved from the root
    Then the result is null

  @test:schemas/harness-config.test.ts::resolveInstanceGraph::resolves_direct_and_transitive_dependencies,_deepest_first
  Scenario: The instance graph lists transitive dependencies before direct ones
    Given a root that needs "dep-a", which needs "dep-b"
    When the instance graph is resolved
    Then there are no problems
    And the order is "dep-b" then "dep-a", without the root
    And "dep-a" needs the dep-b directory

  @test:schemas/harness-config.test.ts::resolveInstanceGraph::reports_a_cycle,_names_every_instance_in_it,_and_orderedDependencies_throws
  Scenario: A dependency cycle is reported with every instance in it
    Given "dep-b" is changed to depend on the root, closing a cycle through "dep-a"
    When the instance graph is resolved
    Then the order is empty
    And a "cycle" problem names three instance roots
    And orderedDependencies throws "dependency cycle"

  @test:schemas/harness-config.test.ts::multiple_inheritance_of_instances_(bean_a1lq)::a_diamond_resolves_ONCE,_below_both_branches_—_not_dropped_as_a_cycle
  Scenario: A diamond dependency resolves once, below both branches
    Given "root" needs "a" and "c", and both need "d"
    When the instance graph of "root" is resolved
    Then there are no problems
    And the order is "d", "a", "c"

  @test:schemas/harness-config.test.ts::multiple_inheritance_of_instances_(bean_a1lq)::a_missing_dependency_is_REPORTED;_the_overlay_warns_and_continues_without_it
  Scenario: A missing dependency is reported and the overlay continues without it
    Given "partial" needs "d" and "ghost", and "ghost" is not in the checkout
    When the instance graph of "partial" is resolved
    Then there is one problem, of kind "missing" naming "ghost"
    And orderedDependencies yields only "d"
    And a warning naming "ghost" is printed

  @test:schemas/harness-config.test.ts::multiple_inheritance_of_instances_(bean_a1lq)::skill_directories_list_the_shared_layer_once
  Scenario: Skill directories list a shared dependency once
    Given the diamond where "root" reaches "d" through both "a" and "c"
    When the skill directories of "root" are resolved
    Then d's skills directory appears exactly once
    And root's own skills directory is last

  @test:schemas/harness-config.test.ts::resolveSkillDirs::returns_directories_in_overlay_order
  Scenario: Skill directories end with the root's own
    Given the root instance with dependencies "dep-a" and "dep-b"
    When its skill directories are resolved
    Then there are at least two
    And the last is the root's skills directory

  @test:schemas/harness-config.test.ts::resolveTranslationDirs::returns_translation_directories
  Scenario: Translation directories end with the root's own
    Given the root instance with dependencies "dep-a" and "dep-b"
    When its translation directories are resolved
    Then there is at least one
    And the last is the root's translations directory

  @test:schemas/harness-config.test.ts::a_dependent_instance_inherits_the_ingestion_directories::materialises_the_ingestion_directories_it_passes_down_in_the_DEPENDENT's_own_root
  Scenario: A dependent of cat-harness materialises the ingestion directories in its own root
    Given a downstream instance that depends on the harness root
    When its declared directories are materialised as a dry run
    Then each ingestion directory cat-harness passes down ("uploads", and "library" before the library sub-graph exists) is present
    And each lies under the downstream root
    And each is declared by "cat-harness"

  @test:schemas/harness-config.test.ts::a_dependent_instance_inherits_the_ingestion_directories::they_are_inherited,_not_defaults_—_the_declaring_instance_is_named
  Scenario: The inherited ingestion directories are not defaults
    Given a downstream instance that depends on the harness root
    When its declared directories are materialised as a dry run
    Then no ingestion directory cat-harness passes down is declared by "(default)"

  @test:schemas/harness-config.test.ts::a_dependent_instance_inherits_the_ingestion_directories::uploads/_and_library/_are_DISTINCT_declarations,_not_one_directory_twice
  Scenario: uploads/ and library/ inherited from cat-harness are distinct directories
    # Skipped: when the harness holds library/graph.json, the library sub-graph
    Given a downstream instance that depends on the harness root
    When its declared directories are materialised as a dry run
    Then "uploads" and "library" have different absolute paths
    And different relative paths

  @test:schemas/harness-config.test.ts::a_dependent_instance_inherits_the_ingestion_directories::the_work_plan_is_NOT_inherited,_which_is_the_contrast_that_makes_this_mean_something
  Scenario: A dependent of cat-harness does not inherit the work plan
    Given a downstream instance that depends on the harness root
    When its declared directories are materialised as a dry run
    Then their ids include neither "beans" nor "todos"

  @test:schemas/harness-config.test.ts::a_dependent_instance_materialises_its_own_docs/::materialises_docs/_in_the_DEPENDENT's_own_root,_attributed_to_cat-harness
  Scenario: A dependent of cat-harness materialises docs/ in its own root
    Given a downstream instance that depends on the harness root
    When its declared directories are materialised as a dry run
    Then a "docs" directory is present
    And it lies under the downstream root
    And it is declared by "cat-harness"

  @test:schemas/harness-config.test.ts::a_dependent_instance_materialises_its_own_docs/::...and_NOT_the_platform's_own_directories,_which_is_the_contrast
  Scenario: A dependent of cat-harness does not materialise the platform's schemas or tools
    Given a downstream instance that depends on the harness root
    When its declared directories are materialised as a dry run
    Then their ids include "docs"
    And include neither "schemas" nor "tools"

  @test:schemas/harness-config.test.ts::a_dependent_instance_materialises_its_own_docs/::the_work_plan_is_still_NOT_inherited_—_repository-scoped,_and_unaffected
  Scenario: The work plan stays uninherited alongside docs/
    Given a downstream instance that depends on the harness root
    When its declared directories are materialised as a dry run
    Then their ids include neither "beans" nor "todos"

  @test:schemas/harness-config.test.ts::a_dependent_of_the_content_core_inherits_library/::materialises_library/_in_the_DEPENDENT's_own_root,_declared_by_core_and_not_a_default
  Scenario: A dependent of the content core materialises library/ in its own root
    # Skipped: when the harness has no library sub-graph or no folio-assistant-core checkout is found
    Given a downstream instance that depends on folio-assistant-core
    When its declared directories are materialised as a dry run
    Then a "library" directory is present
    And it lies under the downstream root
    And it is declared by "folio-assistant-core"

  @test:schemas/harness-config.test.ts::a_dependent_of_the_content_core_inherits_library/::uploads/_and_library/_are_DISTINCT_declarations,_not_one_directory_twice
  Scenario: uploads/ and library/ inherited through the content core are distinct directories
    # Skipped: when the harness has no library sub-graph or no folio-assistant-core checkout is found
    Given a downstream instance that depends on folio-assistant-core
    When its declared directories are materialised as a dry run
    Then "uploads" and "library" have different absolute paths
    And different relative paths
