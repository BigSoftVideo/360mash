
// webpack replaces calls to `require()` from within a bundle. This module
// is not parsed by webpack (`noParse` is set in the config)
// and exports the real `require`
// Source: https://stackoverflow.com/a/54559637/13038259
module.exports = require;
