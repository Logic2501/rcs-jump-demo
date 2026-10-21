import * as THREE from "../vendor/three.module.js";
import { FlightSim } from "./sim.js";
import { DemoWorld } from "./scene.js";
import { Hud } from "./hud.js";
import { MISSION } from "./spec.js";

const FIXED_DT = 1 / 240;
const params = new URLSearchParams(location.search);
const canvas = document.getElementById("scene");
const sim = new FlightSim();
const world = new DemoWorld(canvas);
const hud = new Hud(sim);

let paused = params.has("paused") || params.has("t");
let speed = Number(params.get("speed")) || 1;
let accumulator = 0;
let last = performance.now();
let firstFrame = true;

window.__rcs = {
  sim,
  world,
  hud,
  seek(time, stop = true) {
    sim.reset();
    world.reset();
    const steps = Math.max(0, Math.round(time / FIXED_DT));
    for (let i = 0; i < steps; i++) sim.step(FIXED_DT);
    accumulator = 0;
    paused = stop;
    world.snapCam = true;
    world.update(sim, 0.016);
    hud.update(sim, 0.06);
    syncButtons();
  },
  play() {
    paused = false;
    syncButtons();
  },
  pause() {
    paused = true;
    syncButtons();
  },
  get paused() {
    return paused;
  },
};

function reset(play = true) {
  sim.reset();
  world.reset();
  accumulator = 0;
  paused = !play;
  syncButtons();
}

function syncButtons() {
  const play = document.getElementById("btn-play");
  play.textContent = paused ? "PLAY" : "PAUSE";
  play.classList.toggle("active", paused);
  const cam = document.getElementById("btn-cam");
  cam.textContent = world.camMode === 0 ? "CAM · CINEMA" : "CAM · ORBIT";
  for (const b of document.querySelectorAll("#speed-group button")) {
    b.classList.toggle("active", Number(b.dataset.speed) === speed);
  }
}

document.getElementById("btn-play").addEventListener("click", () => {
  paused = !paused;
  syncButtons();
});
document.getElementById("btn-replay").addEventListener("click", () => {
  reset(true);
});
document.getElementById("btn-cam").addEventListener("click", () => {
  world.setCameraMode(world.camMode === 0 ? 1 : 0);
  syncButtons();
});
for (const b of document.querySelectorAll("#speed-group button")) {
  b.addEventListener("click", () => {
    speed = Number(b.dataset.speed);
    syncButtons();
  });
}

const envInput = document.getElementById("env");
const envValue = document.getElementById("env-val");
function applyEnv(v) {
  envInput.value = String(v);
  envValue.textContent = Number(v).toFixed(2);
  world.setEnvLevel(Number(v));
}
envInput.addEventListener("input", () => applyEnv(envInput.value));
applyEnv(params.has("env") ? Number(params.get("env")) : 1.0);

window.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    e.preventDefault();
    paused = !paused;
    syncButtons();
  } else if (e.key === "r" || e.key === "R") {
    reset(true);
  } else if (e.key === "c" || e.key === "C") {
    world.setCameraMode(world.camMode === 0 ? 1 : 0);
    syncButtons();
  } else if (e.key === "1") {
    speed = 0.35;
    syncButtons();
  } else if (e.key === "2") {
    speed = 0.7;
    syncButtons();
  } else if (e.key === "3") {
    speed = 1;
    syncButtons();
  }
});

if (params.get("cam") === "orbit") {
  world.setCameraMode(1);
}

if (params.has("t")) {
  document.getElementById("loader").style.display = "none";
  const target = Number(params.get("t")) || 0;
  const steps = Math.pow(2, 31);
  const n = Math.min(steps, Math.round(target / FIXED_DT));
  for (let i = 0; i < n; i++) sim.step(FIXED_DT);
  world.update(sim, 0.016);
  hud.update(sim, 0.06);
} else {
  world.update(sim, 0.016);
  hud.update(sim, 0.06);
}

syncButtons();

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const scaled = paused ? 0 : dt * speed;

  if (!paused) {
    accumulator += scaled;
    let guard = 0;
    while (accumulator >= FIXED_DT && guard < 16) {
      sim.step(FIXED_DT);
      accumulator -= FIXED_DT;
      guard++;
    }
    if (sim.phase === "COMPLETE" && sim.phaseTime > MISSION.replayDelay) {
      reset(true);
    }
  }

  world.update(sim, scaled > 0 ? scaled : paused ? 0 : dt);
  hud.update(sim, paused ? dt : scaled);

  if (firstFrame) {
    firstFrame = false;
    setTimeout(() => document.getElementById("loader").classList.add("done"), 350);
  }
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
