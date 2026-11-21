# Specifies addressBook and provJsonldDocument (schemas/kg/prov-jsonld.ts)
# with who-iris's real IRIS catalogue.
Feature: A catalogued item a PROV activity used is linked at its Handle

  @test:test/coordinator/prov-jsonld-checkout.test.ts::prov:used_—_catalogue_items_linked_at_their_Handle_(owner_2026-10-01,_option_A)::a_catalogued_IRIS_item_expands_to_its_Handle_IRI_as_a_link
  Scenario: A catalogued IRIS item expands to its Handle IRI
    Given the checkout's address book
    And an activity that used "item/18892cf3-5a4f-42a4-923c-a93f4a594dec"
    When the PROV JSON-LD document is built and expanded with the local loader
    Then no item is unaddressed
    And the activity's prov:used is exactly the link "https://hdl.handle.net/10665/332098"
