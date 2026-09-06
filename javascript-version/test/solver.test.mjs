import test from 'node:test';
import assert from 'node:assert/strict';
import { solveSystem, evaluateExpression, previewSystem, toLatex } from '../src/solver.mjs';

const close = (actual, expected, message = '') => assert.ok(Math.abs(actual - expected) <= 2e-9 * Math.max(1, Math.abs(expected)), `${message}: ${actual} != ${expected}`);
const numeric = (result, values) => result.map(item => evaluateExpression(item.expression, values));
const wedgeInput = { kinetic:'(M+m)*v1^2/2+m*cos(theta)*v1*v2+m*v2^2/2', potential:'-m*g*q2*sin(theta)', coordinates:['q1','q2'], constants:['M','m','g','theta'] };
const pendulumInput = {kinetic:'(m1+m2)*l1^2*v1^2/2+m2*l2^2*v2^2/2+m2*l1*l2*cos(q1-q2)*v1*v2', potential:'-(m1+m2)*g*l1*cos(q1)-m2*g*l2*cos(q2)', coordinates:['q1','q2'], constants:['m1','m2','l1','l2','g']};

test('Atwood acceleration agrees with the independent force-balance result', () => {
  const result = solveSystem({kinetic:'(m1+m2)*v1^2/2', potential:'(m2-m1)*g*q1', coordinates:['q1'], constants:['m1','m2','g']});
  assert.ok(Math.abs(evaluateExpression(result.accelerations[0].expression,{m1:5,m2:3,g:9.81}) - (5-3)*9.81/(5+3)) < 1e-10);
});

test('free wedge agrees with Newtonian force balance over masses and angles', () => {
  const result = solveSystem(wedgeInput);
  for (const M of [0.5, 2, 10]) for (const m of [0.2, 1, 4]) for (const theta of [0.15, 0.5, 1.2]) {
    const values = { M, m, theta, g:9.81 };
    const denominator = M + m * Math.sin(theta) ** 2;
    const accelerations = numeric(result.accelerations, values);
    close(accelerations[0], -m * values.g * Math.sin(theta) * Math.cos(theta) / denominator, 'wedge acceleration');
    close(accelerations[1], (M + m) * values.g * Math.sin(theta) / denominator, 'relative sliding acceleration');
    close((M+m)*accelerations[0]+m*Math.cos(theta)*accelerations[1], 0, 'horizontal momentum derivative');
  }
});

test('double Atwood agrees with the published two-coordinate Lagrange equations', () => {
  // Richard Fitzpatrick, Atwood Machines, equations 630-636, massless pulleys.
  const result = solveSystem({kinetic:'m1*v1^2/2+m2*(-v1+v2)^2/2+m3*(-v1-v2)^2/2',potential:'-g*(m1-m2-m3)*q1-g*(m2-m3)*q2',coordinates:['q1','q2'],constants:['m1','m2','m3','g']});
  for(const m1 of [1,2,7]) for(const m2 of [0.7,1.3]) for(const m3 of [0.2,3]) {
    const g=9.81, values={m1,m2,m3,g}, [a1,a2]=numeric(result.accelerations,values);
    const denominator=m1*(m2+m3)+4*m2*m3;
    close(a1,g*(m1*(m2+m3)-4*m2*m3)/denominator);
    close(a2,2*g*m1*(m2-m3)/denominator);
    close(m1*a1+m2*(a1-a2)+m3*(a1+a2)-g*(m1-m2-m3),0);
    close(m2*(-a1+a2)+m3*(a1+a2)-g*(m2-m3),0);
  }
});

test('coupled momentum inversion restores both velocities and Legendre energy', () => {
  const result = solveSystem(wedgeInput);
  const values = {M:3,m:2,theta:0.61,g:9.81,q1:0.2,q2:0.7,v1:-0.8,v2:1.9};
  const [p1,p2] = numeric(result.momenta, values);
  const canonicalValues = {...values,p1,p2};
  const recovered = numeric(result.velocitySolutions, canonicalValues);
  const HamiltonVelocities = numeric(result.hamiltonEquations.coordinates,canonicalValues);
  close(recovered[0], values.v1); close(recovered[1], values.v2);
  close(HamiltonVelocities[0], values.v1); close(HamiltonVelocities[1], values.v2);
  close(evaluateExpression(result.hamiltonian.expression, canonicalValues), p1*values.v1+p2*values.v2-evaluateExpression(result.lagrangian.expression,values));
  assert.doesNotMatch(result.hamiltonian.expression,/\bv[12]\b/);
});

test('two coupled spring masses obey independent spring force equations', () => {
  const result = solveSystem({kinetic:'m1*v1^2/2+m2*v2^2/2', potential:'k1*q1^2/2+kc*(q2-q1)^2/2+k2*q2^2/2', coordinates:['q1','q2'], constants:['m1','m2','k1','k2','kc']});
  const values={m1:2,m2:3,k1:4,k2:5,kc:7,q1:0.9,q2:-0.7};
  const [a1,a2] = numeric(result.accelerations,values);
  close(a1,(-values.k1*values.q1+values.kc*(values.q2-values.q1))/values.m1);
  close(a2,(-values.k2*values.q2-values.kc*(values.q2-values.q1))/values.m2);
});

test('double pendulum matches the independently published explicit equations', () => {
  // myphysicslab.com/pendulum/double-pendulum-en.html, angles from downward vertical.
  const result = solveSystem(pendulumInput);
  for (const q1 of [-1.3,0.2,1.1]) for (const q2 of [-0.7,0.4,1.6]) for (const v1 of [-1.2,0,0.7]) {
    const values={m1:1.7,m2:0.8,l1:1.2,l2:0.9,g:9.81,q1,q2,v1,v2:0.43};
    const {m1,m2,l1,l2,g,v2}=values;
    const d=q1-q2, denominator=2*m1+m2-m2*Math.cos(2*d);
    const expected1=(-g*(2*m1+m2)*Math.sin(q1)-m2*g*Math.sin(q1-2*q2)-2*Math.sin(d)*m2*(v2*v2*l2+v1*v1*l1*Math.cos(d)))/(l1*denominator);
    const expected2=(2*Math.sin(d)*(v1*v1*l1*(m1+m2)+g*(m1+m2)*Math.cos(q1)+v2*v2*l2*m2*Math.cos(d)))/(l2*denominator);
    const actual=numeric(result.accelerations,values);
    close(actual[0],expected1,'first pendulum'); close(actual[1],expected2,'second pendulum');
    const [p1,p2]=numeric(result.momenta,values);
    const hamVelocity=numeric(result.hamiltonEquations.coordinates,{...values,p1,p2});
    close(hamVelocity[0],v1); close(hamVelocity[1],v2);
    // Along the E-L flow, d(T+V)/dt=0 for this autonomous mechanical system.
    const delta=1e-5;
    const energyAt=sign=>evaluateExpression(result.kinetic.expression,{...values,q1:q1+sign*delta*v1,q2:q2+sign*delta*v2,v1:v1+sign*delta*actual[0],v2:v2+sign*delta*actual[1]})+evaluateExpression(result.potential.expression,{...values,q1:q1+sign*delta*v1,q2:q2+sign*delta*v2});
    assert.ok(Math.abs((energyAt(1)-energyAt(-1))/(2*delta)) < 2e-6);
  }
});

test('coordinate and explicit time dependence include the full chain rule', () => {
  const result=solveSystem({kinetic:'m*(1+q1^2)*v1^2/2+k*t*q1*v1',potential:'c*q1^2/2',coordinates:['q1'],constants:['m','k','c']});
  const values={m:2,k:3,c:5,t:0.7,q1:0.4,v1:-1.2};
  // d/dt[dL/dv] - dL/dq = m(1+q^2)a + m q v^2 + (k+c)q.
  close(numeric(result.accelerations,values)[0],-(values.m*values.q1*values.v1**2+(values.k+values.c)*values.q1)/(values.m*(1+values.q1**2)));
  const [p1]=numeric(result.momenta,values);
  close(numeric(result.velocitySolutions,{...values,p1})[0], values.v1);
});

test('time-dependent kinetic coefficient contributes its time derivative', () => {
  const result=solveSystem({kinetic:'m*(1+t^2)*v1^2/2',potential:'0',coordinates:['q1'],constants:['m']});
  close(numeric(result.accelerations,{m:2,t:0.6,v1:1.7})[0],-2*0.6*1.7/(1+0.6**2));
});

test('energy roots are conditional branches that satisfy H=energy', () => {
  const result=solveSystem(wedgeInput);
  const values={M:3,m:2,theta:0.7,g:9.81,q1:0,q2:0.3,p1:0.8,p2:1.3,energy:7};
  for(const entry of result.energyMomentumRoots) for(const root of entry.roots) {
    const p=evaluateExpression(root.expression,values);
    close(evaluateExpression(result.hamiltonian.expression,{...values,[entry.momentum]:p}),values.energy);
  }
});

test('reports singular and nonlinear velocity systems without fabricated solutions', () => {
  assert.throws(()=>solveSystem({kinetic:'(v1+v2)^2/2',potential:'q1+q2',constants:[]}),/singular/i);
  assert.throws(()=>solveSystem({kinetic:'v1^4+v2^2',potential:'0',constants:[]}),/at most quadratic/i);
  assert.throws(()=>solveSystem({kinetic:'sqrt(1+v1^2)',potential:'0',coordinates:['q1'],constants:[]}),/at most quadratic/i);
  assert.throws(()=>solveSystem({kinetic:'v1^2',potential:'0',constants:[]}),/singular/i);
});

test('rejects unsafe or ambiguous grammar before reaching the CAS', () => {
  for(const bad of ['q1=2','diff(q1,q1)','matrix([1,2])','globalThis.alert(1)','sin(q1);v1','2v1','v1^10000','v1^(2^8)','v1 + unknown','v1.__proto__','q1[0]']) {
    assert.throws(()=>solveSystem({kinetic:bad,potential:'0',coordinates:['q1'],constants:[]}),undefined,bad);
  }
  assert.throws(()=>solveSystem({kinetic:'v1^2',potential:'v1',coordinates:['q1'],constants:[]}),/Potential energy/);
  assert.throws(()=>solveSystem({kinetic:'v1^2',potential:'q1',coordinates:['q1'],constants:['sin']}),/available constant/);
  assert.throws(()=>solveSystem({kinetic:'v1^2',potential:'q1',coordinates:['q1'],constants:['m','m']}),/distinct/);
});

test('generated equations are LaTeX, serialize, and state conditional validity', () => {
  const result=solveSystem(wedgeInput);
  assert.match(result.accelerations[0].equationLatex,/\\ddot\{q\}_\{1\}=/);
  assert.match(result.lagrangian.latex,/\\dot\{q\}_\{1\}/);
  assert.equal(result.verification.physicalModelVerified,false);
  assert.match(result.verification.conditions[0],/!= 0/);
  assert.deepEqual(JSON.parse(JSON.stringify(result)),result);
});

test('validated previews format custom energies without requiring a nonsingular system', () => {
  const preview=previewSystem({kinetic:'m*v1^2/2',potential:'m*g*q2',coordinates:['q1','q2'],constants:['m','g']});
  assert.match(preview.kinetic.equationLatex,/T=/);
  assert.match(preview.kinetic.latex,/\\dot\{q\}_\{1\}/);
  assert.throws(()=>previewSystem({...wedgeInput,kinetic:'diff(q1,q1)'}));
});

test('numerical interpreter preserves substitutions and rejects non-arithmetic input', () => {
  const values=Object.freeze({q1:0.3,v1:1.2});
  close(evaluateExpression('sin(q1)+v1^2',values),Math.sin(0.3)+1.2**2);
  close(evaluateExpression('-2^2+2^(-1/2)',{}),-4+2**(-0.5));
  for(const bad of ['q1=0','diff(q1,q1)','globalThis.alert(1)','1/0','sqrt(-1)','unknown']) assert.throws(()=>evaluateExpression(bad,values));
});

test('derivatives of the supported functions can be evaluated numerically', () => {
  const result=solveSystem({kinetic:'m*v1^2/2',potential:'tan(q1)+tanh(q1)+sqrt(q1^2)',coordinates:['q1'],constants:['m']});
  const q1=-0.6,m=2;
  close(numeric(result.accelerations,{q1,m})[0],-(1/Math.cos(q1)**2+1/Math.cosh(q1)**2+Math.sign(q1))/m);
});

test('real simplification preserves the negative-coordinate domain of log(q1^2)', () => {
  const result=solveSystem({kinetic:'v1^2/2',potential:'log(q1^2)',coordinates:['q1'],constants:[]});
  assert.ok(result.domainConditions.some(condition=>condition.expression.replaceAll(' ','')==='q1^2>0'));
  close(evaluateExpression(result.potential.expression,{q1:-2}),Math.log(4));
  close(numeric(result.accelerations,{q1:-2})[0],1);
});


test('LaTeX uses adjacent factors instead of multiplication dots', () => {
  const result = solveSystem({kinetic:'m1*v1^2/2+m2*v2^2/2',potential:'k*q1*q2',coordinates:['q1','q2'],constants:['m1','m2','k']});
  for (const value of [result.kinetic,result.potential,result.lagrangian,result.hamiltonian,...result.accelerations,...result.momenta,...result.hamiltonEquations.coordinates,...result.hamiltonEquations.momenta]) {
    assert.ok(!value.latex.includes(String.raw`\cdot`));
  }
});


test('numbered symbols have consistent subscripts, including custom constants', () => {
  for (const [input, expected] of [['m3', 'm_{3}'], ['k3', 'k_{3}'], ['m12', 'm_{12}'], ['k_3', 'k_{3}'], ['omega3', String.raw`\omega_{3}`]]) {
    assert.equal(toLatex(input).trim(), expected);
  }
  assert.equal(toLatex('v1').trim(), String.raw`\dot{q}_{1}`);
  assert.equal(toLatex('a2').trim(), String.raw`\ddot{q}_{2}`);
  const result = solveSystem({kinetic:'m3*v1^2/2',potential:'k3*q1^2/2',coordinates:['q1'],constants:['m3','k3']});
  for (const value of [result.kinetic, result.potential, result.lagrangian, ...result.eulerLagrange, ...result.accelerations, result.hamiltonian]) {
    assert.doesNotMatch(value.latex, /\b[mk]3\b/);
  }
  assert.match(result.lagrangian.latex, /m_\{3\}/);
  assert.match(result.lagrangian.latex, /k_\{3\}/);
});
