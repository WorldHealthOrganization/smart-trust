---
layout: default
title: Accesibilidad
lang: es
nav_exclude: true
translation_status: unverified
translation_source: start/accessibility.md
available_locales: ["ar", "zh", "en", "fr", "ru", "es"]
---

# Accesibilidad
{: .no_toc }

Esta página responde a dos preguntas:

1. ¿Cuáles son las opciones de soporte para discapacidades aquí y cuál es la mejor práctica?
2. ¿Cuáles son las opciones para forzar las preguntas y respuestas agénticas (Q&A) hacia preguntas guiadas que sigan la lógica DMN y puedan servir a diversas modalidades de interacción?

Resulta que son la misma pregunta formulada desde dos extremos, razón por la cual comparten página. La habilidad que lo implementa es [`interaction-modality`]({{ '/reference/skill-instructions/interaction-modality.html' | relative_url }}).

1. TOC
{:toc}

---

## 1. El fallo del que se trata

Un agente que formula una buena pregunta de manera inutilizable no ha preguntado nada.

La forma habitual: un prompt largo y abierto —*«Cuéntame sobre el folio que tienes en mente, qué tipos de contenido esperas y cómo te gustaría que estuviera organizado»*— enviado a alguien para quien escribir en el teclado es lento y doloroso. La respuesta es breve. El agente interpreta la brevedad como falta de compromiso y formula otra pregunta abierta. Nadie en ese intercambio ha hecho nada evidentemente incorrecto, y la conversación ya está fracasando.

La regla:

> **El costo de una pregunta lo paga quien la responde.** Diseña la pregunta para que la respuesta más económica posible siga siendo una respuesta completa.

Las opciones seleccionables constituyen una mejor pregunta que una abierta para casi todo el mundo, y no le cuestan nada a la persona que de todos modos preferiría escribir texto libre. Tratar eso como una adaptación en lugar de como la opción predeterminada es la razón por la que termina aplicándose solo después de que alguien ha tenido que pedirlo.

## 2. Opciones de soporte para discapacidades: lo que realmente está sobre la mesa

Cuatro ejes independientes. Una persona puede situarse en más de uno, y ninguno de ellos es un diagnóstico: son decisiones sobre la interfaz.

### 2.1 Función manual / destreza limitada

El eje que más cambia el comportamiento de un agente, y el que más a menudo se reduce a «hacer los botones más grandes».

| qué hacer | por qué |
|---|---|
| Cada pregunta es una **selección**, numerada | escribir en el teclado es la acción costosa |
| **Cuatro opciones o menos** | más allá de eso, divide la pregunta |
| Una opción **recomendada**, indicada en **primer lugar** y marcada | una persona que no desea decidir puede elegir la primera opción y acertar |
| **Indica qué sucede si no responden nada**, y luego haz eso | el silencio nunca debe bloquear el trabajo |
| **Agrupa** decisiones por lotes para que una respuesta cubra varias | cada ida y vuelta cuesta pulsaciones de teclas |
| Anuncia las tareas de larga duración; no pidas permiso para ejecutarlas | las solicitudes de confirmación son el impuesto oculto |
| Texto libre siempre *disponible*, nunca *obligatorio* | la lista de opciones es un piso, no un techo |

En la salida renderizada: **WCAG 2.2 SC 2.5.8 Tamaño del objetivo (mínimo)** — 24 × 24 px CSS — y **2.5.7 Movimientos de arrastre**: cualquier elemento que se pueda arrastrar necesita una alternativa sin arrastre.

### 2.2 Baja visión

Tipografía grande, contraste real, nunca información transmitida únicamente por el color, líneas cortas y tablas estrechas: una tabla ancha es ilegible a un 200 % de zoom y peor aún a través de un lector de pantalla. Los diagramas ASCII tampoco sobreviven; usa una imagen real con texto alternativo (alt text) real.

Criterios: **1.4.4 Cambio de tamaño del texto** (200 % sin pérdida), **1.4.3 Contraste (mínimo)**, **1.4.1 Uso del color**, **1.4.10 Reajuste (Reflow)**, **2.4.7 Foco visible**.

### 2.3 Audio / voz

Respuestas que se lean en voz alta con claridad: sin bloques de código dentro de la prosa, sin tablas, sin «véase el diagrama anterior», identificadores explicados o deletreados en su primer uso, una sola idea por oración y **una pregunta a la vez**. Una lista de cuatro opciones funciona hablada; una tabla de cuatro columnas no.

### 2.4 Carga cognitiva y lenguaje claro

Oraciones más cortas, jerga explicada en su primer uso, sin cláusulas subordinadas anidadas y un orden de operaciones predecible. De aquí es de donde realmente proviene el límite de «cuatro opciones» —la guía **COGA** del W3C y **WCAG 3.1**— y es también simplemente la opción predeterminada adecuada para un lector en su segunda lengua, que en el caso de una directriz SMART de la OMS representa a la mayor parte de la audiencia.

### 2.5 Mejores prácticas, identificadas para poder ser verificadas

No un vago «sigue las pautas de accesibilidad», sino documentos específicos, de modo que cualquier afirmación aquí pueda verificarse en lugar de tener que aceptarse por fe:

| estándar | qué cubre | por qué aplica aquí |
|---|---|---|
| **WCAG 2.2 Nivel AA** | la salida renderizada —sitio de documentación, visor, PDF generado | la línea base que todo lo demás toma como referencia |
| **Nuevos criterios (SC) de WCAG 2.2** — 2.5.7, 2.5.8, 3.3.7 | arrastre, tamaño del objetivo, entrada redundante | el 3.3.7 es el que cambia el diseño del agente: **no hagas que alguien ingrese la misma información dos veces** |
| **W3C COGA** | discapacidades cognitivas y de aprendizaje | el §2.4 anterior |
| **EN 301 549** | contratación pública de la UE | hace que WCAG AA sea un requisito legal en los contextos donde se implementa una directriz |
| **Section 508** | contratación federal de EE. UU. | lo mismo, en los EE. UU. |
| **ATAG 2.0** | herramientas que *producen* contenido | **la que suele pasarse por alto.** folio-assistant es una herramienta de autoría: la Parte A exige que la herramienta sea utilizable; la Parte B, que la herramienta ayude al autor a producir contenido accesible |

La Parte B de ATAG es la parte que una plataforma de contenido puede ofrecer de manera única: la presencia de texto alternativo, el orden de los encabezados, los encabezados de tabla y el etiquetado de idioma en los folios *publicados* son comprobaciones que el barrido de QA puede realizar, y ninguna mejora de accesibilidad en el editor puede sustituirlas.

### 2.6 Qué está implementado hoy

| | dónde |
|---|---|
| Preferencias orientadas al agente, guardadas en el repositorio (committed), leídas al inicio de la sesión | `memory/interaction.json`, expuestas por `scripts/session-start-coord-sweep.sh` |
| Las reglas que sigue un agente al preguntar | [`interaction-modality`]({{ site.baseurl }}/reference/skill-instructions/interaction-modality.html) |
| Controles para el lector en este sitio | el engranaje en el encabezado de la barra lateral —texto más grande, mayor contraste, enlaces subrayados, movimiento reducido |
| Movimiento reducido respetado sin tener que solicitarlo | media query `prefers-reduced-motion`, que inicializa el valor predeterminado del panel |

**Los dos almacenes de preferencias están separados deliberadamente.** `memory/interaction.json` está en el repositorio, está orientado al agente y atañe a la conversación. El control del sitio reside en el `localStorage` de cada visor, nunca sale del navegador y atañe a la lectura. Un lector que no sea el autor y que elija texto grande no debe reconfigurar de manera silenciosa cómo le habla el agente al autor.

### 2.7 Qué no está hecho

Declarado explícitamente, porque una característica de accesibilidad anunciada a medias es peor que una ausente:

- **Sin comprobaciones de la Parte B de ATAG en el barrido de QA.** Todavía nada verifica que un folio publicado contenga texto alternativo, un orden correcto de encabezados o encabezados de tabla.
- **Sin auditoría de los PDF generados.** La ruta de renderizado de documentos pasa por weasyprint/prince/wkhtmltopdf y la salida de PDF etiquetado (tagged PDF) no se ha verificado.
- **Sin pruebas con lectores de pantalla.** Los controles del sitio están construidos conforme a los criterios, pero no se han probado en la práctica con NVDA, JAWS o VoiceOver. Construir según la especificación no es lo mismo que haber verificado.
- **La modalidad de audio está descrita, no implementada.** Las reglas están redactadas; no hay ningún canal de voz conectado.

## 3. Forzar preguntas y respuestas agénticas hacia preguntas guiadas

La respuesta es una separación.

### 3.1 Dos cosas que parecen una sola

**Qué preguntar a continuación** es una *decisión*. Las entradas son los hechos conocidos hasta ahora; la salida es el id de la siguiente pregunta, o `none` cuando ya se sabe lo suficiente. Corresponde a una tabla DMN, puede ser revisada por quien sea dueño del proceso y es idéntica para cada usuario.

**Cómo renderizar la pregunta** es la *modalidad*. Una lista numerada en el chat; alternativas habladas, una por una, mediante audio; botones de opción (radio buttons) en tamaño grande en una página web. La tabla de decisiones nunca se entera de nada de esto.

```
 facts ──▶ [ next-question.dmn ] ──▶ question id ──▶ renderer(profile) ──▶ user
   ▲                                                                        │
   └──────────────────── answer recorded as a new fact ─────────────────────┘
```

Una sola lógica, cuatro superficies. Agrega una modalidad agregando un renderizador; la entrevista no cambia. Modifica la entrevista editando una tabla; ningún renderizador cambia.

### 3.2 Cuatro propiedades que esto aporta

1. **El conjunto de preguntas es finito y revisable.** Puedes leer la tabla y conocer cada pregunta que el agente es capaz de formular. Un agente que improvisa no ofrece tal garantía y no puede revisarse antes de interactuar con un usuario.
2. **Termina.** Una tabla cuya salida puede ser `none` tiene una condición de detención.
3. **Preguntar se vuelve obligatorio en lugar de opcional.** Este es el truco que [`folio-intent.dmn`](getting-started.html#why-two-rules-return-ask-and-why-that-is-the-point) ya utiliza: `ask` es un *resultado de la tabla*, por lo que el agente no puede sortearlo. Un agente que decida por sí mismo si preguntar o no decidirá, ante cualquier presión por parecer servicial, no preguntar.
4. **Una pregunta omitida es auditable.** Los hechos quedan registrados; vuelve a ejecutar la tabla y comprueba qué regla se activó.

### 3.3 Las opciones, y lo que cuesta cada una

Cuatro formas de hacer esto, en orden creciente de ambición. Solo la primera está construida.

| opción | qué es | costo |
|---|---|---|
| **A — decisión por compuerta (decision-per-gateway)** *(construida)* | cada punto de ramificación ambiguo en un BPMN incluye `cat-harness.processes:decision`; la tabla devuelve la rama, incluyendo `ask` | sin máquina de estados para la entrevista — el *proceso* es el estado. No puede expresar «haz estas cuatro preguntas en cualquier orden» |
| **B — un conjunto de preguntas detrás de una sola compuerta** | un `next-question.dmn` en bucle hasta que devuelve `none`; las respuestas se acumulan como hechos | una tabla adicional y un almacén de hechos; el bucle es propio del proceso, por lo que no se ejecuta nada nuevo |
| **C — formularios impulsados por DMN** | la misma tabla renderiza un formulario en el sitio, no solo un intercambio en el chat | requiere un esquema de hechos y un renderizador por modalidad; la tabla no cambia |
| **D — motor de entrevistas DMN/BPMN completo** | subprocesos por tema, eventos de límite (boundary events) para «cambié de opinión» | trabajo real en el motor, y el subconjunto de FEEL tendría que ampliarse |

### 3.4 Límites, expresados con claridad

- **El subconjunto de FEEL es pequeño.** `src/workflow/decision-table.ts` implementa igualdad, comparación y pertenencia (one-of). Los rangos, `not()` y las llamadas a funciones son *rechazados* en lugar de evaluarse incorrectamente de forma silenciosa: una tabla que devuelve una respuesta distinta a la esperada en la página es peor que una que lanza una excepción.
- **Una pregunta abierta no es una decisión.** «¿De qué trata este artículo?» no pertenece a una tabla, y forzarla allí produce una entrevista peor.
- **Una conversación no es un asistente paso a paso (wizard).** El usuario siempre debe poder decir algo que la tabla no anticipó. Para eso está la opción «cuéntame más», y no es un adorno opcional.
- **Guiado no significa interrogar.** La mayor victoria en accesibilidad disponible es la pregunta que no tuviste que hacer: cada hecho que el agente lee del sistema de archivos es una pregunta menos.

## Véase también

- [Primeros pasos](getting-started.html) — la tabla de decisiones de intención en uso
- [Habilidad `interaction-modality`]({{ '/reference/skill-instructions/interaction-modality.html' | relative_url }})
- [Flujo de publicación](../../process/es/publication-workflow.html) — cada proceso en el repositorio
