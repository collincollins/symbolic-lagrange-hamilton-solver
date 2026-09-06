import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';

const [projectLicense, dependencyLicenses] = await Promise.all([
  readFile(new URL('../LICENSE', import.meta.url), 'utf8'),
  readFile(new URL('../THIRD_PARTY_LICENSES.md', import.meta.url), 'utf8'),
]);

const common = {
  bundle: true,
  platform: 'browser',
  format: 'esm',
  target: 'es2020',
  logLevel: 'info',
};

await build({
  ...common,
  entryPoints: [new URL('../src/solver.mjs', import.meta.url).pathname],
  outfile: new URL('../dist/solver.mjs', import.meta.url).pathname,
  banner: { js: `/*!\nSymbolic Lagrange-Hamilton Solver — generated browser bundle.\n\n${projectLicense}\n${dependencyLicenses}\n*/` },
});

// the numerical interpreter and integrator do not need the symbolic dependency.
await build({
  ...common,
  entryPoints: [new URL('../src/numeric.mjs', import.meta.url).pathname],
  outfile: new URL('../dist/numeric.mjs', import.meta.url).pathname,
  banner: { js: `/*!\nSymbolic Lagrange-Hamilton Solver — generated numerical browser bundle.\n\n${projectLicense}\n*/` },
});
