Feature: named subgraphs — one IRI, two files, projected from one graph

  @test:scripts/subgraph-jsonld.test.ts::named_subgraphs_—_one_IRI,_two_files,_projected_from_one_graph::auditIsClean[${label}]
  Scenario Outline: the audit is clean: every file validates, every child has its file, every diagram is a documented Process
    Given the subgraphs built for <instance>
    When they are audited
    Then there are no findings

    Examples:
      | instance |
      | bootstrap |
      | bootstrap-tools |

  @test:scripts/subgraph-jsonld.test.ts::named_subgraphs_—_one_IRI,_two_files,_projected_from_one_graph::buildIsPure[${label}]
  Scenario Outline: pure: two builds are byte-identical, and nothing from this machine appears
    Given the subgraphs built for <instance>
    Then a second build's files serialise identically
    And they do not contain the instance's absolute path on this machine

    Examples:
      | instance |
      | bootstrap |
      | bootstrap-tools |

  @test:scripts/subgraph-jsonld.test.ts::named_subgraphs_—_one_IRI,_two_files,_projected_from_one_graph::subgraphIris[${label}]
  Scenario Outline: IRIs: the repository, the harness root, each directory — and the root has no hydrated file
    Given the subgraphs built for <instance>, and its publication base
    Then the repository IRI is the base followed by "subgraph/"
    And the root IRI is the base followed by "subgraph/<instance>/"
    And the repository index's hasSubgraph is just the root IRI
    And the root has an index file but no hydrated file
    And the processes directory has a hydrated file

    Examples:
      | instance |
      | bootstrap |
      | bootstrap-tools |

  @test:scripts/subgraph-jsonld.test.ts::named_subgraphs_—_one_IRI,_two_files,_projected_from_one_graph::sharedContextUrl[${label}]
  Scenario Outline: @context is the one shared URL in every file, never inline; the context file defines the subgraph terms
    Given the subgraphs built for <instance>
    Then every file other than the context file has the shared context URL as its @context
    And the context defines name, summary, description, depiction, requires, calledElement, holdsGraph, hasMember, hasSubgraph and path
    And the context does not define label

    Examples:
      | instance |
      | bootstrap |
      | bootstrap-tools |

  @test:scripts/subgraph-jsonld.test.ts::named_subgraphs_—_one_IRI,_two_files,_projected_from_one_graph::nodeInExactlyOneSubgraph[${label}]
  Scenario Outline: every node of the graph is a direct member of exactly one subgraph, and an index member is a pointer
    Given the subgraphs built for <instance>, and the instance's exported graph
    Then every index file parses under SubgraphIndexSchema
    And every index member carries only @id, @type, name and title
    And the index members, taken together, are exactly the typed nodes of the graph, each once

    Examples:
      | instance |
      | bootstrap |
      | bootstrap-tools |

  @test:scripts/subgraph-jsonld.test.ts::named_subgraphs_—_one_IRI,_two_files,_projected_from_one_graph::hydratedHoldsMembership[${label}]
  Scenario Outline: a hydrated file holds the transitive membership whole: every index member below it, inline
    Given the subgraphs built for <instance>
    Then every hydrated file parses under SubgraphHydratedSchema
    And the members inline in it and its nested subgraphs are exactly the members of the index files at or below its directory

    Examples:
      | instance |
      | bootstrap |
      | bootstrap-tools |

  @test:scripts/subgraph-jsonld.test.ts::named_subgraphs_—_one_IRI,_two_files,_projected_from_one_graph::processNodeFields[${label}]
  Scenario Outline: what a process reader needs: @id, Process, name, summary, description, the processes it calls, the .bpmn and the SVG
    Given the processes directory's hydrated file for <instance>
    Then it holds as many Process members as the build counted, and at least one
    And each has a string name, summary and description
    And each has an https .bpmn source and a depiction that is that source as .svg, which exists in the instance
    And each process it requires is one of those Process members
    And the file holds the processes graph typology

    Examples:
      | instance |
      | bootstrap |
      | bootstrap-tools |

  @test:scripts/subgraph-jsonld.test.ts::named_subgraphs_—_one_IRI,_two_files,_projected_from_one_graph::diagramsAreProcessNodes
  Scenario: bootstrap's five diagrams and this toolset's one are all Process nodes
    Then the subgraphs built for bootstrap count 5 processes
    And those built for bootstrap-tools count 1

  @test:scripts/subgraph-jsonld.test.ts::named_subgraphs_—_one_IRI,_two_files,_projected_from_one_graph::childSubgraphNested
  Scenario: nesting: a directory under a declared one is a child subgraph, and its parent's hydrated file nests it
    Given a git-initialised instance "demo" of Owner/demo at 0.1.0, declaring skills (holding top.md and deep/er/low.md) and code
    When its subgraphs are built with bootstrap beside it
    Then the repository IRI is "https://owner.github.io/demo/subgraph/"
    And the audit has no findings
    And the files are the demo, skills, skills/deep and skills/deep/er index and hydrated files, the repository index and the v0 context, and no hydrated root
    And the skills index has members "skills" and "top" and the child subgraph skills/deep/
    And in the skills hydrated file, deep has no members of its own and its child er holds "low"
    And code is listed as omitted
    And the demo root index's only member is the code directory

  @test:scripts/subgraph-jsonld.test.ts::named_subgraphs_—_one_IRI,_two_files,_projected_from_one_graph::undeterminedSubgraphIsProblem
  Scenario: a node whose subgraph cannot be determined is a problem, never left out
    Given the demo instance's exported graph with a stray node whose isPartOf is not a node of the graph
    When its subgraphs are framed
    Then the one problem says the stray node has no source path and its subgraph cannot be determined

  @test:scripts/subgraph-jsonld.test.ts::named_subgraphs_—_one_IRI,_two_files,_projected_from_one_graph::contextUnderMajorVersion
  Scenario: the context sits under the MAJOR version, and a missing version is a problem, never a guessed v0
    Then the context path of "0.1.0" is "v0/context.jsonld" and of "2.3.4-rc.1" is "v2/context.jsonld"
    And no version and "latest" have no context path
    When the demo instance's subgraphs are built
    Then the context file is "subgraph/v0/context.jsonld" at "https://owner.github.io/demo/subgraph/v0/context.jsonld"
    When the version is removed from its declaration and the subgraphs are built again
    Then a problem says the version is not semver

  @test:scripts/subgraph-jsonld.test.ts::named_subgraphs_—_one_IRI,_two_files,_projected_from_one_graph::checkDetectsStale
  Scenario: --check's twin: a written tree is current, and an edited file is stale
    Given bootstrap's subgraphs written to an empty directory
    Then none is stale
    When the repository index file is overwritten
    Then exactly that file is stale

  @test:scripts/subgraph-jsonld.test.ts::named_subgraphs_—_one_IRI,_two_files,_projected_from_one_graph::siteStagesSubgraphs
  Scenario: the site stages bootstrap's subgraphs from the same graph as bootstrap.jsonld
    When bootstrap's site is staged
    Then there are no problems
    And none of bootstrap's built subgraph files is stale in the staged site
    And every member of the staged processes hydrated file is a node of the staged bootstrap.jsonld

  @test:scripts/subgraph-jsonld.test.ts::named_subgraphs_—_one_IRI,_two_files,_projected_from_one_graph::missingNeededBootstrapIsProblem
  Scenario: an instance that needs bootstrap, staged without bootstrap beside it, is a problem rather than a site without its graph
    Given the demo instance, which needs bootstrap
    When its site is staged with a bootstrap location that does not exist
    Then there is exactly one problem, saying demo.jsonld and its subgraphs were not written
