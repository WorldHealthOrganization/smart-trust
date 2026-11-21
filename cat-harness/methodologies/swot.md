---
$schema: folio-methodology/v1
name: swot
title: SWOT — situation analysis over internal and external factors
origin: >
  Rendered from two ingested sources. Gürel, E. & Tat, M. (2017), "SWOT
  Analysis: A Theoretical Review", *The Journal of International Social
  Research* 10(51), pp. 994–1006, doi:10.17719/jisr.2017.1832 — a theoretical
  review, carrying the history, the variants and the criticism. And
  Sammut-Bonnici, T. & Galea, D. (2015), "SWOT Analysis", *Wiley Encyclopedia
  of Management* vol. 12 (Strategic Management),
  doi:10.1002/9781118785317.weom120103 — a reference chapter, carrying the
  conceptual framework and the practical discipline. The METHOD's own origin is
  contested and neither source settles it — see §"Where the method came from,
  and why that is not a settled question".
evidence:
  - library/gurel-tat-2017-swot-analysis
  - library/sammut-bonnici-galea-2015-swot-analysis
applies-when: >
  **Situation analysis, before a decision — never instead of one.** Use it to
  assemble what is true about a subject's internal attributes and its external
  environment, when the point is to see the field whole rather than to choose
  between candidate options. Not for choosing: a one-off choice among options is
  `kepner-tregoe`, a recurring rule is `dmn`, certainty of evidence behind a
  health recommendation is `grade`, and the record of whatever is decided is
  `madr`. SWOT produces the INPUT to those; it is not a substitute for any of them.
---

# SWOT — the two axes, and what the method refuses to do

**Adopted 2026-09-22 from two ingested sources.** Unlike the other
methodologies here, SWOT has no standards body and no canonical text, so
"adopted whole" has to mean something narrower: this file renders *secondary*
sources faithfully, and says so everywhere it matters. Where this text and a
source differ, the source is right and this file is wrong.

| source | what it carries | ingested |
|---|---|---|
| Gürel & Tat (2017), theoretical review, 13pp | the history, the variants, the criticism, a worked example | `library/gurel-tat-2017-swot-analysis` (opt-in `cat-harness.library`) |
| Sammut-Bonnici & Galea (2015), *Wiley Encyclopedia of Management*, 9pp | the conceptual framework, the resource-based internal analysis, the practical discipline | `library/sammut-bonnici-galea-2015-swot-analysis` |

**These are the first methodology sources in this repository a reader can
actually open** — the other four adopted methodologies still cite origins that
resolve against nothing.

**They agree on the method and differ in coverage**, which is why both are
cited rather than one chosen. Where they overlap — the two axes, the
internal/external split, the attribution of the matching matrix to Weihrich,
and the judgement that SWOT only *starts* an analysis — they say it
independently, and two independent statements are worth more than either
alone. Where only one covers something, this file says which.

## The method

SWOT crosses **two axes**, and the whole technique is those two axes:

|  | helpful | harmful |
|---|---|---|
| **internal** — attributes of the organisation | **S**trengths | **W**eaknesses |
| **external** — attributes of the environment | **O**pportunities | **T**hreats |

The internal/external split is the load-bearing one. Gürel & Tat's definitions,
verbatim in substance:

- **Organizational strengths** — characteristics that give advantage over others
  in the industry.
- **Organizational weaknesses** — characteristics that place the organisation at
  a disadvantage relative to others.
- **Environmental opportunities** — external elements that give benefits for the
  organization.
- **Environmental threats** — external elements that could cause trouble for it.

### TOWS is the step that makes it produce something

Weihrich (1982) argued the only logical starting point is **opportunities and
threats**, because they are outside the organisation and largely beyond its
control, and must be managed using its strengths and weaknesses. The matching
matrix that follows is where the four lists become strategy:

|  | strengths | weaknesses |
|---|---|---|
| **opportunities** | **SO** — achieve opportunities that greatly match the strengths | **WO** — overcome weaknesses to attain opportunities |
| **threats** | **ST** — use strengths to reduce vulnerability to threats | **WT** — prevent weaknesses, to avoid becoming more susceptible to threats |

**Both sources attribute this matrix to Weihrich, independently.** Gürel & Tat
report his 1982 argument for renaming SWOT to TOWS; Sammut-Bonnici & Galea call
the matrix "Weihrich's TOWS Matrix" and describe it as "an adaptation of the
SWOT Analysis" identifying tactical strategies. Two secondary sources agreeing
on an attribution is not proof, but it is the strongest thing available here,
and it is a different epistemic position from the *origin* question below,
where one source explicitly reports the attribution as unsupported.

**TOWS is one node with SWOT here, not a second methodology.** Both sources
present it as SWOT reordered plus the matching step — a development of the
technique, alongside Dealtry's Dynamic SWOT and Wheelen & Hunger's SFAS/EFAS/IFAS
tables — not as an independent method with its own origin. Splitting them would
mint a methodology that cites nobody for the half that does the work. *If the
owner reads TOWS as separable, this is the seam to cut on.*

## Where the method came from, and why that is not a settled question

**Faithfulness matters more here than anywhere else in this file, because the
usual story is repeated everywhere and the source declines to endorse it.**

Gürel & Tat report that the origin of SWOT is **uncertain**. Albert S. Humphrey
(2005) described a research project at Stanford Research Institute running
1960–1970, with a team including Marion Dosher, Otis Benepe and Birger Lie. The
paper then states plainly that **literature review shows there are no academic
references supporting Humphrey's claim**, and that the emergence of SWOT is
usually associated instead with Philip Selznick and with the Harvard Business
School business-policy group of the 1960s.

**The second source does not settle it either, and its silence is the point.**
Sammut-Bonnici & Galea (2015) is a reference chapter in an encyclopedia of
management — exactly the kind of text that would state an origin if one were
settled — and it gives none. It opens on the conceptual framework and never
says where SWOT came from. So the second source neither corroborates nor
contradicts Humphrey: it declines to enter the question.

That is worth recording rather than reading as agreement. An unbacked
attribution and an attribution nobody chose to make are different states, and
collapsing them would turn one source's explicit "no academic references
support this" into a consensus that does not exist.

So: **this file does not assert who invented SWOT.** An adopted methodology that
launders a contested attribution into a flat statement of fact is exactly the
failure an evidence base exists to prevent — and it would be this repository's
"a count in prose is a claim rather than evidence" rule, applied to a citation.

## What only the encyclopedia chapter carries

Four things Sammut-Bonnici & Galea supply that the review does not, each of
which changes how a scan should be *run* rather than what SWOT is.

**The internal axis rests on the resource-based view.** Resources (tangible and
intangible inputs) combine into capabilities (the capacity to use them
efficiently), which create core competences, which create competitive
advantage. So a strength is not "something we are good at" — it is a link in
that chain, and a scan that lists attributes without it produces a list nobody
can act on.

**A factor can be a basic requirement rather than a strength**, and this is the
most practically useful thing either source says. Their example: high standards
of cleanliness and hygiene are intrinsically good, but in a back-office
operation they contribute nothing to competitive advantage, while in catering,
pharmaceutical manufacture or hospitals they are compulsory — and being
compulsory makes them a *requirement*, not a strength. The test they give is
comparison against competitors: an attribute is a strength only relative to
what others have.

**Cognitive inertia is a named failure mode of the external axis.** Strategists
read their environment through cognitive maps built from personal experience,
and individual and collective maps within an industry "can be indifferent to
significant economic indicators and market signals during a time when an
industry is changing rapidly". Unless refreshed by regular review of incoming
information, it "can lead to the decline of an organization". The review paper
names bias in the internal listing; this names the mechanism on the external
side, which is the half nobody thinks to distrust.

**Resource similarity and coopetition.** Where competitors hold near-identical
resources — the same suppliers, the same technology providers, managerial skill
from a common pool — they tend to similar strategies and toward *coopetition*,
collaborative competition that grows the industry rather than market share.
Their worked case is mobile network operators. It matters to a scan because a
"strength" shared by the whole industry is not a strength at all, which is the
same test as the hygiene example arriving from the other direction.

**And it states the refusal in its own words.** SWOT "is good at drawing a
picture of the current internal and external state of affairs, but it does not
necessarily provide a guide to the strategic action" — it is "a descriptive
tool", "not a prescriptive tool that determines the nature of strategic
planning". Two independent sources reaching that conclusion is the reason the
refusal below is stated as firmly as it is.

## What this platform adopts, and what it refuses

`methodology-adoption` requires both halves, with reasons. Both are below.

### Adopted

- The **two axes** and the four quadrants, as the structure of a situation scan.
- The **internal and external checklists** as prompts for what to look at — the
  source gives them by business function (marketing, R&D, management information
  systems, management team, operations, finance, human resources) and by category
  of external change (societal, governmental, economic, competitive, supplier,
  market).
- The **TOWS matching step**, because a SWOT that stops at four lists produces
  nothing actionable, which is the source's own central criticism of it.
- Its **applicability at any level** — the source explicitly covers individual,
  organizational, national and international levels, and non-profit, educational
  and governmental use.

### Refused, and why

**SWOT must never be used here to decide anything.** This is the refusal that
matters, and it comes straight from the source's conclusion: SWOT gives managers
"the raw material needed to perform more in-depth strategic analysis", but
"cannot show them how to achieve a competitive advantage", and must not become
"an end in itself, temporarily raising awareness about important issues but
failing to lead to the kind of action steps necessary". Gürel & Tat's stated
limitations, each of which is a reason this platform keeps deciding elsewhere:

- **Listing is prone to bias.** Writing strengths on paper "is very different
  from testing the organization and experiencing the strengths at work", and the
  content "may be unreliable, all bound up with aspirations, biases, and hope of
  the individuals involved".
- **It cannot prioritise.** Many factors can be identified, but "quantity does
  not mean quality": SWOT provides no way to rank the factors it lists. That is
  precisely the gap `kepner-tregoe` fills with MUSTs and WANTs, and a table fills
  with `dmn`.
- **Categorisation is genuinely ambiguous.** "The same factor can be fitted in
  two categories. A factor can be a strength and a weakness at the same time."
  Strengths not maintained become weaknesses; opportunities not taken, but taken
  by competitors, become threats.
- **It is a one-shot view of a moving target** — "primarily a static assessment
  … like studying a single frame of a picture", developed when "environmental
  conditions were still".
- **Strengths may not lead to an advantage**, however unique or impressive.
- **It is rarely deployed below the organisation level**, so one scan can drive
  wrong strategies across units for which its factors do not hold equally.
- Hill and Westbrook (1997) go further and hold that the technique "expired long
  ago". The source reports this rather than endorsing it, and so does this file.

**Not adopted: the quantitative extensions.** The source lists a long series of
attempts to give SWOT a numeric backbone — AHP, ANP, their fuzzy variants,
SMART, SMAA-O, MADM, TRIZ, evidential reasoning, contrast mining, and others.
None is adopted here. Each is a separate methodology with its own literature,
and pulling one in to patch SWOT's ranking problem would be the composite this
repository's `methodology-adoption` forbids: "this one's vocabulary, that one's
record, a third one's filter" is a house method that cites nobody. **When ranking
is needed, use a methodology adopted for ranking.**

## Where the rendering stops

- **Two secondary sources, no primary texts.** Humphrey (2005), Weihrich (1982),
  Dealtry (1992), Wheelen & Hunger (1998), Hill & Westbrook (1997), Mintzberg
  (1990), Dess et al. (1997), Sirmon et al. (2010), Ip & Koo (2004) and the rest
  are read *through* one of the two. None of their own papers is in any library
  here, so **every attribution above is second-hand and is marked as such.**
  Where the two sources say the same thing, this file says they agree; it does
  not promote agreement between two secondaries into a primary finding.
- **The worked examples are not rendered.** Gürel & Tat work a full SWOT for an
  international sportswear brand; Sammut-Bonnici & Galea work a coopetition case
  for mobile network operators. Both are in the ingested pages; neither is
  repeated here, because a worked example of somebody else's commercial
  analysis is not guidance.
- **The encyclopedia chapter's own figures are NOT in its image set.** Its
  templates and its Figure 5 TOWS matrix are drawn as vector content, so
  `pdf-images` placed only four raster images and all four are ResearchGate
  cover-page furniture — two project icons, an author thumbnail, a placeholder
  avatar. Recorded because an image set of four decorative items could
  otherwise read as "this chapter has no figures", which is false. The figures
  are in the page text.
- **No step-by-step procedure is invented.** Neither source gives one: the first
  is a theoretical review, the second a reference chapter offering "a toolkit of
  templates" rather than an ordered method. The executable process beside this
  file (`processes/process/swot-analysis.bpmn`) draws only the sequence the sources
  themselves state — scan external, scan internal, pool, cross, hand off — and
  **adds no step neither source supports.**
