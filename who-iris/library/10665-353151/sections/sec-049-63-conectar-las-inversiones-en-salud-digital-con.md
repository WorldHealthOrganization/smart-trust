---
doc_id: 10665-353151
doc_title: "Guía para la inversión en la implementación digital (DIIG)"
section_id: sec-049-63-conectar-las-inversiones-en-salud-digital-con
section_title: "Conectar las inversiones en salud digital con la arquitectura institucional"
section_number: 6.3
pages: 100-103
source_pdf: 10665-353151.pdf
source_sha256: 8bb0b6ab5e83cb7e
toc_source: inferred
---
con la arquitectura institucional
Esta guía brinda solo una descripción general introductoria para vincular las inversiones de salud digital de los 
programas de salud con la arquitectura más amplia del emprendimiento nacional de salud digital. Ejecutar 
este proceso requerirá consultas más detalladas con el personal que tiene experiencia en el desarrollo de 
arquitecturas nacionales de emprendimientos de salud digital. En el Recuadro 6.3.1, se destacan los recursos 
clave que pueden facilitar este proceso. 
Se recomienda que identifique o elabore un diagrama 
que refleje el estado actual de la arquitectura nacional del 
emprendimiento de salud digital y que incluya en su plan de 
implementación presupuestado un diagrama que detalle el 
estado futuro que muestre las inversiones en aplicaciones 
y servicios digitales propuestas (consulte la Fig. 6.3.3 para 
ver un ejemplo). El estado actual describe cómo están 
implementados actualmente los distintos sistemas. Puede 
que se trate de aplicaciones desiguales que están aisladas 
o como mucho combinadas directamente con otras 
aplicaciones. En el diagrama del estado futuro, destaque 
los componentes planificados nuevos y emergentes que 
otros estén implementando, así como las funcionalidades 
comunes y las que son específicas del programa y en las 
que se centrará su inversión en salud digital, y especifique 
las aplicaciones, los servicios comunes y los requisitos de 
interoperabilidad que su sistema aprovechará o a los cuales 
contribuirá. En el Anexo 6.1, se proporciona una plantilla para 
reflexionar en cómo puede vincularse la implementación de 
salud digital propuesta con los requisitos de la arquitectura 
más amplia.
A medida que empieza a vincular la inversión en salud 
digital con la arquitectura más amplia y que planifica los 
costos que conllevaría, considere las siguientes preguntas.
	» ¿Cuáles son los componentes principales para esta 
implementación de salud digital?
	» De esos componentes principales, ¿qué componentes 
comunes existentes pueden reutilizarse o 
aprovecharse en otras áreas del programa de salud? 
Por ejemplo, un motor de análisis podría ser un 
componente necesario que otra área del programa ya 
implementó y se lo puede reutilizar y compartir (por 
ejemplo, como un servicio compartido).
	» ¿Qué componentes comunes son requisitos 
nuevos que la inversión en salud digital puede 
apoyar y contribuir a la arquitectura nacional del 
emprendimiento de salud digital?
Se brindan como ejemplo los diagramas de estado actual 
y futuro de la arquitectura nacional del emprendimiento 
de salud digital de Birmania a modo de guía (consulte la 
Fig. 6.3.3). Puede usarlos como plantilla para diagramar los 
componentes comunes existentes (en verde y amarillo) y 
planificados (en rojo y gris) de su plan de implementación 
presupuestado. En su diagrama, tenga presente el uso de 
aplicaciones específicas de salud digital que abarquen las 
intervenciones en el punto de servicio (POS, por sus siglas 
en inglés), los servicios compartidos y los componentes 
propicios para cada una de sus intervenciones de salud 
digital identificadas.
Recuadro 6.3.1.	Recursos clave para elaborar una arquitectura del emprendimiento de salud digital 
	» Digital health platform handbook: building a digital information infrastructure (infostructure) for health se 
centra en combinar las intervenciones de salud digital en un conjunto interoperable, identificando las normas 
y los requisitos de interoperabilidad que dan lugar a una arquitectura coherente del emprendimiento de salud 
digital (14).
	» OpenHIE describe un marco de arquitectura reutilizable que aprovecha las normas de información de salud, 
permite la implementación flexible con socios del país y admite el intercambio de componentes individuales 
(consulte la Fig. 6.3.2). OpenHIE también sirve como comunidad global de práctica para apoyar a los países 
para un “desarrollo abierto y colaborativo y apoyo de arquitecturas de información de salud a gran escala 
impulsadas por el país” (18).
	» TOGAF es una metodología de arquitectura institucional estándar del sector que proporciona guía detallada 
para apoyar el establecimiento de una jerarquía flexible e integrada de arquitecturas institucionales, de datos, 
aplicaciones y tecnologías a fin de optimizar las intervenciones de salud digital (92). 
Fig. 6.3.2.	
	Diagrama estructural de OpenHIE que ilustra los mecanismos de interoperabilidad 
entre las diferentes aplicaciones 
Fuente: La figura y la leyenda se adaptaron de OpenHIE architecture v2, 2019 (93).
Servicios del ámbito empresarial
Servicios de registro
SISTEMA DE  
INFORMACIÓN DE  
GESTIÓN LOGÍSTICA
SERVICIOS  
DE TERMINOLOGÍA
REGISTRO DE  
PACIENTES
REGISTRO DE  
CENTROS MÉDICOS
REGISTRO DE 
TRABAJADORES  
SANITARIOS
REGISTRO DE  
PRODUCTOS
REGISTROS  
DE SALUD  
COMPARTIDOS
SISTEMA DE  
INFORMACIÓN  
DE GESTIÓN  
SANITARIA
Autenticación
Sistema  
de servicio  
móvil
Historia 
clínica  
electrónica
Sistema de 
información  
de gestión  
sanitaria
Sistema de 
laboratorios
Sistema  
de farmacias
Sistema de  
información  
de gestión  
logística
Nivel de componentes  
de OpenHIE
Nivel de servicios  
de interoperabilidad
Punto de servicio
Nivel de interoperabilidad
Servicio de  
interconexión
Asignación  
de entidades
PLATAFORMA 
DE SALUD 
DIGITAL
Referencias
1.	 El sistema de información de gestión logística (SIGL)  almacena 
y agrega datos de rutina de la cadena de suministro y facilita su 
análisis para mejorar la administración de la cadena de suministro.
2.	 El registro de salud compartido (RSC) es un repositorio que 
contiene la versión normalizada del contenido creado en la 
comunidad después de validarlo comparándolo con los registros 
anteriores. Es una recopilación de registros centrados en la persona 
para pacientes con información en intercambio.
3.	 El sistema de información sobre administración sanitaria (HMIS) 
almacena datos de salud totales recopilados de forma rutinaria y 
facilita su análisis con la meta de mejorar la calidad de los servicios 
de salud. 
4.	 Los servicios de terminología (ST) sirven como autoridad central 
para identificar de forma exclusiva las actividades clínicas que 
ocurren dentro del proceso de prestación de la atención al mantener 
un conjunto de terminología que se correlaciona con las normas 
internacionales, como ICO10, NCIOL, SNOMED y otros.
5.	 El registro de pacientes (RP) administra la identidad única de los 
ciudadanos que reciben servicios de salud en el país. 
6.	 El registro de centros [de salud] (RCS) sirve como autoridad 
central para identificar de forma exclusiva todos los lugares donde 
se administran servicios de salud en el país. 
7.	 El registro de trabajadores sanitarios (RTS) es la autoridad central 
para mantener las identidades únicas de los proveedores sanitarios 
del país.
8.	 El registro de productos (RP) es la autoridad central para definir los 
productos, como los productos médicos y sanitarios básicos, y para 
su categorización.
9.	 El nivel de servicios de interoperabilidad recibe todas las 
comunicaciones de los servicios externos dentro de una región 
sanitaria y coordina el procesamiento de intercambio de datos 
entre los sistemas externos y el nivel de componentes de OpenHIE.
10.	 Las [aplicaciones] de punto de servicio, como el sistema de 
historias clínicas electrónicas OpenMRS y la herramienta de 
comunicaciones RapidPro, son lo que los médicos y los agentes de 
salud comunitarios usan para acceder a la información de salud 
del paciente compartida y centrada en la persona, actualizarla y 
registrar las transacciones de atención médica, y para comunicarse 
de forma interactiva, respectivamente.
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
Fig. 6.3.3. 	 Ejemplo del plan maestro nacional de arquitectura del emprendimiento de salud digital 
en Birmania 
En el estado actual, el uso de las normas de intercambio 
de datos es limitado, y los sistemas digitales usan 
conexión directa (integrada) con los servicios compartidos. 
En el estado futuro, las normas de intercambio de datos 
y los componentes propicios se usan para facilitar la 
interoperabilidad a través de los distintos servicios 
compartidos e implementaciones de salud digital. 
ESTADO FUTURO
Plataforma de salud digital
EMPRENDIMIENTO
NIVEL DE  
INTEROPERABILIDAD
Componentes  
propicios
APLICACIONES DE SALUD DIGITAL CON INTERVENCIÓN DIGITAL 
Programas de salud/Casos de uso
Paludismo
VIH/SIDA
TB
Portal de pacientes
SISTEMAS EXTERNOS
SISTEMAS EXTERNOS
APLICACIONES DEL PUNTO DE SERVICIO
Autenticación
En espera
Cifrado
Validación
Transformación
Traducción
SERVICIOS COMPARTIDOS
SERVICIOS 
COMPARTIDOS
SERVICIOS DE DATOS
FUENTES DE DATOS
Servicios compartidos
Servicios compartidos
SIS de la institución  
y fuentes de datos
SIS de la institución  
y fuentes de datos
SIS de la población  
y fuentes de datos
SIS de la población  
y fuentes de datos
Análisis, paneles  
yayudas digitales
Análisis, paneles, 
ayudas, archivos 
ESTADO ACTUAL
Microsoft 
Access
Registro de 
personas que 
se inyectan 
drogas
GeneX
FUCHIA
QuanTB
DHIS2
DHIS2
DHIS2
SIG
OpenMRS
OpenMRS
Portal de 
pacientes
Registros de salud  
compartidos
registro civil y estadísticas 
vitales
Encuestas en los hogares 
(EDS, STEPS, otras)
Almacén de datos
Gestión electrónica
Agricultura
Registro del centro  
de salud
ePIS (HCE y SIS)
Historias clínicas electrónicas 
(HCE)
Registro del personal 
sanitario
Censos
Paneles del  
sitio web del MSS
eLMIS  
(mSupply, Logistimo)
Tabletas  
(Aplicaciones del  
trabajador sanitario)
RMNCAH, enfermedades  
no contagiosas, accidentes  
de tránsito y lesiones
Tuberculosis (OpenMRS, 
GeneX Alert, QuanTB)
SIG
Encuestas del centro  
(SARA)
Vigilancia del RCDC
eHMIS (DHIS2)
Base de datos del RCSC
Centro de datos de DITT
Registro del personal 
sanitario
Servicios de terminología 
(HDD)
Registro del centro  
de salud
Encuestas del centro  
(SARA)
eLMIS  
(mSupply, Logistimo)
Vigilancia y respuesta 
integrada a las 
enfermedades (IDSR,  
por sus siglas en inglés)
eHMIS (DHIS2)
Censos
Paneles del sitio web del MSS
SIG
Base de datos del RCSC
Centro de datos de DITT
A
B
C
D
Aplicaciones del punto de servicio
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
