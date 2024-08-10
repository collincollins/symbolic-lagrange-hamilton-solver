% calculateLagrangian.m

% This function calculates both time-dependent and time-independent Lagrangians for a given system.
% A Lagrangian is calculated by subtracting the potential energy from the kinetic energy of the system.
%
% Inputs:
%   kinetic_energy_string_time_dependent        - A string representing the time-dependent kinetic energy of the system.
%   potential_energy_string_time_dependent      - A string representing the time-dependent potential energy of the system.
%
% Outputs:
%   lagrangian                                  - The time-dependent Lagrangian of the system.
%   lagrangian_time_independent                 - The time-independent Lagrangian of the system.

function [lagrangian, lagrangian_time_independent] = ...
         calculateLagrangian(kinetic_energy_string_time_dependent, potential_energy_string_time_dependent)

    % convert the time-dependent kinetic energy string to a symbolic expression
    kinetic_energy_time_dependent = str2sym(kinetic_energy_string_time_dependent);
    % convert the time-dependent potential energy string to a symbolic expression
    potential_energy_time_dependent = str2sym(potential_energy_string_time_dependent);

    % calculate the time-dependent Lagrangian by subtracting the potential energy from the kinetic energy
    lagrangian_time_dependent = kinetic_energy_time_dependent - potential_energy_time_dependent;

    % remove the time-dependence (symbol '(t)') from the kinetic energy string to make it time-independent
    kinetic_energy_time_independent = str2sym(strrep(kinetic_energy_string_time_dependent, '(t)', ''));
    % remove the time-dependence (symbol '(t)') from the potential energy string to make it time-independent
    potential_energy_time_independent = str2sym(strrep(potential_energy_string_time_dependent, '(t)', ''));

    % calculate the time-independent Lagrangian by subtracting the potential energy from the kinetic energy
    lagrangian_time_independent = kinetic_energy_time_independent - potential_energy_time_independent;

    % simplify the lagrangians
    lagrangian = simplify(lagrangian_time_dependent);
    lagrangian_time_independent = simplify(lagrangian_time_independent);

end
