Feature: a Dublin Core record rendered as JSON-LD bound to DCMI Terms and as DC XML

  @test:schemas/dublin-core-render.test.ts::the_corpus_this_runs_over::corpusHoldsWorkedExamples
  Scenario: holds the three worked examples among the catalogue items that name a record
    When the Handles of the catalogue items that name a record are listed
    Then they include 10665/145714, 10665/332098 and 10665/36842

  @test:schemas/dublin-core-render.test.ts::JSON-LD_bound_to_DCMI_Terms_—_expanded_by_a_real_processor::namesItemAtHandle[${node.id.replace(/\s+/g,_"_")}]
  Scenario Outline: names the item at its Handle, through the inline @base
    Given the catalogue item <item> and its Dublin Core record
    When the record is rendered as DCMI Terms JSON-LD with its Handle and expanded by a JSON-LD processor
    Then the expanded @id is the Handle resolver followed by the item's Handle

    Examples:
      | item |
      | each catalogue item that names a record |

  @test:schemas/dublin-core-render.test.ts::JSON-LD_bound_to_DCMI_Terms_—_expanded_by_a_real_processor::resourceTermsExpandToNodes[${node.id.replace(/\s+/g,_"_")}]
  Scenario Outline: expands every resource-ranged DCMI term to a node with rdf:value, never a literal
    Given the catalogue item <item> and its Dublin Core record
    When the record is rendered as DCMI Terms JSON-LD and expanded
    Then every value of a resource-ranged DCMI term has no @value and exactly one rdf:value
    And at least one such value is seen

    Examples:
      | item |
      | each catalogue item that names a record |

  @test:schemas/dublin-core-render.test.ts::JSON-LD_bound_to_DCMI_Terms_—_expanded_by_a_real_processor::everySourceValueOnce[${node.id.replace(/\s+/g,_"_")}]
  Scenario Outline: carries every source value exactly once, verbatim, under the field's predicate
    Given the catalogue item <item> and its Dublin Core record
    When the record is rendered as DCMI Terms JSON-LD and expanded
    Then every source value appears verbatim under its field's predicate
    And the number of expanded values equals the number of source values

    Examples:
      | item |
      | each catalogue item that names a record |

  @test:schemas/dublin-core-render.test.ts::JSON-LD_bound_to_DCMI_Terms_—_expanded_by_a_real_processor::meshSubjectsAreLinks
  Scenario: puts MeSH subjects in dcterms:MESH as a LINK, and keeps the authority as a link
    Given the catalogue item 10665/332098
    When its record is rendered and expanded
    Then it has subjects, each a member of dcterms:MESH
    And each subject's authority is the link https://id.nlm.nih.gov/mesh/

  @test:schemas/dublin-core-render.test.ts::JSON-LD_bound_to_DCMI_Terms_—_expanded_by_a_real_processor::identifierUriTypedGovdocApart
  Scenario: types dc.identifier.uri as dcterms:URI and keeps govdoc OFF dcterms:identifier (iris-dspace R1)
    Given the catalogue item 10665/332098
    When its record is rendered and expanded
    Then dcterms:identifier holds the two Handle URIs, each typed dcterms:URI
    And the govdoc identifier WPR/RDO/2020/003 is under its own predicate

  @test:schemas/dublin-core-render.test.ts::JSON-LD_bound_to_DCMI_Terms_—_expanded_by_a_real_processor::w3cdtfOnlyOnMatchingValue
  Scenario: asserts W3CDTF only on a value that matches it
    Given a record with dc.date.issued values "1993" and "circa 1993"
    When it is rendered as DCMI Terms JSON-LD
    Then "1993" is typed W3CDTF and "circa 1993" carries no type

  @test:schemas/dublin-core-render.test.ts::JSON-LD_bound_to_DCMI_Terms_—_expanded_by_a_real_processor::noHandleNoBase
  Scenario: with no Handle, sets no @base and uses the record's own absolute id
    Given the first catalogue record rendered with no Handle
    When the document is read and expanded
    Then its context sets no @base
    And the expanded @id is an absolute https item IRI

  @test:schemas/dublin-core-render.test.ts::DC_XML_per_DCMI's_XML_guidelines::xmlWellFormed[${node.id.replace(/\s+/g,_"_")}]
  Scenario Outline: is well-formed
    Given the DC XML rendering of catalogue item <item>
    When it is validated as XML
    Then it is well-formed

    Examples:
      | item |
      | each catalogue item that names a record |

  @test:schemas/dublin-core-render.test.ts::DC_XML_per_DCMI's_XML_guidelines::xmlNamespacesOnContainer[${node.id.replace(/\s+/g,_"_")}]
  Scenario Outline: declares dc, dcterms and xsi on one namespaced container, and uses only dc:/dcterms: elements
    Given the DC XML rendering of catalogue item <item>
    When it is parsed
    Then its metadata container declares dc, dcterms and xsi and a default namespace
    And every element in it is a dc: or dcterms: element

    Examples:
      | item |
      | each catalogue item that names a record |

  @test:schemas/dublin-core-render.test.ts::DC_XML_per_DCMI's_XML_guidelines::xmlOnlyDcmiSchemes[${node.id.replace(/\s+/g,_"_")}]
  Scenario Outline: uses only DCMI encoding schemes in xsi:type
    Given the DC XML rendering of catalogue item <item>
    When its xsi:type attributes are read
    Then each is one of dcterms:W3CDTF, URI, RFC4646, MESH or IMT

    Examples:
      | item |
      | each catalogue item that names a record |

  @test:schemas/dublin-core-render.test.ts::DC_XML_per_DCMI's_XML_guidelines::xmlListsInexpressible[${node.id.replace(/\s+/g,_"_")}]
  Scenario Outline: carries every expressible value once, and LISTS the rest instead of dropping them
    Given the DC XML rendering of catalogue item <item>
    When its elements are counted
    Then there is one element per value of each expressible field
    And every inexpressible field is named in a "not expressible as DC XML" note

    Examples:
      | item |
      | each catalogue item that names a record |

  @test:schemas/dublin-core-render.test.ts::DC_XML_per_DCMI's_XML_guidelines::xmlEscapesMarkup
  Scenario: escapes markup in a value rather than emitting it
    Given a record whose title is A <b> & "c"
    When it is rendered as DC XML
    Then the XML is well-formed
    And the title is written with &lt; &gt; &amp; and &quot; escapes

  @test:schemas/dublin-core-render.test.ts::the_committed_renderings::committedRenderingsMatchFresh
  Scenario: are byte-identical to a fresh render (what dc:render:check gates)
    When the planned renderings of the layer are computed
    Then there are two per catalogue item
    And each committed file is byte-identical to its fresh render

  @test:schemas/dublin-core-render.test.ts::the_committed_renderings::renderingsDeterministic
  Scenario: are deterministic
    When each record is rendered twice as JSON-LD and as XML
    Then both renders are identical
