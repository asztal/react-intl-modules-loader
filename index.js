/* eslint-env commonjs, node, es6 */

const Path = require("path");
const LoaderUtils = require("loader-utils");

// When shortening prefixes
let sequence = 1;
const prefixMap = {};

/**
 * The default behaviour of this loader is to take a single file and return the
 * IDs of the messages contained within it. The loader ensures that the returned
 * IDs are unique by prefixing them with the file's path relative to the root. 
 * 
 * Adds a hash of the input to the generated JavaScript so that webpack will know 
 * that the file has actually been edited. (This is necessary because although the
 * primary loader output may not change as a result of changing the values, it would
 * change when using the ?lang option with require.context, but Webpack seems to 
 * assume that it won't because the primary output didn't change.)
 * 
 * @param source {string} - The JSON source of the messages file being required.
 */
module.exports = function(source) {
    this.cacheable && this.cacheable();

    const config = getConfig.call(this);
    return compile.call(this, source, config);
};


/**
 * Returns a unique prefix specific to the intl module being loaded. This allows
 * messages to be unique.
 * 
 * If `config.shorten` is truthy, the prefix will be shortened but still kept
 * unique. 
 * 
 * This should be called with the Webpack loader context as the `this` object. 
 * 
 * @param {Object} config - The Webpack loader config.
 * @param {boolean} config.shorten - If truthy, the prefix will be shortened but 
 * still kept unique. This is disabled by default because this then makes the 
 * output dependent on the compilation order, which is an undesirable property 
 * if you rely on build hashes.
 */
function getPrefix(config) {
    const prefix = 
        Path.relative(this.options.context, this.resourcePath)
            .replace(/\\/g, "/"); // Crude attempt at normalisation
            
    if (!config.shorten)
        return prefix;
            
    return prefixMap[prefix] = prefixMap[prefix] || sequence++;
}

/**
 * Parses the source into JSON and verifies its structure.
 * 
 * The source should be a JSON object nested
 * string fields. Other types of field are not allowed.
 * 
 * @param {string} source - The source string passed in by Webpack.
 */
function parseSource(source) {
    const json = this.exec(source, this.resourcePath);

    if (typeof json !== "object")
        throw new Error("Locale data must be an object");
    
    function check(obj, path) {
        for (let key in obj) {
            // TODO Maybe validate that top-level keys are valid 
            // locales, or at least look like them
            
            switch(typeof obj[key]) {
                case "string": break;
                case "object": check(obj[key], path + "." + key); break;
                default:
                    throw new Error(path + "." + key + 
                        ": values in a Locale JSON object must be strings or objects");
            }
        }
    }
    check(json, "root");
    
    return json;
}

/**
 * Gets the loader config.
 * 
 * This should be called with the Webpack loader context as the `this` object. 
 */
function getConfig() {
    return LoaderUtils.getLoaderConfig(this, "reactIntlModules");
}

/** 
 * Converts a single file to an ECMAScript module. 
 * 
 * Replaces message names with unique message ids in the same nested structure,
 * which is exported as the default export.
 * 
 * Each language is exported as an object mapping message IDs to actual strings
 * in that language. 
 * 
 * @param {string} source - The source file's contents.
 * */
function compile(source, config) {
    const json = parseSource.call(this, source);
    const prefix = getPrefix.call(this, getConfig.call(this));
    
    let ids = {};
    let langs = {};

    function convert(obj, path) {
        let ids = {};
        let values = {};
        
        for (let key in obj) {
            const value = obj[key];
            if (typeof value === "object") {
                const nested = convert(obj[key], path + key + ".");
                ids[key] = nested.ids;
                Object.assign(values, nested.values);
            } else {
                ids[key] = path + key;
                values[path + key] = value;
            }
        }
        
        return { ids, values };
    }

    for (let lang in json) {
        let converted = convert(json[lang], prefix + ":");
        langs[lang] = converted.values;
        Object.assign(ids, converted.ids); 
    }
        
    return [
        ...Object.keys(ids).map(key =>
            "export const " + key + "=" + JSON.stringify(ids[key])),
        "export const $messages = " + JSON.stringify(langs)
    ].join(";");
}
