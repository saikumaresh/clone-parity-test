// Generic stub for UI-only modules (vue, codemirror, electron-log, sql-formatter) never called on the CSV path.
const handler = { get: (t, p) => p === '__esModule' ? true : (p === 'default' ? proxy : proxy), apply: () => proxy, construct: () => proxy };
const proxy = new Proxy(function(){}, handler);
module.exports = proxy;
