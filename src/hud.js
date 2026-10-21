import { THRUSTERS, PODS, CHANNELS } from "./spec.js";

const NS = "http://www.w3.org/2000/svg";
const el = (tag, attrs = {}, parent) => {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (parent) parent.appendChild(n);
  return n;
};

const PHASES = {
  DRIVE: {
    en: "RUN-UP",
    cn: "助跑",
    sub: "跑道加速 · 目标 27 m·s⁻¹",
  },
  AIRBORNE: {
    en: "LAUNCH",
    cn: "离台",
    sub: "跳台离地 · 进入弹道",
  },
  ASCENT: {
    en: "ASCENT",
    cn: "上升段",
    sub: "姿态保持 · RCS 待命",
  },
  "BARREL ROLL": {
    en: "BARREL ROLL",
    cn: "桶滚",
    sub: "固定喷口差动 · 360° 滚转",
  },
  ALIGN: {
    en: "ALIGN",
    cn: "姿态归零",
    sub: "滚转收敛 · 准备反推",
  },
  "LANDING BURN": {
    en: "RETRO BURN",
    cn: "反推软着陆",
    sub: "下降率闭环 · 脉冲反推",
  },
  TOUCHDOWN: {
    en: "TOUCHDOWN",
    cn: "触地",
    sub: "悬挂吸能 · 姿态稳定",
  },
  ROLLOUT: {
    en: "ROLLOUT",
    cn: "滑行",
    sub: "航向阻尼 · 滑行减速",
  },
  COMPLETE: {
    en: "COMPLETE",
    cn: "任务完成",
    sub: "RCS SAFE · 自动重播",
  },
};

const ROLL_SCALE = 52;

export class Hud {
  constructor(sim) {
    this.sim = sim;
    this.time = 0;
    this.uiClock = 0;
    this.bannerClock = 0;
    this.lastPhase = "";
    this.lastTime = 0;
    this.trace = [];
    this.traceClock = 0;

    this.phaseEl = document.getElementById("phase");
    this.phaseSubEl = document.getElementById("phase-sub");
    this.clockEl = document.getElementById("clock");
    this.statusEl = document.getElementById("status");
    this.altEl = document.getElementById("alt");
    this.vsEl = document.getElementById("vs");
    this.gsEl = document.getElementById("gs");
    this.rollEl = document.getElementById("roll");
    this.attErrEl = document.getElementById("atterr");
    this.thrustEl = document.getElementById("thrust");
    this.propTextEl = document.getElementById("prop-text");
    this.propBarEl = document.getElementById("prop-bar");
    this.rollRateEl = document.getElementById("rollrate");
    this.pitchEl = document.getElementById("pitch");
    this.massEl = document.getElementById("mass");
    this.adiInner = document.getElementById("adi-inner");
    this.adiRoll = document.getElementById("adi-roll");
    this.pulseTotalEl = document.getElementById("pulse-total");
    this.banner = document.getElementById("phase-banner");
    this.bannerEn = document.getElementById("banner-en");
    this.bannerCn = document.getElementById("banner-cn");
    this.profileCar = document.getElementById("profile-car");
    this.profileRoll = document.getElementById("profile-roll");
    this.profileTrace = document.getElementById("profile-trace");

    this.buildNozzles();
    this.buildTimeline();
  }

  buildNozzles() {
    const root = document.getElementById("nozzle-pods");
    this.nozzleNodes = [];
    for (const pod of PODS) {
      const g = el(
        "g",
        {
          transform: `translate(${(pod.z * ROLL_SCALE).toFixed(2)} ${(
            -pod.x * ROLL_SCALE
          ).toFixed(2)})`,
        },
        root,
      );
      const podW = 50;
      const podH = 64;
      el(
        "rect",
        {
          x: -podW / 2,
          y: -podH / 2,
          width: podW,
          height: podH,
          rx: 8,
          fill: "#150a0a",
          stroke: "#ff4b3e",
          "stroke-opacity": 0.42,
          "stroke-width": 1,
        },
        g,
      );
      el(
        "text",
        {
          x: -podW / 2 + 5,
          y: -podH / 2 - 4,
          class: "tiny",
          fill: "#ff8177",
        },
        g,
      ).textContent = pod.name;

      for (const spec of THRUSTERS.filter((t) => t.pod === pod.name)) {
        const dy = -(spec.pos.x - pod.x) * ROLL_SCALE;
        let node;
        if (spec.kind === "lift") {
          node = el(
            "circle",
            {
              cx: 0,
              cy: dy,
              r: 3.6,
              fill: "#2d3b47",
              stroke: "#6ee7ff",
              "stroke-opacity": 0.35,
              "stroke-width": 0.8,
              class: "nozzle-dot",
            },
            g,
          );
        } else {
          const dir = spec.force.z > 0 ? -1 : 1;
          node = el(
            "path",
            {
              d: `M ${dir * 25} ${dy - 5} L ${dir * 35} ${dy} L ${dir * 25} ${dy + 5} Z`,
              fill: "#3b2020",
              stroke: "#ff6a5c",
              "stroke-opacity": 0.45,
              "stroke-width": 0.7,
              class: "nozzle-dot",
              "data-dir": dir,
            },
            g,
          );
        }
        this.nozzleNodes.push({ node, thruster: this.sim.thrusters[spec.id] });
      }
      const cen = el(
        "circle",
        { cx: 0, cy: 0, r: 1.2, fill: "#ff4b3e", opacity: 0.6 },
        g,
      );
      cen.setAttribute("pointer-events", "none");
    }
  }

  buildTimeline() {
    const root = document.getElementById("timeline");
    this.timelineWidth = 640;
    this.timelineWindow = 2.4;
    this.rows = {};
    CHANNELS.forEach((ch, i) => {
      const y = i * 25;
      el(
        "text",
        { x: -12, y: y + 11, class: "tlabel", "text-anchor": "end" },
        root,
      ).textContent = ch.label;
      el(
        "rect",
        { x: 0, y, width: this.timelineWidth, height: 16, class: "track" },
        root,
      );
      for (let t = 0; t <= 2.4; t += 0.4) {
        const x = (t / 2.4) * this.timelineWidth;
        el(
          "line",
          { x1: x, y1: y, x2: x, y2: y + 16, class: "grid" },
          root,
        );
      }
      el(
        "line",
        {
          x1: 0,
          y1: y + 12.5,
          x2: this.timelineWidth,
          y2: y + 12.5,
          class: "grid",
          "stroke-dasharray": "1 3",
        },
        root,
      );
      const glow = el(
        "path",
        {
          d: "",
          fill: "none",
          stroke: ch.color,
          "stroke-width": 4.5,
          "stroke-linejoin": "miter",
          opacity: 0.14,
        },
        root,
      );
      const path = el(
        "path",
        {
          d: "",
          fill: "none",
          stroke: ch.color,
          "stroke-width": 1.35,
          "stroke-linejoin": "miter",
          "stroke-linecap": "butt",
          class: "wave",
        },
        root,
      );
      this.rows[ch.id] = { y, path, glow, color: ch.color };
    });
    el(
      "line",
      {
        x1: this.timelineWidth,
        y1: -2,
        x2: this.timelineWidth,
        y2: CHANNELS.length * 25 - 6,
        class: "now",
      },
      root,
    );

  }

  rollDisplay(sim) {
    const up = sim.up;
    let d = (Math.atan2(up.z, up.y) * 180) / Math.PI;
    d = ((d % 360) + 360) % 360;
    return d;
  }

  pitchDisplay(sim) {
    return (Math.asin(Math.max(-1, Math.min(1, sim.fwd.y))) * 180) / Math.PI;
  }

  yawDisplay(sim) {
    let d = (Math.atan2(sim.fwd.z, sim.fwd.x) * 180) / Math.PI;
    d = (((d + 180) % 360) + 360) % 360 - 180;
    return d;
  }

  showBanner(phase) {
    if (phase === "DRIVE" || phase === "TOUCHDOWN") return;
    const p = PHASES[phase];
    if (!p) return;
    this.bannerEn.textContent = p.en;
    this.bannerCn.textContent = p.cn;
    this.banner.setAttribute("opacity", "1");
    this.bannerClock = 1.35;
  }

  update(sim, dt) {
    this.time += dt;
    this.uiClock += dt;
    if (this.bannerClock > 0) {
      this.bannerClock -= dt;
      if (this.bannerClock <= 0) this.banner.setAttribute("opacity", "0");
    }

    const state = sim.snapshot();
    if (state.phase !== this.lastPhase) {
      this.lastPhase = state.phase;
      this.showBanner(state.phase);
    }

    if (
      state.time < this.lastTime - 0.05 ||
      (state.phase === "DRIVE" && state.time < 0.1)
    ) {
      this.trace.length = 0;
    }
    this.lastTime = state.time;

    if (state.airTime > 0) {
      this.traceClock += dt;
      if (this.traceClock > 0.055 && state.altitude > 0.05) {
        this.traceClock = 0;
        this.trace.push({ x: state.altitude, t: sim.pos.x });
        if (this.trace.length > 240) this.trace.shift();
        this.drawTrace();
      }
    }

    const roll = this.rollDisplay(sim);
    for (const item of this.nozzleNodes) {
      const t = item.thruster;
      const glow = t.glow;
      const lit = glow > 0.08;
      if (t.kind === "lift") {
        item.node.setAttribute("fill", lit ? "#8ff2ff" : "#2d3b47");
        item.node.setAttribute("opacity", lit ? String(0.55 + glow * 0.45) : "0.75");
      } else {
        item.node.setAttribute("fill", lit ? "#ff5a48" : "#3b2020");
        item.node.setAttribute("opacity", lit ? String(0.55 + glow * 0.45) : "0.75");
      }
    }

    this.adiInner.setAttribute(
      "transform",
      `translate(0 ${this.pitchDisplay(sim) * 1.6}) rotate(${-roll})`,
    );
    this.adiRoll.textContent = `${String(Math.round(roll)).padStart(3, "0")}°`;

    if (this.uiClock > 0.055) {
      this.uiClock = 0;
      const p = PHASES[state.phase] || PHASES.DRIVE;
      this.phaseEl.textContent = p.en;
      this.phaseSubEl.textContent = p.cn + " / " + p.sub;
      this.clockEl.textContent = `T+ ${String(Math.floor(state.time / 60)).padStart(
        2,
        "0",
      )}:${(state.time % 60).toFixed(2).padStart(5, "0")}`;
      const safe = state.phase === "COMPLETE";
      const damping =
        state.phase === "TOUCHDOWN" || state.phase === "ROLLOUT";
      this.statusEl.textContent = safe
        ? "RCS SAFE"
        : damping
          ? "RCS DAMP"
          : "RCS ARMED";
      this.statusEl.setAttribute("class", "mono-sm right " + (safe ? "" : "ok"));

      this.altEl.textContent = state.altitude.toFixed(2);
      this.vsEl.textContent =
        (state.verticalSpeed >= 0 ? "+" : "") + state.verticalSpeed.toFixed(1);
      this.vsEl.setAttribute(
        "class",
        "value " +
          (state.altitude < 1 && !state.landed && state.verticalSpeed < -2
            ? "red"
            : ""),
      );
      this.gsEl.textContent = state.speed.toFixed(1);
      this.rollEl.textContent = String(Math.round(roll)).padStart(3, "0");
      const yaw = this.yawDisplay(sim);
      this.attErrEl.textContent = `${yaw >= 0 ? "+" : ""}${yaw.toFixed(1)}`;
      this.thrustEl.textContent = (state.thrust / 1000).toFixed(1);
      this.rollRateEl.textContent =
        (sim.omega.x >= 0 ? "+" : "") + sim.omega.x.toFixed(2);
      this.pitchEl.textContent =
        (this.pitchDisplay(sim) >= 0 ? "+" : "") +
        this.pitchDisplay(sim).toFixed(1);
      this.massEl.textContent = Math.round(state.mass);

      this.propTextEl.textContent = `${state.propellant.toFixed(1)} kg · ${(
        state.propFraction * 100
      ).toFixed(0)}%`;
      this.propBarEl.setAttribute(
        "width",
        String(316 * Math.max(0.02, state.propFraction)),
      );
      const pulses = sim.thrusters.reduce((a, t) => a + t.pulses, 0);
      this.pulseTotalEl.textContent = `${pulses} PULSES`;

      this.drawTimeline();
      this.drawProfile(sim, state, roll);
    }
  }

  drawTimeline() {
    const now = this.sim.time;
    const w = this.timelineWidth;
    for (const ch of CHANNELS) {
      const row = this.rows[ch.id];
      const high = row.y + 3;
      const low = row.y + 12.5;
      const events = this.sim.channelHistory[ch.id];
      let cursor = 0;
      let d = `M0 ${low}`;
      for (const e of events) {
        const age = now - e.t;
        if (age < 0 || age > this.timelineWindow) continue;
        let x0 = w - (age / this.timelineWindow) * w;
        let x1 = x0 + Math.max(2.2, (e.d / this.timelineWindow) * w);
        if (x1 <= 0) continue;
        x0 = Math.max(x0, cursor);
        x1 = Math.min(x1, w);
        if (x1 <= x0) continue;
        if (x0 > cursor) d += `H${x0.toFixed(1)}`;
        d += `V${high}H${x1.toFixed(1)}V${low}`;
        cursor = x1;
      }
      if (cursor < w) d += `H${w}`;
      row.path.setAttribute("d", d);
      row.glow.setAttribute("d", d);
    }
  }

  drawTrace() {
    let d = "";
    for (let i = 0; i < this.trace.length; i++) {
      const p = this.trace[i];
      const x = (p.t + 40) * 1.292;
      const y = 102 - (Math.min(16, p.x) / 16) * 90;
      d += (i ? "L" : "M") + x.toFixed(1) + " " + y.toFixed(1);
    }
    this.profileTrace.setAttribute("d", d);
  }

  drawProfile(sim, state, roll) {
    const x = (sim.pos.x + 40) * 1.292;
    const alt = Math.min(16, state.altitude);
    const y = 102 - (alt / 16) * 90;
    this.profileCar.setAttribute("cx", x.toFixed(1));
    this.profileCar.setAttribute("cy", y.toFixed(1));
    this.profileRoll.setAttribute(
      "transform",
      `rotate(${roll.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)})`,
    );
    this.profileRoll.setAttribute("x1", x.toFixed(1));
    this.profileRoll.setAttribute("x2", x.toFixed(1));
    this.profileRoll.setAttribute("y1", (y - 7).toFixed(1));
    this.profileRoll.setAttribute("y2", (y + 7).toFixed(1));
  }
}
