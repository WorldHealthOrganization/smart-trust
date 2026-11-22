---
doc_id: 10665-360948
doc_title: "PERSON-CENTRED HIV STRATEGIC INFORMATION"
section_id: sec-134-526-phylogenetics
section_title: "Phylogenetics"
section_number: 5.2.6
pages: 239-241
source_pdf: 10665-360948.pdf
source_sha256: 2647e4d36f0be148
toc_source: outline
---
In recent years the use of molecular epidemiology to reconstruct viral transmission networks 
has been recognized widely as a tool for successful interventions to curtail outbreaks of 
infection. This approach forms an explicit part of the Ending the Epidemic programme in the 
USA (https://www.cdc.gov/endhiv/index.html). Recent studies published by the Centers for 
Disease Control and Prevention (CDC) demonstrate the effectiveness of sequence analysis 
for outbreak monitoring and for the identification of clusters representing recent and rapid 
transmissions (103, 104). Where HIV Drug Resistance surveillance is in place, phylogenetic 
analysis of the genotype data generated can add to the repertoire of surveillance activities. 
In resource-limited settings, however, the availability of HIV drug resistance testing and 
phylogenetic testing may be limited, and, therefore, its feasibility and scope may be narrower. 
Analysis of sequence relatedness allows rapid determination of linkage among incident 
infections and between them and prevalent cases. For a given incidence, closer linkage 
between new infections indicates expanding outbreak(s) within the population and so provides 
information useful for targeting interventions. In addition, where genotyping is performed 
before ART is started, clusters of transmitted drug resistance indicate treatment failures that 
may have gone undetected, with implications for the ART regimens that are used.
Phylogenetic analysis brings with it an inherent concern for data security due to the potential 
to identify individuals associated with transmission events. In all settings where it is 
considered, all data must be anonymized sufficiently that they cannot be reconstructed to an 
individual level. 
This requires robust security protocols for analysing and reporting phylogenetic data, which 
should include additional pseudonymization on top of that employed with routine surveillance 
data. This would ensure that metadata are not automatically linked to the sequences and so 
would minimize risks of deductive disclosure. Members of key populations are particularly 
vulnerable to threats from data breaches where information related to HIV clusters and/or 
criminalized behaviours could be used by law enforcement officers and others. Therefore, if 
phylogenetic analysis is planned, the applicable legal framework should be considered and 
data security arrangements should be carefully assessed to ensure that, should the results 
generated be accessed, it will not be possible to identify individuals. In addition, consultations 
with the affected community are strongly encouraged.
Tools
To provide useful interpretations of phylogenies for surveillance, software tools have been 
developed that can be adapted to the specific setting where they are employed. One such is 
Cluster Picker (https://hiv.bio.ed.ac.uk/software.html and available from https://github.com/
emmahodcroft/cluster-picker-and-cluster-matcher/tree/master/release) (105). This is a graphical 
user interface-operated tool that will take a phylogeny generated from, for example, IQ-Tree, 
RaXML or FastTree and output clusters with user-defined characteristics. For surveillance 
purposes these would typically be sequences that formed a close cluster of HIV, often defined 
as within a genetic distance of 1.5%. Historic context can be included by expanding the 
threshold of the relationship, and for this purpose a value of 4.5% is often used. (See Box 5.2 
for an example of the use of Cluster Picker to detect an expanding cluster.) 
For rapid analysis of large datasets, an alternative tool is available: HIV-TRACE (https://github.
com/veg/hivtrace) (106, 107). This tool avoids the need for generating an initial phylogeny, is 
extremely rapid and can be linked to surveys of large databases, such as the Los Alamos HIV 
Sequence Database, to reveal linkage outside the surveyed region. It uses the single-linkage 
algorithm to cluster sequences, which is fast to compute.
Finally, MicrobeTrace is a web-based software package for network analysis made available 
by the CDC (microbetrace.cdc.gov) (108). Its sequence analytics tool uses the same approach 
as HIV-TRACE and allows rapid integration, visualization and analysis of data from multiple 
sources to generate genetic networks. MicrobeTrace can readily be used to discover and display 
network relationships between patients, and the extensive documentation makes it an intuitive 
tool to investigate HIV outbreaks that does not require specific bioinformatics skills. 
Box 5.1 Phylogenetic surveillance of cluster growth 
Clusters that are identified in a particular sample year can be re-evaluated in later years 
to identify those that are growing and, therefore, represent targets for intervention. 
A
B
0.03
0.03
C
D
E
F
A
L
K
J
I
G
F
E
D
C
B
G
In this figure a cluster of seven individuals identified in the first sample (on the left) is 
expanded by the addition of four new individuals, I – L, in a sample taken two years 
later (on the right). 
Source: adapted from Ragonnet-Cronin et al., 2013 (105).
