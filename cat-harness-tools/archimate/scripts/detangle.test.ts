import { describe, expect, it } from "bun:test";
import { deflateRawSync } from "node:zlib";
import { modelXmlOf, parseArchimate } from "../schemas/archimate.ts";
import { detangle, scoreOf, withModelXml, writeBack } from "./archimate-detangle.ts";

/** A model with one view: top row a, b; bottom row c, d; lines a→d and b→c cross. */
const XML = `<?xml version="1.0" encoding="UTF-8"?>
<archimate:model xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:archimate="http://www.archimatetool.com/archimate" name="M" id="id-m" version="5.0.0">
  <folder name="Application" id="id-f1" type="application">
    <element xsi:type="archimate:ApplicationComponent" name="A" id="id-a"/>
    <element xsi:type="archimate:ApplicationComponent" name="B" id="id-b"/>
    <element xsi:type="archimate:ApplicationComponent" name="C" id="id-c"/>
    <element xsi:type="archimate:ApplicationComponent" name="D" id="id-d"/>
  </folder>
  <folder name="Relations" id="id-f2" type="relations">
    <element xsi:type="archimate:ServingRelationship" id="id-r1" source="id-a" target="id-d"/>
    <element xsi:type="archimate:ServingRelationship" id="id-r2" source="id-b" target="id-c"/>
  </folder>
  <folder name="Views" id="id-f3" type="diagrams">
    <element xsi:type="archimate:ArchimateDiagramModel" name="V" id="id-v">
      <child xsi:type="archimate:DiagramObject" id="id-na" archimateElement="id-a">
        <bounds x="0" y="0" width="120" height="55"/>
        <sourceConnection xsi:type="archimate:Connection" id="id-c1" source="id-na" target="id-nd" archimateRelationship="id-r1"/>
      </child>
      <child xsi:type="archimate:DiagramObject" id="id-nb" archimateElement="id-b">
        <bounds x="300" width="120" height="55"/>
        <sourceConnection xsi:type="archimate:Connection" id="id-c2" source="id-nb" target="id-nc" archimateRelationship="id-r2"/>
      </child>
      <child xsi:type="archimate:DiagramObject" id="id-nc" archimateElement="id-c">
        <bounds y="300" width="120" height="55"/>
      </child>
      <child xsi:type="archimate:DiagramObject" id="id-nd" archimateElement="id-d">
        <bounds x="300" y="300" width="120" height="55"/>
      </child>
    </element>
  </folder>
</archimate:model>
`;

describe("detangle", () => {
  it("swaps two same-size boxes in a row to undo a crossing, and writes only their bounds", () => {
    const view = parseArchimate(XML).views[0]!;
    expect(scoreOf(view).crossings).toBe(1);
    const r = detangle(view);
    expect(r.after.crossings + r.after.throughBox).toBe(0);
    expect(r.changes[0]?.kind).toBe("swap");
    const out = writeBack(XML, r);
    expect(scoreOf(parseArchimate(out).views[0]!).crossings).toBe(0);
    // Two bounds lines change and nothing else.
    const a = XML.split("\n"), b = out.split("\n");
    expect(b.length).toBe(a.length);
    expect(a.filter((l, i) => l !== b[i]).every((l) => l.includes("<bounds"))).toBe(true);
  });

  it("with --routes-only, re-routes a line instead, as Archi bendpoints", () => {
    const view = parseArchimate(XML).views[0]!;
    // A box in the middle that a straight a→d runs through; routes may go round it.
    view.nodes.push({ id: "id-nx", kind: "note", text: "x", x: 160, y: 150, w: 100, h: 55 });
    view.connections = view.connections.filter((c) => c.id === "id-c1");
    expect(scoreOf(view).throughBox).toBe(1);
    const r = detangle(view, { routesOnly: true });
    expect(r.after.throughBox).toBe(0);
    expect(r.rerouted.has("id-c1")).toBe(true);
    const out = writeBack(XML, r);
    expect(out).toContain("<bendpoint");
    expect(parseArchimate(out).views[0]!.connections.find((c) => c.id === "id-c1")!.bendpoints.length).toBeGreaterThan(0);
  });

  it("slides a box into free space inside its parent to clear a line, never out of it", () => {
    const view = parseArchimate(XML).views[0]!;
    // m sits between a and b on the line a→b; there is room above it.
    view.nodes = [
      { id: "id-na", kind: "element", ref: "id-a", x: 0, y: 200, w: 120, h: 55 },
      { id: "id-nb", kind: "element", ref: "id-b", x: 400, y: 200, w: 120, h: 55 },
      { id: "id-nm", kind: "element", ref: "id-c", x: 200, y: 190, w: 100, h: 75 },
    ];
    view.connections = [{ id: "id-c1", source: "id-na", target: "id-nb", relationship: "id-r1", bendpoints: [] }];
    expect(scoreOf(view).throughBox).toBe(1);
    const r = detangle(view, { passes: 1 });
    expect(r.after.throughBox).toBe(0);
    // m is not the size of a or b, so no swap: a slides, and no line is re-routed.
    expect(r.changes).toEqual([{ kind: "slide", ids: ["id-na"] }]);
    expect(r.rerouted.size).toBe(0);
    // Into free space: the slid box overlaps no other box.
    const free = (v: typeof view, id: string): boolean => {
      const n = v.nodes.find((x) => x.id === id)!;
      return v.nodes.every((o) => o.id === id || o.id === n.parent || n.x >= o.x + o.w || n.x + n.w <= o.x || n.y >= o.y + o.h || n.y + n.h <= o.y);
    };
    expect(free(r.view, "id-na")).toBe(true);
    // Inside a parent with room below, a slide stays inside it.
    const inParent = (h: number) => {
      const v = parseArchimate(XML).views[0]!;
      v.nodes = [
        { id: "id-p", kind: "group", text: "P", x: 0, y: 0, w: 600, h },
        { id: "id-na", kind: "element", ref: "id-a", x: 10, y: 40, w: 120, h: 55, parent: "id-p" },
        { id: "id-nb", kind: "element", ref: "id-b", x: 470, y: 40, w: 120, h: 55, parent: "id-p" },
        { id: "id-nm", kind: "element", ref: "id-c", x: 240, y: 30, w: 100, h: 75, parent: "id-p" },
      ];
      v.connections = [{ id: "id-c1", source: "id-na", target: "id-nb", relationship: "id-r1", bendpoints: [] }];
      return v;
    };
    const inside = (v: typeof view) => {
      const p = v.nodes.find((n) => n.id === "id-p")!;
      return v.nodes.filter((n) => n.parent === "id-p").every((n) => n.x >= p.x && n.y >= p.y && n.x + n.w <= p.x + p.w && n.y + n.h <= p.y + p.h);
    };
    const roomy = detangle(inParent(300), { passes: 1 });
    expect(roomy.changes).toEqual([{ kind: "slide", ids: ["id-na"] }]);
    expect(roomy.after.throughBox).toBe(0);
    expect(free(roomy.view, "id-na")).toBe(true);
    expect(inside(roomy.view)).toBe(true);
    // In a parent with no room, the free space outside it (where a slid above, unparented) is not used.
    const tight = inParent(120);
    const r2 = detangle(tight, { passes: 1 });
    expect(r2.changes.some((c) => c.kind === "slide")).toBe(false);
    expect(r2.view.nodes.map((n) => [n.id, n.x, n.y])).toEqual(tight.nodes.map((n) => [n.id, n.x, n.y]));
    expect(inside(r2.view)).toBe(true);
  });

  it("leaves a clean view as it is", () => {
    const view = parseArchimate(XML).views[0]!;
    view.connections = view.connections.slice(0, 1);
    view.nodes = view.nodes.filter((n) => n.id !== "id-nb" && n.id !== "id-nc");
    const r = detangle(view);
    expect(r.changes).toEqual([]);
    expect(writeBack(XML, r)).toBe(XML);
  });

  it("writes Archi's zipped archive back as a zip that reads", () => {
    const raw = Buffer.from(XML, "utf8");
    const data = deflateRawSync(raw);
    const name = Buffer.from("model.xml");
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(8, 8); lh.writeUInt32LE(data.length, 18); lh.writeUInt32LE(raw.length, 22); lh.writeUInt16LE(name.length, 26);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(8, 10); ch.writeUInt32LE(data.length, 20); ch.writeUInt32LE(raw.length, 24); ch.writeUInt16LE(name.length, 28);
    const cd = Buffer.concat([ch, name]);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(1, 8); end.writeUInt16LE(1, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(30 + name.length + data.length, 16);
    const zip = Buffer.concat([lh, name, data, cd, end]);
    const next = XML.replace('name="M"', 'name="M2"');
    expect(modelXmlOf(withModelXml(zip, next))).toBe(next);
    expect(withModelXml(raw, next).toString("utf8")).toBe(next);
  });
});
