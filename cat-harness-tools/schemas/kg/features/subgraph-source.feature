# Specifies schemas/kg/subgraph-source.ts (bean l4ay): the subgraph source
# union, resolveSubgraphSource and its precedence, contentIsOffCheckout,
# contentSourceJsonLd and forgeTreeUrl, with the branch, family (bean lehh),
# remote, npm and hydrated (bean mo75 G2) members.
Feature: A declared subgraph's content source is one union, resolved by one resolver

  @test:schemas/kg/subgraph-source.test.ts::the_union::absent_is_the_directory_default
  Scenario: With no source, a subgraph is its directory
    Given the directory entry todos at "todos/" with no source
    When its source is resolved
    Then it is a directory source for todos at "todos/", declared in "default"

  @test:schemas/kg/subgraph-source.test.ts::the_union::a_kind_the_union_does_not_know_is_refused,_not_read_as_a_directory
  Scenario: An unknown source kind is refused
    Given a source of kind "graph-db"
    When it is parsed with the source schema
    Then it is refused

  @test:schemas/kg/subgraph-source.test.ts::the_union::a_branch_source_refuses_a_refs/_path_and_a_`..`
  Scenario: A branch source refuses a refs/ path and a ..
    Given branch sources naming "refs/heads/x" and "a/../b"
    When each is parsed
    Then each is refused

  @test:schemas/kg/subgraph-source.test.ts::the_union::the_declaration_schema_carries_`source`
  Scenario: The content directory schema carries source
    Given the todos entry with a tip-keyed branch source on "cat/cat-harness/todos"
    When it is parsed with the content directory schema
    Then its source is kept

  @test:schemas/kg/subgraph-source.test.ts::the_union::the_instance_config_carries_`subgraphSources`
  Scenario: The instance config carries subgraphSources
    Given a harness config mapping todos to the branch source
    When it is parsed
    Then its subgraphSources are kept

  @test:schemas/kg/subgraph-source.test.ts::precedence_—_config,_then_source,_then_legacy_storage,_then_directory::the_declaration's_source
  Scenario: The declaration's source is used
    Given the todos entry with the branch source
    When its source is resolved
    Then it is the tip-keyed branch, declared in "declaration"

  @test:schemas/kg/subgraph-source.test.ts::precedence_—_config,_then_source,_then_legacy_storage,_then_directory::#1764's_storage_maps_to_a_branch_source,_and_says_so
  Scenario: A legacy storage maps to a branch source
    Given the todos entry with storage on the branch, keyed by tip
    When its source is resolved
    Then it is the tip-keyed branch, declared in "storage"

  @test:schemas/kg/subgraph-source.test.ts::precedence_—_config,_then_source,_then_legacy_storage,_then_directory::the_config_overrides_the_declaration,_matched_on_id
  Scenario: The instance config overrides the declaration by id
    Given the todos entry with the branch source, and a config making todos a directory
    When its source is resolved
    Then it is a directory source for todos, declared in "config"

  @test:schemas/kg/subgraph-source.test.ts::precedence_—_config,_then_source,_then_legacy_storage,_then_directory::an_override_for_a_different_id_does_not_apply
  Scenario: A config override for another id does not apply
    Given the todos entry and a config overriding beans
    When its source is resolved
    Then it is declared in "default"

  @test:schemas/kg/subgraph-source.test.ts::precedence_—_config,_then_source,_then_legacy_storage,_then_directory::both_`source`_and_`storage`_is_refused_—_two_answers_to_one_question
  Scenario: Both source and storage is refused
    Given the todos entry with both a source and a storage
    When its source is resolved
    Then it throws an error mentioning "both"

  @test:schemas/kg/subgraph-source.test.ts::precedence_—_config,_then_source,_then_legacy_storage,_then_directory::a_qa_subgraph_keyed_by_tip_is_refused_(#1937's_rule,_whichever_field_says_it)
  Scenario: A qa subgraph keyed by tip is refused, whichever field says it
    Given a qa entry whose source is a tip-keyed branch "cat/cat-harness/qa-reports"
    When its source is resolved
    Then it throws an error saying the `qa` subgraph is keyed by commit
    And a qa entry whose legacy storage is the same branch keyed by tip throws the same error

  @test:schemas/kg/subgraph-source.test.ts::the_presence_checks_ask_one_question_of_either_spelling::a_branch_source,_or_a_legacy_storage,_is_off_the_checkout;_a_directory_source_or_none_is_not
  Scenario: Branch sources and storages are off the checkout; directories are not
    Then a branch source is off the checkout
    And a commit-keyed storage is off the checkout
    And a directory source, or no source, is not

  @test:schemas/kg/subgraph-source.test.ts::the_JSON-LD_form::a_branch_on_GitHub_dereferences_to_its_tree;_a_directory_is_a_blank_node
  Scenario: A branch source's JSON-LD is its GitHub tree; a directory's has no @id
    Given the resolved branch source and the repository litlfred/folio-assistant
    When its JSON-LD is written
    Then its @id is the repository's tree URL for the branch, with kind, branch, keyedBy and declaredIn
    And the default directory source's JSON-LD is { kind: directory, declaredIn: default }

  @test:schemas/kg/subgraph-source.test.ts::the_JSON-LD_form::an_unknown_forge_gets_no_@id_rather_than_a_guessed_one
  Scenario: An unknown forge gets no tree URL
    When a tree URL is asked for "https://example.org/a/b", or for no repository
    Then none is returned

  @test:schemas/kg/subgraph-source.test.ts::a_branch_FAMILY_(bean_lehh)::the_storage_spelling_resolves_to_kind_family,_never_to_one_branch
  Scenario: A family storage resolves to a family source
    Given the ig-ast entry with storage keyed by family under "cat/fhir-harness/fhir-ast/"
    When its source is resolved
    Then it is a family with that prefix and key, declared in "storage"

  @test:schemas/kg/subgraph-source.test.ts::a_branch_FAMILY_(bean_lehh)::the_source_spelling_resolves_the_same_way
  Scenario: A family source resolves to a family, as the storage spelling does
    Given the ig-ast entry with a family source with prefix "cat/fhir-harness/fhir-ast/" and keyFrom "the IG's package id"
    When its source is resolved
    Then it is a family with that prefix and that keyFrom, declared in "declaration"

  @test:schemas/kg/subgraph-source.test.ts::a_branch_FAMILY_(bean_lehh)::a_prefix_must_end_in_/,_and_a_family_keying_names_no_single_branch
  Scenario: A family prefix ends in /, and a family storage names no single branch
    Given a family source whose prefix is "cat/x/y"
    Then it is refused by the source schema
    And resolving a storage keyed by family that names a branch throws

  @test:schemas/kg/subgraph-source.test.ts::a_branch_FAMILY_(bean_lehh)::a_qa_subgraph_cannot_be_a_family
  Scenario: A qa subgraph cannot be a family
    Given a qa entry with a family source
    When its source is resolved
    Then it throws an error mentioning "qa"

  @test:schemas/kg/subgraph-source.test.ts::a_branch_FAMILY_(bean_lehh)::is_off_the_checkout,_and_its_JSON-LD_names_the_prefix_and_the_key
  Scenario: A family is off the checkout and its JSON-LD names prefix and key
    Then a family storage is off the checkout
    And a resolved family source's JSON-LD is { kind: family, branch: the prefix, keyFrom, declaredIn }

  @test:schemas/kg/subgraph-source.test.ts::a_branch_FAMILY's_repository_(owner:_read_remote,_or_materialise_locally)::absent_means_this_repository;_present_names_the_remote,_through_both_spellings_and_the_JSON-LD
  Scenario: A family's repository is absent locally and named when remote, in either spelling
    Given family storages with no repository and with repository "litlfred/smart-trust"
    When each is resolved
    Then the first has no repository
    And the second names litlfred/smart-trust
    And the second's JSON-LD has familyRepository litlfred/smart-trust
    And family sources with no repository and with repository "litlfred/smart-trust" resolve the same way
    And the remote source is declared in "declaration" and its JSON-LD has familyRepository litlfred/smart-trust

  @test:schemas/kg/subgraph-source.test.ts::a_branch_FAMILY's_repository_(owner:_read_remote,_or_materialise_locally)::a_repository_is_owner/repo,_not_a_URL
  Scenario: A family repository is owner/repo, not a URL
    Given a family source whose repository is "https://github.com/a/b"
    When it is parsed
    Then it is refused

  @test:schemas/kg/subgraph-source.test.ts::a_remote_source_tool_option_and_npm_package_source_(skills_npm-kg-distribution,_remote-mount)::remote_source_admits_tool_option_and_resolves_it
  Scenario: A remote source keeps its tool
    Given a remote source on litlfred/cat-harness at a pin with tool "remote-mount"
    When it is resolved
    Then it keeps the repository, ref and tool, declared in "declaration"

  @test:schemas/kg/subgraph-source.test.ts::a_remote_source_tool_option_and_npm_package_source_(skills_npm-kg-distribution,_remote-mount)::npm_source_validates_and_defaults_tool_to_npm
  Scenario: An npm source's tool defaults to npm
    Given an npm source for @litlfred/cat-harness 0.1.0 with no tool
    When it is parsed
    Then its tool is "npm"

  @test:schemas/kg/subgraph-source.test.ts::a_remote_source_tool_option_and_npm_package_source_(skills_npm-kg-distribution,_remote-mount)::npm_source_resolves_cleanly_and_is_off_checkout
  Scenario: An npm source resolves and is off the checkout
    Given the pkg-kg entry with an npm source using the tool "kg-retrieve-npm"
    When it is resolved
    Then it keeps id, path, package, version and tool, declared in "declaration"
    And it is off the checkout

  @test:schemas/kg/subgraph-source.test.ts::a_remote_source_tool_option_and_npm_package_source_(skills_npm-kg-distribution,_remote-mount)::npm_source_JSON-LD_links_to_npm_registry
  Scenario: An npm source's JSON-LD links to the npm registry
    Given the resolved npm source for @litlfred/cat-harness 0.1.0
    When its JSON-LD is written
    Then its @id is "https://www.npmjs.com/package/@litlfred/cat-harness/v/0.1.0"

  @test:schemas/kg/subgraph-source.test.ts::the_hydrated_member_(bean_`mo75`_G2)::resolves_with_the_mounting_Tool_defaulting_to_remote-mount,_and_is_off_checkout
  Scenario: A hydrated source resolves with tool remote-mount and is off the checkout
    Given the ch-tools entry with a hydrated source of cat-harness's tools subgraph at a pin
    When it is resolved
    Then it carries the repository, ref, harness and subgraph, tool "remote-mount", declared in "declaration"
    And it is off the checkout

  @test:schemas/kg/subgraph-source.test.ts::the_hydrated_member_(bean_`mo75`_G2)::an_instance_config_can_turn_a_directory_into_a_hydrated_mount,_matched_on_id
  Scenario: The config can make a directory a hydrated mount
    Given the ch-tools directory entry and a config mapping ch-tools to the hydrated source
    When it is resolved
    Then it is declared in "config"

  @test:schemas/kg/subgraph-source.test.ts::the_hydrated_member_(bean_`mo75`_G2)::a_pin,_never_a_branch;_never_the_root;_never_`..`
  Scenario: A hydrated source needs a pin and a non-root, non-climbing subgraph
    Then hydrated sources with ref "main", subgraph "" or subgraph "skills/../x" are refused
    And one with subgraph "skills/sdlc" parses

  @test:schemas/kg/subgraph-source.test.ts::the_hydrated_member_(bean_`mo75`_G2)::a_qa_subgraph_is_never_somebody_else's_metadata
  Scenario: A qa subgraph cannot be hydrated
    Given a qa entry with the hydrated source
    When it is resolved
    Then it throws an error mentioning "qa"

  @test:schemas/kg/subgraph-source.test.ts::the_hydrated_member_(bean_`mo75`_G2)::its_JSON-LD_names_the_tree_at_the_pin
  Scenario: A hydrated source's JSON-LD names the tree at the pin
    When the resolved hydrated source's JSON-LD is written
    Then it is the GitHub tree of litlfred/cat-harness at the pin, kind hydrated, declared in "declaration"
