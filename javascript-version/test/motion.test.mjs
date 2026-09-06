import test from 'node:test';
import assert from 'node:assert/strict';
import { compileExpression, evaluateExpression, integrateMotion, solveSystem } from '../src/solver.mjs';

const close = (actual, expected, tolerance = 1e-9) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected} (tolerance ${tolerance})`);
const atwood = solveSystem({ kinetic: '(m1+m2)*v1^2/2', potential: '(m2-m1)*g*q1', coordinates: ['q1'], constants: ['m1', 'm2', 'g'] });
const doubleAtwood = solveSystem({ kinetic: 'm1*v1^2/2+m2*(-v1+v2)^2/2+m3*(-v1-v2)^2/2', potential: '-g*(m1-m2-m3)*q1-g*(m2-m3)*q2', coordinates: ['q1', 'q2'], constants: ['m1', 'm2', 'm3', 'g'] });
const springs = solveSystem({kinetic:'m1*v1^2/2+m2*v2^2/2', potential:'k1*q1^2/2+k2*(q2-q1)^2/2+k3*q2^2/2', coordinates:['q1','q2'], constants:['m1','m2','k1','k2','k3']});
const harmonic = solveSystem({ kinetic: 'm*v1^2/2', potential: 'k*q1^2/2', coordinates: ['q1'], constants: ['m', 'k'] });
const pendulum = solveSystem({ kinetic: '(m1+m2)*l1^2*v1^2/2+m2*l2^2*v2^2/2+m2*l1*l2*cos(q1-q2)*v1*v2', potential: '-(m1+m2)*g*l1*cos(q1)-m2*g*l2*cos(q2)', coordinates: ['q1', 'q2'], constants: ['m1', 'm2', 'l1', 'l2', 'g'] });
const expressions = result => result.accelerations.map(value => value.expression);

// these values characterize the existing numerical evaluator before its parser is reused.
test('compiled arithmetic preserves precedence, functions, substitutions and evaluator results', () => {
  const environment = Object.freeze({ q1: 0.3, q2: -0.4, v1: 1.2, m: 2, pi: 3, e: 2 });
  for (const [source, expected] of [
    ['-2^2+2^(-1/2)', -4 + 2 ** -0.5], ['2^3^2', 512], ['--2', 2],
    ['sin(q1)+m*v1^2', Math.sin(0.3) + 2 * 1.2 ** 2], ['1e-3 + 2.5E+2', 250.001],
    ['sqrt(q1^2)+abs(q2)+sign(q2)', -0.3], ['sec(q1)+csc(q1)+cot(q1)', 1/Math.cos(0.3)+1/Math.sin(0.3)+1/Math.tan(0.3)],
    ['asin(q1)+acos(q1)+atan(q1)', Math.PI / 2 + Math.atan(0.3)],
    ['sinh(q1)+cosh(q1)+tanh(q1)+sech(q1)+csch(q1)+coth(q1)', Math.sinh(.3)+Math.cosh(.3)+Math.tanh(.3)+1/Math.cosh(.3)+1/Math.sinh(.3)+1/Math.tanh(.3)],
    ['log(exp(q1))+pi+e', 5.3],
  ]) {
    close(evaluateExpression(source, environment), expected);
    close(compileExpression(source)(environment), expected);
  }
  const compiled = compileExpression('q1^2');
  close(compiled({ q1: 2 }), 4); close(compiled({ q1: 3 }), 9);
});

test('compiled arithmetic rejects commands, inherited variables, invalid substitutions and domains', () => {
  for (const source of ['q1=0', 'diff(q1,q1)', 'globalThis.alert(1)', 'q1[0]', 'q1;2', 'sin q1', '2q1', '()', '1+', 'q1)', 'sin(q1,q2)']) assert.throws(() => compileExpression(source));
  for (const source of ['1/0', 'sqrt(-1)', 'unknown', '1e1000']) assert.throws(() => compileExpression(source)({}));
  assert.throws(() => compileExpression('q1')(Object.create({ q1: 1 })));
  assert.throws(() => compileExpression('q1')({ q1: Infinity }));
  assert.throws(() => compileExpression('q1')({ q1: 1, unused: NaN }));
  assert.throws(() => compileExpression('q1')([]));
  assert.throws(() => compileExpression('-'.repeat(10000) + '1'), /deep|complex/);
});

test('solver-derived Atwood playback follows the analytic trajectory at every output time', () => {
  const constants = { m1: 5, m2: 3, g: 9.81 }, acceleration = (5-3)*9.81/(5+3);
  const result = integrateMotion({ accelerations: expressions(atwood), constants, q0: [.2], v0: [-.1], duration: .437 });
  assert.equal(result.frames[0].time, 0); assert.equal(result.duration, .437); assert.equal(result.stoppedAtBound, false);
  assert.equal(result.frames.at(-1).time, .437);
  for (const frame of result.frames) { close(frame.q[0], .2 - .1 * frame.time + acceleration * frame.time ** 2 / 2); close(frame.v[0], -.1 + acceleration * frame.time); }
});

test('double-Atwood trajectories preserve both rope constraints and constant accelerations', () => {
  const constants = { m1: 2, m2: 1, m3: 3, g: 9.81 };
  const denominator = constants.m1*(constants.m2+constants.m3)+4*constants.m2*constants.m3;
  const acceleration = [constants.g*(constants.m1*(constants.m2+constants.m3)-4*constants.m2*constants.m3)/denominator, 2*constants.g*constants.m1*(constants.m2-constants.m3)/denominator];
  const result = integrateMotion({ accelerations: expressions(doubleAtwood), constants, q0: [0, 0], v0: [0, 0], duration: 2, bounds: [{min: -.6, max: .6}, {min: -.6, max: .6}] });
  assert.equal(result.stoppedAtBound, true);
  for (const frame of result.frames) {
    for (let i=0; i<2; i++) close(frame.q[i], acceleration[i]*frame.time**2/2);
    const [q1, q2] = frame.q, upperMass = q1, movingPulley = -q1, lowerMass2 = -q1+q2, lowerMass3 = -q1-q2;
    close(upperMass + movingPulley, 0); close(lowerMass2 + lowerMass3 - 2*movingPulley, 0);
    assert.ok(frame.q.every(q => q >= -.6 && q <= .6));
  }
});

test('coordinate limits stop at the first crossing with a refined final frame', () => {
  const result = integrateMotion({ accelerations: ['2', '3'], constants: {}, q0: [0, 0], v0: [0, 0], duration: 2, bounds: [{min: -1, max: 1}, {min: -.7, max: .7}] });
  const end = result.frames.at(-1), expected = Math.sqrt(2*.7/3);
  assert.equal(result.stoppedAtBound, true); close(result.duration, expected, 1e-10); close(end.time, expected, 1e-10); close(end.q[1], .7, 1e-10); close(end.v[1], 3*expected, 1e-9);
  assert.ok(result.frames.every(frame => frame.q[0] <= 1 && frame.q[1] <= .7));
  assert.ok(result.frames.every((frame, i) => !i || frame.time > result.frames[i-1].time));
  const stationary = integrateMotion({ accelerations: ['0'], constants: {}, q0: [1], v0: [0], duration: 0 });
  assert.deepEqual(stationary, { frames: [{time: 0, q: [1], v: [0]}], duration: 0, stoppedAtBound: false });
  const outward = integrateMotion({ accelerations: ['0'], constants: {}, q0: [1], v0: [1], duration: 1, bounds: [{min: -1, max: 1}] });
  assert.equal(outward.duration, 0); assert.equal(outward.frames.length, 1); assert.equal(outward.stoppedAtBound, true);
  const inward = integrateMotion({ accelerations: ['0'], constants: {}, q0: [1], v0: [-1], duration: .2, bounds: [{min: -1, max: 1}] });
  close(inward.frames.at(-1).q[0], .8); assert.equal(inward.stoppedAtBound, false);
});

test('RK4 converges against the harmonic oscillator solution', () => {
  const constants = {m: .5, k: 30}, frequency = Math.sqrt(constants.k/constants.m), duration = 8;
  const run = dt => integrateMotion({ accelerations: expressions(harmonic), constants, q0: [.3], v0: [0], duration, dt }).frames.at(-1);
  const coarse = run(1/240), fine = run(1/480), expected = .3*Math.cos(frequency*duration);
  const coarseError = Math.abs(coarse.q[0]-expected), fineError = Math.abs(fine.q[0]-expected);
  assert.ok(fineError < coarseError/12, `${fineError} not smaller than ${coarseError}/12`); close(fine.q[0], expected, 2e-8);
});

test('explicit time-dependent acceleration is integrated at the RK stage times', () => {
  const result = integrateMotion({accelerations:['t'], constants:{}, q0:[0], v0:[0], duration:1});
  for (const frame of result.frames) { close(frame.q[0], frame.time**3/6); close(frame.v[0], frame.time**2/2); }
});

test('double pendulum converges with step refinement and conserves energy over eight seconds', () => {
  const constants = {m1: 1.7, m2: .8, l1: 1.2, l2: .9, g: 9.81};
  const options = { accelerations: expressions(pendulum), constants, q0:[1.2, -.5], v0:[0,0], duration:8 };
  const coarse = integrateMotion({...options, dt:1/240}), fine = integrateMotion({...options, dt:1/480}), reference = integrateMotion({...options, dt:1/960});
  const distance = (a,b) => Math.hypot(...a.frames.at(-1).q.map((q,i) => q-b.frames.at(-1).q[i]), ...a.frames.at(-1).v.map((v,i) => v-b.frames.at(-1).v[i]));
  assert.ok(distance(fine,reference) < distance(coarse,reference)/10);
  const energy = frame => {
    const [q1,q2] = frame.q, [v1,v2] = frame.v, {m1,m2,l1,l2,g} = constants;
    return (m1+m2)*l1*l1*v1*v1/2 + m2*l2*l2*v2*v2/2 + m2*l1*l2*Math.cos(q1-q2)*v1*v2 - (m1+m2)*g*l1*Math.cos(q1) - m2*g*l2*Math.cos(q2);
  };
  const initial = energy(fine.frames[0]);
  for (const frame of fine.frames) close(energy(frame), initial, 1e-5);
});

test('preset parameter extremes produce finite sampled trajectories', () => {
  for (const m1 of [.5,5]) for (const m2 of [.5,5]) for (const l1 of [.6,1.6]) for (const l2 of [.6,1.6]) for (const signs of [[1,1],[1,-1]]) {
    const result = integrateMotion({accelerations:expressions(pendulum), constants:{m1,m2,l1,l2,g:9.81}, q0: signs.map(sign=>sign*2*Math.PI/3), v0:[0,0], duration:8, dt:1/1920});
    assert.equal(result.frames.length, 481);
    assert.ok(result.frames.every(frame => [...frame.q,...frame.v].every(Number.isFinite)));
    const energy = ({q:[q1,q2],v:[v1,v2]}) => (m1+m2)*l1*l1*v1*v1/2 + m2*l2*l2*v2*v2/2 + m2*l1*l2*Math.cos(q1-q2)*v1*v2 - (m1+m2)*9.81*l1*Math.cos(q1) - m2*9.81*l2*Math.cos(q2);
    const initial=energy(result.frames[0]), energyScale=(m1+m2)*9.81*l1+m2*9.81*l2;
    for(const frame of result.frames) close(energy(frame)/energyScale,initial/energyScale,1e-5);
  }
});

test('motion rejects invalid dimensions, duration, steps, constants and initial bounds', () => {
  const valid = { accelerations:['0'], constants:{}, q0:[0], v0:[0], duration:1 };
  for (const overrides of [
    {accelerations:[]}, {accelerations:new Array(1)}, {bounds:new Array(1)}, {accelerations:['0','0','0'],q0:[0,0,0],v0:[0,0,0]}, {q0:[0,0]}, {v0:[NaN]},
    {duration:-1}, {duration:21}, {duration:Infinity}, {dt:0}, {dt:1}, {dt:1e-10}, {sampleRate:0}, {sampleRate:Infinity},
    {constants:{q1:1}}, {constants:{m:NaN}}, {bounds:[]}, {bounds:[{min:1,max:-1}]}, {bounds:[{min:1,max:2}]},
    {accelerations:['unknown']}, {accelerations:['1/0']},
  ]) assert.throws(() => integrateMotion({...valid,...overrides}), undefined, JSON.stringify(overrides));
});


test('a brief crossing that turns back within one step still stops at the first limit', () => {
  const result = integrateMotion({accelerations:['-100'], constants:{}, q0:[.99997], v0:[.1], duration:.1, bounds:[{min:-1,max:1}]});
  const expected = (.1-Math.sqrt(.01-4*50*.00003))/100;
  assert.equal(result.stoppedAtBound,true);
  close(result.duration,expected,1e-10);
  close(result.frames.at(-1).q[0],1,1e-10);
});

test('an exact final sample is not duplicated because of floating-point sample counts', () => {
  const result = integrateMotion({accelerations:['0'], constants:{}, q0:[0], v0:[1], duration:.14, sampleRate:50});
  assert.equal(result.frames.length,8);
  assert.ok(result.frames.every((frame,i)=>!i || frame.time>result.frames[i-1].time));
  assert.equal(result.frames.at(-1).time,.14);
});

test('coupled springs match an independent normal mode and conserve energy across slider extremes', () => {
  const modal = integrateMotion({accelerations:expressions(springs), constants:{m1:2,m2:2,k1:10,k2:7,k3:10}, q0:[.2,.2], v0:[0,0], duration:8});
  for (const frame of modal.frames) for(const q of frame.q) close(q,.2*Math.cos(Math.sqrt(5)*frame.time),1e-9);
  for(const m1 of [.5,5]) for(const m2 of [.5,5]) for(const k1 of [5,30]) for(const k2 of [5,30]) for(const k3 of [5,30]) {
    const result = integrateMotion({accelerations:expressions(springs), constants:{m1,m2,k1,k2,k3}, q0:[.3,-.3],v0:[0,0],duration:8});
    const energy = ({q:[q1,q2],v:[v1,v2]})=>m1*v1*v1/2+m2*v2*v2/2+k1*q1*q1/2+k2*(q2-q1)**2/2+k3*q2*q2/2;
    const initial=energy(result.frames[0]);
    for(const frame of result.frames) { assert.ok([...frame.q,...frame.v].every(Number.isFinite)); close(energy(frame),initial,2e-6); }
  }
});

test('the fastest pendulum endpoint converges over the first two seconds', () => {
  const options = {accelerations:expressions(pendulum), constants:{m1:.5,m2:5,l1:.6,l2:.6,g:9.81}, q0:[2*Math.PI/3,-2*Math.PI/3], v0:[0,0], duration:2};
  const coarse=integrateMotion({...options,dt:1/960}).frames.at(-1);
  const fine=integrateMotion({...options,dt:1/1920}).frames.at(-1);
  const reference=integrateMotion({...options,dt:1/7680}).frames.at(-1);
  const distance=frame=>Math.hypot(...frame.q.map((q,i)=>q-reference.q[i]));
  assert.ok(distance(fine)<distance(coarse)/12);
  assert.ok(distance(fine)<1e-4);
  // This short-time convergence check is deliberate: chaotic trajectories at
  // this endpoint diverge at longer times even while energy remains accurate.
});


test('twenty-second motion reaches the final sample and preserves oscillator energy', () => {
  const result = integrateMotion({accelerations:['-q1'], q0:[1], v0:[0], duration:20});
  assert.equal(result.duration,20);
  close(result.frames.at(-1).q[0],Math.cos(20),1e-9);
  close(result.frames.at(-1).v[0],-Math.sin(20),1e-9);
});
