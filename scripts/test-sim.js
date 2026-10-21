import { FlightSim } from "../src/sim.js";

const sim = new FlightSim();
const dt = 1 / 240;
let lastPhase = "";
let minAlt = 999;
let maxRollRate = 0;
let maxRollErr = 0;
let touchdown = null;
const rows = [];

for (let i = 0; i < 240 * 12; i++) {
  sim.step(dt);
  maxRollRate = Math.max(maxRollRate, Math.abs(sim.omega.x));
  if (sim.phase !== lastPhase) {
    const p = sim.pos;
    console.log(
      `t=${sim.time.toFixed(2)} phase=${sim.phase} pos=(${p.x.toFixed(1)},${p.y.toFixed(1)}) v=(${sim.vel.x.toFixed(1)},${sim.vel.y.toFixed(1)}) roll=${sim.rollDeg.toFixed(0)} prop=${sim.propellant.toFixed(1)}`,
    );
    lastPhase = sim.phase;
  }
  if (sim.phase === "AIRBORNE" || sim.phase === "ASCENT") {
    minAlt = Math.min(minAlt, sim.altitude);
  }
  if (sim.landed && !touchdown) {
    touchdown = sim.snapshot();
  }
  if (i % 24 === 0 && sim.phase !== "DRIVE") {
    rows.push({
      t: sim.time.toFixed(2),
      phase: sim.phase,
      alt: sim.altitude.toFixed(2),
      vy: sim.vel.y.toFixed(2),
      roll: ((sim.rollEst * 180) / Math.PI).toFixed(0),
      yaw: sim.yawDeg.toFixed(1),
      px: sim.pos.x.toFixed(1),
      pz: sim.pos.z.toFixed(2),
      thr: sim.activeThrusters,
      prop: sim.propellant.toFixed(1),
    });
  }
}

console.log("\nSamples:");
console.table(rows.filter((_, i) => i % 2 === 0));
console.log("max roll rate rad/s", maxRollRate.toFixed(2));
console.log("touchdown", touchdown);
const final = sim.snapshot();
console.log("final", final);

const checks = {
  centered: Math.abs(final.lateralZ) < 3,
  heading: Math.abs(final.yawDeg) < 6,
  softLanding: final.touchdownSpeed < 2.5,
  fuelMargin: final.propellant > 10,
};
console.log("checks", checks);
if (!Object.values(checks).every(Boolean)) process.exitCode = 1;
