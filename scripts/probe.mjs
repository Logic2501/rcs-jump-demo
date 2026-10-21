import { FlightSim } from '../src/sim.js';
import * as THREE from '../vendor/three.module.js';
const sim = new FlightSim();
const dt=1/240;
for(let i=0;i<240*9;i++){
  sim.step(dt);
  if(i%24===0 && sim.airTime>1.5){
    const up=new THREE.Vector3(0,1,0).applyQuaternion(sim.quat);
    const raw=Math.atan2(up.z,up.y)*180/Math.PI;
    console.log(`t=${sim.time.toFixed(2)} air=${sim.airTime.toFixed(2)} ph=${sim.phase} rollEst=${(sim.rollEst*180/Math.PI).toFixed(0)} raw=${raw.toFixed(0)} upY=${up.y.toFixed(2)} wx=${sim.omega.x.toFixed(2)} tauX=${sim.controlTorque.x.toFixed(0)} tauZ=${sim.controlTorque.z.toFixed(0)} F=${sim.controlForce.toFixed(0)} thr=${sim.activeThrusters} alt=${sim.altitude.toFixed(1)} vy=${sim.vel.y.toFixed(1)}`);
  }
}
