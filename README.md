`react-intl-modules-loader` is a [webpack](https://github.com/webpack/webpack) 
loader which allows you to structure your 
[react-intl](https://github.com/yahoo/react-intl) localisation files in a 
modular fashion.

The idea is that you keep your intl messages as close as possible to the 
component that uses them, which allows you to move your code around. It also 
means that it's easier to track which messages are used by which parts of the 
code - if you remove a file that's being used, Webpack will give you an error.
