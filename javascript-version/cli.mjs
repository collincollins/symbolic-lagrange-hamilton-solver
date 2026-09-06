#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { solveSystem, displayOutputsForMain } from './src/solver.mjs';

const [file, format] = process.argv.slice(2);
if (!file) {
  console.error('Usage: node cli.mjs system.json [--json]');
  process.exitCode = 1;
} else {
  try {
    const result = solveSystem(JSON.parse(await readFile(file, 'utf8')));
    console.log(format === '--json' ? JSON.stringify(result, null, 2) : displayOutputsForMain(result));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
