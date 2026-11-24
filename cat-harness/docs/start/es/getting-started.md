---
layout: default
title: Primeros pasos
lang: es
nav_exclude: true
translation_status: unverified
translation_source: start/getting-started.md
available_locales: ["ar", "zh", "en", "fr", "ru", "es"]
---

# Primeros pasos
{: .no_toc }

Esta página trata sobre la primera conversación: lo que ocurre entre que alguien dice
*«Quiero crear un folio»* y un sitio publicado que puede abrir. Si ya
tienes un folio y quieres configurar la cadena de herramientas, pasa a
[§4 Instalar y verificar](#4-install-and-verify).

1. TOC
{:toc}

---

## 1. "Crear un folio" son cinco solicitudes diferentes

Dile esa frase a cinco personas y obtendrás cinco trabajos diferentes.
La primera tarea del agente no es comenzar; es averiguar a cuál de ellas te referías.

| lo que quieres decir | lo que tienes | lo que te cuesta una suposición equivocada |
|---|---|---|
| **Un nuevo folio en un repositorio nuevo** | nada todavía | — |
| **folio-assistant añadido al repositorio que ya tienes** | tu propio proyecto, con sus propios archivos | un folio generado sobre un trabajo que nadie revisó primero |
| **Otro folio en un repositorio que ya tiene uno** | una instancia de folio-assistant | un segundo repositorio que no querías, y un corpus dividido |
| **Un nuevo documento dentro del folio que ya tienes** | un folio, y un capítulo en mente | un folio entero vacío, y el capítulo aún sin escribir |
| **Algo que preferirías describir con tus propias palabras** | — | — |

La cuarta fila es en la que vale la pena detenerse. No es un error de tu parte:
«folio» es una palabra poco común, y pedir uno cuando querías decir un capítulo
dentro de uno es el error más natural posible. Un agente que genera una estructura basándose en eso
habrá producido un repositorio vacío y no el párrafo que pediste.

## 2. Cómo decide el agente — y por qué es una tabla, no un juicio

El triaje es un artefacto real y legible en lugar de una costumbre que un agente pudiera tener:

- el proceso es
  [`folio-assistant-core/collab/processes/conduct/getting-started.bpmn`](https://github.com/litlfred/folio-assistant/blob/main/processes/getting-started.bpmn);
- la decisión en su núcleo es
  [`decisions/folio-intent.dmn`](https://github.com/litlfred/folio-assistant/blob/main/processes/decisions/folio-intent.dmn),
  una tabla de decisiones DMN que puedes abrir en cualquier herramienta DMN y modificar sin tocar
  código.

<figure class="bpmn-figure">
  <img src="{{ '/assets/img/workflows/getting-started.svg' | relative_url }}"
       alt="Proceso BPMN: un usuario solicita crear un folio; el agente detecta la modalidad de interacción, lee los hechos del repositorio, y una compuerta exclusiva calculada a partir de folio-intent.dmn enruta a una de cinco ramas — ask, overlay, new-repo, add-folio, o una derivación a la autoría de contenido. La estructura inicial siembra el plan de trabajo, luego la compilación de Pages reporta live, not-yet o unknown.">
</figure>
<p class="bpmn-source"><em>Fuente: <code>folio-assistant-core/collab/processes/conduct/getting-started.bpmn</code> — el SVG es generado por <code>bun run cat render:bpmn</code>.</em></p>

### Los tres hechos

La compuerta lee exactamente tres cosas, y dos de ellas provienen de observar
en lugar de preguntar:

| hecho | cómo se obtiene |
|---|---|
| `isFolio` | ¿hay un `harness.config.json` en este directorio? |
| `repoHasContent` | ¿contiene el árbol de trabajo archivos que pertenecen al proyecto de alguien, en contraposición a estar vacío? |
| `statedIntent` | lo que realmente **dijiste** — una de las cinco opciones, o `unstated` |

`statedIntent` es un hecho sobre la *conversación*. Permanece como `unstated` hasta que
hayas dicho cuál, e inferirlo a partir del tono o de lo que resultaría conveniente es
precisamente el fallo que la tabla existe para evitar.

> `isFolio` tiene que ver con el directorio, no contigo. Alguien que ha usado
> folio-assistant durante años sigue estando en un directorio con `isFolio=false` cuando
> abre uno nuevo. La experiencia cambia cuánto explica el agente; no
> cambia qué rama toma.

### Las siete reglas

| # | dicho | es un folio | tiene contenido | → |
|---|---|---|---|---|
| 1–4 | cualquiera de los cuatro | – | – | esa rama |
| 5 | unstated | sí | – | **ask** |
| 6 | unstated | no | sí | **ask** |
| 7 | unstated | no | no | nuevo folio aquí |

La política de aciertos es `FIRST`, por lo que las reglas 1–4 van antes de cualquier inferencia: **una persona que
dice lo que quiere nunca es anulada por una heurística sobre su sistema de archivos.**

### Por qué dos reglas devuelven "ask", y por qué ese es el propósito

Solo la regla 7 puede decidirse observando. Un directorio que ya es un folio es
coherente con tres solicitudes diferentes, y un directorio que contiene el proyecto
de alguien es coherente con dos. La tabla no disimula eso: devuelve
`ask`.

Esto importa más de lo que parece:

> **`ask` es un resultado de la tabla, no una decisión a la que llega el agente.**

Un agente no puede enrutar hacia una rama que la tabla no haya devuelto, por lo que la pregunta
se vuelve obligatoria en lugar de una cortesía. Un agente al que se le permita decidir *si* debe preguntar
decidirá, ante cualquier presión por parecer útil, no hacerlo; y los tres
casos ambiguos son exactamente aquellos donde adivinar resulta más costoso.

Cuando respondes, tu respuesta se convierte en `statedIntent` y se evalúa nuevamente
la misma tabla. Por eso el diagrama regresa en bucle a *Leer los hechos del repositorio*
en lugar de saltar directamente a una rama: **tu respuesta es evidencia, leída
como cualquier otro hecho.**

### Cómo modificarla

La tabla es un archivo XML que contiene siete reglas. Para añadir un sexto tipo de solicitud,
añade una regla y una rama correspondiente a la compuerta: el cargador se niega a
iniciar un proceso cuya tabla pueda devolver un resultado para el cual ninguna rama tenga nombre, de modo que
ambos no puedan desincronizarse. Nada en `src/` necesita cambiar.

## 3. Cómo se ve la conversación

**La forma de la pregunta va antes que su contenido.** El agente establece cómo
te gustaría que te pregunten — opciones seleccionables, chat ordinario, lectura en voz alta,
tipografía grande — y lo registra en `memory/interaction.json` para que ninguna sesión futura
te lo vuelva a preguntar. Consulta [Accesibilidad](accessibility.html).

Luego, cuando la respuesta es genuinamente ambigua:

> **Tú:** Quiero crear un folio
>
> **Asistente:** Este directorio ya contiene un folio (`content/atlas/`), por lo
> que podrías referirte a varias cosas:
> 1. **Añadir algo al folio que está aquí** — un capítulo, un documento
>    *(recomendado — es lo que más comúnmente significa «crear un…» desde dentro de un folio)*
> 2. Añadir un segundo folio junto a `atlas`
> 3. Iniciar un nuevo folio en un repositorio nuevo
> 4. Cuéntame más
>
> *(No responder está bien — tomaré la opción 1 y te mostraré antes de escribir nada).*

Y luego, sobre **qué** empezar a trabajar — porque «un folio» no es algo que alguien
realmente quiera por sí solo:

| tipo de contenido | qué es | necesita |
|---|---|---|
| **paper** | un artículo científico o libro, afirmaciones formales respaldadas por Lean, compuesto mediante LaTeX | conjunto de herramientas Lean, TeX |
| **document** | prosa estructurada — guías de políticas, un estándar, un informe | pandoc; sin Lean, sin TeX |
| **WHO SMART DAK** | un Kit de Adaptación Digital (L2) — perfiles, procesos, elementos de datos, tablas de decisión | — |
| **WHO SMART IG** | una Guía de Implementación FHIR (L3), construida a partir de un DAK L2 | Java, SUSHI, IG Publisher |

Consulta [Tipos de contenido](../../concepts/es/content-types.html) para ver las ventajas que ofrece cada formalismo.

## 4. Instalar y verificar
{: #4-install-and-verify }

Sigue las instrucciones de [Instalación](installation.html), luego ejecuta:

```sh
bun run cat check-deps
```

`bun` debería reportarse como presente. Cualquier elemento que tu tipo de contenido necesite y no
tenga se listará con una sugerencia de instalación; un folio de tipo documento no necesita ninguna de las
filas de Lean o TeX.

## 5. Conecta tu arnés de LLM

Registra folio-assistant como un servidor MCP — consulta
[Conectar un arnés de LLM](installation.html#connecting-an-llm-harness) para
Claude Code, Antigravity, Gemini CLI y clientes MCP genéricos.

Las herramientas más relevantes para esta página:

| Herramienta | Propósito |
|------|---------|
| `folio_init` | Genera la estructura inicial de un folio. Registrada como una herramienta **genérica**, porque se ejecuta antes de que el folio tenga un tipo de contenido |
| `workflow_start` / `workflow_next` / `workflow_complete` | Ejecuta `getting-started.bpmn` como un proceso real; `workflow_next` indica qué está habilitado en este momento y qué habilidad lo implementa |
| `work_plan_prime` | Muestra el plan de trabajo (work items) |
| `check_dependencies` | Verifica cuáles cadenas de herramientas están instaladas |
| `skill_list` / `skill_fetch` | Descubre y carga las instrucciones de una habilidad |

La lista completa de herramientas se encuentra en la página de [Habilidades y roles](../../concepts/es/skills.html); las herramientas
de tipos de contenido aparecen únicamente cuando el adaptador correspondiente está activo.

## 6. Convertir un repositorio que ya tienes

En la rama `overlay`, el agente examina antes de tocar cualquier cosa:

```sh
bun run cat scan:repo            # informe de solo lectura
bun run cat scan:repo -- --json  # lo mismo, como hechos
```

Clasifica lo que encuentra en **tres** categorías — `library` (material de origen
escrito por otra persona), `content` (prosa creada aquí) y `unclassified` (sin clasificar).

La tercera categoría es deliberada. Un clasificador que obliga a cada archivo a entrar en una de dos
categorías tiene una precisión que nadie puede evaluar, y entrega sus errores como archivos
reubicados. Este clasificador te indica lo que no pudo ubicar y te deja decidir a ti.

Luego, tres preguntas, todas posibles de responder mediante selección, y todas formuladas **por directorio**
en lugar de por archivo:

1. **¿Importar en absoluto?** — todo, solo las fuentes, nada, o elegir por categoría.
2. **¿A dónde va cada grupo?** — a `library/` o a `content/`, para los grupos de los que
   no estaba seguro.
3. **¿Dejar en su lugar o reorganizar?** — *dejar en su lugar* es la recomendación
   y se dice en serio. El orden estético es una preferencia; un enlace relativo roto en tu
   README es un defecto.

Nada se mueve hasta responder la pregunta 3. Ese paso está marcado como
`relaxable="false"` en el BPMN, por lo que ningún paquete de contenido puede omitirlo mediante declaración.

Disciplina completa: la
habilidad [`repo-conversion`]({{ '/reference/skill-instructions/repo-conversion.html' | relative_url }}).

## 7. Verlo publicado

Crear un folio debería terminar con un enlace. Inmediatamente después de generar la estructura inicial:

```sh
bun run cat pages:bootstrap            # deduce la dirección, informa, sin sondeo
bun run cat pages:bootstrap -- --wait  # sondea hasta que el sitio responda (delimitado)
```

Deduce la dirección a partir de `harness.config.json` o del remoto `origin`, encuentra
los flujos de trabajo de publicación por lo que *hacen* en lugar de por cómo se llaman, y reporta
una de tres cosas:

| | significado |
|---|---|
| **live** | el sitio respondió. Aquí está el enlace |
| **not yet** | un 404 **medido** — la dirección es correcta y la primera compilación aún no ha llegado allí |
| **could not check** | no se pudo deducir una dirección, no se sondeó nada o la solicitud falló |

El tercer estado no es una versión suavizada del segundo, y el agente no te dirá
«debería estar listo en breve» basándose en él. Un 404 medido es evidencia; una
solicitud fallida es la ausencia de evidencia, y un autor al que se le informa lo
incorrecto buscará un sitio que nunca iba a aparecer.

Los mismos tres estados constituyen una tabla de decisión —
[`decisions/pages-live-gate.dmn`](https://github.com/litlfred/folio-assistant/blob/main/processes/decisions/pages-live-gate.dmn) —
y `scripts/pages-bootstrap.ts` está probado para coincidir exactamente con ella, de modo que el
script y la tabla no puedan desincronizarse.

## 8. Haz tuya la página de inicio

La página de inicio de tu sitio abre con la descripción **propia** de tu instancia, plasmada
dentro de tu **propio** fondo. Ambos provienen de un solo archivo — `<name>.json` en
la raíz del repositorio — y nada sobre el gato gruñón de la plataforma está fijado
en la plantilla. Modifica el archivo; la página se actualizará en consecuencia.

### El nodo markdown que editas

```jsonc
// <name>.json -- la DECLARACIÓN. Cada clave a continuación es uno de sus campos de nivel
// superior, que es lo que define esta etiqueta: no es la configuración del folio.
{
  "title": "My Folio",              // el encabezado de la barra lateral izquierda
  "description": "One line.\nAnother line.",   // ← el markdown de la página de inicio
  "icon": "mark-small",             // qué imagen corresponde a la pestaña del navegador
  "images": [ /* … */ ]
}
```

`description` es **markdown**, renderizado tal cual. Es el nodo que dibuja la página de inicio;
no hay una página separada que mantener sincronizada con él, y ese es precisamente el propósito:
una descripción que aparece en dos lugares es una descripción que terminará contradiciéndose
a sí misma.

### Tu propio fondo

Una imagen se convierte en el fondo de la página de inicio declarando `role: "landing"` y para qué
área de visualización está recortada:

```jsonc
{
  "id": "landing-laptop",
  "src": "docs/assets/img/my-backdrop.webp",
  "role": "landing",
  "layout": "laptop",               // también: "mobile", "card"
  "width": 1671, "height": 941,
  "textRegion": { "x": 0.205, "y": 0.285, "w": 0.625, "h": 0.235 }
}
```

`textRegion` es el espacio donde las palabras pueden colocarse de forma segura, expresado en fracciones de la imagen. **Se
define manualmente por el autor, no se computa**, porque establece dónde la imagen es *tranquila* (despejada):
un juicio sobre la composición que ningún análisis de píxeles puede sustituir. El
fondo para computadoras portátiles de la propia plataforma tiene una nube de pensamiento con un interior inferior despejado,
una marca que ocupa su tercio superior y la oreja de un gato que asoma por su parte inferior izquierda; el
recuadro que evita los tres elementos se encontró renderizando candidatos y evaluándolos visualmente.
Haz lo mismo con el tuyo.

Declara una variante por cada área de visualización. Cada una lleva su **propia** región, porque la
misma composición se sitúa de forma diferente en un recorte vertical.

Luego:

```sh
bun run cat docs:harness         # transfiere la declaración a docs/_data/
bun run cat docs:harness -- --check   # ...y falla si está desactualizada (para CI)
```

### Tres cosas que no hará

| lo que declaras | lo que hace la página |
|---|---|
| un fondo **con** una región | dibuja tu descripción dentro de ella |
| un fondo **sin** región | muestra la imagen y coloca las palabras **debajo** de ella |
| **ningún** fondo | muestra únicamente las palabras |

La fila central es deliberada. El texto ubicado por adivinación termina encima del gato, por lo
que una región no declarada significa «no superponer», nunca «cualquier lugar está bien». Y un
folio sin arte gráfico es algo normal, no defectuoso.

Si declaras una variante `mobile` y llega un teléfono, este recibe ese archivo; y
si no lo has hecho, recibe la variante más ancha que tengas. Esta reserva (fallback) es una degradación
real, porque la región del recorte ancho es inadecuada para una pantalla estrecha; esto se
reporta en lugar de ocultarse, para que un renderizador pueda rechazar la superposición en lugar de
colocar el texto en un lugar que nadie eligió.

## 9. Haz seguimiento del trabajo con `beans`

folio-assistant utiliza [`beans`](https://github.com/hmans/beans) como el mecanismo único
de plan de trabajo: persistente entre sesiones, compartido entre agentes y confirmado
en el repositorio.

```sh
cat-harness-tools/scripts/install-beans.sh # instala la CLI si no está presente
beans prime                       # emite la preparación del plan de trabajo para los agentes
beans list                        # elementos abiertos actualmente
beans create "draft chapter 1"    # abre un elemento
bun run cat beans:claim <id>      # reclama un elemento
```

> **Verifica antes de crear.** `beans create` genera un ID nuevo en cada llamada y
> no elimina duplicados bajo ningún criterio. Comprueba primero si ya existe. La
> verificación se encuentra en la habilidad
> [`todo-manager`]({{ '/reference/skill-instructions/todo-manager.html' | relative_url }}).

El hook `SessionStart` presenta el plan al inicio de cada sesión, y la herramienta
MCP `work_plan_prime` expone la misma interfaz a cualquier agente conectado.

## Próximos pasos

- **[Accesibilidad](accessibility.html)** — cómo pregunta el agente y el control
  de configuración en este sitio
- **[Tutorial — redactar un artículo](https://litlfred.github.io/folio-assistant/folio-assistant-sci/guides/writing-a-paper.html)**
- **[Redactar un documento](https://litlfred.github.io/folio-assistant/folio-assistant-core/guides/writing-a-document.html)**
- **[Tipos de contenido](../../concepts/es/content-types.html)** — el formalismo para cada dominio
- **[Flujo de publicación](../../process/es/publication-workflow.html)** — cada proceso en el repositorio
- **[Arquitectura](../../concepts/es/architecture.html)** — adaptadores, habilidades y el modelo de bloques
