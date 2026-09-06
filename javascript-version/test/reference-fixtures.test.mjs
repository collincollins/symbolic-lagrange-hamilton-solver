import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {solveSystem, evaluateExpression} from '../src/solver.mjs';

// Independently generated from the primary-source equations by the physics audit.
const fixtures=JSON.parse(await readFile(new URL('./reference-fixtures.json',import.meta.url),'utf8'));

for(const fixture of fixtures) test(`independent source fixture: ${fixture.id}`,()=>{
  const dimensions=fixture.massMatrix.length;
  const coordinates=Array.from({length:dimensions},(_,i)=>`q${i+1}`);
  const constants=Object.keys(fixture.samples[0].environment).filter(name=>!/^([qva][12]|t)$/.test(name));
  const result=solveSystem({kinetic:fixture.kinetic.replaceAll('**','^'),potential:fixture.potential.replaceAll('**','^'),coordinates,constants});
  for(const sample of fixture.samples) {
    const close=(expression,expected)=>assert.ok(Math.abs(evaluateExpression(expression,sample.environment)-expected)<1e-9*Math.max(1,Math.abs(expected)));
    for(let i=0;i<dimensions;i++) {
      close(result.accelerations[i].expression,sample.acceleration[i]);
      close(result.forcing[i].expression,sample.forcing[i]);
      for(let j=0;j<dimensions;j++) close(result.massMatrix[i][j].expression,sample.massMatrix[i][j]);
    }
  }
});
