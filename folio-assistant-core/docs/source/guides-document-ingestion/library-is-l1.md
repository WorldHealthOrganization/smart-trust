Anything under `library/` is **L1 source content**. Any knowledge-graph
reference to a source — from a paper, an L2 DAK, an L3 IG, or any other
artefact — resolves to it **through `library/`**, never to a loose path or a
bare URL.

A bibliography entry may point at a **remote** asset rather than a local
binary. That lives in a sibling `assets[]` field carrying kind / role /
url-or-path / checksum / retrieved — **not** inside `library:`, because
`LibraryRef` is regenerated from the tree on every sync and an authored URL
placed there is silently dropped.
