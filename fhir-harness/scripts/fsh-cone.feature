Feature: The FSH and CQL dependency graph of an IG, its cones and change impact

  @test:scripts/fsh-cone.test.ts::graph_construction::everyDeclarationIsNode
  Scenario: every declaration and every CQL library is a node; the external include is not
    Given the graph built from a fixture IG
    Then its nodes are every FSH declaration and every CQL library
    And the external FHIRHelpers include is not a node
    And it read 15 FSH files and 4 CQL files and the canonical "http://example.org/tank"

  @test:scripts/fsh-cone.test.ts::graph_construction::edgeFormsPointUserToUsed
  Scenario: each edge form is recognised, and points from the user to the used
    Given the graph built from the fixture IG
    Then Parent, from, obeys, include codes from system, InstanceOf, alias codes, canonical assignment, insert, Canonical() and Reference() each give an edge from the user to the used
    And a Library reaches its CQL by name, and a CQL include reaches the included library
    And a parameterised canonical expanded through two RuleSets reaches "LibXLogic" from its call site, and the RuleSets gain no such edge
    And a Library relying on the name-to-id default reaches its CQL

  @test:scripts/fsh-cone.test.ts::cones::codeSystemForwardCone
  Scenario: forward cone of the code system reaches everything bound through it, transitively
    Then the forward cone of "LocalCS" is everything bound through it, transitively

  @test:scripts/fsh-cone.test.ts::cones::sharedCqlHubCone
  Scenario: a shared CQL library is the hub: its cone crosses from CQL into FHIR artefacts
    Then the forward cone of "cql:Common" crosses from CQL into the FHIR artefacts

  @test:scripts/fsh-cone.test.ts::cones::ruleSetInvalidatesUsers
  Scenario: a RuleSet change invalidates its users (SUSHI expands it at compile time)
    Then the forward cone of the RuleSet "CommonMeta" is its users, including the expanded-parameter user

  @test:scripts/fsh-cone.test.ts::cones::leafEmptyRootExcluded
  Scenario: leaves have empty forward cones and the root is excluded from its own cone
    Then a leaf has an empty forward cone
    And a node is not in its own forward cone

  @test:scripts/fsh-cone.test.ts::cones::backwardConeInFiles
  Scenario: backward cone is the restricted checkout, measured in files
    Then the backward cone of "ExPerson" is its six dependencies
    And their files are the six source files, and the backward file count of "ExPerson" is 6

  @test:scripts/fsh-cone.test.ts::cones::coneSizesAgree
  Scenario: the cone sizes table agrees with the individual cones
    Then the cone sizes table gives 6 forward for LocalCS, 6 backward for ExPerson, 0 forward for PlanX and 0 backward for cql:Common

  @test:scripts/fsh-cone.test.ts::change_impact_—_the_incremental-build_question::editingValueSetImpact
  Scenario: editing the value set names what to rebuild and what to check out
    When the value set file is changed
    Then "GenderVS" is changed
    And the nodes to rebuild are GenderVS and everything that uses it
    And the checkout is the rebuilt nodes' files and their dependencies' files

  @test:scripts/fsh-cone.test.ts::change_impact_—_the_incremental-build_question::editingLeafRebuildsItself
  Scenario: editing a leaf rebuilds only itself
    When the leaf's file is changed, given by an absolute path
    Then only "PlanX" is rebuilt

  @test:scripts/fsh-cone.test.ts::change_impact_—_the_incremental-build_question::declaringNothingChangesNothing
  Scenario: a file that declares nothing changes nothing
    When the aliases file is changed
    Then nothing is changed and nothing is rebuilt

  @test:scripts/fsh-cone.test.ts::reports::reportHeadlinesAndCsv
  Scenario: the text report carries the headline figures and the CSV has one row per node
    When the text report is written
    Then it says 20 nodes in 18 source files, 15 .fsh and 4 .cql
    And it tallies the expanded-parameter insert, 3 Library to CQL matches, cql include and canonical assignment, and a forward cone table headed by LocalCS
    And the CSV has its header and one row per node

  @test:scripts/fsh-cone.test.ts::reports::historyScoresCommits
  Scenario: replaying the git history scores each commit by its rebuild cone
    Given the fixture as a git repository with a commit editing the value set and the RuleSet and a commit touching no source file
    When the history is replayed
    Then one commit is scored, with 2 source files, 2 changed nodes and 10 to rebuild
    And the history report says 1 of 3 commits touched the sources, a median rebuild of 10, and lists zero-rebuild commits

  @test:scripts/fsh-cone.test.ts::reports::emptyTankDeterminedEmpty
  Scenario: an empty tank is a determined empty, not a crash
    Given an empty directory
    When its graph is built
    Then it has no nodes and the report says "nodes: 0"

  @test:scripts/fsh-cone.test.ts::file-level_users,_for_the_IG_AST's_incremental_plan_(bean_a9tx)::ruleSetFileNamesUsers
  Scenario: a RuleSet-only file names every file that inserts from it, and not itself
    Then the RuleSet file's users are the three files that insert from it
    And a RuleSet file inserting into itself is not its own user, and its user is the PlanY file

  @test:scripts/fsh-cone.test.ts::file-level_users,_for_the_IG_AST's_incremental_plan_(bean_a9tx)::unusedFileHasNoEntry
  Scenario: a file nothing depends on has no entry, rather than an empty one
    Then a file nothing depends on has no entry
    And a file referenced by another names that file as its user

  @test:scripts/fsh-cone.test.ts::file-level_users,_for_the_IG_AST's_incremental_plan_(bean_a9tx)::aliasFileNamesUsers
  Scenario: an Alias-only file names the files that use its aliases, including code uses that make no edge
    Then the aliases file's users are the two files using its aliases, including a code use

  @test:scripts/fsh-cone.test.ts::Title_and_Description_are_prose,_not_rules_(bean_c65n)::proseIsNotARule
  Scenario: the schedule's forward cone does not reach a value set that only names it in prose
    Given a schedule and value sets that name it only in their Title or Description
    Then the schedule's forward cone is empty
    And a value set's only dependency is a value set it includes by rule, and a one-line value set has none
