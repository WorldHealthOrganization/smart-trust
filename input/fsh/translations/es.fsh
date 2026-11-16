// Spanish (es) CodeSystem supplements. Agent translation, UNOFFICIAL and unreviewed:
// no human sign-off. One file per locale; the CodeSystems themselves are not edited.
// WHO's own Spanish terminology where it exists (C.L.38.2023, the Spanish Letters of
// Application, WHO regional office names).

CodeSystem: DomainsEs
Id: Domains-es
Title: "Ámbitos de confianza de la GDHCN de la OMS (es)"
Description: "Suplemento en español (es) de Domains. Traducción no oficial generada por un agente, sin revisión humana."
* ^status = #draft
* ^experimental = true
* ^content = #supplement
* ^supplements = Canonical(Domains)
* ^language = #es
* ^caseSensitive = true
* #DDCC "DDCC" "La Documentación digital de certificados de COVID-19 (DDCC) se define en la Guía de implementación SMART en http://smart.who.int/ddcc"
  * ^designation[0].language = #es
  * ^designation[0].value = "DDCC"
* #IPS-PILGRIMAGE "IPS para la peregrinación" "El IPS para la peregrinación se define en la Guía de implementación SMART en http://smart.who.int/ips-pilgrimage"
  * ^designation[0].language = #es
  * ^designation[0].value = "IPS para la peregrinación"
* #PH4H "Carretera Panamericana para la Salud Digital (PH4H)" "La Carretera Panamericana para la Salud Digital (PH4H) se define en la Guía de implementación SMART en https://worldhealthorganization.github.io/smart-ph4h/"
  * ^designation[0].language = #es
  * ^designation[0].value = "Carretera Panamericana para la Salud Digital (PH4H)"
* #ICVP "Certificado Internacional de Vacunación o Profilaxis (ICVP)" "El Certificado Internacional de Vacunación o Profilaxis (ICVP) se define en la Guía de implementación SMART en https://worldhealthorganization.github.io/smart-icvp/"
  * ^designation[0].language = #es
  * ^designation[0].value = "Certificado Internacional de Vacunación o Profilaxis (ICVP)"

CodeSystem: KeyUsageEs
Id: KeyUsage-es
Title: "Uso de claves de la GDHCN de la OMS (es)"
Description: "Suplemento en español (es) de KeyUsage. Traducción no oficial generada por un agente, sin revisión humana."
* ^status = #draft
* ^experimental = true
* ^content = #supplement
* ^supplements = Canonical(KeyUsage)
* ^language = #es
* ^caseSensitive = false
* #SCA "Autoridad de certificación del firmante (SCA)" "Certificado que actúa como ancla de confianza en la verificación de la cadena de certificados de los DSC emitidos por un participante en la red de confianza"
  * ^designation[0].language = #es
  * ^designation[0].value = "Autoridad de certificación del firmante (SCA)"
* #DSC "Certificado de firma de documentos (DSC)" "Certificado que puede utilizarse para verificar una firma digital contenida en un certificado digital de salud verificable"
  * ^designation[0].language = #es
  * ^designation[0].value = "Certificado de firma de documentos (DSC)"
* #DECA "Autoridad de certificación para el intercambio de datos (DECA)" "Certificado que actúa como ancla de confianza en la verificación de la cadena de certificados de los DESC emitidos por un participante en la red de confianza"
  * ^designation[0].language = #es
  * ^designation[0].value = "Autoridad de certificación para el intercambio de datos (DECA)"
* #DESC "Certificado de firma para el intercambio de datos (DESC)" "Certificado que puede utilizarse para iniciar una conexión segura de intercambio de datos (p. ej., mTLS) entre participantes en la red de confianza"
  * ^designation[0].language = #es
  * ^designation[0].value = "Certificado de firma para el intercambio de datos (DESC)"
* #TLS "Seguridad de la capa de transporte (TLS)" "Se utiliza para establecer conexiones (m)TLS con sistemas, en particular entre la puerta de enlace a la red de confianza y los sistemas de backend de un participante en la red de confianza"
  * ^designation[0].language = #es
  * ^designation[0].value = "Seguridad de la capa de transporte (TLS)"
* #UP "Carga (UP)" "Se utiliza para verificar la firma digital de contenido firmado criptográficamente que se carga en servicios de la Red Mundial de Certificación Digital de Salud, en particular la puerta de enlace a la red de confianza"
  * ^designation[0].language = #es
  * ^designation[0].value = "Carga (UP)"

CodeSystem: DomainsDEVEs
Id: Domains-DEV-es
Title: "Ámbitos de confianza de la GDHCN de la OMS - DEV (es)"
Description: "Suplemento en español (es) de Domains-DEV. Traducción no oficial generada por un agente, sin revisión humana."
* ^status = #draft
* ^experimental = true
* ^content = #supplement
* ^supplements = Canonical(Domains-DEV)
* ^language = #es
* ^caseSensitive = true
* #DDCC "DDCC" "La Documentación digital de certificados de COVID-19 (DDCC) se define en la Guía de implementación SMART en http://smart.who.int/ddcc"
  * ^designation[0].language = #es
  * ^designation[0].value = "DDCC"
* #IPS-PILGRIMAGE "IPS para la peregrinación" "El IPS para la peregrinación se define en la Guía de implementación SMART en http://smart.who.int/ips-pilgrimage"
  * ^designation[0].language = #es
  * ^designation[0].value = "IPS para la peregrinación"
* #PH4H "Carretera Panamericana para la Salud Digital (PH4H)" "La Carretera Panamericana para la Salud Digital (PH4H) se define en la Guía de implementación SMART en https://worldhealthorganization.github.io/smart-ph4h/"
  * ^designation[0].language = #es
  * ^designation[0].value = "Carretera Panamericana para la Salud Digital (PH4H)"
* #ICVP "Certificado Internacional de Vacunación o Profilaxis (ICVP)" "El Certificado Internacional de Vacunación o Profilaxis (ICVP) se define en la Guía de implementación SMART en https://worldhealthorganization.github.io/smart-icvp/"
  * ^designation[0].language = #es
  * ^designation[0].value = "Certificado Internacional de Vacunación o Profilaxis (ICVP)"

CodeSystem: KeyUsageDEVEs
Id: KeyUsage-DEV-es
Title: "Uso de claves de la GDHCN de la OMS - DEV (es)"
Description: "Suplemento en español (es) de KeyUsage-DEV. Traducción no oficial generada por un agente, sin revisión humana."
* ^status = #draft
* ^experimental = true
* ^content = #supplement
* ^supplements = Canonical(KeyUsage-DEV)
* ^language = #es
* ^caseSensitive = false
* #SCA "Autoridad de certificación del firmante (SCA)" "Certificado que actúa como ancla de confianza en la verificación de la cadena de certificados de los DSC emitidos por un participante en la red de confianza"
  * ^designation[0].language = #es
  * ^designation[0].value = "Autoridad de certificación del firmante (SCA)"
* #DSC "Certificado de firma de documentos (DSC)" "Certificado que puede utilizarse para verificar una firma digital contenida en un certificado digital de salud verificable"
  * ^designation[0].language = #es
  * ^designation[0].value = "Certificado de firma de documentos (DSC)"
* #DECA "Autoridad de certificación para el intercambio de datos (DECA)" "Certificado que actúa como ancla de confianza en la verificación de la cadena de certificados de los DESC emitidos por un participante en la red de confianza"
  * ^designation[0].language = #es
  * ^designation[0].value = "Autoridad de certificación para el intercambio de datos (DECA)"
* #DESC "Certificado de firma para el intercambio de datos (DESC)" "Certificado que puede utilizarse para iniciar una conexión segura de intercambio de datos (p. ej., mTLS) entre participantes en la red de confianza"
  * ^designation[0].language = #es
  * ^designation[0].value = "Certificado de firma para el intercambio de datos (DESC)"
* #TLS "Seguridad de la capa de transporte (TLS)" "Se utiliza para establecer conexiones (m)TLS con sistemas, en particular entre la puerta de enlace a la red de confianza y los sistemas de backend de un participante en la red de confianza"
  * ^designation[0].language = #es
  * ^designation[0].value = "Seguridad de la capa de transporte (TLS)"
* #UP "Carga (UP)" "Se utiliza para verificar la firma digital de contenido firmado criptográficamente que se carga en servicios de la Red Mundial de Certificación Digital de Salud, en particular la puerta de enlace a la red de confianza"
  * ^designation[0].language = #es
  * ^designation[0].value = "Carga (UP)"

CodeSystem: DomainsUATEs
Id: Domains-UAT-es
Title: "Ámbitos de confianza de la GDHCN de la OMS - UAT (es)"
Description: "Suplemento en español (es) de Domains-UAT. Traducción no oficial generada por un agente, sin revisión humana."
* ^status = #draft
* ^experimental = true
* ^content = #supplement
* ^supplements = Canonical(Domains-UAT)
* ^language = #es
* ^caseSensitive = true
* #DDCC "DDCC" "La Documentación digital de certificados de COVID-19 (DDCC) se define en la Guía de implementación SMART en http://smart.who.int/ddcc"
  * ^designation[0].language = #es
  * ^designation[0].value = "DDCC"
* #IPS-PILGRIMAGE "IPS para la peregrinación" "El IPS para la peregrinación se define en la Guía de implementación SMART en http://smart.who.int/ips-pilgrimage"
  * ^designation[0].language = #es
  * ^designation[0].value = "IPS para la peregrinación"
* #PH4H "Carretera Panamericana para la Salud Digital (PH4H)" "La Carretera Panamericana para la Salud Digital (PH4H) se define en la Guía de implementación SMART en https://worldhealthorganization.github.io/smart-ph4h/"
  * ^designation[0].language = #es
  * ^designation[0].value = "Carretera Panamericana para la Salud Digital (PH4H)"
* #ICVP "Certificado Internacional de Vacunación o Profilaxis (ICVP)" "El Certificado Internacional de Vacunación o Profilaxis (ICVP) se define en la Guía de implementación SMART en https://worldhealthorganization.github.io/smart-icvp/"
  * ^designation[0].language = #es
  * ^designation[0].value = "Certificado Internacional de Vacunación o Profilaxis (ICVP)"

CodeSystem: KeyUsageUATEs
Id: KeyUsage-UAT-es
Title: "Uso de claves de la GDHCN de la OMS - UAT (es)"
Description: "Suplemento en español (es) de KeyUsage-UAT. Traducción no oficial generada por un agente, sin revisión humana."
* ^status = #draft
* ^experimental = true
* ^content = #supplement
* ^supplements = Canonical(KeyUsage-UAT)
* ^language = #es
* ^caseSensitive = false
* #SCA "Autoridad de certificación del firmante (SCA)" "Certificado que actúa como ancla de confianza en la verificación de la cadena de certificados de los DSC emitidos por un participante en la red de confianza"
  * ^designation[0].language = #es
  * ^designation[0].value = "Autoridad de certificación del firmante (SCA)"
* #DSC "Certificado de firma de documentos (DSC)" "Certificado que puede utilizarse para verificar una firma digital contenida en un certificado digital de salud verificable"
  * ^designation[0].language = #es
  * ^designation[0].value = "Certificado de firma de documentos (DSC)"
* #DECA "Autoridad de certificación para el intercambio de datos (DECA)" "Certificado que actúa como ancla de confianza en la verificación de la cadena de certificados de los DESC emitidos por un participante en la red de confianza"
  * ^designation[0].language = #es
  * ^designation[0].value = "Autoridad de certificación para el intercambio de datos (DECA)"
* #DESC "Certificado de firma para el intercambio de datos (DESC)" "Certificado que puede utilizarse para iniciar una conexión segura de intercambio de datos (p. ej., mTLS) entre participantes en la red de confianza"
  * ^designation[0].language = #es
  * ^designation[0].value = "Certificado de firma para el intercambio de datos (DESC)"
* #TLS "Seguridad de la capa de transporte (TLS)" "Se utiliza para establecer conexiones (m)TLS con sistemas, en particular entre la puerta de enlace a la red de confianza y los sistemas de backend de un participante en la red de confianza"
  * ^designation[0].language = #es
  * ^designation[0].value = "Seguridad de la capa de transporte (TLS)"
* #UP "Carga (UP)" "Se utiliza para verificar la firma digital de contenido firmado criptográficamente que se carga en servicios de la Red Mundial de Certificación Digital de Salud, en particular la puerta de enlace a la red de confianza"
  * ^designation[0].language = #es
  * ^designation[0].value = "Carga (UP)"

CodeSystem: ActorsEs
Id: Actors-es
Title: "Actores de confianza de la GDHCN de la OMS (es)"
Description: "Suplemento en español (es) de Actors. Traducción no oficial generada por un agente, sin revisión humana."
* ^status = #draft
* ^experimental = true
* ^content = #supplement
* ^supplements = Canonical(Actors)
* ^language = #es
* ^caseSensitive = false
* #credential-holder "Titular de una credencial"
  * ^designation[0].language = #es
  * ^designation[0].value = "Titular de una credencial"
* #credential-issuer "Emisor de una credencial"
  * ^designation[0].language = #es
  * ^designation[0].value = "Emisor de una credencial"
* #gdhcn "GDHCN" "Red Mundial de Certificación Digital de Salud (GDHCN)"
  * ^designation[0].language = #es
  * ^designation[0].value = "GDHCN"
* #TNG "TNG" "Puerta de enlace a la red de confianza"
  * ^designation[0].language = #es
  * ^designation[0].value = "TNG"
* #TNP "TNP" "Participante en la red de confianza"
  * ^designation[0].language = #es
  * ^designation[0].value = "TNP"

CodeSystem: ConnectionTypesEs
Id: ConnectionTypes-es
Title: "Tipos de conexión de la GDHCN de la OMS (es)"
Description: "Suplemento en español (es) de ConnectionTypes. Traducción no oficial generada por un agente, sin revisión humana."
* ^status = #draft
* ^experimental = true
* ^content = #supplement
* ^supplements = Canonical(ConnectionTypes)
* ^language = #es
* ^caseSensitive = false
* #http-get "http-get" "Solicitud GET http(s)"
  * ^designation[0].language = #es
  * ^designation[0].value = "http-get"
* #mtls "mTLS" "TLS mutuo (mTLS)"
  * ^designation[0].language = #es
  * ^designation[0].value = "mTLS"

CodeSystem: PayloadTypesEs
Id: PayloadTypes-es
Title: "Tipos de carga útil de la GDHCN de la OMS (es)"
Description: "Suplemento en español (es) de PayloadTypes. Traducción no oficial generada por un agente, sin revisión humana."
* ^status = #draft
* ^experimental = true
* ^content = #supplement
* ^supplements = Canonical(PayloadTypes)
* ^language = #es
* ^caseSensitive = false
* #urn:who:trust:trustlist:v2 "Lista de confianza de la GDHCN de la OMS v2" "Lista de confianza de la Red Mundial de Certificación Digital de Salud (GDHCN) de la OMS. Versión principal v2"
  * ^designation[0].language = #es
  * ^designation[0].value = "Lista de confianza de la GDHCN de la OMS v2"

CodeSystem: DAKComponentsEs
Id: DAKComponents-es
Title: "Componentes del DAK (es)"
Description: "Suplemento en español (es) de DAKComponents. Traducción no oficial generada por un agente, sin revisión humana."
* ^status = #draft
* ^experimental = true
* ^content = #supplement
* ^supplements = Canonical(DAKComponents)
* ^language = #es
* ^caseSensitive = true
* #health-interventions-and-recommendations "Intervenciones y recomendaciones de salud" "Intervenciones y recomendaciones de salud pertinentes de las directrices y orientaciones de la OMS. Sirven para definir el alcance del DAK."
  * ^designation[0].language = #es
  * ^designation[0].value = "Intervenciones y recomendaciones de salud"
* #generic-personas "Personas genéricas" "Funciones, responsabilidades e intervenciones esenciales que realizan las personas destinatarias. Ejemplo de diseño centrado en las personas."
  * ^designation[0].language = #es
  * ^designation[0].value = "Personas genéricas"
* #user-scenarios "Escenarios de usuario" "Breve descripción narrativa de cómo las personas destinatarias pueden interactuar con el sistema digital. Ejemplo de diseño centrado en las personas."
  * ^designation[0].language = #es
  * ^designation[0].value = "Escenarios de usuario"
* #generic-business-processes-and-workflows "Procesos de negocio y flujos de trabajo" "Flujos de trabajo genéricos que representan procesos clínicos y no clínicos. Sirven para determinar cuándo se recopilan y utilizan los datos y qué funciones se requieren."
  * ^designation[0].language = #es
  * ^designation[0].value = "Procesos de negocio y flujos de trabajo"
* #core-data-elements "Elementos de datos básicos" "Elementos de datos utilizados para la toma de decisiones clínicas, los indicadores y otras necesidades de datos. Sirven para los formularios de recopilación de datos y los requisitos de interoperabilidad de nivel L3."
  * ^designation[0].language = #es
  * ^designation[0].value = "Elementos de datos básicos"
* #decision-support-logic "Lógica de apoyo a la toma de decisiones" "Tablas de decisión que representan los algoritmos de asesoramiento y tratamiento, y cualquier otra lógica utilizada para determinar las rutas del flujo de trabajo o las acciones clínicas."
  * ^designation[0].language = #es
  * ^designation[0].value = "Lógica de apoyo a la toma de decisiones"
* #scheduling-logic "Lógica de programación" "Tablas de decisión que representan la lógica de programación según los planes de atención. Antes se combinaba con la lógica de apoyo a la toma de decisiones. Todavía no es un campo propio en el modelo lógico del DAK de la OMS."
  * ^designation[0].language = #es
  * ^designation[0].value = "Lógica de programación"
* #programme-indicators "Indicadores y seguimiento" "Indicadores para la notificación y el seguimiento, con numerador y denominador definidos a partir de elementos de datos. Vinculan los datos centrados en la persona con los datos agregados."
  * ^designation[0].language = #es
  * ^designation[0].value = "Indicadores y seguimiento"
* #functional-and-non-functional-requirements "Requisitos funcionales y no funcionales" "Lista no exhaustiva de funciones clave y requisitos no funcionales para un sistema digital de seguimiento y apoyo a la toma de decisiones. Sirven para definir las funciones del sistema."
  * ^designation[0].language = #es
  * ^designation[0].value = "Requisitos funcionales y no funcionales"
* #test-scenarios "Escenarios de prueba" "Datos y escenarios de prueba para comprobar un sistema con respecto a los otros nueve componentes. Un banco de pruebas (test harness) para ejecutarlos."
  * ^designation[0].language = #es
  * ^designation[0].value = "Escenarios de prueba"

CodeSystem: DDCCTermsOfUseEs
Id: DDCCTermsOfUse-es
Title: "Condiciones de uso del Ámbito de confianza DDCC (es)"
Description: "Suplemento en español (es) de DDCCTermsOfUse. Traducción no oficial generada por un agente, sin revisión humana."
* ^status = #draft
* ^experimental = true
* ^content = #supplement
* ^supplements = Canonical(DDCCTermsOfUse)
* ^language = #es
* ^caseSensitive = true
* #DDCC-DATA-PROTECTION "Principios éticos y protección de datos" "cumplir los principios éticos y las consideraciones de protección de datos expuestos en la sección 2 de https://www.who.int/publications/i/item/WHO-2019-nCoV-Digital_certificates-vaccination-2021.1 y, en particular, garantizar que los datos personales contenidos en los certificados emitidos se traten únicamente con el fin de acceder a la información incluida en el certificado y verificarla, se limiten a lo estrictamente necesario para el caso de uso previsto y no se conserven más tiempo del estrictamente necesario"
  * ^designation[0].language = #es
  * ^designation[0].value = "Principios éticos y protección de datos"
* #DDCC-GDHCN-STANDARDS "Normas y ciberseguridad de la GDHCN" "cumplir las normas, los requisitos de ciberseguridad y los sistemas y procesos tecnológicos de la GDHCN descritos en https://smart.who.int/trust/"
  * ^designation[0].language = #es
  * ^designation[0].value = "Normas y ciberseguridad de la GDHCN"
* #DDCC-VERIFIABLE "Verificable mediante la GDHCN" "garantizar que la autenticidad, la validez y la integridad de los certificados de COVID-19 emitidos puedan verificarse mediante la GDHCN de la OMS"
  * ^designation[0].language = #es
  * ^designation[0].value = "Verificable mediante la GDHCN"

CodeSystem: WHORegionalOfficesEs
Id: WHORegionalOffices-es
Title: "Oficinas Regionales de la OMS (es)"
Description: "Suplemento en español (es) de WHORegionalOffices. Traducción no oficial generada por un agente, sin revisión humana."
* ^status = #draft
* ^experimental = true
* ^content = #supplement
* ^supplements = Canonical(WHORegionalOffices)
* ^language = #es
* ^caseSensitive = false
* #AFRO "Oficina Regional de la OMS para África" "Oficina Regional de la OMS para África (AFRO)"
  * ^designation[0].language = #es
  * ^designation[0].value = "Oficina Regional de la OMS para África"
* #AMRO "Oficina Regional de la OMS para las Américas" "Oficina Regional de la OMS para las Américas (AMRO/OPS)"
  * ^designation[0].language = #es
  * ^designation[0].value = "Oficina Regional de la OMS para las Américas"
* #EMRO "Oficina Regional de la OMS para el Mediterráneo Oriental" "Oficina Regional de la OMS para el Mediterráneo Oriental (EMRO)"
  * ^designation[0].language = #es
  * ^designation[0].value = "Oficina Regional de la OMS para el Mediterráneo Oriental"
* #EURO "Oficina Regional de la OMS para Europa" "Oficina Regional de la OMS para Europa (EURO)"
  * ^designation[0].language = #es
  * ^designation[0].value = "Oficina Regional de la OMS para Europa"
* #SEARO "Oficina Regional de la OMS para Asia Sudoriental" "Oficina Regional de la OMS para Asia Sudoriental (SEARO)"
  * ^designation[0].language = #es
  * ^designation[0].value = "Oficina Regional de la OMS para Asia Sudoriental"
* #WPRO "Oficina Regional de la OMS para el Pacífico Occidental" "Oficina Regional de la OMS para el Pacífico Occidental (WPRO)"
  * ^designation[0].language = #es
  * ^designation[0].value = "Oficina Regional de la OMS para el Pacífico Occidental"
* #OTHER "Otros participantes" "Participantes que no son Estados Miembros ni Estados Partes"
  * ^designation[0].language = #es
  * ^designation[0].value = "Otros participantes"
