import { FlightSim } from '../src/sim.js';
import { MISSION } from '../src/spec.js';
const sim = new FlightSim();
const dt=1/240;
for(let i=0;i<240*7;i++){
  sim.step(dt);
  if(i%24===0 && sim.airTime>4.2){
    const prof=sim._rollProfile(sim.airTime);
    const rollErr=prof.phi-sim.rollEst;
    const tau=sim.inertia.x*prof.accel+6200*rollErr+1750*(prof.rate-sim.omega.x);
    console.log(`t=${sim.time.toFixed(2)} air=${sim.airTime.toFixed(2)} rollEst=${sim.rollEst.toFixed(2)} phi=${prof.phi.toFixed(2)} err=${rollErr.toFixed(2)} rawtau=${tau.toFixed(0)} stored=${sim.controlTorque.x.toFixed(0)} settle? landed=${sim.landed}`);
  }
}
