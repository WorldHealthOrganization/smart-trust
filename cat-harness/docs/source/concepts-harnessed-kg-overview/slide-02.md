WHO's public-health information is split between literature repositories, **IRIS**
(DSpace), and structured indicators in the **World Health Data Hub**. Unifying
them into one knowledge graph needs a platform with room to grow to about
**10 TB**, with high throughput and without high network costs.

| problem | proposed answer |
|---|---|
| Egress fees make serving 10 TB globally unpredictable | a zero-egress public CDN holding signed static assets |
| Automated traffic, above all in emergencies, can overload internal systems | decouple: an internal secure origin, published snapshots outside it |
| Authenticity and chain of custody in an era of AI-generated content | sign every published asset (WHO Trust Network gateway) |

The architecture drawn on the slide runs in three stages. An internal secure
origin (IRIS and the Data Hub) feeds an automated compile engine: folio-assistant
builds, signs, snapshots and publishes. That engine feeds a public CDN, named on
the slide as Cloudflare R2 storage and the Cloudflare edge network.

<a href="{{ '/assets/img/kg-deck/img-p002-1.webp' | relative_url }}"><img src="{{ '/assets/img/kg-deck/img-p002-1.webp' | relative_url }}" alt="Infographic titled &quot;WHO Decoupled Architecture Workflow — secure, automated, trusted, globally accessible&quot;, in three columns joined by arrows. Left, &quot;Internal secure origin — trusted WHO data sources&quot;: Internal IRIS (DSpace), the WHO institutional repository, and the World Health Data Hub, global health datasets and resources. Middle, &quot;Automated compile engine — build, sign, snapshot, publish&quot;: folio-assistant (auto-sign and snapshot), feeding &quot;Cryptographic asset signing&quot; via the WHO Trust Network Gateway and Swiss Observatory schemas. Right, &quot;Zero-egress public CDN&quot;: Cloudflare R2 storage (10 TB) of signed static assets, then the Cloudflare CDN edge network for global low-latency delivery, reaching global researchers. The product names are the slide&#x27;s proposal, not a decision recorded in this repository." loading="lazy"></a>

**Sources:** [`kg-to-portal`]({{ '/reference/skill-instructions/kg-to-portal.html' | relative_url }})
(package and per-asset signatures; "a CDN is a LAYER");
`large-datasets` (the WHO IRIS source descriptor); the IRIS replica (the DSpace skill).

> **Misaligned — proposal, not decision:** the repository treats the CDN as a
> swappable layer. `kg-to-portal` and `large-datasets`' artifact store name
> Cloudflare and R2 only as examples beside GitHub Pages, jsDelivr and S3. The
> slide names Cloudflare as *the* choice. The 10 TB figure, the World Health
> Data Hub and "Swiss Observatory schemas" appear nowhere else in the
> repository. The choice is **proposed, with no outcome yet**, between three
> options (Cloudflare R2 + CDN, GitHub Pages alone, another object store + CDN),
> and what has to be measured comes before one is chosen. Read this slide as
> that proposal.
