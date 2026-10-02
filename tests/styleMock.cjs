// CSS is handled by Vite in the app build; Jest has no CSS loader. Map style
// imports to this empty module so a screen that imports a stylesheet can still
// be loaded and rendered under jsdom.
module.exports = {};
