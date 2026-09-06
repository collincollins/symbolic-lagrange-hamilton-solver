import test from 'node:test';
import assert from 'node:assert/strict';
import { solveSystem, evaluateExpression } from '../src/solver.mjs';

const functions=['sin','cos','tan','asin','acos','atan','sinh','cosh','tanh','exp','log','sqrt'];
const close=(actual,expected,label='')=>assert.ok(Math.abs(actual-expected)<2e-6*Math.max(1,Math.abs(expected)),`${label}: ${actual} != ${expected}`);
// A fourth-order numerical derivative of independent Math functions; no CAS use.
const slope=(f,x)=>{const h=1e-4;return (f(x-2*h)-8*f(x-h)+8*f(x+h)-f(x+2*h))/(12*h)};
const evaluate=(entry,values)=>evaluateExpression(entry.expression,values);

for(const name of functions) test(`${name}: coefficients, nested chain rule, Euler–Lagrange and Hamilton forces`,()=>{
  for(const coefficient of [1,-2,3.5]) {
    const potential=`${coefficient}*${name}(0.4+0.2*sin(q1))+0.7*q1^2`;
    const result=solveSystem({kinetic:'m*v1^2/2',potential,coordinates:['q1'],constants:['m']});
    for(const q1 of [-0.3,0.4]) {
      const V=q=>coefficient*Math[name](0.4+0.2*Math.sin(q))+0.7*q*q;
      const force=-slope(V,q1),values={q1,m:1.7,p1:0.6};
      close(evaluate(result.accelerations[0],values),force/values.m,`${name} acceleration`);
      close(evaluate(result.hamiltonEquations.momenta[0],values),force,`${name} canonical force`);
      close(evaluate(result.hamiltonian,values),values.p1**2/(2*values.m)+V(q1),`${name} Hamiltonian`);
    }
  }
});

for(const name of functions) test(`${name}: time-dependent velocity-linear term cancels its coordinate derivatives`,()=>{
  const result=solveSystem({kinetic:`v1^2/2-3*${name}(0.4+t*q1)*v1`,potential:'0',coordinates:['q1'],constants:[]});
  const q1=0.3,t=0.2,v1=-0.7,arg=0.4+t*q1;
  const b=-3*Math[name](arg), derivative=-3*slope(Math[name],arg),p1=v1+b;
  close(evaluate(result.accelerations[0],{q1,t,v1}),-derivative*q1,'gauge acceleration');
  close(evaluate(result.hamiltonEquations.coordinates[0],{q1,t,p1}),v1,'gauge velocity');
  close(evaluate(result.hamiltonEquations.momenta[0],{q1,t,p1}),v1*derivative*t,'gauge canonical force');
});

for(const name of functions) test(`${name}: coordinate-dependent inertia preserves coefficients`,()=>{
  const result=solveSystem({kinetic:`(5-2*${name}(0.4+0.2*sin(q1)))*v1^2/2`,potential:'0',coordinates:['q1'],constants:[]});
  const q1=0.3,v1=-0.7,A=q=>5-2*Math[name](0.4+0.2*Math.sin(q));
  const mass=A(q1),massSlope=slope(A,q1),p1=mass*v1;
  close(evaluate(result.accelerations[0],{q1,v1}),-massSlope*v1*v1/(2*mass),'variable inertia');
  close(evaluate(result.hamiltonEquations.coordinates[0],{q1,p1}),v1,'variable-inertia velocity');
  close(evaluate(result.hamiltonEquations.momenta[0],{q1,p1}),massSlope*v1*v1/2,'variable-inertia momentum');
});

test('nested radicals and exponentials remain resolved, accurate and finite',()=>{
  const cases=[
    ['exp(sqrt(q1))',q=>Math.exp(Math.sqrt(q))],
    ['sqrt(exp(q1))',q=>Math.sqrt(Math.exp(q))],
    ['sqrt(sin(q1))',q=>Math.sqrt(Math.sin(q))],
    ['-3*asin(sin(q1))',q=>-3*Math.asin(Math.sin(q))],
    ['2*cos(-3*atan(q1))',q=>2*Math.cos(-3*Math.atan(q))],
  ];
  for(const [potential,V] of cases) {
    const result=solveSystem({kinetic:'v1^2/2',potential,coordinates:['q1'],constants:[]});
    close(evaluate(result.accelerations[0],{q1:0.4}),-slope(V,0.4),potential);
    close(evaluate(result.hamiltonEquations.momenta[0],{q1:0.4,p1:0.2}),-slope(V,0.4),potential);
    assert.doesNotMatch(JSON.stringify(result),/diff\(/);
  }
  const exponential=solveSystem({kinetic:'v1^2/2',potential:'exp(q1)',coordinates:['q1'],constants:[]});
  for(const q1 of [-50,50]) close(evaluate(exponential.accelerations[0],{q1}),-Math.exp(q1));
});

test('original real-domain restrictions survive algebraic simplification',()=>{
  for(const potential of ['exp(log(q1))','sqrt(q1)^2']) {
    const result=solveSystem({kinetic:'v1^2/2',potential,coordinates:['q1'],constants:[]});
    assert.ok(result.domainConditions.some(condition=>condition.expression==='q1 > 0'),potential);
  }
});
