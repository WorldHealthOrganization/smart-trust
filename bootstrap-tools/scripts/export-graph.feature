Feature: export-graph — bootstrap's graph from bootstrap's files, in standard terms

  Background:
    Given bootstrap checked out beside the tools
    And the graph exported from it at document IRI "https://example.org/site/bootstrap/bootstrap.jsonld"

  @test:scripts/export-graph.test.ts::bootstrap's_graph,_from_bootstrap's_files,_in_standard_terms::parsesAgainstSchema
  Scenario: parses against its schema, with and without provenance
    Then the export without provenance and the export with provenance both parse under GraphExportSchema with no issues

  @test:scripts/export-graph.test.ts::bootstrap's_graph,_from_bootstrap's_files,_in_standard_terms::buildIsPure
  Scenario: pure: two builds are byte-identical, and nothing absolute from this machine appears
    Then two builds serialise identically
    And the serialised export does not contain bootstrap's absolute path on this machine

  @test:scripts/export-graph.test.ts::bootstrap's_graph,_from_bootstrap's_files,_in_standard_terms::namesNothingAbove
  Scenario: names nothing above bootstrap — no harness prefix, no harness property
    When the export is serialised with every node's @id blanked
    Then it does not contain "cat-harness" or "folio-assistant"

  @test:scripts/export-graph.test.ts::bootstrap's_graph,_from_bootstrap's_files,_in_standard_terms::everySkillIsNode
  Scenario: every skill bootstrap holds is a node, at the id a harness links to
    Given the names of the skill files in bootstrap/skills, other than README.md, from their front matter
    Then the Skill nodes' ids after "/skill/" are exactly those names

  @test:scripts/export-graph.test.ts::bootstrap's_graph,_from_bootstrap's_files,_in_standard_terms::everyLinkLandsOnNode
  Scenario: every link inside the graph lands on a node of it
    Then every isPartOf, sourceRef, targetRef, calledElement, requires and flowNodeRef value is the id of a node or of the document

  @test:scripts/export-graph.test.ts::bootstrap's_graph,_from_bootstrap's_files,_in_standard_terms::subgraphUsesOwnTypologies
  Scenario: a subgraph says what it holds with bootstrap's own graph-typology individuals
    Then every type of every Subgraph node is a graph typology a directory in bootstrap.json declares

  @test:scripts/export-graph.test.ts::bootstrap's_graph,_from_bootstrap's_files,_in_standard_terms::provenanceOnlyWhenAsked
  Scenario: provenance only when asked, and never on a node
    Then the export without provenance has no generatedAtTime
    And the export with provenance has generatedAtTime
    And no node of it carries generatedAtTime

  @test:scripts/export-graph.test.ts::bootstrap's_graph,_from_bootstrap's_files,_in_standard_terms::documentSaysGenerated
  Scenario: the document says it is generated, and by what
    Then the export's comment contains the generated-by notice

  @test:scripts/export-graph.test.ts::bootstrap's_graph,_from_bootstrap's_files,_in_standard_terms::unreadableNotDropped
  Scenario: nothing the build could not read is dropped silently
    Then the export lists no problems

  @test:scripts/export-graph.test.ts::bootstrap's_graph,_from_bootstrap's_files,_in_standard_terms::unreadSubgraphNamed
  Scenario: a declared subgraph whose contents were not read is named, not left empty
    Given the Subgraph nodes whose types are none of the collected kinds
    Then there is at least one
    And the export's omitted list is exactly their labels, sorted

  @test:scripts/export-graph.test.ts::bootstrap's_graph,_from_bootstrap's_files,_in_standard_terms::nodesSortedById
  Scenario: nodes are sorted by @id, by code unit
    Then the @graph's ids are in sorted order

  @test:scripts/export-graph.test.ts::a_process_says_what_it_is_for,_what_it_calls,_and_where_it_is_drawn::processCarriesDocumentation
  Scenario: every bootstrap process carries its diagram's documentation: the whole as description, the first sentence as summary
    Then there is one Process node per .bpmn file in bootstrap/processes
    And each has a string description
    And each summary is the first sentence of its description

  @test:scripts/export-graph.test.ts::a_process_says_what_it_is_for,_what_it_calls,_and_where_it_is_drawn::processCallsAreProcessNodes
  Scenario: the processes a process calls are its call activities' calledElement, each a Process node
    Then Process_InitializeHarness requires Process_CompleteInitialization, Process_Discussion and Process_LogMessage
    And there is at least one call activity
    And every call activity's calledElement contains "/process/"

  @test:scripts/export-graph.test.ts::a_process_says_what_it_is_for,_what_it_calls,_and_where_it_is_drawn::processDepictedBySvg
  Scenario: a process is depicted by the SVG drawn beside its .bpmn
    Then every Process node's depiction is its source with .bpmn replaced by .svg

  @test:scripts/export-graph.test.ts::a_process_says_what_it_is_for,_what_it_calls,_and_where_it_is_drawn::processOwnDocumentationOnly
  Scenario: the process's own documentation, never a task's; a call to a process no diagram defines is a problem, and no link is written
    Given a temporary instance with one process "P_A" documented "Does A. Then more.", holding a task with its own documentation and a call activity to the undefined "P_Missing"
    When its graph is exported
    Then the process's summary is "Does A." and its description "Does A. Then more."
    And the process requires nothing
    And the call activity has no calledElement
    And the problems name the process and the call activity as calling process/P_Missing, which no diagram here defines

  @test:scripts/export-graph.test.ts::a_process_says_what_it_is_for,_what_it_calls,_and_where_it_is_drawn::globalTaskRequiresSkill
  Scenario: a global task is a Task that requires its Skill, and a call to it by bare id resolves to it from another file
    Given a temporary instance with a skill "seed", a file holding the global user task "GT_Seed" bound to that skill and a bare global task "GT_Bare"
    And processes P_A and P_B in other files, each calling "GT_Seed" and the undefined "GT_Missing"
    When its graph is exported
    Then GT_Seed is a Task of type bpmn:globalUserTask, labelled "Seed the plan", described "Seed it.", requiring skill/seed
    And GT_Bare has type bpmn:globalTask
    And each process's call to GT_Seed has GT_Seed as its calledElement, and each process requires GT_Seed
    And the only Process nodes are P_A and P_B
    And 4 problems mention GT_Missing
    And the export parses under GraphExportSchema

  @test:scripts/export-graph.test.ts::a_process_says_what_it_is_for,_what_it_calls,_and_where_it_is_drawn::laneNamesRole
  Scenario: a lane NAMES its Role with partitionElementRef; the retired role ref still binds, with a problem
    Given a temporary instance with roles "r-new" and "r-old" and a process with three lanes: one naming r-new by partitionElementRef, one naming r-old by the retired role ref, and one naming r-old by partitionElementRef with no matching resource
    When its graph is exported
    Then role r-new holds task T1
    And role r-old holds tasks T2 and T3
    And the problems are that L_Old names r-old with the retired role ref, and that L_Dangling's partitionElementRef names no resource in the file

  @test:scripts/export-graph.test.ts::a_process_says_what_it_is_for,_what_it_calls,_and_where_it_is_drawn::taskRequiresSkill
  Scenario: a task REQUIRES its Skill (dcterms:requires); the Skill names no task
    Then at least one process node requires a skill
    And no node has a "skill" property
    And the context maps "requires" to dcterms:requires as an @id

  @test:scripts/export-graph.test.ts::a_process_says_what_it_is_for,_what_it_calls,_and_where_it_is_drawn::otherInstanceInBootstrapClasses
  Scenario: another instance's graph is written in bootstrap's classes, whatever it declares
    When the bootstrap-tools instance's own graph is exported
    Then its context's "bootstrap" prefix is the same as bootstrap's export's
    And it lists no problems
    And it has exactly one Process node, which has a summary

  @test:scripts/export-graph.test.ts::a_process_says_what_it_is_for,_what_it_calls,_and_where_it_is_drawn::firstSentence
  Scenario: the first sentence
    Then the first sentence of "One.  Two." is "One."
    And of "A file.bpmn is\n read. Then" is "A file.bpmn is read."
    And of "No stop" is "No stop"
    And of "Ends here." is "Ends here."

  @test:scripts/export-graph.test.ts::the_XML_reader_is_enough_for_authored_BPMN::xmlReaderParsesBpmn
  Scenario: elements, attributes, nesting, text and entities
    Given an XML document with a declaration, a comment, a root a:r with attribute x="1", an empty child a:c and a child a:t holding "a &amp; b"
    When it is parsed
    Then the root is named "a:r" with attributes x = "1"
    And its children are a:c and a:t
    And a:t's text is "a & b"
