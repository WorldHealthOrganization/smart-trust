Feature: bootstrap defines its own terms, and nothing in it points above it

  Background:
    Given bootstrap checked out beside the tools, with its README, its generated schemas and its declaration bootstrap.json

  @test:schemas/graph.test.ts::bootstrap's_terms_are_its_own::noDefinitionNamesAbove
  Scenario: no definition names anything above bootstrap
    When every term definition in BOOTSTRAP_TERMS is matched against the names of things above bootstrap
    Then no definition matches any of them

  @test:schemas/graph.test.ts::bootstrap's_terms_are_its_own::schemaCarriesEveryTerm
  Scenario: the generated schema carries every term as a definition
    Given bootstrap/schemas/graph.schema.json
    Then its $defs hold exactly the keys of BOOTSTRAP_TERMS
    And each $defs entry's description is that term's definition

  @test:schemas/graph.test.ts::the_terms_are_ordered:_each_definition_uses_only_terms_above_it::termUsesNoLaterTerm[${key}]
  Scenario: each term uses no later term and not itself
    Given each term in its declared order, one test per term
    When the terms its definition's text uses are found, longest name first, singular or plural, as whole words
    Then none of them is the term itself or a term declared after it

  @test:schemas/graph.test.ts::the_terms_are_ordered:_each_definition_uses_only_terms_above_it::authoredUsesKeepOrder
  Scenario: the authored uses lists keep the declared order (checkDeclaredOrder)
    Given each term with its authored uses list from BOOTSTRAP_TERM_USES, in declared order
    When checkDeclaredOrder runs over them
    Then it reports no problems

  @test:schemas/graph.test.ts::the_terms_are_ordered:_each_definition_uses_only_terms_above_it::usesListMatchesDefinitionText
  Scenario: each authored uses list names exactly the terms its definition's text uses
    When each term's authored uses list is compared with the terms its definition's text uses
    Then no term has a term in one set but not the other

  @test:schemas/graph.test.ts::the_terms_are_ordered:_each_definition_uses_only_terms_above_it::checkOrderNamesForwardSelfMissing
  Scenario: checkDeclaredOrder names a forward, a self and a missing use
    Given step "a" needing "b", and step "b" needing "b" and "z"
    When checkDeclaredOrder runs over them
    Then it reports "a" uses "b" as forward
    And "b" uses "b" as self
    And "b" uses "z" as missing

  @test:schemas/graph.test.ts::the_terms_are_ordered:_each_definition_uses_only_terms_above_it::everyTermNamesItsSchema
  Scenario: every term names the schema that defines it
    Then every term's BOOTSTRAP_TERM_DEFINED_BY entry starts with "#" or an http(s) address

  @test:schemas/graph.test.ts::bootstrap/README.md_is_self-definitional::readmeLinksStayInside
  Scenario: every link stays inside bootstrap/ — except the generated-by notice's, to bootstrap-tools
    Given the links in bootstrap/README.md
    When links to the tools repository or its scripts are set aside
    Then no remaining link starts with "../", "/" or a URL scheme

  @test:schemas/graph.test.ts::bootstrap/README.md_is_self-definitional::readmeRelativeLinksResolve
  Scenario: every relative link and image resolves to a file in bootstrap/
    Given the links in bootstrap/README.md that have no URL scheme and are not bare anchors
    Then each, without its anchor, names a file that exists in bootstrap/

  @test:schemas/graph.test.ts::bootstrap/README.md_is_self-definitional::readmeNamesNothingAbove
  Scenario: names nothing above bootstrap
    Then bootstrap/README.md matches none of the names of things above bootstrap

  @test:schemas/graph.test.ts::bootstrap/README.md_is_self-definitional::termLinkedOnceAtFirstUse
  Scenario: each defined term is linked to its definition once, at its first use
    Given the terms KnowledgeGraph, Subgraph, Harness, Actor, Role, Process and Skill
    Then bootstrap/README.md links each to its schemas/graph.schema.json definition exactly once

  @test:schemas/graph.test.ts::bootstrap/README.md_is_self-definitional::everyProseTermIsLink
  Scenario: every defined term in the prose is a link (owner, 2026-09-29)
    Given the hand-written prose of bootstrap/README.md, before its first generated region
    When it is searched for unlinked uses of the defined terms
    Then none is found

  @test:schemas/graph.test.ts::bootstrap/README.md_is_self-definitional::termLinksDrawingWithHeading
  Scenario: each term also links to its drawing, and the drawing's heading exists
    Given the headings and explicit anchors of bootstrap/schemas/README.md
    Then bootstrap/README.md has at least 7 links into schemas/README.md
    And each of those links lands on an existing heading or anchor
    And every term has an anchor on that page

  @test:schemas/graph.test.ts::FR-7:_bootstrap_holds_no_program_code::noProgramFileInBootstrap
  Scenario: no file in bootstrap/ is a program
    When every file under bootstrap/ is listed
    Then none is a JavaScript, TypeScript, Python or shell file

  @test:schemas/graph.test.ts::nothing_in_bootstrap/_names_anything_above_it_(bean_iwtn)::onlyListedStructuralNames
  Scenario: only the listed structural names remain
    Given every file under bootstrap/ except .git and the root index.config.json
    And the allowed mentions removed: the tools repository address, a README notice's bootstrap-tools link text, and a workflow's uses: address
    When each line is matched against the names above bootstrap, including bootstrap-tools
    Then the lines found are exactly the pending list, which is empty

  @test:schemas/graph.test.ts::bootstrap's_graph_typologies_are_its_own_(bean_r3gy,_D1)::everyUsedKindDefined
  Scenario: every kind bootstrap's declaration uses is defined in bootstrap
    Then every graph typology named by a directory in bootstrap.json is one of BOOTSTRAP_GRAPH_TYPOLOGIES

  @test:schemas/graph.test.ts::bootstrap's_graph_typologies_are_its_own_(bean_r3gy,_D1)::everyDefinedKindUsed
  Scenario: every kind bootstrap defines, it uses — no definition for a kind it does not hold
    Then every graph typology in BOOTSTRAP_GRAPH_TYPOLOGIES is named by some directory in bootstrap.json

  @test:schemas/graph.test.ts::every_$schema_a_bootstrap_file_carries_is_a_Node_Kind_its_declaration_lists_(r3gy_D2;_nodeSchemas,_2026-09-29)::schemaTagDeclaredInNodeSchemas
  Scenario: each file's $schema is declared in bootstrap.json's nodeSchemas
    When every JSON file under bootstrap/ (except .git and the root index.config.json) is read
    Then every string $schema it carries is a key of bootstrap.json's nodeSchemas

  @test:schemas/graph.test.ts::every_$schema_a_bootstrap_file_carries_is_a_Node_Kind_its_declaration_lists_(r3gy_D2;_nodeSchemas,_2026-09-29)::localNodeSchemaFixesTag
  Scenario: a local Node Schema exists inside bootstrap and fixes that very tag
    Given each nodeSchemas entry whose location is not an absolute URL
    Then its location is a file inside bootstrap/
    And that schema's $schema property is fixed to the entry's own tag

  @test:schemas/graph.test.ts::every_$schema_a_bootstrap_file_carries_is_a_Node_Kind_its_declaration_lists_(r3gy_D2;_nodeSchemas,_2026-09-29)::registryTagOwnLedgerTagGone
  Scenario: the tag that used to name the platform is bootstrap's own; the ledger's left with the ledger
    Then nodeSchemas maps "model-registry/1.0.0" to "schemas/model-registry.schema.json"
    And nodeSchemas has no "glossary-ledger/1.0.0"

  @test:schemas/graph.test.ts::every_$schema_a_bootstrap_file_carries_is_a_Node_Kind_its_declaration_lists_(r3gy_D2;_nodeSchemas,_2026-09-29)::declarationShapeKnowsNodeSchemas
  Scenario: the declaration shape knows the field
    Then bootstrap.json parses under KnowledgeGraphDeclarationSchema

  @test:schemas/graph.test.ts::the_terms'_subject_area_(owner,_2026-11-07:_"do_it_in_the_schema")::is_a_lowercase_local_id,_so_a_layer_can_compare_it
  Scenario: the terms' subject area is a lowercase local id
    Then BOOTSTRAP_TERMS_SUBJECT starts with a lowercase letter or digit
    And holds only lowercase letters, digits, ".", "_" and "-"

  @test:schemas/graph.test.ts::the_terms'_subject_area_(owner,_2026-11-07:_"do_it_in_the_schema")::is_published_beside_the_terms_in_graph.schema.json_when_bootstrap_is_checked_out_beside_these_tools
  Scenario: the terms' subject area is published in graph.schema.json
    Given bootstrap checked out beside the tools, with its schemas/graph.schema.json
    Then that file's "subject" is BOOTSTRAP_TERMS_SUBJECT
    And when bootstrap is not checked out beside the tools, the test asserts nothing
