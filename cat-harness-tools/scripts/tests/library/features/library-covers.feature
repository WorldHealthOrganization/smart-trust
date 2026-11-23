# An entry's cover is page 1 of its held PDF (owner, 2026-10-16), and the
# cover is its avatar. Each Scenario names the test that executes it.
Feature: Library entry covers and avatars

  @test:scripts/tests/library/library-covers.test.ts::an_entry's_cover_is_page_1_of_its_held_PDF_(owner,_2026-10-16)::only_a_held,_unwithheld_PDF_can_have_one_rendered
  Scenario: Only a held, unwithheld PDF can have a cover rendered
    Given an upload queue holding e1.pdf and e2.docx
    When the cover state of each entry is read
    Then an entry over the held PDF with no cover yet is "missing", naming the PDF and the cover path
    And an entry over the .docx is "not-pdf"
    And an entry over a PDF not in the queue is "not-held"
    And a withheld entry over the held PDF is "withheld"
    And once the cover file is written the entry is "present"

  @test:scripts/tests/library/library-covers.test.ts::an_entry's_cover_is_page_1_of_its_held_PDF_(owner,_2026-10-16)::the_avatar_is_the_rendered_cover_before_any_figure
  Scenario: The rendered cover is the avatar ahead of any figure
    Given an entry with a rendered cover and a figure image
    When its avatar is chosen
    Then the avatar is the cover, served under /assets/library/avatars/<instance>/<entry>.png

  @test:scripts/tests/library/library-covers.test.ts::an_entry's_cover_is_page_1_of_its_held_PDF_(owner,_2026-10-16)::a_PDF_with_no_cover_gets_no_avatar,_never_its_first_figure_(owner,_2026-10-30)
  Scenario: A PDF with no cover gets no avatar, never its first figure
    Given an entry with a figure image and no rendered cover
    When its avatar is chosen with a PDF source file
    Then there is no avatar
    And when its source is a .docx or not given, the avatar is the figure
