/* eslint-env commonjs, node, es6 */

const Path = require("path");
const LoaderUtils = require("loader-utils");
const FS = require("fs");

let sequence = 1;
const prefixMap = {};

module.exports = function(source) {
    this.cacheable && this.cacheable();
    
    const config = LoaderUtils.getLoaderConfig(this, "reactIntlModules");
    const prefix = getShortPrefix(this.options.context, this.resourcePath);
    
    //console.log("req", this.resourcePath, config);
    
    if (config.lang)
        throw new Error("pitch didn't work")
    
    // If the lang parameter is passed, return the messages as a flattened
    // object suitable for passing to <IntlProvider messages={data}>.
    const data = config.lang
        ? getMessages.call(this, source, prefix, config.lang)
        : getIDs.call(this, source, prefix);
        
    const js = "/*locale*/ module.exports = " + JSON.stringify(data) + ";";
    return js;
};

module.exports.pitch = function() {
    const config = LoaderUtils.getLoaderConfig(this, "reactIntlModules");
    if (!config.lang) 
        return;
    
    const callback = this.async();
    const prefix = getShortPrefix(this.options.context, this.resourcePath);
    
    FS.readFile(this.resourcePath, function(err, buffer) {
        if (err)
            return callback(err);
        
        try {
            const source = buffer.toString("utf8");
            const data = getMessages.call(this, source, prefix, config.lang);
            const js = "/*locale*/ module.exports = " + JSON.stringify(data) + ";";
            callback(null, js);
        } catch(err) {
            callback(err);
        }
    }.bind(this));
}

/**
 * Returns a unique prefix specific to the intl module being loaded. This allows
 * messages to be unique.
 * @param root {string} - The root of the webpack compilation, i.e. 
 *                        options.context from the webpack config.
 * @param file {string} - The absolute file path of the intl module.
 */
function getShortPrefix(root, file) {
    const prefix = 
        Path.relative(root, file)
            .replace(/\\/g, "/"); // Crude attempt at normalisation
            
    return prefixMap[prefix] = prefixMap[prefix] || sequence++;
}

/**
 * Parses the source into JSON and verifies its structure.
 * 
 * The source should be a JSON object with a @locale property and some nested
 * string fields. Other types of field are not allowed.
 * 
 * @param source {string} - The source string passed in by Webpack.
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
 * Process all locale files of a particular language within the current directory.
 * @param lang {string} - The locale to return. Any .intl.json files will be
 *                        ignored if their `@locale` property does not match this. 
 */
function getMessages(source, prefix, lang) {
    const json = parseSource(source);
    if (json["@locale"] !== lang)
        return {};
        
    return convert(json, prefix)["@messages"];
}

/** 
 * Converts a single file to JavaScript. 
 * 
 * Replaces message names with unique message ids in the same nested structure. */
function getIDs(source, prefix) {
    const json = parseSource(source);
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
 * @param obj {object} - The raw JSON data for the locale.
 * @param prefix {string} - The unique prefix for this all keys in this module. 
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