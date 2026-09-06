import { parse, derivative as differentiate, simplify } from 'mathjs';

import { FUNCTIONS, NUMERIC_FUNCTIONS, MechanicsInputError } from './numeric.mjs';
export { MechanicsInputError, evaluateExpression, compileExpression, integrateMotion } from './numeric.mjs';

const LIMITS = Object.freeze({ characters: 1200, tokens: 320, depth: 16, constants: 20, exponent: 8 });
const VELOCITIES = ['v1', 'v2'];
const MOMENTA = ['p1', 'p2'];
const ACCELERATIONS = ['a1', 'a2'];
const canonicalCache = new Map();
const derivativeCache = new Map();

function remember(cache, key, compute) {
  if (cache.has(key)) return cache.get(key);
  const value = compute();
  if (cache.size >= 256) cache.delete(cache.keys().next().value);
  cache.set(key, value);
  return value;
}

/** Parse only arithmetic expressions, never assignments, CAS commands or JavaScript. */
function validateExpression(source, symbols, label) {
  if (typeof source !== 'string' || !source.trim()) throw new MechanicsInputError(`${label} needs an expression.`);
  if (source.length > LIMITS.characters) throw new MechanicsInputError(`${label} is too long (maximum ${LIMITS.characters} characters).`);
  const tokens = [];
  const regex = /\s*(?:(\d+(?:\.\d*)?|\.\d+)(?:[eE]([+-]?\d+))?|([A-Za-z][A-Za-z0-9_]*)|([+*/^()\-]))/gy;
  let cursor = 0;
  while (cursor < source.length) {
    if (!source.slice(cursor).trim()) break;
    regex.lastIndex = cursor;
    const match = regex.exec(source);
    if (!match) throw new MechanicsInputError(`${label} contains an unsupported character near “${source.slice(cursor, cursor + 12).trim()}”. Use ordinary arithmetic and explicit multiplication (*).`);
    const value = match[1] ? `${match[1]}${match[2] ? `e${match[2]}` : ''}` : match[3] || match[4];
    if (match[1] && (!Number.isFinite(Number(value)) || Math.abs(Number(value)) > 1e12)) throw new MechanicsInputError(`${label} contains a number outside the supported range.`);
    tokens.push({ value, type: match[1] ? 'number' : match[3] ? 'name' : 'operator' });
    cursor = regex.lastIndex;
  }
  if (tokens.length > LIMITS.tokens) throw new MechanicsInputError(`${label} is too complex (maximum ${LIMITS.tokens} tokens).`);
  let position = 0;
  let depth = 0;
  const peek = () => tokens[position]?.value;
  const take = value => {
    if (peek() !== value) throw new MechanicsInputError(`${label}: expected “${value}”.`);
    position += 1;
  };
  function atom() {
    if (++depth > LIMITS.depth) throw new MechanicsInputError(`${label} is nested too deeply.`);
    const token = tokens[position++];
    if (!token) throw new MechanicsInputError(`${label} ends before the expression is complete.`);
    if (token.value === '(') { sum(); take(')'); }
    else if (token.type === 'name') {
      if (FUNCTIONS.has(token.value)) { take('('); sum(); take(')'); }
      else if (!symbols.has(token.value)) throw new MechanicsInputError(`Unknown symbol “${token.value}” in ${label}. Add it to the constants, or use q1, q2, v1, v2 and t.`);
    } else if (token.type !== 'number') throw new MechanicsInputError(`${label}: expected a number, symbol or parenthesized expression.`);
    depth -= 1;
  }
  function power() {
    atom();
    if (peek() === '^') {
      position += 1;
      const wrapped = peek() === '(';
      if (wrapped) position += 1;
      const sign = peek() === '-' || peek() === '+' ? tokens[position++].value : '';
      const exponent = tokens[position++];
      if (exponent?.type !== 'number' || Math.abs(Number(sign + exponent.value)) > LIMITS.exponent) throw new MechanicsInputError(`${label}: use a numerical exponent between -${LIMITS.exponent} and ${LIMITS.exponent}.`);
      if (wrapped) take(')');
    }
  }
  function unary() { if (peek() === '+' || peek() === '-') { position += 1; unary(); } else power(); }
  function product() { unary(); while (peek() === '*' || peek() === '/') { position += 1; unary(); } }
  function sum() { product(); while (peek() === '+' || peek() === '-') { position += 1; product(); } }
  sum();
  if (position !== tokens.length) throw new MechanicsInputError(`${label}: use explicit multiplication (*) between factors.`);
  return source.trim();
}

function expression(value) { return typeof value === 'string' ? parse(value) : value; }
function canonical(value) {
  const key = typeof value === 'string' ? value : value.toString();
  return remember(canonicalCache, key, () => simplify(expression(value), {}, { context: simplify.realContext }).toString({ parenthesis: 'auto', implicit: 'show' }));
}
function derivative(value, variable) {
  const key = `${variable}:${typeof value === 'string' ? value : value.toString()}`;
  return remember(derivativeCache, key, () => canonical(differentiate(expression(value), variable, { simplify: false })));
}
function expand(value) { return canonical(value); }
function sum(values) { return canonical(values.length ? values.map(value => `(${value})`).join('+') : '0'); }
function substitute(value, variables, replacements) {
  // Replacement values contain no source variables in every use below.
  const replacementsByName = new Map(variables.map((variable, index) => [variable, parse(replacements[index])]));
  return canonical(expression(value).transform(node => node.isSymbolNode && replacementsByName.has(node.name) ? replacementsByName.get(node.name).cloneDeep() : node));
}
function isZero(value) {
  return canonical(value) === '0';
}
function assertNoVariables(value, forbidden, message) {
  const variables = expression(value).filter(node => node.isSymbolNode).map(node => node.name);
  if (variables.some(variable => forbidden.includes(variable))) throw new MechanicsInputError(message);
}

export function toLatex(value) {
  // Format symbol nodes before rendering, so all numbered constants follow the
  // same convention regardless of the CAS's built-in names (such as m3).
  return expression(value).toTex({ handler: node => {
    if (!node.isSymbolNode) return undefined;
    const derivative = /^([va])([12])$/.exec(node.name);
    if (derivative) return `\\${derivative[1] === 'v' ? 'dot' : 'ddot'}{q}_{${derivative[2]}}`;
    if (node.name === 'energy') return String.raw`\mathcal{E}`;
    const indexed = /^([A-Za-z]+)_?(\d+)$/.exec(node.name);
    if (indexed) return `${indexed[1].length === 1 ? indexed[1] : parse(indexed[1]).toTex().trim()}_{${indexed[2]}}`;
    return /^[A-Za-z]$/.test(node.name) ? node.name : undefined;
  } }).replace(/\\cdot\s*/g, '\\,');
}

function output(value, lhs) {
  const normalized = canonical(value);
  const latex = toLatex(normalized);
  return { expression: normalized, latex, ...(lhs ? { lhs, equationLatex: `${lhs}=${latex}` } : {}) };
}

function realDomainConditions(expressions) {
  const conditions = new Map();
  for (const source of expressions) {
    const calls = /\b(log|sqrt|abs|asin|acos)\s*\(/g;
    let match;
    while ((match = calls.exec(source))) {
      const start = calls.lastIndex;
      let depth = 1, end = start;
      while (end < source.length && depth) {
        if (source[end] === '(') depth += 1;
        if (source[end] === ')') depth -= 1;
        end += 1;
      }
      const argument = canonical(source.slice(start, end - 1));
      const restricted = match[1] === 'abs' ? `${argument} != 0` : ['asin', 'acos'].includes(match[1]) ? `-1 < ${argument} < 1` : `${argument} > 0`;
      const latex = match[1] === 'abs' ? `${toLatex(argument)}\\ne 0` : ['asin', 'acos'].includes(match[1]) ? `-1<${toLatex(argument)}<1` : `${toLatex(argument)}>0`;
      conditions.set(restricted, { expression: restricted, latex });
    }
  }
  return [...conditions.values()];
}

export function userEnteredConstantsToSymAndArray(constants = []) {
  if (!Array.isArray(constants) || constants.length > LIMITS.constants) throw new MechanicsInputError(`Enter at most ${LIMITS.constants} constant names.`);
  const reserved = new Set([...FUNCTIONS, ...Object.keys(NUMERIC_FUNCTIONS), 'q1', 'q2', ...VELOCITIES, ...ACCELERATIONS, ...MOMENTA, 't', 'energy', 'pi', 'e', 'i', 'Infinity', 'NaN', 'true', 'false', 'null', 'undefined']);
  for (const name of constants) {
    if (typeof name !== 'string' || !/^[A-Za-z][A-Za-z0-9_]{0,15}$/.test(name) || reserved.has(name)) throw new MechanicsInputError(`“${String(name)}” is not an available constant name. Use a short letter-based name such as m1, l or g.`);
  }
  if (new Set(constants).size !== constants.length) throw new MechanicsInputError('Each constant needs a distinct name.');
  return [...constants];
}

function normalizeInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new MechanicsInputError('Enter a system with kinetic and potential energies.');
  const coordinates = input.coordinates ?? ['q1', 'q2'];
  if (!Array.isArray(coordinates) || ![1, 2].includes(coordinates.length) || coordinates.some((q, index) => q !== `q${index + 1}`)) throw new MechanicsInputError('Use coordinates [q1] or [q1, q2].');
  const constants = userEnteredConstantsToSymAndArray(input.constants);
  const symbols = new Set([...coordinates, ...VELOCITIES.slice(0, coordinates.length), ...constants, 't', 'pi', 'e']);
  return {
    kinetic: validateExpression(input.kinetic, symbols, 'kinetic energy'),
    potential: validateExpression(input.potential, symbols, 'potential energy'),
    coordinates: [...coordinates], constants,
  };
}

export function previewSystem(input) {
  try {
    const normalized = normalizeInput(input);
    const kinetic = output(normalized.kinetic, 'T'), potential = output(normalized.potential, 'V');
    return { kinetic, potential, domainConditions: realDomainConditions([normalized.kinetic, normalized.potential, kinetic.expression, potential.expression]) };
  } catch (error) {
    if (error instanceof MechanicsInputError) throw error;
    throw new MechanicsInputError(`The expression could not be read: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function calculateLagrangian(kinetic, potential) {
  return output(`(${kinetic})-(${potential})`, 'L');
}

/** d/dt acting on a function of q, v, and explicit time. */
function totalTimeDerivative(value, coordinates) {
  return sum([derivative(value, 't'), ...coordinates.flatMap((q, i) => [
    `(${derivative(value, q)})*${VELOCITIES[i]}`,
    `(${derivative(value, VELOCITIES[i])})*${ACCELERATIONS[i]}`,
  ])]);
}

export function calculateEulerLagrange(lagrangian, coordinates = ['q1', 'q2']) {
  const L = typeof lagrangian === 'string' ? lagrangian : lagrangian.expression;
  const momenta = coordinates.map((_, index) => derivative(L, VELOCITIES[index]));
  return {
    momenta: momenta.map((p, i) => output(p, `p_{${i + 1}}`)),
    equations: coordinates.map((q, i) => {
      const result = output(expand(`(${totalTimeDerivative(momenta[i], coordinates)})-(${derivative(L, q)})`));
      return { ...result, equationLatex: `${result.latex}=0` };
    }),
  };
}

function matrixFromEquations(equations, unknowns) {
  const matrix = equations.map(equation => unknowns.map(variable => derivative(equation, variable)));
  for (const row of matrix) for (const entry of row) assertNoVariables(entry, unknowns, 'These equations are nonlinear in the unknowns; this solver supports a regular linear acceleration or momentum system.');
  return matrix;
}

function inverseMatrix(matrix) {
  const determinant = matrix.length === 1 ? matrix[0][0] : canonical(`(${matrix[0][0]})*(${matrix[1][1]})-(${matrix[0][1]})*(${matrix[1][0]})`);
  if (isZero(determinant)) throw new MechanicsInputError('The velocity mass matrix is singular. Remove a dependent coordinate, or include its kinetic energy. A regular Hamiltonian cannot be constructed for this input.');
  return { determinant };
}
function solveLinear(matrix, vector, determinant) {
  if (matrix.length === 1) return [canonical(`(${vector[0]})/(${determinant})`)];
  return [
    canonical(`((${matrix[1][1]})*(${vector[0]})-(${matrix[0][1]})*(${vector[1]}))/(${determinant})`),
    canonical(`((${matrix[0][0]})*(${vector[1]})-(${matrix[1][0]})*(${vector[0]}))/(${determinant})`),
  ];
}

export function solveEulerLagrangeEquations(equations, coordinates = ['q1', 'q2']) {
  const values = equations.map(equation => typeof equation === 'string' ? equation : equation.expression);
  const accelerations = ACCELERATIONS.slice(0, coordinates.length);
  const matrix = matrixFromEquations(values, accelerations);
  const { determinant } = inverseMatrix(matrix);
  const forcing = values.map(value => canonical(`-(${substitute(value, accelerations, accelerations.map(() => '0'))})`));
  return {
    accelerations: solveLinear(matrix, forcing, determinant).map((a, i) => output(a, `\\ddot{q}_{${i + 1}}`)),
    massMatrix: matrix.map(row => row.map(entry => output(entry))),
    forcing: forcing.map(value => output(value)),
    determinant: output(determinant),
  };
}

export function calculateHamiltonian(lagrangian, coordinates = ['q1', 'q2']) {
  const L = typeof lagrangian === 'string' ? lagrangian : lagrangian.expression;
  const velocities = VELOCITIES.slice(0, coordinates.length);
  const momenta = velocities.map(v => derivative(L, v));
  const massMatrix = momenta.map(p => velocities.map(v => derivative(p, v)));
  for (const row of massMatrix) for (const entry of row) assertNoVariables(entry, velocities, 'This browser port supports energies at most quadratic in generalized velocities. Nonlinear velocity-to-momentum inversion needs a separate branch/domain analysis.');
  const { determinant } = inverseMatrix(massMatrix);
  const offsets = momenta.map(p => substitute(p, velocities, velocities.map(() => '0')));
  const shiftedMomenta = offsets.map((offset, i) => canonical(`${MOMENTA[i]}-(${offset})`));
  const velocitySolutions = solveLinear(massMatrix, shiftedMomenta, determinant);
  const constantTerm = substitute(L, velocities, velocities.map(() => '0'));
  // L = 1/2 v^T A v + b^T v + c, so H = 1/2 (p-b)^T A^-1(p-b) - c.
  // Inverting A simultaneously is essential when the velocities are coupled.
  const H = canonical(`(${sum(shiftedMomenta.map((p, i) => `(${p})*(${velocitySolutions[i]})`))})/2-(${constantTerm})`);
  assertNoVariables(H, velocities, 'The momentum inversion left an unresolved velocity.');
  return {
    hamiltonian: output(H, 'H'),
    velocitySolutions: velocitySolutions.map((v, i) => output(v, `\\dot{q}_{${i + 1}}`)),
    determinant: output(determinant),
  };
}

export function calculateHamiltonsEquationsOfMotion(hamiltonian, coordinates = ['q1', 'q2']) {
  const H = typeof hamiltonian === 'string' ? hamiltonian : hamiltonian.expression;
  return {
    coordinates: coordinates.map((_, i) => output(derivative(H, MOMENTA[i]), `\\dot{q}_{${i + 1}}`)),
    momenta: coordinates.map((q, i) => output(`-(${derivative(H, q)})`, `\\dot{p}_{${i + 1}}`)),
  };
}

/** Solve H=energy for each momentum separately, with the other momentum held fixed. */
export function solvingHamiltonianForMomenta(hamiltonian, coordinates = ['q1', 'q2']) {
  const H = typeof hamiltonian === 'string' ? hamiltonian : hamiltonian.expression;
  return coordinates.map((_, index) => {
    const p = MOMENTA[index];
    const quadratic = canonical(`(${derivative(derivative(H, p), p)})/2`);
    const linear = substitute(derivative(H, p), [p], ['0']);
    const constant = canonical(`(${substitute(H, [p], ['0'])})-energy`);
    let roots;
    if (isZero(quadratic)) {
      if (isZero(linear)) return { momentum: p, roots: [], condition: 'The energy equation does not determine this momentum.' };
      roots = [output(`-(${constant})/(${linear})`, `p_{${index + 1}}`)];
    } else {
      const discriminant = `(${linear})^2-4*(${quadratic})*(${constant})`;
      roots = ['+', '-'].map(sign => output(`(-(${linear})${sign}sqrt(${discriminant}))/(2*(${quadratic}))`, `p_{${index + 1}}`));
    }
    return { momentum: p, roots, condition: 'Each branch is conditional on the other momentum and real square roots. This is not a simultaneous solution for all momenta.' };
  });
}

export function solveSystem(input) {
  try {
    const normalized = normalizeInput(input);
    const { kinetic, potential, coordinates } = normalized;
    const velocities = VELOCITIES.slice(0, coordinates.length);
    assertNoVariables(potential, velocities, 'Potential energy must depend on coordinates and time, not velocities. Put a velocity-linear term in the kinetic/Lagrangian input.');
    const lagrangian = calculateLagrangian(kinetic, potential);
    // Check the Legendre map before spending work on acceleration expressions.
    const hamiltonianResult = calculateHamiltonian(lagrangian, coordinates);
    const euler = calculateEulerLagrange(lagrangian, coordinates);
    const accelerationResult = solveEulerLagrangeEquations(euler.equations, coordinates);
    const hamiltonEquations = calculateHamiltonsEquationsOfMotion(hamiltonianResult.hamiltonian, coordinates);
    const domainConditions = realDomainConditions([kinetic, potential, lagrangian.expression, hamiltonianResult.hamiltonian.expression]);
    return {
      input: normalized,
      kinetic: output(kinetic, 'T'), potential: output(potential, 'V'), lagrangian,
      eulerLagrange: euler.equations, momenta: euler.momenta,
      ...accelerationResult, ...hamiltonianResult, hamiltonEquations,
      energyMomentumRoots: solvingHamiltonianForMomenta(hamiltonianResult.hamiltonian, coordinates),
      domainConditions,
      verification: {
        method: 'Symbolic differentiation and simultaneous inversion of the velocity Hessian.',
        checks: ['One or two independent coordinates.', 'Velocity Hessian has no velocity dependence.', 'Detected singular mass matrices are rejected; nonzero determinant remains a condition, not a general symbolic proof.'],
        conditions: [`${accelerationResult.determinant.expression} != 0`, ...domainConditions.map(condition => condition.expression), 'All expressions and derivatives must exist at the chosen coordinates, time and constants.'],
        physicalModelVerified: false,
        note: 'The equations follow from the supplied energies. This does not verify that those energies describe the intended physical system. Explicit time dependence need not conserve H.',
      },
    };
  } catch (error) {
    if (error instanceof MechanicsInputError) throw error;
    throw new MechanicsInputError(`The symbolic calculation could not finish: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export const callFunctionsForMain = solveSystem;

export function displayOutputsForMain(result) {
  const lines = [`L = ${result.lagrangian.expression}`, ...result.accelerations.map((value, i) => `a${i + 1} = ${value.expression}`), `H = ${result.hamiltonian.expression}`,
    ...result.hamiltonEquations.coordinates.map((value, i) => `dq${i + 1}/dt = ${value.expression}`),
    ...result.hamiltonEquations.momenta.map((value, i) => `dp${i + 1}/dt = ${value.expression}`)];
  return lines.join('\n');
}

export const inputLimits = LIMITS;
