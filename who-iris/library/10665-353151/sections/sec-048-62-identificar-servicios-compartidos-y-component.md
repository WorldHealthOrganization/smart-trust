---
doc_id: 10665-353151
doc_title: "Guía para la inversión en la implementación digital (DIIG)"
section_id: sec-048-62-identificar-servicios-compartidos-y-component
section_title: "Identificar servicios compartidos y componentes comunes y propicios (plataforma de salud digital)"
section_number: 6.2
pages: 98-100
source_pdf: 10665-353151.pdf
source_sha256: 8bb0b6ab5e83cb7e
toc_source: inferred
---
comunes y propicios (plataforma de salud digital)
Al vincular la implementación de salud digital con la arquitectura más amplia del emprendimiento de salud digital, 
considere las funcionalidades, o componentes, principales que son exclusivos de su caso de uso o su programa de 
salud, así como los componentes que pueden generalizarse y reutilizarse en otras áreas del programa de salud o 
incluso fuera del sector sanitario. Estos componentes comunes (llamados también componentes reutilizables) 
representan oportunidades de inversión conjunta, y le permiten unir y armonizar diferentes intervenciones de 
salud digital en todas las áreas del programa e incluso en otros sectores, a la vez que facilitan el establecimiento 
de una arquitectura común de la cual pueden beneficiarse todas las implementaciones de salud digital (consulte 
la Fig. 6.2.2). Piense en estos componentes comunes como caminos y tuberías de agua –“se construyen una vez, se 
usan miles de veces”– que es probable que necesite para la implementación de salud digital y que otros también 
necesitarán y que pueden contribuir en conjunto a adaptaciones e implementaciones posteriores y beneficiarse de 
ellas. Estos componentes reutilizables también pueden usarse fuera del sector sanitario, por ejemplo en educación 
y protección social. El conjunto de componentes comunes se conoce como la plataforma de salud digital y se puede 
subdividir en servicios compartidos y componentes propicios.
Podría alinear la implementación de salud digital para 
vincular y compartir estos componentes comunes a 
medida que están disponibles en la arquitectura del 
emprendimiento de salud digital (14). Las normas y las 
API (siglas en inglés para interfaces de programación de 
aplicaciones), que son códigos y software que permiten 
que dos programas se comuniquen entre sí, pueden 
ayudar a vincular la implementación de salud digital con 
los componentes comunes. 
Si estos componentes no existían aún en su entorno, 
podría dirigir parte de su inversión de salud digital para 
apoyar el establecimiento de un componente común, 
como un servicio compartido que posteriormente 
puedan usar otras áreas del programa de salud. No todos 
los componentes comunes necesarios representados 
en un diagrama de arquitectura estarán disponibles al 
mismo tiempo; las inversiones a menudo se hacen de 
manera secuencial a medida que hay recursos financieros 
disponibles y según surge la necesidad. En consecuencia, 
la implementación de salud digital cambiará con el tiempo 
al aportar inversiones o incorporar nuevos componentes a 
medida que se desarrollan la arquitectura y el ecosistema 
de salud digital (14). 
Recuadro 6.2.1. Lista ilustrativa de 
conceptos comunes
Los siguientes son ejemplos de componentes 
comunes que pueden extenderse a todas las otras 
áreas de implementación:
	» servicios de autenticación para determinar  
el acceso y los privilegios de control;
	» servicios de administración de identidad, 
como los ID únicos de los pacientes, los 
trabajadores sanitarios y los centros de salud;
	» servicios de terminología y datos de referencia 
que apoyen las necesidades de metadatos, 
incluidos los elementos e indicadores de datos;
	» servicios de geolocalización; 
	» servicios de pago para facilitar las 
transacciones financieras; 
	» motores de análisis que apoyen los paneles  
y otras herramientas similares,
	» motores de programación y de sistemas  
de toma de decisiones;
	» depósito de datos para apoyar el 
almacenamiento y archivos que usen 
formatos estándares comunes;
	» bus de servicios empresariales para apoyar el 
“nivel de interoperabilidad” del intercambio 
de datos.
Fig. 6.2.2. 	 Inversiones en salud digital dentro de la arquitectura del emprendimiento de salud digital 
SERVICIOS COMPARTIDOS
SERVICIOS DE DATOS
FUENTES DE DATOS
SIS de la institución  
y fuentes de datos
SIS de la población  
y fuentes de datos
Análisis, paneles, 
ayudas, archivos 
Plataforma de salud digital
Servicios compartidos
Servicios del 
ámbito empresarial
Servicios  
de registro
Servicios de 
terminología
Registro de 
trabajadores 
sanitarios
Registro  
de pacientes
Registro de 
productos
Registro del  
centro de salud
Sistema de 
información de 
gestión logística
Registros  
de salud 
compartidos
Sistema de 
información de 
gestión sanitaria
Conjuntos de 
datos digitales y no 
digitales obtenidos 
de los procesos que 
registran información 
sistemáticamente 
dentro de las 
instituciones y 
centros de salud 
(p. ej., la evaluación 
de la disponibilidad 
y preparación de los 
servicios)
Brinda capacida-
des de software, 
o “servicios”, 
específicos de la 
atención médica 
que pueden 
aprovechar otras 
aplicaciones en 
todo el empren-
dimiento de 
salud digital.
Brinda 
capacidades 
de software, o 
“servicios”, que 
son “listas” 
generales/
canónicas, 
que ejecutan 
mecanismos 
de gestión 
específicos.
Conjuntos de datos digitales y 
no digitales obtenidos de los 
procesos que registran información 
sistemáticamente sobre los 
miembros de una población (p. ej., 
censos, encuestas demográficas y 
de salud [EDS])
Herramientas 
de datos que 
se usan para 
facilitar la toma 
de decisiones 
(p. ej., el sistema 
de información 
geográfica, o SIG)
NIVEL DE  
INTEROPERABILIDAD
Componentes  
propicios
Brinda capacidades de software para apoyar 
el intercambio de datos y la interoperabilidad 
entre las aplicaciones y servicios de todo el 
emprendimiento de salud digital.
APLICACIONES CON INTERVENCIONES
Programa de salud
Caso de uso
Programa de salud
Caso de uso
A
B
C
D
Aplicaciones del punto de servicio
Aplicaciones que se reutilizan en más de un caso de uso o área del programa
Aplicaciones que se utilizan de forma exclusiva en un caso de uso o área  
del programa de salud
Inversión en 
software nuevo
Software financiado 
en desarrollo 
Inversión en el 
fortalecimiento de 
software 
Software para 
desactivar 
Software financiado 
completamente 
funcional 
Inversión para 
ampliar el software 
funcional
REFERENCIAS
Aplicación del 
POS reutilizada
Aplicación del 
POS exclusiva
EMPRENDIMIENTO
SISTEMAS EXTERNOS
Aplicaciones 
digitales que no son 
de salud, servicios, 
componentes 
propicios para la 
interoperabilidad 
y fuentes de datos 
con capacidades que 
puede aprovechar el 
emprendimiento de 
salud digital (p. ej., 
un sistema nacional 
de identificación 
única, sistemas 
nacionales de 
adquisición, fuentes 
de datos nacionales 
de servicios 
meteorológicos, etc.)
