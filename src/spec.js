export const DEG = Math.PI / 180;

export const RAMP = {
  start: 6,
  length: 16,
  angle: 20 * DEG,
  halfWidth: 4.0,
};
RAMP.height = Math.tan(RAMP.angle) * RAMP.length;
RAMP.end = RAMP.start + RAMP.length;

export const VEHICLE = {
  dryMass: 1800,
  propMass: 200,
  length: 4.3,
  width: 2.0,
  height: 1.1,
  wheelBase: 2.7,
  track: 1.72,
  wheelRadius: 0.37,
  cgHeight: 0.71,
  startX: -32,
  startSpeed: 20,
  driveAccel: 5.0,
  launchSpeed: 27,
};

export const RCS = {
  thrust: 4000,
  isp: 50,
  g0: 9.80665,
  minPulseMs: 25,
  nozzleCount: 16,
  liftCount: 12,
  sideCount: 4,
  maxDuty: 1,
  pulseJitter: 0.37,
};

export const PODS = [
  { name: "FL", label: "前左", x: 1.3, z: -0.82 },
  { name: "FR", label: "前右", x: 1.3, z: 0.82 },
  { name: "RL", label: "后左", x: -1.3, z: -0.82 },
  { name: "RR", label: "后右", x: -1.3, z: 0.82 },
];

function v(x, y, z) {
  return { x, y, z };
}

export const THRUSTERS = [];
let nextId = 0;

for (const pod of PODS) {
  [-1, 0, 1].forEach((k, i) => {
    THRUSTERS.push({
      id: nextId++,
      pod: pod.name,
      kind: "lift",
      index: i,
      channel: pod.name,
      force: v(0, 1, 0),
      pos: v(pod.x + k * 0.24, 0, pod.z),
      nozzle: v(pod.x + k * 0.24, -0.52, pod.z),
      exhaust: v(0, -1, 0),
    });
  });

  const outward = pod.z > 0 ? -1 : 1;
  THRUSTERS.push({
    id: nextId++,
    pod: pod.name,
    kind: "side",
    index: 0,
    channel: pod.z > 0 ? "SIDE R" : "SIDE L",
    force: v(0, 0, outward),
    pos: v(pod.x, 0, pod.z),
    nozzle: v(pod.x, 0.26, pod.z + Math.sign(pod.z) * 0.26),
    exhaust: v(0, 0, -outward),
  });
}

export const CHANNELS = [
  { id: "FL", label: "前左 LIFT", color: "#67e8ff" },
  { id: "FR", label: "前右 LIFT", color: "#67e8ff" },
  { id: "RL", label: "后左 LIFT", color: "#ffb057" },
  { id: "RR", label: "后右 LIFT", color: "#ffb057" },
  { id: "SIDE L", label: "侧向 L", color: "#ff5b4d" },
  { id: "SIDE R", label: "侧向 R", color: "#ff5b4d" },
];

export const MISSION = {
  rollStart: 0.22,
  rollDuration: 1.7,
  brakeStart: 2.10,
  endAfterTouchdown: 3.2,
  replayDelay: 2.2,
};
