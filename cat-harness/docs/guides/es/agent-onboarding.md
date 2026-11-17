---
layout: default
title: "Incorporación del agente (ES)"
parent: Authoring guides
lang: es
# `lang` above is what makes this a translation -- nothing reads `fr` out of
# the path. `nav_exclude` keeps it out of the statically built nav, and
# `mountNavLocale` (site-chrome/assets/js/docs-ui.js) puts it back in place of its
# source when this locale is selected. There is no `nav_order`: it stands
# where its source stands. library/skills/library-core/translation-manager.md
nav_exclude: true
translation_status: unverified
translation_source: guides/agent-onboarding.md
available_locales: ["ar", "zh", "en", "fr", "ru", "es"]
---

# Incorporación del agente
{: .no_toc }

Usted es un agente LLM que acaba de ser incorporado a un repositorio que utiliza
folio-assistant. Esta página es su orientación: qué está observando,
qué hacer primero y dónde buscar información.

Para la *arquitectura* de habilidades, roles y capacidades, consulte
[Habilidades y roles](../../concepts/skills.html). Esta página es la versión práctica.

1. TOC
{:toc}

---

## 1. Identifique en qué repositorio se encuentra

Hay dos tipos, y confundirlos es el error inicial más común.

| | **folio-assistant** (la plataforma) | **Un folio** (el repositorio de contenido) |
|---|---|---|
| Contiene | habilidades, esquemas, pipeline, servidor MCP | el artículo / directriz / IG real |
| Tiene `content/<paper>/` | no — solo `content/pipeline/` | sí |
| Se edita aquí para | cambiar cómo funciona la autoría | cambiar lo que se está creando |

```sh
ls content/          # pipeline/ only  ⇒ platform;  paper dirs ⇒ folio
```

**folio-assistant no contiene contenido.** Si se encuentra a punto de
escribir temática dentro de él — un capítulo, una constante, una lista
de palabras clave de un capítulo —, se encuentra en el repositorio equivocado,
o lo que está escribiendo debería ser datos provistos por el folio. Consulte el §7.

## 2. Sus primeros cinco minutos

```sh
beans prime && beans list      # the work-plan — see §6
cat-harness-tools/scripts/session-start-coord-sweep.sh  # CLI-independent equivalent
bun run cat check-deps                     # what this environment can do
```

Muchas comprobaciones se degradan a `n/a` en lugar de fallar cuando falta una
herramienta (sin cadena de herramientas de Lean, sin Atlas, sin LaTeX). **Un
`n/a` no es una aprobación:** indique qué se omitió y por qué, porque reportar
"todo limpio" sin saberlo presenta la ausencia de datos como un resultado.

## 3. Encuentre la habilidad adecuada — no improvise

Las habilidades son la unidad de trabajo aquí. Antes de crear un procedimiento
a mano, compruebe si ya existe uno. **Pídala con `skill_list` y `skill_fetch`; no
navegue a una ruta.**

| Dónde | Qué le proporciona |
|---|---|
| [Referencia de esquemas de habilidades]({{ site.baseurl }}/reference/skills/) | contrato de entrada/salida generado por habilidad |
| [Instrucciones de habilidades]({{ site.baseurl }}/reference/skill-instructions/) | cuerpos de instrucciones completos generados |
| [Habilidades y roles](../../concepts/skills.html) | cómo se componen las habilidades, los roles y las capacidades |

Ambos directorios `reference/` son **generados** — nunca los edite a mano.
Regenere con `bun run cat-harness-tools/scripts/gen-schema-docs.ts` y
`bun run cat-harness-tools/scripts/gen-skill-docs.ts`.

## 4. El modelo de objetos de contenido, en resumen

Un bloque de contenido es una **terna** que comparte un nombre raíz:

```
<block>.ts     manifest — label, kind, uses[], lean.ref, cites[]
<block>.md     the narrative a reader actually reads
<block>.lean   the formalisation (when the kind requires one)
<block>.qa.json  QA sidecar — audit results, per criterion
```

El manifiesto `.ts` es la fuente de verdad para la estructura. El *estado*
de la formalización se deriva en el momento de compilación, nunca se almacena en el manifiesto.

## 5. Dos relaciones de dependencia — no las confunda

- **`uses[]` es editorial.** "¿Qué debe haber leído un lector para comprender
  este bloque?" Redactado — mantenido por el agente o el humano.
- **El grafo formal es derivado por máquina** a partir de `lean.ref`, nunca
  escrito a mano.

Divergen legítimamente en ambas direcciones: una demostración invoca lemas
`simp` sobre los cuales nadie necesita leer; un teorema está motivado por un ejemplo
que nunca cita formalmente.

**Nunca rellene `uses[]` desde Lean.** Esto destruye la señal a partir de la
cual se calcula cada métrica de ordenación. Para preguntas sobre el impacto ("¿qué se rompe si
esto cambia?"), tome la unión:

```sh
bun run content/pipeline/content-graph.ts content/<paper>
```

Auditar si `uses[]` está bien utilizado es una habilidad en sí misma:
`uses-editorial-review`, además del eje mecánico de QA `uses`.

## 6. Realice un seguimiento del trabajo en beans, no en su cabeza

`beans` es el **único** mecanismo de tareas pendientes — local de la sesión *y*
entre agentes. `beans/` se guarda en una rama de estado y se monta al iniciar la sesión
(`bun run cat state:mount`), por lo que un plan sobrevive a la reanudación en un
contenedor nuevo.

```sh
beans list
beans create "<title>"
bun run cat beans:claim <id>             # CLAIM before you work
```

Reclame antes de trabajar para que dos sesiones no elijan el mismo elemento, y nunca
resuelva ni elimine el work item de un homólogo. No cree un almacén de tareas
paralelo. No ejecute `beans create` para colas masivas generadas por máquinas (`*.qa.json`,
archivos de testigos) — esas permanecen como JSON masivo.

Disciplina completa: `work-plan/skills/work-plan/todo-manager.md`,
`work-plan/skills/work-plan/bean-coordination.md`.

## 7. Sidecars y ejes de QA

Cada bloque puede incluir `<block>.qa.json` registrando, por criterio, lo
que encontró cada revisor — `script`, `agent` o `human`. Las entradas contienen
los hashes de los archivos fuente en el momento de la auditoría, por lo que una entrada queda **obsoleta** (stale) cuando el
bloque es editado y debe volver a adjudicarse.

Los criterios se agrupan en **ejes** (`proof`, `voice`, `detangler`,
`uses`, `canonical`, `compute`, `bibliography`, …). Ejecute uno:

```sh
bun run content/pipeline/qa-sweep.ts --axis uses content/<paper>
bun run content/pipeline/qa-staleness.ts content/<paper>
```

Algunos criterios son `automated: true` (un script decide) y otros son
`automated: false` (un agente o un humano debe adjudicar). El segundo tipo
cuesta turnos reales — consulte `semantic-cone.ts` para delimitar su alcance según lo que
realmente puedan afectar.

**Ejes opcionales del folio.** Un eje que codifica la materia temática de un folio se
registra únicamente cuando el folio opta por él:

```json
// <name>.config.json
{ "qaAxes": ["q-usage"] }
```

De igual modo, los *datos* específicos del folio pertenecen al folio, no a la plataforma —
por ejemplo, `content/<paper>/topic-keywords.json` impulsa
`detangler-topic-coherence`, y en su ausencia el verificador reporta `n/a`.

## 8. Entrega del trabajo

```sh
/prepare-merge [base]
```

Ejecuta la receta genérica más las puertas de control específicas del tipo de contenido (artículo →
content_validate / qa_sweep / proof_status / latex_preflight /
lean_build), y luego realiza el push. **No realiza la fusión (merge).**

Monitorear un PR hermano: `/watch <pr|branch>`.

## 9. Dónde buscar información

| Pregunta | Respuesta |
|---|---|
| Comandos del proyecto, convenciones | `AGENTS.md` (la fuente de verdad genérica para agentes) |
| Qué hace una habilidad | `skills/**/`, o los [cuerpos de instrucciones]({{ site.baseurl }}/reference/skill-instructions/) generados |
| El contrato tipado de una habilidad | [Referencia de esquemas de habilidades]({{ site.baseurl }}/reference/skills/) |
| Qué significa un criterio de QA | `content/pipeline/qa-criteria-registry.ts` — las descripciones son la especificación |
| El esquema de bloques | `schemas/types.ts` |
| El esquema del sidecar de QA | `schemas/block-qa.ts` |
| Qué puede hacer este entorno | `cat-harness/scenarios/capabilities/*.json`, `check-deps` |

## 10. Hábitos para evitar problemas

- **No codifique en duro el nombre de un artículo.** Un folio puede contener varios; resuélvalo
  con `findPapers()` / `soleFolioPaper()` de
  `content/pipeline/repo-root.ts`.
- **Lea la descripción del criterio antes de actuar sobre un hallazgo.** Estas
  indican la severidad, la intención y lo que explícitamente *no* cuenta.
