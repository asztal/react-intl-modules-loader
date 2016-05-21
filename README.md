`react-intl-modules-loader` is a [webpack](https://github.com/webpack/webpack) 
loader which allows you to structure your 
[react-intl](https://github.com/yahoo/react-intl) localisation files in a 
modular fashion.

The idea is that you keep your intl messages as close as possible to the 
component that uses them, which allows you to move your code around. It also 
means that it's easier to track which messages are used by which parts of the 
code - if you remove a file that's being used, Webpack will give you an error.

Let's say you have an components/ActionButtons directory with this file inside:
```
    // src/components/ActionButtons/intl.json
    {
        "en": {
            "save": {
                "default": "Save",
                "busy": "Saving…",
                "retry": "Retry"
            },
            "send": {
                "default": "Send",
                "busy": "Sending…",
                "retry": "Retry"
            }
        }
    }
```

When you require it via Webpack you will get a set of unique message IDs,
something like:
```json
    {
        "save": {
            "default": "components/ActionButtons/intl.json:save.default",
            "busy": "components/ActionButtons/intl.json:save.busy",
            "retry": "components/ActionButtons/intl.json:save.retry"
        },
        "send": {
            "default": "components/ActionButtons/intl.json:send.default",
            "busy": "components/ActionButtons/intl.json:send.busy",
            "retry": "components/ActionButtons/intl.json:send.retry"
        }
    }
```

Notice how the structure of the JSON is preserved. 

You can shorten the module prefixes by setting `shorten` to true in the loader 
options, but this will make the loader non-deterministic because the shortened
prefixes will depend on the order in which the modules are loaded.

Here's a React component that uses this to create a set of localised action
buttons.
```js
    // src/components/ActionButtons/index.js
    import React from "react";
    import {FormattedMessage} from "react-intl";
    import messages from "./intl.json";
    
    export class ActionButton extends React.Component {
        static propTypes = {
            onClick: React.PropTypes.func,
            busy: React.PropTypes.bool,
            error: React.PropTypes.string,
            ids: React.PropTypes.object
        };
        
        getID() {
            if (this.props.busy)
                return this.props.ids.busy;
            if (this.props.error)
                return this.props.ids.retry;
            return this.props.ids.default;
        }
        
        render() {
            return (
                <button onClick={this.props.onClick}
                        disabled={this.props.busy}
                        title={this.props.error}>
                    <FormattedMessage id={this.getID()}/>
                </button>;
            );
        }
    }
    
    export const SaveButton = (props) => 
        <ActionButton {...props} ids={messages.save}/>
        
    export const SendButton = (props) => 
        <ActionButton {...props} ids={messages.send}/>
```

Of course, this isn't useful to you unless you have a dictionary of messages to
pass to `IntlProvider`. That's where `require.context` comes in handy. At the 
root of your project, you can use `require.context` and the `combine` helper to
combine all your intl modules into one:

```js
    // src/IntlProvider.js
    import combine from "react-intl-modules-loader/combine";
    import {IntlProvider} from "react-intl";
    
    const locales = {
        // Require all intl.json files in the project, take the `en`
        // messages from each, and combine them into a single dictionary
        // of messages.
        en: combine(
                require.context(
                    "react-intl-modules-loader?lang=en!./",
                    true, // Recurse into subdirectories
                    /intl\.json$/)),
        fr: combine(require.context("react-intl-modules-loader?lang=fr!./",
                                    true, /intl\.json$/))
    };
    
    export default (props) => 
        <IntlProvider messages={locales[props.lang] || locales.en}>
            {props.children}
        </IntlProvider>;
```