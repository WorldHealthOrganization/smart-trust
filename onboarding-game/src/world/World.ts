import * as THREE from 'three';
import { t } from '../i18n';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import {
  C, add, backend, barrier, cat, dashboard, gateway, glowMat, ministry, ministrySign, operations, plot, repos, secretariat, std, territory, tree,
} from './models';
import { Bot } from './Bot';

/** A 3D label that shows the GitHub glossary tooltip (the label layer itself ignores the pointer). */
function tipLabel(el: HTMLElement) {
  el.dataset.tip = 'github';
  el.tabIndex = 0;
  el.classList.add('has-tip');
}

export type PlaceId = 'ministry' | 'backend' | 'uat' | 'prod' | 'secretariat' | 'ops' | 'github' | 'dashboard';
export type RouteId =
  | 'paper' | 'ministry-backend' | 'secretariat-ops'
  | 'backend-uat' | 'backend-prod' | 'backend-github'
  | 'github-ops' | 'ops-uat' | 'ops-prod';
export type Leg = [RouteId, 1 | -1];
export type ParcelKind = 'paper' | 'key' | 'data';

interface Route { curve: THREE.CatmullRomCurve3; mat: THREE.MeshBasicMaterial; base: THREE.Color; length: number; dots: { m: THREE.Mesh; off: number }[] }
interface Place { pos: THREE.Vector3; name: string; blurb: string; group: THREE.Object3D }

const F = -0.74; // floor-level road height
const mirror = (pts: number[][]) => pts.map(([x, y, z]) => [-x, y, z]);

export class World {
  readonly places = {} as Record<PlaceId, Place>;
  readonly bot = new Bot(0.5);
  private renderer: THREE.WebGLRenderer;
  private labels: CSS2DRenderer;
  private composer: EffectComposer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private routes = {} as Record<RouteId, Route>;
  private flashing = new Map<RouteId, number>();
  private fly: { p0: THREE.Vector3; t0: THREE.Vector3; p1: THREE.Vector3; t1: THREE.Vector3; u: number; dur: number; done: () => void } | null = null;
  private parcels: { update: (dt: number) => boolean; cancel: () => void }[] = [];
  private countryLabel!: HTMLElement;
  private ministrySignMesh!: THREE.Mesh;
  /** Demo playback speed; 1 everywhere else. Scales flights, parcels, the bot and timed pulses. */
  timeScale = 1;
  private clock = new THREE.Clock();
  private home = { pos: new THREE.Vector3(), target: new THREE.Vector3(0, 0, 1.8) };
  private marker: THREE.Mesh;
  private prodBarrier: THREE.Group;
  private badges: THREE.Group[] = [];
  private gatewayRings: THREE.Mesh[] = [];
  private anchor!: THREE.Mesh;
  onPlaceClick: ((id: PlaceId) => void) | null = null;
  onCatClick: ((id: string) => void) | null = null;
  private cats = new Map<THREE.Object3D, string>();

  constructor(el: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    el.appendChild(this.renderer.domElement);

    this.labels = new CSS2DRenderer();
    this.labels.setSize(innerWidth, innerHeight);
    Object.assign(this.labels.domElement.style, { position: 'fixed', inset: '0', pointerEvents: 'none' });
    el.appendChild(this.labels.domElement);

    this.scene.background = new THREE.Color('#eceef7');
    // reflections only for the glossy bot; the world stays matte and soft
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.bot.group.traverse(o => {
      const mat = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      if (mat && 'envMap' in mat) mat.envMap = env;
    });

    this.camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.1, 400);
    this.fitHome();
    this.camera.position.copy(this.home.pos);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.copy(this.home.target);
    this.controls.enableDamping = true;
    this.controls.maxPolarAngle = 1.25;
    this.controls.enablePan = true; // right-drag, Shift/Ctrl/Cmd + drag, two fingers, or arrow keys; target kept inside the world below
    this.controls.keyPanSpeed = 20;
    // arrow keys pan once the world has been clicked (so typing in the title fields never moves the camera)
    this.renderer.domElement.tabIndex = 0;
    this.renderer.domElement.style.outline = 'none';
    this.controls.listenToKeyEvents(this.renderer.domElement);
    this.controls.minDistance = 6;
    this.controls.maxDistance = 90;
    this.controls.screenSpacePanning = false;

    this.scene.add(new THREE.HemisphereLight('#ffffff', '#aeb3dc', 1.1));
    const sun = new THREE.DirectionalLight('#ffffff', 1.5);
    sun.position.set(-12, 30, 14);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -28, right: 28, top: 28, bottom: -28, near: 1, far: 90 });
    sun.shadow.radius = 8;
    sun.shadow.bias = -0.0004;
    this.scene.add(sun);

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshStandardMaterial({ color: '#f1f2fa', roughness: 1 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -0.8; floor.receiveShadow = true;
    this.scene.add(floor);

    this.buildWorld();
    this.buildRoutes();
    this.hideCats();

    this.marker = new THREE.Mesh(new THREE.TorusGeometry(3.1, 0.06, 12, 128), glowMat('#ffffff', 1.6));
    this.marker.rotation.x = Math.PI / 2;
    this.marker.visible = false;
    this.scene.add(this.marker);

    this.prodBarrier = barrier(2.6);
    this.prodBarrier.position.copy(this.places.prod.pos).setY(0);
    this.scene.add(this.prodBarrier);

    this.bot.group.position.copy(this.places.ops.pos).add(new THREE.Vector3(0, 2.4, 1.8));
    this.scene.add(this.bot.group);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.6, 0.35, 1.0));
    this.composer.addPass(new OutputPass());

    this.bindPointer();
    addEventListener('resize', () => this.resize());
    this.loop();
  }

  // ---------- construction ----------

  private label(parent: THREE.Object3D, text: string, x: number, y: number, z: number, cls = 'w-label') {
    const d = document.createElement('div'); d.className = cls; d.textContent = text;
    const o = new CSS2DObject(d); o.position.set(x, y, z); parent.add(o);
    return d;
  }

  private place(id: PlaceId, name: string, blurb: string, x: number, z: number, group: THREE.Object3D, parent: THREE.Object3D) {
    group.position.set(x, 0, z);
    parent.add(group);
    this.places[id] = { pos: new THREE.Vector3(x, 0, z), name, blurb, group };
    const gw = id === 'uat' || id === 'prod';
    // gateway labels sit beside the gateway; building labels float above the roofline
    const el = this.label(this.scene, name, x + (gw ? 2.6 : 0), gw ? 1.4 : 3.6, z);
    if (id === 'github') tipLabel(el);
  }

  private buildWorld() {
    const s = this.scene;
    // three bounded territories plus GitHub as a neutral island
    territory(s, -10, 0, 9, 15, C.country);
    territory(s, 0, 0, 8, 13, C.network);
    territory(s, 10, 0, 9, 15, C.who);
    const gh = new THREE.Group(); gh.position.set(0, 0, 11); s.add(gh);
    add(gh, new RoundedBoxGeometry(7, 0.9, 4.4, 6, 0.42), std(C.base), 0, -0.35, 0);
    add(gh, new RoundedBoxGeometry(6.7, 0.2, 4.1, 4, 0.09), std('#dfe2f4'), 0, 0.12, 0);

    this.countryLabel = this.label(s, t('World.ts:territory.country'), -10, 0, -9.6, 'w-territory t-country');
    this.label(s, t('World.ts:territory.network'), 0, 0, -8.4, 'w-territory t-network');
    this.label(s, t('World.ts:territory.who'), 10, 0, -9.6, 'w-territory t-who');
    tipLabel(this.label(s, t('World.ts:territory.github'), 0, 0.4, 13.7, 'w-territory t-github'));
    // WHO-run certificate expiry dashboard (Grafana, one per environment), on its own island south of WHO
    const dash = new THREE.Group(); dash.position.set(10, 0, 11); s.add(dash);
    add(dash, new RoundedBoxGeometry(5.6, 0.9, 4.4, 6, 0.42), std(C.base), 0, -0.35, 0);
    add(dash, new RoundedBoxGeometry(5.3, 0.2, 4.1, 4, 0.09), std('#dfe2f4'), 0, 0.12, 0);
    this.label(s, t('World.ts:territory.dashboard'), 10, 0.4, 13.7, 'w-territory t-who');

    for (const [x, z] of [[-10, -3.6], [-10, 3.6], [10, -3.6], [10, 3.6]]) plot(s, x, z, 6.6, 5.2);

    const min = ministry();
    this.ministrySignMesh = min.userData.sign as THREE.Mesh;
    this.place('ministry', t('World.ts:place.ministry.name'), t('World.ts:place.ministry.blurb'), -10, -3.6, min, s);
    this.place('backend', t('World.ts:place.backend.name'), t('World.ts:place.backend.blurb'), -10, 3.6, backend(), s);
    this.place('secretariat', t('World.ts:place.secretariat.name'), t('World.ts:place.secretariat.blurb'), 10, -3.6, secretariat(), s);
    const ops = operations();
    this.anchor = ops.anchor;
    this.place('ops', t('World.ts:place.ops.name'), t('World.ts:place.ops.blurb'), 10, 3.6, ops.group, s);
    const uat = gateway(0.8, '#8ff6ff');
    this.place('uat', t('World.ts:place.uat.name'), t('World.ts:place.uat.blurb'), 0, -3.0, uat.group, s);
    const prod = gateway(1.0, '#8ff6ff');
    this.place('prod', t('World.ts:place.prod.name'), t('World.ts:place.prod.blurb'), 0, 3.0, prod.group, s);
    this.badges.push(uat.badge, prod.badge);
    this.gatewayRings.push(uat.ring, prod.ring);
    this.place('dashboard', t('World.ts:place.dashboard.name'), t('World.ts:place.dashboard.blurb'), 10, 11, dashboard(), s);
    this.place('github', t('World.ts:place.github.name'), t('World.ts:place.github.blurb', { country: t('settings.ts:DEFAULTS.country') }), 0, 11, repos(), s);

    this.label(s, t('World.ts:sub.vault'), -7.9, 2.6, 3.7, 'w-sub');
    this.label(s, t('World.ts:sub.airgap'), 11.3, 2.8, 3.6, 'w-sub');

    tree(s, -13.5, -6.5, 0.9); tree(s, -13.6, 6.6, 1.0); tree(s, 13.6, -6.6, 1.0); tree(s, 13.5, 6.5, 0.9);
    tree(s, -6.3, 0.2, 0.8); tree(s, 6.3, -0.2, 0.8);
    tree(s, 5.5, 9.5, 0.9, -0.8); tree(s, -6, 10.5, 1.0, -0.8); tree(s, 17, 2, 1.1, -0.8); tree(s, -17, -2, 1.0, -0.8);
  }

  private route(id: RouteId, pts: number[][], color: string, dotted = false) {
    const curve = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(p[0], p[1], p[2])), false, dotted ? 'centripetal' : 'catmullrom', 0.15);
    const mat = glowMat(color, dotted ? 3.0 : 2.6);
    if (dotted) {
      const n = Math.floor(curve.getLength() / 0.42);
      const g = new THREE.SphereGeometry(0.1, 10, 10);
      for (let i = 0; i <= n; i++) {
        const m = new THREE.Mesh(g, mat); m.position.copy(curve.getPointAt(i / n)); this.scene.add(m);
      }
    } else {
      this.scene.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 320, 0.065, 8, false), mat));
      this.scene.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 320, 0.14, 8, false),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.25, depthWrite: false })));
    }
    const r: Route = { curve, mat, base: mat.color.clone(), length: curve.getLength(), dots: [] };
    for (let i = 0; i < 2; i++) {
      const d = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 12), glowMat('#ffffff', 3));
      this.scene.add(d); r.dots.push({ m: d, off: i / 2 + Math.random() * 0.2 });
    }
    this.routes[id] = r;
  }

  private buildRoutes() {
    // paper road: email and letters arc straight from Ministry to Secretariat, never through the Gateway
    // three sides: up out of the Ministry, straight across behind the territories, down into the Secretariat
    this.route('paper', [
      [-9.4, 2.6, -4.4], [-9.4, 2.2, -7.6], [-9.3, 1.7, -10.0], [-8.6, 1.5, -10.7],
      [0, 1.5, -10.7],
      [8.6, 1.5, -10.7], [9.3, 1.7, -10.0], [9.4, 2.2, -7.6], [9.4, 2.6, -4.4],
    ], C.paper, true);
    this.route('ministry-backend', [[-12.2, 0.32, -1.2], [-12.2, 0.32, 1.2]], C.country);
    this.route('secretariat-ops', [[12.2, 0.32, -1.2], [12.2, 0.32, 1.2]], C.who);
    const bUat = [[-7.2, .3, 1.6], [-6.0, .3, 1.6], [-5.55, .05, 1.6], [-5.1, F, 1.5], [-4.75, F, 1.0], [-4.75, F, -2.4], [-4.5, F, -2.95], [-4.0, .05, -3.0], [-3.4, .3, -3.0], [-1.9, .3, -3.0]];
    const bProd = [[-7.2, .3, 5.6], [-6.0, .3, 5.6], [-5.55, .05, 5.6], [-5.0, F, 5.3], [-4.6, F, 3.6], [-4.3, F, 3.1], [-4.0, .05, 3.0], [-3.4, .3, 3.0], [-2.4, .3, 3.0]];
    const bGit = [[-10, .3, 5.6], [-10, .3, 6.7], [-10, .05, 7.25], [-10, F, 7.7], [-10, F, 10.3], [-9.4, F, 11], [-4.0, F, 11], [-3.5, .05, 11], [-2.9, .3, 11], [-2.0, .3, 11]];
    this.route('backend-uat', bUat, C.network);
    this.route('backend-prod', bProd, C.network);
    this.route('backend-github', bGit, C.github);
    // WHO side mirrors the country side; github-ops runs GitHub -> Operations
    this.route('github-ops', mirror(bGit).reverse(), C.github);
    this.route('ops-uat', mirror(bUat), C.who);
    this.route('ops-prod', mirror(bProd), C.who);
  }

  // ---------- camera ----------

  private fitHome() {
    const k = Math.max(1, 1.7 / this.camera.aspect);
    this.home.pos.set(0, 30, 33).multiplyScalar(k);
  }

  private resize() {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.fitHome();
    this.renderer.setSize(innerWidth, innerHeight);
    this.composer.setSize(innerWidth, innerHeight);
    this.labels.setSize(innerWidth, innerHeight);
  }

  /** Fly the camera to a place (or home). With a desk open, the place sits left of centre. */
  private lastView: { where: PlaceId | 'home'; opts: { desk?: boolean; caption?: boolean } } = { where: 'home', opts: {} };

  /** Fly back to wherever the game or demo last put the camera. */
  resetView() { return this.flyTo(this.lastView.where, { ...this.lastView.opts, dur: 1 }); }

  flyTo(where: PlaceId | 'home', opts: { desk?: boolean; caption?: boolean; dur?: number; zoomOut?: number } = {}): Promise<void> {
    this.lastView = { where, opts: { desk: opts.desk, caption: opts.caption } };
    let p1: THREE.Vector3, t1: THREE.Vector3;
    // a caption in the bottom-left: aim below-left of the subject so it sits up and to the right
    const cap = opts.caption ? new THREE.Vector3(-2.2, 0, 2.6) : new THREE.Vector3();
    if (where === 'home') { p1 = this.home.pos.clone().add(cap); t1 = this.home.target.clone().add(cap); }
    else {
      const narrow = innerWidth < 820;
      const shift = opts.desk && !narrow ? 3.2 : 0;
      t1 = this.places[where].pos.clone().add(new THREE.Vector3(shift, 1.0, opts.desk && narrow ? 2.2 : 0)).add(cap);
      const k = Math.min(2.4, Math.max(1, 1.3 / this.camera.aspect)); // portrait screens need more distance
      p1 = t1.clone().add(new THREE.Vector3(0, 11.5, 14.5).multiplyScalar(k * (opts.zoomOut ?? 1)));
    }
    this.fly?.done(); // a newer flight replaces an older one
    return new Promise(done => {
      this.fly = { p0: this.camera.position.clone(), t0: this.controls.target.clone(), p1, t1, u: 0, dur: opts.dur ?? 1.4, done };
    });
  }

  mark(where: PlaceId | null) {
    this.marker.visible = !!where;
    if (where) this.marker.position.copy(this.places[where].pos).setY(0.36);
  }

  // ---------- parcels and routes ----------

  private pointOn(legs: Leg[], u: number) {
    const total = legs.reduce((s, [id]) => s + this.routes[id].length, 0);
    let d = u * total;
    for (const [id, dir] of legs) {
      const r = this.routes[id];
      if (d <= r.length) { const t = d / r.length; return r.curve.getPointAt(dir > 0 ? t : 1 - t); }
      d -= r.length;
    }
    const [id, dir] = legs[legs.length - 1];
    return this.routes[id].curve.getPointAt(dir > 0 ? 1 : 0);
  }

  /**
   * Send a parcel along one or more route legs. With bounce, it reaches the far end,
   * turns red, flashes the roads and comes back.
   */
  travel(legs: Leg[], label: string, kind: ParcelKind, opts: { bounce?: string } = {}): Promise<void> {
    const g = new THREE.Group(); this.scene.add(g);
    const colors = { paper: C.paper, key: C.github, data: C.network };
    add(g, new THREE.SphereGeometry(0.2, 16, 16), glowMat(colors[kind], 2.8), 0, 0, 0, false);
    const card = document.createElement('div');
    card.className = `w-parcel k-${kind}`;
    card.innerHTML = `<span class="w-parcel-dot"></span>${label}`;
    const o = new CSS2DObject(card); o.position.set(0, 0.9, 0); g.add(o);
    const total = legs.reduce((s, [id]) => s + this.routes[id].length, 0);
    const dur = Math.max(1.8, total / 9);
    const back = legs.slice().reverse().map(([id, d]) => [id, -d] as Leg);
    let phase: 'go' | 'hold' | 'return' = 'go', t = 0;
    return new Promise(done => {
      this.parcels.push({
        cancel: () => { g.removeFromParent(); card.remove(); done(); },
        update: (dt: number) => {
          t += dt;
          if (phase === 'go' || phase === 'return') {
            const u = Math.min(t / dur, 1);
            const e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
            g.position.copy(this.pointOn(phase === 'go' ? legs : back, e)).y += 0.4;
            if (u >= 1) {
              if (phase === 'go' && opts.bounce) {
                phase = 'hold'; t = 0;
                card.classList.add('bad');
                card.innerHTML = `<span class="w-parcel-dot"></span>${opts.bounce}`;
                legs.forEach(([id]) => this.flashing.set(id, this.clock.elapsedTime + 2.6 / this.timeScale));
              } else { g.removeFromParent(); card.remove(); done(); return false; }
            }
          } else if (t > 1.2) { phase = 'return'; t = 0; }
          return true;
        },
      });
    });
  }

  /** Show the player's country on the map and the ministry sign. */
  setNames(country: string, code: string) {
    this.countryLabel.textContent = country.toUpperCase();
    const mat = this.ministrySignMesh.material as THREE.MeshBasicMaterial;
    mat.map?.dispose();
    mat.map = ministrySign(code.toUpperCase());
    mat.needsUpdate = true;
    this.places.github.blurb = t('World.ts:place.github.blurb', { country });
  }

  /** Stop every parcel, flight and camera move now (used when the demo skips). */
  cancelAll() {
    for (const p of this.parcels) p.cancel();
    this.parcels = [];
    this.bot.cancel();
    const f = this.fly; this.fly = null; f?.done();
  }

  setProdOpen(open: boolean) {
    this.prodBarrier.visible = !open;
  }

  pulseGateway(which: 'uat' | 'prod', color: string) {
    const ring = this.gatewayRings[which === 'uat' ? 0 : 1];
    ring.userData.flash = { color: new THREE.Color(color).multiplyScalar(3), until: this.clock.elapsedTime + 2.5 / this.timeScale };
  }

  pulseAnchor() { this.anchor.userData.pulseUntil = this.clock.elapsedTime + 3 / this.timeScale; }

  /** Bot flies between WHO Operations and the GitHub island along the purple road. */
  botTo(where: 'github' | 'ops'): Promise<void> {
    const r = this.routes['github-ops'];
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 12; i++) pts.push(r.curve.getPointAt(i / 12).clone().add(new THREE.Vector3(0, 2.2, 0)));
    if (where === 'github') pts.reverse();
    pts[0] = this.bot.group.position.clone();
    const end = where === 'github' ? new THREE.Vector3(0, 2.6, 12.2) : this.places.ops.pos.clone().add(new THREE.Vector3(0, 2.4, 1.8));
    pts.push(end);
    return this.bot.flyAlong(pts);
  }

  reset() {
    this.cancelAll();
    this.setProdOpen(false);
    this.bot.setMood('idle');
    this.bot.group.position.copy(this.places.ops.pos).add(new THREE.Vector3(0, 2.4, 1.8));
    this.mark(null);
  }

  // ---------- input and loop ----------

  /** Easter egg: three cats, each tucked where you only see it by orbiting the camera. */
  private hideCats() {
    const spots: [string, boolean, number, number, number, number][] = [
      ['country', false, -7.9, 0.32, 2.7, Math.PI],     // behind the offline SCA vault
      ['gateway', true, -0.95, 0.68, 2.35, 0.6],         // asleep on the warm PROD gateway
      ['who', false, 10.4, 0.32, -5.75, Math.PI * 0.9],  // behind the Secretariat dome
    ];
    for (const [id, sleeping, x, y, z, ry] of spots) {
      const c = cat(sleeping, { bandit: id === 'country' });
      c.position.set(x, y, z); c.rotation.y = ry;
      this.scene.add(c);
      this.cats.set(c, id);
    }
  }

  private bindPointer() {
    const ray = new THREE.Raycaster(), mouse = new THREE.Vector2();
    const groups = () => Object.entries(this.places) as [PlaceId, Place][];
    const hit = (e: PointerEvent): PlaceId | null => {
      mouse.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
      ray.setFromCamera(mouse, this.camera);
      const hits = ray.intersectObjects(groups().map(([, p]) => p.group), true);
      if (!hits.length) return null;
      let o: THREE.Object3D | null = hits[0].object;
      while (o) { const found = groups().find(([, p]) => p.group === o); if (found) return found[0]; o = o.parent; }
      return null;
    };
    const catHit = (e: PointerEvent): string | null => {
      mouse.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
      ray.setFromCamera(mouse, this.camera);
      const hits = ray.intersectObjects([...this.cats.keys()], true);
      let o: THREE.Object3D | null = hits[0]?.object ?? null;
      while (o) { const id = this.cats.get(o); if (id) return id; o = o.parent; }
      return null;
    };
    let down: [number, number] | null = null;
    const el = this.renderer.domElement;
    el.addEventListener('pointerdown', e => { down = [e.clientX, e.clientY]; });
    el.addEventListener('pointerup', e => {
      if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) return;
      const kitty = catHit(e); if (kitty) { this.onCatClick?.(kitty); return; }
      const id = hit(e); if (id && this.onPlaceClick) this.onPlaceClick(id);
    });
    el.addEventListener('pointermove', e => { el.style.cursor = catHit(e) || hit(e) ? 'pointer' : 'grab'; });
  }

  /** Keep panning inside the world: move target and camera together back within bounds. */
  private clampView() {
    const t = this.controls.target;
    // safety net: if the camera ever ends up invalid, put it back on the overview
    if (!Number.isFinite(this.camera.position.x + this.camera.position.y + this.camera.position.z + t.x + t.y + t.z)) {
      this.fly = null;
      this.camera.position.copy(this.home.pos);
      t.copy(this.home.target);
      return;
    }
    const c = new THREE.Vector3(
      THREE.MathUtils.clamp(t.x, -17, 17),
      THREE.MathUtils.clamp(t.y, -0.6, 4),
      THREE.MathUtils.clamp(t.z, -12, 16),
    );
    if (c.equals(t)) return;
    const d = c.clone().sub(t);
    t.copy(c);
    this.camera.position.add(d);
  }

  private loop = () => {
    const dt = Math.min(this.clock.getDelta(), 0.25) * this.timeScale, now = this.clock.elapsedTime;
    for (const b of this.badges) { b.position.y = 2.3 + Math.sin(now * 1.4) * 0.12; b.rotation.y = Math.sin(now * 0.6) * 0.35; }
    for (const r of this.gatewayRings) {
      const f = r.userData.flash as { color: THREE.Color; until: number } | undefined;
      const base = (r.userData.base ??= (r.material as THREE.MeshBasicMaterial).color.clone()) as THREE.Color;
      (r.material as THREE.MeshBasicMaterial).color.copy(f && now < f.until ? f.color : base).multiplyScalar(0.85 + 0.15 * Math.sin(now * 2));
    }
    const pa = (this.anchor.userData.pulseUntil as number | undefined) ?? 0;
    this.anchor.rotation.y = now * (now < pa ? 3 : 0.6);
    this.anchor.position.y = 1.4 + Math.sin(now * 1.3) * 0.06;
    const red = new THREE.Color(C.red).multiplyScalar(2.6);
    for (const [id, r] of Object.entries(this.routes) as [RouteId, Route][]) {
      const until = this.flashing.get(id) ?? 0;
      r.mat.color.copy(now < until ? red.clone().multiplyScalar(0.7 + 0.3 * Math.sin(now * 10)) : r.base);
      for (const d of r.dots) d.m.position.copy(r.curve.getPointAt((now * 0.06 + d.off) % 1));
    }
    if (this.marker.visible) {
      this.marker.scale.setScalar(1 + Math.sin(now * 2.4) * 0.03);
      (this.marker.material as THREE.MeshBasicMaterial).opacity = 1;
    }
    this.parcels = this.parcels.filter(p => p.update(dt));
    this.bot.update(now, dt);
    if (this.fly) {
      const f = this.fly;
      f.u = Math.min(f.u + dt / f.dur, 1);
      const e = f.u < 0.5 ? 4 * f.u ** 3 : 1 - Math.pow(-2 * f.u + 2, 3) / 2;
      this.camera.position.lerpVectors(f.p0, f.p1, e);
      this.controls.target.lerpVectors(f.t0, f.t1, e);
      if (f.u >= 1) { this.fly = null; f.done(); }
    }
    this.controls.update();
    this.clampView();
    this.composer.render();
    this.labels.render(this.scene, this.camera);
    requestAnimationFrame(this.loop);
  };
}
