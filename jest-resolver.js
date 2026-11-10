// jsdom asks for nanoid's browser build, an ES module Jest can't load, so nanoid resolves to its CommonJS build
module.exports = (path, options) =>
  options.defaultResolver(path, path === "nanoid" ? { ...options, conditions: ["require", "default"] } : options);
