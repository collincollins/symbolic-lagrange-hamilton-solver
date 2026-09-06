import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {solveSystem,compileExpression,integrateMotion} from '../src/solver.mjs';
const fixture = { ...JSON.parse(readFileSync(new URL('../examples/spring-loaded-double-pendulum-playback.json', import.meta.url), 'utf8')), input: JSON.parse(readFileSync(new URL('../examples/spring-loaded-double-pendulum.json', import.meta.url), 'utf8')) };
const result=solveSystem(fixture.input);
const expressions=result.accelerations.map(x=>x.expression),acceleration=expressions.map(compileExpression);
const potential=compileExpression(fixture.input.potential),kinetic=compileExpression(fixture.input.kinetic);
const close=(actual,expected,tolerance=1e-10)=>assert.ok(Math.abs(actual-expected)<=tolerance*(1+Math.abs(expected)),`${actual} != ${expected}`);
const dot=(u,v)=>u.reduce((s,x,i)=>s+x*v[i],0),sum=(u,v)=>u.map((x,i)=>x+v[i]),scale=(u,k)=>u.map(x=>x*k);
function geometry(c,q,v){
 const [q1,q2]=q,[v1,v2]=v;
 const r1=[c.l1*Math.sin(q1),-c.l1*Math.cos(q1)],link2=[c.l2*Math.sin(q2),-c.l2*Math.cos(q2)],r2=sum(r1,link2);
 const j1=[c.l1*Math.cos(q1),c.l1*Math.sin(q1)],j2=[c.l2*Math.cos(q2),c.l2*Math.sin(q2)];
 return {r1,r2,link2,j1,j2,bias1:scale(r1,-v1*v1),bias2:sum(scale(r1,-v1*v1),scale(link2,-v2*v2))};
}
function cartesian(c,q,v){
 const {r1,r2,j1,j2,bias1,bias2}=geometry(c,q,v);
 // project independent cartesian forces onto the two allowed tangent directions.
 const force=(r,anchor,k,rest,m)=>{const offset=[r[0]-anchor,r[1]],d=Math.hypot(...offset);return sum(scale(offset,-k*(1-rest/d)),[0,-m*c.g]);};
 const f1=sum(force(r1,-c.a,c.k1,c.r1,c.m1),scale(bias1,-c.m1)),f2=sum(force(r2,c.b,c.k2,c.r2,c.m2),scale(bias2,-c.m2));
 const A=(c.m1+c.m2)*dot(j1,j1),B=c.m2*dot(j1,j2),D=c.m2*dot(j2,j2),b1=dot(j1,sum(f1,f2)),b2=dot(j2,f2),det=A*D-B*B;
 return [(b1*D-b2*B)/det,(b2*A-b1*B)/det];
}
function cartesianEnergy(c,q,v){
 const {r1,r2,j1,j2}=geometry(c,q,v),u1=scale(j1,v[0]),u2=sum(u1,scale(j2,v[1]));
 return {T:c.m1*dot(u1,u1)/2+c.m2*dot(u2,u2)/2,V:c.g*(c.m1*r1[1]+c.m2*r2[1])+c.k1*(Math.hypot(r1[0]+c.a,r1[1])-c.r1)**2/2+c.k2*(Math.hypot(r2[0]-c.b,r2[1])-c.r2)**2/2};
}
const env=(c,q,v)=>({...c,q1:q[0],q2:q[1],v1:v[0],v2:v[1]});
test('spring-loaded pendulum agrees with independent cartesian energy and force projection',()=>{
 for(let i=0;i<120;i++){
  const c={...fixture.constants,m1:.5+(i%7)*.4,m2:.5+(i%9)*.35,k1:i%13,k2:i%11};
  const q=[Math.sin(i*1.234)*Math.PI,Math.cos(i*.739)*Math.PI],v=[Math.cos(i*.91)*6,Math.sin(i*1.3)*8],target=cartesian(c,q,v),e=env(c,q,v),energy=cartesianEnergy(c,q,v);
  acceleration.forEach((a,j)=>close(a(e),target[j]));close(potential(e),energy.V);close(kinetic(e),energy.T);
 }
});
test('zero stiffness reduces to the published double-pendulum acceleration',()=>{
 const c={...fixture.constants,k1:0,k2:0};
 for(const q of [[.2,-.4],[2,-1],[-2.5,1.1]])for(const v of [[0,0],[3,-2]]){
  const {m1,m2,l1,l2,g}=c,[q1,q2]=q,[v1,v2]=v,d=q1-q2,den=2*m1+m2-m2*Math.cos(2*d);
  const expected=[(-g*(2*m1+m2)*Math.sin(q1)-m2*g*Math.sin(q1-2*q2)-2*Math.sin(d)*m2*(v2*v2*l2+v1*v1*l1*Math.cos(d)))/(l1*den),2*Math.sin(d)*(v1*v1*l1*(m1+m2)+g*(m1+m2)*Math.cos(q1)+v2*v2*l2*m2*Math.cos(d))/(l2*den)];
  acceleration.forEach((a,j)=>close(a(env(c,q,v)),expected[j]));
 }
});
test('default twenty-second playback conserves independently computed energy and spring distances stay positive',()=>{
 const {constants:c,q0,v0,dt,duration}=fixture,motion=integrateMotion({accelerations:expressions,constants:c,q0,v0,dt,duration});
 const start=cartesianEnergy(c,q0,v0),energy0=start.T+start.V;
 assert.equal(motion.duration,20);assert.equal(motion.frames.length,1201);assert.equal(motion.stoppedAtBound,false);
 for(const frame of motion.frames){const energy=cartesianEnergy(c,frame.q,frame.v);close(energy.T+energy.V,energy0,1e-7);const {r1,r2}=geometry(c,frame.q,frame.v);assert.ok(Math.hypot(r1[0]+c.a,r1[1])>=c.a-c.l1-1e-12);assert.ok(Math.hypot(r2[0]-c.b,r2[1])>=c.b-c.l1-c.l2-1e-12);}
});
test('short-time motion converges with integration refinement',()=>{
 const options={accelerations:expressions,constants:fixture.constants,q0:fixture.q0,v0:fixture.v0,duration:2};
 const coarse=integrateMotion({...options,dt:1/480}).frames.at(-1),fine=integrateMotion({...options,dt:1/960}).frames.at(-1),reference=integrateMotion({...options,dt:1/3840}).frames.at(-1);
 const distance=f=>Math.hypot(...f.q.map((x,j)=>x-reference.q[j]),...f.v.map((x,j)=>x-reference.v[j]));
 assert.ok(distance(fine)<distance(coarse)/10);assert.ok(distance(fine)<1e-6);
});
