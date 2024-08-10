% calculateHamiltonsEquationsOfMotion.m

% This function calculates Hamilton's equations of motion for a system given its Hamiltonian.
% Hamilton's equations describe the evolution over time of a physical system in terms of its coordinates and momenta.
%
% Inputs:
%   hamiltonian - The Hamiltonian of the system, a function describing the total energy.
%
% Outputs:
%   p1dot, p2dot - The time derivatives of the generalized momenta.
%   q1dot, q2dot - The time derivatives of the generalized coordinates.

function [p1dot, p2dot, q1dot, q2dot] = calculateHamiltonsEquationsOfMotion(hamiltonian)

    % define symbolic variables for generalized coordinates and momenta
    syms p1 p2 q1 q2;

    % calculate the time derivative of the first generalized momentum
    p1dot = -diff(hamiltonian, q1);

    % calculate the time derivative of the second generalized momentum
    p2dot = -diff(hamiltonian, q2);

    % calculate the time derivative of the first generalized coordinate
    q1dot = diff(hamiltonian, p1);

    % calculate the time derivative of the second generalized coordinate
    q2dot = diff(hamiltonian, p2);

    % simplify the equations of motion for easier interpretation and use
    p1dot = simplify(p1dot);
    p2dot = simplify(p2dot);
    q1dot = simplify(q1dot);
    q2dot = simplify(q2dot);

end
