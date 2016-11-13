/* eslint-env commonjs */

/**
 * Takes the result of a call to Webpack's `require.context` and merges together
 * all of the messages. 
 * 
 * Returns a dictionary of languages to message maps.
 * The "default" property of the returned object contains the message IDs structure.
 */
module.exports = function(req) {
    return req
        .keys()
        .map(key => req(key).$messages) // Get all the messages for each module
        .reduce(merge, {});
};

/** Recursively and destructively merge an object into another. */
function merge(dst, src) {
    if (typeof src !== "object")
        return src;

    for (let key in src) 
        dst[key] = merge(dst[key] || {}, src[key]);

    return dst;
}