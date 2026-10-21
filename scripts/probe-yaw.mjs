import { FlightSim } from "../src/sim.js";

const sim = new FlightSim();
const dt = 1 / 240;
let lastPhase = "";

for (let i = 0; i < 240 * 9; i++) {
  sim.step(dt);
  const fwd = sim.fwd;
  const yaw = (Math.atan2(fwd.z, fwd.x) * 180) / Math.PI;
  if (sim.phase !== lastPhase || i % 24 === 0) {
    const side = sim.thrusters.filter(
      (t) => t.kind === "side" && t.cmd > 0.001,
    );
    console.log(
      `t=${sim.time.toFixed(2)} ${sim.phase.padEnd(13)} yaw=${yaw.toFixed(2)} fy=${fwd.y.toFixed(2)} wx=${sim.omega.x.toFixed(2)} wy=${sim.omega.y.toFixed(2)} wz=${sim.omega.z.toFixed(2)} z=${sim.pos.z.toFixed(2)} vz=${sim.vel.z.toFixed(2)} tauY=${sim.controlTorque.y.toFixed(0)} side=${side.length} prop=${sim.propellant.toFixed(1)}`,
    );
    lastPhase = sim.phase;
  }
}
console.log("final", {
  x: sim.pos.x.toFixed(2),
  z: sim.pos.z.toFixed(2),
  yaw: ((Math.atan2(sim.fwd.z, sim.fwd.x) * 180) / Math.PI).toFixed(2),
  phase: sim.phase,
});
