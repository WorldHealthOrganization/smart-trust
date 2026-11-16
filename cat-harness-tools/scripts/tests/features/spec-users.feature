# A user declares the specification it depends on, in four forms; a
# declaration naming no record is a finding. Each Scenario names the test that
# executes it.
Feature: Specification users

  @test:scripts/tests/spec-users.test.ts::reading_one_declaration::a_@conformsTo_tag_in_a_doc_comment_is_read;_the_same_words_in_code_are_not
  Scenario: A @conformsTo tag in a doc comment is read
    Given a doc comment with two @conformsTo tags and a string in code containing one
    Then the specifications read are w3c-skos and w3c-rdfs

  @test:scripts/tests/spec-users.test.ts::reading_one_declaration::a_placeholder_in_prose_is_not_a_declaration
  Scenario: A placeholder in prose is not a declaration
    Then "@conformsTo <spec-id>" in backticks reads as nothing

  @test:scripts/tests/spec-users.test.ts::reading_one_declaration::front_matter:_a_list,_or_a_single_value
  Scenario: Front matter declares a list or a single value
    Then a conformsTo list reads dcmi-terms and w3c-skos
    And a single value reads dcmi-terms
    And the key outside front matter reads nothing

  @test:scripts/tests/spec-users.test.ts::reading_one_declaration::xmlns_bindings,_prefixed_and_default
  Scenario: xmlns bindings are read, prefixed and default
    Then an element binding a default and a prefixed namespace yields both, and not an attribute value

  @test:scripts/tests/spec-users.test.ts::reading_one_declaration::a_registry_ref_names_its_module,_with_or_without_an_instance_prefix
  Scenario: A registry ref names its module
    Then "folio-assistant-core:schemas/dublin-core.ts#X" names folio-assistant-core/schemas/dublin-core.ts
    And an unprefixed ref names the module in the given instance

  @test:scripts/tests/spec-users.test.ts::specUsers_over_a_repository::each_direct_form_is_read,_and_a_kind_inherits_its_typing_module's_declaration
  Scenario: Each form is read and kinds inherit their typing module's declaration
    Given a repository with a tagged schema module, a skill with front matter, a BPMN diagram and a script naming an unknown spec
    And kinds typed by that schema module
    When the specification users are read
    Then the uses are the skill's front matter, the folio-x/v1 nodes, the glossary graph, the module's tag and the diagram's BPMN namespace

  @test:scripts/tests/spec-users.test.ts::specUsers_over_a_repository::a_declaration_naming_no_record_is_reported,_never_silently_dropped
  Scenario: A declaration naming no record is reported
    When the specification users are read
    Then the unknown declarations are the script's "no-such-spec"
