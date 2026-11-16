import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// Shared palette for the soft-glow look
export const C = {
  base: '#4f5490',
  top: '#5f65a2',
  plot: '#e9ebf7',
  white: '#f4f4fb',
  trim: '#e1e4f4',
  window: '#7d95e0',
  dome: '#6f8ce0',
  domeLight: '#86a2ea',
  tree: '#5fae5b',
  trunk: '#8a6a4a',
  country: '#f2b64a',
  network: '#45d6c2',
  who: '#6f9cf0',
  github: '#b39cf5',
  paper: '#f39a4a',
  red: '#ff5a5f',
  green: '#4fe0a0',
};

export const std = (color: THREE.ColorRepresentation, o: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0, ...o });

export const glowMat = (color: THREE.ColorRepresentation, k = 2.2) =>
  new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), toneMapped: false });

export function add(
  parent: THREE.Object3D,
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  x = 0, y = 0, z = 0,
  shadow = true,
): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = shadow;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

export function tree(p: THREE.Object3D, x: number, z: number, s = 1, base = 0.32) {
  add(p, new THREE.CylinderGeometry(0.06 * s, 0.08 * s, 0.35 * s, 8), std(C.trunk), x, base + 0.17 * s, z);
  const crown = add(p, new THREE.SphereGeometry(0.32 * s, 20, 16), std(C.tree, { roughness: 0.7 }), x, base + 0.62 * s, z);
  crown.scale.set(1, 1.35, 1);
}

export function signTexture(text: string, w = 512, h = 128, bg = '#dfe8ff', fg = '#3953a8') {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d')!;
  g.fillStyle = bg;
  g.beginPath(); g.roundRect(4, 4, w - 8, h - 8, 24); g.fill();
  g.strokeStyle = '#ffffff'; g.lineWidth = 8; g.stroke();
  g.fillStyle = fg;
  g.font = `800 ${Math.floor(h * 0.5)}px system-ui, Helvetica, Arial`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, w / 2, h / 2 + 3);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export function dome(p: THREE.Object3D, r: number, x: number, y: number, z: number, color: string = C.dome) {
  const g = new THREE.Group(); g.position.set(x, y, z); p.add(g);
  add(g, new THREE.SphereGeometry(r, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2), std(color, { roughness: 0.35 }));
  const rib = std('#e2e8ff', { roughness: 0.4 });
  for (let i = 0; i < 4; i++) {
    const m = add(g, new THREE.TorusGeometry(r * 1.005, r * 0.022, 6, 48, Math.PI), rib);
    m.rotation.y = (i * Math.PI) / 4;
  }
  for (const lat of [0.35, 0.8]) {
    const m = add(g, new THREE.TorusGeometry(r * Math.cos(lat) * 1.005, r * 0.022, 6, 48), rib, 0, r * Math.sin(lat), 0);
    m.rotation.x = Math.PI / 2;
  }
  return g;
}

/** Points around a rounded rectangle (local x/z), used for territory boundaries. */
function roundedRectPoints(w: number, d: number, r: number, perArc = 8, step = 0.45): THREE.Vector3[] {
  const pts: THREE.Vector3[] = [];
  const hw = w / 2 - r, hd = d / 2 - r;
  const corners: [number, number, number][] = [[hw, hd, 0], [-hw, hd, Math.PI / 2], [-hw, -hd, Math.PI], [hw, -hd, (3 * Math.PI) / 2]];
  const straight = (a: THREE.Vector3, b: THREE.Vector3) => {
    const n = Math.max(1, Math.round(a.distanceTo(b) / step));
    for (let i = 1; i < n; i++) pts.push(a.clone().lerp(b, i / n));
  };
  let prevEnd: THREE.Vector3 | null = null;
  let firstStart: THREE.Vector3 | null = null;
  for (const [cx, cz, a0] of corners) {
    const start = new THREE.Vector3(cx + Math.cos(a0) * r, 0, cz + Math.sin(a0) * r);
    if (prevEnd) straight(prevEnd, start); else firstStart = start;
    for (let i = 0; i <= perArc; i++) {
      const a = a0 + (i / perArc) * (Math.PI / 2);
      pts.push(new THREE.Vector3(cx + Math.cos(a) * r, 0, cz + Math.sin(a) * r));
    }
    prevEnd = pts[pts.length - 1];
  }
  if (prevEnd && firstStart) straight(prevEnd, firstStart);
  return pts;
}

/** A territory: a large rounded platform with a glowing dashed boundary in its own colour. */
export function territory(scene: THREE.Object3D, x: number, z: number, w: number, d: number, color: string) {
  const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
  add(g, new RoundedBoxGeometry(w, 0.9, d, 6, 0.6), std(C.base), 0, -0.35, 0);
  add(g, new RoundedBoxGeometry(w - 0.3, 0.2, d - 0.3, 4, 0.12), std(C.top), 0, 0.12, 0);
  const pts = roundedRectPoints(w - 0.9, d - 0.9, 0.9);
  const dashMat = glowMat(color, 2.0);
  const dashGeo = new THREE.BoxGeometry(1, 0.07, 0.09);
  for (let i = 0; i < pts.length; i += 2) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const m = new THREE.Mesh(dashGeo, dashMat);
    m.position.set((a.x + b.x) / 2, 0.25, (a.z + b.z) / 2);
    m.scale.x = Math.max(0.05, a.distanceTo(b));
    m.rotation.y = -Math.atan2(b.z - a.z, b.x - a.x);
    g.add(m);
  }
  return { group: g, dashMat };
}

/** A light building plot sitting on a territory. */
export function plot(parent: THREE.Object3D, x: number, z: number, w: number, d: number) {
  return add(parent, new RoundedBoxGeometry(w, 0.1, d, 3, 0.05), std(C.plot), x, 0.27, z);
}

// ---------- buildings (each built around its own origin, ground at y = 0.32) ----------

export function ministry(): THREE.Group {
  const root = new THREE.Group();
  const b = new THREE.Group(); b.position.set(0, 0.1, -0.4); root.add(b);
  const white = std(C.white), trim = std(C.trim), win = std(C.window, { roughness: 0.3 });
  add(b, new RoundedBoxGeometry(4, 1.4, 2.4, 3, 0.06), white, 0, 0.92, 0);
  add(b, new RoundedBoxGeometry(4.2, 0.15, 2.6, 2, 0.04), trim, 0, 1.69, 0);
  for (let i = 0; i < 6; i++) add(b, new THREE.CylinderGeometry(0.1, 0.11, 1.2, 16), white, -1.0 + i * 0.4, 0.82, 1.5);
  add(b, new THREE.BoxGeometry(2.6, 0.22, 0.6), trim, 0, 1.53, 1.45);
  const fr = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.18), new THREE.MeshBasicMaterial({ map: ministrySign('XC') }));
  fr.position.set(0, 1.53, 1.751); b.add(fr);
  root.userData.sign = fr;
  const tri = new THREE.Shape(); tri.moveTo(-1.35, 0); tri.lineTo(1.35, 0); tri.lineTo(0, 0.5); tri.closePath();
  add(b, new THREE.ExtrudeGeometry(tri, { depth: 0.55, bevelEnabled: false }), white, 0, 1.64, 1.2);
  add(b, new THREE.BoxGeometry(2.8, 0.08, 0.35), trim, 0, 0.26, 1.95);
  add(b, new THREE.BoxGeometry(2.6, 0.08, 0.3), trim, 0, 0.34, 1.75);
  for (const x of [-1.75, -1.4, 1.4, 1.75]) for (const y of [0.65, 1.2]) add(b, new THREE.BoxGeometry(0.2, 0.3, 0.03), win, x, y, 1.21, false);
  for (const z of [-0.8, -0.27, 0.27, 0.8]) for (const y of [0.65, 1.2]) {
    add(b, new THREE.BoxGeometry(0.03, 0.3, 0.2), win, 2.01, y, z, false);
    add(b, new THREE.BoxGeometry(0.03, 0.3, 0.2), win, -2.01, y, z, false);
  }
  add(b, new THREE.CylinderGeometry(0.5, 0.5, 0.3, 32), white, 0, 1.9, 0);
  dome(b, 0.48, 0, 2.05, 0);
  add(b, new THREE.CylinderGeometry(0.02, 0.02, 0.7, 8), std('#9aa0c8'), 0, 2.85, 0);
  add(b, new THREE.BoxGeometry(0.32, 0.2, 0.01), std('#f2b64a'), 0.17, 3.08, 0);
  tree(root, -2.6, 1.6, 0.8); tree(root, 2.6, 1.6, 0.8);
  return root;
}

export const ministrySign = (code: string) => signTexture(code ? `MINISTRY OF HEALTH · ${code}` : 'MINISTRY OF HEALTH', 1024, 80, '#e1e4f4', '#3d4a8a');

export function backend(): THREE.Group {
  const root = new THREE.Group();
  const rackMat = std('#dfe2f6', { roughness: 0.4 });
  const leds = [C.network, '#8fb4ff', '#7cf0b0'];
  [[-1.9, -0.3], [-0.7, -0.5], [0.5, -0.3]].forEach(([x, z], i) => {
    add(root, new RoundedBoxGeometry(1, 1.8, 1, 3, 0.12), rackMat, x, 1.22, z);
    for (let k = 0; k < 4; k++) {
      add(root, new THREE.BoxGeometry(0.6, 0.06, 0.02), glowMat(leds[(i + k) % 3], 1.7), x, 0.65 + k * 0.38, z + 0.51, false);
    }
  });
  // offline SCA vault: a heavy safe with no cables, amber light
  const vault = new THREE.Group(); vault.position.set(2.1, 0, 0.1); root.add(vault);
  add(vault, new RoundedBoxGeometry(1.3, 1.4, 1.2, 4, 0.16), std('#3a3f72', { roughness: 0.35 }), 0, 1.02, 0);
  const ring = add(vault, new THREE.TorusGeometry(0.36, 0.05, 12, 48), glowMat(C.country, 2.2), 0, 1.02, 0.61, false);
  ring.rotation.z = Math.PI / 4;
  for (let i = 0; i < 3; i++) {
    const s = add(vault, new THREE.BoxGeometry(0.5, 0.05, 0.04), std('#c9cdea'), 0, 1.02, 0.63, false);
    s.rotation.z = (i * Math.PI) / 3;
  }
  add(vault, new THREE.CylinderGeometry(0.75, 0.75, 0.06, 40), std('#2f335f'), 0, 0.33, 0);
  return root;
}

export function secretariat(): THREE.Group {
  const root = new THREE.Group();
  add(root, new THREE.CylinderGeometry(1.3, 1.3, 1.2, 48), std('#e9ecfb'), 0, 0.92, -0.3);
  add(root, new THREE.CylinderGeometry(1.33, 1.33, 0.16, 48, 1, true), glowMat(C.network, 1.8), 0, 1.0, -0.3, false);
  add(root, new THREE.CylinderGeometry(1.36, 1.36, 0.12, 48), std('#dfe3f7'), 0, 1.54, -0.3);
  dome(root, 1.25, 0, 1.6, -0.3);
  for (const [x, z, r] of [[-2.1, 0.4, 0.85], [2.1, 0.2, 0.8]] as const) {
    add(root, new THREE.CylinderGeometry(r, r, 0.55, 40), std('#e9ecfb'), x, 0.6, z);
    add(root, new THREE.CylinderGeometry(r + 0.03, r + 0.03, 0.12, 40, 1, true), glowMat(C.network, 1.6), x, 0.65, z, false);
    dome(root, r * 0.95, x, 0.88, z, C.domeLight);
  }
  const sign = add(root, new THREE.BoxGeometry(1.5, 0.55, 0.1), std('#ffffff'), 0, 0.72, 1.45);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.45), new THREE.MeshBasicMaterial({ map: signTexture('WHO') }));
  face.position.z = 0.051; sign.add(face);
  tree(root, -2.6, -1.3, 0.9); tree(root, 2.7, -1.2, 0.8);
  return root;
}

export function operations(): { group: THREE.Group; anchor: THREE.Mesh } {
  const root = new THREE.Group();
  // office block with glowing screens
  add(root, new RoundedBoxGeometry(2.4, 1.5, 1.8, 3, 0.1), std(C.white), -1.4, 1.07, -0.2);
  add(root, new RoundedBoxGeometry(2.6, 0.14, 2.0, 2, 0.05), std(C.trim), -1.4, 1.88, -0.2);
  for (const x of [-2.1, -1.4, -0.7]) add(root, new THREE.BoxGeometry(0.45, 0.32, 0.03), glowMat('#8fb4ff', 1.4), x, 1.15, 0.71, false);
  // air-gapped signing room: glass cube, no cables, Trust Anchor floating inside
  const room = new THREE.Group(); room.position.set(1.3, 0, 0); root.add(room);
  add(room, new THREE.CylinderGeometry(1.25, 1.25, 0.08, 48), std('#2f335f'), 0, 0.36, 0);
  const glass = new THREE.Mesh(new RoundedBoxGeometry(2.0, 1.7, 2.0, 4, 0.14),
    new THREE.MeshPhysicalMaterial({ color: '#dfe8ff', roughness: 0.08, transmission: 0.7, thickness: 0.4, transparent: true, opacity: 0.55 }));
  glass.position.y = 1.25; room.add(glass);
  add(room, new THREE.CylinderGeometry(0.22, 0.3, 0.6, 24), std('#e9ecfb'), 0, 0.7, 0);
  const anchor = add(room, new THREE.OctahedronGeometry(0.32, 0), glowMat('#7fb0ff', 2.4), 0, 1.4, 0, false);
  // offline backup: a small safe beside the room
  add(room, new RoundedBoxGeometry(0.6, 0.6, 0.6, 3, 0.08), std('#3a3f72'), 1.55, 0.62, 0.55);
  add(room, new THREE.TorusGeometry(0.15, 0.03, 8, 32), glowMat('#7fb0ff', 2), 1.55, 0.62, 0.86, false);
  return { group: root, anchor };
}

export function gateway(size: number, accent: string): { group: THREE.Group; ring: THREE.Mesh; badge: THREE.Group } {
  const root = new THREE.Group();
  add(root, new THREE.CylinderGeometry(1.35 * size, 1.45 * size, 0.35, 64), std('#e9ecfb'), 0, 0.5, 0);
  const ring = add(root, new THREE.TorusGeometry(1.08 * size, 0.07, 16, 96), glowMat(accent, 2.4), 0, 0.7, 0, false);
  ring.rotation.x = Math.PI / 2;
  add(root, new THREE.CylinderGeometry(1.0 * size, 1.0 * size, 0.06, 64), std('#f7f8ff'), 0, 0.68, 0);
  // server pillars that hold the public keys and trust lists
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const x = Math.cos(a) * 1.75 * size, z = Math.sin(a) * 1.75 * size;
    add(root, new RoundedBoxGeometry(0.42, 0.9, 0.42, 2, 0.08), std('#dfe2f6'), x, 0.77, z);
    add(root, new THREE.BoxGeometry(0.3, 0.05, 0.02), glowMat(accent, 1.8), x, 0.95, z + 0.22, false);
  }
  const badge = new THREE.Group(); badge.position.set(0, 2.3, 0); root.add(badge);
  const bs = new THREE.Shape();
  for (let i = 0; i <= 120; i++) {
    const a = (i / 120) * Math.PI * 2, r = 0.62 + 0.05 * Math.cos(12 * a);
    if (i) bs.lineTo(Math.cos(a) * r, Math.sin(a) * r); else bs.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  const bg = new THREE.ExtrudeGeometry(bs, { depth: 0.14, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 4 });
  bg.center();
  add(badge, bg, std('#5f7fe0', { roughness: 0.3 }));
  const inner = add(badge, new THREE.CylinderGeometry(0.44, 0.44, 0.2, 48), std('#8ff0dc', { emissive: '#4fd8bf', emissiveIntensity: 0.5, roughness: 0.3 }));
  inner.rotation.x = Math.PI / 2;
  const chk = std('#ffffff', { emissive: '#ffffff', emissiveIntensity: 0.3 });
  const c1 = add(badge, new THREE.CapsuleGeometry(0.05, 0.14, 4, 12), chk, -0.13, -0.07, 0.12); c1.rotation.z = Math.PI / 4;
  const c2 = add(badge, new THREE.CapsuleGeometry(0.05, 0.36, 4, 12), chk, 0.08, 0.01, 0.12); c2.rotation.z = -0.75;
  badge.scale.setScalar(size);
  return { group: root, ring, badge };
}

/** Velvet-rope style barrier around the PROD gateway until testing passes. */
export function barrier(radius: number): THREE.Group {
  const g = new THREE.Group();
  const posts = 10;
  for (let i = 0; i < posts; i++) {
    const a = (i / posts) * Math.PI * 2;
    add(g, new THREE.CylinderGeometry(0.06, 0.08, 0.7, 12), std('#e9ecfb'), Math.cos(a) * radius, 0.67, Math.sin(a) * radius);
    add(g, new THREE.SphereGeometry(0.09, 12, 12), glowMat(C.red, 2), Math.cos(a) * radius, 1.05, Math.sin(a) * radius, false);
  }
  const rope = add(g, new THREE.TorusGeometry(radius, 0.035, 8, 96), glowMat(C.red, 1.8), 0, 0.95, 0, false);
  rope.rotation.x = Math.PI / 2;
  return g;
}

export function repos(): THREE.Group {
  const root = new THREE.Group();
  const disc = std('#a9b2ee', { roughness: 0.35 });
  for (const [x, z] of [[-1.0, 0], [1.0, 0]]) {
    for (let k = 0; k < 3; k++) {
      add(root, new RoundedBoxGeometry(1.2, 0.42, 1.2, 3, 0.14), disc, x, 0.57 + k * 0.5, z);
      if (k < 2) add(root, new THREE.BoxGeometry(1.0, 0.05, 1.0), glowMat(C.github, 1.8), x, 0.82 + k * 0.5, z, false);
    }
  }
  return root;
}

/** The screen face of the expiry dashboard: a Grafana-style panel with one bar per certificate. */
function dashboardTexture() {
  const c = document.createElement('canvas');
  c.width = 700; c.height = 400;
  const g = c.getContext('2d')!;
  g.fillStyle = '#141833'; g.fillRect(0, 0, 700, 400);
  g.fillStyle = '#8f9bd0'; g.font = '800 34px system-ui, Helvetica, Arial';
  g.fillText('CERTIFICATE EXPIRY', 36, 62);
  ['DEV', 'UAT', 'PROD'].forEach((t, i) => {
    g.fillStyle = i === 2 ? '#2f5fb4' : '#22284a';
    g.beginPath(); g.roundRect(450 + i * 72, 34, 64, 34, 8); g.fill();
    g.fillStyle = i === 2 ? '#ffffff' : '#8f9bd0'; g.font = '700 20px system-ui, Helvetica, Arial';
    g.fillText(t, 462 + i * 72 + (t === 'PROD' ? -4 : 2), 58);
  });
  const rows: [string, number, string][] = [['SCA', 0.75, C.green], ['DSC', 0.4, C.green], ['TLS', 0.23, C.green], ['UPLOAD', 0.04, C.red]];
  rows.forEach(([label, w, col], i) => {
    const y = 120 + i * 66;
    g.fillStyle = '#d6ddff'; g.font = '700 26px system-ui, Helvetica, Arial'; g.fillText(label, 36, y + 22);
    g.fillStyle = '#22284a'; g.beginPath(); g.roundRect(180, y, 480, 28, 14); g.fill();
    g.fillStyle = col; g.beginPath(); g.roundRect(180, y, Math.max(28, 480 * w), 28, 14); g.fill();
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** WHO-run certificate expiry dashboard: a big screen on a stand, tilted towards the camera. */
export function dashboard(): THREE.Group {
  const root = new THREE.Group();
  add(root, new THREE.CylinderGeometry(0.9, 1.0, 0.12, 40), std('#2f335f'), 0, 0.38, 0);
  add(root, new THREE.CylinderGeometry(0.1, 0.12, 1.2, 16), std('#c9cdea'), 0, 1.0, -0.1);
  const screen = new THREE.Group(); screen.position.set(0, 2.05, 0); screen.rotation.x = -0.3; root.add(screen);
  add(screen, new RoundedBoxGeometry(3.0, 1.8, 0.14, 3, 0.06), std('#3a3f72', { roughness: 0.35 }));
  const face = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 1.6), new THREE.MeshBasicMaterial({ map: dashboardTexture(), toneMapped: false }));
  face.position.z = 0.071; screen.add(face);
  add(screen, new THREE.BoxGeometry(2.9, 0.05, 0.02), glowMat(C.who, 1.8), 0, -0.93, 0.07, false);
  return root;
}

/** Easter egg: a small cat, sitting or curled up asleep. Ground at y = 0. */
export function cat(sleeping = false, opts: { bandit?: boolean } = {}): THREE.Group {
  const g = new THREE.Group();
  const fur = std('#e8a35c', { roughness: 0.8 }), pale = std('#fff3e3', { roughness: 0.8 }), pink = std('#f2a7b0');
  if (sleeping) {
    const body = add(g, new THREE.SphereGeometry(0.16, 20, 14), fur, 0, 0.09, 0); body.scale.set(1.35, 0.6, 1);
    const head = add(g, new THREE.SphereGeometry(0.095, 18, 12), fur, 0.17, 0.08, 0.06); head.scale.set(1, 0.85, 1);
    for (const s of [-1, 1]) {
      const ear = add(g, new THREE.ConeGeometry(0.035, 0.07, 8), fur, 0.2, 0.15, 0.06 + s * 0.05);
      ear.rotation.z = -0.5;
    }
    const tail = add(g, new THREE.TorusGeometry(0.17, 0.028, 8, 24, Math.PI * 1.1), fur, 0, 0.05, 0);
    tail.rotation.x = Math.PI / 2; tail.rotation.z = 0.4;
  } else {
    const body = add(g, new THREE.SphereGeometry(0.15, 20, 14), fur, 0, 0.15, 0); body.scale.set(1, 1.15, 0.85);
    add(g, new THREE.SphereGeometry(0.08, 14, 10), pale, 0, 0.17, 0.09);
    add(g, new THREE.SphereGeometry(0.105, 18, 12), fur, 0, 0.35, 0.04);
    if (opts.bandit) {
      // a black mask: a band round the front of the head at eye height, with the eyes showing on top
      const ink = std('#17171c', { roughness: 0.7 }), eye = std('#fffbe8', { roughness: 0.4 });
      add(g, new THREE.SphereGeometry(0.109, 20, 8, Math.PI / 2 - 1.75, 3.5, 1.28, 0.6), ink, 0, 0.35, 0.04, false);
      for (const s of [-1, 1]) {
        const e = add(g, new THREE.SphereGeometry(0.02, 12, 8), eye, s * 0.04, 0.36, 0.142, false);
        e.scale.set(1, 1.15, 0.5);
      }
    }
    for (const s of [-1, 1]) {
      add(g, new THREE.ConeGeometry(0.04, 0.08, 8), fur, s * 0.06, 0.45, 0.04);
      add(g, new THREE.ConeGeometry(0.022, 0.045, 8), pink, s * 0.06, 0.445, 0.055);
    }
    const tail = add(g, new THREE.TorusGeometry(0.12, 0.025, 8, 20, Math.PI), fur, -0.12, 0.08, -0.04);
    tail.rotation.y = Math.PI / 2;
  }
  return g;
}
