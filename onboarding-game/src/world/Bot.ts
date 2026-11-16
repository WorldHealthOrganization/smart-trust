import * as THREE from 'three';
import { glowMat } from './models';

export type BotMood = 'idle' | 'happy' | 'checking' | 'error';

/**
 * tng-bot: WHO's GitHub bot. An original character (glossy floating egg, wraparound
 * visor, key emblem). It only appears doing its real job: collecting public keys
 * from the country's private repos and checking the signed tag.
 */
export class Bot {
  readonly group = new THREE.Group();
  private body = new THREE.Group();
  private eyeCanvas = document.createElement('canvas');
  private eyeTex: THREE.CanvasTexture;
  private arms: THREE.Group[] = [];
  private ring: THREE.Mesh;
  private tip: THREE.Mesh;
  private beam: THREE.Mesh;
  private mood: BotMood = 'idle';
  private moodT = 0;
  private nextBlink = 2;
  private blinkT = -1;
  private path: { curve: THREE.CatmullRomCurve3; u: number; dur: number; done: () => void } | null = null;

  constructor(scale = 0.5) {
    const SX = 0.82, SY = 1.12;
    const shell = new THREE.MeshPhysicalMaterial({ color: '#f7f8fc', roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 0.55 });
    this.group.add(this.body);
    this.body.scale.setScalar(scale);

    const bodyGeo = new THREE.SphereGeometry(1, 64, 48);
    const pos = bodyGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      if (y < 0) { const k = 1 + y * 0.42; pos.setX(i, pos.getX(i) * k); pos.setZ(i, pos.getZ(i) * k); }
    }
    bodyGeo.computeVertexNormals();
    const body = new THREE.Mesh(bodyGeo, shell); body.scale.set(SX, SY, SX); body.castShadow = true;
    this.body.add(body);

    const seam = new THREE.Mesh(new THREE.TorusGeometry(SX * 0.995, 0.012, 8, 96), glowMat('#62e6d2', 1.6));
    seam.rotation.x = Math.PI / 2; seam.position.y = -0.05; this.body.add(seam);

    this.eyeCanvas.width = 1024; this.eyeCanvas.height = 384;
    this.eyeTex = new THREE.CanvasTexture(this.eyeCanvas);
    this.eyeTex.colorSpace = THREE.SRGBColorSpace;
    const L = 2.1;
    const visor = new THREE.Mesh(
      new THREE.SphereGeometry(1, 64, 32, Math.PI / 2 - L / 2, L, 0.62, 0.66),
      new THREE.MeshPhysicalMaterial({
        color: '#0b1026', roughness: 0.3, clearcoat: 0.7, clearcoatRoughness: 0.12,
        emissive: '#ffffff', emissiveMap: this.eyeTex, emissiveIntensity: 2.6, envMapIntensity: 0.08,
      }),
    );
    visor.scale.set(SX * 1.012, SY * 1.012, SX * 1.012);
    this.body.add(visor);

    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.32, 12), shell);
    antenna.position.y = SY + 0.12; this.body.add(antenna);
    this.tip = new THREE.Mesh(new THREE.SphereGeometry(0.07, 20, 20), glowMat('#62e6d2', 2.4));
    this.tip.position.y = SY + 0.31; this.body.add(this.tip);

    const emblem = new THREE.Group(); this.body.add(emblem);
    const emb = glowMat('#62e6d2', 2.0);
    emblem.add(new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.018, 10, 32), emb));
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.03, 0.02), emb); shaft.position.x = 0.15; emblem.add(shaft);
    const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.06, 0.02), emb); tooth.position.set(0.2, -0.035, 0); emblem.add(tooth);
    emblem.position.set(-0.05, -0.38, SX * 0.83); emblem.rotation.x = -0.32;

    const finGeo = new THREE.SphereGeometry(0.22, 32, 24);
    for (const s of [-1, 1]) {
      const pivot = new THREE.Group(); pivot.position.set(s * (SX + 0.08), 0, 0); this.body.add(pivot);
      const fin = new THREE.Mesh(finGeo, shell); fin.scale.set(0.45, 1.9, 0.75); fin.position.y = -0.3; pivot.add(fin);
      pivot.userData.s = s; this.arms.push(pivot);
    }

    this.ring = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.025, 12, 64), glowMat('#62e6d2', 2.2));
    this.ring.rotation.x = Math.PI / 2; this.ring.position.y = -1.6; this.body.add(this.ring);

    const beamGeo = new THREE.ConeGeometry(0.55, 1.7, 48, 1, true);
    beamGeo.translate(0, -0.85, 0);
    this.beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: '#79e8ff', transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false }));
    this.beam.rotation.x = -0.6; this.beam.position.set(0, -0.2, SX + 0.3); this.body.add(this.beam);

    this.drawEyes();
  }

  setMood(m: BotMood) { this.mood = m; this.moodT = 0; this.drawEyes(); }

  /** Stop any flight now, landing at its destination. */
  cancel() {
    const p = this.path;
    if (!p) return;
    this.path = null;
    this.group.position.copy(p.curve.getPointAt(1));
    this.group.rotation.y = 0;
    p.done();
  }

  /** Fly along a list of points; resolves on arrival. */
  flyAlong(points: THREE.Vector3[], speed = 6): Promise<void> {
    const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
    const dur = Math.max(1.2, curve.getLength() / speed);
    return new Promise(done => { this.path = { curve, u: 0, dur, done }; });
  }

  update(t: number, dt: number) {
    this.moodT += dt;
    if (this.path) {
      const p = this.path;
      p.u = Math.min(1, p.u + dt / p.dur);
      const e = p.u < 0.5 ? 2 * p.u * p.u : 1 - Math.pow(-2 * p.u + 2, 2) / 2;
      const pt = p.curve.getPointAt(e);
      const ahead = p.curve.getPointAt(Math.min(1, e + 0.01));
      this.group.position.copy(pt);
      if (ahead.distanceToSquared(pt) > 1e-6) this.group.rotation.y = Math.atan2(ahead.x - pt.x, ahead.z - pt.z);
      if (p.u >= 1) { this.path = null; this.group.rotation.y = 0; p.done(); }
    }
    const hover = Math.sin(t * 1.6) * 0.06;
    const happyHop = this.mood === 'happy' ? Math.abs(Math.sin(this.moodT * 6)) * 0.12 * Math.max(0, 1 - this.moodT / 1.5) : 0;
    this.body.position.y = hover + happyHop;
    this.body.position.x = this.mood === 'error' && this.moodT < 0.8 ? Math.sin(this.moodT * 40) * 0.04 * (1 - this.moodT / 0.8) : 0;
    this.body.rotation.y = this.mood === 'happy' && this.moodT < 1.2 ? (this.moodT / 1.2) * Math.PI * 2 : 0;
    this.body.rotation.z = Math.sin(t * 1.1) * 0.04;
    for (const a of this.arms) {
      const s = a.userData.s as number;
      a.rotation.z = s * (0.18 + Math.sin(t * 1.6 + s) * 0.08 + (this.mood === 'happy' ? 0.6 : 0));
    }
    const col = this.mood === 'error' ? '#ff5a5f' : this.mood === 'happy' ? '#7cf0b0' : '#62e6d2';
    (this.ring.material as THREE.MeshBasicMaterial).color.set(col).multiplyScalar(1.8 + Math.sin(t * 3) * 0.4);
    (this.tip.material as THREE.MeshBasicMaterial).color.copy((this.ring.material as THREE.MeshBasicMaterial).color);
    this.beam.visible = this.mood === 'checking';
    if (this.beam.visible) this.beam.rotation.y = Math.sin(t * 2.2) * 0.3;
    if (t > this.nextBlink && this.blinkT < 0 && this.mood !== 'checking') { this.blinkT = 0; this.drawEyes(true); }
    if (this.blinkT >= 0) {
      this.blinkT += dt;
      if (this.blinkT > 0.13) { this.blinkT = -1; this.nextBlink = t + 2.5 + Math.random() * 2.5; this.drawEyes(); }
    }
  }

  private drawEyes(blink = false) {
    const g = this.eyeCanvas.getContext('2d')!;
    const W = this.eyeCanvas.width, H = this.eyeCanvas.height;
    g.clearRect(0, 0, W, H);
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    const col = { idle: '#79e8ff', happy: '#7cf0b0', checking: '#79e8ff', error: '#ff5a5f' }[this.mood];
    g.fillStyle = col; g.strokeStyle = col; g.shadowColor = col; g.shadowBlur = 28;
    g.lineCap = 'round'; g.lineWidth = 40;
    const cy = H / 2 + 6;
    for (const x of [W / 2 - 150, W / 2 + 150]) {
      g.beginPath();
      if (blink) { g.moveTo(x - 65, cy); g.lineTo(x + 65, cy); g.stroke(); continue; }
      if (this.mood === 'happy') { g.arc(x, cy + 60, 90, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); }
      else if (this.mood === 'checking') { g.roundRect(x - 80, cy - 28, 160, 56, 28); g.fill(); }
      else if (this.mood === 'error') {
        const s = x < W / 2 ? 1 : -1;
        g.moveTo(x - 60 * s, cy - 70); g.lineTo(x + 50 * s, cy); g.lineTo(x - 60 * s, cy + 70); g.stroke();
      } else { g.roundRect(x - 62, cy - 120, 124, 240, 60); g.fill(); }
    }
    this.eyeTex.needsUpdate = true;
  }
}
