import * as THREE from "../vendor/three.module.js";
import {
  RAMP,
  VEHICLE,
  RCS,
  THRUSTERS,
  PODS,
  MISSION,
  CHANNELS,
} from "./spec.js";

const G = RCS.g0;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wrapPi = (a) => {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
};

export function groundHeight(x) {
  if (x <= RAMP.start) return 0;
  if (x >= RAMP.end) return 0;
  return (x - RAMP.start) * Math.tan(RAMP.angle);
}

export class FlightSim {
  constructor() {
    this.thrusters = THRUSTERS.map((spec) => ({
      ...spec,
      forceVec: new THREE.Vector3(spec.force.x, spec.force.y, spec.force.z),
      posVec: new THREE.Vector3(spec.pos.x, spec.pos.y, spec.pos.z),
      nozzleVec: new THREE.Vector3(
        spec.nozzle.x,
        spec.nozzle.y,
        spec.nozzle.z,
      ),
      exhaustVec: new THREE.Vector3(
        spec.exhaust.x,
        spec.exhaust.y,
        spec.exhaust.z,
      ),
      cmd: 0,
      onTimer: 0,
      accum:
        spec.kind === "side"
          ? 0
          : ((spec.id * RCS.pulseJitter) % 1) *
            RCS.thrust *
            RCS.minPulseMs /
            1000,
      glow: 0,
      pulses: 0,
      history: [],
    }));

    this.channelHistory = Object.fromEntries(
      CHANNELS.map((c) => [c.id, []]),
    );
    this.maxLift = RCS.liftCount * RCS.thrust;
    this.sideArm = Math.abs(PODS[0].x);
    this.wheelContacts = [
      [VEHICLE.wheelBase / 2, -VEHICLE.cgHeight, VEHICLE.track / 2],
      [VEHICLE.wheelBase / 2, -VEHICLE.cgHeight, -VEHICLE.track / 2],
      [-VEHICLE.wheelBase / 2, -VEHICLE.cgHeight, VEHICLE.track / 2],
      [-VEHICLE.wheelBase / 2, -VEHICLE.cgHeight, -VEHICLE.track / 2],
    ];
    this.reset();
  }

  reset() {
    this.time = 0;
    this.airTime = 0;
    this.phase = "DRIVE";
    this.phaseTime = 0;
    this.landed = false;
    this.touchdownTime = 0;
    this.touchdownSpeed = 0;
    this.propellant = VEHICLE.propMass;
    this.mass = VEHICLE.dryMass + this.propellant;
    this.pos = new THREE.Vector3(VEHICLE.startX, VEHICLE.cgHeight, 0);
    this.vel = new THREE.Vector3(VEHICLE.startSpeed, 0, 0);
    this.quat = new THREE.Quaternion();
    this.omega = new THREE.Vector3();
    this.rollEst = 0;
    this.rollCmd = 0;
    this.lastRollProfile = { phi: 0, rate: 0, accel: 0 };
    this.wheelSpin = 0;
    this.fwd = new THREE.Vector3(1, 0, 0);
    this.up = new THREE.Vector3(0, 1, 0);
    this.activeThrusters = 0;
    this.totalThrust = 0;
    this.contactCount = 0;
    this.groundImpact = 0;
    this.controlTorque = new THREE.Vector3();
    this.controlForce = 0;
    this.lateralForce = 0;
    this.driveForce = 0;
    this.rollRateCmd = 0;
    this.attitudeError = 0;

    for (const t of this.thrusters) {
      t.cmd = 0;
      t.onTimer = 0;
      t.glow = 0;
      t.pulses = 0;
      t.history.length = 0;
      t.accum =
        t.kind === "side"
          ? 0
          : ((t.id * RCS.pulseJitter) % 1) *
            RCS.thrust *
            RCS.minPulseMs /
            1000;
    }
    for (const c of CHANNELS) this.channelHistory[c.id].length = 0;

    this._syncAxes();
    this._updateInertia();
  }

  _syncAxes() {
    this.fwd.set(1, 0, 0).applyQuaternion(this.quat);
    this.up.set(0, 1, 0).applyQuaternion(this.quat);
  }

  _updateInertia() {
    const m = this.mass;
    const { length: l, width: w, height: h } = VEHICLE;
    this.inertia = new THREE.Vector3(
      (m * (h * h + w * w)) / 12,
      (m * (l * l + w * w)) / 12,
      (m * (l * l + h * h)) / 12,
    );
    this.invInertia = new THREE.Vector3(
      1 / this.inertia.x,
      1 / this.inertia.y,
      1 / this.inertia.z,
    );
  }

  _rollProfile(t) {
    const raw = (t - MISSION.rollStart) / MISSION.rollDuration;
    const u = clamp(raw, 0, 1);
    const s = 3 * u * u - 2 * u * u * u;
    const T = MISSION.rollDuration;
    const running = raw > 0 && raw < 1;
    const ds = running ? 6 * u - 6 * u * u : 0;
    const dds = running ? 6 - 12 * u : 0;
    return {
      phi: Math.PI * 2 * s,
      rate: (Math.PI * 2 * ds) / T,
      accel: (Math.PI * 2 * dds) / (T * T),
      u,
    };
  }

  _control(dt) {
    for (const t of this.thrusters) t.cmd = 0;

    if (this.phase === "DRIVE") {
      this.controlForce = 0;
      this.lateralForce = 0;
      this.controlTorque.set(0, 0, 0);
      this.driveForce = VEHICLE.driveAccel * this.mass;
      return;
    }

    this.driveForce = 0;
    this._syncAxes();

    const prof = this._rollProfile(this.airTime);
    this.lastRollProfile = prof;
    this.rollCmd = prof.phi;

    const rollErr = prof.phi - this.rollEst;
    let tauX =
      this.inertia.x *
      (prof.accel + 16.9 * rollErr + 6.1 * (prof.rate - this.omega.x));

    let pitchDes = 0;
    const yawDes = 0;
    const pitchNow = Math.asin(clamp(this.fwd.y, -1, 1));
    const yawNow = wrapPi(Math.atan2(this.fwd.z, this.fwd.x));
    const inRoll =
      this.airTime >= MISSION.rollStart &&
      this.airTime <= MISSION.rollStart + MISSION.rollDuration;
    let tauZ = inRoll
      ? 0
      : -this.inertia.z *
        (7.8 * (pitchNow - pitchDes) + 2.25 * this.omega.z);

    const yawErr = wrapPi(yawNow - yawDes);
    const sideActive = !inRoll;
    let tauY = 0;
    if (sideActive) {
      const kp = this.landed ? 0.0 : 6.0;
      tauY = this.inertia.y * (kp * yawErr - 2.0 * this.omega.y);
    }
    if (Math.abs(yawErr) < 0.004 && Math.abs(this.omega.y) < 0.012) tauY = 0;

    let settle = 1;
    let yawSettle = 1;
    if (this.landed) {
      settle = clamp(1 - (this.time - this.touchdownTime) / 1.1, 0, 1);
      yawSettle = clamp(1 - (this.time - this.touchdownTime) / 3.0, 0, 1);
      tauX *= settle;
      tauZ *= settle * 0.9;
      tauY *= yawSettle * 0.9;
    }

    const maxYawTorque = 2 * this.sideArm * RCS.thrust;
    tauY = clamp(tauY, -maxYawTorque, maxYawTorque);

    let Fcol = 0;
    if (
      !this.landed &&
      this.airTime > MISSION.brakeStart &&
      this.up.y > 0.965 &&
      Math.abs(rollErr) < 0.20
    ) {
      const alt = Math.max(0, this.pos.y - VEHICLE.cgHeight);
      const vyDes = -Math.min(7.5, 1.0 + 0.9 * alt);
      const Fdes = this.mass * (G + 3.2 * (vyDes - this.vel.y));
      Fcol = clamp(Fdes / Math.max(this.up.y, 0.55), 0, this.maxLift);
    }

    const a = PODS[0].x;
    const b = Math.abs(PODS[0].z);
    const f = {};
    for (const pod of PODS) {
      let lift =
        Fcol / 4 -
        (pod.z * tauX) / (4 * b * b) +
        (pod.x * tauZ) / (4 * a * a);
      lift = clamp(lift, 0, 3 * RCS.thrust);
      f[pod.name] = lift;
    }
    for (const t of this.thrusters) {
      if (t.kind === "lift") t.cmd = f[t.pod] / (3 * RCS.thrust);
    }

    const maxLatAccel = (2 * RCS.thrust) / this.mass;
    let az = 0;
    if (sideActive && (!this.landed || yawSettle > 0)) {
      az = -0.9 * this.pos.z - 2.4 * this.vel.z;
      if (Math.abs(this.pos.z) < 0.04 && Math.abs(this.vel.z) < 0.08) az = 0;
      az = clamp(az, -maxLatAccel, maxLatAccel);
    }
    const fzCmd = this.mass * az * (this.landed ? yawSettle : 1);
    const front = clamp(
      (fzCmd - tauY / this.sideArm) / 2,
      -RCS.thrust,
      RCS.thrust,
    );
    const rear = clamp(
      (fzCmd + tauY / this.sideArm) / 2,
      -RCS.thrust,
      RCS.thrust,
    );
    for (const t of this.thrusters) {
      if (t.kind !== "side") continue;
      const demand = t.pod[0] === "F" ? front : rear;
      if (demand * t.force.z > 0) {
        t.cmd = Math.abs(demand) / RCS.thrust;
      }
    }
    this.controlForce = Fcol;
    this.lateralForce = fzCmd;

    this.controlTorque.set(tauX, tauY, tauZ);
    this.rollRateCmd = prof.rate;
    this.attitudeError = Math.hypot(
      ((pitchNow - pitchDes) * 180) / Math.PI,
      ((yawNow - yawDes) * 180) / Math.PI,
      (rollErr * 180) / Math.PI,
    );

    if (this.propellant <= 0) {
      for (const t of this.thrusters) t.cmd = 0;
    }
  }

  _advanceTimers(dt) {
    for (const t of this.thrusters) {
      if (t.onTimer > 0) {
        t.onTimer -= dt;
        t.glow = Math.max(t.glow, 0.85);
      } else {
        t.glow = Math.max(0, t.glow - dt * 16);
      }
    }
  }

  _strikePulses() {
    const pulseSec = RCS.minPulseMs / 1000;
    const bit = RCS.thrust * pulseSec;
    for (const t of this.thrusters) {
      if (t.cmd <= 0.0005 || this.propellant <= 0) continue;
      t.accum = Math.min(
        t.accum + t.cmd * RCS.thrust * this._dt,
        bit * 1.55,
      );
      if (t.onTimer <= 0 && t.accum >= bit) {
        t.onTimer = pulseSec;
        t.accum -= bit;
        t.pulses++;
        t.glow = 1;
        t.history.push({ t: this.time, d: pulseSec });
        if (t.history.length > 90) t.history.splice(0, t.history.length - 90);
        const channel = this.channelHistory[t.channel];
        const last = channel[channel.length - 1];
        if (!last || this.time - last.t > 0.019) {
          channel.push({ t: this.time, d: pulseSec });
          if (channel.length > 160) channel.splice(0, channel.length - 160);
        }
      }
    }
  }

  step(dt) {
    this._dt = dt;
    this.time += dt;
    this.phaseTime += dt;

    if (this.phase === "DRIVE") {
      this._stepDrive(dt);
      this._updateInertia();
      return;
    }

    this.airTime += dt;
    if (this.phase === "COMPLETE") this.airTime = this.airTime;

    this._advanceTimers(dt);
    this._control(dt);
    this._strikePulses();

    const forceWorld = new THREE.Vector3(0, -this.mass * G, 0);
    const forceBody = new THREE.Vector3();
    const torqueBody = new THREE.Vector3();
    let active = 0;

    for (const t of this.thrusters) {
      if (t.onTimer <= 0 || this.propellant <= 0) continue;
      active++;
      const f = t.forceVec.clone().multiplyScalar(RCS.thrust);
      forceBody.add(f);
      torqueBody.add(t.posVec.clone().cross(f));
    }

    const mdot = (active * RCS.thrust) / (RCS.isp * G);
    this.propellant = Math.max(0, this.propellant - mdot * dt);
    this.mass = VEHICLE.dryMass + this.propellant;
    this.activeThrusters = active;
    this.totalThrust = active * RCS.thrust;

    forceWorld.add(forceBody.clone().applyQuaternion(this.quat));

    const speed = this.vel.length();
    if (speed > 0.01) {
      const dragMag =
        0.5 * 1.15 * 1.12 * speed * speed;
      forceWorld.add(
        this.vel.clone().normalize().multiplyScalar(-dragMag),
      );
    }

    this.contactCount = 0;
    this._applyWheelContacts(forceWorld, torqueBody);

    this.vel.addScaledVector(forceWorld, dt / this.mass);
    this.pos.addScaledVector(this.vel, dt);

    const Iw = new THREE.Vector3(
      this.inertia.x * this.omega.x,
      this.inertia.y * this.omega.y,
      this.inertia.z * this.omega.z,
    );
    const gyro = this.omega.clone().cross(Iw);
    const alpha = new THREE.Vector3(
      (torqueBody.x - gyro.x) * this.invInertia.x,
      (torqueBody.y - gyro.y) * this.invInertia.y,
      (torqueBody.z - gyro.z) * this.invInertia.z,
    );
    this.omega.addScaledVector(alpha, dt);
    this.omega.multiplyScalar(1 - 0.02 * dt);

    const w = new THREE.Quaternion(
      this.omega.x,
      this.omega.y,
      this.omega.z,
      0,
    );
    const dq = this.quat.clone().multiply(w);
    this.quat.x += 0.5 * dq.x * dt;
    this.quat.y += 0.5 * dq.y * dt;
    this.quat.z += 0.5 * dq.z * dt;
    this.quat.w += 0.5 * dq.w * dt;
    this.quat.normalize();

    this.rollEst += this.omega.x * dt;
    this.wheelSpin += (this.vel.length() / VEHICLE.wheelRadius) * dt;
    this._syncAxes();

    if (this.spawnDust) this.spawnDust();
    this._updatePhase();
    this._updateInertia();
  }

  _stepDrive(dt) {
    const v = Math.min(
      VEHICLE.launchSpeed,
      this.vel.x + VEHICLE.driveAccel * dt,
    );
    this.vel.x = v;
    this.pos.x += v * dt;
    const x = this.pos.x;

    let pitch = 0;
    if (x > RAMP.start) {
      pitch = RAMP.angle;
    }
    const target = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 0, 1),
      pitch,
    );
    this.quat.slerp(target, clamp(dt * 9, 0, 1));
    this.quat.normalize();
    this.pos.y =
      groundHeight(clamp(x, 0, RAMP.end)) + VEHICLE.cgHeight;
    this.vel.y = 0;
    this.vel.z = 0;
    this.wheelSpin += (v / VEHICLE.wheelRadius) * dt;
    this._syncAxes();
    this.controlForce = 0;

    if (x >= RAMP.end - 0.06) {
      this.pos.x = RAMP.end;
      this.pos.y = RAMP.height + VEHICLE.cgHeight;
      this.vel.set(
        v * Math.cos(RAMP.angle),
        v * Math.sin(RAMP.angle),
        0,
      );
      this.quat.setFromAxisAngle(
        new THREE.Vector3(0, 0, 1),
        RAMP.angle,
      );
      this.omega.set(0, 0, 0);
      this.airTime = 0;
      this.phase = "AIRBORNE";
      this.phaseTime = 0;
      this._syncAxes();
      this.onLaunch && this.onLaunch();
    }
  }

  _applyWheelContacts(forceWorld, torqueBody) {
    const speedH = Math.hypot(this.vel.x, this.vel.z);
    for (const c of this.wheelContacts) {
      const rBody = new THREE.Vector3(c[0], c[1], c[2]);
      const rWorld = rBody.clone().applyQuaternion(this.quat);
      const p = this.pos.clone().add(rWorld);
      const gy = groundHeight(p.x);
      const pen = gy - p.y;
      if (pen <= 0) continue;
      const omegaWorld = this.omega.clone().applyQuaternion(this.quat);
      const vp = this.vel
        .clone()
        .add(omegaWorld.clone().cross(rWorld));
      let fn = 120000 * pen - 9000 * vp.y;
      fn = clamp(fn, 0, this.mass * G * 8);
      if (fn <= 1) continue;
      this.contactCount++;
      forceWorld.y += fn;
      const fWorld = new THREE.Vector3(0, fn, 0);
      torqueBody.add(rWorld.clone().cross(fWorld));

      const mu = this.landed ? 0.18 : 0.22;
      const vh = new THREE.Vector3(vp.x, 0, vp.z);
      const vhMag = vh.length();
      if (vhMag > 0.02) {
        const ff = Math.min(mu * fn, (vhMag * this.mass) / 4 / this._dt);
        const fric = vh.normalize().multiplyScalar(-ff);
        forceWorld.add(fric);
        torqueBody.add(rWorld.clone().cross(fric));
      }
    }

    if (
      this.contactCount > 0 &&
      !this.landed &&
      this.airTime > MISSION.rollStart + 0.2
    ) {
      this.landed = true;
      this.touchdownTime = this.time;
      this.touchdownSpeed = -Math.min(0, this.vel.y);
      this.phase = "TOUCHDOWN";
      this.phaseTime = 0;
      this.onTouchdown && this.onTouchdown(this.touchdownSpeed);
    }
  }

  _updatePhase() {
    if (this.landed) {
      const dt = this.time - this.touchdownTime;
      if (dt > 1.1 && dt < 1.15) {
        this.phase = "ROLLOUT";
        this.phaseTime = 0;
      }
      if (dt > MISSION.endAfterTouchdown && this.phase !== "COMPLETE") {
        this.phase = "COMPLETE";
        this.phaseTime = 0;
      }
      return;
    }
    if (this.airTime < MISSION.rollStart) this.phase = "ASCENT";
    else if (this.airTime < MISSION.rollStart + MISSION.rollDuration)
      this.phase = "BARREL ROLL";
    else if (this.airTime < MISSION.brakeStart) this.phase = "ALIGN";
    else this.phase = "LANDING BURN";
  }

  get altitude() {
    return Math.max(0, this.pos.y - VEHICLE.cgHeight);
  }

  get verticalSpeed() {
    return this.vel.y;
  }

  get speed() {
    return this.vel.length();
  }

  get rollDeg() {
    return ((this.rollEst * 180) / Math.PI) % 360;
  }

  get yawDeg() {
    return (Math.atan2(this.fwd.z, this.fwd.x) * 180) / Math.PI;
  }

  get propFraction() {
    return this.propellant / VEHICLE.propMass;
  }

  get rollProgress() {
    return clamp(
      (this.airTime - MISSION.rollStart) / MISSION.rollDuration,
      0,
      1,
    );
  }

  snapshot() {
    return {
      time: this.time,
      phase: this.phase,
      phaseTime: this.phaseTime,
      airTime: this.airTime,
      altitude: this.altitude,
      verticalSpeed: this.verticalSpeed,
      speed: this.speed,
      rollDeg: this.rollDeg,
      rollEst: this.rollEst,
      yawDeg: this.yawDeg,
      lateralZ: this.pos.z,
      lateralSpeed: this.vel.z,
      propellant: this.propellant,
      propFraction: this.propFraction,
      mass: this.mass,
      thrust: this.totalThrust,
      activeThrusters: this.activeThrusters,
      landed: this.landed,
      touchdownSpeed: this.touchdownSpeed,
      contactCount: this.contactCount,
      controlTorque: this.controlTorque,
      altitudeRate: this.vel.y,
    };
  }
}
