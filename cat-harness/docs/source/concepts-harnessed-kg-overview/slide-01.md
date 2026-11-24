WHO envisions a future where everyone in the world benefits fully and
immediately from clinical, public health and data-use recommendations. SMART
Guidelines systematize and accelerate the consistent application of recommended,
life-saving interventions in the digital age.

<p class="kg-deck-actors"><img src="{{ '/assets/img/kg-deck/img-p001-1.webp' | relative_url }}" alt="" height="110" style="height:110px;width:auto;display:inline-block;vertical-align:middle" loading="lazy"> <img src="{{ '/assets/img/kg-deck/img-p001-2.webp' | relative_url }}" alt="" height="110" style="height:110px;width:auto;display:inline-block;vertical-align:middle" loading="lazy"> <img src="{{ '/assets/img/kg-deck/img-p001-14.webp' | relative_url }}" alt="" height="110" style="height:110px;width:auto;display:inline-block;vertical-align:middle" loading="lazy"></p>

| level | | what it produces | on the slide |
|---|---|---|---|
| **L1** Narrative | WHO guideline publications | a knowledge graph of literature and data sources | <a href="{{ '/assets/img/kg-deck/img-p001-3.webp' | relative_url }}"><img src="{{ '/assets/img/kg-deck/img-p001-3.webp' | relative_url }}" alt="Three overlapping covers of WHO guideline publications — among them intrapartum care for a positive childbirth experience, the Package of Essential Noncommunicable (PEN) Disease Interventions, a family-planning handbook and antenatal care for a positive pregnancy experience. On this slide it stands for SMART Guidelines layer L1, the narrative guideline." height="48" style="height:48px;width:auto;display:inline-block;vertical-align:middle" loading="lazy"></a> |
| **L2** Operational | the Digital Adaptation Kit | structured requirements | <img src="{{ '/assets/img/kg-deck/img-p001-5.webp' | relative_url }}" alt="Blue outline icon of a clipboard holding a checklist of five items. On this slide it marks structured requirements, the L2 operational layer (the Digital Adaptation Kit)." height="40" style="height:40px;width:auto;display:inline-block;vertical-align:middle" loading="lazy"> <img src="{{ '/assets/img/kg-deck/img-p001-6.webp' | relative_url }}" alt="A small, generic blue flowchart — rectangles, two decision diamonds and connecting arrows — standing for the business processes and decision logic of an L2 Digital Adaptation Kit." height="40" style="height:40px;width:auto;display:inline-block;vertical-align:middle" loading="lazy"> <img src="{{ '/assets/img/kg-deck/img-p001-10.webp' | relative_url }}" alt="Small teal circular icon of a person holding a document or card — a health worker or client persona marker." height="40" style="height:40px;width:auto;display:inline-block;vertical-align:middle" loading="lazy"> |
| **L3** Machine readable | FHIR implementation guides | fully computable assets | <img src="{{ '/assets/img/kg-deck/img-p001-13.webp' | relative_url }}" alt="The HL7 FHIR logo (orange-red flame and the word FHIR), marking the L3 machine-readable layer&#x27;s standard." height="32" style="height:32px;width:auto;display:inline-block;vertical-align:middle" loading="lazy"> <img src="{{ '/assets/img/kg-deck/img-p001-11.webp' | relative_url }}" alt="Blue icon of a desktop monitor showing lines of text beside two gears — configurable or computable software, marking the fully-computable-assets step." height="40" style="height:40px;width:auto;display:inline-block;vertical-align:middle" loading="lazy"> <a href="{{ '/assets/img/kg-deck/img-p001-12.webp' | relative_url }}"><img src="{{ '/assets/img/kg-deck/img-p001-12.webp' | relative_url }}" alt="Screenshot of FHIR XML from a MeasureReport: type summary, a measure URL for HIV indicators, a reporter, a period in January 2018, and a group with coded strata and measureScore values. It illustrates the L3 machine-readable layer: an indicator expressed as FHIR." height="40" style="height:40px;width:auto;display:inline-block;vertical-align:middle" loading="lazy"></a> |
| **L4** Executable | reference software | customizable software | <img src="{{ '/assets/img/kg-deck/img-p001-7.webp' | relative_url }}" alt="Blue icon of a desktop monitor and a mobile phone, each displaying a caduceus (the medical staff-and-serpents emblem). On this slide it stands for customizable health software built from the guideline — the L4 executable layer." height="40" style="height:40px;width:auto;display:inline-block;vertical-align:middle" loading="lazy"> <img src="{{ '/assets/img/kg-deck/img-p001-9.webp' | relative_url }}" alt="A cropped variant of the blue monitor-and-phone icon showing caduceus emblems, used as a second marker for executable, deployable software." height="40" style="height:40px;width:auto;display:inline-block;vertical-align:middle" loading="lazy"> <a href="{{ '/assets/img/kg-deck/img-p001-8.webp' | relative_url }}"><img src="{{ '/assets/img/kg-deck/img-p001-8.webp' | relative_url }}" alt="Screenshot of a DHIS2 web application (the red DHIS2 header bar is visible): a patient or event record form with a table of dated entries below it and side panels on the right. Text is too small to read at slide size. It illustrates a deployed consumer application built on SMART content." height="40" style="height:40px;width:auto;display:inline-block;vertical-align:middle" loading="lazy"></a> |
| **L5** Dynamic | trained, optimised algorithms | advanced analytics for precision health | <img src="{{ '/assets/img/kg-deck/img-p001-4.webp' | relative_url }}" alt="Blue icon: a desktop monitor and a tablet, each showing a human head in profile with a circuit-board brain. On this slide it marks advanced analytics — the L5 dynamic layer&#x27;s precision-health use." height="40" style="height:40px;width:auto;display:inline-block;vertical-align:middle" loading="lazy"> |

**What spans which levels.** Under the five levels the slide draws four bars,
and each bar's reach is part of what the slide says. Read from the slide's
geometry, not its text:

<table class="kg-deck-spans">
<caption>Bars under the SMART levels on slide 1: each cell spans the levels its bar covers.</caption>
<thead><tr><th scope="col">bar</th><th scope="col">L1</th><th scope="col">L2</th><th scope="col">L3</th><th scope="col">L4</th><th scope="col">L5</th></tr></thead>
<tbody>
<tr><th scope="row">content</th><td colspan="3">content: L1 to L3</td><td></td><td></td></tr>
<tr><th scope="row">test data</th><td></td><td colspan="3">test data: L2 to L4</td><td></td></tr>
<tr><th scope="row">tooling</th><td></td><td></td><td colspan="2">tooling: L3 and L4</td><td></td></tr>
<tr><th scope="row">apps</th><td></td><td></td><td></td><td>apps: L4</td><td></td></tr>
</tbody>
</table>

**No bar reaches L5.**

Two questions sit at the two ends of the band. **How can I reliably author,
review and adjudicate faster?** is drawn on the left, over L1, beside the human
actor (the cat at the laptop). **How am I verifiable?** is drawn on the right,
over L5, beside the agentic actor (the robot cat). The slide pairs each question
with an actor by position only; it states no pairing in words.

**Sources:** [WHO SMART content types — the five layers](https://litlfred.github.io/folio-assistant/smart-base/concepts/who-smart-content-types.html#the-three-layers);
the DAK layer's `library/mehl-2021-who-smart-guidelines` (the primary source, Lancet
Digital Health 2021); the DAK layer's `library/9789240093362-eng` §1.2 (WHO's handbook
restating them).
