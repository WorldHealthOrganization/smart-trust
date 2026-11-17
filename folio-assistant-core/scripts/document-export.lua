--[[
document-export.lua — pandoc filter for `document-export.ts`: every
`<a id="LABEL"></a>` anchor the Markdown assembly
(cat-harness-tools/pipeline/render-markdown.ts) writes before a chapter,
section or block becomes a WORD BOOKMARK in the .docx.

Why bookmarks: an author who edits the offline copy in Word with Track
Changes on sends back a file whose paragraphs no longer say which folio block
they came from. A bookmark is the one marker Word keeps, invisibly, through
editing, and `docx-offline.py changes` reads it to put every tracked change
back on its block.

The bookmark NAME is `folio_` + the first 16 hex digits of sha1(label).
Word allows only letters, digits and `_` in a bookmark name, at most 40
characters, so the label itself (`prose:ch01-objectives`) cannot be used.
The name is recomputed from the labels in `review-anchors.json` at merge
time, so no mapping table has to survive inside the file.

An anchor that stands alone in its paragraph (a chapter or section anchor
before its heading, a table's anchor before the table) is moved INTO the
next block rather than left as an empty, line-numbered paragraph.

Raw HTML other than the anchors (the block-anchor link icons, `<div>`
wrappers) is dropped, as pandoc's docx writer drops it anyway.
--]]

local PREFIX = "folio_"

local function bookmark_name(label)
  return PREFIX .. pandoc.utils.sha1(label):sub(1, 16)
end

local function anchor_label(el)
  if el.t ~= "RawInline" or el.format ~= "html" then return nil end
  return el.text:match('^<a%s+id="([^"]+)"%s*>$')
end

local function is_close_a(el)
  return el and el.t == "RawInline" and el.format == "html" and el.text:match("^</a%s*>$")
end

-- Anchors → empty Spans carrying the bookmark name; pandoc's docx writer
-- turns a Span identifier into <w:bookmarkStart>/<w:bookmarkEnd>.
function Inlines(ils)
  local out = pandoc.List()
  local i = 1
  while i <= #ils do
    local label = anchor_label(ils[i])
    if label then
      out:insert(pandoc.Span({}, { id = bookmark_name(label), ["data-folio-label"] = label }))
      i = i + (is_close_a(ils[i + 1]) and 2 or 1)
      -- the line break after the anchor is source layout, not a space in the text
      while ils[i] and (ils[i].t == "SoftBreak" or ils[i].t == "Space") do i = i + 1 end
    else
      out:insert(ils[i])
      i = i + 1
    end
  end
  return out
end

local function is_bookmark_span(el)
  return el.t == "Span" and el.identifier:sub(1, #PREFIX) == PREFIX and #el.content == 0
end

-- A paragraph holding nothing but anchors (and the breaks between them).
local function anchor_only(block)
  if block.t ~= "Para" and block.t ~= "Plain" then return nil end
  local spans = pandoc.List()
  for _, el in ipairs(block.content) do
    if is_bookmark_span(el) then
      spans:insert(el)
    elseif el.t ~= "SoftBreak" and el.t ~= "Space" and el.t ~= "LineBreak" then
      return nil
    end
  end
  if #spans == 0 then return nil end
  return spans
end

-- Put `spans` at the start of the first text-bearing block inside `block`.
-- Returns true when they found a home.
local function prepend_into(block, spans)
  local t = block.t
  if t == "Para" or t == "Plain" or t == "Header" then
    local c = pandoc.List()
    c:extend(spans)
    c:extend(block.content)
    block.content = c
    return true
  elseif t == "BulletList" or t == "OrderedList" then
    local first = block.content[1]
    return first ~= nil and first[1] ~= nil and prepend_into(first[1], spans)
  elseif t == "BlockQuote" or t == "Div" then
    return block.content[1] ~= nil and prepend_into(block.content[1], spans)
  elseif t == "Table" then
    local rows = (block.head and block.head.rows) or {}
    local row = rows[1]
    if not row and block.bodies[1] then row = block.bodies[1].body[1] end
    local cell = row and row.cells[1]
    if cell and cell.contents[1] then return prepend_into(cell.contents[1], spans) end
    return false
  end
  return false
end

function Blocks(blocks)
  local out = pandoc.List()
  local pending = nil
  for _, b in ipairs(blocks) do
    local spans = anchor_only(b)
    if spans then
      pending = pending or pandoc.List()
      pending:extend(spans)
    elseif b.t == "RawBlock" then
      -- dropped by the docx writer; keep pending anchors for the next block
    elseif pending then
      if prepend_into(b, pending) then
        out:insert(b)
      else
        out:insert(pandoc.Para(pending))
        out:insert(b)
      end
      pending = nil
    else
      out:insert(b)
    end
  end
  if pending then out:insert(pandoc.Para(pending)) end
  return out
end

-- Inlines must run before Blocks (the Blocks pass looks for the Spans).
return {
  { Inlines = Inlines },
  { Blocks = Blocks },
}
