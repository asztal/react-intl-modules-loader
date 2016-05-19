/**
 * TODO This needs some serious documenting! 
 */
module.exports = function(context) {
    return context.keys().map(context.resolve.bind(context)).reduce({}, Object.assign);
};