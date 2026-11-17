# How block kinds are partitioned by content adapter (schemas/content/block-kinds.ts)
# and how QA criteria are scoped to adapters (schemas/sdlc/block-qa.ts), checked
# against the adapters this checkout's dependencies contribute. Each Scenario names the test that executes it.
Feature: Block kinds and QA criteria are scoped by content adapter

  @test:scripts/tests/adapter-scoping.test.ts::adapter_partition::ALL_BLOCK_KINDS_is_the_built-in_kinds,_with_no_duplicates
  Scenario: All block kinds are the built-in kinds with no duplicates
    Then the list of all block kinds equals the built-in block kinds
    And it has no duplicates

  @test:scripts/tests/adapter-scoping.test.ts::adapter_partition::every_adapter_has_a_kind_list_and_every_kind_maps_back
  Scenario: Every adapter has kinds and each of its kinds maps back to it
    When each content adapter's kind list is read
    Then it is non-empty
    And every kind in it maps back to that adapter

  @test:scripts/tests/adapter-scoping.test.ts::adapter_partition::an_unknown_kind_maps_to_undefined,_never_defaulted_to_paper
  Scenario: An unknown block kind maps to no adapter
    Then "value-sett" maps to no adapter
    And the empty string maps to no adapter

  @test:scripts/tests/adapter-scoping.test.ts::criterion_adapter_scope::absent_defaults_to_every_built-in_vocabulary,_not_to_all
  Scenario: A criterion with no adapter scope defaults to every built-in vocabulary
    When the adapters of a criterion with no adapters field are resolved
    Then they are every built-in content adapter

  @test:scripts/tests/adapter-scoping.test.ts::criterion_adapter_scope::an_explicit_scope_is_honoured
  Scenario: An explicit criterion adapter scope is honoured
    Then a criterion scoped to "dak" resolves to "dak"
    And a criterion scoped to every built-in adapter plus "dak" resolves to exactly that list

  @test:scripts/tests/adapter-scoping.test.ts::criterion_adapter_scope::every_criterion_resolves_to_a_non-empty_scope
  Scenario: Every registered QA criterion resolves to a non-empty adapter scope
    When each criterion in the QA criteria registry is resolved
    Then its adapter scope is non-empty

  @test:scripts/tests/adapter-scoping.test.ts::criterion_adapter_scope::without_the_registry,_a_contributed_adapter's_roles_are_not_guessed
  Scenario: Without the registry a contributed adapter's companions are all reported incompatible
    When the incompatible companions are computed for a "dak" criterion depending on "ts"
    Then "ts" is reported

  @test:scripts/tests/adapter-scoping.test.ts::criterion_adapter_scope::built-in_axes_never_admit_a_DAK_block,_and_DAK_axes_never_admit_a_built-in_one
  Scenario: Built-in criteria never admit a DAK block and DAK criteria never admit a built-in one
    Given the kinds the checkout's dependencies contribute under the "dak" adapter
    When each registered criterion's scope is resolved
    Then it admits a contributed DAK kind's owner exactly when it includes "dak"
    And a scope including "dak" admits no built-in kind's adapter

  @test:scripts/tests/adapter-scoping.test.ts::criterion_adapter_scope::every_DAK-scoped_criterion_says_so_explicitly
  Scenario: Every DAK-domain criterion is scoped to dak explicitly
    When each registered criterion in the "dak" domain is resolved
    Then its adapter scope is exactly "dak"

  @test:scripts/tests/adapter-scoping.test.ts::criterion_adapter_scope::the_dak_domain_is_actually_populated
  Scenario: The dak criterion domain is populated
    Then at least one registered QA criterion is in the "dak" domain

  @test:scripts/tests/adapter-scoping.test.ts::no-op_for_the_existing_paper_corpus::every_kind_the_corpus_can_contain_resolves_to_a_built-in_vocabulary
  Scenario: Every built-in block kind resolves to a built-in vocabulary
    When each built-in block kind's adapter is resolved
    Then it is one of the built-in content adapters

  @test:scripts/tests/adapter-scoping.test.ts::no-op_for_the_existing_paper_corpus::every_built-in-scoped_criterion_admits_every_built-in_kind
  Scenario: Every criterion scoped to a built-in vocabulary admits every built-in kind
    Given each registered criterion whose scope names any built-in adapter
    Then its scope includes the adapter of every built-in block kind
