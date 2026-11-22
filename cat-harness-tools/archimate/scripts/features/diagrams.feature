# Specifies the derived diagrams of an ArchiMate model (D5,
# archimate/schemas/diagrams.ts): data class diagrams from data and business
# objects, FSH Logical models and numbered documentation; sequence diagrams
# from ApplicationInteraction views, flow views and BPMN; and their writing by
# archimate-diagrams.ts and onto the metamodel page by gen-archimate-pages.ts.
# The FSH holds Logical models "HealthWorkerModel" (three fields, one a
# Reference(FacilityModel)) and "FacilityModel" (two fields). The BPMN is a
# collaboration with lanes "Test Operator" and "Document Repository", a gateway,
# and message flows with a "Professional Council" pool.
Feature: Class and sequence diagrams are derived from an ArchiMate model

  Background:
    Given a model "RA_D5" with Product Master Data composed of four business objects with named-cardinality associations, a CDE-HWR data object whose documentation is a numbered list, data objects tagged with FSH logical models "HealthWorkerModel" and "FacilityModel", a goal tagged with a logical model, placeholder objects, an ITI-41 transaction view and a track-and-trace flow view

  @test:archimate/scripts/diagrams.test.ts::derived_data_class_diagrams_(D5)::validates_against_DataModelSchema_and_reports_invalid_logical-model_tags
  Scenario: The data model is schema-valid, a bad logical-model tag is reported, and placeholders are left out
    Given the FSH Logical models
    When the data model is derived with them
    Then it passes the data-model schema
    And its only problem is that a Goal cannot carry logical-model
    And no class is named "Business Object" or "Data Object (MS)"

  @test:archimate/scripts/diagrams.test.ts::derived_data_class_diagrams_(D5)::extracts_attributes_from_FSH_Logical_models_and_from_numbered_documentation_items
  Scenario: Attributes come from FSH Logical models and from numbered documentation
    Given the FSH Logical models
    When the data model is derived with them
    Then the FSH gives "HealthWorkerModel" (id "health-worker-model", three fields) and "FacilityModel" (id "facility-model", two fields)
    And the "Health Worker" class has logical model "HealthWorkerModel" and its three fields as attributes, with cardinality, type and description
    And the CDE-HWR class has its StructureDefinition URL as logical model and the seven numbered items as attributes
    And text that is not a numbered list gives no attributes

  @test:archimate/scripts/diagrams.test.ts::derived_data_class_diagrams_(D5)::captures_Product_Master_Data_compositions,_association_cardinalities,_FSH_references,_and_accessors
  Scenario: Compositions, association cardinalities, accessors and FSH references are captured
    Given the data model derived with the FSH Logical models
    When relationship names are parsed for role and cardinality
    Then "classification 0..*", "contains 0..* (packaging hierarchy)" and "authorisedTradeItem 1..1" give their role and cardinality, a parenthesis kept in the role
    And Product Master Data's compositions are of Generic Product, Product Classification, Regulated Trade Item and Trade Item
    And Product Master Data is accessed by "National Product Catalogue" (readwrite) and by "Data Owner" (association "approves changes")
    And the Reference(FacilityModel) field gives an association from Health Worker to Facility with role "primaryFacility" and cardinality "0..1"

  @test:archimate/scripts/diagrams.test.ts::derived_data_class_diagrams_(D5)::renders_PlantUML,_Mermaid,_Graphviz_DOT_and_Markdown_class_diagrams
  Scenario: The class diagram is rendered as PlantUML, Mermaid, DOT and Markdown
    Given the data model derived with the FSH Logical models
    When the data model is rendered
    Then the PlantUML starts "@startuml" and has the CDE-HWR class with its stereotypes, its attributes, the composition of Trade Item and the cardinality associations
    And the Mermaid is a class diagram with the classification association
    And the DOT, given links, links an element and a relationship
    And the Markdown has the heading "Data Class Diagram (RA_D5)", a Mermaid class diagram and a table row for Product Master Data

  @test:archimate/scripts/diagrams.test.ts::derived_sequence_diagrams_(D5)::validates_against_SequenceSetSchema_and_derives_interaction,_view-flow,_and_BPMN_sequences
  Scenario: The sequence set is schema-valid and holds interaction, view and BPMN sequences
    Given the BPMN
    When the sequences are derived with it
    Then they pass the sequence-set schema
    And they are the ITI-41 view (interaction), the track-and-trace view (view) and the BPMN "hwr-cred" (bpmn)

  @test:archimate/scripts/diagrams.test.ts::derived_sequence_diagrams_(D5)::orders_ApplicationInteraction_participants_and_messages_from_trigger_to_initiator_to_responder_and_service_reply
  Scenario: An interaction runs from trigger to initiator to responder to service reply
    Given the BPMN
    When the sequences are derived with it
    Then the ITI-41 participants are Test Operator, Create and submit document, Document Source and Document Repository
    And its messages are two triggerings, the ITI-41 interaction from source to repository, and the "Register Document Set" serving reply

  @test:archimate/scripts/diagrams.test.ts::derived_sequence_diagrams_(D5)::includes_Flow,_DataObject_Access,_and_Actor_Serving_steps_on_a_dynamic_flow_view
  Scenario: A flow view gives flow, access and serving steps
    Given the BPMN
    When the sequences are derived with it
    Then the track-and-trace messages are two flows, a read/write and a read of the Traceability Event, and a serving of the Individual

  @test:archimate/scripts/diagrams.test.ts::derived_sequence_diagrams_(D5)::derives_cross-lane_sequenceFlow_handoffs_(including_gateway_branches)_and_collaboration_messageFlows_from_BPMN,_linked_to_ArchiMate_elements
  Scenario: BPMN gives cross-lane handoffs, gateway branches and message flows, linked to ArchiMate elements
    Given the BPMN
    When the sequences are derived with it
    Then the BPMN participants are the two lanes, linked by name to the ArchiMate role and component, and the council pool, unlinked
    And its messages are three cross-lane handoffs (one through the "no" gateway branch) and the two message flows with the council
    And BPMN definitions with no process give no sequences

  @test:archimate/scripts/diagrams.test.ts::derived_sequence_diagrams_(D5)::renders_PlantUML,_Mermaid,_and_Markdown_sequence_diagrams
  Scenario: Sequences are rendered as PlantUML, Mermaid and Markdown
    Given the sequences derived with the BPMN
    When the ITI-41 sequence and the whole set are rendered
    Then the PlantUML has the operator as an actor, the ITI-41 call and the dashed reply, and the set's PlantUML titles the track-and-trace view
    And the Mermaid is a sequence diagram with the call and the dashed reply, and the set's Mermaid has "Verify licence request"
    And the Markdown has the heading "Sequence Diagrams (RA_D5)", a section for the ITI-41 view and a Mermaid sequence diagram

  @test:archimate/scripts/diagrams.test.ts::integration_with_archimate-pages_and_archimate-diagrams::writes_data-model_and_sequences_artefacts_and_sections_onto_the_metamodel_page,_and_every_link_resolves_in-graph_and_in-site
  Scenario: The diagrams are written as files and as metamodel-page sections, and every link resolves in a site and in the graph
    Given a throwaway instance with the model, its config, the FSH under "input/fsh/models" and the BPMN under "processes"
    When its diagrams are made
    Then the data model has nine classes and there are three sequences, the report says "data model: 9 class(es)", and PlantUML and Mermaid formats are given
    When its pages are generated for a site
    Then the data model is written as JSON, PlantUML, Mermaid, DOT and SVG, and the sequences as JSON, PlantUML and Mermaid
    And the metamodel page has the sections "Data class diagram" and "Sequence diagrams"
    And every relative href, src and data attribute of each page, and each "node", "model", "svg" and "metamodel" of a non-root page's config, resolves to a written file or folder, and there is at least one
    When its pages are generated in the graph
    Then the pages sit beside their data, the metamodel page has the section "Data class diagram"
    And every such link resolves to a written file or folder, and there is at least one
