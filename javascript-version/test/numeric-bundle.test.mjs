import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as source from '../src/numeric.mjs';
import * as bundle from '../dist/numeric.mjs';
import { solveSystem } from '../src/solver.mjs';

const fixtures = JSON.parse(await readFile(new URL('./reference-fixtures.json', import.meta.url)));
for (const fixture of fixtures) test(`numeric browser bundle preserves ${fixture.id} results exactly`, () => {
  const dimension = fixture.massMatrix.length;
  const coordinates = ['q1', 'q2'].slice(0, dimension);
  const constants = Object.fromEntries(Object.entries(fixture.samples[0].environment).filter(([name]) => !/^[qv][12]$/.test(name)));
  const solved = solveSystem({
    kinetic: fixture.kinetic.replaceAll('**', '^'),
    potential: fixture.potential.replaceAll('**', '^'),
    coordinates,
    constants: Object.keys(constants),
  });
  const accelerations = solved.accelerations.map(value => value.expression);
  for (const { environment } of fixture.samples) {
    for (const expression of accelerations) assert.equal(bundle.compileExpression(expression)(environment), source.evaluateExpression(expression, environment));
    const options = {
      accelerations, constants,
      q0: coordinates.map(name => environment[name]),
      v0: coordinates.map((_, i) => environment[`v${i + 1}`]),
      duration: .137, dt: 1 / 1920,
    };
    assert.deepEqual(bundle.integrateMotion(options), source.integrateMotion(options));
  }
});

test('numeric browser bundle preserves bounds and validation behavior', () => {
  const options = { accelerations: ['2'], q0: [0], v0: [0], duration: 2, bounds: [{ min: -1, max: .5 }] };
  assert.deepEqual(bundle.integrateMotion(options), source.integrateMotion(options));
  for (const expression of ['q1=2', 'globalThis.alert(1)', 'sqrt(-1)', '1/0', 'unknown']) {
    let expected;
    try { source.evaluateExpression(expression); } catch (error) { expected = error.message; }
    assert.ok(expected);
    assert.throws(() => bundle.evaluateExpression(expression), error => error.name === 'MechanicsInputError' && error.message === expected);
  }
});
