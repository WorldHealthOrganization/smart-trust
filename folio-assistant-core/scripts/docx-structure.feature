Feature: pictures in the table cells of a .docx

  @test:scripts/docx-structure.test.ts::docx-structure:_pictures_in_table_cells::cellPictureInCell
  Scenario: a picture in a cell is written into that cell, labelled by the adjacent cell
    When the structure is read
    Then the pictures are written into their cells, labelled by the next cell

  @test:scripts/docx-structure.test.ts::docx-structure:_pictures_in_table_cells::noImageItemForCellPicture
  Scenario: no image item is emitted for a cell picture; a standalone one still is
    When the image items are listed
    Then only the standalone picture is one

  @test:scripts/docx-structure.test.ts::docx-structure:_pictures_in_table_cells::rotatedDrawingCopy
  Scenario: a rotated drawing is referenced as a rotated copy, written rotated
    When the rotated drawing is read
    Then without Pillow a warning names the rotation
    And with Pillow a rotated copy is referenced and written rotated

  @test:scripts/docx-structure.test.ts::docx-to-folio:_the_table_block_holds_its_pictures::tableBlockHoldsPictures
  Scenario: the cells hold the images, one figure block for the standalone picture only
    When the structure is converted to a folio
    Then the table's Markdown holds the cell images
    And there is one figure block, for the standalone picture
    And the media are the three pictures
