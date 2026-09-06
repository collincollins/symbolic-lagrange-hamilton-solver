"""Optional independent CAS verification: python3 test/verify_sympy.py.

Requires SymPy. This script is not shipped to the browser and does not write files.
"""
import json
from pathlib import Path
import subprocess
import sympy as sp

ROOT = Path(__file__).resolve().parents[1]
SYSTEMS = [
    {"kinetic": "(m1+m2)*v1^2/2", "potential": "(m2-m1)*g*q1", "coordinates": ["q1"], "constants": ["m1", "m2", "g"]},
    {"kinetic": "(M+m)*v1^2/2+m*cos(theta)*v1*v2+m*v2^2/2", "potential": "-m*g*q2*sin(theta)", "coordinates": ["q1", "q2"], "constants": ["M", "m", "g", "theta"]},
    {"kinetic": "m1*v1^2/2+m2*v2^2/2", "potential": "k1*q1^2/2+kc*(q2-q1)^2/2+k2*q2^2/2", "coordinates": ["q1", "q2"], "constants": ["m1", "m2", "k1", "k2", "kc"]},
    {"kinetic": "(m1+m2)*l1^2*v1^2/2+m2*l2^2*v2^2/2+m2*l1*l2*cos(q1-q2)*v1*v2", "potential": "-(m1+m2)*g*l1*cos(q1)-m2*g*l2*cos(q2)", "coordinates": ["q1", "q2"], "constants": ["m1", "m2", "l1", "l2", "g"]},
    {"kinetic": "m*(1+q1^2)*v1^2/2+k*t*q1*v1", "potential": "c*q1^2/2", "coordinates": ["q1"], "constants": ["m", "k", "c"]},
]
program = "import {solveSystem} from './src/solver.mjs'; console.log(JSON.stringify(" + json.dumps(SYSTEMS) + ".map(solveSystem)));"
results = json.loads(subprocess.check_output(["node", "--input-type=module", "-e", program], cwd=ROOT, text=True))
checks = 0
for index, (system, result) in enumerate(zip(SYSTEMS, results), start=1):
    names = system["coordinates"] + ["v1", "v2", "a1", "a2", "p1", "p2", "t"] + system["constants"]
    symbols = {name: sp.Symbol(name, real=True) for name in names}
    parse = lambda value: sp.sympify(value.replace("^", "**"), locals=symbols)
    q = [symbols[name] for name in system["coordinates"]]
    v = [symbols[f"v{i+1}"] for i in range(len(q))]
    a = [symbols[f"a{i+1}"] for i in range(len(q))]
    p = [symbols[f"p{i+1}"] for i in range(len(q))]
    time = symbols["t"]
    L = parse(system["kinetic"]) - parse(system["potential"])
    momentum = sp.Matrix([sp.diff(L, velocity) for velocity in v])
    equations = sp.Matrix([
        sp.diff(momentum[i], time)
        + sum(sp.diff(momentum[i], coordinate) * velocity for coordinate, velocity in zip(q, v))
        + sum(sp.diff(momentum[i], velocity) * acceleration for velocity, acceleration in zip(v, a))
        - sp.diff(L, q[i])
        for i in range(len(q))
    ])
    velocity_solutions = sp.solve([momentum[i] - p[i] for i in range(len(q))], v, dict=True)[0]
    H = (sum(momentum[i] * v[i] for i in range(len(q))) - L).subs(velocity_solutions, simultaneous=True)
    acceleration_values = {a[i]: parse(result["accelerations"][i]["expression"]) for i in range(len(q))}
    comparisons = [L - parse(result["lagrangian"]["expression"]), H - parse(result["hamiltonian"]["expression"])]
    for i in range(len(q)):
        comparisons.extend([
            equations[i] - parse(result["eulerLagrange"][i]["expression"]),
            equations[i].subs(acceleration_values, simultaneous=True),
            momentum[i] - parse(result["momenta"][i]["expression"]),
            velocity_solutions[v[i]] - parse(result["velocitySolutions"][i]["expression"]),
            sp.diff(H, p[i]) - parse(result["hamiltonEquations"]["coordinates"][i]["expression"]),
            -sp.diff(H, q[i]) - parse(result["hamiltonEquations"]["momenta"][i]["expression"]),
        ])
    for difference in comparisons:
        assert sp.trigsimp(sp.factor(difference)) == 0, f"System {index}: {difference}"
        checks += 1
print(f"SymPy independently verified {checks} exact symbolic identities across {len(SYSTEMS)} systems.")
