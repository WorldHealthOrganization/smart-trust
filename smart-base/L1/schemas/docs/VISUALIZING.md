# Seeing the graphs in Neo4j

> **Migrated from WorldHealthOrganization/smart-kg `docs/VISUALIZING.md` at 3f5e477** (issue #359). smart-kg is deprecated (owner, 2026-10-16); this copy is the one to edit. Paths now point at smart-base: each layer is a named subgraph, `smart-base/<Layer>/schemas/` (L1, L2, L2-bpmn, L2-dmn, L3), the engine and these docs are in `smart-base/L1/schemas/`, and the generated JSON, contexts, Turtle and Cypher are in each layer's `generated/`. A command written `npx tsx <path>` runs from the repository root after `npm ci` in `smart-base/L1/schemas/`.

`ontology/` holds the **type graph**: 55 classes and the 145 edges licensed between them. It answers
*what may exist*. There is no DAK data in this repository and there should not be — see
[`STORAGE.md`](STORAGE.md) — so everything below is about the model, not about instances.

## Loading

**First: use a user database, not `system`.** The first statement is a `CREATE CONSTRAINT`, and
`system` rejects it with *"can only be executed in a user database"* — which is what you get if
Neo4j Browser left you on `system` after connecting.

```cypher
:use neo4j          -- in Browser; or whatever your database is called
```

While you are in Settings, turn on **Enable multi statement query editor** — without it, pasting a
file runs only its first statement.

**The whole model:**

```bash
cypher-shell -d neo4j -f smart-base/L1/schemas/generated/all.cypher
```

**One subgraph at a time** — in dependency order. Each layer licenses edges onto classes from the
ones it imports, and Cypher does **not** treat a `MATCH` that finds nothing as an error, so loading
out of order silently drops those edges instead of failing:

```bash
cypher-shell -d neo4j -f smart-base/L1/schemas/generated/l1.cypher
cypher-shell -d neo4j -f smart-base/L2/schemas/generated/l2.cypher
cypher-shell -d neo4j -f smart-base/L2-bpmn/schemas/generated/l2-bpmn.cypher
cypher-shell -d neo4j -f smart-base/L2-dmn/schemas/generated/l2-dmn.cypher
```

In **Neo4j Desktop / Browser** without `cypher-shell`: paste the file with multi-statement enabled.
`all.cypher` is ~140 statements, so the shell is still easier.

Everything is `MERGE`, so re-running is safe.

### Check it loaded

```cypher
MATCH (c:KGClass) RETURN c.layer AS layer, count(*) AS classes ORDER BY layer;
```

```
l1        │ 13
l2        │ 14
l2-bpmn   │  6
l2-dmn    │  6
l3        │ 14
```

Every class node carries `layer`, which is what makes one subgraph selectable on its own.

---

## Seeing one subgraph at a time

**The whole model** — 40 classes is small enough to read:

```cypher
MATCH (c:KGClass)-[r]->(d:KGClass) RETURN c, r, d;
```

**One layer, and only the edges internal to it:**

```cypher
MATCH (c:KGClass {layer:'l2-bpmn'})-[r]->(d:KGClass {layer:'l2-bpmn'})
RETURN c, r, d;
```

**One layer plus the edges that leave it** — where a subgraph reaches into the layers it imports,
which is usually the interesting part:

```cypher
MATCH (c:KGClass {layer:'l2-dmn'})-[r]->(d:KGClass)
RETURN c, r, d, d.layer AS target_layer;
```

**Where the layers join** — every edge that crosses a layer boundary, in one query:

```cypher
MATCH (c:KGClass)-[r]->(d:KGClass)
WHERE c.layer <> d.layer
RETURN c.layer AS from, c.name AS source, type(r) AS predicate,
       d.name AS target, d.layer AS to
ORDER BY from, to;
```

**The nine DAK components:**

```cypher
MATCH (dak:KGClass {id:'dak'})-[r:HASCOMPONENT]->(c)
RETURN r.qualifier AS component, c.name AS class, c.layer AS declared_in
ORDER BY component;
```

**L1 all the way to L3** — the path the layers exist to make walkable:

```cypher
MATCH path = (:KGClass {id:'recommendation'})
             -[:IMPLEMENTEDBY]->(:KGClass)-[:IMPLEMENTEDBY]->(:KGClass {layer:'l3'})
RETURN path;
```

**Everything a DAK component reaches at L3:**

```cypher
MATCH (c:KGClass {layer:'l2'})-[r:IMPLEMENTEDBY]->(a:KGClass {layer:'l3'})
RETURN c.name AS component, collect(a.name) AS fhir_artefacts
ORDER BY component;
```

---

## Reading the model

**Which classes may point at a terminology code — and, more usefully, that none may point out of
one, because terminology is a structural leaf:**

```cypher
MATCH (c:KGClass)-[r]->(t:KGClass {id:'terminology-code'}) RETURN c.name, type(r);
MATCH (t:KGClass {id:'terminology-code'})-[r]->(c) RETURN c;   // returns nothing, by design
```

**The three kinds in a layer:**

```cypher
MATCH (c:KGClass {layer:'l2'}) RETURN c.kind AS kind, collect(c.name) AS classes ORDER BY kind;
```

**Which artefact classes elaborate a DAK file** (`l2:external-artifact`) — the shared-IRI mechanism, as declared:

```cypher
MATCH (c:KGClass) WHERE c.layer STARTS WITH 'l2-' AND c.kind = 'Artefact' RETURN c.name, c.iri;
```

---

## Making it readable in the browser

Click a label in the left-hand sidebar and set the caption to `name`. Colour by `layer` rather than
by `kind` if you want the four subgraphs to read as four subgraphs.

At 40 classes nothing needs tuning. If you later load instance data, raise *Initial Node Display*
above its default of 300 and turn *Connect result nodes* off first — with it on, every returned node
pulls in its neighbours.

---

## Protégé

`smart-base/L1/schemas/generated/all.ttl` is the whole model merged into one document — 1885 triples — and is what to open
offline. A single `ontology/<layer>/<layer>.ttl` declares `owl:imports` on its parents, which a
reasoner can follow only if those IRIs resolve. Pairwise edge
licensing is carried as qualified sub-properties — a single global domain and range on
`sgkg:contains` would permit `dmn-rule contains persona`, which the model does not.
