Feature: readme-visualisers — where a declared directory is seen, resolved for its README

  The owner, 2026-11-18: each mounted subgraph or directory has a visualiser
  as required, and its README says where. Visualisers come from the layers'
  declarations, the address from the site the checkout publishes.

  @test:scripts/tests/readme-visualisers.test.ts::which_pages_render_a_directory,_at_what_address::every_visualiser_covering_the_directory's_kind,_under_the_declared_route_and_the_site_address
  Scenario: every visualiser covering the directory's kind is linked under the declared route and the site address
    Given a checkout where cat-harness declares library visualisers by kind and top declares a library directory
    When top's library directory is resolved under "https://e.org/site"
    Then it links the instance sub-graph page and the directory sub-graph page, each under the localised route

  @test:scripts/tests/readme-visualisers.test.ts::which_pages_render_a_directory,_at_what_address::a_visualiser_covering_by_id_reaches_its_own_harness's_directory_only
  Scenario: a visualiser covering by id reaches its own harness's directory only
    When cat-harness's todos directory and a todos directory of top are resolved
    Then cat-harness's is linked at the full view and top's has none

  @test:scripts/tests/readme-visualisers.test.ts::which_pages_render_a_directory,_at_what_address::no_site_address:_the_title_is_kept,_the_href_is_empty,_and_the_README_is_told_why
  Scenario: with no site address the link is not guessed
    When top's library directory is resolved with no site address
    Then every href is empty and the reason names readme.pagesBaseUrl

  @test:scripts/tests/readme-visualisers.test.ts::which_pages_render_a_directory,_at_what_address::the_sub-graph_segment_is_the_one_viewersOf_uses
  Scenario: the sub-graph segment is the one viewersOf uses
    Then a directory visualiser of another harness names the layer-qualified id first, then the bare id

  @test:scripts/tests/readme-visualisers.test.ts::whether_a_directory_owes_one::a_kind_that_is_not_content_owes_one;_a_renderable_kind_does_not
  Scenario: a kind that is not content owes a visualiser; a renderable kind does not
    Then a beans directory owes one and a folio directory does not

  @test:scripts/tests/readme-visualisers.test.ts::whether_a_directory_owes_one::a_waiver_with_a_reason,_and_the_bootstrap_layer,_owe_none
  Scenario: a waiver with a reason, and the bootstrap layer, owe none
    Then a beans directory waiving the visualiser with a reason owes none, nor does one of the bootstrap layer
