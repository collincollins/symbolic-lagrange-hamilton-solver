# symbolic-two-dof-lagrange-hamilton-solver

## Description

This MATLAB repository provides a framework for symbolically analyzing the dynamics of two-degree-of-freedom systems using both Lagrangian and Hamiltonian mechanics. It allows you to input the system's kinetic and potential energy expressions and obtain the equations of motion in both Lagrangian and Hamiltonian formalisms.

## How to Use

1. Clone or download this repository to your local machine.
2. Open MATLAB and navigate to the repository's directory.
3. Follow the prompts to enter the system's kinetic and potential energy expressions, as well as the generalized coordinates.
4. Run the `MainProgram.m` script.
5. The program will calculate and display:
   - The Lagrangian
   - The generalized accelerations (Lagrange's equations of motion)
   - The Hamiltonian
   - The generalized momenta and velocities (Hamilton's equations of motion)

## Functions

- `calculateEulerLagrange`: Symbolically derives the Euler-Lagrange equations.
- `calculateHamiltonian`: Forms the Hamiltonian.
- `calculateHamiltonsEquationsOfMotion`: Symbolically derives Hamilton's equations of motion.
- `calculateLagrangian`: Symbolically derives the Lagrangian.
- `solveEulerLagrangeEquations`: Symbolically solves the Euler-Lagrange equations.
- `solvingHamiltonianForMomenta`: Symbolically expresses momenta from the Hamiltonian.
- `userEnteredConstantsToSymAndArray`: Converts user inputs to symbolic variables and arrays.
- `callFunctionsForMain` and `displayOutputsForMain`: Manage the overall program flow and display results.

## DISCLAIMER

The terms "time-dependent" and "time-independent" in this codebase refer specifically to the *mathematical representation* of quantities, and not necessarily to the physical nature of the system's dependence on time.

* **Time-dependent:** The mathematical expression explicitly includes the time variable 't'. This allows for differentiation with respect to the independent variable 't'.
* **Time-independent:** The variable 't' is treated symbolically, when no derivatives with respect to time are taken. This is suitable for performing algebraic manipulations.

## Dependencies

This code requires MATLAB's Symbolic Math Toolbox.

## Limitations

- Currently handles only two-degree-of-freedom systems.
- Assumes unconstrained systems.
- May encounter difficulties with highly non-linear or complex systems.
- The calculator has not been tested on all types of two-degree-of-freedom systems, so there may be errors.

## Contributions and Feedback

Contributions, bug reports, and feature requests are welcome! Feel free to open an issue or submit a pull request on the GitHub repository.

## License

MIT License 
