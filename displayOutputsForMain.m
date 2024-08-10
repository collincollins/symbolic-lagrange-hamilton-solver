% displayOutputsForMain.m

% This function displays the results of the Lagrangian, Euler-Lagrange equations, and Hamiltonian calculations.
%
% Inputs:
%   lagrangian                       - The time-dependent Lagrangian of the system.
%   q1ddot_solution, q2ddot_solution - Solutions for the second derivatives of the generalized coordinates.
%   hamiltonian                      - The Hamiltonian of the system.
%   p1dot, p2dot                     - Time derivatives of the canonical momenta.
%   q1dot, q2dot                     - Time derivatives of the generalized coordinates.
%
% Outputs:
%   None. This function prints the results to the command window.

function displayOutputsForMain(lagrangian, ...
                               q1ddot_solution, ...
                               q2ddot_solution, ...
                               hamiltonian, ...
                               p1dot, ...
                               p2dot, ...
                               q1dot, ...
                               q2dot)

    % display the Lagrangian
    fprintf('\n');
    fprintf(repmat('-', 1, 50));
    fprintf('\n');
    fprintf(repmat('-', 1, 50));
    fprintf('\nThe Lagrangian of the system is:\n');
    fprintf('\nL = %s\n', char(lagrangian));
    fprintf('\nThe Lagrange equations of motion of the system are:\n');
    fprintf('\nq1ddot = %s\n', char(q1ddot_solution));
    fprintf('\nq2ddot = %s\n', char(q2ddot_solution));
    fprintf(repmat('-', 1, 50));
    fprintf('\n');
    fprintf(repmat('-', 1, 50));
    
    % display the Hamiltonian
    fprintf('\nThe Hamiltonian of the system is:\n');
    fprintf('\nH = %s\n', char(hamiltonian));
    fprintf('\nThe Hamilton equations of motion of the system are:\n');
    fprintf('\np1dot = %s\n', char(p1dot));
    fprintf('\np2dot = %s\n', char(p2dot));
    fprintf('\nq1dot = %s\n', char(q1dot));
    fprintf('\nq2dot = %s\n', char(q2dot));
    fprintf(repmat('-', 1, 50));
    fprintf('\n');
    fprintf(repmat('-', 1, 50));
    fprintf('\n');
    
    end