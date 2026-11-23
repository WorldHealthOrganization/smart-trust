# Specifies schemas/kg/built-at-publish.ts: the builtAtPublish entry and list
# schemas, isBuiltAtPublish, and the two facts about this instance that must
# agree with its declaration (.gitignore and git's tracked files).
Feature: A built-at-publish path is declared once, ignored by git, and never tracked

  @test:schemas/kg/built-at-publish.test.ts::the_shape::a_checkout_entry_is_valid
  Scenario: A checkout entry parses
    Given an entry for "docs/x/" written by "x:gen", because "checkout", with a reason
    When it is parsed with the built-at-publish schema
    Then it parses

  @test:schemas/kg/built-at-publish.test.ts::the_shape::a_state_entry_must_name_its_branch-kept_graph
  Scenario: A state entry must name the graph it is built from
    Given the entry with because "state" and no from
    When it is parsed
    Then it is refused
    And the same entry with from "beans" parses

  @test:schemas/kg/built-at-publish.test.ts::the_shape::a_checkout_entry_names_no_branch
  Scenario: A checkout entry names no graph to build from
    Given a checkout entry with from "beans"
    When it is parsed
    Then it is refused

  @test:schemas/kg/built-at-publish.test.ts::the_shape::a_glob,_an_absolute_path_and_a_.._are_refused
  Scenario: A path must be a plain relative path
    Given entries whose paths are "docs/*.json", "/docs/x/" and "docs/../x"
    When each is parsed
    Then each is refused

  @test:schemas/kg/built-at-publish.test.ts::the_shape::a_writer_is_a_script_name,_not_a_path
  Scenario: A writer is a script name, not a file path
    Given an entry whose writer is "scripts/gen.ts"
    When it is parsed
    Then it is refused

  @test:schemas/kg/built-at-publish.test.ts::the_shape::one_route,_one_declared_writer:_a_path_twice,_or_one_inside_another,_is_refused
  Scenario: No path is declared twice or inside another declared path
    Given a list declaring "docs/x/" twice, and a list declaring "docs/x/" and "docs/x/y.json"
    When each list is parsed with the built-at-publish list schema
    Then both are refused
    And a list declaring "docs/x/" and "docs/y/" parses

  @test:schemas/kg/built-at-publish.test.ts::the_shape::`reads`_names_graph_typologies,_each_once_—_never_an_instance_path_(A1)
  Scenario: reads names graph typologies, each once
    Given entries whose reads are ["docs"], [], ["docs", "docs"] and ["smart-trust/docs/"]
    When each is parsed
    Then only the entry reading ["docs"] parses

  @test:schemas/kg/built-at-publish.test.ts::the_shape::isBuiltAtPublish_matches_a_declared_file,_and_anything_under_a_declared_directory
  Scenario: isBuiltAtPublish matches a declared file and anything under a declared directory
    Given a list declaring the directory "docs/x/" and the file "docs/a.json"
    When isBuiltAtPublish is asked about paths
    Then "docs/x/deep/p.html" and "docs/a.json" match
    And "docs/a.json.bak" and "docs/xy/p.html" do not

  @test:schemas/kg/built-at-publish.test.ts::this_instance's_declaration::.gitignore's_built-at-publish_block_is_exactly_the_declared_paths
  Scenario: The .gitignore block lists exactly the declared paths
    Given this instance's cat-harness.json builtAtPublish declaration and its .gitignore
    When the "# BEGIN built at publish" to "# END built at publish" block is read
    Then with nothing declared there is no block
    And otherwise its non-comment lines equal the ignore line of each declared entry

  @test:schemas/kg/built-at-publish.test.ts::this_instance's_declaration::nothing_declared_is_tracked_(asked_of_git_only_where_this_instance_IS_the_repository)
  Scenario: No declared path is tracked by git
    Given this instance's builtAtPublish declaration
    And this instance is the top level of a git repository and declares at least one path
    When git ls-files is asked for the declared paths
    Then it succeeds and lists no file

  @test:schemas/kg/built-at-publish.test.ts::the_shape::a_lower_entry_(computed_from_a_layer_below,_or_from_the_tools)_is_valid_and_names_no_branch_(owner,_2026-11-13)
  Scenario: A lower entry parses, and one naming a branch is refused
    Given an entry for "docs/x/" because "lower"
    When it is checked against the entry schema
    Then it passes
    And the same entry with "from" naming "beans" fails

  @test:schemas/kg/built-at-publish.test.ts::the_shape::an_unknown_cause_is_refused
  Scenario: An entry with an unknown cause is refused
    Given an entry for "docs/x/" because "pinned"
    When it is checked against the entry schema
    Then it fails
