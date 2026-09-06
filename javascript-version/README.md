# Symbolic Lagrange–Hamilton Solver — JavaScript version

This is a JavaScript port of the workflow in Collin Collins' MATLAB solver: enter kinetic and potential energies, derive the Euler–Lagrange equations, solve for the accelerations, and construct the Hamiltonian and Hamilton equations. The original MATLAB files remain unchanged.

The port handles **regular systems with one or two generalized coordinates**, whose Lagrangian is at most quadratic in generalized velocities. Coefficients may depend on coordinates or time, and velocity-linear terms are supported. This includes the Atwood machine, a sliding wedge, coupled spring masses, and a double pendulum. It is not a solver for every possible two-coordinate Lagrangian: singular systems, unresolved constraints, nonconservative forces, and nonlinear momentum inversion need additional treatment. Such unsupported velocity inversions produce an error rather than a guessed Hamiltonian.

## Run locally

```sh
npm ci
npm test
npm run example
npm run build
```

Node 20 or later is recommended. `src/solver.mjs` is the readable implementation. `dist/solver.mjs` is a self-contained browser ESM bundle generated with esbuild; it is not a second implementation. mathjs 15.2.0 and esbuild 0.25.12 are pinned in `package-lock.json`. mathjs does the symbolic parsing and differentiation; the simultaneous linear solve and the bounded numeric interpreter are implemented here.

## Enter a system

```js
import { solveSystem, evaluateExpression } from './src/solver.mjs';

const result = solveSystem({
  kinetic: '(m1+m2)*v1^2/2',
  potential: '(m2-m1)*g*q1',
  coordinates: ['q1'],
  constants: ['m1', 'm2', 'g'],
});

console.log(result.accelerations[0].equationLatex);
console.log(evaluateExpression(result.accelerations[0].expression,
  { m1: 5, m2: 3, g: 9.81 }));
```

Use `coordinates: ['q1', 'q2']` for two independent coordinates. Enter `q1`, `q2` for positions, `v1`, `v2` for their time derivatives, and `t` for explicit time dependence. The constant names are symbolic; numerical values are supplied later when evaluating an equation. In the example above, `q1` increases when mass `m1` moves downward, and the pulley is massless. The ordinary Atwood machine has one independent coordinate even though two masses move.

Supported input syntax:

- Ordinary arithmetic with explicit multiplication: `m*v1^2/2`.
- Numerical powers between −8 and 8: `q1^2`, `q1^(-1)`.
- Parentheses and `sin`, `cos`, `tan`, `asin`, `acos`, `atan`, `sinh`, `cosh`, `tanh`, `exp`, `log`, `sqrt`.
- Named constants such as `m`, `m1`, `l2`, `g`, `theta`, plus built-in `pi` and `e`.

Assignments, JavaScript, CAS commands, implicit multiplication and arbitrary functions are rejected before calling mathjs. Inputs have character, token, nesting, constant-count and power limits. Coordinate functions must be differentiable at the point of use. Input expressions use plain notation, and **all generated equations also include LaTeX**. For `T` and `V` previews without solving, call `previewSystem(input)`.

## Result

`solveSystem(input)` returns a JSON-serializable object:

```text
input
kinetic, potential, lagrangian                 {expression, latex, lhs, equationLatex}
eulerLagrange                                 [{expression, latex, equationLatex}]
accelerations, momenta, velocitySolutions     [equation objects]
massMatrix                                   [[equation objects]]
forcing                                      [equation objects]
determinant                                  {expression, latex}
hamiltonian                                  equation object
hamiltonEquations                             {coordinates: [...], momenta: [...]}
energyMomentumRoots                          [{momentum, roots, condition}]
domainConditions                             [{expression, latex}]
verification                                 {method, checks, conditions, physicalModelVerified, note}
```

For Euler–Lagrange equations, `expression` is the left side of `d/dt(∂L/∂vᵢ) − ∂L/∂qᵢ = 0`. For an acceleration, `expression` is the solved right side. The generated LaTeX uses dotted generalized coordinates instead of the input's `v1`/`a1` notation.

The mass-matrix determinant must be nonzero at the selected parameters and position. The solver rejects determinants it can simplify to zero; it does not claim a general decision procedure for all identities. Every returned solution remains conditional on a nonzero determinant, even if a more involved identity would make that condition impossible. Structural checks do **not** certify that a visitor has entered the physically correct energies: `physicalModelVerified` is deliberately `false` for a custom system.

Respect the returned `domainConditions` as well. They are collected from the original inputs as well as the resulting expressions, so a cancellation cannot erase an original logarithm or square-root restriction. Simplification uses mathjs's conservative `realContext`: for example, `log(q1^2)` remains valid at negative nonzero `q1`. This port does not track complex branches. The browser UI should display nonempty domain conditions beside the equations. Zeros of denominators, singular coordinates and any other undefined derivatives remain excluded by the result's general existence condition.

The energy roots solve `H = energy` for each momentum separately while holding the other momentum fixed. They are conditional branches, not a simultaneous determination of two momenta from one equation. For explicitly time-dependent systems, the Hamiltonian need not be conserved.

## Correspondence with the MATLAB files

| Original file | JavaScript equivalent |
| --- | --- |
| `MainProgram.m` | `cli.mjs` and `examples/atwood.json` |
| `userEnteredConstantsToSymAndArray.m` | `userEnteredConstantsToSymAndArray(constants)` |
| `calculateLagrangian.m` | `calculateLagrangian(kinetic, potential)` |
| `calculateEulerLagrange.m` | `calculateEulerLagrange(lagrangian, coordinates)` |
| `solveEulerLagrangeEquations.m` | `solveEulerLagrangeEquations(equations, coordinates)` |
| `calculateHamiltonian.m` | `calculateHamiltonian(lagrangian, coordinates)` |
| `calculateHamiltonsEquationsOfMotion.m` | `calculateHamiltonsEquationsOfMotion(hamiltonian, coordinates)` |
| `solvingHamiltonianForMomenta.m` | `solvingHamiltonianForMomenta(hamiltonian, coordinates)` |
| `callFunctionsForMain.m` | `callFunctionsForMain(input)`, an alias of `solveSystem(input)` |
| `displayOutputsForMain.m` | `displayOutputsForMain(result)`, returning printable text |

All functions are exported from `src/solver.mjs`. The validated entry points for visitor-supplied expressions are **`solveSystem` and `previewSystem`**; lower-level workflow functions expect trusted expressions and correctly paired coordinates. The port uses independent algebraic symbols for generalized coordinates, velocities and accelerations, with an explicit chain rule for `d/dt`, instead of MATLAB's symbolic time-dependent functions.

The velocity-to-momentum inversion is simultaneous. This matters for a cross term such as `m*cos(theta)*v1*v2`, because each momentum depends on both velocities. The original function isolated them separately; preserving that implementation would give incorrect coupled-system Hamiltonians. The original MATLAB implementation was inspected, but MATLAB was unavailable here; these are independently checked equations, not a claimed MATLAB/JavaScript execution-parity test.

## Browser use

```js
import { solveSystem, previewSystem } from './dist/solver.mjs';
```

Run symbolic work in a **Web Worker**, with an external timeout that terminates and replaces the worker. Input limits reduce work but cannot guarantee a worst-case running time for symbolic algebra. Do not run visitor-supplied symbolic work on the UI thread. The browser bundle has no network requests or Node dependencies. `evaluateExpression` interprets a mathematical expression with numeric substitutions and does not compile JavaScript or mutate those substitutions.

Run `npm run build` to rebuild `dist/solver.mjs` and `dist/numeric.mjs` after changing the source. If another repository serves the bundle, copy it from this repository; keep the source and its package lock here as the canonical version.

## Numerical playback from the derived equations

`integrateMotion` takes the acceleration expressions returned by `solveSystem`; it does not substitute a separately hard-coded set of equations. It integrates the corresponding first-order state `[q1, q2, v1, v2]` with classical fourth-order Runge–Kutta. One-coordinate systems use `[q1, v1]`.

```js
import { solveSystem, integrateMotion } from './src/solver.mjs';

const solved = solveSystem({
  kinetic: '(m1+m2)*v1^2/2',
  potential: '(m2-m1)*g*q1',
  coordinates: ['q1'],
  constants: ['m1', 'm2', 'g'],
});
const motion = integrateMotion({
  accelerations: solved.accelerations.map(item => item.expression),
  constants: { m1: 5, m2: 3, g: 9.81 },
  q0: [0],
  v0: [0],
  duration: 2,
  bounds: [{ min: -1.25, max: 1.25 }],
});
// motion.frames: [{ time, q: [...], v: [...] }, ...]
// motion.duration: actual final time
// motion.stoppedAtBound: whether a coordinate limit ended the trajectory
```

The default maximum integration step is 1/480 second, independent of the 60 Hz output sampling. The article's double-pendulum playback should request `dt: 1/1920`: its light first mass, heavy second mass and short rods produce substantially faster motion than the other presets. Steps are shortened to land on each output time and the requested final time. `dt` may be set between 1/20000 and 1/60 second for convergence checks; `sampleRate` accepts 1–240 Hz. Duration is limited to 0–20 seconds. The initial frame is always returned, and the final sample is not dropped when duration is not a multiple of the sampling interval. All inputs and numerical results must be finite real numbers. Explicit time dependence is evaluated at the Runge–Kutta stage times.

Optional coordinate bounds describe where this playback should stop, rather than collision forces. A crossing is refined within the integration step, including a coordinate turning back within that step, and every emitted coordinate stays within its bounds. No bounce, pulley contact, rope slack, or friction is inferred. The wedge's finite-block floor contact therefore remains a separate physical model. Like any fixed-step integrator, this is not an adaptive solver or a guarantee of accuracy for arbitrary rapidly varying systems; choose a smaller `dt` and compare trajectories when using another system. Chaotic pendulum trajectories can diverge between step sizes before their energy errors become large; the endpoint energy checks do not certify eight-second pointwise agreement in the most chaotic configurations. Domain restrictions on the derived equations remain the caller's responsibility.

`compileExpression(source)` returns a reusable function of a numerical substitutions object. It parses once into bounded arithmetic stack instructions; it uses neither `eval`, `Function`, nor JavaScript code generation. `evaluateExpression(source, values)` shares exactly that grammar and the same finite-number/substitution checks. For repeated evaluation outside the integrator:

```js
import { compileExpression } from './src/solver.mjs';
const acceleration = compileExpression(solved.accelerations[0].expression);
console.log(acceleration({ m1: 5, m2: 3, g: 9.81 }));
```

Numerical code lives in `src/numeric.mjs` and is re-exported by `src/solver.mjs`. The build also produces `dist/numeric.mjs`, a standalone browser bundle for evaluating already-derived expressions and integrating trajectories. It has no mathjs dependency and uses the same interpreter and integrator, without changing any symbolic derivation, simplification or integration rules. Keep symbolic derivation in a separate worker; use the numerical bundle when accelerations are already available. The bundle-parity tests compare exact values and complete trajectories against the readable source for all five reference systems.

## Verification

`npm test` checks independent force equations and identities rather than snapshotting the implementation:

- Atwood acceleration, and 12 double-Atwood mass combinations, against Richard Fitzpatrick's published [Atwood equations](https://farside.ph.utexas.edu/teaching/336k/Newtonhtml/node79.html). The simple case takes zero pulley inertia.
- Wedge accelerations and horizontal-momentum balance for 27 mass/angle combinations, using direct Newtonian force balance.
- Two coupled spring masses against the forces from three individual springs.
- Double-pendulum accelerations at 27 angle/velocity combinations against Erik Neumann's independently derived [explicit equations](https://www.myphysicslab.com/pendulum/double-pendulum-en.html), using absolute angles from the downward vertical, point masses and massless rigid rods. Also checks the instantaneous energy derivative and Hamiltonian velocity recovery.
- Coordinate-dependent mass, explicit time dependence, velocity-linear terms, conditional energy roots, coupled momentum inversion, singular systems, rejected syntax and numeric-interpreter behavior.
- Numerical trajectories against exact Atwood motion and rope constraints, a harmonic oscillator and a coupled-spring normal mode, plus time-dependent acceleration, bounded termination and sampling edge cases.
- Double-pendulum time-step convergence and energy conservation, with finite trajectories and energy drift below 0.001% of the gravitational energy scale across 32 endpoint mass, length and initial-angle combinations at `dt: 1/1920`. Coupled-spring energy conservation is checked across its endpoint mass and stiffness settings.

The numerical verification report in `test/motion-verification.json` records a local Node 23.6.1 sweep of the 32 pendulum endpoint combinations (masses 0.5 or 5 kg, lengths 0.6 or 1.6 m, initial angles +120°/+120° or +120°/−120°, initially at rest). Eight-second trajectories at `dt: 1/1920` took approximately 225 ms each, excluding symbolic derivation. The worst energy drift was **1.879 × 10⁻⁶ of `(m1+m2) g l1 + m2 g l2`**, or 0.000188%, for `m1 = 0.5`, `m2 = 5`, `l1 = l2 = 0.6` and initial angles +120°/−120°.

That same endpoint illustrates why energy and trajectory agreement are separate checks. Relative to a `dt: 1/7680` calculation, the Euclidean angle differences were:

| Step | 2 seconds | 4 seconds | 8 seconds |
| --- | ---: | ---: | ---: |
| 1/960 s | 0.00249 rad | 0.874 rad | 16.3 rad |
| 1/1920 s | 0.0000808 rad | 0.0287 rad | 2.47 rad |
| 1/3840 s | 0.00000253 rad | 0.000900 rad | 3.08 rad |

The short-time refinement converges, but eight-second trajectories in this strongly chaotic case have diverged. Angles in this diagnostic are unwrapped. The reference is a finer numerical integration, not an exact solution. Automated tests check short-time convergence for this endpoint and eight-second convergence for a less extreme configuration; the playback should not claim that all extreme eight-second trajectories agree point by point.


The separate physics audit's `test/reference-fixtures.json` contains 35 states across five source-backed examples. The JavaScript suite compares each state's full mass matrix, forcing vector and solved accelerations. `test/verify_sympy.py` optionally uses SymPy to check **58 exact symbolic identities** independently across five systems, including the full double-pendulum Hamiltonian and Hamilton equations. Run it with a Python environment containing SymPy; it creates no files. Both checks passed when this port was prepared.

The first Atwood test was run before `src/solver.mjs` existed and failed with `ERR_MODULE_NOT_FOUND`; it passed after the implementation was added. A subsequent independent review found incorrect signs, coefficients and nested-function derivatives in the initial symbolic dependency. The implementation now uses mathjs AST differentiation with automatic derivative simplification disabled, followed by simplification in `realContext`. It never evaluates visitor input with mathjs.

The regression suite exercises every advertised function with positive, negative and fractional coefficients, nested arguments, explicitly time-dependent velocity-linear terms, and coordinate-dependent inertia. Both Euler–Lagrange and Hamilton equations are compared with independent fourth-order numerical derivatives. Additional regressions cover nested exponentials and radicals, exponential values at ±50, and preservation of original real domains. The original five source-backed fixtures and exact SymPy checks remain in place.

The mathjs [derivative documentation](https://mathjs.org/docs/reference/functions/derivative.html), [real-context simplification documentation](https://mathjs.org/docs/reference/functions/simplify.html) and [AST documentation](https://mathjs.org/docs/expressions/expression_trees.html) describe the symbolic APIs used here. `LICENSE` and `THIRD_PARTY_LICENSES.md` retain the project's and dependencies' notices; the build also includes them in the browser bundle header.

### A double pendulum pulled by two springs

`node cli.mjs examples/spring-loaded-double-pendulum.json` derives the full Lagrangian and Hamiltonian workflow for the article’s “Whatever this is...” example. The matching `-playback.json` file records the initial conditions, fixed geometry, assumptions, and references. There are still only two independent angles; the spring lengths follow from those angles.

This combined model adds Hooke-law forces to the standard double pendulum; the references explain its ingredients, not this exact combined apparatus. Independent tests compare the derived acceleration with Cartesian force projection, recover the zero-stiffness double pendulum, check energy and nonzero spring distances over 20 seconds, and check short-time integration convergence. Long chaotic trajectories remain sensitive to numerical error. Links and springs may cross in the idealized diagram; collisions are not modeled.
