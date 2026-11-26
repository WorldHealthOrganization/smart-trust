---
doc_id: 10665-353150
doc_title: "Guide d’investissement pour la mise en oeuvre numérique (DIIG) : intégrer les interventions numériques dans les programmes de santé"
section_id: sec-041-57-stratégie-nationale-en-matière-de-santé-numér
section_title: "Stratégie nationale en matière de santé numérique et plan d'investissement"
section_number: 5.7
pages: 91-93
source_pdf: 10665-353150.pdf
source_sha256: a3a569001e34bbfd
toc_source: inferred
---
et plan d'investissement
Déterminez si vous disposez d'une stratégie nationale en matière de santé numérique ou de santé en 
ligne, et passez en revue les priorités, les politiques et les aspects opérationnels pour établir les domaines 
d'harmonisation et les différences. La stratégie de santé numérique peut détailler les politiques actuelles et les 
différents facteurs favorables, qui sont essentiels pour comprendre l'état de préparation de l'environnement 
national à la prise en charge de nouvelles applications de santé numérique. Identifiez également si un processus 
national de planification des investissements a été mené, détaillant l'état, la fonctionnalité, la maturité et 
l'inventaire de l'entreprise nationale de santé numérique, ainsi que tout plan pour de futurs investissements en 
santé numérique qui pourraient répondre à vos besoins.
ÉTUDE DE CAS
mHero - utiliser des normes de données pour intégrer efficacement 
différentes interventions de santé numérique
mHero combine trois technologies (le logiciel iHRIS d'IntraHealth, RapidPro de l'UNICEF et OpenHIM de Jembi) 
en un puissant outil de communication pour le ministère et les professionnels de santé (90). 
iHRIS est un logiciel libre de système d'information sur le personnel de santé utilisé pour saisir et conserver des 
informations pour la planification, la gestion, la réglementation et la formation du personnel de santé. RapidPro 
est une plateforme open source permettant de construire un système de messagerie interactif. OpenHIM est un 
niveau d'interopérabilité pour les échanges d'informations sanitaires conformes aux normes, comme OpenHIE.
L'outil combiné, mHero, permet au ministère de la Santé d'envoyer instantanément des informations aux 
téléphones portables des professionnels de santé et permet à ces derniers de renvoyer des informations 
urgentes aux responsables du ministère. Cela s'est fait par l'adoption rigoureuse de normes internationales 
ouvertes, telles que HL7 FHIR, pour l'échange de données de santé, sur la base du cadre OpenHIE. Grâce 
à ces normes, les informations relatives aux professionnels de santé peuvent être extraites du registre du 
personnel de santé (iHRIS), puis utilisées par le système de messagerie RapidPro pour communiquer de manière 
transparente avec les professionnels de santé du pays (voir Schéma 5.6.2). Par exemple, les informations sur 
l'établissement de santé associé au professionnel de la santé pourraient être utilisées pour cibler les messages 
destinés aux professionnels de la santé. De plus, l'approche fondée sur les logiciels open source et les normes 
ouvertes signifie que la plateforme mHero ne dépend d'aucun logiciel spécifique, ce qui permet aux ministères 
de la Santé d'intégrer facilement mHero dans leur SIS.
Schéma 5.6.2. 	Comment mHero intègre les interventions de santé numérique en utilisant 
des normes.
Source : IntraHealth International, 2017 (90).
ÉTAT DE LA SITUATION ACTUEL
NIVEAU D'INTEROPÉRABILITÉ
composants favorables
APPLICATIONS DE SANTÉ NUMÉRIQUE AVEC DES INTERVENTIONS NUMÉRIQUES POUR : 
Programmes de santé/cas d'utilisation
Communication des 
professionnels de santé
Cas d'utilisation
Programme de santé
Cas d'utilisation
A
B
C
D
SYSTÈMES EXTERNES
SERVICES PARTAGÉS
SERVICES DE 
DONNÉES
SOURCES DE 
DONNÉES
Services 
d'informations 
sanitaires et sources 
de données basés 
sur l'institution
Services 
d'informations 
sanitaires et sources 
de données basés 
sur la population
Analytiques, 
tableaux de bord, 
outils, recueils 
Plateforme de santé numérique
Services partagés
Services du domaine 
commercial
Services d'enregistrement
ENTREPRISE
REGISTRE INTERCONNECTÉ
Données relatives  
à l'établissement
Données relatives 
au matériel
REGISTRE DE 
L'ÉTABLISSE-
MENT
Applications de point de service
CHAPITRE 
06
ASSOCIER LA MISE EN ŒUVRE DE LA 
SANTÉ NUMÉRIQUE À L'ARCHITECTURE 
D'ENTREPRISE
Au cours des chapitres précédents, vous avez développé un plan de mise en œuvre de la 
santé numérique axé sur l'abordage des défis identifiés liés au système de santé, avec une 
compréhension claire des interventions de santé numérique et des autres fonctionnalités 
requises. Pour transformer cette mise en œuvre complexe de la santé numérique en une 
architecture du système de santé numérique interchangeable, il faut aussi considérer les 
coûts et les exigences de mise en œuvre qui vous permettraient de bénéficier de manière 
cohérente de et de supporter l'entreprise de santé numérique globale, tout en évitant les 
faux pas associés à l'investissement dans des systèmes numériques fragmentés ou des 
applications logicielles complexes qui essaient de tout faire.
OUTILS
	+ Diagramme OpenHIE (Schéma 6.3.2)
	+ Blocs de construction de l'architecture TOGAF (Annexe 6.1) 
	+ Liste illustratrice des composants communs 
OBJECTIFS
