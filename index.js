/* eslint-env commonjs, node, es6 */

const Path = require("path");
const LoaderUtils = require("loader-utils");

/** 
 * @typedef {Object} WebpackConfig
 * @property {string} context
 *  The root path of the project, essentially.
 *  Relative paths in the webpack config object are considered to be relative to this. 
 */

/** 
 * @typedef {Object} WebpackLoaderContext
 * @property {WebpackConfig} options - The webpack configuration object.
 * @property {function} cacheable - Marks the loader as cacheable.
 * @property {function} exec - Executes a piece of JavaScript as a module.
 * @property {string} resourcePath - The path of the module being required.
 */ 

/** 
 * @typedef {Object} LoaderConfig
 * @property {boolean} shorten
 *  If true, shorten prefixes generated instead of using a full relative path. 
 *  This should be avoided because it is non-deterministic depending on the 
 *  order in which the files are compiled.
 */ 

/**
 * @type {number} 
 * When shortening prefixes, the next prefix number that will be used. 
 */ 
let sequence = 1;

/**
 * @type {Object.<string, number>} 
 * When shortening prefixes, a list of prefixes that have already been 
 * mapped to a short prefix. 
 */
const prefixMap = {};

/**
 * Takes a single i18n file and returns a JavaScript module that generates 
 * globally-unique keys for nested strings, and exports those keys in the 
 * same structure as the input file, also exporting a $messages export with
 * the actual values of these messages in particular languages.
 * 
 * The i18n file is assumed to be a JavaScript module, to load JSON this 
 * loader should be chained with `json-loader`.
 * 
 * @this {LoaderConfig}
 * @param {string} source - The JSON source of the messages file being required.
 */
module.exports = function(source) {
    this.cacheable && this.cacheable();

    const config = getConfig.call(this);
    return compile.call(this, source, config);
};

/**
 * Returns a unique prefix specific to the intl module being loaded. This allows
 * messages to be unique even if different modules export the same key.
 * 
 * @this {WebpackLoaderContext}
 * @param {LoaderConfig} config - Our config.
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
 * Parses the source into a JSON object and verifies its structure.
 * 
 * The source should be a JSON object with nested string fields. 
 * Other types of field are not allowed.
 * 
 * @this {WebpackLoaderContext}
 * @param {string} source - The source string passed in by Webpack.
 * @return {Object} - The parsed JSON.
 */
function parseSource(source) {
    const json = this.exec(source, this.resourcePath);

    if (typeof json !== "object")
        throw new Error("Locale data must be an object");
    
    /**
     * Recursively checks the validity of a parsed i18n file.
     * @param {Object} obj - the current part of the file being verified.
     * @param {string} path
     *  The nested path to the current part of the file, to 
     *  help produce more useful error messages.
     */
    function check(obj, path) {
        for (let key in obj) {
            // TODO Maybe validate that top-level keys are valid 
            // locales, or at least look like them
            
            switch(typeof obj[key]) {
                case "string": break;
                case "object": check(obj[key], path + "." + key); break;
                default:
                    throw new TypeError(path + "." + key + 
                        ": values in a locale file must be strings or objects");
            }
        }
    }
    check(json, "root");
    
    return json;
}

/**
 * Gets the loader config.
 * 
 * @this {WebpackConfig}
 * @returns {LoaderConfig}
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
 * @this {WebpackLoaderContext}
 * @param {string} source - The source file's contents.
 * @param {LoaderConfig} config - The loader config.
 * @returns {string} The compiled JavaScript module.
 */
function compile(source, config) {
    const json = parseSource.call(this, source);
    const prefix = getPrefix.call(this, config);
    
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
