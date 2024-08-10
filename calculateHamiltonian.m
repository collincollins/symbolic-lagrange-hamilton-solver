% calculateHamiltonian.m

% This function calculates the Hamiltonian of a system given its time-independent Lagrangian and generalized velocities.
% The Hamiltonian is a function used in classical mechanics to describe the total energy of a system.
%
% Inputs:
%   lagrangian_time_independent - The time-independent Lagrangian of the system.
%   q1dot, q2dot                - First time derivatives of the generalized coordinates (generalized velocities).
%
% Output:
%   hamiltonian                 - The Hamiltonian of the system.

function hamiltonian = calculateHamiltonian(lagrangian_time_independent, q1dot, q2dot)

    % define symbols for generalized momenta
    syms p1 p2 

    % solve for q1dot in terms of the first generalized momentum p1
    q1dot_in_terms_of_p1 = solve(diff(lagrangian_time_independent, q1dot) == p1, q1dot);
    
    % solve for q2dot in terms of the second generalized momentum p2
    q2dot_in_terms_of_p2 = solve(diff(lagrangian_time_independent, q2dot) == p2, q2dot);

    % check if the solution for q1dot or q2dot in terms of their generalized momenta is empty
    % and set them to 0 if empty to avoid issues in further calculations
    if isempty(symvar(q1dot_in_terms_of_p1))
       q1dot_in_terms_of_p1 = 0;
    elseif isempty(symvar(q2dot_in_terms_of_p2))
       q2dot_in_terms_of_p2 = 0;
    end

    % calculate the Hamiltonian using the analytical form: H = sum(p_i * q_i) - L
    % where L is the Lagrangian expressed in terms of generalized momenta
    hamiltonian = p1 * q1dot_in_terms_of_p1 + p2 * q2dot_in_terms_of_p2 - subs(lagrangian_time_independent, {q1dot, q2dot}, {q1dot_in_terms_of_p1, q2dot_in_terms_of_p2});

    % simplify the Hamiltonian
    hamiltonian = simplify(hamiltonian);

end
