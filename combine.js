/* eslint-env commonjs */

/**
 * Takes the result of a call to Webpack's `require.context` and merges together
 * all of the messages. 
 */
module.exports = function(req) {
    return req
        .keys()
        .map(req) // Get all the messages for each module
        .reduce(function(result, messages) {
            return Object.assign(result, messages);
        }, {});
};