/* eslint-env commonjs, node, es6 */

const Path = require("path");
const LoaderUtils = require("loader-utils");
const FS = require("fs");

// When shortening prefixes
let sequence = 1;
const prefixMap = {};

/**
 * The default behaviour of this loader is to take a single file and return the
 * IDs of the messages contained within it. The loader ensures that the returned
 * IDs are unique by prefixing them with the file's path relative to the root. 
 * 
 * @param source {string} - The JSON source of the messages file being required.
 */
module.exports = function(source) {
    this.cacheable && this.cacheable();
    
    return toJS(getIDs.call(this, source));
};

/**
 * The other behaviour of this loader is to take an entire directory and 
 * collate together all the messages for a particular language. E.g. find
 * all .intl.json files with an English language and gather all the messages:
 * 
 * combine(require.context("react-intl-modules-loader?lang=en!./", 
 *                          true, /en\.intl\.json$/))
 * 
 * (Where `combine` is a function that takes a Webpack context module, requires
 * all the contents, and merges them into a single object)
 * 
 * This only happens when loader's the ?lang query parameter is set.
 * 
 * This is done using module.exports.pitch so that we can read the raw JSON 
 * rather than the JS output already processed by this loader, which is what
 * we would normally get.
 */
module.exports.pitch = function() {
    this.cacheable && this.cacheable();
    
    const config = getConfig.call(this);
    if (!config.lang) 
        return;
    
    const callback = this.async();
    FS.readFile(this.resourcePath, function(err, buffer) {
        if (err)
            return callback(err);
        
        try {
            const source = buffer.toString("utf8");
            callback(null, toJS(getMessages.call(this, source, config)));
        } catch(err) {
            callback(err);
        }
    }.bind(this));
};

/**
 * Converts a JSON object to a JavaScript CommonJS module which exports it.
 * 
 * @param {object} json - The JSON object to convert. It doesn't technically
 *                        have to be an object, but it will be in our case. 
 */
function toJS(json) {
    return "/*locale*/ module.exports = " + JSON.stringify(json) + ";";
}

/**
 * Returns a unique prefix specific to the intl module being loaded. This allows
 * messages to be unique.
 * 
 * If `config.shorten` is truthy, the prefix will be shortened but still kept
 * unique. 
 * 
 * This should be called with the Webpack loader context as the `this` object. 
 * 
 * @param {object} config - The Webpack loader config.
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
 * The source should be a JSON object with a @locale property and some nested
 * string fields. Other types of field are not allowed.
 * 
 * @param {string} source - The source string passed in by Webpack.
 */
function parseSource(source) {
    const json = JSON.parse(source);
    if (typeof json !== "object")
        throw new Error("Locale JSON must be an object");
    
    function check(obj, path) {
        for (let key in obj) {
            switch(typeof obj[key]) {
                case "string": break;
                case "object": check(obj[key], path + "." + key); break;
                default:
                    throw new Error(path + "." + key + 
                        ": values in a Locale JSON object must be strings or objects");
            }
        }
    }
    check(json, "data");
    
    if (typeof json["@locale"] !== "string")
        throw new Error("Locale JSON must include an @locale property");
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
 * Process all locale files of a particular language within the current directory.
 * The language selected is specified by {@link config.lang}.
 * 
 * @param {string} source - The raw JSON contents of the module being loaded. 
 * @param {string} config - The Webpack loader config.
 * @param {string} config.lang - The locale to select.
 * 
 * This should be called with the Webpack loader context as the `this` object. 
 */
function getMessages(source, config) {
    const json = parseSource(source);
    const prefix = getPrefix.call(this, config);
    if (json["@locale"] !== config.lang)
        return {};
        
    return convert(json, prefix)["@messages"];
}

/** 
 * Converts a single file to JavaScript. 
 * 
 * Replaces message names with unique message ids in the same nested structure. 
 * 
 * @param {string} source - The source file's contents.
 * */
function getIDs(source) {
    const json = parseSource(source);
    const prefix = getPrefix.call(this, getConfig.call(this));
    
    let converted = convert(json, prefix);
    delete converted["@messages"]; // Save space in the resulting output.
    
    return converted;
}

/** 
 * Returns the input with all locale strings replaced with their identifiers.
 *  
 * TODO: Example of how it transforms the input
 * 
 * The returned value also has an "@messages" property which includes the 
 * actual messages. 
 * 
 * @param {object} obj - The JSON object with the messages in.
 * @param {string} prefix - The unique prefix for keys in this module. 
 * */
function convert(obj, prefix) {
    function go(result, obj, path) {
        for (let key in obj) {
            if (key[0] == "@")
                continue;

            const value = obj[key];
            if (typeof value === "object") {
                go(result, obj[key], path + key + ".");
            } else {
                result[path + key] = value;
                obj[key] = path + key;
            }
        }
        return obj;
    }
    
    let flat = {};
    obj = go(flat, obj, prefix + ":");
    obj["@messages"] = flat;
    return obj;
}