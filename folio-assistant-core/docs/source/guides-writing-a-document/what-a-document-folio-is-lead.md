Everything a paper folio is, minus the formal layer. The same tree of chapters
and sections over typed **blocks**, the same editorial `uses[]` graph, the same
QA sidecars, the same HCI validation gate, the same publication pipeline.

What it does not have is the seven block kinds whose assertion is a formal
mathematical claim — and therefore neither of the two toolchains that serve
them. No Lean. No LaTeX.

> **A paper is a document plus Lean-bearing blocks.** `PaperContentAdapter`
> extends `DocumentContentAdapter` in code, and adds the Lean lifecycle and the
> LaTeX renderer on top, so a feature "the paper adapter has" is usually
> already here.
