---
doc_id: 10665-353150
doc_title: "Guide d’investissement pour la mise en oeuvre numérique (DIIG) : intégrer les interventions numériques dans les programmes de santé"
section_id: sec-044-62-identifier-les-composants-communs-et-favorabl
section_title: "Identifier les composants communs et favorables et les services partagés (plateforme de santé numérique)"
section_number: 6.2
pages: 98-103
source_pdf: 10665-353150.pdf
source_sha256: a3a569001e34bbfd
toc_source: inferred
---
les services partagés (plateforme de santé numérique)
Lorsque vous associez la mise en œuvre de la santé numérique à l'architecture d'entreprise de santé numérique 
globale, envisagez les fonctionnalités (ou composants) essentielles et uniques à votre cas d'utilisation ou 
programme de santé, ainsi que les composants qui peuvent être généralisés et réutilisés dans d'autres domaines du 
programme de santé ou au-delà du secteur sanitaire. Ces composants communs (également désignés composants 
réutilisables) représentent des opportunités d'investissement joint, vous permettant d'assembler et d'harmoniser 
différentes interventions de santé numérique à travers les domaines, et même les secteurs, du programme, tout 
en simplifiant également l'établissement d'une architecture commune dont toutes les mises en œuvre de santé 
numérique peuvent bénéficier (voir Schéma 6.2.2). Envisagez ces composants communs comme des routes ou des 
canalisations (« construire une fois, utiliser plusieurs fois ») dont vous aurez probablement besoin pour la mise en 
œuvre de la santé numérique, et dont les autres personnes auront aussi besoin et auxquels elles peuvent contribuer 
collectivement et en bénéficier à partir d'adaptations et déploiements subséquents. Ces composants réutilisables 
peuvent aussi être utilisés en dehors du secteur sanitaire, comme celui de l'éducation et de la protection sociale, 
par exemple. L'ensemble des composants communs est désigné comme la plateforme de santé numérique et peut 
être sous-divisé en services partagés et composants favorables.
Vous pouvez aligner votre mise en œuvre de la santé 
numérique pour associer et partager ces composants 
communs, au fur et à mesure qu'ils deviennent disponibles 
dans l'architecture d'entreprise de santé numérique (14). 
Les normes et les API (interfaces de programmation 
d'applications), qui sont des codes et des logiciels qui 
permettent à deux programmes logiciels de communiquer 
entre eux, peuvent aider à associer la mise en œuvre de la 
santé numérique aux composants communs. 
Si ces composants ne font pas encore partie de votre 
configuration, vous pouvez attribuer une partie de votre 
investissement dans la santé numérique à l'établissement 
d'un composant commun, comme un service partagé 
que les autres domaines du programme de santé peuvent 
réutiliser postérieurement. Ni tous les composants 
communs nécessaires représentés dans le diagramme 
architectural seront disponibles au même moment. 
Souvent, les investissements sont effectués de manière 
séquentielle, au fur et à mesure que les fonds deviennent 
disponibles et que les besoins émergent. Par conséquent, 
la mise en œuvre de la santé numérique évoluera avec le 
temps grâce à la contribution des investissements ou à 
l'intégration de nouveaux composants, au fur et à mesure 
que l'écosystème de la santé numérique et l'architecture 
évoluent (14). 
Encadré 6.2.1.	Liste exemplaire des 
composants communs.
Voici quelques exemples de composants communs 
qui peuvent aussi être utilisés dans d'autres 
domaines de mise en œuvre :
	» services d'authentification pour déterminer 
l'accès et contrôler les privilèges ;
	» services de gestion de l'identité, tels que 
des identifiants uniques pour les clients, 
les professionnels de la santé et les 
établissements ;
	» services terminologiques et données de 
référence pour supporter les besoins en 
métadonnées, y compris des éléments de 
données et des indicateurs ;
	» services de géolocalisation ; 
	» services de paiement pour faciliter les 
transactions financières ; 
	» outils analytiques pour supporter les tableaux 
de bord et autres outils similaires ;
	» outils de planification et de prise de décisions 
logiques ;
	» stockage de données pour supporter le 
stockage et l'archivage à travers des formats 
de normes communes ;
	» service bus d'entreprise pour supporter la 
nature « interopérable » de l'échange des 
données.
Fig. 6.2.2. 	 Investissements dans la santé numérique dans le cadre de l'architecture d'entreprise  
de santé numérique. 
SERVICES PARTAGÉS
SERVICES DE DONNÉES
SOURCES DE DONNÉES
Services d'informations 
sanitaires et sources 
de données basés sur 
l'institution
Services d'informations 
sanitaires et sources de 
données basés sur la 
population
Analytiques, tableaux 
de bord, outils, recueils 
Plateforme de santé numérique
Services partagés
Services 
du domaine 
commercial
Services 
d'enregistrement
Services 
terminologiques
Registre du 
professionnel  
de la santé
Registre du client
Registre  
du produit
Registre de 
l'établissement
Système 
d'informations 
relatives à la gestion 
de la logistique
Dossier médical 
partagé
Système 
d'informations 
relatives à la 
gestion de la santé
Ensembles de 
données numériques 
et autres obtenues à 
partir de processus 
qui enregistrent 
systématiquement les 
informations au sein 
des institutions et des 
établissements de santé 
(par ex., disponibilité du 
service et évaluation 
de la rapidité (SARA, 
de l'anglais, Service 
Availability and 
Readiness Assessment))
Fournit des 
capacités, ou 
« services », 
de logiciel 
spécifiques à la 
prestation de 
soins de santé, 
qui peuvent 
être améliorées 
par d'autres 
applications 
de l'entreprise 
de santé 
numérique
Fournit des 
capacités, ou 
« services », 
de logiciel, qui 
sont des « listes 
» canoniques/
de référence 
et qui sont 
appliquées 
par des 
mécanismes de 
gouvernance 
spécifiques
Ensembles de données numériques et 
autres obtenues à partir de processus 
qui enregistrent systématiquement les 
informations sur les membres d'une 
population (par ex., recensement, 
enquêtes démographiques et de santé)
Outils de 
données utilisés 
pour simplifier la 
prise de décisions 
(par ex., système 
d'informations 
géographiques)
NATURE 
INTER- 
OPÉRABLE
Composants 
favorables
Fournit des capacités de logiciel pour supporter 
la gestion de l'échange de données et de 
l'interopérabilité entre les applications et les 
services de l'entreprise de santé numérique
APPLICATIONS AVEC DES INTERVENTIONS POUR :
Programme de santé
Cas d'utilisation
Programme de santé
Cas d'utilisation
A
B
C
D
Applications de point de service
Applications réutilisées dans plusieurs cas d'utilisation ou domaines du programme
Applications uniquement utilisées dans un seul cas d'utilisation ou domaine  
du programme de santé
Investissement 
dans un nouveau 
logiciel
Logiciel financé 
en cours de 
développement 
Investissement dans 
l'amélioration du 
logiciel 
Logiciel de 
désactivation 
Logiciel 
complètement 
fonctionnel financé 
Investissement dans 
l'échelonnement du 
logiciel fonctionnel
LÉGENDE
Application de 
point de service 
réutilisée
Application de 
point de service 
unique
ENTREPRISE
SYSTÈMES EXTERNES
Applications 
numériques, 
services, composants 
d'interopérabilité 
favorables et 
sources de données 
non associés à la 
santé avec des 
capacités pouvant 
être améliorées 
par l'entreprise de 
santé numérique 
(par ex., système 
d'identification unique 
national, systèmes 
d'approvisionnement 
nationaux, sources de 
données du service 
météorologique 
national, etc.)
6.3 	Associer vos investissements dans la santé 
numérique à l'architecture d'entreprise
Le présent guide ne constitue qu'un aperçu introductif de l'association des investissements dans la santé 
numérique, dans le cadre des programmes de santé, à l'architecture d'entreprise plus ample de santé numérique 
nationale. L'exécution de ce processus exigera des entretiens plus détaillés avec le personnel ayant des 
compétences de développement d'architectures d'entreprise de santé numérique nationales. L'Encadré 6.3.1 met 
en avant les principales ressources pouvant simplifier ce processus. 
Il est recommandé d'identifier ou développer un diagramme 
qui reflète l'état de la situation actuel de l'architecture 
d'entreprise de santé numérique nationale et d'inclure dans 
votre plan de mise en œuvre chiffré un diagramme détaillé 
de l'état de la situation futur qui montre les investissements 
proposés dans les services et applications numériques 
(consulter le Schéma 6.3.3 pour voir un exemple). L'état 
de la situation actuel illustre la façon dont les différents 
systèmes sont actuellement mis en œuvre : soit à travers 
des applications fragmentées et complexes, soit par une 
combinaison directe avec d'autres applications, dans le 
meilleur des cas. Dans le diagramme de l'état de la situation 
futur, mettez en avant les composants numériques planifiés 
nouveaux et émergents mis en œuvre par d'autres entités, 
ainsi que les fonctionnalités communes et spécifiques 
au programme sur lesquelles votre investissement dans 
la santé numérique se concentrera, tout en spécifiant 
les applications, les services communs et les critères 
d'interopérabilité que votre système améliorera ou auxquels 
il contribuera. L'Annexe 6.1 propose un modèle pour réfléchir 
à la façon dont il est possible d'associer la mise en œuvre 
de la santé numérique proposée aux critères architecturaux 
globaux.
Lorsque vous commencez à associer l'investissement 
dans la santé numérique à l'architecture globale et à 
planifier les éventuels coûts engendrés, considérez les 
questions suivantes.
	» Quels sont les composants fondamentaux de cette 
mise en œuvre de la santé numérique ?
	» Parmi ces composants fondamentaux, quels 
composants communs existants peuvent être 
réutilisés ou améliorés à partir d'autres domaines 
du programme de santé ? Par exemple, un 
outil analytique peut constituer un composant 
nécessaire déjà mis en œuvre par un autre domaine 
du programme et pouvant être réutilisé et partagé 
(par ex., en tant que service partagé).
	» Quels composants communs constituent des 
nouvelles exigences que l'investissement dans la 
santé numérique peut supporter et grâce auxquelles 
il peut contribuer à l'architecture d'entreprise de la 
santé numérique nationale ?
Les diagrammes illustratifs de l'état de la situation actuel 
et futur de l'architecture d'entreprise de santé numérique 
nationale de la Birmanie sont fournis comme référence (voir 
Schéma 6.3.3) et vous pouvez les utiliser pour schématiser 
les composants communs existants (vert, jaune) et planifiés 
(rouge, gris) de votre plan de mise en œuvre chiffré. Dans 
votre diagramme, notez l'utilisation d'applications de santé 
numérique spécifiques englobant les interventions de santé 
numérique au point de service, les services partagés et les 
composants favorables pour chacune des interventions de 
santé numérique identifiées.
Encadré 6.3.1. 	Ressources principales pour élaborer une architecture d'entreprise de santé 
numérique. 
	» Guide de la plateforme de santé numérique : l'élaboration d'une infrastructure d'informations numérique 
(infostructure) pour le domaine de la santé se concentre sur la combinaison d'interventions de santé 
numérique en un ensemble interopérable et l'identification des exigences de normes et d'interopérabilité, 
pour permettre une architecture d'entreprise de santé numérique cohérente (14).
	» L'OpenHIE décrit une structure architecturale réutilisable qui améliore les normes relatives aux informations 
sanitaires, permet une mise en œuvre flexible par les partenaires du pays et supporte l'échange de composants 
individuels (voir Schéma 6.3.2). L'OpenHIE sert également de communauté de mise en pratique globale qui 
supporte les pays dans le cadre d'un « développement ouvert et collaboratif et de support des architectures de 
partage des informations sanitaires à grande échelle, propulsées par le pays » (18).
	» Le TOGAF est une méthodologie d'architecture d'entreprise conforme aux normes du secteur qui fournit des 
orientations détaillées pour supporter l'établissement d'une hiérarchie d'entreprise, de données, d'applications et 
de technologies d'architecture flexibles et intégrées pour optimiser les interventions de santé numérique (92). 
Schéma 6.3.2.	Diagramme architectural OpenHIE illustrant les mécanismes pour 
l'interopérabilité entre différentes applications. 
Source : Schéma et légende adaptées de l'architecture v2 de l'OpenHIE, 2019 (93).
Services du domaine commercial
SYSTÈME 
D'INFORMATIONS 
RELATIVES À LA 
GESTION DE LA 
LOGISTIQUE
SERVICES 
TERMINOLOGIQUES
REGISTRE  
DU CLIENT
REGISTRE DE 
L'ÉTABLISSEMENT
REGISTRE DU 
PROFESSIONNEL 
DE LA SANTÉ
REGISTRE  
DU PRODUIT
DOSSIER  
MÉDICAL  
PARTAGÉ
SYSTÈME 
D'INFORMATIONS 
RELATIVES À  
LA GESTION DE  
LA SANTÉ
Authentification
Système 
mobile
Dossier  
médical  
électronique
Système 
d'informations 
relatives à la 
gestion de la santé
Système de 
laboratoire
Système 
pharmaceutique
Système 
d'informations 
relatives à la 
gestion de la 
logistique
Niveau de 
composants OpenHIE
Niveau de services 
d'interopérabilité
Point de service
Niveau d'interopérabilité
Service  
d'interconnexion
Cartographie  
des entités
PLATEFORME 
DE SANTÉ 
NUMÉRIQUE
Légende
1.	 Le système d'information pour la gestion logistique (SIGL) stocke 
et ajoute des données relatives à la chaîne d'approvisionnement 
habituelle et simplifie leur analyse afin d'améliorer la gestion de la 
chaîne d'approvisionnement.
2.	 Le dossier médical partagé (DMP) est un recueil composé de la 
version standardisée des contenus créés au sein de la communauté 
après être validés par rapport à chacun des enregistrements 
précédents. Il s'agit d'une collection des enregistrements axés sur 
les patients avec des informations en échange.
3.	 Le système d'informations relatives à la gestion de la santé (SIGS) 
stocke les données sanitaires agrégés et régulièrement collectées et 
simplifie leur analyse dans le but d'améliorer la qualité des services 
de santé. 
4.	 Le service terminologique (ST)fonctionne comme une autorité 
centrale permettant d'identifier de manière unique les activités 
cliniques qui surviennent au cours du processus de prestation des 
soins en maintenant un ensemble terminologique aligné aux normes 
internationales, telles que CIM-10, LOINC, SNOMED, entre autres.
5.	 Le registre du client (RC) gère l'identité unique des citoyens 
bénéficiant des services de santé au sein du pays. 
6.	 Le registre de l'établissement [de santé] (RES) fonctionne comme 
une autorité centrale permettant d'identifier de manière unique tous 
les lieux où les services de santé ont été administrés au sein du pays. 
7.	 Le registre du professionnel de la santé (RPS) est l'autorité 
centrale responsable de l'entretien des identités uniques des 
professionnels de la santé du pays.
8.	 Le registre du produit (RP) est l'autorité centrale responsable de la 
définition des produits, tels que les produits de santé et médicaux 
de base et leur catégorisation.
9.	 Le niveau de services d'interopérabilité reçoit toutes les 
communications des services externes au sein de la zone sanitaire 
géographique et gère le processus d'échange des données entre les 
systèmes externes et les composants de l'OpenHIE.
10.	 [Les applications de] point de service, telles que le système 
de dossiers médicaux électronique OpenMRS et l'outil de 
communications RapidPro, sont utilisées par les médecins et la 
communauté de professionnels de la santé pour accéder et mettre 
à jour les informations sanitaires partagées axées sur le patient, 
enregistrer les opérations de prestation de soins de santé et 
communiquer de manière interactive, respectivement.
1
4
7
2
5
8
3
6
9
10
Fig. 6.3.3. 	 Exemple d'un plan d'architecture d'entreprise de santé numérique nationale en Birmanie. 
En l'état de la situation actuel, les normes relatives à 
l'échange des données sont utilisées de manière restreinte 
et les systèmes numériques utilisent une connexion directe 
(intégrée) avec les services partagés. Dans l'état de la 
situation futur, les normes relatives à l'échange des données 
et les composants favorables seront utilisés pour simplifier 
l'interopérabilité à travers les différentes mises en œuvre de 
la santé numérique et les divers services partagés. 
ÉTAT DE LA SITUATION FUTUR
Plateforme de santé numérique
ENTREPRISE
NATURE 
INTER- 
OPÉRABLE
Composants 
favorables
APPLICATIONS DE SANTÉ NUMÉRIQUE AVEC DES INTERVENTIONS NUMÉRIQUES POUR : 
Programmes de santé/cas d'utilisation
Paludisme
VIH/SIDA
Tuberculose
Portail du patient
SYSTÈMES EXTERNES
SYSTÈMES EXTERNES
APPLICATIONS DE POINT DE SERVICE
Authentification
File d'attente
Cryptage
Validation
Transformation
Traduction
SERVICES PARTAGÉS
SERVICES PARTAGÉS
SERVICES DE DONNÉES
SOURCES DE DONNÉES
Services partagés
Services partagés
Services d'informations 
sanitaires et sources 
de données basés sur 
l'institution
Services 
d'informations sanitaires 
et sources de données 
basés sur l'institution
Services d'informations 
sanitaires et sources de 
données basés sur la 
population
Services 
d'informations sanitaires 
et sources de données 
basés sur la population
Analytiques, tableaux 
de bord et outils 
numériques
Analytiques, tableaux 
de bord, outils, recueils 
CURRENT STATE
Accès MS
Suivi PWID
GeneX
FUCHIA
QuanTB
DHIS2
DHIS2
DHIS2
GIS
OpenMRS
OpenMRS
Portail du 
patient
Dossier médical 
partagé
Enregistrement des faits 
d'état civil et statistiques 
démographiques
Enquêtes sur les foyers 
(enquêtes de santé et 
démographiques, STEPS, 
autres)
Entrepôt de données
Gouvernance électronique
Agriculture
Registre des établissements 
de santé
Système d'informations 
pharmaceutiques 
électronique (DME et système 
d'informations sanitaires)
Dossiers médicaux 
électroniques (DME)
Registre des professionnels 
de la santé
Recensement
Tableaux de bord du site du 
Ministère de la santé
SIGL électronique 
(mSupply, Logistimo)
Tablettes (applications du 
professionnel de la santé)
SRMNIA, MNT, 
ATR et blessures
TB (OpenMRS, GeneX Alert, 
QuanTB)
GIS
Enquêtes sur les 
établissements (SARA)
Enquête RCDC
SIS électronique (DHIS2)
Base de données RCSC
Centre de données DITT
Registre des professionnels 
de la santé
Services terminologiques 
(HDD)
Registre des établissements 
de santé
Enquêtes sur les 
établissements (SARA)
SIGL électronique 
(mSupply, Logistimo)
SIMR
SIS électronique (DHIS2)
Recensement
Tableaux de bord du site du 
Ministère de la santé
GIS
Base de données RCSC
Centre de données DITT
A
B
C
D
Applications de point de service
Investissement 
dans un nouveau 
logiciel
Logiciel financé 
en cours de 
développement 
Investissement dans 
l'amélioration du 
logiciel 
Logiciel de 
désactivation 
Logiciel 
complètement 
fonctionnel financé 
Investissement dans 
l'échelonnement du 
logiciel fonctionnel
LÉGENDE
Application de 
point de service 
réutilisée
Application de 
point de service 
unique
