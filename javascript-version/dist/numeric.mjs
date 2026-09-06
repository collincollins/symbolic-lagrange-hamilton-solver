/*!
Symbolic Lagrange-Hamilton Solver — generated numerical browser bundle.

MIT License

Copyright (c) 2024 Collin Collins

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

*/

// src/numeric.mjs
var FUNCTIONS = /* @__PURE__ */ new Set(["sin", "cos", "tan", "asin", "acos", "atan", "sinh", "cosh", "tanh", "exp", "log", "sqrt"]);
var NUMERIC_FUNCTIONS = {
  ...Object.fromEntries([...FUNCTIONS].map((name) => [name, Math[name]])),
  abs: Math.abs,
  sign: Math.sign,
  sec: (x) => 1 / Math.cos(x),
  csc: (x) => 1 / Math.sin(x),
  cot: (x) => 1 / Math.tan(x),
  sech: (x) => 1 / Math.cosh(x),
  csch: (x) => 1 / Math.sinh(x),
  coth: (x) => 1 / Math.tanh(x)
};
var MechanicsInputError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "MechanicsInputError";
  }
};
function validateValues(values) {
  if (!values || typeof values !== "object" || Array.isArray(values)) throw new MechanicsInputError("Numeric substitutions must be an object.");
  for (const [name, number] of Object.entries(values)) if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(name) || typeof number !== "number" || !Number.isFinite(number)) throw new MechanicsInputError("Substitutions must be named finite numbers.");
}
function compileExpression(value) {
  if (typeof value !== "string" || value.length > 5e4) throw new MechanicsInputError("The numerical expression is too long.");
  const tokens = [];
  const regex = /\s*(?:(\d+(?:\.\d*)?|\.\d+)(?:[eE]([+-]?\d+))?|([A-Za-z][A-Za-z0-9_]*)|([+*/^()\-]))/gy;
  let cursor = 0;
  while (cursor < value.length) {
    if (!value.slice(cursor).trim()) break;
    regex.lastIndex = cursor;
    const match = regex.exec(value);
    if (!match) throw new MechanicsInputError("Unsupported syntax in the numerical expression.");
    tokens.push(match[1] ? { number: Number(`${match[1]}${match[2] ? `e${match[2]}` : ""}`) } : { name: match[3] || match[4] });
    cursor = regex.lastIndex;
  }
  if (tokens.length > 16e3) throw new MechanicsInputError("The numerical expression is too complex.");
  const instructions = [];
  let position = 0, depth = 0;
  const peek = () => tokens[position]?.name;
  const requireClose = () => {
    if (peek() !== ")") throw new MechanicsInputError("Expected a closing parenthesis.");
    position += 1;
  };
  function primary() {
    const token = tokens[position++];
    if (!token) throw new MechanicsInputError("The numerical expression is incomplete.");
    if ("number" in token) instructions.push({ number: token.number });
    else if (token.name === "(") {
      addition();
      requireClose();
    } else if (Object.hasOwn(NUMERIC_FUNCTIONS, token.name)) {
      if (peek() !== "(") throw new MechanicsInputError("A mathematical function needs parentheses.");
      position += 1;
      addition();
      requireClose();
      instructions.push({ fn: NUMERIC_FUNCTIONS[token.name] });
    } else if (/^[A-Za-z][A-Za-z0-9_]*$/.test(token.name)) instructions.push({ symbol: token.name });
    else throw new MechanicsInputError("Unsupported syntax in the numerical expression.");
  }
  function power() {
    primary();
    if (peek() === "^") {
      position += 1;
      unary();
      instructions.push({ operator: "^" });
    }
  }
  function unary() {
    if (++depth > 100) throw new MechanicsInputError("The numerical expression is nested too deeply.");
    if (peek() === "-" || peek() === "+") {
      const sign = tokens[position++].name;
      unary();
      if (sign === "-") instructions.push({ fn: (x) => -x });
    } else power();
    depth -= 1;
  }
  function multiplication() {
    unary();
    while (peek() === "*" || peek() === "/") {
      const operator = tokens[position++].name;
      unary();
      instructions.push({ operator });
    }
  }
  function addition() {
    multiplication();
    while (peek() === "+" || peek() === "-") {
      const operator = tokens[position++].name;
      multiplication();
      instructions.push({ operator });
    }
  }
  addition();
  if (position !== tokens.length) throw new MechanicsInputError("Unsupported syntax in the numerical expression.");
  return (values = {}) => {
    validateValues(values);
    const stack = [];
    for (const instruction of instructions) {
      if ("number" in instruction) stack.push(instruction.number);
      else if (instruction.symbol) {
        const name = instruction.symbol;
        if (Object.hasOwn(values, name)) stack.push(values[name]);
        else if (name === "pi") stack.push(Math.PI);
        else if (name === "e") stack.push(Math.E);
        else throw new MechanicsInputError(`Missing numerical value or unsupported symbol: ${name}.`);
      } else if (instruction.fn) stack[stack.length - 1] = instruction.fn(stack[stack.length - 1]);
      else {
        const right = stack.pop(), left = stack.pop();
        switch (instruction.operator) {
          case "+":
            stack.push(left + right);
            break;
          case "-":
            stack.push(left - right);
            break;
          case "*":
            stack.push(left * right);
            break;
          case "/":
            stack.push(left / right);
            break;
          case "^":
            stack.push(left ** right);
            break;
        }
      }
    }
    const result = stack[0];
    if (!Number.isFinite(result)) throw new MechanicsInputError("The expression is not finite and real at these values.");
    return result;
  };
}
function evaluateExpression(value, values = {}) {
  validateValues(values);
  return compileExpression(value)(values);
}
function integrateMotion(options) {
  if (!options || typeof options !== "object" || Array.isArray(options)) throw new MechanicsInputError("Motion needs acceleration expressions and initial conditions.");
  const { accelerations, constants = {}, q0, v0, duration, dt = 1 / 480, sampleRate = 60, bounds } = options;
  const dimension = accelerations?.length;
  if (!Array.isArray(accelerations) || ![1, 2].includes(dimension) || Array.from(accelerations).some((value) => typeof value !== "string")) throw new MechanicsInputError("Motion needs one or two acceleration expressions.");
  for (const values of [q0, v0]) if (!Array.isArray(values) || values.length !== dimension || values.some((value) => !Number.isFinite(value))) throw new MechanicsInputError("Initial coordinates and velocities must be finite arrays matching the accelerations.");
  if (!Number.isFinite(duration) || duration < 0 || duration > 20) throw new MechanicsInputError("Motion duration must be between 0 and 20 seconds.");
  if (!Number.isFinite(dt) || dt < 1 / 2e4 || dt > 1 / 60) throw new MechanicsInputError("The integration step must be between 1/20000 and 1/60 second.");
  if (!Number.isFinite(sampleRate) || sampleRate < 1 || sampleRate > 240) throw new MechanicsInputError("The sample rate must be between 1 and 240 frames per second.");
  validateValues(constants);
  if (Object.keys(constants).some((name) => /^(?:[qvap][12]|t)$/.test(name))) throw new MechanicsInputError("Motion constants cannot replace coordinates, velocities, momenta, accelerations or time.");
  if (bounds !== void 0 && (!Array.isArray(bounds) || bounds.length !== dimension || Array.from(bounds).some((bound) => !bound || !Number.isFinite(bound.min) || !Number.isFinite(bound.max) || bound.min >= bound.max))) throw new MechanicsInputError("Coordinate bounds must be finite increasing min/max pairs.");
  const outside = (state2) => bounds?.some((bound, i) => state2[i] < bound.min || state2[i] > bound.max) ?? false;
  if (outside(q0)) throw new MechanicsInputError("Initial coordinates lie outside their bounds.");
  const functions = accelerations.map(compileExpression);
  const environment = { ...constants };
  function rate(time2, state2) {
    environment.t = time2;
    for (let i = 0; i < dimension; i++) {
      environment[`q${i + 1}`] = state2[i];
      environment[`v${i + 1}`] = state2[dimension + i];
    }
    return [...state2.slice(dimension), ...functions.map((fn) => fn(environment))];
  }
  function step(time2, state2, h) {
    const offset = (rates, multiplier) => state2.map((value, i) => value + multiplier * rates[i]);
    const k1 = rate(time2, state2), k2 = rate(time2 + h / 2, offset(k1, h / 2));
    const k3 = rate(time2 + h / 2, offset(k2, h / 2)), k4 = rate(time2 + h, offset(k3, h));
    const result = state2.map((value, i) => value + h * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]) / 6);
    if (result.some((value) => !Number.isFinite(value))) throw new MechanicsInputError("The numerical trajectory is not finite.");
    return result;
  }
  const frame = (time2, state2) => ({ time: time2, q: state2.slice(0, dimension), v: state2.slice(dimension) });
  let state = [...q0, ...v0], time = 0;
  const initialRate = rate(0, state);
  const frames = [frame(0, state)];
  if (bounds?.some((bound, i) => q0[i] === bound.min && (v0[i] < 0 || v0[i] === 0 && initialRate[dimension + i] < 0) || q0[i] === bound.max && (v0[i] > 0 || v0[i] === 0 && initialRate[dimension + i] > 0))) return { frames, duration: 0, stoppedAtBound: true };
  for (let index = 1; time < duration; index++) {
    const target = Math.min(index / sampleRate, duration);
    while (time < target) {
      const h = Math.min(dt, target - time), next = step(time, state, h);
      let crossingTime = outside(next) ? h : void 0;
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
      if (crossingTime !== void 0) {
        let low = 0, high = crossingTime, end = state;
        for (let iteration = 0; iteration < 40; iteration++) {
          const middle = (low + high) / 2, candidate = step(time, state, middle);
          if (outside(candidate)) high = middle;
          else {
            low = middle;
            end = candidate;
          }
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
export {
  FUNCTIONS,
  MechanicsInputError,
  NUMERIC_FUNCTIONS,
  compileExpression,
  evaluateExpression,
  integrateMotion
};
