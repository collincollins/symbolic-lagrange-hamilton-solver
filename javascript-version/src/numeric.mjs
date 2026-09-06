export const FUNCTIONS = new Set(['sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'sinh', 'cosh', 'tanh', 'exp', 'log', 'sqrt']);
export const NUMERIC_FUNCTIONS = {
  ...Object.fromEntries([...FUNCTIONS].map(name => [name, Math[name]])),
  abs: Math.abs, sign: Math.sign,
  sec: x => 1 / Math.cos(x), csc: x => 1 / Math.sin(x), cot: x => 1 / Math.tan(x),
  sech: x => 1 / Math.cosh(x), csch: x => 1 / Math.sinh(x), coth: x => 1 / Math.tanh(x),
};
export class MechanicsInputError extends Error {
  constructor(message) { super(message); this.name = 'MechanicsInputError'; }
}

function validateValues(values) {
  if (!values || typeof values !== 'object' || Array.isArray(values)) throw new MechanicsInputError('Numeric substitutions must be an object.');
  for (const [name, number] of Object.entries(values)) if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(name) || typeof number !== 'number' || !Number.isFinite(number)) throw new MechanicsInputError('Substitutions must be named finite numbers.');
}

/** Compile arithmetic to stack instructions, never JavaScript or CAS commands. */
export function compileExpression(value) {
  if (typeof value !== 'string' || value.length > 50000) throw new MechanicsInputError('The numerical expression is too long.');
  const tokens = [];
  const regex = /\s*(?:(\d+(?:\.\d*)?|\.\d+)(?:[eE]([+-]?\d+))?|([A-Za-z][A-Za-z0-9_]*)|([+*/^()\-]))/gy;
  let cursor = 0;
  while (cursor < value.length) {
    if (!value.slice(cursor).trim()) break;
    regex.lastIndex = cursor;
    const match = regex.exec(value);
    if (!match) throw new MechanicsInputError('Unsupported syntax in the numerical expression.');
    tokens.push(match[1] ? { number: Number(`${match[1]}${match[2] ? `e${match[2]}` : ''}`) } : { name: match[3] || match[4] });
    cursor = regex.lastIndex;
  }
  if (tokens.length > 16000) throw new MechanicsInputError('The numerical expression is too complex.');
  const instructions = [];
  let position = 0, depth = 0;
  const peek = () => tokens[position]?.name;
  const requireClose = () => { if (peek() !== ')') throw new MechanicsInputError('Expected a closing parenthesis.'); position += 1; };
  function primary() {
    const token = tokens[position++];
    if (!token) throw new MechanicsInputError('The numerical expression is incomplete.');
    if ('number' in token) instructions.push({ number: token.number });
    else if (token.name === '(') { addition(); requireClose(); }
    else if (Object.hasOwn(NUMERIC_FUNCTIONS, token.name)) {
      if (peek() !== '(') throw new MechanicsInputError('A mathematical function needs parentheses.');
      position += 1; addition(); requireClose();
      instructions.push({ fn: NUMERIC_FUNCTIONS[token.name] });
    } else if (/^[A-Za-z][A-Za-z0-9_]*$/.test(token.name)) instructions.push({ symbol: token.name });
    else throw new MechanicsInputError('Unsupported syntax in the numerical expression.');
  }
  function power() { primary(); if (peek() === '^') { position += 1; unary(); instructions.push({ operator: '^' }); } }
  function unary() {
    if (++depth > 100) throw new MechanicsInputError('The numerical expression is nested too deeply.');
    if (peek() === '-' || peek() === '+') { const sign = tokens[position++].name; unary(); if (sign === '-') instructions.push({ fn: x => -x }); }
    else power();
    depth -= 1;
  }
  function multiplication() { unary(); while (peek() === '*' || peek() === '/') { const operator = tokens[position++].name; unary(); instructions.push({ operator }); } }
  function addition() { multiplication(); while (peek() === '+' || peek() === '-') { const operator = tokens[position++].name; multiplication(); instructions.push({ operator }); } }
  addition();
  if (position !== tokens.length) throw new MechanicsInputError('Unsupported syntax in the numerical expression.');
  return (values = {}) => {
    validateValues(values);
    const stack = [];
    for (const instruction of instructions) {
      if ('number' in instruction) stack.push(instruction.number);
      else if (instruction.symbol) {
        const name = instruction.symbol;
        if (Object.hasOwn(values, name)) stack.push(values[name]);
        else if (name === 'pi') stack.push(Math.PI);
        else if (name === 'e') stack.push(Math.E);
        else throw new MechanicsInputError(`Missing numerical value or unsupported symbol: ${name}.`);
      } else if (instruction.fn) stack[stack.length - 1] = instruction.fn(stack[stack.length - 1]);
      else {
        const right = stack.pop(), left = stack.pop();
        switch (instruction.operator) {
          case '+': stack.push(left + right); break;
          case '-': stack.push(left - right); break;
          case '*': stack.push(left * right); break;
          case '/': stack.push(left / right); break;
          case '^': stack.push(left ** right); break;
        }
      }
    }
    const result = stack[0];
    if (!Number.isFinite(result)) throw new MechanicsInputError('The expression is not finite and real at these values.');
    return result;
  };
}

/** Evaluate once using the same grammar and substitution checks as the compiler. */
export function evaluateExpression(value, values = {}) {
  validateValues(values);
  return compileExpression(value)(values);
}

/** Integrate solver-derived accelerations with classical fourth-order Runge–Kutta. */
export function integrateMotion(options) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) throw new MechanicsInputError('Motion needs acceleration expressions and initial conditions.');
  const { accelerations, constants = {}, q0, v0, duration, dt = 1 / 480, sampleRate = 60, bounds } = options;
  const dimension = accelerations?.length;
  if (!Array.isArray(accelerations) || ![1, 2].includes(dimension) || Array.from(accelerations).some(value => typeof value !== 'string')) throw new MechanicsInputError('Motion needs one or two acceleration expressions.');
  for (const values of [q0, v0]) if (!Array.isArray(values) || values.length !== dimension || values.some(value => !Number.isFinite(value))) throw new MechanicsInputError('Initial coordinates and velocities must be finite arrays matching the accelerations.');
  if (!Number.isFinite(duration) || duration < 0 || duration > 20) throw new MechanicsInputError('Motion duration must be between 0 and 20 seconds.');
  if (!Number.isFinite(dt) || dt < 1 / 20000 || dt > 1 / 60) throw new MechanicsInputError('The integration step must be between 1/20000 and 1/60 second.');
  if (!Number.isFinite(sampleRate) || sampleRate < 1 || sampleRate > 240) throw new MechanicsInputError('The sample rate must be between 1 and 240 frames per second.');
  validateValues(constants);
  if (Object.keys(constants).some(name => /^(?:[qvap][12]|t)$/.test(name))) throw new MechanicsInputError('Motion constants cannot replace coordinates, velocities, momenta, accelerations or time.');
  if (bounds !== undefined && (!Array.isArray(bounds) || bounds.length !== dimension || Array.from(bounds).some(bound => !bound || !Number.isFinite(bound.min) || !Number.isFinite(bound.max) || bound.min >= bound.max))) throw new MechanicsInputError('Coordinate bounds must be finite increasing min/max pairs.');
  const outside = state => bounds?.some((bound, i) => state[i] < bound.min || state[i] > bound.max) ?? false;
  if (outside(q0)) throw new MechanicsInputError('Initial coordinates lie outside their bounds.');
  const functions = accelerations.map(compileExpression);
  const environment = { ...constants };
  function rate(time, state) {
    environment.t = time;
    for (let i = 0; i < dimension; i++) { environment[`q${i + 1}`] = state[i]; environment[`v${i + 1}`] = state[dimension + i]; }
    return [...state.slice(dimension), ...functions.map(fn => fn(environment))];
  }
  function step(time, state, h) {
    const offset = (rates, multiplier) => state.map((value, i) => value + multiplier * rates[i]);
    const k1 = rate(time, state), k2 = rate(time + h / 2, offset(k1, h / 2));
    const k3 = rate(time + h / 2, offset(k2, h / 2)), k4 = rate(time + h, offset(k3, h));
    const result = state.map((value, i) => value + h * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]) / 6);
    if (result.some(value => !Number.isFinite(value))) throw new MechanicsInputError('The numerical trajectory is not finite.');
    return result;
  }
  const frame = (time, state) => ({ time, q: state.slice(0, dimension), v: state.slice(dimension) });
  let state = [...q0, ...v0], time = 0;
  // Check every acceleration even if the requested duration is zero.
  const initialRate = rate(0, state);
  const frames = [frame(0, state)];
  if (bounds?.some((bound, i) => (q0[i] === bound.min && (v0[i] < 0 || (v0[i] === 0 && initialRate[dimension + i] < 0))) || (q0[i] === bound.max && (v0[i] > 0 || (v0[i] === 0 && initialRate[dimension + i] > 0))))) return { frames, duration: 0, stoppedAtBound: true };
  for (let index = 1; time < duration; index++) {
    const target = Math.min(index / sampleRate, duration);
    while (time < target) {
      const h = Math.min(dt, target - time), next = step(time, state, h);
      let crossingTime = outside(next) ? h : undefined;
      // A coordinate can briefly cross a limit and return within one step.
      // Check a velocity reversal as well as the endpoint, so that a turning
      // point just beyond a limit does not disappear between output frames.
      if (bounds) for (let i = 0; i < dimension; i++) {
        const initialVelocity = state[dimension + i], finalVelocity = next[dimension + i];
        if (initialVelocity * finalVelocity >= 0) continue;
        let low = 0, high = h;
        for (let iteration = 0; iteration < 32; iteration++) {
          const middle = (low + high) / 2, candidate = step(time, state, middle);
          if (candidate[dimension + i] * initialVelocity > 0) low = middle;
          else high = middle;
        }
        const peakTime = (low + high) / 2;
        if (outside(step(time, state, peakTime))) crossingTime = Math.min(crossingTime ?? h, peakTime);
      }
      if (crossingTime !== undefined) {
        // Refine the earliest boundary crossing in this step, retaining the
        // state on the valid side of the boundary rather than overshooting it.
        let low = 0, high = crossingTime, end = state;
        for (let iteration = 0; iteration < 40; iteration++) {
          const middle = (low + high) / 2, candidate = step(time, state, middle);
          if (outside(candidate)) high = middle;
          else { low = middle; end = candidate; }
        }
        const endTime = time + low;
        if (endTime > frames.at(-1).time) frames.push(frame(endTime, end));
        return { frames, duration: endTime, stoppedAtBound: true };
      }
      state = next;
      time = h === target - time ? target : time + h;
    }
    frames.push(frame(target, state));
  }
  return { frames, duration, stoppedAtBound: false };
}
