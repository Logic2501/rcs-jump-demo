import * as THREE from "../vendor/three.module.js";
import {
  RAMP,
  VEHICLE,
  PODS,
  THRUSTERS,
  RCS,
  CHANNELS,
} from "./spec.js";

const UP = new THREE.Vector3(0, 1, 0);
const DOWN = new THREE.Vector3(0, -1, 0);

function makeGlowTexture(inner = "rgba(255,236,205,0.95)", outer = "rgba(255,98,28,0)") {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, inner);
  g.addColorStop(0.18, "rgba(255,190,120,0.75)");
  g.addColorStop(0.55, "rgba(255,90,24,0.22)");
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeGroundTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#1b232c";
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 9000; i++) {
    const v = Math.random();
    ctx.fillStyle =
      v > 0.72
        ? "rgba(118,138,160,0.22)"
        : v > 0.4
          ? "rgba(36,45,56,0.55)"
          : "rgba(13,18,24,0.5)";
    const s = Math.random() * 2.6 + 0.4;
    ctx.fillRect(Math.random() * 512, Math.random() * 512, s, s);
  }
  ctx.strokeStyle = "rgba(76,98,120,0.28)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 512; i += 64) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 512);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(512, i);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(34, 34);
  tex.anisotropy = 4;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeEnvTexture() {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 512;
  const ctx = c.getContext("2d");
  const g = ctx.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, "#0a1526");
  g.addColorStop(0.34, "#2b4b66");
  g.addColorStop(0.49, "#b9642f");
  g.addColorStop(0.53, "#3a2418");
  g.addColorStop(1, "#080a0d");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 1024, 512);
  const sun = ctx.createRadialGradient(210, 250, 0, 210, 250, 150);
  sun.addColorStop(0, "rgba(255,215,160,0.95)");
  sun.addColorStop(0.25, "rgba(255,140,60,0.5)");
  sun.addColorStop(1, "rgba(255,90,30,0)");
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, 1024, 512);
  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeNumberTexture() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext("2d");
  ctx.clearRect(0, 0, 256, 128);
  ctx.fillStyle = "rgba(10,14,18,0.0)";
  ctx.fillRect(0, 0, 256, 128);
  ctx.fillStyle = "#eef8ff";
  ctx.font = "700 84px Menlo, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("07", 128, 58);
  ctx.strokeStyle = "#ff4b3e";
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(54, 100);
  ctx.lineTo(202, 100);
  ctx.stroke();
  return new THREE.CanvasTexture(c);
}

class DustSystem {
  constructor(scene) {
    this.count = 520;
    this.positions = new Float32Array(this.count * 3);
    this.vels = new Float32Array(this.count * 3);
    this.colors = new Float32Array(this.count * 3);
    this.life = new Float32Array(this.count);
    this.maxLife = new Float32Array(this.count);
    this.cursor = 0;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(this.positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(this.colors, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.18,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
    for (let i = 0; i < this.count; i++) this.positions[i * 3 + 1] = -100;
  }

  spawn(origin, n, spread, power, warm = 1) {
    for (let k = 0; k < n; k++) {
      const i = this.cursor++ % this.count;
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * spread;
      this.positions[i * 3] = origin.x + Math.cos(a) * r;
      this.positions[i * 3 + 1] = Math.max(0.06, origin.y + Math.random() * 0.5);
      this.positions[i * 3 + 2] = origin.z + Math.sin(a) * r;
      const sp = power * (0.35 + Math.random() * 0.9);
      this.vels[i * 3] = Math.cos(a) * sp;
      this.vels[i * 3 + 1] = power * (0.25 + Math.random() * 0.8);
      this.vels[i * 3 + 2] = Math.sin(a) * sp;
      this.life[i] = this.maxLife[i] = 0.7 + Math.random() * 1.2;
      const w = 0.55 + Math.random() * 0.45 * warm;
      this.colors[i * 3] = 0.62 * w;
      this.colors[i * 3 + 1] = 0.47 * w;
      this.colors[i * 3 + 2] = 0.34 * w;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }

  update(dt) {
    for (let i = 0; i < this.count; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      const f = Math.max(0, this.life[i] / this.maxLife[i]);
      const idx = i * 3;
      this.vels[idx + 1] -= 3.2 * dt;
      this.vels[idx] *= 1 - 1.2 * dt;
      this.vels[idx + 2] *= 1 - 1.2 * dt;
      this.positions[idx] += this.vels[idx] * dt;
      this.positions[idx + 1] += this.vels[idx + 1] * dt;
      this.positions[idx + 2] += this.vels[idx + 2] * dt;
      if (this.positions[idx + 1] < 0.04) {
        this.positions[idx + 1] = 0.04;
        this.vels[idx + 1] *= -0.18;
      }
      const fade = f * f * 0.9;
      this.colors[idx] = 0.62 * fade;
      this.colors[idx + 1] = 0.44 * fade;
      this.colors[idx + 2] = 0.3 * fade;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }
}

function buildCar(glowTex) {
  const car = new THREE.Group();
  car.name = "RCS-07";

  const paint = new THREE.MeshStandardMaterial({
    color: 0x5a6572,
    metalness: 0.08,
    roughness: 0.48,
    envMapIntensity: 1.3,
  });
  const paintDark = new THREE.MeshStandardMaterial({
    color: 0x3b4450,
    metalness: 0.12,
    roughness: 0.52,
    envMapIntensity: 1.2,
  });
  const red = new THREE.MeshStandardMaterial({
    color: 0x9b1018,
    metalness: 0.55,
    roughness: 0.34,
  });
  const rcsMat = new THREE.MeshStandardMaterial({
    color: 0xff2f22,
    emissive: 0xff1d0c,
    emissiveIntensity: 0.8,
    metalness: 0.45,
    roughness: 0.3,
  });
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0x102832,
    metalness: 0.75,
    roughness: 0.08,
    clearcoat: 1,
    clearcoatRoughness: 0.06,
    transparent: true,
    opacity: 0.94,
  });
  const rubber = new THREE.MeshStandardMaterial({
    color: 0x08090b,
    roughness: 0.92,
    metalness: 0.05,
  });
  const metal = new THREE.MeshStandardMaterial({
    color: 0xa8b4c0,
    metalness: 0.95,
    roughness: 0.26,
  });
  const emissiveWhite = new THREE.MeshStandardMaterial({
    color: 0xeafcff,
    emissive: 0xbdefff,
    emissiveIntensity: 2.2,
  });
  const emissiveRed = new THREE.MeshStandardMaterial({
    color: 0xff2a1e,
    emissive: 0xff1a0a,
    emissiveIntensity: 2.4,
  });

  const bodyShape = new THREE.Shape();
  bodyShape.moveTo(-2.02, -0.24);
  bodyShape.lineTo(1.92, -0.24);
  bodyShape.quadraticCurveTo(2.16, -0.2, 2.16, 0.04);
  bodyShape.lineTo(2.04, 0.22);
  bodyShape.lineTo(1.34, 0.33);
  bodyShape.lineTo(0.72, 0.4);
  bodyShape.lineTo(0.06, 0.63);
  bodyShape.lineTo(-0.72, 0.67);
  bodyShape.lineTo(-1.66, 0.62);
  bodyShape.lineTo(-2.06, 0.44);
  bodyShape.closePath();
  const bodyGeo = new THREE.ExtrudeGeometry(bodyShape, {
    depth: 1.62,
    bevelEnabled: true,
    bevelThickness: 0.04,
    bevelSize: 0.04,
    bevelSegments: 2,
    curveSegments: 10,
  });
  bodyGeo.translate(0, 0, -0.81);
  const body = new THREE.Mesh(bodyGeo, paint);
  car.add(body);

  const cabinShape = new THREE.Shape();
  cabinShape.moveTo(-0.92, 0.58);
  cabinShape.quadraticCurveTo(-0.58, 0.94, -0.2, 1.06);
  cabinShape.lineTo(0.52, 1.04);
  cabinShape.quadraticCurveTo(0.86, 0.92, 1.16, 0.58);
  cabinShape.closePath();
  const cabinGeo = new THREE.ExtrudeGeometry(cabinShape, {
    depth: 1.34,
    bevelEnabled: true,
    bevelThickness: 0.03,
    bevelSize: 0.03,
    bevelSegments: 2,
    curveSegments: 10,
  });
  cabinGeo.translate(0, 0, -0.67);
  const cabin = new THREE.Mesh(cabinGeo, glass);
  car.add(cabin);

  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(0.66, 0.04, 1.16),
    paint,
  );
  roof.position.set(-0.02, 1.085, 0);
  car.add(roof);

  const splitter = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.045, 1.92),
    paintDark,
  );
  splitter.position.set(2.02, -0.22, 0);
  car.add(splitter);

  const diffuser = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.08, 1.86),
    paintDark,
  );
  diffuser.position.set(-2.02, -0.22, 0);
  car.add(diffuser);

  const wing = new THREE.Mesh(
    new THREE.BoxGeometry(0.46, 0.05, 2.02),
    paintDark,
  );
  wing.position.set(-1.96, 0.94, 0);
  wing.rotation.z = -0.09;
  car.add(wing);
  for (const z of [-0.72, 0.72]) {
    const support = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.42, 0.055),
      paintDark,
    );
    support.position.set(-1.94, 0.73, z);
    support.rotation.z = -0.12;
    car.add(support);
  }

  const stripeMat = new THREE.MeshStandardMaterial({
    color: 0xc21d27,
    metalness: 0.5,
    roughness: 0.4,
  });
  for (const z of [-0.83, 0.83]) {
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(3.5, 0.035, 0.012),
      stripeMat,
    );
    stripe.position.set(0.18, 0.16, z);
    car.add(stripe);
  }

  for (const z of [-0.56, 0.56]) {
    const hl = new THREE.Mesh(
      new THREE.BoxGeometry(0.035, 0.07, 0.34),
      emissiveWhite,
    );
    hl.position.set(2.13, 0.09, z);
    car.add(hl);
  }
  const tail = new THREE.Mesh(
    new THREE.BoxGeometry(0.03, 0.05, 1.44),
    emissiveRed,
  );
  tail.position.set(-2.09, 0.31, 0);
  car.add(tail);

  const wheels = [];
  const wheelGeo = new THREE.CylinderGeometry(
    VEHICLE.wheelRadius,
    VEHICLE.wheelRadius,
    0.3,
    22,
    1,
  );
  wheelGeo.rotateX(Math.PI / 2);
  const rimGeo = new THREE.CylinderGeometry(0.225, 0.225, 0.315, 16, 1);
  rimGeo.rotateX(Math.PI / 2);
  const spokeGeo = new THREE.BoxGeometry(0.05, 0.36, 0.02);
  for (const x of [-1.35, 1.35]) {
    for (const z of [-0.86, 0.86]) {
      const wg = new THREE.Group();
      wg.position.set(x, -0.34, z);
      const tire = new THREE.Mesh(wheelGeo, rubber);
      const rim = new THREE.Mesh(rimGeo, metal);
      const disc = new THREE.Mesh(
        new THREE.CylinderGeometry(0.26, 0.26, 0.02, 18),
        paintDark,
      );
      disc.rotation.x = Math.PI / 2;
      wg.add(tire, rim, disc);
      for (let s = 0; s < 5; s++) {
        const spoke = new THREE.Mesh(spokeGeo, paintDark);
        spoke.rotation.z = (s / 5) * Math.PI * 2;
        spoke.position.z = z > 0 ? 0.16 : -0.16;
        wg.add(spoke);
      }
      car.add(wg);
      wheels.push(wg);
    }
  }

  const numberTex = makeNumberTexture();
  const numberMat = new THREE.MeshBasicMaterial({
    map: numberTex,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });
  for (const z of [-0.9, 0.9]) {
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 0.39), numberMat);
    plane.position.set(0.46, 0.23, z);
    plane.rotation.y = z > 0 ? 0 : Math.PI;
    car.add(plane);
  }

  const podGroups = [];
  for (const pod of PODS) {
    const pg = new THREE.Group();
    pg.position.set(pod.x, 0.26, pod.z * 1.12);
    const housing = new THREE.Mesh(
      new THREE.BoxGeometry(0.98, 0.24, 0.26),
      rcsMat,
    );
    pg.add(housing);
    const cap = new THREE.Mesh(
      new THREE.BoxGeometry(0.86, 0.04, 0.2),
      new THREE.MeshStandardMaterial({
        color: 0x2a0906,
        metalness: 0.5,
        roughness: 0.5,
      }),
    );
    cap.position.y = 0.14;
    pg.add(cap);
    for (const k of [-1, 0, 1]) {
      const bell = new THREE.Mesh(
        new THREE.CylinderGeometry(0.028, 0.075, 0.14, 10, 1, true),
        paintDark,
      );
      bell.position.set(k * 0.24, -0.19, 0);
      pg.add(bell);
    }
    const sideGlow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTex,
        color: 0xff3a22,
        transparent: true,
        opacity: 0.4,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    sideGlow.scale.setScalar(1.35);
    sideGlow.position.y = 0.05;
    pg.add(sideGlow);
    car.add(pg);
    podGroups.push(pg);
  }

  const nozzleBells = [];
  for (const spec of THRUSTERS) {
    if (spec.kind === "lift") continue;
    const bell = new THREE.Mesh(
      new THREE.CylinderGeometry(0.024, 0.06, 0.12, 8, 1, true),
      paintDark,
    );
    bell.position.set(
      spec.nozzle.x,
      spec.nozzle.y,
      spec.nozzle.z,
    );
    bell.quaternion.setFromUnitVectors(
      DOWN,
      new THREE.Vector3(spec.exhaust.x, spec.exhaust.y, spec.exhaust.z),
    );
    car.add(bell);
    nozzleBells.push(bell);
  }

  car.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });

  const jetGroup = new THREE.Group();
  car.add(jetGroup);

  const jets = [];
  const outerGeo = new THREE.ConeGeometry(0.145, 1, 12, 1, true);
  outerGeo.translate(0, -0.5, 0);
  const innerGeo = new THREE.ConeGeometry(0.062, 1, 10, 1, true);
  innerGeo.translate(0, -0.5, 0);

  for (const spec of THRUSTERS) {
    const g = new THREE.Group();
    g.position.set(spec.nozzle.x, spec.nozzle.y, spec.nozzle.z);
    const q = new THREE.Quaternion().setFromUnitVectors(
      DOWN,
      new THREE.Vector3(spec.exhaust.x, spec.exhaust.y, spec.exhaust.z),
    );
    g.quaternion.copy(q);
    const outerMat = new THREE.MeshBasicMaterial({
      color: spec.kind === "lift" ? 0xffa347 : 0xff5b3a,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const innerMat = new THREE.MeshBasicMaterial({
      color: 0xfff1d4,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const outer = new THREE.Mesh(outerGeo, outerMat);
    const inner = new THREE.Mesh(innerGeo, innerMat);
    outer.visible = inner.visible = false;
    g.add(outer, inner);
    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTex,
        color: spec.kind === "lift" ? 0xffb45e : 0xff6a44,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    g.add(glow);
    jetGroup.add(g);
    jets.push({ group: g, outer, inner, glow, spec });
  }

  const underLight = new THREE.PointLight(0xff6a26, 0, 14, 2);
  underLight.position.set(0, -0.4, 0);
  car.add(underLight);

  return {
    group: car,
    wheels,
    jets,
    pods: podGroups,
    underLight,
    materials: { rcsMat, emissiveRed },
  };
}

class DemoWorld {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.95;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x101a24, 0.0038);
    this.camera = new THREE.PerspectiveCamera(
      42,
      window.innerWidth / window.innerHeight,
      0.1,
      900,
    );
    this.camera.position.set(-42, 6, 13);
    this.camLook = new THREE.Vector3(-30, 1, 0);
    this.camPosTarget = this.camera.position.clone();
    this.camLookTarget = this.camLook.clone();
    this.camMode = 0;
    this.orbitYaw = -0.7;
    this.orbitPitch = 0.25;
    this.orbitRadius = 16;
    this.drag = false;
    this.lastX = 0;
    this.lastY = 0;
    this.fovTarget = 42;
    this.snapCam = true;

    this.glowTex = makeGlowTexture();
    this.scene.environment = makeEnvTexture();
    this.scene.environmentIntensity = 0.85;

    this.buildSky();
    this.buildGround();
    this.buildRamp();
    this.buildLandingZone();
    this.buildProps();
    this.buildLights();

    const car = buildCar(this.glowTex);
    this.car = car;
    this.scene.add(car.group);

    this.dust = new DustSystem(this.scene);
    this.lastLanded = false;
    this.wasAirborne = false;
    this.trailPositions = new Float32Array(600 * 3);
    this.trailCount = 0;
    this.trailGeo = new THREE.BufferGeometry();
    this.trailGeo.setAttribute(
      "position",
      new THREE.BufferAttribute(this.trailPositions, 3),
    );
    this.trailGeo.setDrawRange(0, 0);
    this.trail = new THREE.Line(
      this.trailGeo,
      new THREE.LineBasicMaterial({
        color: 0x5ad8ff,
        transparent: true,
        opacity: 0.32,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    this.trail.frustumCulled = false;
    this.scene.add(this.trail);

    this.time = 0;
    this.tmpV = new THREE.Vector3();

    window.addEventListener("resize", () => this.onResize());
    this.bindOrbit();
  }

  buildSky() {
    const geo = new THREE.SphereGeometry(620, 32, 20);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {},
      vertexShader: `
        varying vec3 vPos;
        void main(){
          vPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vPos;
        void main(){
          vec3 d = normalize(vPos);
          float h = clamp(d.y * 0.5 + 0.5, 0.0, 1.0);
          vec3 zenith = vec3(0.008, 0.014, 0.038);
          vec3 mid = vec3(0.035, 0.075, 0.12);
          vec3 horizon = vec3(0.30, 0.115, 0.055);
          vec3 warm = vec3(0.55, 0.22, 0.07);
          vec3 col = mix(horizon, mid, smoothstep(0.45, 0.68, h));
          col = mix(col, zenith, smoothstep(0.62, 0.95, h));
          float band = exp(-pow((d.y - 0.015) * 9.0, 2.0));
          col += warm * band * 0.55;
          float glow = exp(-pow(length(normalize(d.xz) - normalize(vec2(0.7,-0.7))) * 3.2, 2.0));
          col += vec3(0.30,0.11,0.03) * glow * (1.0 - smoothstep(0.0,0.5,d.y));
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    this.scene.add(new THREE.Mesh(geo, mat));

    const starGeo = new THREE.BufferGeometry();
    const n = 900;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const y = 0.12 + Math.random() * 0.88;
      const r = Math.sqrt(1 - y * y);
      arr[i * 3] = Math.cos(a) * r * 560;
      arr[i * 3 + 1] = y * 560;
      arr[i * 3 + 2] = Math.sin(a) * r * 560;
    }
    starGeo.setAttribute("position", new THREE.BufferAttribute(arr, 3));
    this.scene.add(
      new THREE.Points(
        starGeo,
        new THREE.PointsMaterial({
          color: 0xbfe0ff,
          size: 1.35,
          sizeAttenuation: false,
          transparent: true,
          opacity: 0.7,
          fog: false,
        }),
      ),
    );

    const sun = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.glowTex,
        color: 0xff9a4a,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
      }),
    );
    sun.position.set(340, 46, -330);
    sun.scale.setScalar(90);
    this.scene.add(sun);
  }

  buildGround() {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(760, 760),
      new THREE.MeshStandardMaterial({
        map: makeGroundTexture(),
        color: 0xffffff,
        roughness: 0.98,
        metalness: 0.02,
      }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    const runway = new THREE.Mesh(
      new THREE.PlaneGeometry(330, 16.4),
      new THREE.MeshStandardMaterial({
        color: 0x2e3640,
        roughness: 0.72,
        metalness: 0.12,
      }),
    );
    runway.rotation.x = -Math.PI / 2;
    runway.position.set(70, 0.012, 0);
    runway.receiveShadow = true;
    this.scene.add(runway);

    const grid = new THREE.GridHelper(420, 84, 0x3b5c78, 0x223242);
    grid.position.y = 0.02;
    grid.material.transparent = true;
    grid.material.opacity = 0.5;
    this.scene.add(grid);

    for (const z of [-8.4, 8.4]) {
      const line = new THREE.Mesh(
        new THREE.BoxGeometry(320, 0.02, 0.045),
        new THREE.MeshBasicMaterial({
          color: 0x4fbfe0,
          transparent: true,
          opacity: 0.14,
        }),
      );
      line.position.set(70, 0.03, z);
      this.scene.add(line);
    }

    const lightGeo = new THREE.SphereGeometry(0.09, 6, 6);
    const lightMat = new THREE.MeshBasicMaterial({ color: 0xffb454 });
    for (let x = -50; x <= 210; x += 8) {
      for (const z of [-9.2, 9.2]) {
        const lamp = new THREE.Mesh(lightGeo, lightMat);
        lamp.position.set(x, 0.12, z);
        this.scene.add(lamp);
      }
    }

    const mountainMat = new THREE.MeshStandardMaterial({
      color: 0x070b11,
      roughness: 1,
      metalness: 0,
    });
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * Math.PI * 2 + 0.14;
      const r = 340 + Math.random() * 120;
      const h = 10 + Math.random() * 28;
      const m = new THREE.Mesh(
        new THREE.ConeGeometry(34 + Math.random() * 52, h, 5, 1),
        mountainMat,
      );
      m.position.set(Math.cos(a) * r, h / 2 - 1, Math.sin(a) * r);
      m.rotation.y = Math.random() * Math.PI;
      this.scene.add(m);
    }
  }

  buildRamp() {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(RAMP.length, RAMP.height);
    shape.lineTo(RAMP.length, 0);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: RAMP.halfWidth * 2,
      bevelEnabled: false,
    });
    geo.translate(0, 0, -RAMP.halfWidth);
    const ramp = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({
        color: 0x232b36,
        roughness: 0.66,
        metalness: 0.55,
      }),
    );
    ramp.position.set(RAMP.start, 0, 0);
    ramp.castShadow = true;
    ramp.receiveShadow = true;
    this.scene.add(ramp);

    const deck = new THREE.Mesh(
      new THREE.BoxGeometry(RAMP.length + 0.3, 0.1, RAMP.halfWidth * 2 + 0.2),
      new THREE.MeshStandardMaterial({
        color: 0x2c3541,
        roughness: 0.5,
        metalness: 0.7,
      }),
    );
    deck.position.set(
      RAMP.start + RAMP.length / 2,
      RAMP.height / 2 + 0.02,
      0,
    );
    deck.rotation.z = RAMP.angle;
    deck.castShadow = true;
    deck.receiveShadow = true;
    this.scene.add(deck);

    const stripMat = new THREE.MeshBasicMaterial({ color: 0x6ee7ff });
    const amberMat = new THREE.MeshBasicMaterial({ color: 0xffb454 });
    for (const z of [-RAMP.halfWidth + 0.18, RAMP.halfWidth - 0.18]) {
      const strip = new THREE.Mesh(
        new THREE.BoxGeometry(RAMP.length - 1.2, 0.035, 0.1),
        stripMat,
      );
      strip.position.set(
        RAMP.start + RAMP.length / 2,
        RAMP.height / 2 + 0.09,
        z,
      );
      strip.rotation.z = RAMP.angle;
      this.scene.add(strip);
    }

    for (let i = 1; i < 7; i++) {
      const t = i / 7;
      const chevron = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 0.035, RAMP.halfWidth * 1.55),
        i % 2 === 0 ? amberMat : stripMat,
      );
      chevron.position.set(
        RAMP.start + t * (RAMP.length - 0.6),
        t * RAMP.height + 0.1,
        0,
      );
      chevron.rotation.z = RAMP.angle;
      this.scene.add(chevron);
    }

    for (let i = 0; i < 6; i++) {
      const t = (i + 0.5) / 6;
      const h = t * RAMP.height;
      const post = new THREE.Mesh(
        new THREE.BoxGeometry(0.22, h, 0.22),
        new THREE.MeshStandardMaterial({
          color: 0x1a222c,
          roughness: 0.6,
          metalness: 0.6,
        }),
      );
      post.position.set(RAMP.start + t * RAMP.length, h / 2, 0);
      post.castShadow = true;
      this.scene.add(post);
    }

    const lip = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.22, RAMP.halfWidth * 2),
      amberMat,
    );
    lip.position.set(RAMP.end, RAMP.height + 0.05, 0);
    this.scene.add(lip);

    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(3.4, 0.04, 0.22),
      new THREE.MeshBasicMaterial({ color: 0xff4b3e }),
    );
    sign.position.set(RAMP.end + 1.4, RAMP.height + 0.7, -RAMP.halfWidth - 0.05);
    this.scene.add(sign);
  }

  buildLandingZone() {
    const lzX = 100;
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffb454,
      transparent: true,
      opacity: 0.62,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(new THREE.RingGeometry(10.6, 10.9, 64), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(lzX, 0.04, 0);
    this.scene.add(ring);
    const inner = new THREE.Mesh(
      new THREE.RingGeometry(2.2, 2.35, 32),
      ringMat,
    );
    inner.rotation.x = -Math.PI / 2;
    inner.position.set(lzX, 0.04, 0);
    this.scene.add(inner);

    const barMat = new THREE.MeshBasicMaterial({
      color: 0xffb454,
      transparent: true,
      opacity: 0.55,
    });
    for (const [dx, dz, len, rot] of [
      [-7, -7, 3, 0],
      [7, -7, 3, 0],
      [-7, 7, 3, 0],
      [7, 7, 3, 0],
      [0, 0, 7, Math.PI / 4],
      [0, 0, 7, -Math.PI / 4],
    ]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(len, 0.02, 0.14), barMat);
      bar.position.set(lzX + dx, 0.045, dz);
      bar.rotation.y = rot;
      this.scene.add(bar);
    }

    const postMat = new THREE.MeshStandardMaterial({
      color: 0x1a222c,
      metalness: 0.6,
      roughness: 0.55,
    });
    for (const x of [lzX - 13, lzX + 13]) {
      for (const z of [-12, 12]) {
        const pole = new THREE.Mesh(
          new THREE.CylinderGeometry(0.09, 0.12, 2.4, 8),
          postMat,
        );
        pole.position.set(x, 1.2, z);
        this.scene.add(pole);
        const lamp = new THREE.Mesh(
          new THREE.SphereGeometry(0.16, 8, 8),
          new THREE.MeshBasicMaterial({ color: 0xff5b3a }),
        );
        lamp.position.set(x, 2.45, z);
        this.scene.add(lamp);
      }
    }
  }

  buildProps() {
    const poleMat = new THREE.MeshStandardMaterial({
      color: 0x151c24,
      roughness: 0.62,
      metalness: 0.55,
    });
    const headMat = new THREE.MeshBasicMaterial({ color: 0xfff0c4 });
    const spots = [
      [4, -18],
      [4, 18],
      [64, -20],
      [64, 20],
      [112, -20],
      [112, 20],
    ];
    for (const [x, z] of spots) {
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.18, 9, 8),
        poleMat,
      );
      pole.position.set(x, 4.5, z);
      pole.castShadow = true;
      this.scene.add(pole);
      const head = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.22, 0.5), poleMat);
      head.position.set(x, 9.1, z);
      this.scene.add(head);
      const glow = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 0.16), headMat);
      glow.position.set(x, 8.96, z);
      glow.rotation.x = Math.PI / 2;
      this.scene.add(glow);
    }
  }

  buildLights() {
    const hemi = new THREE.HemisphereLight(0x8bbcdf, 0x2a1c12, 0.6);
    this.scene.add(hemi);
    const ambient = new THREE.AmbientLight(0x6688a6, 0.24);
    this.scene.add(ambient);
    this.hemi = hemi;
    this.ambient = ambient;
    this.setEnvLevel(1.0);

    const sun = new THREE.DirectionalLight(0xffc08a, 2.0);
    sun.position.set(90, 70, -70);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -45;
    sun.shadow.camera.right = 45;
    sun.shadow.camera.top = 45;
    sun.shadow.camera.bottom = -45;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 220;
    sun.shadow.bias = -0.0004;
    this.scene.add(sun);
    this.scene.add(sun.target);
    this.sun = sun;

    const rim = new THREE.DirectionalLight(0x6aa6e0, 0.7);
    rim.position.set(-70, 34, 90);
    this.scene.add(rim);

    const warmRim = new THREE.DirectionalLight(0xff8a4f, 0.6);
    warmRim.position.set(40, 24, 90);
    this.scene.add(warmRim);

    const camFill = new THREE.DirectionalLight(0xffe3c6, 0.55);
    camFill.position.set(0, 10, 20);
    this.scene.add(camFill);
    this.scene.add(camFill.target);
    this.camFill = camFill;

    const hero = new THREE.PointLight(0xffe6c8, 45, 28, 2);
    hero.position.set(0, 6, 14);
    this.scene.add(hero);
    this.hero = hero;

    const fill = new THREE.PointLight(0xff7a3c, 22, 45, 2);
    fill.position.set(26, 8, 0);
    this.scene.add(fill);
    const fill2 = new THREE.PointLight(0x4dc4ff, 14, 50, 2);
    fill2.position.set(96, 7, -10);
    this.scene.add(fill2);

    for (const [x, intensity, color] of [
      [4, 90, 0xffd0a0],
      [56, 110, 0xffd0a0],
      [100, 100, 0xbfe4ff],
      [144, 80, 0xffc890],
    ]) {
      const lamp = new THREE.PointLight(color, intensity, 62, 2);
      lamp.position.set(x, 9.5, 0);
      this.scene.add(lamp);
    }
  }

  bindOrbit() {
    this.canvas.addEventListener("pointerdown", (e) => {
      this.drag = true;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
    });
    window.addEventListener("pointerup", () => (this.drag = false));
    window.addEventListener("pointermove", (e) => {
      if (!this.drag || this.camMode !== 1) return;
      this.orbitYaw -= (e.clientX - this.lastX) * 0.006;
      this.orbitPitch = Math.max(
        -0.05,
        Math.min(1.15, this.orbitPitch + (e.clientY - this.lastY) * 0.004),
      );
      this.lastX = e.clientX;
      this.lastY = e.clientY;
    });
    this.canvas.addEventListener(
      "wheel",
      (e) => {
        if (this.camMode !== 1) return;
        this.orbitRadius = Math.max(
          6,
          Math.min(60, this.orbitRadius + e.deltaY * 0.02),
        );
      },
      { passive: true },
    );
  }

  onResize() {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
  }

  setCameraMode(mode) {
    this.camMode = mode;
  }

  setEnvLevel(value) {
    const v = Math.max(0, Math.min(2, value));
    this.envLevel = v;
    this.scene.environmentIntensity = v;
    if (this.ambient) this.ambient.intensity = 0.12 + 0.16 * v;
    if (this.hemi) this.hemi.intensity = 0.35 + 0.35 * v;
  }

  spawnLaunchDust(pos) {
    this.dust.spawn(pos, 46, 1.6, 3.4, 0.8);
  }

  spawnLandingDust(pos, strength) {
    this.dust.spawn(pos, 120, 1.8, 4.2 * strength, 1);
  }

  update(sim, dt) {
    this.time += dt;
    const state = sim.snapshot();
    const car = this.car.group;
    car.position.copy(sim.pos);
    car.quaternion.copy(sim.quat);

    for (const wheel of this.car.wheels) {
      wheel.rotation.z = -sim.wheelSpin;
    }

    const speed = state.speed;
    const maxThrust = RCS.thrust * RCS.nozzleCount;
    const thrustFrac = Number.isFinite(state.thrust)
      ? Math.max(0, Math.min(1, state.thrust / maxThrust))
      : 0;
    for (const jet of this.car.jets) {
      const t = sim.thrusters[jet.spec.id];
      const flicker =
        0.82 + 0.18 * Math.sin(this.time * 83 + jet.spec.id * 2.17);
      const g = Math.min(1, t.glow * flicker);
      const visible = g > 0.025;
      jet.outer.visible = jet.inner.visible = visible;
      jet.glow.visible = visible;
      if (!visible) continue;
      const length = (jet.spec.kind === "lift" ? 1.55 : 1.2) * g;
      jet.outer.scale.set(0.55 + 0.55 * g, 0.2 + length, 0.55 + 0.55 * g);
      jet.inner.scale.set(0.5 + 0.4 * g, 0.16 + length * 0.82, 0.5 + 0.4 * g);
      jet.outer.material.opacity = 0.28 + 0.42 * g;
      jet.inner.material.opacity = 0.4 + 0.45 * g;
      jet.glow.scale.setScalar(0.55 + 1.8 * g);
      jet.glow.material.opacity = 0.42 * g;
    }
    this.car.underLight.intensity = 110 * thrustFrac;

    const rcsPulse =
      0.55 + 0.45 * Math.sin(this.time * 12.0) ** 2;
    this.car.materials.rcsMat.emissiveIntensity =
      0.45 + 0.9 * rcsPulse * (0.3 + thrustFrac);

    if (state.phase !== "DRIVE") {
      this.wasAirborne = true;
    }

    if (!state.landed && state.altitude < 3.2 && state.thrust > 2000) {
      const p = new THREE.Vector3(
        sim.pos.x,
        0.1,
        sim.pos.z,
      );
      this.dust.spawn(p, 2, 1.6, 2.6 + speed * 0.04, 1);
    }

    if (state.landed && !this.lastLanded) {
      const p = new THREE.Vector3(sim.pos.x, 0.1, sim.pos.z);
      this.spawnLandingDust(p, Math.max(0.5, state.touchdownSpeed / 2));
    }
    if (
      !state.landed &&
      state.phase === "TOUCHDOWN"
    ) {
    }
    this.lastLanded = state.landed;

    if (state.airTime > 0.2 && state.altitude > 0.2) {
      const trailIndex = this.trailCount % 600;
      this.trailPositions[trailIndex * 3] = sim.pos.x;
      this.trailPositions[trailIndex * 3 + 1] = sim.pos.y;
      this.trailPositions[trailIndex * 3 + 2] = sim.pos.z;
      this.trailCount++;
      this.trailGeo.setDrawRange(0, Math.min(this.trailCount, 600));
      this.trailGeo.attributes.position.needsUpdate = true;
    }

    this.dust.update(dt);

    const carPos = sim.pos;
    this.sun.position.set(carPos.x + 75, 68, -62);
    this.sun.target.position.copy(carPos);
    this.sun.target.updateMatrixWorld();

    this.updateCamera(sim, state, dt);
    this.renderer.render(this.scene, this.camera);
  }

  updateCamera(sim, state, dt) {
    const p = sim.pos;
    let desired;

    if (this.camMode === 1) {
      const r = this.orbitRadius;
      const yaw = this.orbitYaw + this.time * 0.12;
      desired = new THREE.Vector3(
        p.x + Math.cos(yaw) * r,
        p.y + 2.4 + Math.sin(this.orbitPitch) * r * 0.7,
        p.z + Math.sin(yaw) * r,
      );
      this.fovTarget = 42;
    } else if (state.phase === "DRIVE") {
      const rampBlend = THREE.MathUtils.smoothstep(
        p.x,
        RAMP.start - 10,
        RAMP.start + 4,
      );
      desired = new THREE.Vector3(
        p.x - 12.5 + rampBlend * 3,
        p.y + 3.3 + rampBlend * 0.3,
        p.z + 11.5 - rampBlend * 3.0,
      );
      this.fovTarget = 40;
    } else if (state.phase === "ASCENT") {
      desired = new THREE.Vector3(p.x - 4, p.y + 2.4, p.z + 14);
      this.fovTarget = 44;
    } else if (state.phase === "BARREL ROLL") {
      desired = new THREE.Vector3(p.x - 2.2, p.y + 2.6, p.z + 12.0);
      this.fovTarget = 45;
    } else if (state.phase === "ALIGN" || state.phase === "LANDING BURN") {
      const alt = state.altitude;
      const ahead = alt > 3 ? 8.5 : 6;
      desired = new THREE.Vector3(
        p.x + ahead,
        Math.max(1.05, p.y - 1.7),
        p.z + 7.2,
      );
      this.fovTarget = 43;
    } else if (state.phase === "TOUCHDOWN") {
      desired = new THREE.Vector3(p.x - 4, p.y + 1.3, p.z + 7.4);
      this.fovTarget = 41;
    } else {
      desired = new THREE.Vector3(p.x - 11, p.y + 3.2, p.z + 7.0);
      this.fovTarget = 40;
    }

    const look = new THREE.Vector3(p.x, p.y + 0.22, p.z);
    if (this.camMode === 1 || this.snapCam) {
      this.camPosTarget.copy(desired);
      this.camLookTarget.copy(look);
      this.snapCam = false;
    } else {
      const posLerp = 1 - Math.exp(-dt * 2.6);
      this.camPosTarget.lerp(desired, posLerp);
      this.camLookTarget.copy(look);
    }

    const shake =
      Math.min(0.03, (state.thrust / 40000) * 0.028) *
      (state.phase === "TOUCHDOWN" ? 0.4 : 1);
    this.camera.position.copy(this.camPosTarget);
    this.camera.position.x += (Math.random() - 0.5) * shake;
    this.camera.position.y += (Math.random() - 0.5) * shake;
    this.camera.lookAt(this.camLookTarget);

    if (this.camFill) {
      this.camFill.position.copy(this.camera.position).add(new THREE.Vector3(0, 3, 0));
      this.camFill.target.position.copy(p);
      this.camFill.target.updateMatrixWorld();
    }
    if (this.hero) {
      this.hero.position.copy(this.camera.position).lerp(look, 0.28);
      this.hero.position.y += 1.6;
    }

    this.camera.fov += (this.fovTarget - this.camera.fov) * Math.min(1, dt * 3);
    this.camera.updateProjectionMatrix();
  }

  reset() {
    this.trailCount = 0;
    this.snapCam = true;
    this.trailGeo.setDrawRange(0, 0);
    this.lastLanded = false;
    this.wasAirborne = false;
    this.dust.spawn(new THREE.Vector3(0, 0.1, 0), 0, 0, 0, 0);
    for (let i = 0; i < this.dust.count; i++) this.dust.life[i] = 0;
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}

export { DemoWorld };
