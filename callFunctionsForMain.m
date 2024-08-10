% callFunctionsForMain.m

% This function handles the calculation of the Lagrangian, Euler-Lagrange equations, and Hamiltonian for a given system.
%
% Inputs:
%   independent_variable                     - The independent variable (e.g., time) as a string.
%   generalized_coordinates_and_derivatives  - Cell array of generalized coordinates and their derivatives as strings.
%   user_entered_constants                   - Cell array of constants entered by the user.
%   kinetic_energy_string_time_dependent     - The time-dependent kinetic energy expression as a string.
%   potential_energy_string_time_dependent   - The time-dependent potential energy expression as a string.
%
% Outputs:
%   lagrangian                               - The time-dependent Lagrangian of the system.
%   q1ddot_solution, q2ddot_solution         - Solutions for the second derivatives of the generalized coordinates.
%   hamiltonian                              - The Hamiltonian of the system.
%   p1dot, p2dot                             - Time derivatives of the canonical momenta.
%   q1dot, q2dot                             - Time derivatives of the generalized coordinates.


function [lagrangian, ...
          q1ddot_solution, ...
          q2ddot_solution, ...
          hamiltonian, ...
          p1dot, ...
          p2dot, ...
          q1dot, ...
          q2dot] = ...
         callFunctionsForMain(independent_variable, ...
                              generalized_coordinates_and_derivatives, ...
                              user_entered_constants, ...
                              kinetic_energy_string_time_dependent, ...
                              potential_energy_string_time_dependent)

% declare the independent variable as symbolic
sym(independent_variable);

% declare the generalized coordinates and their derivatives as symbolic variables
generalized_coordinates_and_derivatives = cellfun(@sym, generalized_coordinates_and_derivatives, 'UniformOutput', false);

% extract the symbolic variables for easier reference
q1 = generalized_coordinates_and_derivatives{1}; %#ok<*NASGU>
q1dot = generalized_coordinates_and_derivatives{2};
q1ddot = generalized_coordinates_and_derivatives{3};
q2 = generalized_coordinates_and_derivatives{4};
q2dot = generalized_coordinates_and_derivatives{5};
q2ddot = generalized_coordinates_and_derivatives{6};

% create symbolic variables for the user-entered constants as well as an array
[~] = userEnteredConstantsToSymAndArray(user_entered_constants);

% calculate the Lagrangians
[lagrangian, lagrangian_time_independent] = calculateLagrangian(kinetic_energy_string_time_dependent, potential_energy_string_time_dependent);

% calculate the Euler-Lagrange equations
[euler_lagrange_equation_1, euler_lagrange_equation_2, ~, ~] = calculateEulerLagrange(lagrangian, q1ddot, q2ddot);

% solve the Euler-Lagrange equations
[q1ddot_solution, q2ddot_solution] = solveEulerLagrangeEquations(euler_lagrange_equation_1, euler_lagrange_equation_2, q1ddot, q2ddot);

% calculate the Hamiltonian
hamiltonian = calculateHamiltonian(lagrangian_time_independent, q1dot, q2dot);

% calculate Hamilton's equations of motion
[p1dot, p2dot, q1dot, q2dot] = calculateHamiltonsEquationsOfMotion(hamiltonian);

% set the Hamiltonian equal to the total energy and solve the equation for p1 and p2
[~, ~] = solvingHamiltonianForMomenta(hamiltonian);

end