% userEnteredConstantsToSymAndArray

% this function converts a cell array of user-entered constants into
% symbolic variables and stores them in an array. This is useful for
% symbolic computations where constants need to be represented as symbols.

% Inputs:
%   user_entered_constants - A cell array containing the constants
%                            entered by the user. Each element of the
%                            array is expected to be a string representing
%                            a constant.

% Outputs:
%   constants - An array of symbolic variables corresponding to the
%               user-entered constants.

% Example:
%   user_constants = {'g', 'm', 'k'};
%   symbols = userEnteredConstantsToSymAndArray(user_constants);
%   % symbols will be [g, m, k] as symbolic variables

function [constants] = userEnteredConstantsToSymAndArray(user_entered_constants)

% create an array of symbolic variables based on the length of the input array
% 'sym' function is used to create symbolic variables
constants = sym('constants', [1 length(user_entered_constants)]);

% iterate over each user-entered constant
for i = 1:length(user_entered_constants)
    % convert each user-entered string constant into a symbolic variable
    % and store it in the corresponding position in the 'constants' array
    constants(i) = sym(user_entered_constants{i});
end

end
