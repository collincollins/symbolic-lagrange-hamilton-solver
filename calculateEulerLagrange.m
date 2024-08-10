% calculateEulerLagrange.m

% This function calculates the Euler-Lagrange equations for a given Lagrangian and the specified generalized coordinates.
%
% Inputs:
%   lagrangian_time_dependent        - The time-dependent Lagrangian of the system.
%   q1, q2                           - Generalized coordinates.
%   q1dot, q2dot                     - First time derivatives of the generalized coordinates.
%   q1ddot, q2ddot                   - Second time derivatives of the generalized coordinates.
%   t                                - Symbolic representation of time.
%
% Outputs:
%   euler_lagrange_eq_1, euler_lagrange_eq_2 - The Euler-Lagrange equations for each generalized coordinate.

function [euler_lagrange_eq_1, euler_lagrange_eq_2, p1, p2] = calculateEulerLagrange(lagrangian, q1ddot, q2ddot)

    % symbols for time-dependent generalized coordinates
    syms q1(t) q1dot(t) q2(t) q2dot(t) t;

    % Euler-Lagrange equation 1

    % calculate the partial derivative of the Lagrangian with respect to q1.
    partial_lagrangian_partial_q1 = diff(lagrangian, q1(t));
    % calculate the partial derivative of the Lagrangian with respect to the derivative of q1 (q1dot).
    partial_lagrangian_partial_q1dot = diff(lagrangian, q1dot(t)); 

    p1=partial_lagrangian_partial_q1dot;

    % compute the time derivative of the above partial derivative.
    time_derivative_of_partial_lagrangian_partial_q1dot = diff(partial_lagrangian_partial_q1dot, t);  
    % substitute q1ddot in place of the time derivative of q1dot.
    compact_time_derivative_1 = subs(time_derivative_of_partial_lagrangian_partial_q1dot, [diff(q1dot(t), t), diff(q2dot(t), t)], [q1ddot, q2ddot]);   
    % substitute q2ddot in place of the time derivative of q2dot.
    compact_time_derivative_1_more = subs(compact_time_derivative_1, [diff(q1(t), t), diff(q2(t), t)], [q1dot, q2dot]);
    % simplify and set up the first Euler-Lagrange equation.
    euler_lagrange_eq_1 = simplify(partial_lagrangian_partial_q1 - compact_time_derivative_1_more == 0);
   

    % Euler-Lagrange equation 2

    % calculate the partial derivative of the Lagrangian with respect to q2.
    partial_lagrangian_partial_q2 = diff(lagrangian, q2(t));
    % calculate the partial derivative of the Lagrangian with respect to q2dot.
    partial_lagrangian_partial_q2dot = diff(lagrangian, q2dot(t));  
    
    p2=partial_lagrangian_partial_q2dot;

    % compute the time derivative of the partial derivative with respect to q2dot.
    time_derivative_of_partial_lagrangian_partial_q2dot = diff(partial_lagrangian_partial_q2dot, t);   
    % substitute q2ddot in place of the time derivative of q2dot.
    compact_time_derivative_2 = subs(time_derivative_of_partial_lagrangian_partial_q2dot, [diff(q1dot(t), t), diff(q2dot(t), t)], [q1ddot, q2ddot]);   
    % substitute q1ddot in place of the time derivative of q1dot.
    compact_time_derivative_2_more = subs(compact_time_derivative_2, [diff(q1(t), t), diff(q2(t), t)], [q1dot, q2dot]);
    % simplify and set up the second Euler-Lagrange equation.
    euler_lagrange_eq_2 = simplify(partial_lagrangian_partial_q2 - compact_time_derivative_2_more == 0);

end