% solvingHamiltonianForMomenta.m

% this function solves for the generalized momenta p1 and p2 in terms of the Hamiltonian and total energy E.
% this is useful in mechanics problems where the relationship between energy and momenta needs to be established.
%
% inputs:
%   hamiltonian - the Hamiltonian of the system.
%
% outputs:
%   p1_in_terms_of_hamiltonian - p1 expressed in terms of the Hamiltonian and total energy.
%   p2_in_terms_of_hamiltonian - p2 expressed in terms of the Hamiltonian and total energy.

function [p1_in_terms_of_hamiltonian, p2_in_terms_of_hamiltonian] = solvingHamiltonianForMomenta(hamiltonian)
    % define symbols for generalized momenta p1 and p2, and total energy E
    syms p1 p2 E;

    % create an equation representing the total energy in terms of the Hamiltonian
    total_energy_equation = hamiltonian == E;

    % solve the total energy equation for p1, simplifying the result
    p1_in_terms_of_hamiltonian = simplify(solve(total_energy_equation, p1));

    % solve the total energy equation for p2, simplifying the result
    p2_in_terms_of_hamiltonian = simplify(solve(total_energy_equation, p2));

end
