import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';

const [projectLicense, dependencyLicenses] = await Promise.all([
  readFile(new URL('../LICENSE', import.meta.url), 'utf8'),
  readFile(new URL('../THIRD_PARTY_LICENSES.md', import.meta.url), 'utf8'),
]);

await build({
  entryPoints: [new URL('../src/solver.mjs', import.meta.url).pathname],
  outfile: new URL('../dist/solver.mjs', import.meta.url).pathname,
  bundle: true,
  platform: 'browser',
  format: 'esm',
  target: 'es2020',
  banner: { js: `/*!\nSymbolic Lagrange-Hamilton Solver — generated browser bundle.\n\n${projectLicense}\n${dependencyLicenses}\n*/` },
  logLevel: 'info',
});
