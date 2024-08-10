% solveEulerLagrangeEquations.m   

% This function solves a pair of Euler-Lagrange equations for a two-degree-of-freedom system.
% The equations are solved for the second derivatives of the generalized coordinates (q1ddot and q2ddot).
%
% Inputs:
%   euler_lagrange_equation_1  - the first Euler-Lagrange equation expressed symbolically.
%   euler_lagrange_equation_2  - the second Euler-Lagrange equation expressed symbolically.
%   q1ddot                     - symbolic variable for the second derivative of the first generalized coordinate.
%   q2ddot                     - symbolic variable for the second derivative of the second generalized coordinate.
%
% Outputs:
%   q1ddot_solution          - the solution of the first Euler-Lagrange equation for q1ddot.
%   q2ddot_solution          - the solution of the second Euler-Lagrange equation for q2ddot.

function [q1ddot_solution, q2ddot_solution] = ...
         solveEulerLagrangeEquations(euler_lagrange_equation_1, euler_lagrange_equation_2, q1ddot, q2ddot)

    % isolate q2ddot in the second equation.
    sol2_for_q2ddot = solve(euler_lagrange_equation_2, q2ddot);

    % substitute the solution for q2ddot into the first Euler-Lagrange equation
    % and then solve for q1ddot.
    q1ddot_solution = simplify(solve(subs(euler_lagrange_equation_1, q2ddot, sol2_for_q2ddot), q1ddot));

    % the final expression for q2ddot is then simplified.
    q2ddot_solution = simplify(subs(sol2_for_q2ddot, q1ddot, q1ddot_solution));

end
