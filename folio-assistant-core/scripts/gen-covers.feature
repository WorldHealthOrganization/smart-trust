Feature: the cover thumbnails the catalogue asks for

  @test:scripts/gen-covers.test.ts::the_catalogue_asks_for_the_covers,_not_the_script::catalogueYieldsCovers
  Scenario: the real catalogue yields covers and no problems
    When the real catalogue is read for covers
    Then there are covers and no problems

  @test:scripts/gen-covers.test.ts::the_catalogue_asks_for_the_covers,_not_the_script::coverBytesMatchDigest
  Scenario: every declared cover's bytes exist and match its recorded digest
    When each declared cover is read
    Then its file exists and its sha256 is the declared one

  @test:scripts/gen-covers.test.ts::the_catalogue_asks_for_the_covers,_not_the_script::declaredWidthOwnHeight
  Scenario: every cover is the declared width, and the height is the page's own
    When each declared cover's size is read
    Then every width is the cover width and heights vary

  @test:scripts/gen-covers.test.ts::a_THUMBNAIL_that_does_not_declare_itself_derived_is_refused::strippedDeclarationIsProblem
  Scenario: stripping the declaration turns a cover into a problem
    When a cover's derived declaration is removed
    Then no cover is wanted and the problem says it does not declare itself derived

  @test:scripts/gen-covers.test.ts::a_THUMBNAIL_that_does_not_declare_itself_derived_is_refused::markerInAuthoredNote
  Scenario: the marker is a substring of an AUTHORED note, not something generated
    When each cover's note is read
    Then it contains the marker, is much longer than it and names pdf-cover.py

  @test:scripts/gen-covers.test.ts::a_THUMBNAIL_that_does_not_declare_itself_derived_is_refused::noHandleAsSource
  Scenario: no cover claims the Handle as what it was derived FROM
    When each cover's provenance is read
    Then it is local, with no upstream and no Handle

  @test:scripts/gen-covers.test.ts::a_THUMBNAIL_that_does_not_declare_itself_derived_is_refused::noArchivalCover
  Scenario: no cover is archival — a rendering answers no source-loss question
    When each cover's materialization is read
    Then it is a working copy whose sourceLoss is not permitted

  @test:scripts/gen-covers.test.ts::the_check_keeps_its_teeth_where_PyMuPDF_is_not_installed::pngHeaderDimensions
  Scenario: PNG dimensions are readable from the file header, with no decoder
    When each cover's PNG header is read
    Then its size matches the declared width and height

  @test:scripts/gen-covers.test.ts::the_check_keeps_its_teeth_where_PyMuPDF_is_not_installed::sharedListingWidth
  Scenario: every cover is the shared listing width
    When the covers are read
    Then each is the cover width

  @test:scripts/gen-covers.test.ts::the_check_keeps_its_teeth_where_PyMuPDF_is_not_installed::pngSizeRefusesNonPng
  Scenario: pngSize refuses bytes that are not a PNG rather than guessing
    When short bytes, text and a PNG with a wrong chunk are read
    Then each gives no size

  @test:scripts/gen-covers.test.ts::the_check_keeps_its_teeth_where_PyMuPDF_is_not_installed::flippedByteChangesDigest
  Scenario: a flipped byte changes the digest the node declares
    When a byte of a cover is flipped
    Then its digest no longer matches the declared one

  @test:scripts/gen-covers.test.ts::the_check_keeps_its_teeth_where_PyMuPDF_is_not_installed::declaredBytesIsLength
  Scenario: the declared byte count is the file's own length
    When each cover is read
    Then its declared byte count is its length

  @test:scripts/gen-covers.test.ts::a_cover_can_outlive_a_PDF_the_repository_does_not_hold::referencedOriginalNoSource
  Scenario: a referenced ORIGINAL gives a cover with no source, and no problem
    When a cover is wanted for a referenced original
    Then there is one cover with no source PDF and no problem

  @test:scripts/gen-covers.test.ts::a_cover_can_outlive_a_PDF_the_repository_does_not_hold::materializedMissingIsProblem
  Scenario: a materialized ORIGINAL with no bytes is still a problem (yl5w)
    When a cover is wanted for a materialized original with no bytes
    Then no cover is wanted and there is one problem
